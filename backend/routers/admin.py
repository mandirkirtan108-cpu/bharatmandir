"""
Admin API Routes for BharatMandir.
POST   /api/admin/temples              → Create new temple
PUT    /api/admin/temples/{id}         → Update temple
POST   /api/admin/temples/{id}/media   → Upload image/video
GET    /api/admin/temples/{id}/media   → List media for temple
DELETE /api/admin/media/{id}           → Delete media
GET    /api/admin/temples              → List all temples (admin view)

All routes require the header:  X-Admin-Key: <your ADMIN_SECRET_KEY from .env>
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, Depends, Header
from fastapi.responses import JSONResponse
from typing import Optional
import sys, os, uuid, re

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.connection import get_db_cursor

router = APIRouter(prefix="/api/admin", tags=["Admin"])

# ── Upload directory ──────────────────────────────────────────────────────────
UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads"
)
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_IMAGE = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO = {"video/mp4", "video/webm", "video/ogg"}
MAX_IMG = 10 * 1024 * 1024    # 10 MB
MAX_VID = 200 * 1024 * 1024   # 200 MB

# ── Auth ──────────────────────────────────────────────────────────────────────

_ADMIN_SECRET = os.getenv("ADMIN_SECRET_KEY", "change-me-now")


def require_admin(x_admin_key: str = Header(..., description="Admin secret key")):
    """Dependency — rejects requests that don't carry the correct admin key."""
    if x_admin_key != _ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden: invalid admin key")


# ── Helpers ───────────────────────────────────────────────────────────────────

def slugify(name: str) -> str:
    s = name.lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s)
    return re.sub(r"^-+|-+$", "", s)


def ensure_media_table():
    """Create temple_media table if it doesn't exist yet."""
    with get_db_cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS temple_media (
                id          SERIAL PRIMARY KEY,
                temple_id   INTEGER NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
                media_type  VARCHAR(10) NOT NULL CHECK (media_type IN ('image','video')),
                file_url    TEXT NOT NULL,
                file_name   TEXT,
                caption     TEXT,
                is_hero     BOOLEAN DEFAULT FALSE,
                sort_order  INTEGER DEFAULT 0,
                uploaded_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_tmedia_tid ON temple_media(temple_id);
        """)


# ── POST /api/admin/temples — Create new temple ───────────────────────────────

@router.post("/temples", status_code=201, dependencies=[Depends(require_admin)])
def create_temple(
    # Required
    name:                 str            = Form(...),
    city:                 str            = Form(...),
    state:                str            = Form(...),
    # Names
    name_hindi:           Optional[str]  = Form(None),
    name_local:           Optional[str]  = Form(None),
    # Location
    address:              Optional[str]  = Form(None),
    district:             Optional[str]  = Form(None),
    pincode:              Optional[str]  = Form(None),
    latitude:             Optional[float]= Form(None),
    longitude:            Optional[float]= Form(None),
    # Deity & religion
    primary_deity:        Optional[str]  = Form(None),
    secondary_deities:    Optional[str]  = Form(None),   # comma-separated
    sect:                 Optional[str]  = Form(None),
    temple_type:          Optional[str]  = Form(None),
    # Flags
    is_jyotirlinga:       bool           = Form(False),
    is_shaktipeeth:       bool           = Form(False),
    is_heritage_site:     bool           = Form(False),
    is_asi_protected:     bool           = Form(False),
    # Content
    history:              Optional[str]  = Form(None),
    significance:         Optional[str]  = Form(None),
    architecture_style:   Optional[str]  = Form(None),
    estimated_year_built: Optional[str]  = Form(None),
    # Practical info
    opening_time:         Optional[str]  = Form(None),
    closing_time:         Optional[str]  = Form(None),
    entry_fee:            Optional[float]= Form(None),
    dress_code:           Optional[str]  = Form(None),
    best_time_to_visit:   Optional[str]  = Form(None),
    nearest_railway:      Optional[str]  = Form(None),
    nearest_airport:      Optional[str]  = Form(None),
    website_url:          Optional[str]  = Form(None),
    phone:                Optional[str]  = Form(None),
    category_tags:        Optional[str]  = Form(None),   # comma-separated
    # Optional hero image on create
    hero_image:           Optional[UploadFile] = File(None),
):
    base_slug = slugify(name)

    with get_db_cursor() as cur:
        # Make slug unique
        cur.execute("SELECT id FROM temples WHERE slug = %s", (base_slug,))
        if cur.fetchone():
            base_slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

        # Save hero image if provided
        hero_url = None
        if hero_image and hero_image.filename:
            if hero_image.content_type not in ALLOWED_IMAGE:
                raise HTTPException(400, "Invalid image type. Use JPEG/PNG/WebP")
            data = hero_image.file.read()
            if len(data) > MAX_IMG:
                raise HTTPException(400, "Image too large (max 10 MB)")
            ext   = hero_image.filename.rsplit(".", 1)[-1].lower()
            fname = f"{base_slug}-hero-{uuid.uuid4().hex[:8]}.{ext}"
            with open(os.path.join(UPLOAD_DIR, fname), "wb") as f:
                f.write(data)
            hero_url = f"/uploads/{fname}"

        sec_d = [d.strip() for d in secondary_deities.split(",")] if secondary_deities else []
        tags  = [t.strip() for t in category_tags.split(",")]      if category_tags      else []

        has_coords = latitude is not None and longitude is not None

        if has_coords:
            cur.execute("""
                INSERT INTO temples (
                    uuid, name, name_hindi, name_local, slug,
                    city, state, address, district, pincode,
                    latitude, longitude, location,
                    primary_deity, secondary_deities, sect, temple_type,
                    is_jyotirlinga, is_shaktipeeth, is_heritage_site, is_asi_protected,
                    history, significance, architecture_style, estimated_year_built,
                    opening_time, closing_time, entry_fee, dress_code,
                    best_time_to_visit, nearest_railway, nearest_airport,
                    website_url, phone, hero_image_url, category_tags,
                    status, verified, created_at
                ) VALUES (
                    %s,%s,%s,%s,%s,
                    %s,%s,%s,%s,%s,
                    %s,%s, ST_GeogFromText('POINT(' || %s || ' ' || %s || ')'),
                    %s,%s,%s,%s,
                    %s,%s,%s,%s,
                    %s,%s,%s,%s,
                    %s,%s,%s,%s,
                    %s,%s,%s,
                    %s,%s,%s,%s,
                    'published', FALSE, NOW()
                ) RETURNING id, slug
            """, [
                str(uuid.uuid4()), name, name_hindi, name_local, base_slug,
                city, state, address, district, pincode,
                latitude, longitude, longitude, latitude,
                primary_deity, sec_d, sect, temple_type,
                is_jyotirlinga, is_shaktipeeth, is_heritage_site, is_asi_protected,
                history, significance, architecture_style, estimated_year_built,
                opening_time, closing_time, entry_fee, dress_code,
                best_time_to_visit, nearest_railway, nearest_airport,
                website_url, phone, hero_url, tags,
            ])
        else:
            cur.execute("""
                INSERT INTO temples (
                    uuid, name, name_hindi, name_local, slug,
                    city, state, address, district, pincode,
                    primary_deity, secondary_deities, sect, temple_type,
                    is_jyotirlinga, is_shaktipeeth, is_heritage_site, is_asi_protected,
                    history, significance, architecture_style, estimated_year_built,
                    opening_time, closing_time, entry_fee, dress_code,
                    best_time_to_visit, nearest_railway, nearest_airport,
                    website_url, phone, hero_image_url, category_tags,
                    status, verified, created_at
                ) VALUES (
                    %s,%s,%s,%s,%s,
                    %s,%s,%s,%s,%s,
                    %s,%s,%s,%s,
                    %s,%s,%s,%s,
                    %s,%s,%s,%s,
                    %s,%s,%s,%s,
                    %s,%s,%s,
                    %s,%s,%s,%s,
                    'published', FALSE, NOW()
                ) RETURNING id, slug
            """, [
                str(uuid.uuid4()), name, name_hindi, name_local, base_slug,
                city, state, address, district, pincode,
                primary_deity, sec_d, sect, temple_type,
                is_jyotirlinga, is_shaktipeeth, is_heritage_site, is_asi_protected,
                history, significance, architecture_style, estimated_year_built,
                opening_time, closing_time, entry_fee, dress_code,
                best_time_to_visit, nearest_railway, nearest_airport,
                website_url, phone, hero_url, tags,
            ])

        result = cur.fetchone()

    return {
        "success":   True,
        "message":   f"Temple '{name}' created successfully!",
        "temple_id": result["id"],
        "slug":      result["slug"],
    }


# ── POST /api/admin/temples/{id}/media — Upload image or video ────────────────

@router.post("/temples/{temple_id}/media", status_code=201, dependencies=[Depends(require_admin)])
def upload_media(
    temple_id:  int,
    file:       UploadFile = File(...),
    caption:    Optional[str] = Form(None),
    is_hero:    bool          = Form(False),
    sort_order: int           = Form(0),
):
    ensure_media_table()

    with get_db_cursor() as cur:
        cur.execute("SELECT id, slug FROM temples WHERE id = %s", (temple_id,))
        temple = cur.fetchone()
        if not temple:
            raise HTTPException(404, "Temple not found")

    ct       = file.content_type
    is_image = ct in ALLOWED_IMAGE
    is_video = ct in ALLOWED_VIDEO

    if not is_image and not is_video:
        raise HTTPException(
            400, "Invalid file type. Allowed: JPEG/PNG/WebP/GIF for images, MP4/WebM/OGG for videos"
        )

    data = file.file.read()
    limit = MAX_VID if is_video else MAX_IMG
    if len(data) > limit:
        raise HTTPException(400, f"File too large. Max {'200MB' if is_video else '10MB'}")

    ext      = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ("mp4" if is_video else "jpg")
    fname    = f"temple-{temple_id}-{uuid.uuid4().hex[:10]}.{ext}"
    fpath    = os.path.join(UPLOAD_DIR, fname)

    with open(fpath, "wb") as f:
        f.write(data)

    mtype    = "video" if is_video else "image"
    file_url = f"/uploads/{fname}"

    with get_db_cursor() as cur:
        if is_hero and is_image:
            cur.execute("UPDATE temple_media SET is_hero = FALSE WHERE temple_id = %s", (temple_id,))
            cur.execute("UPDATE temples SET hero_image_url = %s WHERE id = %s", (file_url, temple_id))

        cur.execute("""
            INSERT INTO temple_media
                (temple_id, media_type, file_url, file_name, caption, is_hero, sort_order)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (temple_id, mtype, file_url, file.filename, caption, is_hero, sort_order))

        media_id = cur.fetchone()["id"]

    return {
        "success":    True,
        "media_id":   media_id,
        "file_url":   file_url,
        "media_type": mtype,
    }


# ── GET /api/admin/temples/{id}/media — List media ────────────────────────────

@router.get("/temples/{temple_id}/media", dependencies=[Depends(require_admin)])
def get_temple_media(temple_id: int):
    ensure_media_table()
    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM temples WHERE id = %s", (temple_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Temple not found")

        cur.execute("""
            SELECT id, media_type, file_url, file_name, caption, is_hero, sort_order, uploaded_at
            FROM temple_media
            WHERE temple_id = %s
            ORDER BY is_hero DESC, sort_order ASC, uploaded_at ASC
        """, (temple_id,))
        media = cur.fetchall()

    return {
        "temple_id": temple_id,
        "media":     [dict(m) for m in media],
        "total":     len(media),
    }


# ── DELETE /api/admin/media/{id} — Delete a media item ───────────────────────

@router.delete("/media/{media_id}", dependencies=[Depends(require_admin)])
def delete_media(media_id: int):
    ensure_media_table()
    with get_db_cursor() as cur:
        cur.execute("SELECT file_url, temple_id FROM temple_media WHERE id = %s", (media_id,))
        m = cur.fetchone()
        if not m:
            raise HTTPException(404, "Media not found")

        # Delete file from disk
        relative = m["file_url"].lstrip("/uploads/")
        fpath = os.path.join(UPLOAD_DIR, relative)
        if os.path.exists(fpath):
            os.remove(fpath)

        cur.execute("DELETE FROM temple_media WHERE id = %s", (media_id,))

    return {"success": True, "message": "Media deleted"}


# ── GET /api/admin/temples — List all temples (admin view) ────────────────────

@router.get("/temples", dependencies=[Depends(require_admin)])
def list_temples_admin(
    page:     int = Query(1,  ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    offset = (page - 1) * per_page
    with get_db_cursor() as cur:
        cur.execute("SELECT COUNT(*) as total FROM temples")
        total = cur.fetchone()["total"]

        cur.execute("""
            SELECT id, name, name_hindi, city, state, primary_deity,
                   is_jyotirlinga, is_shaktipeeth, status, verified,
                   hero_image_url, created_at
            FROM temples
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """, (per_page, offset))
        temples = cur.fetchall()

    return {"total": total, "page": page, "temples": [dict(t) for t in temples]}