"""
Pydantic models define the SHAPE of API responses.
FastAPI uses these to:
- Validate outgoing data
- Auto-generate API documentation
- Convert DB rows to clean JSON
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import time, datetime


class TempleListItem(BaseModel):
    """
    Lightweight model for temple list/map views.
    Only includes fields needed for cards and map pins.
    Never return ALL columns in list views — wastes bandwidth.
    """
    id:               int
    uuid:             str
    name:             str
    name_hindi:       Optional[str] = None
    slug:             Optional[str] = None 
    city:             str
    state:            str
    primary_deity:    Optional[str] = None
    temple_type:      Optional[str] = None
    is_jyotirlinga:   bool = False
    is_shaktipeeth:   bool = False
    latitude:         Optional[float] = None
    longitude:        Optional[float] = None
    hero_image_url:   Optional[str] = None
    average_rating:   Optional[float] = None
    category_tags:    Optional[List[str]] = []
    status:           str

    class Config:
        from_attributes = True


class TempleNearby(TempleListItem):
    """
    Extends TempleListItem with distance.
    Used for 'Temples Near Me' feature.
    """
    distance_km: Optional[float] = None


class MantraResponse(BaseModel):
    id:               int
    title:            str
    sanskrit:         Optional[str] = None
    slug:             Optional[str] = None 
    transliteration:  Optional[str] = None
    meaning:          Optional[str] = None
    mantra_type:      Optional[str] = None
    deity:            Optional[str] = None

    class Config:
        from_attributes = True


class FestivalResponse(BaseModel):
    name:           str
    description:    Optional[str] = None
    significance:   Optional[str] = None
    month:          Optional[int] = None
    hindu_month:    Optional[str] = None
    duration_days:  Optional[int] = None
    is_major:       bool = False

    class Config:
        from_attributes = True


class SevaResponse(BaseModel):
    id:               int
    name:             str
    description:      Optional[str] = None
    price:            Optional[float] = None
    is_free:          bool = False
    timing:           Optional[str] = None
    advance_booking:  bool = False
    booking_url:      Optional[str] = None

    class Config:
        from_attributes = True


class TempleDetail(BaseModel):
    """
    Full temple detail — used for temple profile page.
    Includes all fields + related data.
    """
    id:                     int
    uuid:                   str
    name:                   str
    name_hindi:             Optional[str] = None
    name_local:             Optional[str] = None
    slug:                   str

    # Location
    latitude:               Optional[float] = None
    longitude:              Optional[float] = None
    address:                Optional[str] = None
    city:                   str
    district:               Optional[str] = None
    state:                  str
    pincode:                Optional[str] = None

    # Deity & Religion
    primary_deity:          Optional[str] = None
    secondary_deities:      Optional[List[str]] = []
    sect:                   Optional[str] = None
    temple_type:            Optional[str] = None

    # Flags
    is_jyotirlinga:         bool = False
    is_shaktipeeth:         bool = False
    is_divya_desam:         bool = False
    is_heritage_site:       bool = False
    is_asi_protected:       bool = False

    # Content
    history:                Optional[str] = None
    sthala_purana:          Optional[str] = None
    significance:           Optional[str] = None
    architecture_style:     Optional[str] = None
    estimated_year_built:   Optional[str] = None

    # Practical Info
    opening_time:           Optional[str] = None
    closing_time:           Optional[str] = None
    entry_fee:              Optional[float] = None
    dress_code:             Optional[str] = None
    best_time_to_visit:     Optional[str] = None
    nearest_railway:        Optional[str] = None
    nearest_airport:        Optional[str] = None
    website_url:            Optional[str] = None
    phone:                  Optional[str] = None

    # Media
    hero_image_url:         Optional[str] = None
    category_tags:          Optional[List[str]] = []

    # Ratings
    average_rating:         Optional[float] = None
    total_ratings:          int = 0

    # Status
    status:                 str
    verified:               bool = False

    class Config:
        from_attributes = True


class PaginatedTemples(BaseModel):
    """Wrapper for paginated list responses."""
    total:      int
    page:       int
    per_page:   int
    temples:    List[TempleListItem]


class APIResponse(BaseModel):
    """Standard API response wrapper."""
    success:    bool
    message:    str
    data:       Optional[dict] = None