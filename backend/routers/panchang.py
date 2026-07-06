from __future__ import annotations

from datetime import datetime
from typing import List, Optional

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

# Keyed by the EXACT raw field name DivineAPI returns (see divineapi_client._normalize_periods
# "slug"), not by fuzzy text matching — some of DivineAPI's own field names are irregular
# (e.g. "gulkai_kaal" is genuinely how their API spells Gulika Kaal; "dur_muhurtam" not
# "dur_muhurat"), so matching on the exact slug is the only reliable approach.
MUHURAT_INFO = {
    "brahma_muhurta":        {"label": "Brahma Muhurat",        "reason": "Best for meditation, mantra japa and spiritual practice"},
    "abhijit_muhurta":       {"label": "Abhijit Muhurat",       "reason": "All-purpose auspicious window, good for most new beginnings"},
    "godhuli_muhurta":       {"label": "Godhuli Muhurat",       "reason": "Dusk period, traditionally favoured for Vivah rituals"},
    "vijay_muhurta":         {"label": "Vijay Muhurat",         "reason": "Favourable for undertakings related to success and victory"},
    "nishita_muhurta":       {"label": "Nishita Muhurat",       "reason": "Midnight period, used for specific spiritual rites"},
    "amrit_kalam":           {"label": "Amrit Kalam",           "reason": "Short, highly favourable nectar period"},
    "pratah_sandhya":        {"label": "Pratah Sandhya",        "reason": "Morning twilight, suited for prayer and sandhyavandanam"},
    "sayahana_sandhya":      {"label": "Sayahna Sandhya",       "reason": "Evening twilight, suited for prayer and sandhyavandanam"},
    "ravi_yoga":             {"label": "Ravi Yoga",             "reason": "Sun-blessed yoga said to neutralise other doshas in the period"},
    "sarvartha_siddhi_yoga": {"label": "Sarvartha Siddhi Yoga", "reason": "Highly auspicious yoga for success in any undertaking"},
    "amrit_siddhi_yoga":     {"label": "Amrit Siddhi Yoga",     "reason": "Rare, especially auspicious nakshatra-vaar combination"},
    "siddha_yoga":           {"label": "Siddha Yoga",           "reason": "Favourable yoga for accomplishment of tasks"},
    "tri_pushkara_yoga":     {"label": "Tri Pushkara Yoga",     "reason": "Triples the merit/effect of actions performed in this window"},
    "rahu_kaal":             {"label": "Rahu Kaal",             "reason": "Inauspicious — avoid starting new work"},
    "yamaganda":             {"label": "Yamaganda",             "reason": "Inauspicious — avoid starting new work"},
    "gulkai_kaal":           {"label": "Gulika Kaal",           "reason": "Inauspicious — avoid starting new work"},
    "dur_muhurtam":          {"label": "Dur Muhurat",           "reason": "Inauspicious window, best avoided for important events"},
    "varjyam":               {"label": "Varjyam",               "reason": "Inauspicious window, best avoided for important events"},
    "baana":                 {"label": "Baana",                 "reason": "Directional influence — check the specific sign for its effect"},
    "panchaka":               {"label": "Panchaka",              "reason": "Inauspicious 5-day span, best avoided for certain rites"},
    "hutashana_yoga":        {"label": "Hutashana Yoga",        "reason": "Considered inauspicious for new beginnings"},
    "visha_yoga":            {"label": "Visha Yoga",            "reason": "Considered inauspicious for new beginnings"},
    "yamaghata_yoga":        {"label": "Yamaghata Yoga",        "reason": "Considered inauspicious for new beginnings"},
    "dagdha_yoga":           {"label": "Dagdha Yoga",           "reason": "Considered inauspicious for new beginnings"},
    "samvartaka_yoga":       {"label": "Samvartaka Yoga",       "reason": "Considered inauspicious for new beginnings"},
    "kakracha_yoga":         {"label": "Kakracha Yoga",         "reason": "Considered inauspicious for new beginnings"},
    "mrityu_yoga":           {"label": "Mrityu Yoga",           "reason": "Considered inauspicious for new beginnings"},
    "vidaal_yoga":           {"label": "Vidaal Yoga",           "reason": "Considered inauspicious for new beginnings"},
    "aadal_yoga":            {"label": "Aadal Yoga",            "reason": "Considered inauspicious for new beginnings"},
}


def describe_muhurat(slug: str, raw_name: str) -> dict:
    """Look up a friendly label + reason by the EXACT DivineAPI field slug.
    Falls back to the API's own (title-cased) name if we don't recognize the
    slug — never to a generic 'Auspicious'."""
    info = MUHURAT_INFO.get((slug or "").strip().lower())
    if info:
        return info
    clean = (raw_name or slug or "Auspicious Period").strip()
    return {"label": clean, "reason": clean}


# ─── Birth-based compatibility (Tara Bala / Chandra Bala) ──────────────────
# Which people's birth details a given occasion needs. Keys match the
# muhurat_type ids the frontend sends (see MUHURAT_TYPES on the frontend).
EVENT_PERSON_ROLES = {
    "vivah":       [("groom", "Groom"), ("bride", "Bride")],
    "griha":       [("primary", "Primary Family Member")],
    "vyapar":      [("primary", "Primary Partner")],
    "naamkaran":   [("child", "Child")],
    "mundan":      [("child", "Child")],
    "vidyarambh":  [("child", "Child")],
    "vastu":       [("primary", "Owner")],
    "yatra":       [("self", "Traveler")],
    "vahan":       [("self", "Owner")],
    "investment":  [("self", "Investor")],
    "chikitsa":    [("self", "Patient")],
    "naukri":      [("self", "Candidate")],
}

NAKSHATRA_ORDER = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
    "Purva Bhadrapada", "Uttara Bhadrapada", "Revati",
]

RASHI_ORDER = [
    "Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya",
    "Tula", "Vrishchika", "Dhanu", "Makara", "Kumbha", "Meena",
]

TARA_NAMES = ["Janma", "Sampat", "Vipat", "Kshema", "Pratyak", "Sadhaka", "Vadha", "Mitra", "Ati Mitra"]
# Classical Tara Bala rule: counting from the birth Nakshatra, the 3rd
# (Vipat), 5th (Pratyak) and 7th (Vadha) taras in each 9-cycle are inauspicious.
TARA_INAUSPICIOUS = {3, 5, 7}

# Classical Chandra Bala rule: transit Moon in houses 1, 3, 6, 7, 10, 11 from
# the natal Moon sign (Janma Rashi) is favourable for new undertakings.
CHANDRA_BALA_GOOD_HOUSES = {1, 3, 6, 7, 10, 11}


def _nakshatra_index(name: str) -> Optional[int]:
    clean = (name or "").strip().lower()
    if not clean:
        return None
    for i, n in enumerate(NAKSHATRA_ORDER):
        if n.lower() == clean or n.lower() in clean or clean in n.lower():
            return i
    return None


def _rashi_for_nakshatra(name: str) -> Optional[str]:
    """Approximate a Moon sign from a Nakshatra name, using the rashi that
    contains the START of that nakshatra's span (each nakshatra is 13°20',
    each rashi is 30°). A handful of nakshatras straddle two rashis depending
    on pada, which we don't have from the Panchang API — this gives the
    correct rashi for the majority of that nakshatra's span."""
    idx = _nakshatra_index(name)
    if idx is None:
        return None
    start_degree = idx * (360 / 27)
    rashi_idx = int(start_degree // 30) % 12
    return RASHI_ORDER[rashi_idx]


def compute_tara_bala(birth_nakshatra: str, day_nakshatra: str) -> dict:
    bi = _nakshatra_index(birth_nakshatra)
    di = _nakshatra_index(day_nakshatra)
    if bi is None or di is None:
        return {"available": False}
    diff = (di - bi) % 27
    tara_number = (diff % 9) + 1
    return {
        "available": True,
        "tara_number": tara_number,
        "label": TARA_NAMES[tara_number - 1],
        "is_auspicious": tara_number not in TARA_INAUSPICIOUS,
    }


def compute_chandra_bala(birth_nakshatra: str, day_nakshatra: str) -> dict:
    birth_rashi = _rashi_for_nakshatra(birth_nakshatra)
    day_rashi = _rashi_for_nakshatra(day_nakshatra)
    if not birth_rashi or not day_rashi:
        return {"available": False}
    bi = RASHI_ORDER.index(birth_rashi)
    di = RASHI_ORDER.index(day_rashi)
    house = ((di - bi) % 12) + 1
    return {
        "available": True,
        "house": house,
        "birth_rashi": birth_rashi,
        "day_rashi": day_rashi,
        "is_auspicious": house in CHANDRA_BALA_GOOD_HOUSES,
    }


class PersonBirthDetails(BaseModel):
    role: str
    role_label: Optional[str] = ""
    name: Optional[str] = ""
    dob: str
    tob: Optional[str] = ""
    birth_place: str
    birth_coordinates: Optional[str] = None


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
    # Legacy fields, kept for backward compatibility with older clients.
    name: Optional[str] = ""
    rashi: Optional[str] = ""
    city: Optional[str] = "India"
    coordinates: Optional[str] = None
    language: Optional[str] = DEFAULT_LANGUAGE
    calendar: Optional[str] = DEFAULT_CALENDAR
    refresh: Optional[bool] = False
    # Event-specific birth details (e.g. bride+groom for Vivah, primary
    # member for Griha Pravesh). Muhurat is computed from these, not the
    # legacy name/rashi fields, whenever persons are provided.
    persons: Optional[List[PersonBirthDetails]] = None


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
    day_nakshatra_name = day.get("nakshatra", {}).get("name", "")

    auspicious_timings = []
    for item in day.get("auspicious_period", []):
        # FIX: look up the friendly name/reason by the exact API slug, and
        # NEVER fall back to item["type"] for the reason — that field is only
        # ever the literal word "Auspicious"/"Inauspicious" (see
        # divineapi_client._normalize_periods), so using it as a "reason"
        # produced the "Auspicious / Auspicious" repetition on every card.
        info = describe_muhurat(item.get("slug", ""), item.get("name", ""))
        for period in item.get("period", []):
            time_str = format_period(period)
            if not time_str:
                continue
            auspicious_timings.append({
                "time": time_str,
                "quality": info["label"],
                "reason": info["reason"],
            })

    timings_to_avoid = []
    for item in day.get("inauspicious_period", []):
        info = describe_muhurat(item.get("slug", ""), item.get("name", ""))
        for period in item.get("period", []):
            time_str = format_period(period)
            if not time_str:
                continue
            timings_to_avoid.append({
                "time": time_str,
                "reason": info["label"],
            })

    # ── Per-person birth-based compatibility (Tara Bala / Chandra Bala) ──
    # Each person's janma nakshatra is derived live from their birth
    # date+time+place (can't be pre-cached like daily Panchang, since birth
    # dates are arbitrary), then compared against the muhurat date's
    # nakshatra to work out the two classical strength checks.
    person_compatibility = []
    any_person_inauspicious = False
    for person in (req.persons or []):
        birth_coords = resolve_coordinates(person.birth_place, person.birth_coordinates)
        birth_place = resolve_place(person.birth_place)
        try:
            birth_moment = call_divineapi(
                lambda api, p=person, c=birth_coords, pl=birth_place: api.get_birth_moment(p.dob, p.tob, c, pl)
            )
        except HTTPException as exc:
            person_compatibility.append({
                "role": person.role,
                "role_label": person.role_label or person.role.title(),
                "name": person.name or "",
                "error": "Could not calculate birth Nakshatra for this person.",
            })
            continue

        birth_nakshatra_name = birth_moment.get("nakshatra", {}).get("name", "")
        tara_bala = compute_tara_bala(birth_nakshatra_name, day_nakshatra_name)
        chandra_bala = compute_chandra_bala(birth_nakshatra_name, day_nakshatra_name)

        is_favorable = True
        if tara_bala.get("available") and not tara_bala["is_auspicious"]:
            is_favorable = False
        if chandra_bala.get("available") and not chandra_bala["is_auspicious"]:
            is_favorable = False
        if not is_favorable:
            any_person_inauspicious = True

        person_compatibility.append({
            "role": person.role,
            "role_label": person.role_label or person.role.title(),
            "name": person.name or "",
            "birth_nakshatra": birth_nakshatra_name,
            "tara_bala": tara_bala,
            "chandra_bala": chandra_bala,
            "is_favorable": is_favorable,
        })

    verdict = "avoid" if any_person_inauspicious else "good"
    if any_person_inauspicious:
        weak_people = ", ".join(
            p["role_label"] for p in person_compatibility if p.get("is_favorable") is False
        )
        verdict_reason = (
            f"Tara Bala/Chandra Bala is currently unfavourable for {weak_people} on this date. "
            "A different date is recommended for this occasion."
        )
    else:
        verdict_reason = "This recommendation is based on auspicious/inauspicious periods for the selected date and location" + (
            ", cross-checked against the birth Nakshatra of the people involved." if person_compatibility else "."
        )

    return {
        "verdict": verdict,
        "verdict_reason": verdict_reason,
        "pandit_message": f"For {req.muhurat_label}, prefer the listed auspicious periods and avoid Rahu Kaal, Yamaganda, Gulika Kaal, Dur Muhurat and Varjyam.",
        "auspicious_timings": auspicious_timings,
        "timings_to_avoid": timings_to_avoid,
        "tithi_today": {
            "name": day.get("tithi", {}).get("name", ""),
            "is_auspicious_for_this_muhurat": True,
            "reason": day.get("tithi", {}).get("paksha", ""),
        },
        "nakshatra_today": {
            "name": day_nakshatra_name,
            "is_auspicious_for_this_muhurat": not any_person_inauspicious,
            "reason": (day.get("nakshatra", {}).get("lord") or {}).get("name", ""),
        },
        "person_compatibility": person_compatibility,
        "rituals_recommended": ["Begin with Ganesh vandana", "Offer deepam and flowers", "Consult temple priest for ceremony-specific sankalp"],
        "mantras": [],
        "special_notes": ["Data is calculated for the configured coordinates.", "Panchang values change by location."],
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
        "rahu_kaal": {"time": find_period(day.get("inauspicious_period", []), "rahu_kaal")},
        "brahma_muhurat": {"time": find_period(day.get("auspicious_period", []), "brahma_muhurta"), "benefit": "Spiritual practice"},
        "abhijit_muhurat": {"time": find_period(day.get("auspicious_period", []), "abhijit_muhurta"), "benefit": "Auspicious work"},
        "choghadiya": [
            {"time": format_period(item), "name": item.get("name", ""), "nature": item.get("type", ""), "good_for": ""}
            for item in day.get("choghadiya", [])
        ],
        "festivals": day.get("festivals", []),
        "overall_day": "good",
        "pandit_blessings": "May your day begin with clarity, devotion and auspicious intention.",
        "do_today": ["Use the listed shubh periods", "Check tithi and nakshatra before major rituals"],
        "avoid_today": ["Avoid inauspicious periods for new beginnings", "Do not use this as a substitute for priest guidance for major samskaras"],
        "raw": day,
    }


def find_period(items: list[dict], slug: str) -> str:
    for item in items:
        if item.get("slug") == slug:
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