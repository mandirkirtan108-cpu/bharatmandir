"""
Temple API Routes for BharatMandir.
All /api/temples/* endpoints live here.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
import sys, os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.connection import get_db_cursor
from models.temple import (
    TempleListItem, TempleDetail,
    TempleNearby, MantraResponse,
    FestivalResponse, SevaResponse,
    PaginatedTemples
)

router = APIRouter(
    prefix="/api/temples",
    tags=["Temples"]
)


# ─────────────────────────────────────────────
# GET /api/temples
# List temples with filtering + pagination
# ─────────────────────────────────────────────

@router.get("", response_model=PaginatedTemples)
def list_temples(
    state:      Optional[str] = Query(None, description="Filter by state"),
    city:       Optional[str] = Query(None, description="Filter by city"),
    deity:      Optional[str] = Query(None, description="Filter by deity"),
    sect:       Optional[str] = Query(None, description="Shaiva/Vaishnav/Shakta"),
    jyotirlinga: Optional[bool] = Query(None, description="Only Jyotirlingas"),
    shaktipeeth: Optional[bool] = Query(None, description="Only Shaktipeeths"),
    tag:        Optional[str] = Query(None, description="Filter by category tag"),
    page:       int = Query(1, ge=1, description="Page number"),
    per_page:   int = Query(20, ge=1, le=100, description="Results per page"),
):
    """
    List temples with optional filters.
    All filters are optional and combinable.
    Example: /api/temples?state=Madhya Pradesh&sect=Shaiva&page=1
    """
    offset = (page - 1) * per_page

    # Build WHERE clause dynamically
    conditions = ["status = 'published'"]
    params = []

    if state:
        conditions.append("state ILIKE %s")
        params.append(f"%{state}%")

    if city:
        conditions.append("city ILIKE %s")
        params.append(f"%{city}%")

    if deity:
        conditions.append("primary_deity ILIKE %s")
        params.append(f"%{deity}%")

    if sect:
        conditions.append("sect ILIKE %s")
        params.append(f"%{sect}%")

    if jyotirlinga is True:
        conditions.append("is_jyotirlinga = TRUE")

    if shaktipeeth is True:
        conditions.append("is_shaktipeeth = TRUE")

    if tag:
        conditions.append("%s = ANY(category_tags)")
        params.append(tag)

    where_clause = " AND ".join(conditions)

    with get_db_cursor() as cur:
        # Get total count
        cur.execute(
            f"SELECT COUNT(*) as total FROM temples WHERE {where_clause}",
            params
        )
        total = cur.fetchone()['total']

        # Get paginated results
        cur.execute(f"""
            SELECT
                id, uuid, name, name_hindi,
                slug,
                city, state, primary_deity,
                temple_type, is_jyotirlinga, is_shaktipeeth,
                latitude, longitude,
                hero_image_url, average_rating,
                category_tags, status
            FROM temples
            WHERE {where_clause}
            ORDER BY name ASC
            LIMIT %s OFFSET %s
        """, params + [per_page, offset])

        temples = cur.fetchall()

    return {
        "total":    total,
        "page":     page,
        "per_page": per_page,
        "temples":  [dict(t) for t in temples]
    }


# ─────────────────────────────────────────────
# GET /api/temples/search
# Full-text search (must be before /{slug})
# ─────────────────────────────────────────────

@router.get("/search", response_model=List[TempleListItem])
def search_temples(
    q:      str = Query(..., min_length=2, description="Search query"),
    limit:  int = Query(20, ge=1, le=50)
):
    """
    Search temples by name, city, deity, or significance.
    Example: /api/temples/search?q=shiva+ujjain
    """
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                id, uuid, name, name_hindi,slug,
                city, state, primary_deity,
                temple_type, is_jyotirlinga, is_shaktipeeth,
                latitude, longitude,
                hero_image_url, average_rating,
                category_tags, status,
                ts_rank(
                    to_tsvector('english',
                        COALESCE(name,'') || ' ' ||
                        COALESCE(city,'') || ' ' ||
                        COALESCE(primary_deity,'') || ' ' ||
                        COALESCE(significance,'')
                    ),
                    plainto_tsquery('english', %s)
                ) AS rank
            FROM temples
            WHERE
                status = 'published'
                AND to_tsvector('english',
                    COALESCE(name,'') || ' ' ||
                    COALESCE(city,'') || ' ' ||
                    COALESCE(primary_deity,'') || ' ' ||
                    COALESCE(significance,'')
                ) @@ plainto_tsquery('english', %s)
            ORDER BY rank DESC
            LIMIT %s
        """, (q, q, limit))

        results = cur.fetchall()

    if not results:
        return []

    return [dict(r) for r in results]


# ─────────────────────────────────────────────
# GET /api/temples/nearby
# Temples near a GPS coordinate
# ─────────────────────────────────────────────

@router.get("/nearby", response_model=List[TempleNearby])
def temples_nearby(
    lat:        float = Query(..., description="Latitude"),
    lng:        float = Query(..., description="Longitude"),
    radius_km:  float = Query(10.0, ge=0.5, le=100.0),
    limit:      int   = Query(20, ge=1, le=50)
):
    """
    Find temples within radius_km of given coordinates.
    Example: /api/temples/nearby?lat=23.1828&lng=75.7682&radius_km=10
    This powers the MAP VIEW in your React app.
    """
    radius_meters = radius_km * 1000

    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                id, uuid, name, name_hindi,slug,
                city, state, primary_deity,
                temple_type, is_jyotirlinga, is_shaktipeeth,
                latitude, longitude,
                hero_image_url, average_rating,
                category_tags, status,
                ROUND(
                    ST_Distance(
                        location,
                        ST_GeogFromText('POINT(' || %s || ' ' || %s || ')')
                    )::numeric / 1000,
                1) AS distance_km
            FROM temples
            WHERE
                status = 'published'
                AND location IS NOT NULL
                AND ST_DWithin(
                    location,
                    ST_GeogFromText('POINT(' || %s || ' ' || %s || ')'),
                    %s
                )
            ORDER BY distance_km ASC
            LIMIT %s
        """, (lng, lat, lng, lat, radius_meters, limit))

        results = cur.fetchall()

    return [dict(r) for r in results]


# ─────────────────────────────────────────────
# GET /api/temples/{slug}
# Full temple detail page
# ─────────────────────────────────────────────

@router.get("/{slug}", response_model=TempleDetail)
def get_temple(slug: str):
    """
    Get complete temple details by slug.
    Example: /api/temples/mahakaleshwar-jyotirlinga-ujjain
    """
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT *
            FROM temples
            WHERE slug = %s
              AND status = 'published'
        """, (slug,))

        temple = cur.fetchone()

    if not temple:
        raise HTTPException(
            status_code=404,
            detail=f"Temple '{slug}' not found"
        )

    temple_dict = dict(temple)

    # Convert time objects to strings for JSON
    for field in ['opening_time', 'closing_time']:
        if temple_dict.get(field):
            temple_dict[field] = str(temple_dict[field])

    return temple_dict


# ─────────────────────────────────────────────
# GET /api/temples/{id}/mantras
# ─────────────────────────────────────────────

@router.get("/{temple_id}/mantras", response_model=List[MantraResponse])
def get_temple_mantras(temple_id: int):
    """
    Get all verified mantras for a temple.
    Example: /api/temples/1/mantras
    """
    with get_db_cursor() as cur:
        # Verify temple exists first
        cur.execute(
            "SELECT id FROM temples WHERE id = %s AND status = 'published'",
            (temple_id,)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Temple not found")

        cur.execute("""
            SELECT id, title, sanskrit, transliteration,
                   meaning, mantra_type, deity
            FROM mantras
            WHERE temple_id = %s
              AND verified = TRUE
            ORDER BY sort_order ASC
        """, (temple_id,))

        return [dict(m) for m in cur.fetchall()]


# ─────────────────────────────────────────────
# GET /api/temples/{id}/festivals
# ─────────────────────────────────────────────

@router.get("/{temple_id}/festivals", response_model=List[FestivalResponse])
def get_temple_festivals(temple_id: int):
    """Get all festivals for a temple."""
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT id FROM temples WHERE id = %s AND status = 'published'",
            (temple_id,)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Temple not found")

        cur.execute("""
            SELECT name, description, significance,
                   month, hindu_month, duration_days, is_major
            FROM festivals
            WHERE temple_id = %s
            ORDER BY month ASC NULLS LAST
        """, (temple_id,))

        return [dict(f) for f in cur.fetchall()]


# ─────────────────────────────────────────────
# GET /api/temples/{id}/sevas
# ─────────────────────────────────────────────

@router.get("/{temple_id}/sevas", response_model=List[SevaResponse])
def get_temple_sevas(temple_id: int):
    """Get all sevas for a temple."""
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT id FROM temples WHERE id = %s AND status = 'published'",
            (temple_id,)
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Temple not found")

        cur.execute("""
            SELECT id, name, description, price,
                   is_free, timing, advance_booking, booking_url
            FROM sevas
            WHERE temple_id = %s
              AND verified = TRUE
            ORDER BY price ASC NULLS LAST
        """, (temple_id,))

        return [dict(s) for s in cur.fetchall()]