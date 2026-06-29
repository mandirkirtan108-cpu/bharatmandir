from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.divineapi_client import (
    DEFAULT_CALENDAR,
    DEFAULT_COORDINATES,
    DEFAULT_LANGUAGE,
    DEFAULT_PLACE,
    PanchangQuery,
    DivineApiClient,
    DivineApiConfigError,
    DivineApiError,
)


router = APIRouter(prefix="/api/panchang", tags=["Panchang"])


CITY_COORDINATES = {
    "india": DEFAULT_COORDINATES,
    "delhi": "28.6139,77.2090",
    "new delhi": "28.6139,77.2090",
    "ujjain": "23.1765,75.7885",
    "varanasi": "25.3176,82.9739",
    "kashi": "25.3176,82.9739",
    "mumbai": "19.0760,72.8777",
    "pune": "18.5204,73.8567",
    "kolkata": "22.5726,88.3639",
    "chennai": "13.0827,80.2707",
    "bengaluru": "12.9716,77.5946",
    "bangalore": "12.9716,77.5946",
    "hyderabad": "17.3850,78.4867",
    "ahmedabad": "23.0225,72.5714",
    "jaipur": "26.9124,75.7873",
    "haridwar": "29.9457,78.1642",
    "ayodhya": "26.7922,82.1998",
    "mathura": "27.4924,77.6737",
    "vrindavan": "27.5650,77.6593",
}


class DailyPanchangRequest(BaseModel):
    date: str
    city: Optional[str] = "India"
    coordinates: Optional[str] = None
    language: Optional[str] = DEFAULT_LANGUAGE
    calendar: Optional[str] = DEFAULT_CALENDAR
    refresh: Optional[bool] = False


class MuhuratRequest(BaseModel):
    muhurat_type: str
    muhurat_label: str
    muhurat_hindi: str
    date: str
    name: Optional[str] = ""
    rashi: Optional[str] = ""
    city: Optional[str] = "India"
    coordinates: Optional[str] = None
    language: Optional[str] = DEFAULT_LANGUAGE
    calendar: Optional[str] = DEFAULT_CALENDAR
    refresh: Optional[bool] = False


def divineapi() -> DivineApiClient:
    try:
        return DivineApiClient()
    except DivineApiConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def query_for(
    date_value: str,
    coordinates: Optional[str],
    language: str = DEFAULT_LANGUAGE,
    calendar: str = DEFAULT_CALENDAR,
    place: str = DEFAULT_PLACE,
) -> PanchangQuery:
    validate_date(date_value)
    return PanchangQuery(
        date=date_value,
        coordinates=coordinates or DEFAULT_COORDINATES,
        language=language or DEFAULT_LANGUAGE,
        calendar=calendar or DEFAULT_CALENDAR,
        place=place or DEFAULT_PLACE,
    )


def resolve_coordinates(city: Optional[str], coordinates: Optional[str]) -> str:
    if coordinates:
        return coordinates
    city_key = (city or "India").strip().lower()
    return CITY_COORDINATES.get(city_key, DEFAULT_COORDINATES)


def resolve_place(city: Optional[str]) -> str:
    city_value = (city or "").strip()
    if not city_value or city_value.lower() == "india":
        return DEFAULT_PLACE
    return city_value


def validate_date(date_value: str) -> None:
    try:
        datetime.strptime(date_value, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="date must be in YYYY-MM-DD format") from exc


def call_divineapi(fn):
    try:
        return fn(divineapi())
    except DivineApiError as exc:
        status_code = exc.status_code if exc.status_code and exc.status_code >= 400 else 502
        raise HTTPException(status_code=status_code, detail={"message": str(exc), "upstream": exc.payload}) from exc


@router.get("/day")
def get_panchang_day(
    date: str = Query(..., description="YYYY-MM-DD"),
    coordinates: str = Query(DEFAULT_COORDINATES, description="latitude,longitude"),
    language: str = Query(DEFAULT_LANGUAGE),
    calendar: str = Query(DEFAULT_CALENDAR),
    refresh: bool = Query(False, description="Set true only from backend/admin tools to fetch DivineAPI and update cache"),
):
    query = query_for(date, coordinates, language, calendar)
    return call_divineapi(lambda api: api.get_day(query, force_refresh=refresh, cache_only=not refresh))


@router.get("/month")
def get_panchang_month(
    year: int = Query(..., ge=1900, le=2100),
    month: int = Query(..., ge=1, le=12),
    coordinates: str = Query(DEFAULT_COORDINATES, description="latitude,longitude"),
    language: str = Query(DEFAULT_LANGUAGE),
    calendar: str = Query(DEFAULT_CALENDAR),
    refresh: bool = Query(False, description="Set true only from backend/admin tools to fetch DivineAPI and update cache"),
):
    return call_divineapi(lambda api: api.get_month(year, month, coordinates, language, calendar, cache_only=not refresh))


@router.get("/year")
def get_panchang_year(
    year: int = Query(..., ge=1900, le=2100),
    coordinates: str = Query(DEFAULT_COORDINATES, description="latitude,longitude"),
    language: str = Query(DEFAULT_LANGUAGE),
    calendar: str = Query(DEFAULT_CALENDAR),
    refresh: bool = Query(False, description="Set true only from backend/admin tools to fetch DivineAPI and update cache"),
):
    return call_divineapi(lambda api: api.get_year(year, coordinates, language, calendar, cache_only=not refresh))


@router.post("/daily")
def get_daily_panchang(req: DailyPanchangRequest):
    query = query_for(
        req.date,
        resolve_coordinates(req.city, req.coordinates),
        req.language or DEFAULT_LANGUAGE,
        req.calendar or DEFAULT_CALENDAR,
        resolve_place(req.city),
    )
    day = call_divineapi(lambda api: api.get_day(query, force_refresh=bool(req.refresh), cache_only=not bool(req.refresh)))
    return legacy_daily_response(day)


@router.post("/muhurat")
def get_muhurat(req: MuhuratRequest):
    query = query_for(
        req.date,
        resolve_coordinates(req.city, req.coordinates),
        req.language or DEFAULT_LANGUAGE,
        req.calendar or DEFAULT_CALENDAR,
        resolve_place(req.city),
    )
    day = call_divineapi(lambda api: api.get_day(query, force_refresh=bool(req.refresh), cache_only=not bool(req.refresh)))
    return {
        "verdict": "good",
        "verdict_reason": "This recommendation is based on DivineAPI auspicious and inauspicious periods for the selected date and location.",
        "pandit_message": f"For {req.muhurat_label}, prefer the listed auspicious periods and avoid Rahu Kaal, Yamaganda, Gulika, Dur Muhurat and Varjyam.",
        "auspicious_timings": [
            {
                "time": format_period(period),
                "quality": period.get("name", "Auspicious"),
                "reason": period.get("type", "Auspicious"),
            }
            for item in day.get("auspicious_period", [])
            for period in item.get("period", [])
        ],
        "timings_to_avoid": [
            {
                "time": format_period(period),
                "reason": item.get("name", "Inauspicious period"),
            }
            for item in day.get("inauspicious_period", [])
            for period in item.get("period", [])
        ],
        "tithi_today": {
            "name": day.get("tithi", {}).get("name", ""),
            "is_auspicious_for_this_muhurat": True,
            "reason": day.get("tithi", {}).get("paksha", ""),
        },
        "nakshatra_today": {
            "name": day.get("nakshatra", {}).get("name", ""),
            "is_auspicious_for_this_muhurat": True,
            "reason": (day.get("nakshatra", {}).get("lord") or {}).get("name", ""),
        },
        "rituals_recommended": ["Begin with Ganesh vandana", "Offer deepam and flowers", "Consult temple priest for ceremony-specific sankalp"],
        "mantras": [],
        "special_notes": ["Data is calculated by DivineAPI for the configured coordinates.", "Panchang values change by location."],
        "alternative_dates": [],
        "source": "divineapi",
    }


def legacy_daily_response(day: dict) -> dict:
    return {
        "source": "divineapi",
        "date": day.get("date"),
        "hindu_calendar": day.get("hindu_calendar", {}),
        "tithi": {
            "name": day.get("tithi", {}).get("name", ""),
            "number": day.get("tithi", {}).get("id", ""),
            "deity": "",
            "nature": day.get("tithi", {}).get("paksha", ""),
        },
        "nakshatra": {
            "name": day.get("nakshatra", {}).get("name", ""),
            "hindi": day.get("nakshatra", {}).get("name", ""),
            "lord": (day.get("nakshatra", {}).get("lord") or {}).get("name", ""),
            "quality": "",
        },
        "yoga": {"name": day.get("yoga", {}).get("name", ""), "nature": "", "meaning": ""},
        "karana": {"name": day.get("karana", {}).get("name", ""), "nature": ""},
        "var": {"day": day.get("vaara", ""), "lord": "", "color": "", "good_for": ""},
        "rahu_kaal": {"time": find_period(day.get("inauspicious_period", []), "Rahu")},
        "brahma_muhurat": {"time": find_period(day.get("auspicious_period", []), "Brahma"), "benefit": "Spiritual practice"},
        "abhijit_muhurat": {"time": find_period(day.get("auspicious_period", []), "Abhijit"), "benefit": "Auspicious work"},
        "choghadiya": [
            {"time": format_period(item), "name": item.get("name", ""), "nature": item.get("type", ""), "good_for": ""}
            for item in day.get("choghadiya", [])
        ],
        "overall_day": "good",
        "pandit_blessings": "May your day begin with clarity, devotion and auspicious intention.",
        "do_today": ["Use the listed shubh periods", "Check tithi and nakshatra before major rituals"],
        "avoid_today": ["Avoid inauspicious periods for new beginnings", "Do not use this as a substitute for priest guidance for major samskaras"],
        "raw": day,
    }


def find_period(items: list[dict], name_part: str) -> str:
    for item in items:
        if name_part.lower() in item.get("name", "").lower():
            periods = item.get("period", [])
            if periods:
                return format_period(periods[0])
    return ""


def format_period(period: dict) -> str:
    start = period.get("start")
    end = period.get("end")
    if not start or not end:
        return ""
    return f"{format_time(start)} - {format_time(end)}"


def format_time(value: str) -> str:
    try:
        return datetime.fromisoformat(value).strftime("%I:%M %p").lstrip("0")
    except Exception:
        return value
