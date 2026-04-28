"""
Data Validator for BharatMandir Pipeline
Checks every row before it touches the database.
Bad data IN = Bad data OUT. Validate everything.
"""

from dataclasses import dataclass, field
from typing import List, Optional
import re


@dataclass
class ValidationResult:
    is_valid: bool
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    row_index: int = 0

    def add_error(self, msg):
        self.errors.append(msg)
        self.is_valid = False

    def add_warning(self, msg):
        self.warnings.append(msg)


# Valid values for enum fields
VALID_SECTS = {'Shaiva', 'Vaishnav', 'Shakta', 'Smarta', 
               'Ganapatya', 'Vaishnava', 'Mixed', None}

VALID_STATUSES = {'draft', 'review', 'published', 'flagged', 'archived'}

VALID_SOURCES = {'wikidata', 'wikipedia', 'google_places', 
                 'openstreetmap', 'government', 'ai_enriched', 
                 'manual', 'partnership'}

# India bounding box (rough)
INDIA_LAT_MIN, INDIA_LAT_MAX = 8.0, 37.0
INDIA_LNG_MIN, INDIA_LNG_MAX = 68.0, 97.5


def validate_temple_row(row: dict, index: int) -> ValidationResult:
    """
    Validate a single temple row from CSV/Excel.
    Returns ValidationResult with all errors found.
    """
    result = ValidationResult(is_valid=True, row_index=index)
    
    # ── REQUIRED FIELDS ──────────────────────────────────
    
    if not row.get('name') or str(row['name']).strip() == '':
        result.add_error("'name' is required and cannot be empty")

    if not row.get('city') or str(row['city']).strip() == '':
        result.add_error("'city' is required")

    if not row.get('state') or str(row['state']).strip() == '':
        result.add_error("'state' is required")

    # ── COORDINATES ───────────────────────────────────────

    lat = row.get('latitude')
    lng = row.get('longitude')

    if lat is None or str(lat).strip() == '':
        result.add_error("'latitude' is required")
    else:
        try:
            lat = float(lat)
            if not (INDIA_LAT_MIN <= lat <= INDIA_LAT_MAX):
                result.add_error(
                    f"latitude {lat} is outside India bounds "
                    f"({INDIA_LAT_MIN}–{INDIA_LAT_MAX})"
                )
        except (ValueError, TypeError):
            result.add_error(f"latitude '{lat}' is not a valid number")

    if lng is None or str(lng).strip() == '':
        result.add_error("'longitude' is required")
    else:
        try:
            lng = float(lng)
            if not (INDIA_LNG_MIN <= lng <= INDIA_LNG_MAX):
                result.add_error(
                    f"longitude {lng} is outside India bounds "
                    f"({INDIA_LNG_MIN}–{INDIA_LNG_MAX})"
                )
        except (ValueError, TypeError):
            result.add_error(f"longitude '{lng}' is not a valid number")

    # ── SLUG FORMAT ───────────────────────────────────────

    slug = row.get('slug', '')
    if slug:
        if not re.match(r'^[a-z0-9-]+$', str(slug)):
            result.add_error(
                f"slug '{slug}' must contain only lowercase letters, "
                f"numbers, and hyphens"
            )
    else:
        result.add_warning("No slug provided — will be auto-generated")

    # ── ENUM VALIDATION ───────────────────────────────────

    sect = row.get('sect')
    if sect and sect not in VALID_SECTS:
        result.add_warning(
            f"sect '{sect}' is not a standard value. "
            f"Expected one of: {VALID_SECTS}"
        )

    status = row.get('status', 'draft')
    if status not in VALID_STATUSES:
        result.add_error(
            f"status '{status}' is invalid. "
            f"Must be one of: {VALID_STATUSES}"
        )

    # ── ENTRY FEE ─────────────────────────────────────────

    fee = row.get('entry_fee', 0)
    if fee is not None and str(fee).strip() != '':
        try:
            fee = float(fee)
            if fee < 0:
                result.add_error("entry_fee cannot be negative")
        except (ValueError, TypeError):
            result.add_error(f"entry_fee '{fee}' is not a valid number")

    # ── SOFT WARNINGS ─────────────────────────────────────

    if not row.get('primary_deity'):
        result.add_warning("No primary_deity specified")

    if not row.get('history'):
        result.add_warning("No history provided — consider enriching with AI")

    if not row.get('category_tags'):
        result.add_warning("No category_tags — temple won't appear in filters")

    return result


def validate_dataframe(df) -> tuple:
    """
    Validate all rows in a pandas DataFrame.
    Returns (valid_rows, invalid_rows, all_results)
    """
    valid_rows = []
    invalid_rows = []
    all_results = []

    for index, row in df.iterrows():
        row_dict = row.where(row.notna(), None).to_dict()
        result = validate_temple_row(row_dict, index)
        all_results.append(result)

        if result.is_valid:
            valid_rows.append(row_dict)
        else:
            invalid_rows.append((index, row_dict, result.errors))

    return valid_rows, invalid_rows, all_results