"""
routers/panchang.py - Panchang and Muhurat API.

Daily Panchang uses Divine API.
Muhurat Finder is intentionally kept on the existing Claude flow for now.
City resolution AND city autocomplete both use OpenRouteService's Geocoding
API (restricted to India) — no hardcoded city list. See geocode_city() and
get_city_suggestions() below.
"""

from __future__ import annotations

import calendar as calendar_module
from datetime import date, datetime, timedelta
from functools import lru_cache
import json
import os
import re
from typing import Any, Optional

import anthropic
import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

try:
    from db.panchang_cache import (
        get_cached_panchang,
        get_cached_panchang_month,
        save_cached_panchang,
    )
except Exception:
    get_cached_panchang = None
    get_cached_panchang_month = None
    save_cached_panchang = None

router = APIRouter(prefix="/api/panchang", tags=["Panchang"])

PANCHANG_CACHE_VERSION = int(os.getenv("PANCHANG_CACHE_VERSION", "1"))

DIVINE_BASES = {
    "panchang": "https://astroapi-1.divineapi.com/indian-api/v2/find-panchang",
    "choghadiya": "https://astroapi-2.divineapi.com/indian-api/v1/find-choghadiya",
    "auspicious": "https://astroapi-3.divineapi.com/indian-api/v1/auspicious-timings",
    "inauspicious": "https://astroapi-3.divineapi.com/indian-api/v1/inauspicious-timings",
    # FIX: added. This is the correct endpoint for "every Hindu festival in a
    # Gregorian month" — DivineAPI's own docs call it the flagship festival
    # endpoint. It takes YEAR + MONTH (not day), unlike the panchang/
    # choghadiya/timings endpoints above which are per-day. See
    # divine_api_client.py for the fuller explanation of why the previously
    # used "date-specific-festivals" endpoint never actually worked (it has
    # no day/month parameter at all).
    "festivals": "https://astroapi-3.divineapi.com/indian-api/v1/english-calendar-festivals",
}

# FIX: the old hardcoded CITY_COORDINATES table (~22 cities) is gone. Any
# city not in that list — including real ones like Surat or Kanpur — used
# to silently fall back to Ujjain's coordinates and still return a full
# Panchang. City resolution now always goes through OpenRouteService's
# Geocoding API (see geocode_city() below), the same way city input is
# already verified elsewhere in the app (Route Planner's autocomplete).

DAY_LORDS = {
    "Monday": "Chandra (Moon)",
    "Tuesday": "Mangal (Mars)",
    "Wednesday": "Budha (Mercury)",
    "Thursday": "Guru (Jupiter)",
    "Friday": "Shukra (Venus)",
    "Saturday": "Shani (Saturn)",
    "Sunday": "Surya (Sun)",
}

DIVINE_API_KEY_ENV_NAMES = (
    "DIVINE_API_KEY",
    "DIVINEAPI_API_KEY",
    "DIVINE_API_API_KEY",
)

DIVINE_ACCESS_TOKEN_ENV_NAMES = (
    "DIVINE_API_TOKEN",
    "DIVINE_API_ACCESS_TOKEN",
    "DIVINE_ACCESS_TOKEN",
    "DIVINEAPI_ACCESS_TOKEN",
    "DIVINEAPI_TOKEN",
    "DIVINE_API_BEARER_TOKEN",
    "DIVINE_API_AUTH_TOKEN",
)

# Same env-name-fallback pattern as the Divine API keys above, so this
# reuses whichever OpenRouteService key name is already set elsewhere in
# the app, without forcing a rename.
ORS_API_KEY_ENV_NAMES = (
    "ORS_API_KEY",
    "OPENROUTESERVICE_API_KEY",
    "OPEN_ROUTE_SERVICE_API_KEY",
    "OPENROUTE_API_KEY",
)

ORS_GEOCODE_URL = "https://api.openrouteservice.org/geocode/search"

# FIX: added. ORS ships a dedicated /geocode/autocomplete endpoint that is
# tuned for "as-you-type" partial matches (unlike /geocode/search, which is
# tuned for a single, final, fully-typed address). This backs the new
# /city-suggestions endpoint below, which powers the dropdown in the
# frontend's CityAutocomplete component.
ORS_AUTOCOMPLETE_URL = "https://api.openrouteservice.org/geocode/autocomplete"

# Every city this endpoint resolves is restricted to India (boundary.country
# filter below), and all of India sits in a single timezone — this is a
# fixed geographic fact, not a per-city hardcode, so it's safe to use as
# the default whenever the caller doesn't explicitly pass one.
INDIA_TZ_OFFSET = 5.5


class DailyPanchangRequest(BaseModel):
    date: str
    city: Optional[str] = "India"
    coordinates: Optional[str] = None
    calendar: Optional[str] = "amanta"
    language: Optional[str] = "en"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[float] = None


class CalendarYearSeedRequest(BaseModel):
    year: int
    city: Optional[str] = "India"
    coordinates: Optional[str] = None
    calendar: Optional[str] = "amanta"
    language: Optional[str] = "en"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[float] = None
    overwrite: bool = False


class CalendarMonthSeedRequest(CalendarYearSeedRequest):
    month: int


class MuhuratRequest(BaseModel):
    muhurat_type: str
    muhurat_label: str 
    muhurat_hindi: str
    date: str
    name: Optional[str] = ""
    rashi: Optional[str] = ""
    city: Optional[str] = "India"


def pick(data: Any, *keys: str, default: Any = None) -> Any:
    current = data
    for key in keys:
        if not isinstance(current, dict) or key not in current:
            return default
        current = current[key]
    return current


def as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [value]


def first_record(value: Any) -> dict[str, Any]:
    items = as_list(value)
    return items[0] if items and isinstance(items[0], dict) else {}


def display_name(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (str, int, float)):
        return str(value)
    if isinstance(value, dict):
        for key in (
            "name",
            "full_name",
            "tithi",
            "tithi_name",
            "nak_name",
            "nakshatra_name",
            "yoga_name",
            "karana_name",
            "karna_name",
            "type",
            "title",
            "number",
        ):
            if value.get(key):
                return str(value[key])
        return " / ".join(str(v) for v in value.values() if isinstance(v, (str, int, float)))
    return str(value)


def time_range(value: Any) -> str:
    if isinstance(value, list):
        first = first_record(value)
        return time_range(first) if first else ""
    if not isinstance(value, dict):
        return display_name(value)
    start = value.get("start_time") or value.get("start") or value.get("from") or value.get("startTime")
    end = value.get("end_time") or value.get("end") or value.get("to") or value.get("endTime")
    if start and end:
        return f"{start} - {end}"
    return display_name(value)


def label(value: str) -> str:
    return str(value or "").replace("_", " ").strip().title()


def flatten_english_calendar_festivals(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Flattens the English Calendar Festivals response into a flat list:
    {name, slug, date, image, tradition, parana}.

    Two shapes exist per slug in the raw response:
      - Plain:            "diwali": {"date": "...", "image": "..."}
      - Tradition-nested:  "utpanna_ekadashi": {
            "smartas":   {"date": "...", "parana": {...}, "image": "..."},
            "vaishnavas": {"date": "...", "parana": {...}, "image": "..."},
        }
    Tradition-nested entries (mostly Ekadashi/Pradosh vrats) produce one row
    PER tradition variant, since Smarta and Vaishnava observances commonly
    fall on different dates and both should be visible on the calendar.
    """
    festivals: list[dict[str, Any]] = []
    if not isinstance(data, dict):
        return festivals

    for slug, value in data.items():
        if slug in {"year", "success", "status"} or not isinstance(value, dict):
            continue

        if "date" in value:
            festivals.append(
                {
                    "name": label(slug),
                    "slug": slug,
                    "date": value.get("date"),
                    "image": value.get("image"),
                    "tradition": None,
                    "parana": value.get("parana"),
                }
            )
            continue

        for tradition, variant in value.items():
            if not isinstance(variant, dict) or "date" not in variant:
                continue
            festivals.append(
                {
                    "name": label(slug),
                    "slug": slug,
                    "date": variant.get("date"),
                    "image": variant.get("image"),
                    "tradition": label(tradition),
                    "parana": variant.get("parana"),
                }
            )

    return festivals


def first_env_value(names: tuple[str, ...]) -> tuple[Optional[str], Optional[str]]:
    for name in names:
        value = os.environ.get(name)
        if value and value.strip():
            return value.strip(), name
    return None, None


def ors_api_key() -> str:
    key, _used_name = first_env_value(ORS_API_KEY_ENV_NAMES)
    if not key:
        raise HTTPException(
            status_code=500,
            detail=(
                "OpenRouteService API key is not configured on server. "
                f"Set one of: {', '.join(ORS_API_KEY_ENV_NAMES)}"
            ),
        )
    return key


VALID_CITY_LAYERS = {
    "locality",
    "localadmin",
    "county",
    "macrocounty",
    "region",
    "macroregion",
    "borough",
}

# FIX: added. Autocomplete (used for the dropdown-while-typing UX) is
# intentionally more permissive than VALID_CITY_LAYERS above, which is used
# by geocode_city() to validate a FINAL submitted value. Suggestions like
# "Mandsaur Fort" or "Mandsaur Nai Abadi" come back on layers such as
# "venue" or "street" — useful to show as options, but not something we'd
# want geocode_city() silently accepting as "the city" once selected and
# resubmitted. Selecting a suggestion re-sends its full label text through
# the normal /daily or /muhurat flow, which re-resolves it via
# geocode_city() using the stricter layer set.
VALID_SUGGESTION_LAYERS = VALID_CITY_LAYERS | {
    "venue",
    "street",
    "neighbourhood",
    "borough",
    "address",
}


def normalize_place_text(value: Any) -> str:
    return re.sub(r"[^a-z0-9]+", "", str(value or "").lower())


def invalid_city_error(city: str) -> HTTPException:
    return HTTPException(
        status_code=422,
        detail=f"'{city}' is not a recognized Indian city. Please check the spelling or pick a city suggestion.",
    )


def is_india_feature(properties: dict[str, Any]) -> bool:
    country_values = [
        properties.get("country_a"),
        properties.get("country_code"),
        properties.get("country"),
    ]
    normalized = {str(value or "").strip().lower() for value in country_values if value}
    return not normalized or bool(normalized & {"ind", "in", "india"})


def is_city_like_feature(city: str, feature: dict[str, Any]) -> bool:
    properties = feature.get("properties") or {}
    layer = str(properties.get("layer") or "").lower()
    if layer not in VALID_CITY_LAYERS:
        return False
    if not is_india_feature(properties):
        return False

    query = normalize_place_text(city)
    if len(query) < 3:
        return False

    label = properties.get("label") or ""
    label_head = str(label).split(",", 1)[0]
    candidates = {
        properties.get("name"),
        properties.get("locality"),
        properties.get("localadmin"),
        properties.get("county"),
        properties.get("region"),
        label_head,
    }
    candidate_values = {normalize_place_text(value) for value in candidates if value}
    if query in candidate_values:
        return True

    # Allows inputs like "Varanasi UP" or "New Delhi India" while still
    # rejecting fuzzy POI/street matches such as a random "Anurag..." result.
    return any(candidate and len(candidate) >= 4 and query.startswith(candidate) for candidate in candidate_values)


@lru_cache(maxsize=1024)
def geocode_city(city: str) -> tuple[float, float, str]:
    """Resolves free-text city input to (lat, lon, formatted_place) using
    OpenRouteService's Geocoding API (Pelias-based /geocode/search),
    restricted to India via boundary.country=IN.

    This is the single source of truth for "is this a real city" — there is
    no local list to fall back to. Unrecognized text (typos, gibberish,
    non-Indian places) raises a 422 instead of silently resolving to
    anything. Results are memoized per exact input string for the life of
    the process, since a city's coordinates don't change and this avoids
    re-hitting ORS for repeat lookups (e.g. "Mumbai" typed by many users,
    or the same user re-fetching the same date).
    """
    city = city.strip()
    try:
        response = requests.get(
            ORS_GEOCODE_URL,
            params={
                "api_key": ors_api_key(),
                "text": city,
                "boundary.country": "IN",
                "size": 5,
            },
            timeout=15,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"OpenRouteService request failed: {exc}") from exc

    if response.status_code >= 400:
        detail = response.text[:500] or response.reason
        raise HTTPException(
            status_code=502,
            detail=f"OpenRouteService geocoding error {response.status_code}: {detail}",
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="OpenRouteService returned non-JSON data") from exc

    features = payload.get("features") or []
    if not features:
        raise invalid_city_error(city)

    top = next((feature for feature in features if is_city_like_feature(city, feature)), None)
    if not top:
        raise invalid_city_error(city)

    coordinates = pick(top, "geometry", "coordinates", default=None)
    if not coordinates or len(coordinates) < 2:
        raise HTTPException(status_code=502, detail="OpenRouteService returned an incomplete location.")

    # GeoJSON order is [lon, lat], not [lat, lon].
    lon, lat = coordinates[0], coordinates[1]

    properties = top.get("properties") or {}
    formatted_place = properties.get("label") or city

    return float(lat), float(lon), formatted_place


def normalize_city(req: DailyPanchangRequest) -> tuple[float, float, float, str]:
    """Resolves the request's city/coordinates into (lat, lon, tz, place).

    Explicit coordinates or lat+lon (e.g. from a map/autocomplete picker
    the frontend already trusts) are accepted directly — those are already
    verified locations. Free-text city input goes through geocode_city(),
    which is backed by OpenRouteService's Geocoding API rather than any
    local list, so unrecognized text raises a clear error instead of
    resolving to the wrong place.
    """
    if req.coordinates:
        try:
            lat_text, lon_text = [part.strip() for part in req.coordinates.split(",", 1)]
            return (
                float(lat_text),
                float(lon_text),
                req.timezone if req.timezone is not None else INDIA_TZ_OFFSET,
                req.city or "Selected location",
            )
        except Exception as exc:
            raise HTTPException(status_code=422, detail="coordinates must be 'lat,lon'") from exc

    if req.latitude is not None and req.longitude is not None:
        return (
            req.latitude,
            req.longitude,
            req.timezone if req.timezone is not None else INDIA_TZ_OFFSET,
            req.city or "Selected location",
        )

    city = (req.city or "").strip()
    if not city:
        raise HTTPException(status_code=422, detail="Please enter a city.")

    lat, lon, formatted_place = geocode_city(city)
    tz = req.timezone if req.timezone is not None else INDIA_TZ_OFFSET
    return lat, lon, tz, formatted_place


def coordinates_text(lat: float, lon: float) -> str:
    return f"{float(lat):.4f},{float(lon):.4f}"


def get_cached_day(date_value: str, coordinates: str, calendar_type: str, language: str) -> Optional[dict[str, Any]]:
    if not get_cached_panchang:
        return None
    try:
        return get_cached_panchang(date_value, coordinates, calendar_type, language, PANCHANG_CACHE_VERSION)
    except Exception:
        return None


def get_cached_month_days(
    year: int,
    month: int,
    coordinates: str,
    calendar_type: str,
    language: str,
) -> dict[str, dict[str, Any]]:
    if not get_cached_panchang_month:
        return {}
    try:
        start_date = f"{year}-{month:02d}-01"
        end_date = f"{year}-{month:02d}-{calendar_module.monthrange(year, month)[1]:02d}"
        return get_cached_panchang_month(
            start_date,
            end_date,
            coordinates,
            calendar_type,
            language,
            PANCHANG_CACHE_VERSION,
        )
    except Exception:
        return {}


def save_day_cache(date_value: str, coordinates: str, calendar_type: str, language: str, payload: dict[str, Any]) -> None:
    if not save_cached_panchang:
        raise HTTPException(status_code=500, detail="panchang_cache database helper is not available")
    save_cached_panchang(
        date_value,
        coordinates,
        calendar_type,
        language,
        PANCHANG_CACHE_VERSION,
        payload,
    )


def divine_token() -> str:
    token, _used_name = first_env_value(DIVINE_ACCESS_TOKEN_ENV_NAMES)
    if not token:
        raise HTTPException(
            status_code=500,
            detail=(
                "Divine API access token is not configured on server. "
                f"Set one of: {', '.join(DIVINE_ACCESS_TOKEN_ENV_NAMES)}"
            ),
        )
    return token


def divine_api_key() -> str:
    key, _used_name = first_env_value(DIVINE_API_KEY_ENV_NAMES)
    if not key:
        raise HTTPException(
            status_code=500,
            detail=(
                "Divine API key is not configured on server. "
                f"Set one of: {', '.join(DIVINE_API_KEY_ENV_NAMES)}"
            ),
        )
    return key


def divine_post(url: str, payload: dict[str, Any]) -> dict[str, Any]:
    token = divine_token()
    try:
        response = requests.post(
            url,
            headers={"Authorization": f"Bearer {token}"},
            data=payload,
            timeout=30,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Divine API request failed: {exc}") from exc

    if response.status_code >= 400:
        detail = response.text[:500] or response.reason
        raise HTTPException(status_code=502, detail=f"Divine API error {response.status_code}: {detail}")

    try:
        return response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="Divine API returned non-JSON data") from exc


def unwrap_response(response: dict[str, Any]) -> dict[str, Any]:
    data = response.get("data", response)
    if isinstance(data, dict):
        return data
    return {"items": data}


def choghadiya_items(raw: dict[str, Any]) -> list[dict[str, Any]]:
    data = unwrap_response(raw)
    day_items = as_list(data.get("day") or data.get("day_choghadiya") or data.get("choghadiya_day") or data.get("day_time"))
    night_items = as_list(data.get("night") or data.get("night_choghadiya") or data.get("choghadiya_night") or data.get("night_time"))
    if not day_items and not night_items:
        day_items = as_list(data.get("choghadiya") or data.get("items"))

    rows: list[dict[str, Any]] = []
    for period, items in (("day", day_items), ("night", night_items)):
        for item in items:
            if not isinstance(item, dict):
                continue
            name = item.get("choghadiya") or item.get("name") or item.get("type") or item.get("muhurat")
            start = item.get("start_time") or item.get("start") or item.get("from")
            end = item.get("end_time") or item.get("end") or item.get("to")
            rows.append(
                {
                    "period": period,
                    "is_day": period == "day",
                    "name": name,
                    "time": time_range(item),
                    "start_time": start,
                    "end_time": end,
                    "start": start,
                    "end": end,
                    "nature": classify_choghadiya(name or item.get("nature")),
                    "good_for": "Use for routine auspicious work" if classify_choghadiya(name or item.get("nature")) == "good" else "Avoid new beginnings",
                    "raw": item,
                }
            )
    return rows


def classify_choghadiya(name: Any) -> str:
    value = str(name or "").strip().lower()
    if value in {"amrit", "shubh", "labh", "char"}:
        return "good"
    if value in {"rog", "kaal", "udveg"}:
        return "bad"
    return "neutral"


def timing_entry(raw: dict[str, Any], *keys: str) -> dict[str, str]:
    for key in keys:
        value = raw.get(key)
        if isinstance(value, list):
            value = first_record(value)
        if isinstance(value, dict):
            return {"time": time_range(value), "start_time": value.get("start_time"), "end_time": value.get("end_time")}
        if isinstance(value, str):
            return {"time": value}
    return {"time": ""}


def format_optional_time(value: Any) -> str:
    if not value:
        return ""
    if isinstance(value, dict):
        return time_range(value)
    return str(value)


def find_timing(raw: dict[str, Any], *keys: str) -> str:
    entry = timing_entry(raw, *keys)
    return entry.get("time") or ""


def compact_raw(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: compact_raw(nested) for key, nested in value.items() if key != "raw"}
    if isinstance(value, list):
        return [compact_raw(item) for item in value]
    return value


def nested_records(data: Any, *keys: str) -> list[Any]:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in keys:
            value = data.get(key)
            if isinstance(value, list):
                return value
        return [data]
    return []


def primary_record(data: Any, *keys: str) -> dict[str, Any]:
    return first_record(nested_records(data, *keys))


def normalize_daily(
    req: DailyPanchangRequest,
    panchang_raw: dict[str, Any],
    choghadiya_raw: dict[str, Any],
    auspicious_raw: dict[str, Any],
    inauspicious_raw: dict[str, Any],
    festivals_for_day: list[dict[str, Any]],
    place: str,
    lat: float,
    lon: float,
    tz: float,
) -> dict[str, Any]:
    panchang = unwrap_response(panchang_raw)
    auspicious = unwrap_response(auspicious_raw)
    inauspicious = unwrap_response(inauspicious_raw)

    dt = datetime.strptime(req.date, "%Y-%m-%d")
    weekday = dt.strftime("%A")
    nakshatra_data = panchang.get("nakshatras") or panchang.get("nakshatra")
    sun_nakshatra_data = panchang.get("sun_nakshatras") or panchang.get("sun_nakshatra")

    tithi = first_record(panchang.get("tithis") or panchang.get("tithi"))
    nakshatra = primary_record(nakshatra_data, "nakshatra_pada", "nakshatra_list", "zodiac_point")
    yoga = first_record(panchang.get("yogas") or panchang.get("yoga"))
    karana = first_record(panchang.get("karnas") or panchang.get("karanas") or panchang.get("karana"))

    brahma = timing_entry(auspicious, "brahma_muhurta", "brahma_muhurat")
    abhijit = timing_entry(auspicious, "abhijit", "abhijit_muhurta", "abhijit_muhurat")
    rahu = timing_entry(inauspicious, "rahu_kaal", "rahu_kalam", "rahukaal", "rahukaalam")
    sunrise = panchang.get("sunrise") or auspicious.get("sunrise") or inauspicious.get("sunrise")
    sunset = panchang.get("sunset") or auspicious.get("sunset") or inauspicious.get("sunset")
    moonrise = panchang.get("moonrise") or panchang.get("moon_rise")
    moonset = panchang.get("moonset") or panchang.get("moon_set")
    choghadiya = choghadiya_items(choghadiya_raw)
    current_choghadiya = choghadiya[0] if choghadiya else None
    next_choghadiya = choghadiya[1] if len(choghadiya) > 1 else None

    tithi_name = display_name(tithi)
    nakshatra_name = display_name(nakshatra)
    yoga_name = display_name(yoga)
    karana_name = display_name(karana)

    festivals = [
        {
            "name": item.get("name") or "Festival",
            "slug": item.get("slug") or "",
            "date": item.get("date"),
            "start_date": item.get("date"),
            "end_date": item.get("date"),
            "image": item.get("image"),
            "tradition": item.get("tradition"),
            "parana": item.get("parana"),
        }
        for item in (festivals_for_day or [])
    ]

    return {
        "source": "divineapi",
        "date": req.date,
        "display_date": dt.strftime("%d %B %Y").lstrip("0"),
        "location": {"name": place, "latitude": lat, "longitude": lon, "timezone": tz},
        "hindu_calendar": panchang.get("hindu_calendar") or panchang.get("calendar") or {},
        "today_at_glance": (
            f"{weekday}: {tithi_name or 'Tithi not available'}, {nakshatra_name or 'Nakshatra not available'}. "
            f"Sunrise {format_optional_time(sunrise) or 'not available'}, sunset {format_optional_time(sunset) or 'not available'}."
        ),
        "tithi": {
            "name": tithi_name,
            "time": time_range(tithi),
            "paksha": tithi.get("paksha"),
            "number": tithi.get("number") or tithi.get("id"),
            "nature": tithi.get("paksha") or tithi.get("type"),
            "end_time": format_optional_time(tithi.get("end_time") or tithi.get("end")),
            "raw": tithi,
        },
        "nakshatra": {
            "name": nakshatra_name,
            "time": time_range(nakshatra),
            "lord": nakshatra.get("lord") or nakshatra.get("ruler") or nakshatra.get("deity"),
            "quality": nakshatra.get("gana") or nakshatra.get("guna") or "",
            "end_time": format_optional_time(nakshatra.get("end_time") or nakshatra.get("end")),
            "raw": nakshatra,
        },
        "yoga": {"name": yoga_name, "time": time_range(yoga), "end_time": format_optional_time(yoga.get("end_time") or yoga.get("end")), "raw": yoga},
        "karana": {"name": karana_name, "time": time_range(karana), "nature": karana.get("type") or "", "end_time": format_optional_time(karana.get("end_time") or karana.get("end")), "raw": karana},
        "var": {"day": weekday, "lord": DAY_LORDS.get(weekday, "")},
        "sunrise": sunrise,
        "sunset": sunset,
        "moonrise": moonrise,
        "moonset": moonset,
        "sun": panchang.get("sun") or {"sunrise": sunrise, "sunset": sunset},
        "moon": panchang.get("moon") or {"moonrise": moonrise, "moonset": moonset},
        "brahma_muhurat": {**brahma, "benefit": "Spiritual practice, japa, meditation and study"},
        "abhijit_muhurat": {**abhijit, "benefit": "Auspicious work and important beginnings"},
        "rahu_kaal": {**rahu, "benefit": "Avoid new auspicious beginnings"},
        "choghadiya": choghadiya,
        "current_choghadiya": current_choghadiya,
        "next_choghadiya": next_choghadiya,
        "auspicious_timings": auspicious,
        "inauspicious_timings": inauspicious,
        # FIX: festivals for this exact date, sourced from the English
        # Calendar Festivals endpoint (fetched once per month, filtered here).
        "festivals": festivals,
        "auspicious_period": [
            {
                "slug": key,
                "name": key.replace("_", " ").title(),
                "period": as_list(value),
            }
            for key, value in auspicious.items()
            if isinstance(value, (dict, list))
        ],
        "inauspicious_period": [
            {
                "slug": key,
                "name": key.replace("_", " ").title(),
                "period": as_list(value),
            }
            for key, value in inauspicious.items()
            if isinstance(value, (dict, list))
        ],
        "all_panchang": {
            "tithis": as_list(panchang.get("tithis") or panchang.get("tithi")),
            "nakshatras": nested_records(nakshatra_data, "nakshatra_list", "nakshatra_pada", "zodiac_point"),
            "sun_nakshatras": nested_records(sun_nakshatra_data, "nakshatra_list", "nakshatra_pada", "zodiac_point"),
            "yogas": as_list(panchang.get("yogas") or panchang.get("yoga")),
            "karnas": as_list(panchang.get("karnas") or panchang.get("karanas") or panchang.get("karana")),
        },
        "raw": compact_raw({
            "find_panchang": panchang_raw,
            "find_choghadiya": choghadiya_raw,
            "auspicious_timings": auspicious_raw,
            "inauspicious_timings": inauspicious_raw,
        }),
        "overall_day": "good",
        "pandit_blessings": "May your day begin with clarity, devotion and auspicious intention.",
        "do_today": [
            "Use Brahma Muhurat for prayer, meditation and mantra japa.",
            "Prefer Abhijit Muhurat or favorable Choghadiya for important work.",
            "Check Tithi, Nakshatra, Yoga and Karana together before finalizing rituals.",
        ],
        "avoid_today": [
            "Avoid starting new auspicious work during Rahu Kaal.",
            "Avoid relying on one Panchang factor alone for major ceremonies.",
        ],
    }


def fetch_calendar_day_from_divine(
    req: DailyPanchangRequest,
    month_festivals: Optional[list[dict[str, Any]]] = None,
    place: Optional[str] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    tz: Optional[float] = None,
) -> dict[str, Any]:
    try:
        parsed_date = datetime.strptime(req.date, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="date must be in YYYY-MM-DD format") from exc

    if place is None or lat is None or lon is None or tz is None:
        lat, lon, tz, place = normalize_city(req)

    language = req.language or "en"
    payload = {
        "api_key": divine_api_key(),
        "day": parsed_date.day,
        "month": parsed_date.month,
        "year": parsed_date.year,
        "place": place,
        "lat": lat,
        "lon": lon,
        "tzone": tz,
        "lan": language,
    }

    panchang_raw = divine_post(DIVINE_BASES["panchang"], payload)
    choghadiya_raw = divine_post(DIVINE_BASES["choghadiya"], payload)
    auspicious_raw = divine_post(DIVINE_BASES["auspicious"], payload)
    inauspicious_raw = divine_post(DIVINE_BASES["inauspicious"], payload)

    if month_festivals is None:
        festivals_payload = {
            "api_key": divine_api_key(),
            "year": str(parsed_date.year),
            "month": f"{parsed_date.month:02d}",
            "place": place,
            "lat": lat,
            "lon": lon,
            "tzone": tz,
        }
        try:
            festivals_raw = divine_post(DIVINE_BASES["festivals"], festivals_payload)
            month_festivals = flatten_english_calendar_festivals(festivals_raw.get("data", {}))
        except HTTPException:
            month_festivals = []

    festivals_for_day = [f for f in month_festivals if f.get("date") == req.date]
    normalized = normalize_daily(
        req,
        panchang_raw,
        choghadiya_raw,
        auspicious_raw,
        inauspicious_raw,
        festivals_for_day,
        place,
        lat,
        lon,
        tz,
    )
    normalized["calendar_type"] = req.calendar or "amanta"
    normalized["language"] = language
    return normalized


@router.get("/city-suggestions")
def get_city_suggestions(query: str):
    """Backs the frontend's live "type-ahead" dropdown (e.g. typing
    "mandsaur" and seeing "Mandsaur Fort", "Mandsaur City", etc. — all
    restricted to India).

    Uses ORS's /geocode/autocomplete, which is purpose-built for partial,
    in-progress text (unlike /geocode/search used by geocode_city(), which
    expects a complete, final value). This endpoint is intentionally
    lenient about layers (VALID_SUGGESTION_LAYERS) so useful partial
    matches aren't hidden from the dropdown — the stricter validation in
    geocode_city() still applies once the user actually submits a value,
    whether typed freely or picked from this dropdown.
    """
    query = (query or "").strip()
    if len(query) < 2:
        return {"suggestions": []}

    try:
        response = requests.get(
            ORS_AUTOCOMPLETE_URL,
            params={
                "api_key": ors_api_key(),
                "text": query,
                "boundary.country": "IN",
                "size": 8,
            },
            timeout=10,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"OpenRouteService request failed: {exc}") from exc

    if response.status_code >= 400:
        detail = response.text[:500] or response.reason
        raise HTTPException(
            status_code=502,
            detail=f"OpenRouteService autocomplete error {response.status_code}: {detail}",
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=502, detail="OpenRouteService returned non-JSON data") from exc

    features = payload.get("features") or []
    suggestions = []
    for feature in features:
        properties = feature.get("properties") or {}
        layer = str(properties.get("layer") or "").lower()
        if layer not in VALID_SUGGESTION_LAYERS:
            continue
        if not is_india_feature(properties):
            continue

        label_text = properties.get("label")
        if not label_text:
            continue

        coordinates = pick(feature, "geometry", "coordinates", default=None) or []
        lon = coordinates[0] if len(coordinates) > 0 else None
        lat = coordinates[1] if len(coordinates) > 1 else None

        suggestions.append(
            {
                "description": label_text,
                # ORS doesn't hand out a stable Google-style "place_id";
                # gid is its own permanent per-feature identifier and is
                # unique enough to key a React list on.
                "place_id": properties.get("gid"),
                "latitude": lat,
                "longitude": lon,
            }
        )

    return {"suggestions": suggestions}


@router.get("/month")
def get_panchang_month(
    year: int,
    month: int,
    city: Optional[str] = "India",
    coordinates: Optional[str] = None,
    calendar: Optional[str] = "amanta",
    language: Optional[str] = "en",
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    timezone: Optional[float] = None,
):
    """Calendar endpoint: DB-only read.

    This endpoint intentionally does NOT call DivineAPI. Run
    POST /api/panchang/calendar/seed-year once for the required year/location,
    then the frontend calendar reads the stored data from panchang_cache.
    """
    if year < 1900 or year > 2100:
        raise HTTPException(status_code=422, detail="year must be between 1900 and 2100")
    if month < 1 or month > 12:
        raise HTTPException(status_code=422, detail="month must be between 1 and 12")

    base_req = DailyPanchangRequest(
        date=f"{year}-{month:02d}-01",
        city=city,
        coordinates=coordinates,
        calendar=calendar,
        language=language,
        latitude=latitude,
        longitude=longitude,
        timezone=timezone,
    )
    lat, lon, tz, place = normalize_city(base_req)
    calendar_type = calendar or "amanta"
    language_code = language or "en"
    coordinates_key = coordinates_text(lat, lon)
    cached_days = get_cached_month_days(year, month, coordinates_key, calendar_type, language_code)

    total_days = calendar_module.monthrange(year, month)[1]
    missing_dates = [
        f"{year}-{month:02d}-{day_number:02d}"
        for day_number in range(1, total_days + 1)
        if f"{year}-{month:02d}-{day_number:02d}" not in cached_days
    ]
    if missing_dates:
        raise HTTPException(
            status_code=404,
            detail={
                "message": "Calendar data is not seeded in database for this month. Run /api/panchang/calendar/seed-year first.",
                "missing_dates": missing_dates,
            },
        )

    days = [cached_days[f"{year}-{month:02d}-{day_number:02d}"] for day_number in range(1, total_days + 1)]
    for item in days:
        item["cache"] = item.get("cache") or "database"

    first_day = days[0] if days else {}
    return {
        "status": "ok",
        "source": "database",
        "year": year,
        "month": month,
        "calendar": calendar_type,
        "language": language_code,
        "location": {"name": place, "latitude": lat, "longitude": lon, "timezone": tz},
        "hindu_calendar_meta": first_day.get("hindu_calendar") or {},
        "days": days,
    }


@router.post("/calendar/seed-month")
def seed_panchang_calendar_month(req: CalendarMonthSeedRequest):
    if req.year < 1900 or req.year > 2100:
        raise HTTPException(status_code=422, detail="year must be between 1900 and 2100")
    if req.month < 1 or req.month > 12:
        raise HTTPException(status_code=422, detail="month must be between 1 and 12")

    base_req = DailyPanchangRequest(
        date=f"{req.year}-{req.month:02d}-01",
        city=req.city,
        coordinates=req.coordinates,
        calendar=req.calendar,
        language=req.language,
        latitude=req.latitude,
        longitude=req.longitude,
        timezone=req.timezone,
    )
    lat, lon, tz, place = normalize_city(base_req)
    calendar_type = req.calendar or "amanta"
    language = req.language or "en"
    coordinates_key = coordinates_text(lat, lon)

    festivals_payload = {
        "api_key": divine_api_key(),
        "year": str(req.year),
        "month": f"{req.month:02d}",
        "place": place,
        "lat": lat,
        "lon": lon,
        "tzone": tz,
    }
    try:
        festivals_raw = divine_post(DIVINE_BASES["festivals"], festivals_payload)
        month_festivals = flatten_english_calendar_festivals(festivals_raw.get("data", {}))
    except HTTPException:
        month_festivals = []

    generated = 0
    skipped_existing = 0
    failed: list[dict[str, str]] = []
    total_days = calendar_module.monthrange(req.year, req.month)[1]

    for day_number in range(1, total_days + 1):
        date_value = f"{req.year}-{req.month:02d}-{day_number:02d}"
        if not req.overwrite and get_cached_day(date_value, coordinates_key, calendar_type, language):
            skipped_existing += 1
            continue

        day_req = DailyPanchangRequest(
            date=date_value,
            city=req.city,
            coordinates=req.coordinates,
            calendar=calendar_type,
            language=language,
            latitude=req.latitude,
            longitude=req.longitude,
            timezone=req.timezone,
        )
        try:
            normalized = fetch_calendar_day_from_divine(
                day_req,
                month_festivals,
                place,
                lat,
                lon,
                tz,
            )
            normalized["cache"] = "database"
            save_day_cache(date_value, coordinates_key, calendar_type, language, normalized)
            generated += 1
        except HTTPException as exc:
            failed.append({"date": date_value, "error": str(exc.detail)})

    return {
        "status": "ok" if not failed else "partial",
        "source": "divineapi-to-database",
        "year": req.year,
        "month": req.month,
        "calendar": calendar_type,
        "language": language,
        "location": {"name": place, "latitude": lat, "longitude": lon, "timezone": tz},
        "generated": generated,
        "skipped_existing": skipped_existing,
        "failed_count": len(failed),
        "failed": failed[:20],
        "message": "Month calendar data is stored in database. Calendar month endpoint will now read DB only.",
    }


@router.post("/calendar/seed-year")
def seed_panchang_calendar_year(req: CalendarYearSeedRequest):
    if req.year < 1900 or req.year > 2100:
        raise HTTPException(status_code=422, detail="year must be between 1900 and 2100")

    base_req = DailyPanchangRequest(
        date=f"{req.year}-01-01",
        city=req.city,
        coordinates=req.coordinates,
        calendar=req.calendar,
        language=req.language,
        latitude=req.latitude,
        longitude=req.longitude,
        timezone=req.timezone,
    )
    lat, lon, tz, place = normalize_city(base_req)
    calendar_type = req.calendar or "amanta"
    language = req.language or "en"
    coordinates_key = coordinates_text(lat, lon)

    generated = 0
    skipped_existing = 0
    failed: list[dict[str, str]] = []
    start = date(req.year, 1, 1)
    end = date(req.year, 12, 31)
    current = start
    month_festivals_by_month: dict[int, list[dict[str, Any]]] = {}

    while current <= end:
        date_value = current.isoformat()
        if not req.overwrite and get_cached_day(date_value, coordinates_key, calendar_type, language):
            skipped_existing += 1
            current += timedelta(days=1)
            continue

        if current.month not in month_festivals_by_month:
            festivals_payload = {
                "api_key": divine_api_key(),
                "year": str(req.year),
                "month": f"{current.month:02d}",
                "place": place,
                "lat": lat,
                "lon": lon,
                "tzone": tz,
            }
            try:
                festivals_raw = divine_post(DIVINE_BASES["festivals"], festivals_payload)
                month_festivals_by_month[current.month] = flatten_english_calendar_festivals(festivals_raw.get("data", {}))
            except HTTPException:
                month_festivals_by_month[current.month] = []

        day_req = DailyPanchangRequest(
            date=date_value,
            city=req.city,
            coordinates=req.coordinates,
            calendar=calendar_type,
            language=language,
            latitude=req.latitude,
            longitude=req.longitude,
            timezone=req.timezone,
        )
        try:
            normalized = fetch_calendar_day_from_divine(
                day_req,
                month_festivals_by_month[current.month],
                place,
                lat,
                lon,
                tz,
            )
            normalized["cache"] = "database"
            save_day_cache(date_value, coordinates_key, calendar_type, language, normalized)
            generated += 1
        except HTTPException as exc:
            failed.append({"date": date_value, "error": str(exc.detail)})

        current += timedelta(days=1)

    return {
        "status": "ok" if not failed else "partial",
        "source": "divineapi-to-database",
        "year": req.year,
        "calendar": calendar_type,
        "language": language,
        "location": {"name": place, "latitude": lat, "longitude": lon, "timezone": tz},
        "generated": generated,
        "skipped_existing": skipped_existing,
        "failed_count": len(failed),
        "failed": failed[:20],
        "message": "Year calendar data is stored in database. Calendar month endpoint will now read DB only.",
    }


@router.post("/daily")
def get_daily_panchang(req: DailyPanchangRequest):
    try:
        parsed_date = datetime.strptime(req.date, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="date must be in YYYY-MM-DD format") from exc

    lat, lon, tz, place = normalize_city(req)
    payload = {
        "api_key": divine_api_key(),
        "day": int(req.date[8:10]),
        "month": int(req.date[5:7]),
        "year": int(req.date[0:4]),
        "place": place,
        "lat": lat,
        "lon": lon,
        "tzone": tz,
        "lan": "en",
    }

    panchang_raw = divine_post(DIVINE_BASES["panchang"], payload)
    choghadiya_raw = divine_post(DIVINE_BASES["choghadiya"], payload)
    auspicious_raw = divine_post(DIVINE_BASES["auspicious"], payload)
    inauspicious_raw = divine_post(DIVINE_BASES["inauspicious"], payload)

    # FIX: festivals need their OWN payload — the English Calendar Festivals
    # endpoint takes {api_key, year, month, place, lat, lon, tzone}, not a
    # "day". Sending a "day" field to it (as the panchang/choghadiya/timings
    # calls do above) is harmless but meaningless; it returns every festival
    # for the whole month regardless, which we then filter down to this date.
    festivals_payload = {
        "api_key": divine_api_key(),
        "year": str(parsed_date.year),
        "month": f"{parsed_date.month:02d}",
        "place": place,
        "lat": lat,
        "lon": lon,
        "tzone": tz,
    }
    try:
        festivals_raw = divine_post(DIVINE_BASES["festivals"], festivals_payload)
        month_festivals = flatten_english_calendar_festivals(festivals_raw.get("data", {}))
    except HTTPException:
        # Don't fail the whole daily Panchang if the festival feed hiccups —
        # the rest of the day's data is still useful without it.
        month_festivals = []

    festivals_for_day = [f for f in month_festivals if f.get("date") == req.date]

    return normalize_daily(
        req,
        panchang_raw,
        choghadiya_raw,
        auspicious_raw,
        inauspicious_raw,
        festivals_for_day,
        place,
        lat,
        lon,
        tz,
    )


def get_client() -> anthropic.Anthropic:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise HTTPException(500, "ANTHROPIC_API_KEY not configured on server")
    return anthropic.Anthropic(api_key=key)


def ask_claude(prompt: str, max_tokens: int = 2500) -> dict[str, Any]:
    client = get_client()
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(500, f"Failed to parse AI response: {exc}\nRaw: {raw[:200]}") from exc


@router.post("/muhurat")
def get_muhurat(req: MuhuratRequest):
    try:
        dt = datetime.strptime(req.date, "%Y-%m-%d")
        full = dt.strftime("%d %B %Y").lstrip("0")
        day = dt.strftime("%A")
    except Exception:
        full = req.date
        day = ""

    prompt = f"""You are a highly learned Vedic pandit - expert in Muhurat Shastra and Jyotish. A devotee seeks your guidance.

QUERY:
- Muhurat for: {req.muhurat_label} ({req.muhurat_hindi})
- Date: {full} ({day})
- Person's name: {req.name or 'Not provided'}
- Rashi (Moon sign): {req.rashi or 'Not provided'}
- City: {req.city or 'India (general)'}

Analyse the tithi, nakshatra, yoga, var and planetary positions. Give a warm, authoritative pandit-style response.

Return ONLY valid JSON, no markdown, start directly with {{:
{{
  "verdict": "excellent/good/average/avoid",
  "verdict_reason": "One clear sentence why",
  "pandit_message": "Warm, wise 3-4 sentence message to the devotee as a real pandit would speak",
  "auspicious_timings": [
    {{ "time": "07:15 AM - 09:00 AM", "quality": "Shreshtha (Best)", "reason": "" }}
  ],
  "timings_to_avoid": [
    {{ "time": "", "reason": "" }}
  ],
  "tithi_today": {{ "name": "", "is_auspicious_for_this_muhurat": true, "reason": "" }},
  "nakshatra_today": {{ "name": "", "is_auspicious_for_this_muhurat": true, "reason": "" }},
  "rituals_recommended": ["ritual 1", "ritual 2", "ritual 3"],
  "mantras": [
    {{ "deity": "", "mantra": "", "chant_times": 108, "purpose": "" }}
  ],
  "special_notes": ["note 1", "note 2"],
  "alternative_dates": [ 
    {{ "date": "", "quality": "Excellent/Good", "reason": "" }}
  ]
}}"""

    return ask_claude(prompt, max_tokens=2500)