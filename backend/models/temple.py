"""
Pydantic models for BharatMandir API responses.
Covers the full schema after Migration v2 (registration form fields).

FastAPI uses these to:
  - Validate outgoing data
  - Auto-generate API docs
  - Convert DB rows (dicts) to clean JSON
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import time, datetime
from enum import Enum


# ─────────────────────────────────────────────
# Enums matching DB types from migration v2
# ─────────────────────────────────────────────

class ManagingAuthority(str, Enum):
    private_family   = "Private / Family Trust"
    community        = "Community / Village Trust"
    state_endowment  = "State Govt Endowment Board"
    asi              = "Archaeological Survey of India (ASI)"


class SettingEnvironment(str, Enum):
    riverbank  = "Riverbank / Ghats"
    hilltop    = "Hilltop / Mountain"
    forest     = "Forest / Jungle"
    urban      = "Urban / City"
    cave       = "Cave / Underground"
    island     = "Island"
    roadside   = "Roadside / Highway"
    village    = "Village common"


class BuildingCondition(str, Enum):
    excellent = "Excellent — well maintained"
    good      = "Good — minor maintenance needed"
    fair      = "Fair — needs renovation"
    poor      = "Poor — urgent repair needed"


class Sampradaya(str, Enum):
    shaiva      = "Shaiva"
    vaishnava   = "Vaishnava"
    shakta      = "Shakta"
    smarta      = "Smarta"
    ramanandi   = "Ramanandi"
    madhva      = "Madhva"
    iskcon      = "ISKCON / Vaishnava"
    other       = "Other"


class PriestAppointment(str, Enum):
    hereditary  = "Hereditary family priest"
    trust       = "Trust-appointed"
    government  = "Government / Endowment Board appointed"
    elected     = "Community elected"


class CommitteeCycle(str, Enum):
    annual      = "Annual"
    biennial    = "Every 2 years"
    triennial   = "Every 3 years"
    permanent   = "Permanent / No election"
    govt        = "Government appointed"


class PujaType(str, Enum):
    aarti    = "Aarti"
    puja     = "Puja"
    abhishek = "Abhishek"
    bhog     = "Bhog"
    other    = "Other"


class OnlinePujaStatus(str, Enum):
    yes  = "yes"
    no   = "no"
    soon = "soon"


class LiveStreamStatus(str, Enum):
    yes      = "yes"
    no       = "no"
    planning = "planning"


class WeeklySpecialDay(str, Enum):
    none      = "None / All days equal"
    monday    = "Monday (Shiva)"
    tuesday   = "Tuesday (Hanuman / Devi)"
    wednesday = "Wednesday (Ganesha)"
    thursday  = "Thursday (Vishnu / Guru)"
    friday    = "Friday (Lakshmi / Devi)"
    saturday  = "Saturday (Saturn / Hanuman)"
    sunday    = "Sunday (Surya)"


# ─────────────────────────────────────────────
# Lightweight list / map models
# ─────────────────────────────────────────────

class TempleListItem(BaseModel):
    """Minimal fields for temple cards and map pins."""
    id:             int
    uuid:           str
    name:           str
    name_hindi:     Optional[str] = None
    slug:           Optional[str] = None
    city:           str
    state:          str
    primary_deity:  Optional[str] = None
    temple_type:    Optional[str] = None
    is_jyotirlinga: bool = False
    is_shaktipeeth: bool = False
    latitude:       Optional[float] = None
    longitude:      Optional[float] = None
    hero_image_url: Optional[str] = None
    average_rating: Optional[float] = None
    category_tags:  Optional[List[str]] = []
    status:         str

    class Config:
        from_attributes = True


class TempleNearby(TempleListItem):
    """Extends TempleListItem with GPS distance."""
    distance_km: Optional[float] = None


# ─────────────────────────────────────────────
# Related-data response models
# ─────────────────────────────────────────────

class MantraResponse(BaseModel):
    id:              int
    title:           str
    sanskrit:        Optional[str] = None
    slug:            Optional[str] = None
    transliteration: Optional[str] = None
    meaning:         Optional[str] = None
    mantra_type:     Optional[str] = None
    deity:           Optional[str] = None

    class Config:
        from_attributes = True


class FestivalResponse(BaseModel):
    name:          str
    description:   Optional[str] = None
    significance:  Optional[str] = None
    month:         Optional[int] = None
    hindu_month:   Optional[str] = None
    duration_days: Optional[int] = None
    is_major:      bool = False

    class Config:
        from_attributes = True


class SevaResponse(BaseModel):
    id:              int
    name:            str
    description:     Optional[str] = None
    price:           Optional[float] = None
    is_free:         bool = False
    timing:          Optional[str] = None
    advance_booking: bool = False
    booking_url:     Optional[str] = None

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# New v2 response models (registration tables)
# ─────────────────────────────────────────────

class PujaScheduleItem(BaseModel):
    """One row from temple_puja_schedule."""
    id:         int
    puja_name:  str
    puja_time:  str          # serialised from TIME as "HH:MM:SS"
    puja_type:  Optional[PujaType] = None
    sort_order: int = 0

    class Config:
        from_attributes = True


class PriestResponse(BaseModel):
    """One row from temple_priests."""
    id:                      int
    is_head_priest:          bool = True
    full_name:               str
    title_designation:       Optional[str] = None
    phone:                   str
    qualification:           Optional[str] = None
    sampradaya:              Optional[Sampradaya] = None
    languages_known:         Optional[str] = None
    years_of_service:        Optional[int] = None
    appointment_type:        Optional[PriestAppointment] = None
    total_priests_on_staff:  int = 1
    succession_plan:         Optional[str] = None

    class Config:
        from_attributes = True


class CommitteeResponse(BaseModel):
    """One row from temple_committees."""
    id:                     int
    chairman_name:          Optional[str] = None
    chairman_contact:       Optional[str] = None
    committee_member_count: Optional[int] = None
    election_cycle:         Optional[CommitteeCycle] = None

    class Config:
        from_attributes = True


class RegistrationResponse(BaseModel):
    """
    Public-safe view of temple_registrations.
    Private fields (phone, IP) are intentionally excluded.
    """
    id:                           int
    temple_id:                    int
    submitter_name:               str
    submitter_role:               str
    consent_authorised_rep:       bool = False
    consent_accurate_info:        bool = False
    consent_publish_permission:   bool = False
    consent_bylaws_compliance:    bool = False
    consent_donation_transparency: bool = False
    otp_verified:                 bool = False
    otp_verified_at:              Optional[datetime] = None
    submitted_at:                 Optional[datetime] = None

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Donation & facility flags (used in TempleDetail)
# ─────────────────────────────────────────────

class DonationFlags(BaseModel):
    temple_renovation: bool = False
    annadanam:         bool = False
    priest_salary:     bool = False
    vedic_education:   bool = False
    festival:          bool = False
    medical_camps:     bool = False
    general:           bool = False
    accept_online:     bool = False


class FacilityFlags(BaseModel):
    electricity:       bool = False
    water_supply:      bool = False
    clean_toilets:     bool = False
    wheelchair:        bool = False
    dharamshala:       bool = False
    prasad_dining:     bool = False
    parking:           bool = False
    security:          bool = False
    cctv:              bool = False
    pa_system:         bool = False
    internet_wifi:     bool = False
    library_pathshala: bool = False
    gaushaala:         bool = False
    medical_support:   bool = False


class CommunityPrograms(BaseModel):
    free_food:       bool = False
    medical_camps:   bool = False
    scholarship_edu: bool = False
    womens_selfhelp: bool = False
    bhajan_kirtan:   bool = False
    disaster_relief: bool = False


# ─────────────────────────────────────────────
# Full temple detail (all v1 + v2 fields)
# ─────────────────────────────────────────────

class TempleDetail(BaseModel):
    """
    Complete temple profile — used for the temple detail page.
    Covers all columns from Migration v1 + Migration v2.
    """
    # ── Core identity ─────────────────────────
    id:                      int
    uuid:                    str
    name:                    str
    name_hindi:              Optional[str] = None
    name_local:              Optional[str] = None
    slug:                    str
    mkt_id:                  Optional[str] = None    # QR code ID e.g. MKT-UP-4821

    # ── Step 1: Managing authority ────────────
    managing_authority:      Optional[ManagingAuthority] = None
    trust_name:              Optional[str] = None
    trust_registration_no:   Optional[str] = None

    # ── Step 2: Location ──────────────────────
    latitude:                Optional[float] = None
    longitude:               Optional[float] = None
    address:                 Optional[str] = None
    city:                    str
    district:                Optional[str] = None
    state:                   str
    pincode:                 Optional[str] = None
    setting_environment:     Optional[SettingEnvironment] = None
    google_maps_link:        Optional[str] = None
    nearest_bus_stand:       Optional[str] = None
    local_landmark:          Optional[str] = None
    nearest_railway:         Optional[str] = None
    nearest_airport:         Optional[str] = None

    # ── Deity & classification ────────────────
    primary_deity:           Optional[str] = None
    secondary_deities:       Optional[List[str]] = []
    sect:                    Optional[str] = None
    temple_type:             Optional[str] = None

    # ── Step 3: Heritage flags ────────────────
    is_jyotirlinga:          bool = False
    is_shaktipeeth:          bool = False
    is_divya_desam:          bool = False
    is_ashtavinayak:         bool = False
    is_char_dham:            bool = False
    is_heritage_site:        bool = False
    is_asi_protected:        bool = False
    is_pancha_bhuta:         bool = False
    is_51_shakti_peeths:     bool = False
    is_unesco_heritage:      bool = False
    is_state_heritage:       bool = False

    # ── Step 3: History & condition ───────────
    history:                 Optional[str] = None    # English
    history_hindi:           Optional[str] = None
    sthala_purana:           Optional[str] = None
    significance:            Optional[str] = None
    architecture_style:      Optional[str] = None
    estimated_year_built:    Optional[str] = None
    founded_by:              Optional[str] = None
    last_renovation_year:    Optional[str] = None
    building_condition:      Optional[BuildingCondition] = None
    puranic_stories:         Optional[str] = None

    # ── Step 5: Schedule ─────────────────────
    opening_time:            Optional[str] = None
    closing_time:            Optional[str] = None
    afternoon_closure_start: Optional[str] = None
    afternoon_closure_end:   Optional[str] = None
    weekly_special_day:      Optional[WeeklySpecialDay] = None

    # ── Step 5: Puja services (12 flags) ─────
    puja_rudrabhishek:       bool = False
    puja_satyanarayan:       bool = False
    puja_havan_homa:         bool = False
    puja_laghu_rudra:        bool = False
    puja_mahamrityunjaya:    bool = False
    puja_griha_pravesh:      bool = False
    puja_naamkaran:          bool = False
    puja_vivah:              bool = False
    puja_annaprashan:        bool = False
    puja_mundan:             bool = False
    puja_pitru_tarpan:       bool = False
    puja_sahasranamarchana:  bool = False

    # ── Step 5: Digital services ──────────────
    online_puja_available:   Optional[OnlinePujaStatus] = OnlinePujaStatus.no
    live_darshan_available:  Optional[LiveStreamStatus] = LiveStreamStatus.no
    live_stream_url:         Optional[str] = None
    prasad_type:             Optional[str] = None

    # ── Step 6: Video links ───────────────────
    hero_image_url:          Optional[str] = None
    video_aarti_url:         Optional[str] = None
    video_intro_url:         Optional[str] = None
    video_360_url:           Optional[str] = None

    # ── Step 7: Finance ───────────────────────
    # NOTE: bank_account_number intentionally excluded from API (sensitive)
    bank_account_name:       Optional[str] = None
    bank_name_branch:        Optional[str] = None
    bank_ifsc:               Optional[str] = None
    upi_id:                  Optional[str] = None
    certificate_80g_no:      Optional[str] = None

    # ── Step 7: Donation causes ───────────────
    donation_temple_renovation: bool = False
    donation_annadanam:          bool = False
    donation_priest_salary:      bool = False
    donation_vedic_education:    bool = False
    donation_festival:           bool = False
    donation_medical_camps:      bool = False
    donation_general:            bool = False
    accept_online_donations:     bool = False

    # ── Step 7: Facilities (14 flags) ─────────
    facility_electricity:        bool = False
    facility_water_supply:       bool = False
    facility_clean_toilets:      bool = False
    facility_wheelchair:         bool = False
    facility_dharamshala:        bool = False
    facility_prasad_dining:      bool = False
    facility_parking:            bool = False
    facility_security:           bool = False
    facility_cctv:               bool = False
    facility_pa_system:          bool = False
    facility_internet_wifi:      bool = False
    facility_library_pathshala:  bool = False
    facility_gaushaala:          bool = False
    facility_medical_support:    bool = False

    # ── Step 7: Community programs (6 flags) ──
    prog_free_food:              bool = False
    prog_medical_camps:          bool = False
    prog_scholarship_edu:        bool = False
    prog_womens_selfhelp:        bool = False
    prog_bhajan_kirtan:          bool = False
    prog_disaster_relief:        bool = False

    # ── Step 7: Contact & social ──────────────
    phone:                   Optional[str] = None
    whatsapp_number:         Optional[str] = None
    official_email:          Optional[str] = None
    website_url:             Optional[str] = None
    facebook_page:           Optional[str] = None
    youtube_channel:         Optional[str] = None
    instagram_handle:        Optional[str] = None
    best_time_to_call:       Optional[str] = None

    # ── Practical info ────────────────────────
    entry_fee:               Optional[float] = None
    dress_code:              Optional[str] = None
    best_time_to_visit:      Optional[str] = None

    # ── Ratings & status ──────────────────────
    average_rating:          Optional[float] = None
    total_ratings:           int = 0
    status:                  str
    verified:                bool = False
    category_tags:           Optional[List[str]] = []

    # ── Timestamps ────────────────────────────
    submitted_at:            Optional[datetime] = None
    published_at:            Optional[datetime] = None

    class Config:
        from_attributes = True


# ─────────────────────────────────────────────
# Paginated list wrapper
# ─────────────────────────────────────────────

class PaginatedTemples(BaseModel):
    total:    int
    page:     int
    per_page: int
    temples:  List[TempleListItem]


# ─────────────────────────────────────────────
# Generic API response wrapper
# ─────────────────────────────────────────────

class APIResponse(BaseModel):
    success: bool
    message: str
    data:    Optional[dict] = None