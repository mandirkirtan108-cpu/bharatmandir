"""
Reusable database query functions for BharatMandir.
All temple-related DB operations live here.
"""

from db.connection import get_db_cursor


# ─────────────────────────────────────────────
# READ Queries
# ─────────────────────────────────────────────

def get_all_temples(status='published', limit=50, offset=0):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT 
                id, uuid, name, name_hindi,
                slug,                          
                city, state, primary_deity,
                temple_type, is_jyotirlinga, is_shaktipeeth,
                latitude, longitude,
                hero_image_url, average_rating,
                category_tags, status
            FROM temples
            WHERE status = %s
            ORDER BY name ASC
            LIMIT %s OFFSET %s
        """, (status, limit, offset))
        
        return cur.fetchall()


def get_temple_by_slug(slug):
    """Fetch complete temple details by slug."""
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT * FROM temples
            WHERE slug = %s AND status = 'published'
        """, (slug,))
        
        return cur.fetchone()


def get_temples_near_location(lat, lng, radius_km=10, limit=20):
    """
    Find temples within radius_km of given coordinates.
    This is the core 'Temples Near Me' feature.
    
    Args:
        lat: User's latitude
        lng: User's longitude  
        radius_km: Search radius in kilometers
        limit: Max results to return
    """
    radius_meters = radius_km * 1000
    
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT 
                id, name, name_hindi,
                city, primary_deity,
                latitude, longitude,
                hero_image_url,
                category_tags,
                ROUND(
                    ST_Distance(
                        location,
                        ST_GeogFromText('POINT(' || %s || ' ' || %s || ')')
                    )::numeric / 1000,
                2) AS distance_km
            FROM temples
            WHERE 
                status = 'published'
                AND ST_DWithin(
                    location,
                    ST_GeogFromText('POINT(' || %s || ' ' || %s || ')'),
                    %s
                )
            ORDER BY distance_km ASC
            LIMIT %s
        """, (lng, lat, lng, lat, radius_meters, limit))
        
        return cur.fetchall()


def get_temple_mantras(temple_id):
    """Fetch all mantras for a temple."""
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT 
                id, title, sanskrit,
                transliteration, meaning,
                mantra_type, deity
            FROM mantras
            WHERE temple_id = %s
            ORDER BY sort_order ASC
        """, (temple_id,))
        
        return cur.fetchall()


def get_temple_festivals(temple_id):
    """Fetch all festivals for a temple."""
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT 
                name, description, significance,
                month, hindu_month, 
                duration_days, is_major
            FROM festivals
            WHERE temple_id = %s
            ORDER BY month ASC NULLS LAST
        """, (temple_id,))
        
        return cur.fetchall()


def search_temples(query, limit=20):
    """
    Full-text search across temple names, cities, deities.
    Uses PostgreSQL's built-in full-text search.
    """
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT 
                id, name, city, state,
                primary_deity, hero_image_url,
                ts_rank(
                    to_tsvector('english', 
                        COALESCE(name,'') || ' ' || 
                        COALESCE(city,'') || ' ' || 
                        COALESCE(primary_deity,'')),
                    plainto_tsquery('english', %s)
                ) AS rank
            FROM temples
            WHERE 
                status = 'published'
                AND to_tsvector('english',
                    COALESCE(name,'') || ' ' ||
                    COALESCE(city,'') || ' ' ||
                    COALESCE(primary_deity,'')
                ) @@ plainto_tsquery('english', %s)
            ORDER BY rank DESC
            LIMIT %s
        """, (query, query, limit))
        
        return cur.fetchall()


# ─────────────────────────────────────────────
# WRITE Queries
# ─────────────────────────────────────────────

def insert_temple(temple_data: dict):
    """
    Insert a new temple record.
    Uses parameterized queries — NEVER string format SQL (SQL injection risk).
    
    Args:
        temple_data: dict with temple fields
    Returns:
        id of newly created temple
    """
    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO temples (
                name, name_hindi, slug,
                latitude, longitude, location,
                city, state, district, pincode,
                primary_deity, sect, temple_type,
                history, significance,
                category_tags, status, source
            ) VALUES (
                %(name)s, %(name_hindi)s, %(slug)s,
                %(latitude)s, %(longitude)s,
                ST_GeogFromText('POINT(' || %(longitude)s || ' ' || %(latitude)s || ')'),
                %(city)s, %(state)s, %(district)s, %(pincode)s,
                %(primary_deity)s, %(sect)s, %(temple_type)s,
                %(history)s, %(significance)s,
                %(category_tags)s, %(status)s, %(source)s
            )
            RETURNING id, uuid, slug
        """, temple_data)
        
        return cur.fetchone()