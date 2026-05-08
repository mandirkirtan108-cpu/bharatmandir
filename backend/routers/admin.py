"""
Admin API Routes for BharatMandir.

POST   /api/admin/temples                        → Create temple (all v2 fields)
GET    /api/admin/temples                        → List all temples (admin view)
PATCH  /api/admin/temples/{id}/status            → Status workflow transition
PATCH  /api/admin/temples/{id}/verify            → Mark temple verified
POST   /api/admin/temples/{id}/media             → Upload image or video
GET    /api/admin/temples/{id}/media             → List media for temple
DELETE /api/admin/media/{id}                     → Delete a media item (disk + DB)
POST   /api/admin/temples/{id}/upload-video      → Upload video into aarti/intro/360 slot
POST   /api/admin/temples/{id}/priests           → Add priest (Step 4)
POST   /api/admin/temples/{id}/committee         → Set committee (Step 4)
PUT    /api/admin/temples/{id}/puja-schedule     → Replace puja schedule (Step 5)

All routes require JWT Bearer token (Authorization: Bearer <token>)
"""

import os
import uuid
import re
import shutil
import random
from typing import Optional, List

from fastapi import (
    APIRouter, HTTPException, Depends,
    UploadFile, File, Form, Query, Body
)
from pydantic import BaseModel

from db.connection import get_db_cursor
from db.queries import (
    upsert_priest, upsert_committee,
    replace_puja_schedule,
)
from routers.admin_auth import get_current_admin

router = APIRouter(prefix="/api/admin", tags=["Admin"])

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads"
)
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_IMAGE = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO = {"video/mp4", "video/webm", "video/ogg"}
MAX_IMG = 10  * 1024 * 1024   # 10 MB
MAX_VID = 200 * 1024 * 1024   # 200 MB


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def slugify(name: str, city: str = "") -> str:
    text = f"{name} {city}".lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return re.sub(r"^-+|-+$", "", text)[:100]


def _v(s) -> Optional[str]:
    """Return stripped string or None."""
    if s is None:
        return None
    v = str(s).strip()
    return v if v else None


def _t(s) -> Optional[str]:
    """Return time string or None (accepts HH:MM or HH:MM:SS)."""
    if not s:
        return None
    v = str(s).strip()
    return v if re.match(r"^\d{1,2}:\d{2}", v) else None


def ensure_media_table():
    """
    Create temple_media lazily on first upload.
    Matches the original design decision: table is not in the base migration.
    Uses file_url column to match your existing schema.
    """
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
                uploaded_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_tmedia_tid ON temple_media(temple_id);
        """)


def save_upload(file_bytes: bytes, filename: str, prefix: str = "") -> str:
    """Save bytes to UPLOAD_DIR and return the public /uploads/... URL."""
    ext   = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    fname = f"{prefix}{uuid.uuid4().hex[:10]}.{ext}"
    with open(os.path.join(UPLOAD_DIR, fname), "wb") as f:
        f.write(file_bytes)
    return f"/uploads/{fname}"


# ─────────────────────────────────────────────
# Pydantic bodies
# ─────────────────────────────────────────────

class TempleStatusUpdate(BaseModel):
    status: str   # draft | review | published | flagged | archived

VALID_STATUSES = {"draft", "review", "published", "flagged", "archived"}


class PriestCreate(BaseModel):
    is_head_priest:         bool = True
    full_name:              str
    title_designation:      Optional[str] = None
    phone:                  str
    email:                  Optional[str] = None
    qualification:          Optional[str] = None
    sampradaya:             Optional[str] = None
    languages_known:        Optional[str] = None
    years_of_service:       Optional[int] = None
    appointment_type:       Optional[str] = None
    total_priests_on_staff: int = 1
    succession_plan:        Optional[str] = None


class CommitteeCreate(BaseModel):
    chairman_name:          Optional[str] = None
    chairman_contact:       Optional[str] = None
    committee_member_count: Optional[int] = None
    election_cycle:         Optional[str] = None


class PujaScheduleRow(BaseModel):
    puja_name:  str
    puja_time:  str
    puja_type:  str = "Aarti"
    sort_order: int = 0


class TempleFieldUpdate(BaseModel):
    name:                Optional[str] = None
    name_hindi:          Optional[str] = None
    primary_deity:       Optional[str] = None
    sect:                Optional[str] = None
    temple_type:         Optional[str] = None
    architecture_style:  Optional[str] = None
    estimated_year_built: Optional[str] = None
    city:                Optional[str] = None
    state:               Optional[str] = None
    address:             Optional[str] = None
    opening_time:        Optional[str] = None
    closing_time:        Optional[str] = None
    entry_fee:           Optional[float] = None
    dress_code:          Optional[str] = None
    best_time_to_visit:  Optional[str] = None
    nearest_railway:     Optional[str] = None
    nearest_airport:     Optional[str] = None
    history:             Optional[str] = None
    significance:        Optional[str] = None
    website_url:         Optional[str] = None


# ─────────────────────────────────────────────
# POST /api/admin/temples — Create temple
# ─────────────────────────────────────────────

@router.post("/temples", status_code=201)
async def create_temple(
    admin: dict = Depends(get_current_admin),
    # ── Step 1: Identity ──────────────────────
    name:                  str            = Form(...),
    name_hindi:            Optional[str]  = Form(None),
    name_local:            Optional[str]  = Form(None),
    temple_type:           Optional[str]  = Form(None),
    architecture_style:    Optional[str]  = Form(None),
    managing_authority:    Optional[str]  = Form(None),
    trust_name:            Optional[str]  = Form(None),
    trust_registration_no: Optional[str]  = Form(None),

    # ── Step 2: Location ──────────────────────
    address:               Optional[str]  = Form(None),
    city:                  str            = Form(...),
    district:              Optional[str]  = Form(None),
    state:                 str            = Form(...),
    pincode:               Optional[str]  = Form(None),
    latitude:              Optional[float]= Form(None),
    longitude:             Optional[float]= Form(None),
    setting_environment:   Optional[str]  = Form(None),
    google_maps_link:      Optional[str]  = Form(None),
    nearest_bus_stand:     Optional[str]  = Form(None),
    local_landmark:        Optional[str]  = Form(None),
    nearest_railway:       Optional[str]  = Form(None),
    nearest_airport:       Optional[str]  = Form(None),

    # ── Deity ─────────────────────────────────
    primary_deity:         Optional[str]  = Form(None),
    secondary_deities:     Optional[str]  = Form(None),
    sect:                  Optional[str]  = Form(None),

    # ── Step 3: History & significance ────────
    history:               Optional[str]  = Form(None),
    history_hindi:         Optional[str]  = Form(None),
    sthala_purana:         Optional[str]  = Form(None),
    significance:          Optional[str]  = Form(None),
    estimated_year_built:  Optional[str]  = Form(None),
    founded_by:            Optional[str]  = Form(None),
    last_renovation_year:  Optional[str]  = Form(None),
    building_condition:    Optional[str]  = Form(None),
    puranic_stories:       Optional[str]  = Form(None),

    # Heritage flags
    is_jyotirlinga:        bool = Form(False),
    is_shaktipeeth:        bool = Form(False),
    is_divya_desam:        bool = Form(False),
    is_ashtavinayak:       bool = Form(False),
    is_char_dham:          bool = Form(False),
    is_heritage_site:      bool = Form(False),
    is_asi_protected:      bool = Form(False),
    is_pancha_bhuta:       bool = Form(False),
    is_51_shakti_peeths:   bool = Form(False),
    is_unesco_heritage:    bool = Form(False),
    is_state_heritage:     bool = Form(False),

    # ── Step 5: Schedule ─────────────────────
    opening_time:               Optional[str] = Form(None),
    closing_time:               Optional[str] = Form(None),
    afternoon_closure_start:    Optional[str] = Form(None),
    afternoon_closure_end:      Optional[str] = Form(None),
    weekly_special_day:         Optional[str] = Form("None / All days equal"),
    online_puja_available:      Optional[str] = Form("no"),
    live_darshan_available:     Optional[str] = Form("no"),
    live_stream_url:            Optional[str] = Form(None),
    prasad_type:                Optional[str] = Form(None),
    puja_rudrabhishek:          bool = Form(False),
    puja_satyanarayan:          bool = Form(False),
    puja_havan_homa:            bool = Form(False),
    puja_laghu_rudra:           bool = Form(False),
    puja_mahamrityunjaya:       bool = Form(False),
    puja_griha_pravesh:         bool = Form(False),
    puja_naamkaran:             bool = Form(False),
    puja_vivah:                 bool = Form(False),
    puja_annaprashan:           bool = Form(False),
    puja_mundan:                bool = Form(False),
    puja_pitru_tarpan:          bool = Form(False),
    puja_sahasranamarchana:     bool = Form(False),

    # ── Step 6: Media ─────────────────────────
    hero_image:            Optional[UploadFile] = File(None),
    hero_image_url:        Optional[str]  = Form(None),   # URL string fallback
    video_aarti_url:       Optional[str]  = Form(None),
    video_intro_url:       Optional[str]  = Form(None),
    video_360_url:         Optional[str]  = Form(None),

    # ── Step 7: Finance ───────────────────────
    bank_account_name:     Optional[str]  = Form(None),
    bank_name_branch:      Optional[str]  = Form(None),
    bank_account_number:   Optional[str]  = Form(None),
    bank_ifsc:             Optional[str]  = Form(None),
    upi_id:                Optional[str]  = Form(None),
    certificate_80g_no:    Optional[str]  = Form(None),
    accept_online_donations: bool = Form(False),
    donation_temple_renovation: bool = Form(False),
    donation_annadanam:          bool = Form(False),
    donation_priest_salary:      bool = Form(False),
    donation_vedic_education:    bool = Form(False),
    donation_festival:           bool = Form(False),
    donation_medical_camps:      bool = Form(False),
    donation_general:            bool = Form(False),
    facility_electricity:        bool = Form(False),
    facility_water_supply:       bool = Form(False),
    facility_clean_toilets:      bool = Form(False),
    facility_wheelchair:         bool = Form(False),
    facility_dharamshala:        bool = Form(False),
    facility_prasad_dining:      bool = Form(False),
    facility_parking:            bool = Form(False),
    facility_security:           bool = Form(False),
    facility_cctv:               bool = Form(False),
    facility_pa_system:          bool = Form(False),
    facility_internet_wifi:      bool = Form(False),
    facility_library_pathshala:  bool = Form(False),
    facility_gaushaala:          bool = Form(False),
    facility_medical_support:    bool = Form(False),
    prog_free_food:              bool = Form(False),
    prog_medical_camps:          bool = Form(False),
    prog_scholarship_edu:        bool = Form(False),
    prog_womens_selfhelp:        bool = Form(False),
    prog_bhajan_kirtan:          bool = Form(False),
    prog_disaster_relief:        bool = Form(False),
    phone:                 Optional[str]  = Form(None),
    whatsapp_number:       Optional[str]  = Form(None),
    official_email:        Optional[str]  = Form(None),
    website_url:           Optional[str]  = Form(None),
    facebook_page:         Optional[str]  = Form(None),
    youtube_channel:       Optional[str]  = Form(None),
    instagram_handle:      Optional[str]  = Form(None),
    best_time_to_call:     Optional[str]  = Form(None),
    entry_fee:             Optional[float]= Form(None),
    dress_code:            Optional[str]  = Form(None),
    best_time_to_visit:    Optional[str]  = Form(None),
    category_tags:         Optional[str]  = Form(None),
    status:                str            = Form("draft"),
    source:                str            = Form("admin_form"),
):
    base_slug = slugify(name, city)
    state_code = state.strip()[:2].upper()
    mkt_id = f"MKT-{state_code}-{random.randint(1000, 9999)}"

    hero_url = None
    if hero_image and hero_image.filename:
        if hero_image.content_type not in ALLOWED_IMAGE:
            raise HTTPException(400, "Hero image must be JPEG, PNG, WebP, or GIF")
        data = await hero_image.read()
        if len(data) > MAX_IMG:
            raise HTTPException(400, "Hero image too large — max 10 MB")
        hero_url = save_upload(data, hero_image.filename, prefix=f"{base_slug}-hero-")
    elif hero_image_url:
        hero_url = hero_image_url  # URL string directly use karo

    sec_d = [d.strip() for d in secondary_deities.split(",")] if secondary_deities else []
    tags  = [t.strip() for t in category_tags.split(",")]      if category_tags      else []

    has_coords = latitude is not None and longitude is not None

    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM temples WHERE slug = %s", (base_slug,))
        if cur.fetchone():
            base_slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

        location_expr = (
            "ST_GeogFromText('POINT(' || %s || ' ' || %s || ')')"
            if has_coords else "NULL"
        )
        coord_params = [longitude, latitude] if has_coords else []

        cur.execute(f"""
            INSERT INTO temples (
                uuid, name, name_hindi, name_local, slug, mkt_id,
                temple_type, architecture_style,
                managing_authority, trust_name, trust_registration_no,
                address, city, district, state, pincode,
                latitude, longitude, location,
                setting_environment, google_maps_link,
                nearest_bus_stand, local_landmark,
                nearest_railway, nearest_airport,
                primary_deity, secondary_deities, sect,
                history, history_hindi, sthala_purana, significance,
                estimated_year_built, founded_by, last_renovation_year,
                building_condition, puranic_stories,
                is_jyotirlinga, is_shaktipeeth, is_divya_desam,
                is_ashtavinayak, is_char_dham, is_heritage_site,
                is_asi_protected, is_pancha_bhuta, is_51_shakti_peeths,
                is_unesco_heritage, is_state_heritage,
                opening_time, closing_time,
                afternoon_closure_start, afternoon_closure_end,
                weekly_special_day, online_puja_available,
                live_darshan_available, live_stream_url, prasad_type,
                puja_rudrabhishek, puja_satyanarayan, puja_havan_homa,
                puja_laghu_rudra, puja_mahamrityunjaya, puja_griha_pravesh,
                puja_naamkaran, puja_vivah, puja_annaprashan, puja_mundan,
                puja_pitru_tarpan, puja_sahasranamarchana,
                hero_image_url, video_aarti_url, video_intro_url, video_360_url,
                bank_account_name, bank_name_branch, bank_account_number,
                bank_ifsc, upi_id, certificate_80g_no,
                accept_online_donations,
                donation_temple_renovation, donation_annadanam,
                donation_priest_salary, donation_vedic_education,
                donation_festival, donation_medical_camps, donation_general,
                facility_electricity, facility_water_supply,
                facility_clean_toilets, facility_wheelchair,
                facility_dharamshala, facility_prasad_dining,
                facility_parking, facility_security, facility_cctv,
                facility_pa_system, facility_internet_wifi,
                facility_library_pathshala, facility_gaushaala,
                facility_medical_support,
                prog_free_food, prog_medical_camps, prog_scholarship_edu,
                prog_womens_selfhelp, prog_bhajan_kirtan, prog_disaster_relief,
                phone, whatsapp_number, official_email, website_url,
                facebook_page, youtube_channel, instagram_handle, best_time_to_call,
                entry_fee, dress_code, best_time_to_visit,
                category_tags, status, source,
                verified, submitted_at
            ) VALUES (
                %s,%s,%s,%s,%s,%s,
                %s,%s,%s,%s,%s,
                %s,%s,%s,%s,%s,
                %s,%s,{location_expr},
                %s,%s,%s,%s,%s,%s,
                %s,%s,%s,
                %s,%s,%s,%s,%s,%s,%s,%s,%s,
                %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                %s,%s,%s,%s,%s,%s,%s,%s,%s,
                %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                %s,%s,%s,%s,
                %s,%s,%s,%s,%s,%s,%s,
                %s,%s,%s,%s,%s,%s,%s,
                %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                %s,%s,%s,%s,%s,%s,
                %s,%s,%s,%s,%s,%s,%s,%s,
                %s,%s,%s,
                %s,%s,%s,
                FALSE, NOW()
            )
            RETURNING id, slug, mkt_id
        """, [
            str(uuid.uuid4()), name, _v(name_hindi), _v(name_local), base_slug, mkt_id,
            _v(temple_type), _v(architecture_style),
            _v(managing_authority), _v(trust_name), _v(trust_registration_no),
            _v(address), city, _v(district), state, _v(pincode),
            latitude, longitude, *coord_params,
            _v(setting_environment), _v(google_maps_link),
            _v(nearest_bus_stand), _v(local_landmark),
            _v(nearest_railway), _v(nearest_airport),
            _v(primary_deity), sec_d, _v(sect),
            _v(history), _v(history_hindi), _v(sthala_purana), _v(significance),
            _v(estimated_year_built), _v(founded_by), _v(last_renovation_year),
            _v(building_condition), _v(puranic_stories),
            is_jyotirlinga, is_shaktipeeth, is_divya_desam,
            is_ashtavinayak, is_char_dham, is_heritage_site,
            is_asi_protected, is_pancha_bhuta, is_51_shakti_peeths,
            is_unesco_heritage, is_state_heritage,
            _t(opening_time), _t(closing_time),
            _t(afternoon_closure_start), _t(afternoon_closure_end),
            _v(weekly_special_day), _v(online_puja_available),
            _v(live_darshan_available), _v(live_stream_url), _v(prasad_type),
            puja_rudrabhishek, puja_satyanarayan, puja_havan_homa,
            puja_laghu_rudra, puja_mahamrityunjaya, puja_griha_pravesh,
            puja_naamkaran, puja_vivah, puja_annaprashan, puja_mundan,
            puja_pitru_tarpan, puja_sahasranamarchana,
            hero_url, _v(video_aarti_url), _v(video_intro_url), _v(video_360_url),
            _v(bank_account_name), _v(bank_name_branch), _v(bank_account_number),
            _v(bank_ifsc), _v(upi_id), _v(certificate_80g_no),
            accept_online_donations,
            donation_temple_renovation, donation_annadanam,
            donation_priest_salary, donation_vedic_education,
            donation_festival, donation_medical_camps, donation_general,
            facility_electricity, facility_water_supply,
            facility_clean_toilets, facility_wheelchair,
            facility_dharamshala, facility_prasad_dining,
            facility_parking, facility_security, facility_cctv,
            facility_pa_system, facility_internet_wifi,
            facility_library_pathshala, facility_gaushaala,
            facility_medical_support,
            prog_free_food, prog_medical_camps, prog_scholarship_edu,
            prog_womens_selfhelp, prog_bhajan_kirtan, prog_disaster_relief,
            _v(phone), _v(whatsapp_number), _v(official_email), _v(website_url),
            _v(facebook_page), _v(youtube_channel), _v(instagram_handle), _v(best_time_to_call),
            entry_fee, _v(dress_code), _v(best_time_to_visit),
            tags, status, source,
        ])
        row = cur.fetchone()

    return {
        "success":   True,
        "message":   f"Temple '{name}' created",
        "temple_id": row["id"],
        "slug":      row["slug"],
        "mkt_id":    row["mkt_id"],
    }


# ─────────────────────────────────────────────
# GET /api/admin/temples  — list all (admin view)
# ─────────────────────────────────────────────

@router.get("/temples")
def list_temples_admin(
    admin: dict = Depends(get_current_admin),
    status:   Optional[str] = Query(None),
    page:     int = Query(1,  ge=1),
    per_page: int = Query(20, ge=1, le=100),
):
    """List all temples for the admin panel (any status)."""
    offset = (page - 1) * per_page
    conditions, params = [], []

    if status and status != "all":
        conditions.append("status = %s")
        params.append(status)

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    with get_db_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) AS total FROM temples {where}", params)
        total = cur.fetchone()["total"]

        cur.execute(f"""
            SELECT id, name, name_hindi, slug, mkt_id,
                   city, state, primary_deity,
                   status, verified,
                   hero_image_url, submitted_at, created_at
            FROM temples
            {where}
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s
        """, params + [per_page, offset])
        temples = cur.fetchall()

    return {
        "total":    total,
        "page":     page,
        "per_page": per_page,
        "temples":  [dict(t) for t in temples],
    }


# ─────────────────────────────────────────────
# GET /api/admin/temples/{id}  — single temple (any status)
# ─────────────────────────────────────────────

@router.get("/temples/{temple_id}")
def get_temple_admin(
    temple_id: int,
    admin: dict = Depends(get_current_admin),
):
    """Get a single temple by ID — works for any status (draft, review, published, etc.)."""
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, uuid, name, name_hindi, name_local, slug, mkt_id,
                   managing_authority, trust_name, trust_registration_no,
                   latitude, longitude, address, city, district, state, pincode,
                   setting_environment, google_maps_link,
                   nearest_bus_stand, local_landmark,
                   nearest_railway, nearest_airport,
                   primary_deity, secondary_deities, sect, temple_type,
                   is_jyotirlinga, is_shaktipeeth, is_divya_desam,
                   is_ashtavinayak, is_char_dham, is_heritage_site,
                   is_asi_protected, is_pancha_bhuta, is_51_shakti_peeths,
                   is_unesco_heritage, is_state_heritage,
                   history, history_hindi, sthala_purana, significance,
                   architecture_style, estimated_year_built, founded_by,
                   last_renovation_year, building_condition, puranic_stories,
                   opening_time, closing_time,
                   afternoon_closure_start, afternoon_closure_end,
                   weekly_special_day,
                   puja_rudrabhishek, puja_satyanarayan, puja_havan_homa,
                   puja_laghu_rudra, puja_mahamrityunjaya, puja_griha_pravesh,
                   puja_naamkaran, puja_vivah, puja_annaprashan, puja_mundan,
                   puja_pitru_tarpan, puja_sahasranamarchana,
                   online_puja_available, live_darshan_available,
                   live_stream_url, prasad_type,
                   hero_image_url, video_aarti_url, video_intro_url, video_360_url,
                   bank_account_name, bank_name_branch, bank_ifsc,
                   upi_id, certificate_80g_no,
                   accept_online_donations,
                   donation_temple_renovation, donation_annadanam,
                   donation_priest_salary, donation_vedic_education,
                   donation_festival, donation_medical_camps, donation_general,
                   facility_electricity, facility_water_supply,
                   facility_clean_toilets, facility_wheelchair,
                   facility_dharamshala, facility_prasad_dining,
                   facility_parking, facility_security, facility_cctv,
                   facility_pa_system, facility_internet_wifi,
                   facility_library_pathshala, facility_gaushaala,
                   facility_medical_support,
                   prog_free_food, prog_medical_camps, prog_scholarship_edu,
                   prog_womens_selfhelp, prog_bhajan_kirtan, prog_disaster_relief,
                   phone, whatsapp_number, official_email, website_url,
                   facebook_page, youtube_channel, instagram_handle, best_time_to_call,
                   entry_fee, dress_code, best_time_to_visit,
                   average_rating, total_ratings,
                   status, verified, category_tags,
                   submitted_at, published_at, created_at
            FROM temples
            WHERE id = %s
        """, (temple_id,))
        temple = cur.fetchone()
    if not temple:
        raise HTTPException(status_code=404, detail="Temple not found")
    d = dict(temple)
    for f in ['opening_time', 'closing_time', 'afternoon_closure_start', 'afternoon_closure_end']:
        if d.get(f):
            d[f] = str(d[f])
    return d


# ─────────────────────────────────────────────
# PATCH /api/admin/temples/{id}  — general field update
# ─────────────────────────────────────────────

@router.patch("/temples/{temple_id}")
def update_temple_fields(
    temple_id: int,
    body: TempleFieldUpdate,
    admin: dict = Depends(get_current_admin),
):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(422, "No fields provided to update")

    set_clauses = ", ".join(f"{k} = %({k})s" for k in updates)
    updates["temple_id"] = temple_id

    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM temples WHERE id = %s", (temple_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Temple not found")

        cur.execute(
            f"UPDATE temples SET {set_clauses} WHERE id = %(temple_id)s RETURNING id, name",
            updates,
        )
        row = cur.fetchone()

    return {"success": True, "id": row["id"], "name": row["name"], "updated_fields": list(updates.keys())}


# ─────────────────────────────────────────────
# PATCH /api/admin/temples/{id}/status
# ─────────────────────────────────────────────

@router.patch("/temples/{temple_id}/status")
def update_status(
    temple_id: int,
    body: TempleStatusUpdate,
    admin: dict = Depends(get_current_admin),
):
    """Transition a temple through the status workflow."""
    if body.status not in VALID_STATUSES:
        raise HTTPException(422, f"status must be one of: {VALID_STATUSES}")

    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM temples WHERE id = %s", (temple_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Temple not found")

        extra = ", published_at = NOW()" if body.status == "published" else ""
        cur.execute(f"""
            UPDATE temples SET status = %s{extra} WHERE id = %s
            RETURNING id, status
        """, (body.status, temple_id))
        row = cur.fetchone()

    return {"success": True, "id": row["id"], "status": row["status"]}


# ─────────────────────────────────────────────
# PATCH /api/admin/temples/{id}/verify
# ─────────────────────────────────────────────

@router.patch("/temples/{temple_id}/verify")
def verify_temple(
    temple_id: int,
    admin: dict = Depends(get_current_admin),
):
    """Mark a temple as admin-verified."""
    with get_db_cursor() as cur:
        cur.execute(
            "UPDATE temples SET verified = TRUE, verified_at = NOW() WHERE id = %s RETURNING id",
            (temple_id,)
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(404, "Temple not found")
    return {"success": True, "temple_id": temple_id, "verified": True}


# ─────────────────────────────────────────────
# POST /api/admin/temples/{id}/media
# ─────────────────────────────────────────────

@router.post("/temples/{temple_id}/media", status_code=201)
async def upload_media(
    temple_id:  int,
    admin: dict = Depends(get_current_admin),
    file:       UploadFile = File(...),
    caption:    Optional[str] = Form(None),
    is_hero:    bool          = Form(False),
    sort_order: int           = Form(0),
):
    ensure_media_table()

    ct       = file.content_type
    is_image = ct in ALLOWED_IMAGE
    is_video = ct in ALLOWED_VIDEO

    if not is_image and not is_video:
        raise HTTPException(400, "Invalid type. Use JPEG/PNG/WebP/GIF or MP4/WebM/OGG")

    data  = await file.read()
    limit = MAX_VID if is_video else MAX_IMG
    if len(data) > limit:
        raise HTTPException(400, f"File too large — max {'200 MB' if is_video else '10 MB'}")

    mtype    = "video" if is_video else "image"
    file_url = save_upload(data, file.filename, prefix=f"temple-{temple_id}-")

    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM temples WHERE id = %s", (temple_id,))
        if not cur.fetchone():
            fpath = os.path.join(UPLOAD_DIR, file_url.lstrip("/uploads/"))
            if os.path.exists(fpath):
                os.remove(fpath)
            raise HTTPException(404, "Temple not found")

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


# ─────────────────────────────────────────────
# GET /api/admin/temples/{id}/media
# ─────────────────────────────────────────────

@router.get("/temples/{temple_id}/media")
def get_temple_media(
    temple_id: int,
    admin: dict = Depends(get_current_admin),
):
    ensure_media_table()
    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM temples WHERE id = %s", (temple_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Temple not found")

        cur.execute("""
            SELECT id, media_type, file_url, file_name,
                   caption, is_hero, sort_order, uploaded_at
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


# ─────────────────────────────────────────────
# DELETE /api/admin/media/{id}
# ─────────────────────────────────────────────

@router.delete("/media/{media_id}")
def delete_media(
    media_id: int,
    admin: dict = Depends(get_current_admin),
):
    ensure_media_table()
    with get_db_cursor() as cur:
        cur.execute("SELECT file_url, temple_id FROM temple_media WHERE id = %s", (media_id,))
        m = cur.fetchone()
        if not m:
            raise HTTPException(404, "Media not found")

        relative = m["file_url"].replace("/uploads/", "", 1)
        fpath = os.path.join(UPLOAD_DIR, relative)
        if os.path.exists(fpath):
            os.remove(fpath)

        cur.execute("DELETE FROM temple_media WHERE id = %s", (media_id,))

    return {"success": True, "message": "Media deleted"}


# ─────────────────────────────────────────────
# POST /api/admin/temples/{id}/upload-video
# ─────────────────────────────────────────────

VALID_VIDEO_SLOTS = {
    "aarti": "video_aarti_url",
    "intro": "video_intro_url",
    "360":   "video_360_url",
}

@router.post("/temples/{temple_id}/upload-video")
async def upload_video(
    temple_id:  int,
    admin: dict = Depends(get_current_admin),
    file:       UploadFile = File(...),
    video_slot: str        = Form("intro"),
):
    if file.content_type not in ALLOWED_VIDEO:
        raise HTTPException(400, "Use MP4, WebM, or OGG")
    if video_slot not in VALID_VIDEO_SLOTS:
        raise HTTPException(422, "video_slot must be: aarti | intro | 360")

    data = await file.read()
    if len(data) > MAX_VID:
        raise HTTPException(400, "Video too large — max 200 MB")

    video_url = save_upload(data, file.filename, prefix=f"temple-{temple_id}-{video_slot}-")
    col = VALID_VIDEO_SLOTS[video_slot]

    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM temples WHERE id = %s", (temple_id,))
        if not cur.fetchone():
            fpath = os.path.join(UPLOAD_DIR, video_url.replace("/uploads/", "", 1))
            if os.path.exists(fpath):
                os.remove(fpath)
            raise HTTPException(404, "Temple not found")

        cur.execute(f"UPDATE temples SET {col} = %s WHERE id = %s", (video_url, temple_id))

    return {"success": True, "slot": video_slot, "url": video_url}


# ─────────────────────────────────────────────
# POST /api/admin/temples/{id}/priests  (Step 4)
# ─────────────────────────────────────────────

@router.post("/temples/{temple_id}/priests")
def add_priest(
    temple_id: int,
    body: PriestCreate,
    admin: dict = Depends(get_current_admin),
):
    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM temples WHERE id = %s", (temple_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Temple not found")

    result = upsert_priest(temple_id, body.model_dump())
    return {"success": True, "priest_id": result["id"] if result else None}


# ─────────────────────────────────────────────
# POST /api/admin/temples/{id}/committee  (Step 4)
# ─────────────────────────────────────────────

@router.post("/temples/{temple_id}/committee")
def set_committee(
    temple_id: int,
    body: CommitteeCreate,
    admin: dict = Depends(get_current_admin),
):
    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM temples WHERE id = %s", (temple_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Temple not found")

    result = upsert_committee(temple_id, body.model_dump())
    return {"success": True, "committee_id": result["id"] if result else None}


# ─────────────────────────────────────────────
# PUT /api/admin/temples/{id}/puja-schedule  (Step 5)
# ─────────────────────────────────────────────

@router.put("/temples/{temple_id}/puja-schedule")
def set_puja_schedule(
    temple_id: int,
    rows: List[PujaScheduleRow] = Body(...),
    admin: dict = Depends(get_current_admin),
):
    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM temples WHERE id = %s", (temple_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Temple not found")

    replace_puja_schedule(temple_id, [r.model_dump() for r in rows])
    return {"success": True, "rows_saved": len(rows)}