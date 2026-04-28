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


def clean_temple_row(raw_row: dict) -> dict:
    """
    Clean and normalize a single temple row.
    Called after validation passes.
    """
    cleaned = {}

    # Basic strings
    cleaned['name']         = clean_string(raw_row.get('name'))
    cleaned['name_hindi']   = clean_string(raw_row.get('name_hindi'))
    cleaned['address']      = clean_string(raw_row.get('address'))
    cleaned['city']         = clean_string(raw_row.get('city'))
    cleaned['district']     = clean_string(raw_row.get('district'))
    cleaned['state']        = clean_string(raw_row.get('state'))
    cleaned['pincode']      = clean_string(raw_row.get('pincode'))
    cleaned['primary_deity']    = clean_string(raw_row.get('primary_deity'))
    cleaned['sect']             = clean_string(raw_row.get('sect'))
    cleaned['temple_type']      = clean_string(raw_row.get('temple_type'))
    cleaned['history']          = clean_string(raw_row.get('history'))
    cleaned['significance']     = clean_string(raw_row.get('significance'))
    cleaned['architecture_style']   = clean_string(raw_row.get('architecture_style'))
    cleaned['estimated_year_built'] = clean_string(raw_row.get('estimated_year_built'))
    cleaned['best_time_to_visit']   = clean_string(raw_row.get('best_time_to_visit'))
    cleaned['nearest_railway']  = clean_string(raw_row.get('nearest_railway'))
    cleaned['nearest_airport']  = clean_string(raw_row.get('nearest_airport'))
    cleaned['website_url']      = clean_string(raw_row.get('website_url'))

    # Coordinates
    cleaned['latitude']  = clean_float(raw_row.get('latitude'))
    cleaned['longitude'] = clean_float(raw_row.get('longitude'))

    # Booleans
    cleaned['is_jyotirlinga']   = clean_boolean(raw_row.get('is_jyotirlinga'))
    cleaned['is_shaktipeeth']   = clean_boolean(raw_row.get('is_shaktipeeth'))
    cleaned['is_heritage_site'] = clean_boolean(raw_row.get('is_heritage_site', False))
    cleaned['is_asi_protected'] = clean_boolean(raw_row.get('is_asi_protected', False))

    # Arrays (pipe-separated in CSV)
    cleaned['secondary_deities'] = clean_array_field(raw_row.get('secondary_deities'))
    cleaned['category_tags']     = clean_array_field(raw_row.get('category_tags'))

    # Numbers
    cleaned['entry_fee'] = clean_float(raw_row.get('entry_fee'), default=0.0)

    # Times
    cleaned['opening_time'] = clean_time(raw_row.get('opening_time'))
    cleaned['closing_time'] = clean_time(raw_row.get('closing_time'))

    # Status & Source
    cleaned['status'] = clean_string(raw_row.get('status')) or 'draft'
    cleaned['source'] = clean_string(raw_row.get('source')) or 'manual'

    # Slug — generate if missing
    slug = clean_string(raw_row.get('slug'))
    if not slug:
        slug = generate_slug(cleaned['name'], cleaned['city'])
    cleaned['slug'] = slug

    return cleaned