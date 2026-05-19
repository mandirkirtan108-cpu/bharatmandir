from fastapi import APIRouter, Query, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional
import sys, os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.connection import get_db_cursor

router = APIRouter(tags=["Festivals"])

# ── Auth (reuse same admin key) ───────────────────────────────────────────────
_ADMIN_SECRET = os.getenv("ADMIN_SECRET_KEY", "change-me-now")

def require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != _ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden: invalid admin key")


# ── Schema ─────────────────────────────────────────────────────────────────────

class FestivalCreate(BaseModel):
    temple_id:     int
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


# ── GET /api/festivals ─────────────────────────────────────────────────────────

@router.get("/api/festivals")
def get_all_festivals(
    month:    Optional[int]  = Query(None, ge=1, le=12),
    is_major: Optional[bool] = Query(None),
    limit:    int            = Query(200, ge=1, le=500),
):
    with get_db_cursor() as cur:
        # ✅ FIX: JOIN conditions (structural) separated from WHERE conditions (filters)
        where_conditions = ["t.status = 'published'"]
        params = []

        if month is not None:
            where_conditions.append("f.month = %s")
            params.append(month)
        if is_major is not None:
            where_conditions.append("f.is_major = %s")
            params.append(is_major)

        where_clause = " AND ".join(where_conditions)

        cur.execute(f"""
            SELECT
                f.id, f.name, f.description, f.significance,
                f.month, f.hindu_month, f.typical_date,
                f.duration_days, f.is_major,
                f.source, f.ai_generated,
                f.deity, f.festival_type, f.emoji,
                t.id   AS temple_id,
                t.name AS temple_name,
                t.city AS temple_city,
                t.slug AS temple_slug
            FROM festivals f
            JOIN temples t ON f.temple_id = t.id
            WHERE {where_clause}
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

    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                f.id, f.name, f.description, f.significance,
                f.month, f.hindu_month, f.typical_date,
                f.duration_days, f.is_major,
                f.deity, f.festival_type, f.emoji,
                t.id   AS temple_id,
                t.name AS temple_name,
                t.slug AS temple_slug
            FROM festivals f
            JOIN temples t ON f.temple_id = t.id
            WHERE f.month = %s
              AND t.status = 'published'
            ORDER BY f.is_major DESC, f.name ASC
        """, (month_number,))
        rows = cur.fetchall()

    return [dict(r) for r in rows]


# ── POST /api/admin/festivals ──────────────────────────────────────────────────

@router.post("/api/admin/festivals", status_code=201, dependencies=[Depends(require_admin)])
def create_festival(body: FestivalCreate):
    if not 1 <= body.month <= 12:
        raise HTTPException(400, "month must be between 1 and 12")
    if body.duration_days < 1:
        raise HTTPException(400, "duration_days must be at least 1")

    # ✅ FIX: strip name once and reuse, avoid stripping twice
    festival_name = body.name.strip()
    if not festival_name:
        raise HTTPException(400, "name must not be empty or whitespace")

    with get_db_cursor() as cur:
        cur.execute("SELECT id, name, slug FROM temples WHERE id = %s", (body.temple_id,))
        temple = cur.fetchone()
        if not temple:
            raise HTTPException(404, f"Temple with id={body.temple_id} not found")

        cur.execute(
            "SELECT id FROM festivals WHERE temple_id = %s AND name = %s AND month = %s",
            (body.temple_id, festival_name, body.month)
        )
        if cur.fetchone():
            raise HTTPException(409, f"'{festival_name}' already exists for this temple in that month")

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
        "message":     f"Festival '{festival_name}' added to {temple['name']}",
        "festival_id": festival_id,
        "temple_slug": temple["slug"],
    }

# ═════════════════════════════════════════════════════════════════════════════
# AI FESTIVAL CACHE ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════
from typing import List
from datetime import date
from pydantic import BaseModel as _BM

class AIFestivalItem(_BM):
    name: str
    month: int
    exact_date: str = None
    display_date: str = None
    hindu_tithi: str = None
    hindu_month: str = None
    significance: str = None
    description: str = None
    is_major: bool = False
    duration_days: int = 1
    deity: str = None
    emoji: str = None
    color: str = None

class AIFestivalBulkSave(_BM):
    year: int
    festivals: List[AIFestivalItem]

@router.get("/api/festivals/ai-cache/status")
def get_ai_cache_status(year: int = Query(default=None)):
    current_year = year or date.today().year
    try:
        with get_db_cursor() as cur:
            cur.execute("SELECT COUNT(*) AS total, MAX(fetched_on) AS last_fetched FROM ai_festival_cache WHERE year = %s", (current_year,))
            row = dict(cur.fetchone())
    except Exception:
        return {"year": current_year, "total": 0, "last_fetched": None, "needs_refresh": True, "today": date.today().isoformat()}
    total = row["total"] or 0
    last_fetched = row["last_fetched"]
    today = date.today()
    needs_refresh = total == 0
    if not needs_refresh and last_fetched:
        if today.day == 1 and not (last_fetched.year == today.year and last_fetched.month == today.month):
            needs_refresh = True
        elif last_fetched.year != today.year:
            needs_refresh = True
    return {"year": current_year, "total": total, "last_fetched": last_fetched.isoformat() if last_fetched else None, "needs_refresh": needs_refresh, "today": today.isoformat()}

@router.get("/api/festivals/ai-cache")
def get_ai_cached_festivals(year: int = Query(default=None), month: Optional[int] = Query(default=None, ge=1, le=12)):
    current_year = year or date.today().year
    try:
        with get_db_cursor() as cur:
            if month:
                cur.execute("SELECT id, name, month, exact_date, display_date, hindu_tithi, hindu_month, significance, description, deity, emoji, color, is_major, duration_days, year, fetched_on FROM ai_festival_cache WHERE year = %s AND month = %s ORDER BY exact_date ASC NULLS LAST, name ASC", (current_year, month))
            else:
                cur.execute("SELECT id, name, month, exact_date, display_date, hindu_tithi, hindu_month, significance, description, deity, emoji, color, is_major, duration_days, year, fetched_on FROM ai_festival_cache WHERE year = %s ORDER BY month ASC, exact_date ASC NULLS LAST, name ASC", (current_year,))
            rows = cur.fetchall()
    except Exception:
        return {"festivals": [], "source": "db_cache", "total": 0}
    return {"festivals": [dict(r) for r in rows], "source": "db_cache", "total": len(rows), "year": current_year}

@router.post("/api/festivals/ai-cache", status_code=201)
def save_ai_festivals(body: AIFestivalBulkSave):
    if not body.festivals:
        raise HTTPException(400, "festivals list empty hai")
    try:
        with get_db_cursor() as cur:
            cur.execute("""CREATE TABLE IF NOT EXISTS ai_festival_cache (id SERIAL PRIMARY KEY, name TEXT NOT NULL, month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12), exact_date DATE, display_date TEXT, hindu_tithi TEXT, hindu_month TEXT, significance TEXT, description TEXT, deity TEXT, emoji TEXT, color TEXT, is_major BOOLEAN DEFAULT FALSE, duration_days SMALLINT DEFAULT 1, year SMALLINT NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()), fetched_on DATE NOT NULL DEFAULT CURRENT_DATE, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE (name, month, year))""")
    except Exception:
        pass
    saved = 0
    skipped = 0
    today = date.today().isoformat()
    with get_db_cursor() as cur:
        for f in body.festivals:
            name = (f.name or "").strip()
            if not name or not (1 <= f.month <= 12):
                skipped += 1
                continue
            exact_date_val = None
            if f.exact_date:
                try:
                    exact_date_val = date.fromisoformat(f.exact_date)
                except ValueError:
                    pass
            cur.execute("INSERT INTO ai_festival_cache (name, month, exact_date, display_date, hindu_tithi, hindu_month, significance, description, deity, emoji, color, is_major, duration_days, year, fetched_on) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (name, month, year) DO UPDATE SET exact_date=EXCLUDED.exact_date, display_date=EXCLUDED.display_date, hindu_tithi=EXCLUDED.hindu_tithi, hindu_month=EXCLUDED.hindu_month, significance=EXCLUDED.significance, description=EXCLUDED.description, deity=EXCLUDED.deity, emoji=EXCLUDED.emoji, color=EXCLUDED.color, is_major=EXCLUDED.is_major, duration_days=EXCLUDED.duration_days, fetched_on=EXCLUDED.fetched_on",
                (name, f.month, exact_date_val, f.display_date, f.hindu_tithi, f.hindu_month, f.significance, f.description, f.deity, f.emoji, f.color, f.is_major, f.duration_days or 1, body.year, today))
            saved += 1
    return {"success": True, "saved": saved, "skipped": skipped, "year": body.year}

@router.delete("/api/festivals/ai-cache", dependencies=[Depends(require_admin)])
def clear_ai_festival_cache(year: int = Query(...)):
    with get_db_cursor() as cur:
        cur.execute("DELETE FROM ai_festival_cache WHERE year = %s RETURNING id", (year,))
        deleted = len(cur.fetchall())
    return {"success": True, "deleted": deleted, "year": year}