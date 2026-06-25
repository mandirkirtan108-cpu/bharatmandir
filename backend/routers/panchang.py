from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from services.prokerala_client import (
    DEFAULT_CALENDAR,
    DEFAULT_COORDINATES,
    DEFAULT_LANGUAGE,
    PanchangQuery,
    ProkeralaApiError,
    ProkeralaClient,
    ProkeralaConfigError,
)


router = APIRouter(prefix="/api/panchang", tags=["Panchang"])


class DailyPanchangRequest(BaseModel):
    date: str
    city: Optional[str] = "India"
    coordinates: Optional[str] = None
    language: Optional[str] = DEFAULT_LANGUAGE
    calendar: Optional[str] = DEFAULT_CALENDAR


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


def prokerala() -> ProkeralaClient:
    try:
        return ProkeralaClient()
    except ProkeralaConfigError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def query_for(date_value: str, coordinates: Optional[str], language: str = DEFAULT_LANGUAGE, calendar: str = DEFAULT_CALENDAR) -> PanchangQuery:
    validate_date(date_value)
    return PanchangQuery(
        date=date_value,
        coordinates=coordinates or DEFAULT_COORDINATES,
        language=language or DEFAULT_LANGUAGE,
        calendar=calendar or DEFAULT_CALENDAR,
    )


def validate_date(date_value: str) -> None:
    try:
        datetime.strptime(date_value, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="date must be in YYYY-MM-DD format") from exc


def call_prokerala(fn):
    try:
        return fn(prokerala())
    except ProkeralaApiError as exc:
        status_code = exc.status_code if exc.status_code and exc.status_code >= 400 else 502
        raise HTTPException(status_code=status_code, detail={"message": str(exc), "upstream": exc.payload}) from exc


@router.get("/day")
def get_panchang_day(
    date: str = Query(..., description="YYYY-MM-DD"),
    coordinates: str = Query(DEFAULT_COORDINATES, description="latitude,longitude"),
    language: str = Query(DEFAULT_LANGUAGE),
    calendar: str = Query(DEFAULT_CALENDAR),
):
    query = query_for(date, coordinates, language, calendar)
    return call_prokerala(lambda api: api.get_day(query))


@router.get("/month")
def get_panchang_month(
    year: int = Query(..., ge=1900, le=2100),
    month: int = Query(..., ge=1, le=12),
    coordinates: str = Query(DEFAULT_COORDINATES, description="latitude,longitude"),
    language: str = Query(DEFAULT_LANGUAGE),
    calendar: str = Query(DEFAULT_CALENDAR),
):
    return call_prokerala(lambda api: api.get_month(year, month, coordinates, language, calendar))


@router.get("/year")
def get_panchang_year(
    year: int = Query(..., ge=1900, le=2100),
    coordinates: str = Query(DEFAULT_COORDINATES, description="latitude,longitude"),
    language: str = Query(DEFAULT_LANGUAGE),
    calendar: str = Query(DEFAULT_CALENDAR),
):
    return call_prokerala(lambda api: api.get_year(year, coordinates, language, calendar))


@router.post("/daily")
def get_daily_panchang(req: DailyPanchangRequest):
    query = query_for(req.date, req.coordinates, req.language or DEFAULT_LANGUAGE, req.calendar or DEFAULT_CALENDAR)
    day = call_prokerala(lambda api: api.get_day(query))
    return legacy_daily_response(day)


@router.post("/muhurat")
def get_muhurat(req: MuhuratRequest):
    query = query_for(req.date, req.coordinates, req.language or DEFAULT_LANGUAGE, req.calendar or DEFAULT_CALENDAR)
    day = call_prokerala(lambda api: api.get_day(query))
    return {
        "verdict": "good",
        "verdict_reason": "This recommendation is based on Prokerala auspicious and inauspicious periods for the selected date and location.",
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
        "special_notes": ["Data is calculated by Prokerala for the configured coordinates.", "Panchang values change by location."],
        "alternative_dates": [],
        "source": "prokerala",
    }


def legacy_daily_response(day: dict) -> dict:
    return {
        "source": "prokerala",
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
