from fastapi import APIRouter, Query, HTTPException, Header, Depends, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import sys, os, httpx, json, asyncio, logging

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.connection import get_db_cursor

router = APIRouter(tags=["Festivals"])
logger = logging.getLogger(__name__)

# ── Auth ───────────────────────────────────────────────────────────────────────
_ADMIN_SECRET    = os.getenv("ADMIN_SECRET_KEY", "change-me-now")
_ANTHROPIC_KEY   = os.getenv("ANTHROPIC_API_KEY", "")

def require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != _ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden: invalid admin key")


# ── Schemas ────────────────────────────────────────────────────────────────────

class FestivalCreate(BaseModel):
    """
    Matches festivals table exactly:
      id, uuid, temple_id, name, description, significance,
      month, hindu_month, typical_date, duration_days,
      is_major, source (data_source enum), ai_generated, created_at
    NOTE: deity / festival_type / emoji are NOT in the DB — they are
          derived at query time from the festivals + temples join.
    """
    temple_id:    int
    name:         str
    description:  Optional[str] = None
    significance: Optional[str] = None
    month:        int
    hindu_month:  Optional[str] = None
    typical_date: Optional[str] = None   # e.g. "14 January"
    duration_days: int = 1
    is_major:     bool = False
    # source must be one of the data_source enum values
    source:       Optional[str] = "manual"   # 'manual' | 'ai_enriched' | etc.
    ai_generated: bool = False


class SeedFestivalsRequest(BaseModel):
    """Body for POST /api/admin/festivals/seed"""
    temple_id: int          # which temple to seed festivals for
    force:     bool = False  # re-seed even if festivals already exist


# ── Helper: call Claude API (server-side, key stays secret) ───────────────────

CLAUDE_MODEL   = "claude-sonnet-4-20250514"
CLAUDE_MAX_TOK = 4000

def _build_prompt(temple_name: str, temple_deity: str, temple_city: str) -> str:
    return f"""List all major Hindu festivals celebrated at or closely associated with the temple:
Temple: {temple_name}
Primary deity: {temple_deity}
Location: {temple_city}

Return ONLY a valid JSON array. No markdown, no explanation, no backticks.
Each object must have EXACTLY these fields (matching the database schema):
{{
  "name": "string",
  "description": "2-3 sentence description",
  "significance": "one sentence significance",
  "month": 1,
  "hindu_month": "Pausha",
  "typical_date": "14 January",
  "duration_days": 1,
  "is_major": true
}}

Rules:
- Include 8-15 festivals relevant to this deity/temple
- month: integer 1-12 (Gregorian)
- is_major: true only for nationally celebrated festivals
- Sort by month ascending
- Output ONLY the JSON array"""


async def _fetch_claude_festivals(
    temple_id: int,
    temple_name: str,
    temple_deity: str,
    temple_city: str,
) -> list[dict]:
    """Call Claude, parse response, insert into DB."""
    if not _ANTHROPIC_KEY:
        logger.warning("ANTHROPIC_API_KEY not set — skipping Claude seed")
        return []

    prompt = _build_prompt(temple_name, temple_deity or "Various deities", temple_city or "India")

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key":          _ANTHROPIC_KEY,
                    "anthropic-version":  "2023-06-01",
                    "Content-Type":       "application/json",
                },
                json={
                    "model":      CLAUDE_MODEL,
                    "max_tokens": CLAUDE_MAX_TOK,
                    "messages":   [{"role": "user", "content": prompt}],
                },
            )
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:
        logger.error("Claude API error: %s", exc)
        return []

    raw = data.get("content", [{}])[0].get("text", "[]")
    cleaned = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()

    try:
        festivals = json.loads(cleaned)
    except json.JSONDecodeError:
        # partial-parse recovery
        last_comma = cleaned.rfind("},")
        if last_comma != -1:
            try:
                festivals = json.loads(cleaned[: last_comma + 1] + "]")
            except Exception:
                return []
        else:
            return []

    if not isinstance(festivals, list):
        return []

    inserted = []
    with get_db_cursor() as cur:
        for f in festivals:
            name = (f.get("name") or "").strip()
            month = f.get("month")
            if not name or not isinstance(month, int) or not (1 <= month <= 12):
                continue

            # skip duplicates
            cur.execute(
                "SELECT id FROM festivals WHERE temple_id=%s AND name=%s AND month=%s",
                (temple_id, name, month),
            )
            if cur.fetchone():
                continue

            cur.execute(
                """
                INSERT INTO festivals
                  (temple_id, name, description, significance,
                   month, hindu_month, typical_date,
                   duration_days, is_major, source, ai_generated)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'ai_enriched',true)
                RETURNING id
                """,
                (
                    temple_id,
                    name,
                    (f.get("description") or "").strip() or None,
                    (f.get("significance") or "").strip() or None,
                    month,
                    (f.get("hindu_month") or "").strip() or None,
                    (f.get("typical_date") or "").strip() or None,
                    int(f.get("duration_days") or 1),
                    bool(f.get("is_major", False)),
                ),
            )
            row = cur.fetchone()
            if row:
                inserted.append(row["id"])

    logger.info("Seeded %d festivals for temple_id=%d", len(inserted), temple_id)
    return inserted


# ── GET /api/festivals ─────────────────────────────────────────────────────────

@router.get("/api/festivals")
def get_all_festivals(
    month:    Optional[int]  = Query(None, ge=1, le=12),
    is_major: Optional[bool] = Query(None),
    limit:    int            = Query(200, ge=1, le=500),
):
    """
    Returns festivals joined with temple info.
    All data comes from the database — always fresh for every user.
    """
    where = ["t.status = 'published'"]
    params: list = []

    if month is not None:
        where.append("f.month = %s")
        params.append(month)
    if is_major is not None:
        where.append("f.is_major = %s")
        params.append(is_major)

    clause = " AND ".join(where)

    with get_db_cursor() as cur:
        cur.execute(
            f"""
            SELECT
                f.id,
                f.name,
                f.description,
                f.significance,
                f.month,
                f.hindu_month,
                f.typical_date,
                f.duration_days,
                f.is_major,
                f.source,
                f.ai_generated,
                f.created_at,
                t.id   AS temple_id,
                t.name AS temple_name,
                t.city AS temple_city,
                t.slug AS temple_slug,
                t.primary_deity AS deity
            FROM festivals f
            JOIN temples t ON f.temple_id = t.id
            WHERE {clause}
            ORDER BY f.month ASC NULLS LAST, f.is_major DESC, f.name ASC
            LIMIT %s
            """,
            params + [limit],
        )
        rows = cur.fetchall()

    return [dict(r) for r in rows]


# ── GET /api/festivals/month/{n} ───────────────────────────────────────────────

@router.get("/api/festivals/month/{month_number}")
def get_festivals_by_month(month_number: int):
    if not 1 <= month_number <= 12:
        raise HTTPException(400, "month_number must be 1–12")

    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT
                f.id, f.name, f.description, f.significance,
                f.month, f.hindu_month, f.typical_date,
                f.duration_days, f.is_major, f.ai_generated,
                t.id   AS temple_id,
                t.name AS temple_name,
                t.slug AS temple_slug,
                t.primary_deity AS deity
            FROM festivals f
            JOIN temples t ON f.temple_id = t.id
            WHERE f.month = %s AND t.status = 'published'
            ORDER BY f.is_major DESC, f.name ASC
            """,
            (month_number,),
        )
        rows = cur.fetchall()

    return [dict(r) for r in rows]


# ── POST /api/admin/festivals ── manual add ────────────────────────────────────

@router.post("/api/admin/festivals", status_code=201, dependencies=[Depends(require_admin)])
def create_festival(body: FestivalCreate):
    if not 1 <= body.month <= 12:
        raise HTTPException(400, "month must be 1–12")
    if body.duration_days < 1:
        raise HTTPException(400, "duration_days must be ≥ 1")

    name = body.name.strip()
    if not name:
        raise HTTPException(400, "name must not be empty")

    # validate source enum
    valid_sources = {
        "wikidata","wikipedia","google_places","openstreetmap",
        "government","ai_enriched","manual","partnership","csv_import",
    }
    src = body.source or "manual"
    if src not in valid_sources:
        raise HTTPException(400, f"source must be one of: {', '.join(sorted(valid_sources))}")

    with get_db_cursor() as cur:
        cur.execute("SELECT id, name, slug FROM temples WHERE id = %s", (body.temple_id,))
        temple = cur.fetchone()
        if not temple:
            raise HTTPException(404, f"Temple id={body.temple_id} not found")

        cur.execute(
            "SELECT id FROM festivals WHERE temple_id=%s AND name=%s AND month=%s",
            (body.temple_id, name, body.month),
        )
        if cur.fetchone():
            raise HTTPException(409, f"'{name}' already exists for this temple in month {body.month}")

        cur.execute(
            """
            INSERT INTO festivals
              (temple_id, name, description, significance,
               month, hindu_month, typical_date,
               duration_days, is_major, source, ai_generated)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
            """,
            (
                body.temple_id, name,
                body.description, body.significance,
                body.month, body.hindu_month, body.typical_date,
                body.duration_days, body.is_major,
                src, body.ai_generated,
            ),
        )
        festival_id = cur.fetchone()["id"]

    return {
        "success":     True,
        "message":     f"Festival '{name}' added to {temple['name']}",
        "festival_id": festival_id,
        "temple_slug": temple["slug"],
    }


# ── POST /api/admin/festivals/seed ── Claude-powered seed ─────────────────────

@router.post(
    "/api/admin/festivals/seed",
    status_code=202,
    dependencies=[Depends(require_admin)],
)
async def seed_festivals_from_claude(body: SeedFestivalsRequest, background_tasks: BackgroundTasks):
    """
    Calls Claude API (server-side) to generate festivals for a temple,
    saves them to the DB with source='ai_enriched', ai_generated=true.
    Returns immediately; seeding runs in background.
    """
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT id, name, city, primary_deity FROM temples WHERE id = %s",
            (body.temple_id,),
        )
        temple = cur.fetchone()
        if not temple:
            raise HTTPException(404, f"Temple id={body.temple_id} not found")

        if not body.force:
            cur.execute(
                "SELECT COUNT(*) AS cnt FROM festivals WHERE temple_id = %s AND ai_generated = true",
                (body.temple_id,),
            )
            existing = cur.fetchone()["cnt"]
            if existing > 0:
                return {
                    "status":  "skipped",
                    "message": f"Temple already has {existing} AI-generated festivals. Use force=true to re-seed.",
                    "count":   existing,
                }

    background_tasks.add_task(
        _fetch_claude_festivals,
        body.temple_id,
        temple["name"],
        temple["primary_deity"] or "",
        temple["city"] or "",
    )

    return {
        "status":  "seeding",
        "message": f"Claude is generating festivals for '{temple['name']}' in background. Check /api/festivals in ~10s.",
        "temple_id": body.temple_id,
    }


# ── GET /api/admin/festivals/seed/status/{temple_id} ──────────────────────────

@router.get(
    "/api/admin/festivals/seed/status/{temple_id}",
    dependencies=[Depends(require_admin)],
)
def seed_status(temple_id: int):
    """Check how many festivals exist for a temple (manual + AI)."""
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT
                COUNT(*)                                           AS total,
                COUNT(*) FILTER (WHERE ai_generated = true)       AS ai_count,
                COUNT(*) FILTER (WHERE ai_generated = false)      AS manual_count
            FROM festivals WHERE temple_id = %s
            """,
            (temple_id,),
        )
        row = cur.fetchone()
    return dict(row)