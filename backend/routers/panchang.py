from __future__ import annotations

from datetime import datetime, timedelta
import json
import os
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

CLAUDE_MODEL = os.getenv("MUHURAT_CLAUDE_MODEL", "claude-haiku-4-5")


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
# "slug"). DivineAPI's own docs/marketing copy spell these inconsistently across pages
# ("Gulika Kalam" vs "Gulikai Kalam", "Rahu Kaal" vs "Rahu Kalam"), and we can't verify the
# live JSON key without a real API call, so BOTH the old guess and the doc-confirmed spelling
# are included below — whichever the account's actual API response uses will match.
MUHURAT_INFO = {
    "brahma_muhurta":        {"label": "Brahma Muhurat",        "reason": "Best for meditation, mantra japa and spiritual practice"},
    "abhijit_muhurta":       {"label": "Abhijit Muhurat",       "reason": "All-purpose auspicious window, good for most new beginnings"},
    "godhuli_muhurta":       {"label": "Godhuli Muhurat",       "reason": "Dusk period, traditionally favoured for Vivah rituals"},
    "vijay_muhurta":         {"label": "Vijay Muhurat",         "reason": "Favourable for undertakings related to success and victory"},
    "vijaya_muhurta":        {"label": "Vijay Muhurat",         "reason": "Favourable for undertakings related to success and victory"},
    "nishita_muhurta":       {"label": "Nishita Muhurat",       "reason": "Midnight period, used for specific spiritual rites"},
    "amrit_kalam":           {"label": "Amrit Kalam",           "reason": "Short, highly favourable nectar period"},
    "pratah_sandhya":        {"label": "Pratah Sandhya",        "reason": "Morning twilight, suited for prayer and sandhyavandanam"},
    "sayahana_sandhya":      {"label": "Sayahna Sandhya",       "reason": "Evening twilight, suited for prayer and sandhyavandanam"},
    "sayahna_sandhya":       {"label": "Sayahna Sandhya",       "reason": "Evening twilight, suited for prayer and sandhyavandanam"},
    "ravi_yoga":             {"label": "Ravi Yoga",             "reason": "Sun-blessed yoga said to neutralise other doshas in the period"},
    "sarvartha_siddhi_yoga": {"label": "Sarvartha Siddhi Yoga", "reason": "Highly auspicious yoga for success in any undertaking"},
    "amrit_siddhi_yoga":     {"label": "Amrit Siddhi Yoga",     "reason": "Rare, especially auspicious nakshatra-vaar combination"},
    "siddha_yoga":           {"label": "Siddha Yoga",           "reason": "Favourable yoga for accomplishment of tasks"},
    "tri_pushkara_yoga":     {"label": "Tri Pushkara Yoga",     "reason": "Triples the merit/effect of actions performed in this window"},
    # Inauspicious — both spelling variants included defensively (see note above)
    "rahu_kaal":             {"label": "Rahu Kaal",             "reason": "Inauspicious — avoid starting new work"},
    "rahu_kalam":            {"label": "Rahu Kaal",             "reason": "Inauspicious — avoid starting new work"},
    "yamaganda":             {"label": "Yamaganda",             "reason": "Inauspicious — avoid starting new work"},
    "yamagandam":            {"label": "Yamaganda",             "reason": "Inauspicious — avoid starting new work"},
    "gulkai_kaal":           {"label": "Gulika Kaal",           "reason": "Inauspicious — avoid starting new work"},
    "gulika_kaal":           {"label": "Gulika Kaal",           "reason": "Inauspicious — avoid starting new work"},
    "gulika_kalam":          {"label": "Gulika Kaal",           "reason": "Inauspicious — avoid starting new work"},
    "gulikai_kalam":         {"label": "Gulika Kaal",           "reason": "Inauspicious — avoid starting new work"},
    "dur_muhurtam":          {"label": "Dur Muhurat",           "reason": "Inauspicious window, best avoided for important events"},
    "dur_muhurat":           {"label": "Dur Muhurat",           "reason": "Inauspicious window, best avoided for important events"},
    "varjyam":               {"label": "Varjyam",               "reason": "Inauspicious window, best avoided for important events"},
    "baana":                 {"label": "Baana",                 "reason": "Directional influence — check the specific sign for its effect"},
    "bhadra":                {"label": "Bhadra",                "reason": "Inauspicious — avoid starting new work"},
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
    """FALLBACK ONLY. Real Tara Bala comes from DivineAPI's
    find-chandrabalam-and-tarabalam endpoint (see check_bala_favorability
    below) — this manual nakshatra-count version is used only if that call
    fails (plan/network issue), so the feature still returns something."""
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
    """FALLBACK ONLY — see compute_tara_bala's note above."""
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
    gender: Optional[str] = "male"  # Kundali API (Basic Astro Details / Ashtakoot Milan) requires this
    dob: str
    tob: Optional[str] = ""
    birth_place: str
    birth_coordinates: Optional[str] = None


def _names_match(a: str, b: str) -> bool:
    """Loose match for Rashi/Nakshatra names — DivineAPI endpoints don't
    always spell the same nakshatra identically across endpoints (e.g.
    'Ardhra' vs 'Ardra', 'Mrigashirsha' vs 'Mrigashira')."""
    a_clean, b_clean = (a or "").strip().lower(), (b or "").strip().lower()
    if not a_clean or not b_clean:
        return False
    return a_clean == b_clean or a_clean in b_clean or b_clean in a_clean


def resolve_person_signature(person: PersonBirthDetails) -> dict:
    """Get a person's real birth Moonsign (Janma Rashi) + Nakshatra.

    Tries the Kundali 'Basic Astrological Details' endpoint first (the
    endpoint actually designed for this — exact, needs gender). Falls back to
    reusing the Panchang 'find-panchang' call at the birth moment (gives
    Nakshatra only; Rashi is then approximated) if the Kundali endpoint isn't
    available on the current plan or the call fails for any reason.
    """
    birth_coords = resolve_coordinates(person.birth_place, person.birth_coordinates)
    birth_place = resolve_place(person.birth_place)
    try:
        astro = call_divineapi(lambda api: api.get_basic_astro_details({
            "name": person.name,
            "gender": person.gender,
            "dob": person.dob,
            "tob": person.tob,
            "coordinates": birth_coords,
            "place": birth_place,
        }))
        if astro.get("moonsign") and astro.get("nakshatra"):
            return {"moonsign": astro["moonsign"], "nakshatra": astro["nakshatra"], "source": "kundli"}
    except HTTPException:
        pass

    try:
        birth_moment = call_divineapi(lambda api: api.get_birth_moment(person.dob, person.tob, birth_coords, birth_place))
        nak_name = birth_moment.get("nakshatra", {}).get("name", "")
        return {"moonsign": _rashi_for_nakshatra(nak_name) or "", "nakshatra": nak_name, "source": "approximation"}
    except HTTPException:
        return {"moonsign": "", "nakshatra": "", "source": "unavailable"}


def check_bala_favorability(person_signature: dict, bala: dict) -> dict:
    """Check a person's real birth Rashi/Nakshatra against a date's real
    Chandrabalam/Tarabalam favourable lists (from DivineAPI). This is the
    authoritative version of the Tara Bala / Chandra Bala check."""
    moonsign = person_signature.get("moonsign", "")
    nakshatra = person_signature.get("nakshatra", "")
    chandra_list = bala.get("chandrabalam_current", [])
    tara_list = bala.get("tarabalam_current", [])

    chandra_favorable = any(_names_match(moonsign, r) for r in chandra_list) if moonsign else None
    tara_favorable = any(_names_match(nakshatra, n) for n in tara_list) if nakshatra else None

    return {
        "available": moonsign != "" or nakshatra != "",
        "moonsign": moonsign,
        "nakshatra": nakshatra,
        "chandra_bala": {"available": chandra_favorable is not None, "is_auspicious": bool(chandra_favorable)},
        "tara_bala": {"available": tara_favorable is not None, "is_auspicious": bool(tara_favorable)},
        "is_favorable": (chandra_favorable is not False) and (tara_favorable is not False),
    }


# ─── Classical date-selection rules, used to SCORE candidate dates when
# searching for the best upcoming Muhurat (not just checking one date) ──────
# These are commonly-cited Vedic muhurta guidelines. They're heuristics, not
# a substitute for a family priest's judgement for major samskaras.
WEEKDAY_RULES = {
    # muhurat_type: (favourable weekdays, weekdays to avoid)
    "vivah":      ({"Monday", "Wednesday", "Thursday", "Friday"}, {"Tuesday", "Saturday", "Sunday"}),
    "griha":      ({"Monday", "Wednesday", "Thursday", "Friday"}, {"Tuesday", "Saturday", "Sunday"}),
    "vyapar":     ({"Wednesday", "Thursday", "Friday"},           {"Tuesday", "Saturday"}),
    "naamkaran":  ({"Monday", "Wednesday", "Thursday", "Friday"}, {"Tuesday", "Saturday", "Sunday"}),
    "vidyarambh": ({"Wednesday", "Thursday", "Friday"},           {"Tuesday", "Saturday", "Sunday"}),
    "mundan":     ({"Monday", "Wednesday", "Thursday", "Friday"}, {"Tuesday", "Saturday", "Sunday"}),
    "vahan":      ({"Monday", "Wednesday", "Thursday", "Friday"}, {"Tuesday", "Saturday", "Sunday"}),
    "vastu":      ({"Monday", "Wednesday", "Thursday", "Friday"}, {"Tuesday", "Saturday"}),
    "investment": ({"Thursday", "Friday"},                        {"Tuesday", "Saturday"}),
    "chikitsa":   ({"Monday", "Wednesday", "Thursday", "Friday"}, {"Tuesday", "Saturday", "Sunday"}),
    "naukri":     ({"Monday", "Wednesday", "Thursday", "Friday"}, {"Tuesday", "Saturday"}),
    "yatra":      ({"Monday", "Wednesday", "Thursday", "Friday"}, {"Saturday"}),
}

WEEKDAY_LORDS = {
    "Sunday": "Surya (Sun)",
    "Monday": "Chandra (Moon)",
    "Tuesday": "Mangal (Mars)",
    "Wednesday": "Budh (Mercury)",
    "Thursday": "Guru (Jupiter)",
    "Friday": "Shukra (Venus)",
    "Saturday": "Shani (Saturn)",
}

# Nakshatras classically considered favourable for each occasion.
FAVORABLE_NAKSHATRAS = {
    "vivah":      {"Rohini", "Mrigashira", "Magha", "Uttara Phalguni", "Hasta", "Swati", "Anuradha", "Mula", "Uttara Ashadha", "Uttara Bhadrapada", "Revati"},
    "griha":      {"Rohini", "Mrigashira", "Uttara Phalguni", "Uttara Ashadha", "Uttara Bhadrapada", "Revati", "Chitra", "Anuradha"},
    "vyapar":     {"Ashwini", "Pushya", "Hasta", "Chitra", "Swati", "Anuradha", "Revati"},
    "naamkaran":  {"Ashwini", "Punarvasu", "Pushya", "Hasta", "Swati", "Anuradha", "Shravana", "Revati"},
    "vidyarambh": {"Ashwini", "Punarvasu", "Pushya", "Hasta", "Chitra", "Swati", "Shravana"},
    "mundan":     {"Pushya", "Magha", "Uttara Phalguni", "Hasta", "Swati", "Anuradha", "Shravana", "Revati"},
    "vastu":      {"Rohini", "Mrigashira", "Uttara Phalguni", "Uttara Ashadha", "Uttara Bhadrapada"},
    "yatra":      {"Ashwini", "Pushya", "Hasta", "Anuradha", "Revati", "Shravana"},
    "vahan":      {"Ashwini", "Rohini", "Mrigashira", "Pushya", "Uttara Phalguni", "Hasta", "Chitra", "Revati"},
    "investment": {"Pushya", "Hasta", "Chitra", "Swati", "Anuradha", "Shravana"},
    "chikitsa":   {"Ashwini", "Pushya", "Hasta", "Swati", "Shravana"},
    "naukri":     {"Ashwini", "Pushya", "Hasta", "Chitra", "Swati", "Anuradha", "Shravana", "Revati"},
}

# Rikta ("empty") tithis — 4th, 9th, 14th of either paksha — are avoided for
# most new beginnings, along with Amavasya (new moon).
RIKTA_TITHI_NAMES = {"chaturthi", "navami", "chaturdashi"}


def _is_tithi_favorable(tithi_name: str) -> bool:
    clean = (tithi_name or "").strip().lower()
    if not clean:
        return True
    if "amavasya" in clean:
        return False
    return not any(rikta in clean for rikta in RIKTA_TITHI_NAMES)


def score_candidate_date(
    muhurat_type: str,
    weekday: str,
    tithi_name: str,
    nakshatra_name: str,
    person_balas: list[dict],
) -> dict:
    """Score one candidate date for a given occasion. Higher is better.
    person_balas: [{"role_label":..., "tara_bala":..., "chandra_bala":...}]
    for people whose birth details were supplied — used to prefer dates that
    are also favourable for everyone involved.
    """
    good_days, avoid_days = WEEKDAY_RULES.get(muhurat_type, (set(), set()))
    favorable_nakshatras = FAVORABLE_NAKSHATRAS.get(muhurat_type, set())

    score = 0
    reasons = []

    if weekday in avoid_days:
        score -= 3
        reasons.append(f"{weekday} is generally avoided for this occasion")
    elif weekday in good_days:
        score += 2
        reasons.append(f"{weekday} is a favourable weekday for this occasion")

    tithi_ok = _is_tithi_favorable(tithi_name)
    if not tithi_ok:
        score -= 3
        reasons.append(f"Tithi {tithi_name} is a Rikta/Amavasya tithi, best avoided")
    elif tithi_name:
        score += 1

    nak_clean = (nakshatra_name or "")
    if any(fav.lower() in nak_clean.lower() or nak_clean.lower() in fav.lower() for fav in favorable_nakshatras):
        score += 2
        reasons.append(f"Nakshatra {nakshatra_name} is favourable for this occasion")

    person_flags = []
    for pb in person_balas:
        person_ok = True
        if pb.get("tara_bala", {}).get("available"):
            if pb["tara_bala"]["is_auspicious"]:
                score += 1
            else:
                score -= 2
                person_ok = False
        if pb.get("chandra_bala", {}).get("available"):
            if pb["chandra_bala"]["is_auspicious"]:
                score += 1
            else:
                score -= 2
                person_ok = False
        person_flags.append(person_ok)
        if not person_ok:
            reasons.append(f"Tara/Chandra Bala unfavourable for {pb.get('role_label', pb.get('role'))}")

    if score >= 6:
        verdict = "excellent"
    elif score >= 3:
        verdict = "good"
    elif score >= 0:
        verdict = "fair"
    else:
        verdict = "avoid"

    return {
        "score": score,
        "verdict": verdict,
        "reasons": reasons,
        "all_persons_favorable": all(person_flags) if person_flags else True,
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


class BestDatesRequest(BaseModel):
    muhurat_type: str
    muhurat_label: str
    muhurat_hindi: str
    city: Optional[str] = "India"
    coordinates: Optional[str] = None
    language: Optional[str] = DEFAULT_LANGUAGE
    calendar: Optional[str] = DEFAULT_CALENDAR
    start_date: Optional[str] = None    # defaults to tomorrow if not given
    range_days: Optional[int] = 45      # how many days ahead to search (max 90)
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


def first_text(*values) -> str:
    for value in values:
        if value in (None, "", []):
            continue
        if isinstance(value, dict):
            nested = first_text(*value.values())
            if nested:
                return nested
        elif isinstance(value, list):
            nested = first_text(*value)
            if nested:
                return nested
        else:
            return str(value).strip()
    return ""


def raw_panchang(day: dict) -> dict:
    raw = day.get("raw", {}).get("panchang", {})
    return raw if isinstance(raw, dict) else {}


def raw_nakshatra(day: dict) -> dict:
    raw = raw_panchang(day).get("nakshatras", {})
    if isinstance(raw, dict):
        for key in ("nakshatra_pada", "nakshatra_list"):
            values = raw.get(key)
            if isinstance(values, list) and values:
                return values[0] if isinstance(values[0], dict) else {}
    return {}


def format_optional_time(value: str) -> str:
    return format_time(value) if value else "Not available"


def display_period(period: dict) -> str:
    text = format_period(period)
    return text if text else "Not available"


def parse_clock_minutes(value: str) -> Optional[int]:
    if not value:
        return None
    raw = str(value).split(" to ", 1)[0].strip()
    raw = raw.split(" Jul ", 1)[0].strip()
    for fmt in ("%I:%M %p", "%H:%M", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
        try:
            parsed = datetime.strptime(raw, fmt)
            return parsed.hour * 60 + parsed.minute
        except ValueError:
            continue
    try:
        parsed = datetime.fromisoformat(raw)
        return parsed.hour * 60 + parsed.minute
    except Exception:
        return None


def current_next_choghadiya(choghadiya: list[dict]) -> tuple[dict | None, dict | None]:
    if not choghadiya:
        return None, None
    now = datetime.now().hour * 60 + datetime.now().minute
    parsed = []
    for item in choghadiya:
        start = parse_clock_minutes(item.get("start") or item.get("time"))
        end = parse_clock_minutes(item.get("end") or (str(item.get("time", "")).split(" to ", 1)[1] if " to " in str(item.get("time", "")) else ""))
        if start is None or end is None:
            continue
        if end <= start:
            end += 1440
        adjusted_now = now + 1440 if now < start and end > 1440 else now
        parsed.append((item, start, end, adjusted_now))
        if start <= adjusted_now < end:
            return item, next((n[0] for n in parsed if n[1] > adjusted_now), None)
    future = [(item, start) for item, start, _end, _now in parsed if start > now]
    return None, min(future, key=lambda row: row[1])[0] if future else (choghadiya[0] if choghadiya else None)


def safe_reasons(values: list[str], fallback: str) -> list[str]:
    cleaned = [str(v).strip() for v in values if str(v or "").strip()]
    return cleaned or [fallback]


def call_claude_muhurat(evidence: dict) -> dict | None:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        from anthropic import Anthropic

        client = Anthropic(api_key=api_key)
        prompt = (
            "You are assisting a Hindu muhurat finder. Use ONLY the provided DivineAPI evidence and deterministic scores. "
            "Do not invent dates, times, tithis, nakshatras, or doshas. Rank the given candidate dates for the requested occasion. "
            "Return strict JSON only with this shape: "
            '{"recommended_dates":[{"date":"YYYY-MM-DD","verdict":"excellent|good|fair|avoid","ai_summary":"short reason","reasons":["reason"],"best_timing_notes":["note"]}],"overall_note":"short note"}.\n\n'
            f"EVIDENCE:\n{json.dumps(evidence, ensure_ascii=False, default=str)[:90000]}"
        )
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=1800,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(block.text for block in response.content if getattr(block, "type", "") == "text").strip()
        start = text.find("{")
        end = text.rfind("}")
        if start == -1 or end == -1:
            return None
        parsed = json.loads(text[start : end + 1])
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


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
    # Each person's real birth Rashi/Nakshatra is resolved live (Kundali API,
    # falling back to the manual approximation if unavailable), then checked
    # against this date's real Chandrabalam/Tarabalam favourable lists.
    day_bala = None
    try:
        day_bala = call_divineapi(lambda api: api.get_chandrabalam_tarabalam(req.date, resolve_coordinates(req.city, req.coordinates), resolve_place(req.city)))
    except HTTPException:
        day_bala = None

    person_compatibility = []
    any_person_inauspicious = False
    for person in (req.persons or []):
        sig = resolve_person_signature(person)
        if not sig.get("nakshatra") and not sig.get("moonsign"):
            person_compatibility.append({
                "role": person.role,
                "role_label": person.role_label or person.role.title(),
                "name": person.name or "",
                "error": "Could not calculate birth Nakshatra for this person.",
            })
            continue

        if day_bala is not None:
            check = check_bala_favorability(sig, day_bala)
            tara_bala, chandra_bala = check["tara_bala"], check["chandra_bala"]
        else:
            tara_bala = compute_tara_bala(sig["nakshatra"], day_nakshatra_name)
            chandra_bala = compute_chandra_bala(sig["nakshatra"], day_nakshatra_name)

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
            "birth_nakshatra": sig["nakshatra"],
            "birth_rashi": sig["moonsign"],
            "data_source": sig["source"],
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


@router.post("/muhurat/best-dates")
def find_best_muhurat_dates(req: BestDatesRequest):
    """Instead of judging a single date, scan a window of upcoming dates and
    recommend the best ones for the requested occasion — this is what
    'find the perfect date for this event' actually needs.

    Compatibility is checked using DivineAPI's real Kundali + Chandrabalam/
    Tarabalam endpoints (Vedic Prakash plan) wherever available, falling back
    to a manual nakshatra-count approximation only if those calls fail.
    """
    range_days = max(1, min(int(req.range_days or 45), 90))
    start = req.start_date or (datetime.now().date() + timedelta(days=1)).isoformat()
    try:
        start_dt = datetime.strptime(start, "%Y-%m-%d").date()
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="start_date must be in YYYY-MM-DD format") from exc

    event_coordinates = resolve_coordinates(req.city, req.coordinates)
    event_place = resolve_place(req.city)
    persons = req.persons or []

    # Each person's real birth Moonsign + Nakshatra only needs to be resolved
    # ONCE, then reused for every candidate date's Chandrabalam/Tarabalam check.
    person_signatures = []
    for person in persons:
        sig = resolve_person_signature(person)
        person_signatures.append({
            "role": person.role,
            "role_label": person.role_label or person.role.title(),
            "name": person.name or "",
            **sig,
        })

    # For Vivah with exactly a bride+groom, run the real 36-point Ashtakoot
    # Milan ONCE — this is a fixed birth-chart compatibility, not date-dependent,
    # so it doesn't belong inside the per-date scan below.
    ashtakoot_milan = None
    if req.muhurat_type == "vivah" and len(persons) == 2:
        groom = next((p for p in persons if p.role == "groom"), persons[0])
        bride = next((p for p in persons if p.role == "bride"), persons[1])
        try:
            def _person_payload(p: PersonBirthDetails) -> dict:
                return {
                    "name": p.name, "gender": p.gender, "dob": p.dob, "tob": p.tob,
                    "coordinates": resolve_coordinates(p.birth_place, p.birth_coordinates),
                    "place": resolve_place(p.birth_place),
                }
            ashtakoot_milan = call_divineapi(
                lambda api: api.get_ashtakoot_milan(_person_payload(groom), _person_payload(bride))
            )
        except HTTPException:
            ashtakoot_milan = None

    candidates = []
    for offset in range(range_days):
        current_date = (start_dt + timedelta(days=offset)).isoformat()
        try:
            basic = call_divineapi(lambda api, d=current_date: api.get_panchang_basic(d, event_coordinates, event_place))
        except HTTPException:
            continue  # skip dates we can't get data for rather than failing the whole search

        weekday = basic.get("vaara") or datetime.strptime(current_date, "%Y-%m-%d").strftime("%A")
        tithi_name = basic.get("tithi", {}).get("name", "")
        nakshatra_name = basic.get("nakshatra", {}).get("name", "")

        # Real Chandrabalam/Tarabalam for this date (one call covers every person).
        bala = None
        try:
            bala = call_divineapi(lambda api, d=current_date: api.get_chandrabalam_tarabalam(d, event_coordinates, event_place))
        except HTTPException:
            bala = None

        person_balas = []
        for sig in person_signatures:
            if bala is not None:
                check = check_bala_favorability(sig, bala)
                person_balas.append({
                    "role": sig["role"], "role_label": sig["role_label"],
                    "tara_bala": check["tara_bala"], "chandra_bala": check["chandra_bala"],
                })
            else:
                # Fallback: manual nakshatra-count approximation
                tara = compute_tara_bala(sig["nakshatra"], nakshatra_name) if sig["nakshatra"] else {"available": False}
                chandra = compute_chandra_bala(sig["nakshatra"], nakshatra_name) if sig["nakshatra"] else {"available": False}
                person_balas.append({"role": sig["role"], "role_label": sig["role_label"], "tara_bala": tara, "chandra_bala": chandra})

        scored = score_candidate_date(req.muhurat_type, weekday, tithi_name, nakshatra_name, person_balas)

        # Fold the Ashtakoot Milan result into Vivah scoring (fixed across all
        # dates, but still worth surfacing as a reason on every candidate).
        if ashtakoot_milan is not None:
            points = ashtakoot_milan.get("points_obtained") or 0
            if points >= 28:
                scored["score"] += 3
                scored["reasons"].append(f"Ashtakoot Milan: {points}/36 — excellent compatibility")
            elif points >= 18:
                scored["score"] += 1
                scored["reasons"].append(f"Ashtakoot Milan: {points}/36 — acceptable compatibility")
            else:
                scored["score"] -= 3
                scored["reasons"].append(f"Ashtakoot Milan: {points}/36 — below the traditional 18-point threshold")
            if ashtakoot_milan.get("nadi_dosha"):
                scored["score"] -= 2
                scored["reasons"].append("Nadi Dosha present in the match")

        candidates.append({
            "date": current_date,
            "weekday": weekday,
            "tithi": tithi_name,
            "nakshatra": nakshatra_name,
            **scored,
        })

    candidates.sort(key=lambda c: c["score"], reverse=True)
    evidence_pool = [c for c in candidates if c["verdict"] != "avoid"][:12]
    if not evidence_pool:
        evidence_pool = candidates[:8]

    # Fetch the actual auspicious time windows only for the shortlisted dates
    # (full get_day() is 4x the cost of get_panchang_basic, so we don't run it
    # for every scanned date).
    recommended_dates = []
    claude_candidates = []
    for c in evidence_pool:
        query = query_for(c["date"], event_coordinates, req.language or DEFAULT_LANGUAGE, req.calendar or DEFAULT_CALENDAR, event_place)
        day = None
        try:
            day = call_divineapi(lambda api, q=query: api.get_day(q, force_refresh=False, cache_only=False))
            timings = []
            for item in day.get("auspicious_period", []):
                info = describe_muhurat(item.get("slug", ""), item.get("name", ""))
                for period in item.get("period", []):
                    time_str = format_period(period)
                    if time_str:
                        timings.append({"time": time_str, "quality": info["label"], "reason": info["reason"]})
        except HTTPException:
            timings = []

        timings_to_avoid = []
        if day:
            for item in day.get("inauspicious_period", []):
                info = describe_muhurat(item.get("slug", ""), item.get("name", ""))
                for period in item.get("period", []):
                    time_str = format_period(period)
                    if time_str:
                        timings_to_avoid.append({"time": time_str, "name": info["label"], "reason": info["reason"]})

        full_candidate = {
            "date": c["date"],
            "weekday": c["weekday"],
            "tithi": first_text(c["tithi"], (day or {}).get("tithi", {}).get("name")),
            "nakshatra": first_text(c["nakshatra"], (day or {}).get("nakshatra", {}).get("name")),
            "yoga": (day or {}).get("yoga", {}).get("name", ""),
            "karana": (day or {}).get("karana", {}).get("name", ""),
            "score": c["score"],
            "verdict": c["verdict"],
            "reasons": safe_reasons(c["reasons"], "Shortlisted after Panchang, Tara Bala and Chandra Bala checks."),
            "best_timings": timings,
            "timings_to_avoid": timings_to_avoid,
            "festivals": [f.get("name", "") for f in (day or {}).get("festivals", []) if f.get("name")],
        }
        recommended_dates.append(full_candidate)
        claude_candidates.append({
            **full_candidate,
            "divineapi_day": {
                "hindu_calendar": (day or {}).get("hindu_calendar", {}),
                "sunrise": (day or {}).get("sunrise", ""),
                "sunset": (day or {}).get("sunset", ""),
                "auspicious_period": (day or {}).get("auspicious_period", []),
                "inauspicious_period": (day or {}).get("inauspicious_period", []),
                "choghadiya": (day or {}).get("choghadiya", []),
                "festivals": (day or {}).get("festivals", []),
            },
        })

    claude_result = call_claude_muhurat({
        "occasion": {"type": req.muhurat_type, "label": req.muhurat_label, "hindi": req.muhurat_hindi},
        "location": {"city": req.city, "coordinates": event_coordinates, "place": event_place},
        "search_range": {"from": start_dt.isoformat(), "to": (start_dt + timedelta(days=range_days - 1)).isoformat()},
        "persons": person_signatures,
        "ashtakoot_milan": ashtakoot_milan,
        "candidate_dates": claude_candidates,
    })

    if claude_result and isinstance(claude_result.get("recommended_dates"), list):
        by_date = {item["date"]: item for item in recommended_dates}
        ordered = []
        seen = set()
        for ai_item in claude_result["recommended_dates"]:
            date_key = ai_item.get("date")
            if date_key not in by_date or date_key in seen:
                continue
            merged = {**by_date[date_key]}
            if ai_item.get("verdict") in {"excellent", "good", "fair", "avoid"}:
                merged["verdict"] = ai_item["verdict"]
            merged["ai_summary"] = ai_item.get("ai_summary") or ""
            merged["ai_timing_notes"] = ai_item.get("best_timing_notes") or []
            merged["reasons"] = safe_reasons(ai_item.get("reasons") or merged["reasons"], "Recommended after checking Panchang and Muhurat factors.")
            ordered.append(merged)
            seen.add(date_key)
        ordered.extend(item for item in recommended_dates if item["date"] not in seen)
        recommended_dates = ordered[:5]
        calculation_source = "divineapi+claude"
        overall_note = claude_result.get("overall_note", "")
    else:
        recommended_dates = recommended_dates[:5]
        calculation_source = "divineapi+rules"
        overall_note = "Claude is not configured or did not return valid JSON, so deterministic Panchang scoring was used."

    return {
        "muhurat_type": req.muhurat_type,
        "muhurat_label": req.muhurat_label,
        "search_range": {"from": start_dt.isoformat(), "to": (start_dt + timedelta(days=range_days - 1)).isoformat()},
        "persons": [
            {"role": s["role"], "role_label": s["role_label"], "name": s["name"], "birth_nakshatra": s["nakshatra"], "birth_rashi": s["moonsign"], "data_source": s["source"]}
            for s in person_signatures
        ],
        "ashtakoot_milan": ashtakoot_milan,
        "recommended_dates": recommended_dates,
        "calculation_source": calculation_source,
        "overall_note": overall_note,
        "source": "divineapi",
    }


def legacy_daily_response(day: dict) -> dict:
    tithi, nakshatra, yoga, karana = day.get("tithi", {}), day.get("nakshatra", {}), day.get("yoga", {}), day.get("karana", {})
    raw = raw_panchang(day)
    raw_nak = raw_nakshatra(day)
    date_value = day.get("date", "")
    vaara = first_text(day.get("vaara"), datetime.strptime(date_value, "%Y-%m-%d").strftime("%A") if date_value else "")
    choghadiya = [
        {
            "time": display_period(item),
            "start_time": first_text(item.get("start")),
            "end_time": first_text(item.get("end")),
            "name": first_text(item.get("name"), "Choghadiya"),
            "nature": first_text(item.get("type"), "Good"),
            "good_for": "Use for routine auspicious work" if item.get("type") != "Inauspicious" else "Avoid new beginnings",
            "is_day": item.get("is_day"),
        }
        for item in day.get("choghadiya", [])
    ]
    current_chog, next_chog = current_next_choghadiya(choghadiya)
    festivals = [
        {
            "name": first_text(f.get("name"), f.get("slug"), "Festival"),
            "date": first_text(f.get("date"), f.get("start_date"), date_value),
            "image": f.get("image") or "",
            "slug": f.get("slug") or "",
        }
        for f in day.get("festivals", [])
    ]
    tithi_name = first_text(tithi.get("name"), raw.get("tithi", {}).get("name"), "Tithi data not available")
    nak_name = first_text(nakshatra.get("name"), raw_nak.get("nak_name"), raw_nak.get("name"), "Nakshatra data not available")
    yoga_name = first_text(yoga.get("name"), "Yoga data not available")
    karana_name = first_text(karana.get("name"), "Karana data not available")
    return {
        "source": "divineapi",
        "date": date_value,
        "hindu_calendar": {
            **(day.get("hindu_calendar", {}) or {}),
            "name": first_text((day.get("hindu_calendar", {}) or {}).get("name"), "Amanta"),
            "month_name": first_text((day.get("hindu_calendar", {}) or {}).get("month_name"), raw.get("chandramasa"), "Hindu month not available"),
            "day": first_text((day.get("hindu_calendar", {}) or {}).get("day"), tithi.get("id"), ""),
            "year": first_text((day.get("hindu_calendar", {}) or {}).get("year"), raw.get("samvat"), ""),
        },
        "today_at_glance": (
            f"{vaara}: {tithi_name}, {nak_name}. "
            f"Sunrise {format_optional_time(day.get('sunrise', ''))}, sunset {format_optional_time(day.get('sunset', ''))}. "
            f"{'Festival: ' + festivals[0]['name'] + '.' if festivals else 'No major festival returned for this date.'}"
        ),
        "tithi": {
            "name": tithi_name,
            "number": first_text(tithi.get("id"), ""),
            "deity": "",
            "nature": first_text(tithi.get("paksha"), "Paksha not available"),
            "paksha": first_text(tithi.get("paksha"), ""),
            "end_time": format_optional_time(tithi.get("end", "")),
        },
        "nakshatra": {
            "name": nak_name,
            "hindi": nak_name,
            "lord": first_text((nakshatra.get("lord") or {}).get("name"), raw_nak.get("lord"), "Lord not available"),
            "quality": first_text(raw_nak.get("gana"), raw_nak.get("guna"), "Quality not available"),
            "end_time": format_optional_time(first_text(nakshatra.get("end"), raw_nak.get("end_time"))),
        },
        "yoga": {
            "name": yoga_name, "nature": "Yoga", "meaning": "Daily Panchang yoga",
            "end_time": format_optional_time(yoga.get("end", "")),
        },
        "karana": {
            "name": karana_name, "nature": first_text(karana.get("paksha"), "Karana"),
            "end_time": format_optional_time(karana.get("end", "")),
        },
        "var": {"day": vaara, "lord": first_text(day.get("vaara_lord"), WEEKDAY_LORDS.get(vaara), "Lord not available"), "color": "", "good_for": "Daily worship and routine planning"},
        "sunrise": day.get("sunrise", ""),
        "sunset": day.get("sunset", ""),
        "moonrise": day.get("moonrise", ""),
        "moonset": day.get("moonset", ""),
        "rahu_kaal": {"time": first_text(find_period(day.get("inauspicious_period", []), "rahu_kalam", "rahu_kaal"), "Not available")},
        "brahma_muhurat": {"time": first_text(find_period(day.get("auspicious_period", []), "brahma_muhurta"), "Not available"), "benefit": "Spiritual practice"},
        "abhijit_muhurat": {"time": first_text(find_period(day.get("auspicious_period", []), "abhijit_muhurta"), "Not available"), "benefit": "Auspicious work"},
        "choghadiya": choghadiya,
        "current_choghadiya": current_chog,
        "next_choghadiya": next_chog,
        "festivals": festivals,
        "overall_day": "good",
        "pandit_blessings": "May your day begin with clarity, devotion and auspicious intention.",
        "do_today": ["Use the listed shubh periods", "Check tithi and nakshatra before major rituals"],
        "avoid_today": ["Avoid inauspicious periods for new beginnings", "Do not use this as a substitute for priest guidance for major samskaras"],
        "raw": day,
    }


def find_period(items: list[dict], *slugs: str) -> str:
    """Look up a muhurat window by slug. Accepts multiple candidate spellings
    (see MUHURAT_INFO note) and returns the first that matches."""
    wanted = {s.strip().lower() for s in slugs}
    for item in items:
        if (item.get("slug") or "").strip().lower() in wanted:
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
