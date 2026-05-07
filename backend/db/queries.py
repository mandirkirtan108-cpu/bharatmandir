"""
Reusable database query functions for BharatMandir.
All temple-related DB operations live here.
Covers Migration v1 (core) + Migration v2 (registration form).
"""

from db.connection import get_db_cursor


# ─────────────────────────────────────────────
# Temples — READ
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


def get_temple_by_slug(slug: str):
    """Fetch complete temple details by slug (excludes sensitive bank data)."""
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                id, uuid, name, name_hindi, name_local, slug, mkt_id,
                -- Step 1
                managing_authority, trust_name, trust_registration_no,
                -- Step 2
                latitude, longitude, address, city, district, state, pincode,
                setting_environment, google_maps_link,
                nearest_bus_stand, local_landmark,
                nearest_railway, nearest_airport,
                -- Deity
                primary_deity, secondary_deities, sect, temple_type,
                -- Step 3 flags
                is_jyotirlinga, is_shaktipeeth, is_divya_desam,
                is_ashtavinayak, is_char_dham, is_heritage_site,
                is_asi_protected, is_pancha_bhuta, is_51_shakti_peeths,
                is_unesco_heritage, is_state_heritage,
                -- Step 3 history
                history, history_hindi, sthala_purana, significance,
                architecture_style, estimated_year_built, founded_by,
                last_renovation_year, building_condition, puranic_stories,
                -- Step 5 schedule
                opening_time, closing_time,
                afternoon_closure_start, afternoon_closure_end,
                weekly_special_day,
                -- Step 5 puja service flags
                puja_rudrabhishek, puja_satyanarayan, puja_havan_homa,
                puja_laghu_rudra, puja_mahamrityunjaya, puja_griha_pravesh,
                puja_naamkaran, puja_vivah, puja_annaprashan, puja_mundan,
                puja_pitru_tarpan, puja_sahasranamarchana,
                -- Step 5 digital
                online_puja_available, live_darshan_available,
                live_stream_url, prasad_type,
                -- Step 6 media
                hero_image_url, video_aarti_url, video_intro_url, video_360_url,
                -- Step 7 finance (NO bank_account_number — sensitive)
                bank_account_name, bank_name_branch, bank_ifsc,
                upi_id, certificate_80g_no,
                -- Step 7 donation flags
                donation_temple_renovation, donation_annadanam,
                donation_priest_salary, donation_vedic_education,
                donation_festival, donation_medical_camps,
                donation_general, accept_online_donations,
                -- Step 7 facilities
                facility_electricity, facility_water_supply,
                facility_clean_toilets, facility_wheelchair,
                facility_dharamshala, facility_prasad_dining,
                facility_parking, facility_security, facility_cctv,
                facility_pa_system, facility_internet_wifi,
                facility_library_pathshala, facility_gaushaala,
                facility_medical_support,
                -- Step 7 community programs
                prog_free_food, prog_medical_camps, prog_scholarship_edu,
                prog_womens_selfhelp, prog_bhajan_kirtan, prog_disaster_relief,
                -- Step 7 contact
                phone, whatsapp_number, official_email, website_url,
                facebook_page, youtube_channel, instagram_handle,
                best_time_to_call,
                -- Practical
                entry_fee, dress_code, best_time_to_visit,
                -- Ratings & status
                average_rating, total_ratings, status, verified,
                category_tags, submitted_at, published_at
            FROM temples
            WHERE slug = %s AND status = 'published'
        """, (slug,))
        return cur.fetchone()


def get_temples_near_location(lat, lng, radius_km=10, limit=20):
    """Find temples within radius_km of given coordinates (PostGIS)."""
    radius_meters = radius_km * 1000
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                id, uuid, name, name_hindi, slug,
                city, state, primary_deity,
                temple_type, is_jyotirlinga, is_shaktipeeth,
                latitude, longitude, hero_image_url, category_tags, status,
                ROUND(
                    ST_Distance(
                        location,
                        ST_GeogFromText('POINT(' || %s || ' ' || %s || ')')
                    )::numeric / 1000,
                2) AS distance_km
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
        return cur.fetchall()


def search_temples(query: str, limit=20):
    """Full-text search across name, city, deity, significance."""
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                id, uuid, name, name_hindi, slug,
                city, state, primary_deity,
                temple_type, is_jyotirlinga, is_shaktipeeth,
                latitude, longitude, hero_image_url,
                average_rating, category_tags, status,
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
        """, (query, query, limit))
        return cur.fetchall()


# ─────────────────────────────────────────────
# Related data — READ
# ─────────────────────────────────────────────

def get_temple_mantras(temple_id: int):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, title, sanskrit, transliteration,
                   meaning, mantra_type, deity
            FROM mantras
            WHERE temple_id = %s AND verified = TRUE
            ORDER BY sort_order ASC
        """, (temple_id,))
        return cur.fetchall()


def get_temple_festivals(temple_id: int):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT name, description, significance,
                   month, hindu_month, duration_days, is_major
            FROM festivals
            WHERE temple_id = %s
            ORDER BY month ASC NULLS LAST
        """, (temple_id,))
        return cur.fetchall()


def get_temple_sevas(temple_id: int):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, name, description, price,
                   is_free, timing, advance_booking, booking_url
            FROM sevas
            WHERE temple_id = %s AND verified = TRUE
            ORDER BY price ASC NULLS LAST
        """, (temple_id,))
        return cur.fetchall()


# ─────────────────────────────────────────────
# v2 new tables — READ
# ─────────────────────────────────────────────

def get_temple_puja_schedule(temple_id: int):
    """Fetch dynamic puja schedule rows for a temple."""
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, puja_name, puja_time, puja_type, sort_order
            FROM temple_puja_schedule
            WHERE temple_id = %s
            ORDER BY sort_order ASC, puja_time ASC
        """, (temple_id,))
        return cur.fetchall()


def get_temple_priests(temple_id: int):
    """Fetch priests for a temple (email omitted — private)."""
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                id, is_head_priest, full_name, title_designation,
                phone, qualification, sampradaya, languages_known,
                years_of_service, appointment_type,
                total_priests_on_staff, succession_plan
            FROM temple_priests
            WHERE temple_id = %s
            ORDER BY is_head_priest DESC, id ASC
        """, (temple_id,))
        return cur.fetchall()


def get_temple_committee(temple_id: int):
    """Fetch managing committee for a temple."""
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                id, chairman_name, chairman_contact,
                committee_member_count, election_cycle
            FROM temple_committees
            WHERE temple_id = %s
            LIMIT 1
        """, (temple_id,))
        return cur.fetchone()


def get_temple_registration(temple_id: int):
    """
    Fetch registration/consent record for a temple.
    Private fields (submitter_phone, ip_address) are excluded.
    """
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                id, temple_id, submitter_name, submitter_role,
                consent_authorised_rep, consent_accurate_info,
                consent_publish_permission, consent_bylaws_compliance,
                consent_donation_transparency,
                otp_verified, otp_verified_at, submitted_at
            FROM temple_registrations
            WHERE temple_id = %s
        """, (temple_id,))
        return cur.fetchone()


# ─────────────────────────────────────────────
# Temples — WRITE
# ─────────────────────────────────────────────

def insert_temple(temple_data: dict):
    """
    Insert a new temple (core fields only — Step 1-3 basics).
    Used by admin form and pipeline.
    Returns the new id, uuid, slug.
    """
    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO temples (
                name, name_hindi, name_local, slug,
                latitude, longitude, location,
                city, state, district, pincode,
                primary_deity, sect, temple_type,
                history, significance,
                category_tags, status, source
            ) VALUES (
                %(name)s, %(name_hindi)s, %(name_local)s, %(slug)s,
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


# ─────────────────────────────────────────────
# v2 new tables — WRITE
# ─────────────────────────────────────────────

def upsert_priest(temple_id: int, priest_data: dict):
    """Insert or update a priest record for a temple."""
    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO temple_priests (
                temple_id, is_head_priest, full_name, title_designation,
                phone, email, qualification, sampradaya,
                languages_known, years_of_service, appointment_type,
                total_priests_on_staff, succession_plan
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT DO NOTHING
            RETURNING id
        """, (
            temple_id,
            priest_data.get('is_head_priest', True),
            priest_data['full_name'],
            priest_data.get('title_designation'),
            priest_data['phone'],
            priest_data.get('email'),
            priest_data.get('qualification'),
            priest_data.get('sampradaya'),
            priest_data.get('languages_known'),
            priest_data.get('years_of_service'),
            priest_data.get('appointment_type'),
            priest_data.get('total_priests_on_staff', 1),
            priest_data.get('succession_plan'),
        ))
        return cur.fetchone()


def upsert_committee(temple_id: int, committee_data: dict):
    """Insert or replace committee record for a temple."""
    with get_db_cursor() as cur:
        # Delete old record first (one committee per temple)
        cur.execute("DELETE FROM temple_committees WHERE temple_id = %s", (temple_id,))
        cur.execute("""
            INSERT INTO temple_committees (
                temple_id, chairman_name, chairman_contact,
                committee_member_count, election_cycle
            ) VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (
            temple_id,
            committee_data.get('chairman_name'),
            committee_data.get('chairman_contact'),
            committee_data.get('committee_member_count'),
            committee_data.get('election_cycle'),
        ))
        return cur.fetchone()


def replace_puja_schedule(temple_id: int, schedule_rows: list[dict]):
    """
    Replace all puja schedule rows for a temple.
    Deletes existing rows then bulk-inserts the new set.
    """
    with get_db_cursor() as cur:
        cur.execute("DELETE FROM temple_puja_schedule WHERE temple_id = %s", (temple_id,))
        for i, row in enumerate(schedule_rows):
            cur.execute("""
                INSERT INTO temple_puja_schedule
                    (temple_id, puja_name, puja_time, puja_type, sort_order)
                VALUES (%s, %s, %s, %s, %s)
            """, (
                temple_id,
                row['puja_name'],
                row['puja_time'],
                row.get('puja_type', 'Aarti'),
                row.get('sort_order', i),
            ))


def upsert_registration(temple_id: int, reg_data: dict):
    """
    Insert or update a temple registration / consent record.
    Uses ON CONFLICT on the UNIQUE temple_id constraint.
    """
    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO temple_registrations (
                temple_id, submitter_name, submitter_role, submitter_phone,
                consent_authorised_rep, consent_accurate_info,
                consent_publish_permission, consent_bylaws_compliance,
                consent_donation_transparency,
                otp_verified, ip_address, submitted_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s,
                FALSE, %s, NOW()
            )
            ON CONFLICT (temple_id) DO UPDATE SET
                submitter_name                = EXCLUDED.submitter_name,
                submitter_role                = EXCLUDED.submitter_role,
                submitter_phone               = EXCLUDED.submitter_phone,
                consent_authorised_rep        = EXCLUDED.consent_authorised_rep,
                consent_accurate_info         = EXCLUDED.consent_accurate_info,
                consent_publish_permission    = EXCLUDED.consent_publish_permission,
                consent_bylaws_compliance     = EXCLUDED.consent_bylaws_compliance,
                consent_donation_transparency = EXCLUDED.consent_donation_transparency,
                otp_verified                  = FALSE,
                ip_address                    = EXCLUDED.ip_address,
                submitted_at                  = NOW()
            RETURNING id
        """, (
            temple_id,
            reg_data['submitter_name'],
            reg_data['submitter_role'],
            reg_data['submitter_phone'],
            reg_data.get('consent_authorised_rep', False),
            reg_data.get('consent_accurate_info', False),
            reg_data.get('consent_publish_permission', False),
            reg_data.get('consent_bylaws_compliance', False),
            reg_data.get('consent_donation_transparency', False),
            reg_data.get('ip_address'),
        ))
        return cur.fetchone()


def mark_otp_verified(temple_id: int):
    """Mark a registration OTP as verified."""
    with get_db_cursor() as cur:
        cur.execute("""
            UPDATE temple_registrations
            SET otp_verified = TRUE, otp_verified_at = NOW()
            WHERE temple_id = %s
            RETURNING id
        """, (temple_id,))
        return cur.fetchone()