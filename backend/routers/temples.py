"""
Temple API Routes for BharatMandir.
All /api/temples/* endpoints live here.
Covers v1 core endpoints + v2 registration-form sub-resources.
"""

from fastapi import APIRouter, HTTPException, Query, Request
from typing import Optional, List
import sys, os, re

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.connection import get_db_cursor
from db.queries import (
    get_temple_puja_schedule, get_temple_priests,
    get_temple_committee, get_temple_registration,
    upsert_registration, mark_otp_verified,
)
from models.temple import (
    TempleListItem, TempleDetail,
    TempleNearby, MantraResponse,
    FestivalResponse, SevaResponse,
    PaginatedTemples,
    PujaScheduleItem, PriestResponse,
    CommitteeResponse, RegistrationResponse,
)

router = APIRouter(
    prefix="/api/temples",
    tags=["Temples"]
)


# ─────────────────────────────────────────────
# Helper — slug ya integer id dono resolve kare
# ─────────────────────────────────────────────

def resolve_temple_id(cur, temple_id: str) -> int:
    """
    temple_id string ho sakti hai:
      - "123"              → integer id se dhundo
      - "jagannath-temple" → slug se dhundo
    Dono cases mein published temple ka integer id return karta hai.
    """
    if temple_id.isdigit():
        cur.execute(
            "SELECT id FROM temples WHERE id = %s AND status = 'published'",
            (int(temple_id),)
        )
    else:
        cur.execute(
            "SELECT id FROM temples WHERE slug = %s AND status = 'published'",
            (temple_id,)
        )
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Temple not found")
    return row['id']


# ─────────────────────────────────────────────
# GET /api/temples
# List with filtering + pagination
# ─────────────────────────────────────────────

@router.get("", response_model=PaginatedTemples)
def list_temples(
    state:       Optional[str]  = Query(None),
    city:        Optional[str]  = Query(None),
    deity:       Optional[str]  = Query(None),
    sect:        Optional[str]  = Query(None),
    jyotirlinga: Optional[bool] = Query(None),
    shaktipeeth: Optional[bool] = Query(None),
    tag:         Optional[str]  = Query(None),
    page:        int = Query(1, ge=1),
    per_page:    int = Query(20, ge=1, le=100),
):
    offset = (page - 1) * per_page
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

    where = " AND ".join(conditions)

    with get_db_cursor() as cur:
        cur.execute(f"SELECT COUNT(*) AS total FROM temples WHERE {where}", params)
        total = cur.fetchone()['total']

        cur.execute(f"""
            SELECT
                id, uuid, name, name_hindi, slug,
                city, state, primary_deity,
                temple_type, is_jyotirlinga, is_shaktipeeth,
                latitude, longitude,
                hero_image_url, average_rating,
                category_tags, status
            FROM temples
            WHERE {where}
            ORDER BY name ASC
            LIMIT %s OFFSET %s
        """, params + [per_page, offset])
        temples = cur.fetchall()

    return {"total": total, "page": page, "per_page": per_page,
            "temples": [dict(t) for t in temples]}


# ─────────────────────────────────────────────
# GET /api/temples/search  (must be before /{slug})
# ─────────────────────────────────────────────

TEMPLE_SEARCH_ALIASES = {
    "shiv": ["shiv", "shiva", "mahadev", "mahakal", "shankar", "bholenath"],
    "shiva": ["shiv", "shiva", "mahadev", "mahakal", "shankar", "bholenath"],
    "mahadev": ["shiv", "shiva", "mahadev", "mahakal", "shankar", "bholenath"],
    "vishnu": ["vishnu", "narayan", "hari", "venkateswara", "balaji"],
    "krishna": ["krishna", "kanha", "gopal", "govind", "shyam"],
    "ram": ["ram", "rama", "ramchandra", "raghunath"],
    "hanuman": ["hanuman", "bajrangbali", "anjaneya", "maruti"],
    "ganesh": ["ganesh", "ganesha", "ganpati", "vinayak"],
    "devi": ["devi", "durga", "mata", "shakti", "amba"],
}


@router.get("/search", response_model=List[TempleListItem])
def search_temples(
    q:     str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=50)
):
    clean_query = " ".join(q.split()).strip()
    tokens = re.findall(r"[a-z0-9]+", clean_query.casefold())
    search_words = {clean_query.casefold(), *tokens}
    for token in tokens:
        search_words.update(TEMPLE_SEARCH_ALIASES.get(token, []))
    patterns = [f"%{word}%" for word in search_words if word]

    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                id, uuid, name, name_hindi, slug,
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
                AND CONCAT_WS(' ',
                    name, name_hindi, name_local, city, district, state,
                    primary_deity, temple_type, sect, significance,
                    array_to_string(category_tags, ' ')
                ) ILIKE ANY(%s)
            ORDER BY
                CASE
                    WHEN LOWER(name) = LOWER(%s) THEN 0
                    WHEN name ILIKE %s THEN 1
                    WHEN primary_deity ILIKE %s THEN 2
                    WHEN city ILIKE %s OR district ILIKE %s OR state ILIKE %s THEN 3
                    ELSE 4
                END,
                rank DESC,
                name ASC
            LIMIT %s
        """, (
            clean_query,
            patterns,
            clean_query,
            f"{clean_query}%",
            f"%{clean_query}%",
            f"%{clean_query}%",
            f"%{clean_query}%",
            f"%{clean_query}%",
            limit,
        ))
        results = cur.fetchall()

    return [dict(r) for r in results]


# ─────────────────────────────────────────────
# GET /api/temples/nearby
# ─────────────────────────────────────────────

@router.get("/nearby", response_model=List[TempleNearby])
def temples_nearby(
    lat:       float = Query(...),
    lng:       float = Query(...),
    radius_km: float = Query(10.0, ge=0.5, le=100.0),
    limit:     int   = Query(20, ge=1, le=50)
):
    radius_meters = radius_km * 1000
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                id, uuid, name, name_hindi, slug,
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
# GET /api/temples/{slug}  — full detail
# ─────────────────────────────────────────────

@router.get("/{slug}")
def get_temple(slug: str):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                id, uuid, name, name_hindi, name_local, slug, mkt_id,
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
                donation_temple_renovation, donation_annadanam,
                donation_priest_salary, donation_vedic_education,
                donation_festival, donation_medical_camps,
                donation_general, accept_online_donations,
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
                average_rating, total_ratings, status, verified,
                category_tags, submitted_at, published_at
            FROM temples
            WHERE slug = %s AND status = 'published'
        """, (slug,))
        temple = cur.fetchone()

    if not temple:
        raise HTTPException(status_code=404, detail=f"Temple '{slug}' not found")

    d = dict(temple)
    for f in ['opening_time', 'closing_time',
              'afternoon_closure_start', 'afternoon_closure_end']:
        if d.get(f):
            d[f] = str(d[f])

    # Gallery images (Cloudinary URLs) for the temple detail page.
    try:
        with get_db_cursor() as cur:
            cur.execute("""
                SELECT id, media_type, file_url, caption, is_hero, sort_order
                FROM temple_media
                WHERE temple_id = %s
                  AND media_type = 'image'
                  AND file_url IS NOT NULL
                  AND file_url <> ''
                ORDER BY is_hero DESC, sort_order ASC, uploaded_at ASC
            """, (d["id"],))
            gallery = [dict(m) for m in cur.fetchall()]
    except Exception:
        gallery = []

    if d.get("hero_image_url"):
        gallery.insert(0, {
            "id": "hero",
            "media_type": "image",
            "file_url": d["hero_image_url"],
            "caption": d.get("name"),
            "is_hero": True,
            "sort_order": -1,
        })

    seen_urls = set()
    d["gallery"] = []
    for item in gallery:
        url = item.get("file_url")
        if not url or url in seen_urls:
            continue
        seen_urls.add(url)
        d["gallery"].append(item)

    return d


# ─────────────────────────────────────────────
# GET /api/temples/{temple_id}/mantras
# ─────────────────────────────────────────────

@router.get("/{temple_id}/mantras", response_model=List[MantraResponse])
def get_temple_mantras(temple_id: str):
    with get_db_cursor() as cur:
        tid = resolve_temple_id(cur, temple_id)
        cur.execute("""
            SELECT id, title, sanskrit, transliteration,
                   meaning, mantra_type, deity
            FROM mantras
            WHERE temple_id = %s AND verified = TRUE
            ORDER BY sort_order ASC
        """, (tid,))
        return [dict(m) for m in cur.fetchall()]


# ─────────────────────────────────────────────
# GET /api/temples/{temple_id}/festivals
# ─────────────────────────────────────────────

@router.get("/{temple_id}/festivals", response_model=List[FestivalResponse])
def get_temple_festivals(temple_id: str):
    with get_db_cursor() as cur:
        tid = resolve_temple_id(cur, temple_id)
        cur.execute("""
            SELECT name, description, significance,
                   month, hindu_month, duration_days, is_major
            FROM festivals
            WHERE temple_id = %s
            ORDER BY month ASC NULLS LAST
        """, (tid,))
        return [dict(f) for f in cur.fetchall()]


# ─────────────────────────────────────────────
# GET /api/temples/{temple_id}/sevas
# ─────────────────────────────────────────────

@router.get("/{temple_id}/sevas", response_model=List[SevaResponse])
def get_temple_sevas(temple_id: str):
    with get_db_cursor() as cur:
        tid = resolve_temple_id(cur, temple_id)
        cur.execute("""
            SELECT id, name, description, price,
                   is_free, timing, advance_booking, booking_url
            FROM sevas
            WHERE temple_id = %s AND verified = TRUE
            ORDER BY price ASC NULLS LAST
        """, (tid,))
        return [dict(s) for s in cur.fetchall()]


# ─────────────────────────────────────────────
# GET /api/temples/{temple_id}/puja-schedule  (v2)
# ─────────────────────────────────────────────

@router.get("/{temple_id}/puja-schedule", response_model=List[PujaScheduleItem])
def get_puja_schedule(temple_id: str):
    with get_db_cursor() as cur:
        tid = resolve_temple_id(cur, temple_id)
    rows = get_temple_puja_schedule(tid)
    result = []
    for r in rows:
        d = dict(r)
        if d.get('puja_time'):
            d['puja_time'] = str(d['puja_time'])
        result.append(d)
    return result


# ─────────────────────────────────────────────
# GET /api/temples/{temple_id}/priests  (v2)
# ─────────────────────────────────────────────

@router.get("/{temple_id}/priests", response_model=List[PriestResponse])
def get_priests(temple_id: str):
    with get_db_cursor() as cur:
        tid = resolve_temple_id(cur, temple_id)
    priests = get_temple_priests(tid)
    return [dict(p) for p in priests]


# ─────────────────────────────────────────────
# GET /api/temples/{temple_id}/committee  (v2)
# ─────────────────────────────────────────────

@router.get("/{temple_id}/committee", response_model=CommitteeResponse)
def get_committee(temple_id: str):
    with get_db_cursor() as cur:
        tid = resolve_temple_id(cur, temple_id)
    committee = get_temple_committee(tid)
    if not committee:
        raise HTTPException(status_code=404, detail="No committee record found for this temple")
    return dict(committee)


# ─────────────────────────────────────────────
# GET /api/temples/{temple_id}/registration  (v2)
# POST /api/temples/{temple_id}/registration
# POST /api/temples/{temple_id}/registration/verify-otp
# ─────────────────────────────────────────────

@router.get("/{temple_id}/registration", response_model=RegistrationResponse)
def get_registration(temple_id: int):
    reg = get_temple_registration(temple_id)
    if not reg:
        raise HTTPException(status_code=404, detail="No registration found for this temple")
    return dict(reg)


from pydantic import BaseModel as _Base

class RegistrationCreate(_Base):
    submitter_name:               str
    submitter_role:               str
    submitter_phone:              str
    consent_authorised_rep:       bool = False
    consent_accurate_info:        bool = False
    consent_publish_permission:   bool = False
    consent_bylaws_compliance:    bool = False
    consent_donation_transparency: bool = False


@router.post("/{temple_id}/registration", response_model=RegistrationResponse)
def create_or_update_registration(
    temple_id: int,
    body: RegistrationCreate,
    request: Request,
):
    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM temples WHERE id = %s", (temple_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Temple not found")

    all_consented = all([
        body.consent_authorised_rep,
        body.consent_accurate_info,
        body.consent_publish_permission,
        body.consent_bylaws_compliance,
        body.consent_donation_transparency,
    ])
    if not all_consented:
        raise HTTPException(
            status_code=422,
            detail="All five consent declarations must be accepted before submitting"
        )

    reg_data = body.model_dump()
    reg_data['ip_address'] = request.client.host if request.client else None
    upsert_registration(temple_id, reg_data)
    reg = get_temple_registration(temple_id)
    return dict(reg)


class OTPVerify(_Base):
    otp_code: str


@router.post("/{temple_id}/registration/verify-otp")
def verify_otp(temple_id: int, body: OTPVerify):
    reg = get_temple_registration(temple_id)
    if not reg:
        raise HTTPException(status_code=404, detail="No registration found — submit registration first")

    result = mark_otp_verified(temple_id)
    if not result:
        raise HTTPException(status_code=500, detail="OTP verification failed")

    return {"success": True, "message": "OTP verified — registration complete"}
