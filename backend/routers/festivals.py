"""
festivals.py — BharatMandir Festival Router
Fixed:
  1. DB inserts run in a thread (sync psycopg2 can't be awaited)
  2. Each festival inserted in its own transaction — one failure won't rollback all
  3. Full error logging so failures are visible in terminal
  4. /seed endpoint returns inserted count synchronously (no silent background task)
  5. Schema-exact columns only (no deity/emoji/festival_type — not in DB)
"""

from fastapi import APIRouter, Query, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional
import sys, os, httpx, json, logging

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.connection import get_db_cursor

router = APIRouter(tags=["Festivals"])
logger = logging.getLogger(__name__)

# ── Auth ───────────────────────────────────────────────────────────────────────
_ADMIN_SECRET  = os.getenv("ADMIN_SECRET_KEY", "change-me-now")
_ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")

def require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != _ADMIN_SECRET:
        raise HTTPException(403, "Forbidden: invalid admin key")


# ── Pydantic Models ────────────────────────────────────────────────────────────

class FestivalCreate(BaseModel):
    """Schema-exact: matches every column in the festivals table."""
    temple_id:    int
    name:         str
    description:  Optional[str] = None
    significance: Optional[str] = None
    month:        int                    # 1-12 (Gregorian)
    hindu_month:  Optional[str] = None
    typical_date: Optional[str] = None  # free text e.g. "14 January"
    duration_days: int = 1
    is_major:     bool = False
    source:       Optional[str] = "manual"  # must be valid data_source enum
    ai_generated: bool = False


class SeedFestivalsRequest(BaseModel):
    temple_id: int
    force:     bool = False   # if True, re-seed even if AI festivals already exist


# ── Claude prompt ──────────────────────────────────────────────────────────────

CLAUDE_MODEL   = "claude-sonnet-4-20250514"
CLAUDE_MAX_TOK = 4000

def _build_prompt(temple_name: str, deity: str, city: str) -> str:
    return f"""You are a Hindu festival data expert.
List 10-15 festivals celebrated at this temple or strongly associated with its deity.

Temple : {temple_name}
Deity  : {deity}
City   : {city}

Return ONLY a valid JSON array — no markdown, no explanation, no code fences.
Every object must have EXACTLY these keys:

[
  {{
    "name": "Maha Shivaratri",
    "description": "2-3 sentence description of the festival.",
    "significance": "One sentence: why this festival matters.",
    "month": 2,
    "hindu_month": "Phalguna",
    "typical_date": "Late February",
    "duration_days": 1,
    "is_major": true
  }}
]

Rules:
- month is an integer 1-12 (Gregorian calendar month)
- is_major = true only for nationally celebrated festivals
- Keep description under 60 words to avoid token truncation
- Sort by month ascending
- Output ONLY the JSON array, nothing else"""


# ── DB insert helper (pure sync — safe to call from thread) ───────────────────

def _insert_festivals_sync(temple_id: int, festivals: list) -> list:
    """
    Insert each festival in its own transaction.
    Returns list of inserted names.
    Skips duplicates silently.
    Logs and skips any festival that fails validation or DB insert.
    """
    inserted = []

    for f in festivals:
        name  = (f.get("name") or "").strip()
        month = f.get("month")

        # ── Validate ──
        if not name:
            logger.warning("Skipping festival with empty name: %s", f)
            continue
        if not isinstance(month, int) or not (1 <= month <= 12):
            logger.warning("Skipping '%s' — invalid month: %s", name, month)
            continue

        duration = int(f.get("duration_days") or 1)
        if duration < 1:
            duration = 1

        description  = (f.get("description") or "").strip() or None
        significance = (f.get("significance") or "").strip() or None
        hindu_month  = (f.get("hindu_month") or "").strip() or None
        typical_date = (f.get("typical_date") or "").strip() or None
        is_major     = bool(f.get("is_major", False))

        try:
            # Each festival gets its own with-block = its own transaction + commit
            with get_db_cursor() as cur:
                # Duplicate check
                cur.execute(
                    "SELECT id FROM festivals WHERE temple_id=%s AND name=%s AND month=%s",
                    (temple_id, name, month),
                )
                if cur.fetchone():
                    logger.info("Duplicate skipped: '%s' month=%d", name, month)
                    continue

                cur.execute(
                    """
                    INSERT INTO festivals
                      (temple_id, name, description, significance,
                       month, hindu_month, typical_date,
                       duration_days, is_major, source, ai_generated)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'ai_enriched', true)
                    RETURNING id
                    """,
                    (
                        temple_id, name, description, significance,
                        month, hindu_month, typical_date,
                        duration, is_major,
                    ),
                )
                row = cur.fetchone()
                if row:
                    inserted.append(name)
                    logger.info("Inserted festival '%s' (id=%s)", name, row["id"])

        except Exception as exc:
            # Log the exact error but keep going for remaining festivals
            logger.error("Failed to insert '%s': %s", name, exc)

    return inserted


# ── Claude API call + DB insert (runs in thread pool) ─────────────────────────

async def _seed_via_claude(temple_id: int, temple_name: str, deity: str, city: str) -> dict:
    """
    1. Call Claude API (async httpx)
    2. Parse JSON response
    3. Run DB inserts in a thread (sync psycopg2 must not be awaited directly)
    Returns {"inserted": [...], "skipped": int, "error": str|None}
    """
    if not _ANTHROPIC_KEY:
        msg = "ANTHROPIC_API_KEY is not set in .env — cannot call Claude"
        logger.error(msg)
        return {"inserted": [], "skipped": 0, "error": msg}

    prompt = _build_prompt(temple_name, deity or "Various Hindu deities", city or "India")

    # ── Step 1: Call Claude ────────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key":         _ANTHROPIC_KEY,
                    "anthropic-version": "2023-06-01",
                    "Content-Type":      "application/json",
                },
                json={
                    "model":      CLAUDE_MODEL,
                    "max_tokens": CLAUDE_MAX_TOK,
                    "messages":   [{"role": "user", "content": prompt}],
                },
            )
    except httpx.TimeoutException:
        msg = "Claude API timed out after 90s"
        logger.error(msg)
        return {"inserted": [], "skipped": 0, "error": msg}
    except Exception as exc:
        msg = f"Claude API network error: {exc}"
        logger.error(msg)
        return {"inserted": [], "skipped": 0, "error": msg}

    if resp.status_code != 200:
        msg = f"Claude API HTTP {resp.status_code}: {resp.text[:300]}"
        logger.error(msg)
        return {"inserted": [], "skipped": 0, "error": msg}

    # ── Step 2: Parse response ─────────────────────────────────────────────────
    try:
        api_data = resp.json()
    except Exception as exc:
        msg = f"Failed to parse Claude response as JSON: {exc}"
        logger.error(msg)
        return {"inserted": [], "skipped": 0, "error": msg}

    raw_text = ""
    for block in api_data.get("content", []):
        if block.get("type") == "text":
            raw_text = block.get("text", "")
            break

    if not raw_text:
        msg = f"Claude returned empty content. Full response: {api_data}"
        logger.error(msg)
        return {"inserted": [], "skipped": 0, "error": msg}

    logger.info("Claude raw (first 500 chars): %s", raw_text[:500])

    # Strip markdown code fences
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()

    try:
        festivals = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        logger.warning("Full JSON parse failed (%s), trying partial recovery…", exc)
        last = cleaned.rfind("},")
        if last != -1:
            try:
                festivals = json.loads(cleaned[: last + 1] + "]")
                logger.info("Partial recovery: got %d festivals", len(festivals))
            except Exception:
                msg = f"JSON parse failed. Raw text: {cleaned[:400]}"
                logger.error(msg)
                return {"inserted": [], "skipped": 0, "error": msg}
        else:
            msg = f"Claude did not return valid JSON. Raw: {cleaned[:400]}"
            logger.error(msg)
            return {"inserted": [], "skipped": 0, "error": msg}

    if not isinstance(festivals, list):
        msg = f"Expected JSON array, got {type(festivals).__name__}"
        logger.error(msg)
        return {"inserted": [], "skipped": 0, "error": msg}

    logger.info("Claude returned %d festival objects for temple_id=%d", len(festivals), temple_id)

    # ── Step 3: Insert in thread (sync psycopg2 inside async endpoint) ────────
    import asyncio
    loop = asyncio.get_event_loop()
    inserted = await loop.run_in_executor(None, _insert_festivals_sync, temple_id, festivals)

    skipped = len(festivals) - len(inserted)
    return {"inserted": inserted, "skipped": skipped, "error": None}


# ══════════════════════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════════════════════

# ── GET /api/festivals ─────────────────────────────────────────────────────────

@router.get("/api/festivals")
def get_all_festivals(
    month:    Optional[int]  = Query(None, ge=1, le=12),
    is_major: Optional[bool] = Query(None),
    limit:    int            = Query(200, ge=1, le=500),
):
    where  = ["t.status = 'published'"]
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
                t.id            AS temple_id,
                t.name          AS temple_name,
                t.city          AS temple_city,
                t.slug          AS temple_slug,
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
                t.id            AS temple_id,
                t.name          AS temple_name,
                t.slug          AS temple_slug,
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
        raise HTTPException(400, "duration_days must be >= 1")

    name = body.name.strip()
    if not name:
        raise HTTPException(400, "name must not be empty")

    valid_sources = {
        "wikidata","wikipedia","google_places","openstreetmap",
        "government","ai_enriched","manual","partnership","csv_import",
    }
    src = (body.source or "manual").strip()
    if src not in valid_sources:
        raise HTTPException(400, f"source must be one of: {sorted(valid_sources)}")

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

@router.post("/api/admin/festivals/seed", dependencies=[Depends(require_admin)])
async def seed_festivals_from_claude(body: SeedFestivalsRequest):
    """
    Synchronously calls Claude + saves to DB. Returns full result.
    No background tasks — you see exactly what was inserted or what failed.
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
                "SELECT COUNT(*) AS cnt FROM festivals WHERE temple_id=%s AND ai_generated=true",
                (body.temple_id,),
            )
            existing = cur.fetchone()["cnt"]
            if existing > 0:
                return {
                    "status":         "skipped",
                    "message":        f"Already has {existing} AI festivals. Use force=true to re-seed.",
                    "inserted_count": 0,
                    "inserted_names": [],
                    "skipped":        existing,
                    "error":          None,
                }

    result = await _seed_via_claude(
        temple_id   = body.temple_id,
        temple_name = temple["name"],
        deity       = temple["primary_deity"] or "",
        city        = temple["city"] or "",
    )

    if result["error"]:
        return {
            "status":         "error",
            "message":        result["error"],
            "inserted_count": 0,
            "inserted_names": [],
            "skipped":        0,
            "error":          result["error"],
        }

    return {
        "status":         "success",
        "message":        f"Seeded {len(result['inserted'])} festivals for '{temple['name']}'",
        "inserted_count": len(result["inserted"]),
        "inserted_names": result["inserted"],
        "skipped":        result["skipped"],
        "error":          None,
    }


# ── GET /api/admin/festivals/seed/status/{temple_id} ──────────────────────────

@router.get("/api/admin/festivals/seed/status/{temple_id}", dependencies=[Depends(require_admin)])
def seed_status(temple_id: int):
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT
                COUNT(*)                                       AS total,
                COUNT(*) FILTER (WHERE ai_generated = true)   AS ai_count,
                COUNT(*) FILTER (WHERE ai_generated = false)  AS manual_count
            FROM festivals WHERE temple_id = %s
            """,
            (temple_id,),
        )
        return dict(cur.fetchone())