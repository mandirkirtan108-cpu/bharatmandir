from fastapi import APIRouter, Query, HTTPException, Header, Depends
from pydantic import BaseModel
from typing import Optional
import sys, os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.connection import get_db_cursor

router = APIRouter(tags=["Festivals"])

# ── Auth ──────────────────────────────────────────────────────────────────────
_ADMIN_SECRET = os.getenv("ADMIN_SECRET_KEY", "change-me-now")

def require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != _ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden: invalid admin key")


# ── Schema ────────────────────────────────────────────────────────────────────
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


# ── GET /api/festivals ────────────────────────────────────────────────────────
@router.get("/api/festivals")
def get_all_festivals(
    month:    Optional[int]  = Query(None, ge=1, le=12),
    is_major: Optional[bool] = Query(None),
    limit:    int            = Query(200, ge=1, le=500),
):
    """
    Returns temple-linked festivals only (excludes ai_cache rows).
    AI festivals are served separately via /api/festivals/ai-cache.
    """
    with get_db_cursor() as cur:
        where_conditions = [
            "t.status = 'published'",
            "f.source != 'ai_cache'",   # ← exclude AI-cache rows from this endpoint
        ]
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
                f.display_date, f.color,
                t.id   AS temple_id,
                t.name AS temple_name,
                t.city AS temple_city,
                t.slug AS temple_slug
            FROM public.festivals f
            JOIN public.temples t ON f.temple_id = t.id
            WHERE {where_clause}
            ORDER BY f.month ASC NULLS LAST, f.is_major DESC, f.name ASC
            LIMIT %s
        """, params + [limit])

        rows = cur.fetchall()

    return [dict(r) for r in rows]


# ── GET /api/festivals/month/{n} ──────────────────────────────────────────────
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
                f.display_date, f.color,
                t.id   AS temple_id,
                t.name AS temple_name,
                t.slug AS temple_slug
            FROM public.festivals f
            JOIN public.temples t ON f.temple_id = t.id
            WHERE f.month = %s
              AND t.status = 'published'
              AND f.source != 'ai_cache'
            ORDER BY f.is_major DESC, f.name ASC
        """, (month_number,))
        rows = cur.fetchall()

    return [dict(r) for r in rows]


# ── POST /api/admin/festivals ─────────────────────────────────────────────────
@router.post("/api/admin/festivals", status_code=201, dependencies=[Depends(require_admin)])
def create_festival(body: FestivalCreate):
    if not 1 <= body.month <= 12:
        raise HTTPException(400, "month must be between 1 and 12")
    if body.duration_days < 1:
        raise HTTPException(400, "duration_days must be at least 1")

    festival_name = body.name.strip()
    if not festival_name:
        raise HTTPException(400, "name must not be empty or whitespace")

    with get_db_cursor() as cur:
        cur.execute("SELECT id, name, slug FROM public.temples WHERE id = %s", (body.temple_id,))
        temple = cur.fetchone()
        if not temple:
            raise HTTPException(404, f"Temple with id={body.temple_id} not found")

        cur.execute(
            "SELECT id FROM public.festivals WHERE temple_id = %s AND name = %s AND month = %s",
            (body.temple_id, festival_name, body.month)
        )
        if cur.fetchone():
            raise HTTPException(409, f"'{festival_name}' already exists for this temple in that month")

        cur.execute("""
            INSERT INTO public.festivals (
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