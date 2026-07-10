"""
routers/panchang.py - Panchang and Muhurat API.

Daily Panchang uses Divine API.
Muhurat Finder is intentionally kept on the existing Claude flow for now.
"""

from __future__ import annotations

from datetime import datetime
import json
import os
from typing import Any, Optional

import anthropic
import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/api/panchang", tags=["Panchang"])

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

CITY_COORDINATES = {
    "india": (23.1765, 75.7885, 5.5, "Ujjain, India"),
    "ujjain": (23.1765, 75.7885, 5.5, "Ujjain, Madhya Pradesh, India"),
    "varanasi": (25.3176, 82.9739, 5.5, "Varanasi, Uttar Pradesh, India"),
    "kashi": (25.3176, 82.9739, 5.5, "Varanasi, Uttar Pradesh, India"),
    "delhi": (28.6139, 77.2090, 5.5, "Delhi, India"),
    "new delhi": (28.6139, 77.2090, 5.5, "New Delhi, India"),
    "mumbai": (19.0760, 72.8777, 5.5, "Mumbai, Maharashtra, India"),
    "pune": (18.5204, 73.8567, 5.5, "Pune, Maharashtra, India"),
    "nashik": (19.9975, 73.7898, 5.5, "Nashik, Maharashtra, India"),
    "ahmedabad": (23.0225, 72.5714, 5.5, "Ahmedabad, Gujarat, India"),
    "jaipur": (26.9124, 75.7873, 5.5, "Jaipur, Rajasthan, India"),
    "mathura": (27.4924, 77.6737, 5.5, "Mathura, Uttar Pradesh, India"),
    "vrindavan": (27.5650, 77.6593, 5.5, "Vrindavan, Uttar Pradesh, India"),
    "ayodhya": (26.7922, 82.1998, 5.5, "Ayodhya, Uttar Pradesh, India"),
    "haridwar": (29.9457, 78.1642, 5.5, "Haridwar, Uttarakhand, India"),
    "rishikesh": (30.0869, 78.2676, 5.5, "Rishikesh, Uttarakhand, India"),
    "kolkata": (22.5726, 88.3639, 5.5, "Kolkata, West Bengal, India"),
    "chennai": (13.0827, 80.2707, 5.5, "Chennai, Tamil Nadu, India"),
    "bengaluru": (12.9716, 77.5946, 5.5, "Bengaluru, Karnataka, India"),
    "bangalore": (12.9716, 77.5946, 5.5, "Bengaluru, Karnataka, India"),
    "hyderabad": (17.3850, 78.4867, 5.5, "Hyderabad, Telangana, India"),
    "lucknow": (26.8467, 80.9462, 5.5, "Lucknow, Uttar Pradesh, India"),
    "bhopal": (23.2599, 77.4126, 5.5, "Bhopal, Madhya Pradesh, India"),
    "indore": (22.7196, 75.8577, 5.5, "Indore, Madhya Pradesh, India"),
}

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


class DailyPanchangRequest(BaseModel):
    date: str
    city: Optional[str] = "India"
    coordinates: Optional[str] = None
    calendar: Optional[str] = "amanta"
    language: Optional[str] = "en"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[float] = None


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


def normalize_city(req: DailyPanchangRequest) -> tuple[float, float, float, str]:
    """Resolves the request's city/coordinates into (lat, lon, tz, place).

    FIX: previously, any city string that wasn't one of the ~22 hardcoded
    entries in CITY_COORDINATES silently fell back to Ujjain's coordinates
    and STILL returned a full Panchang — so typing "tanisha" or any other
    garbage text produced a complete (wrong) Panchang instead of an error.
    That silent fallback is now removed. Unrecognized city text raises a
    422 with a clear message instead of pretending it resolved to a real
    place. Explicit coordinates/lat+lon (e.g. from a map/autocomplete
    picker) are still accepted directly and are NOT affected by this check,
    since those are already verified locations, not free-text guesses.
    """
    if req.coordinates:
        try:
            lat_text, lon_text = [part.strip() for part in req.coordinates.split(",", 1)]
            return (
                float(lat_text),
                float(lon_text),
                req.timezone if req.timezone is not None else 5.5,
                req.city or "Selected location",
            )
        except Exception as exc:
            raise HTTPException(status_code=422, detail="coordinates must be 'lat,lon'") from exc

    if req.latitude is not None and req.longitude is not None:
        return (
            req.latitude,
            req.longitude,
            req.timezone if req.timezone is not None else 5.5,
            req.city or "Selected location",
        )

    city = (req.city or "").strip()
    if not city:
        raise HTTPException(status_code=422, detail="Please enter a city.")

    city_key = city.lower()
    if city_key in CITY_COORDINATES:
        return CITY_COORDINATES[city_key]

    # FIX: unrecognized city text no longer silently falls back to Ujjain.
    # Divine API needs real coordinates, and a free-text city we can't
    # resolve isn't a safe guess — better to tell the user clearly than to
    # hand back Panchang data for the wrong place.
    raise HTTPException(
        status_code=422,
        detail=(
            f"'{city}' is not a recognized city. Please pick a city from the "
            "suggestions, or select it on the map."
        ),
    )


def first_env_value(names: tuple[str, ...]) -> tuple[Optional[str], Optional[str]]:
    for name in names:
        value = os.environ.get(name)
        if value and value.strip():
            return value.strip(), name
    return None, None


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