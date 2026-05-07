"""
Data Cleaner for BharatMandir Pipeline.
Normalizes and fixes data before database insert.
"""

import re
from typing import Optional


def generate_slug(name: str, city: str) -> str:
    """Generate URL-friendly slug from temple name and city."""
    text = f"{name} {city}".lower()
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'\s+', '-', text.strip())
    text = re.sub(r'-+', '-', text)
    return text[:100]  # Max 100 chars


def clean_string(value) -> Optional[str]:
    """Clean and normalize a string value."""
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned if cleaned else None


def clean_boolean(value) -> bool:
    """Convert various boolean representations to Python bool."""
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().upper() in ('TRUE', 'YES', '1', 'T')
    if isinstance(value, (int, float)):
        return bool(value)
    return False


def clean_float(value, default=None):
    """Safely convert to float."""
    if value is None or str(value).strip() == '':
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


def clean_array_field(value) -> list:
    """
    Convert pipe-separated string to list.
    CSV stores arrays as: 'Parvati|Ganesha|Kartikeya'
    We convert to: ['Parvati', 'Ganesha', 'Kartikeya']
    """
    if value is None or str(value).strip() == '':
        return []
    if isinstance(value, list):
        return [str(v).strip() for v in value if v]
    
    # Split by pipe character
    items = str(value).split('|')
    return [item.strip() for item in items if item.strip()]


def clean_time(value) -> Optional[str]:
    """Validate and clean time string (HH:MM:SS format)."""
    if not value:
        return None
    time_str = str(value).strip()
    # Check basic time format
    if re.match(r'^\d{2}:\d{2}(:\d{2})?$', time_str):
        return time_str
    return None


# Valid enum values from new schema
VALID_MANAGING_AUTHORITY = {
    'Private / Family Trust',
    'Community / Village Trust',
    'State Govt Endowment Board',
    'Archaeological Survey of India (ASI)',
}

VALID_SETTING_ENVIRONMENT = {
    'Riverbank / Ghats',
    'Hilltop / Mountain',
    'Forest / Jungle',
    'Urban / City',
    'Cave / Underground',
    'Island',
    'Roadside / Highway',
    'Village common',
}

VALID_BUILDING_CONDITION = {
    'Excellent — well maintained',
    'Good — minor maintenance needed',
    'Fair — needs renovation',
    'Poor — urgent repair needed',
}

VALID_ONLINE_PUJA = {'yes', 'no', 'soon'}
VALID_LIVE_STREAM = {'yes', 'no', 'planning'}

VALID_WEEKLY_DAY = {
    'None / All days equal',
    'Monday (Shiva)',
    'Tuesday (Hanuman / Devi)',
    'Wednesday (Ganesha)',
    'Thursday (Vishnu / Guru)',
    'Friday (Lakshmi / Devi)',
    'Saturday (Saturn / Hanuman)',
    'Sunday (Surya)',
}


def clean_enum(value, valid_set: set, default=None) -> Optional[str]:
    """Return value if it's in the valid set, else return default."""
    if not value:
        return default
    v = str(value).strip()
    return v if v in valid_set else default


def clean_temple_row(raw_row: dict) -> dict:
    """
    Clean and normalize a single temple row.
    Called after validation passes.
    """
    cleaned = {}

    # ── Basic strings ──────────────────────────────────────────────────
    cleaned['name']         = clean_string(raw_row.get('name'))
    cleaned['name_hindi']   = clean_string(raw_row.get('name_hindi'))
    cleaned['name_local']   = clean_string(raw_row.get('name_local'))
    cleaned['address']      = clean_string(raw_row.get('address'))
    cleaned['city']         = clean_string(raw_row.get('city'))
    cleaned['district']     = clean_string(raw_row.get('district'))
    cleaned['state']        = clean_string(raw_row.get('state'))
    cleaned['pincode']      = clean_string(raw_row.get('pincode'))
    cleaned['country']      = clean_string(raw_row.get('country')) or 'India'

    # ── Deity & Religion ───────────────────────────────────────────────
    cleaned['primary_deity']    = clean_string(raw_row.get('primary_deity'))
    cleaned['sect']             = clean_string(raw_row.get('sect'))
    cleaned['temple_type']      = clean_string(raw_row.get('temple_type'))

    # ── Content fields ─────────────────────────────────────────────────
    cleaned['history']              = clean_string(raw_row.get('history'))
    cleaned['history_hindi']        = clean_string(raw_row.get('history_hindi'))
    cleaned['sthala_purana']        = clean_string(raw_row.get('sthala_purana'))
    cleaned['significance']         = clean_string(raw_row.get('significance'))
    cleaned['puranic_stories']      = clean_string(raw_row.get('puranic_stories'))
    cleaned['architecture_style']   = clean_string(raw_row.get('architecture_style'))
    cleaned['estimated_year_built'] = clean_string(raw_row.get('estimated_year_built'))
    cleaned['founded_by']           = clean_string(raw_row.get('founded_by'))
    cleaned['last_renovation_year'] = clean_string(raw_row.get('last_renovation_year'))

    # ── Visit info ─────────────────────────────────────────────────────
    cleaned['best_time_to_visit']   = clean_string(raw_row.get('best_time_to_visit'))
    cleaned['dress_code']           = clean_string(raw_row.get('dress_code'))
    cleaned['local_landmark']       = clean_string(raw_row.get('local_landmark'))

    # ── Transport ──────────────────────────────────────────────────────
    cleaned['nearest_railway']      = clean_string(raw_row.get('nearest_railway'))
    cleaned['nearest_airport']      = clean_string(raw_row.get('nearest_airport'))
    cleaned['nearest_bus_stand']    = clean_string(raw_row.get('nearest_bus_stand'))

    # ── Contact & Social ───────────────────────────────────────────────
    cleaned['website_url']          = clean_string(raw_row.get('website_url'))
    cleaned['phone']                = clean_string(raw_row.get('phone'))
    cleaned['whatsapp_number']      = clean_string(raw_row.get('whatsapp_number'))
    cleaned['official_email']       = clean_string(raw_row.get('official_email'))
    cleaned['facebook_page']        = clean_string(raw_row.get('facebook_page'))
    cleaned['youtube_channel']      = clean_string(raw_row.get('youtube_channel'))
    cleaned['instagram_handle']     = clean_string(raw_row.get('instagram_handle'))
    cleaned['best_time_to_call']    = clean_string(raw_row.get('best_time_to_call'))
    cleaned['google_maps_link']     = clean_string(raw_row.get('google_maps_link'))
    cleaned['google_place_id']      = clean_string(raw_row.get('google_place_id'))

    # ── Media ──────────────────────────────────────────────────────────
    cleaned['hero_image_url']       = clean_string(raw_row.get('hero_image_url'))
    cleaned['video_aarti_url']      = clean_string(raw_row.get('video_aarti_url'))
    cleaned['video_intro_url']      = clean_string(raw_row.get('video_intro_url'))
    cleaned['video_360_url']        = clean_string(raw_row.get('video_360_url'))
    cleaned['live_stream_url']      = clean_string(raw_row.get('live_stream_url'))
    cleaned['prasad_type']          = clean_string(raw_row.get('prasad_type'))

    # ── Management ─────────────────────────────────────────────────────
    cleaned['trust_name']               = clean_string(raw_row.get('trust_name'))
    cleaned['trust_registration_no']    = clean_string(raw_row.get('trust_registration_no'))

    # ── Banking / Donations ────────────────────────────────────────────
    cleaned['upi_id']               = clean_string(raw_row.get('upi_id'))
    cleaned['bank_account_name']    = clean_string(raw_row.get('bank_account_name'))
    cleaned['bank_name_branch']     = clean_string(raw_row.get('bank_name_branch'))
    cleaned['bank_account_number']  = clean_string(raw_row.get('bank_account_number'))
    cleaned['bank_ifsc']            = clean_string(raw_row.get('bank_ifsc'))
    cleaned['certificate_80g_no']   = clean_string(raw_row.get('certificate_80g_no'))

    # ── External IDs ───────────────────────────────────────────────────
    cleaned['wikidata_id']          = clean_string(raw_row.get('wikidata_id'))
    cleaned['wikipedia_url']        = clean_string(raw_row.get('wikipedia_url'))
    cleaned['osm_id']               = clean_string(raw_row.get('osm_id'))

    # ── Coordinates ────────────────────────────────────────────────────
    cleaned['latitude']  = clean_float(raw_row.get('latitude'))
    cleaned['longitude'] = clean_float(raw_row.get('longitude'))

    # ── Numbers ────────────────────────────────────────────────────────
    cleaned['entry_fee'] = clean_float(raw_row.get('entry_fee'), default=0.0)

    # ── Times ──────────────────────────────────────────────────────────
    cleaned['opening_time']             = clean_time(raw_row.get('opening_time'))
    cleaned['closing_time']             = clean_time(raw_row.get('closing_time'))
    cleaned['afternoon_closure_start']  = clean_time(raw_row.get('afternoon_closure_start'))
    cleaned['afternoon_closure_end']    = clean_time(raw_row.get('afternoon_closure_end'))

    # ── Core boolean flags ─────────────────────────────────────────────
    cleaned['is_jyotirlinga']       = clean_boolean(raw_row.get('is_jyotirlinga'))
    cleaned['is_shaktipeeth']       = clean_boolean(raw_row.get('is_shaktipeeth'))
    cleaned['is_divya_desam']       = clean_boolean(raw_row.get('is_divya_desam', False))
    cleaned['is_ashtavinayak']      = clean_boolean(raw_row.get('is_ashtavinayak', False))
    cleaned['is_char_dham']         = clean_boolean(raw_row.get('is_char_dham', False))
    cleaned['is_heritage_site']     = clean_boolean(raw_row.get('is_heritage_site', False))
    cleaned['is_asi_protected']     = clean_boolean(raw_row.get('is_asi_protected', False))
    cleaned['is_pancha_bhuta']      = clean_boolean(raw_row.get('is_pancha_bhuta', False))
    cleaned['is_51_shakti_peeths']  = clean_boolean(raw_row.get('is_51_shakti_peeths', False))
    cleaned['is_unesco_heritage']   = clean_boolean(raw_row.get('is_unesco_heritage', False))
    cleaned['is_state_heritage']    = clean_boolean(raw_row.get('is_state_heritage', False))

    # ── Puja type flags ────────────────────────────────────────────────
    for puja in [
        'puja_rudrabhishek', 'puja_satyanarayan', 'puja_havan_homa',
        'puja_laghu_rudra', 'puja_mahamrityunjaya', 'puja_griha_pravesh',
        'puja_naamkaran', 'puja_vivah', 'puja_annaprashan',
        'puja_mundan', 'puja_pitru_tarpan', 'puja_sahasranamarchana',
    ]:
        cleaned[puja] = clean_boolean(raw_row.get(puja, False))

    # ── Facility flags ─────────────────────────────────────────────────
    for facility in [
        'facility_electricity', 'facility_water_supply', 'facility_clean_toilets',
        'facility_wheelchair', 'facility_dharamshala', 'facility_prasad_dining',
        'facility_parking', 'facility_security', 'facility_cctv',
        'facility_pa_system', 'facility_internet_wifi', 'facility_library_pathshala',
        'facility_gaushaala', 'facility_medical_support',
    ]:
        cleaned[facility] = clean_boolean(raw_row.get(facility, False))

    # ── Program flags ──────────────────────────────────────────────────
    for prog in [
        'prog_free_food', 'prog_medical_camps', 'prog_scholarship_edu',
        'prog_womens_selfhelp', 'prog_bhajan_kirtan', 'prog_disaster_relief',
    ]:
        cleaned[prog] = clean_boolean(raw_row.get(prog, False))

    # ── Donation flags ─────────────────────────────────────────────────
    cleaned['accept_online_donations']      = clean_boolean(raw_row.get('accept_online_donations', False))
    cleaned['donation_temple_renovation']   = clean_boolean(raw_row.get('donation_temple_renovation', False))
    cleaned['donation_annadanam']           = clean_boolean(raw_row.get('donation_annadanam', False))
    cleaned['donation_priest_salary']       = clean_boolean(raw_row.get('donation_priest_salary', False))
    cleaned['donation_vedic_education']     = clean_boolean(raw_row.get('donation_vedic_education', False))
    cleaned['donation_festival']            = clean_boolean(raw_row.get('donation_festival', False))
    cleaned['donation_medical_camps']       = clean_boolean(raw_row.get('donation_medical_camps', False))
    cleaned['donation_general']             = clean_boolean(raw_row.get('donation_general', False))

    # ── Arrays (pipe-separated in CSV) ─────────────────────────────────
    cleaned['secondary_deities'] = clean_array_field(raw_row.get('secondary_deities'))
    cleaned['category_tags']     = clean_array_field(raw_row.get('category_tags'))

    # ── Enum fields ────────────────────────────────────────────────────
    cleaned['managing_authority']   = clean_enum(
        raw_row.get('managing_authority'), VALID_MANAGING_AUTHORITY
    )
    cleaned['setting_environment']  = clean_enum(
        raw_row.get('setting_environment'), VALID_SETTING_ENVIRONMENT
    )
    cleaned['building_condition']   = clean_enum(
        raw_row.get('building_condition'), VALID_BUILDING_CONDITION
    )
    cleaned['online_puja_available'] = clean_enum(
        raw_row.get('online_puja_available'), VALID_ONLINE_PUJA, default='no'
    )
    cleaned['live_darshan_available'] = clean_enum(
        raw_row.get('live_darshan_available'), VALID_LIVE_STREAM, default='no'
    )
    cleaned['weekly_special_day'] = clean_enum(
        raw_row.get('weekly_special_day'), VALID_WEEKLY_DAY,
        default='None / All days equal'
    )

    # ── Status & Source ────────────────────────────────────────────────
    cleaned['status'] = clean_string(raw_row.get('status')) or 'draft'
    cleaned['source'] = clean_string(raw_row.get('source')) or 'manual'

    # ── Slug — generate if missing ─────────────────────────────────────
    slug = clean_string(raw_row.get('slug'))
    if not slug:
        slug = generate_slug(cleaned['name'], cleaned['city'])
    cleaned['slug'] = slug

    return cleaned