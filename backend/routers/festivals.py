from fastapi import APIRouter, Query, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional, List
import sys, os, json, re

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.connection import get_db_cursor

router = APIRouter(tags=["Festivals"])

# ── Auth ───────────────────────────────────────────────────────────────────────
_ADMIN_SECRET = os.getenv("ADMIN_SECRET_KEY", "change-me-now")

def require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != _ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden: invalid admin key")


# ── Schema ─────────────────────────────────────────────────────────────────────

class FestivalCreate(BaseModel):
    temple_id:     Optional[int] = None   # NULL allowed for general festivals
    name:          str
    description:   Optional[str] = None
    significance:  Optional[str] = None
    month:         int
    hindu_month:   Optional[str] = None
    typical_date:  Optional[str] = None
    duration_days: int = 1
    is_major:      bool = False
    source:        Optional[str] = 'manual'
    ai_generated:  bool = False
    deity:         Optional[str] = None
    festival_type: Optional[str] = None
    emoji:         Optional[str] = None


# ── Ensure festivals table has nullable temple_id ──────────────────────────────

def ensure_festivals_table():
    """
    Make temple_id nullable so general (non-temple) AI festivals can be stored.
    Safe to call multiple times — ALTER only runs if needed.
    """
    with get_db_cursor() as cur:
        # Check if temple_id is already nullable
        cur.execute("""
            SELECT is_nullable
            FROM information_schema.columns
            WHERE table_name = 'festivals' AND column_name = 'temple_id'
        """)
        row = cur.fetchone()
        if row and row["is_nullable"] == "NO":
            # Make it nullable
            cur.execute("ALTER TABLE festivals ALTER COLUMN temple_id DROP NOT NULL")

        # Add color column if missing (used by frontend)
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'festivals' AND column_name = 'color'
        """)
        if not cur.fetchone():
            cur.execute("ALTER TABLE festivals ADD COLUMN color VARCHAR(20)")

        # Add exact_date column if missing
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'festivals' AND column_name = 'exact_date'
        """)
        if not cur.fetchone():
            cur.execute("ALTER TABLE festivals ADD COLUMN exact_date VARCHAR(20)")

        # Add display_date column if missing
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'festivals' AND column_name = 'display_date'
        """)
        if not cur.fetchone():
            cur.execute("ALTER TABLE festivals ADD COLUMN display_date VARCHAR(40)")

        # Add hindu_tithi column if missing
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'festivals' AND column_name = 'hindu_tithi'
        """)
        if not cur.fetchone():
            cur.execute("ALTER TABLE festivals ADD COLUMN hindu_tithi VARCHAR(100)")


# ── GET /api/festivals ─────────────────────────────────────────────────────────

@router.get("/api/festivals")
def get_all_festivals(
    month:    Optional[int]  = Query(None, ge=1, le=12),
    is_major: Optional[bool] = Query(None),
    limit:    int            = Query(500, ge=1, le=1000),
):
    ensure_festivals_table()
    with get_db_cursor() as cur:
        where_conditions = []
        params = []

        if month is not None:
            where_conditions.append("f.month = %s")
            params.append(month)
        if is_major is not None:
            where_conditions.append("f.is_major = %s")
            params.append(is_major)

        where_clause = ("WHERE " + " AND ".join(where_conditions)) if where_conditions else ""

        cur.execute(f"""
            SELECT
                f.id, f.name, f.description, f.significance,
                f.month, f.hindu_month, f.typical_date,
                f.duration_days, f.is_major,
                f.source, f.ai_generated,
                f.deity, f.festival_type, f.emoji,
                f.color, f.exact_date, f.display_date, f.hindu_tithi,
                t.id   AS temple_id,
                t.name AS temple_name,
                t.city AS temple_city,
                t.slug AS temple_slug
            FROM festivals f
            LEFT JOIN temples t ON f.temple_id = t.id
            {where_clause}
            ORDER BY f.month ASC NULLS LAST, f.is_major DESC, f.name ASC
            LIMIT %s
        """, params + [limit])

        rows = cur.fetchall()

    return [dict(r) for r in rows]


# ── GET /api/festivals/month/{n} ───────────────────────────────────────────────

@router.get("/api/festivals/month/{month_number}")
def get_festivals_by_month(month_number: int):
    if not 1 <= month_number <= 12:
        raise HTTPException(400, "month_number must be between 1 and 12")

    ensure_festivals_table()
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                f.id, f.name, f.description, f.significance,
                f.month, f.hindu_month, f.typical_date,
                f.duration_days, f.is_major,
                f.deity, f.festival_type, f.emoji,
                f.color, f.exact_date, f.display_date, f.hindu_tithi,
                t.id   AS temple_id,
                t.name AS temple_name,
                t.slug AS temple_slug
            FROM festivals f
            LEFT JOIN temples t ON f.temple_id = t.id
            WHERE f.month = %s
            ORDER BY f.is_major DESC, f.name ASC
        """, (month_number,))
        rows = cur.fetchall()

    return [dict(r) for r in rows]


# ── GET /api/festivals/status ──────────────────────────────────────────────────
# Frontend uses this to check if AI seed has already been done

@router.get("/api/festivals/status")
def get_festival_status():
    """Returns count of AI-generated general festivals so frontend knows if seed is needed."""
    ensure_festivals_table()
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) AS total,
                   SUM(CASE WHEN ai_generated = TRUE AND temple_id IS NULL THEN 1 ELSE 0 END) AS ai_count
            FROM festivals
        """)
        row = cur.fetchone()
    return {
        "total":    row["total"],
        "ai_count": row["ai_count"] or 0,
        "seeded":   (row["ai_count"] or 0) > 0,
    }


# ── POST /api/admin/festivals/seed-ai ─────────────────────────────────────────
# Called ONCE from frontend/admin — fetches from Claude and saves to DB

@router.post("/api/admin/festivals/seed-ai", dependencies=[Depends(require_admin)])
async def seed_festivals_from_ai():
    """
    Calls Anthropic API once, saves all 2025 Hindu festivals to DB.
    Skips duplicates. Safe to call multiple times.
    """
    import anthropic

    ensure_festivals_table()

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY not set in backend .env")

    client = anthropic.Anthropic(api_key=api_key)

    def make_prompt(months_label: str) -> str:
        return f"""List ALL Hindu festivals for 2025 in months: {months_label}.
Return ONLY a valid JSON array. No explanation, no markdown, no backticks.
Each object must have EXACTLY these fields:
{{"name":"string","month":1,"exact_date":"2025-01-14","display_date":"14 January 2025","hindu_tithi":"string","hindu_month":"string","significance":"one sentence","description":"2-3 sentences max","is_major":true,"duration_days":1,"deity":"Surya","emoji":"🪁","color":"#E8650A"}}
Rules:
- Cover every festival, vrat, Ekadashi, Purnima, Chaturthi
- Include regional festivals (Pongal, Onam, Bihu, Ugadi, Baisakhi etc.)
- is_major=true only for nationally celebrated festivals
- deity: Shiva/Vishnu/Krishna/Rama/Ganesha/Durga/Lakshmi/Saraswati/Surya/Hanuman/Other
- description max 2-3 sentences
- Sort by exact_date ascending
- Output ONLY the JSON array"""

    def call_claude(prompt: str) -> list:
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=6000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text if message.content else "[]"
        # Strip markdown fences if any
        cleaned = re.sub(r'^```json\s*', '', raw.strip(), flags=re.IGNORECASE)
        cleaned = re.sub(r'^```\s*', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\s*```$', '', cleaned)
        try:
            parsed = json.loads(cleaned)
            return parsed if isinstance(parsed, list) else []
        except json.JSONDecodeError:
            # Try partial recovery
            last_comma = cleaned.rfind('},')
            if last_comma != -1:
                try:
                    return json.loads(cleaned[:last_comma + 1] + ']') or []
                except Exception:
                    pass
            return []

    # Two calls: H1 (Jan-Jun) and H2 (Jul-Dec)
    h1 = call_claude(make_prompt("January, February, March, April, May, June"))
    h2 = call_claude(make_prompt("July, August, September, October, November, December"))
    all_festivals = h1 + h2

    if not all_festivals:
        raise HTTPException(500, "Claude returned empty data — try again")

    saved = 0
    skipped = 0

    with get_db_cursor() as cur:
        for f in all_festivals:
            name = (f.get("name") or "").strip()
            month = f.get("month")
            if not name or not isinstance(month, int) or not (1 <= month <= 12):
                skipped += 1
                continue

            # Skip duplicates (same name + month, no temple)
            cur.execute(
                "SELECT id FROM festivals WHERE name = %s AND month = %s AND temple_id IS NULL",
                (name, month)
            )
            if cur.fetchone():
                skipped += 1
                continue

            cur.execute("""
                INSERT INTO festivals (
                    temple_id, name, description, significance,
                    month, hindu_month, typical_date,
                    duration_days, is_major,
                    source, ai_generated,
                    deity, festival_type, emoji,
                    color, exact_date, display_date, hindu_tithi
                ) VALUES (
                    NULL, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    'claude_ai', TRUE,
                    %s, %s, %s,
                    %s, %s, %s, %s
                )
            """, (
                name,
                f.get("description"),
                f.get("significance"),
                month,
                f.get("hindu_month"),
                f.get("exact_date"),
                int(f.get("duration_days") or 1),
                bool(f.get("is_major", False)),
                f.get("deity"),
                f.get("festival_type"),
                f.get("emoji"),
                f.get("color"),
                f.get("exact_date"),
                f.get("display_date"),
                f.get("hindu_tithi"),
            ))
            saved += 1

    return {
        "success": True,
        "message": f"{saved} festivals saved, {skipped} skipped (duplicates/invalid)",
        "saved":   saved,
        "skipped": skipped,
        "total_from_claude": len(all_festivals),
    }


# ── POST /api/admin/festivals ──────────────────────────────────────────────────

@router.post("/api/admin/festivals", status_code=201, dependencies=[Depends(require_admin)])
def create_festival(body: FestivalCreate):
    ensure_festivals_table()

    if not 1 <= body.month <= 12:
        raise HTTPException(400, "month must be between 1 and 12")
    if body.duration_days < 1:
        raise HTTPException(400, "duration_days must be at least 1")

    festival_name = body.name.strip()
    if not festival_name:
        raise HTTPException(400, "name must not be empty or whitespace")

    with get_db_cursor() as cur:
        temple = None
        if body.temple_id:
            cur.execute("SELECT id, name, slug FROM temples WHERE id = %s", (body.temple_id,))
            temple = cur.fetchone()
            if not temple:
                raise HTTPException(404, f"Temple with id={body.temple_id} not found")

        cur.execute(
            "SELECT id FROM festivals WHERE temple_id IS NOT DISTINCT FROM %s AND name = %s AND month = %s",
            (body.temple_id, festival_name, body.month)
        )
        if cur.fetchone():
            raise HTTPException(409, f"'{festival_name}' already exists for this month")

        cur.execute("""
            INSERT INTO festivals (
                temple_id, name, description, significance,
                month, hindu_month, typical_date,
                duration_days, is_major,
                source, ai_generated,
                deity, festival_type, emoji
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id
        """, (
            body.temple_id, festival_name, body.description, body.significance,
            body.month, body.hindu_month, body.typical_date,
            body.duration_days, body.is_major,
            body.source or 'manual', body.ai_generated,
            body.deity, body.festival_type, body.emoji,
        ))

        festival_id = cur.fetchone()["id"]

    return {
        "success":     True,
        "message":     f"Festival '{festival_name}' added" + (f" to {temple['name']}" if temple else ""),
        "festival_id": festival_id,
        "temple_slug": temple["slug"] if temple else None,
    }