from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
import json
import os
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

try:
    from db.panchang_cache import get_cached_panchang, get_cached_panchang_month, save_cached_panchang
except Exception:
    get_cached_panchang = None
    get_cached_panchang_month = None
    save_cached_panchang = None


CACHE_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(CACHE_ROOT / ".env")

DEFAULT_COORDINATES = os.getenv("PANCHANG_DEFAULT_COORDINATES", "28.6139,77.2090")
DEFAULT_LANGUAGE = os.getenv("DIVINE_LANGUAGE", "en")
DEFAULT_CALENDAR = os.getenv("DIVINE_CALENDAR", "amanta")
DEFAULT_PLACE = os.getenv("DIVINE_DEFAULT_PLACE", "New Delhi")
DEFAULT_TZONE = os.getenv("DIVINE_TZONE", "5.5")
CACHE_VERSION = int(os.getenv("DIVINE_CACHE_VERSION", "1"))

FIND_PANCHANG_URL = os.getenv(
    "DIVINE_FIND_PANCHANG_URL",
    "https://astroapi-1.divineapi.com/indian-api/v2/find-panchang",
)
AUSPICIOUS_TIMINGS_URL = os.getenv(
    "DIVINE_AUSPICIOUS_TIMINGS_URL",
    "https://astroapi-3.divineapi.com/indian-api/v1/auspicious-timings",
)
INAUSPICIOUS_TIMINGS_URL = os.getenv(
    "DIVINE_INAUSPICIOUS_TIMINGS_URL",
    "https://astroapi-3.divineapi.com/indian-api/v1/inauspicious-timings",
)
CHOGHADIYA_URL = os.getenv(
    "DIVINE_CHOGHADIYA_URL",
    "https://astroapi-2.divineapi.com/indian-api/v1/find-choghadiya",
)
FESTIVALS_URL = os.getenv(
    "DIVINE_FESTIVALS_URL",
    "https://astroapi-3.divineapi.com/indian-api/v1/date-specific-festivals",
)

CACHE_DIR = Path(__file__).resolve().parents[1] / "data" / "divineapi_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def normalize_coordinates(coordinates: str) -> str:
    try:
        lat, lon = [float(part.strip()) for part in coordinates.split(",", 1)]
        return f"{lat:.4f},{lon:.4f}"
    except Exception:
        return coordinates.strip()


def coordinate_variants(coordinates: str) -> list[str]:
    normalized = normalize_coordinates(coordinates)
    variants = {coordinates.strip(), normalized}
    try:
        lat, lon = [float(part.strip()) for part in coordinates.split(",", 1)]
        variants.add(f"{lat},{lon}")
        variants.add(f"{lat:.6f},{lon:.6f}")
    except Exception:
        pass
    return sorted(variants)


def cache_key_for(date_value: str, coordinates: str, calendar: str, language: str, ayanamsa: int) -> str:
    safe_coordinates = normalize_coordinates(coordinates).replace(",", "_").replace(".", "-")
    return f"{date_value}_{safe_coordinates}_{calendar}_{language}_{ayanamsa}.json"


class DivineApiConfigError(RuntimeError):
    pass


class DivineApiError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None, payload: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


@dataclass(frozen=True)
class PanchangQuery:
    date: str
    coordinates: str = DEFAULT_COORDINATES
    language: str = DEFAULT_LANGUAGE
    calendar: str = DEFAULT_CALENDAR
    place: str = DEFAULT_PLACE
    tzone: str = DEFAULT_TZONE
    ayanamsa: int = CACHE_VERSION

    @property
    def cache_key(self) -> str:
        return cache_key_for(self.date, self.coordinates, self.calendar, self.language, self.ayanamsa)

    @property
    def date_parts(self) -> tuple[int, int, int]:
        parsed = datetime.strptime(self.date, "%Y-%m-%d")
        return parsed.day, parsed.month, parsed.year

    @property
    def lat_lon(self) -> tuple[str, str]:
        lat, lon = [part.strip() for part in normalize_coordinates(self.coordinates).split(",", 1)]
        return lat, lon


class DivineApiClient:
    def __init__(self) -> None:
        self.api_key = os.getenv("DIVINE_API_KEY")
        self.access_token = os.getenv("DIVINE_ACCESS_TOKEN")
        if not self.api_key or not self.access_token:
            raise DivineApiConfigError("DIVINE_API_KEY and DIVINE_ACCESS_TOKEN must be set on the backend.")

    def get_day(
        self,
        query: PanchangQuery,
        force_refresh: bool = False,
        include_choghadiya: bool = True,
        include_festivals: bool = True,
        cache_only: bool = False,
    ) -> dict[str, Any]:
        cache_file = CACHE_DIR / query.cache_key
        if not force_refresh:
            cached = self._get_cached_day(query, cache_file)
            if cached:
                return cached
            if cache_only:
                raise DivineApiError(
                    "Panchang data is not cached for this date and location. Please generate/cache it first.",
                    404,
                    {
                        "date": query.date,
                        "coordinates": query.coordinates,
                        "calendar": query.calendar,
                        "language": query.language,
                    },
                )

        warnings: list[dict[str, Any]] = []
        panchang = self._post("panchang", FIND_PANCHANG_URL, query, include_sign_language=True)
        auspicious, warning = self._optional_post("auspicious_timings", AUSPICIOUS_TIMINGS_URL, query)
        if warning:
            warnings.append(warning)
        inauspicious, warning = self._optional_post("inauspicious_timings", INAUSPICIOUS_TIMINGS_URL, query)
        if warning:
            warnings.append(warning)
        choghadiya = None
        festivals = None
        if include_choghadiya:
            choghadiya, warning = self._optional_post("choghadiya", CHOGHADIYA_URL, query)
            if warning:
                warnings.append(warning)
        if include_festivals:
            festivals, warning = self._optional_post("festivals", FESTIVALS_URL, query, include_language=False)
            if warning:
                warnings.append(warning)

        payload = normalize_day(query, panchang, auspicious, inauspicious, choghadiya, festivals)
        if warnings:
            payload["warnings"] = warnings
        self._save_cached_day(query, payload, cache_file)
        return payload

    def get_month(
        self,
        year: int,
        month: int,
        coordinates: str = DEFAULT_COORDINATES,
        language: str = DEFAULT_LANGUAGE,
        calendar: str = DEFAULT_CALENDAR,
        cache_only: bool = False,
    ) -> dict[str, Any]:
        import calendar as calendar_module

        days = []
        missing_dates = []
        total_days = calendar_module.monthrange(year, month)[1]
        if cache_only:
            cached_days = self._get_cached_month(year, month, coordinates, language, calendar)
            for day in range(1, total_days + 1):
                current = f"{year}-{month:02d}-{day:02d}"
                cached = cached_days.get(current)
                if cached:
                    cached["cache"] = cached.get("cache") or "database"
                    days.append(cached)
                else:
                    missing_dates.append(current)
            return {
                "status": "ok",
                "source": "database-cache",
                "year": year,
                "month": month,
                "coordinates": coordinates,
                "calendar": calendar,
                "language": language,
                "missing_dates": missing_dates,
                "days": days,
            }

        for day in range(1, total_days + 1):
            current = f"{year}-{month:02d}-{day:02d}"
            try:
                days.append(
                    self.get_day(
                        PanchangQuery(date=current, coordinates=coordinates, language=language, calendar=calendar),
                        cache_only=cache_only,
                    )
                )
            except DivineApiError as exc:
                if cache_only and exc.status_code == 404:
                    missing_dates.append(current)
                    continue
                raise
        return {
            "status": "ok",
            "source": "database-cache" if cache_only else "divineapi-cache",
            "year": year,
            "month": month,
            "coordinates": coordinates,
            "calendar": calendar,
            "language": language,
            "missing_dates": missing_dates,
            "days": days,
        }

    def get_year(
        self,
        year: int,
        coordinates: str = DEFAULT_COORDINATES,
        language: str = DEFAULT_LANGUAGE,
        calendar: str = DEFAULT_CALENDAR,
        cache_only: bool = False,
    ) -> dict[str, Any]:
        return {
            "status": "ok",
            "source": "database-cache" if cache_only else "divineapi-cache",
            "year": year,
            "coordinates": normalize_coordinates(coordinates),
            "calendar": calendar,
            "language": language,
            "months": [self.get_month(year, month, coordinates, language, calendar, cache_only) for month in range(1, 13)],
        }

    def _get_cached_day(self, query: PanchangQuery, cache_file: Path) -> dict[str, Any] | None:
        if get_cached_panchang:
            try:
                cached = get_cached_panchang(query.date, normalize_coordinates(query.coordinates), query.calendar, query.language, query.ayanamsa)
                if cached:
                    cached["cache"] = "database"
                    return cached
            except Exception as exc:
                print(f"Database Panchang cache read skipped: {exc}")

        for candidate in self._cache_file_candidates(query):
            if candidate.exists():
                cached = json.loads(candidate.read_text(encoding="utf-8"))
                cached["cache"] = "file"
                return cached
        return None

    def _get_cached_month(self, year: int, month: int, coordinates: str, language: str, calendar: str) -> dict[str, dict[str, Any]]:
        cached_days = {}
        if get_cached_panchang_month:
            try:
                import calendar as calendar_module

                start_date = f"{year}-{month:02d}-01"
                end_date = f"{year}-{month:02d}-{calendar_module.monthrange(year, month)[1]:02d}"
                cached_days.update(
                    get_cached_panchang_month(
                        start_date,
                        end_date,
                        normalize_coordinates(coordinates),
                        calendar,
                        language,
                        CACHE_VERSION,
                    )
                )
            except Exception as exc:
                print(f"Database Panchang month cache read skipped: {exc}")
        file_days = self._get_cached_month_files(year, month, coordinates, language, calendar)
        file_days.update(cached_days)
        return file_days

    def _get_cached_month_files(self, year: int, month: int, coordinates: str, language: str, calendar: str) -> dict[str, dict[str, Any]]:
        import calendar as calendar_module

        cached_days = {}
        for day in range(1, calendar_module.monthrange(year, month)[1] + 1):
            current = f"{year}-{month:02d}-{day:02d}"
            query = PanchangQuery(date=current, coordinates=coordinates, language=language, calendar=calendar)
            for cache_file in self._cache_file_candidates(query):
                if cache_file.exists():
                    cached = json.loads(cache_file.read_text(encoding="utf-8"))
                    cached["cache"] = "file"
                    cached_days[current] = cached
                    break
        return cached_days

    def _save_cached_day(self, query: PanchangQuery, payload: dict[str, Any], cache_file: Path) -> None:
        if save_cached_panchang:
            try:
                save_cached_panchang(query.date, normalize_coordinates(query.coordinates), query.calendar, query.language, query.ayanamsa, payload)
                payload["cache"] = "database"
            except Exception as exc:
                print(f"Database Panchang cache write skipped: {exc}")

        cache_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def _cache_file_candidates(self, query: PanchangQuery) -> list[Path]:
        return [
            CACHE_DIR / cache_key_for(query.date, coordinates, query.calendar, query.language, query.ayanamsa)
            for coordinates in coordinate_variants(query.coordinates)
        ]

    def _post(self, label: str, url: str, query: PanchangQuery, include_language: bool = True, include_sign_language: bool = False) -> dict[str, Any]:
        body = self._body(query, include_language=include_language)
        if include_sign_language:
            body["sign_lan"] = "en"
        response = requests.post(
            url,
            data=body,
            headers={"Authorization": f"Bearer {self.access_token}", "Accept": "application/json"},
            timeout=30,
        )
        self._raise_for_response(response)
        payload = response.json()
        if payload.get("success") in (0, False):
            raise DivineApiError(payload.get("message") or f"DivineAPI {label} request failed.", response.status_code, payload)
        return payload

    def _optional_post(
        self,
        label: str,
        url: str,
        query: PanchangQuery,
        include_language: bool = True,
    ) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        try:
            return self._post(label, url, query, include_language=include_language), None
        except DivineApiError as exc:
            return None, {"endpoint": label, "status_code": exc.status_code, "message": str(exc), "upstream": exc.payload}

    def _body(self, query: PanchangQuery, include_language: bool = True) -> dict[str, str]:
        day, month, year = query.date_parts
        lat, lon = query.lat_lon
        body = {
            "api_key": self.api_key,
            "day": str(day),
            "month": str(month),
            "year": str(year),
            "place": query.place,
            "lat": lat,
            "lon": lon,
            "tzone": str(query.tzone),
        }
        if include_language:
            body["lan"] = query.language
        return body

    @staticmethod
    def _raise_for_response(response: requests.Response) -> None:
        if response.ok:
            return
        try:
            payload = response.json()
        except ValueError:
            payload = response.text
        detail = None
        if isinstance(payload, dict):
            detail = payload.get("message") or payload.get("error") or payload.get("detail")
            errors = payload.get("errors")
            if errors and isinstance(errors, list):
                detail = "; ".join(error.get("message") or error.get("detail") or str(error) for error in errors)
        raise DivineApiError(detail or "DivineAPI request failed.", response.status_code, payload)


def normalize_day(
    query: PanchangQuery,
    panchang_response: dict[str, Any],
    auspicious_response: dict[str, Any] | None,
    inauspicious_response: dict[str, Any] | None,
    choghadiya_response: dict[str, Any] | None,
    festivals_response: dict[str, Any] | None,
) -> dict[str, Any]:
    panchang = _data(panchang_response)
    auspicious = _data(auspicious_response)
    inauspicious = _data(inauspicious_response)
    choghadiya = _data(choghadiya_response)
    festivals = _data(festivals_response)

    tithi = _current_or_first(panchang.get("tithis") or panchang.get("tithi"))
    nakshatra = _current_or_first(panchang.get("nakshatras") or panchang.get("nakshatra"))
    yoga = _current_or_first(panchang.get("yogas") or panchang.get("yoga"))
    karana = _current_or_first(panchang.get("karnas") or panchang.get("karana"))

    return {
        "date": query.date,
        "coordinates": normalize_coordinates(query.coordinates),
        "calendar_type": query.calendar,
        "language": query.language,
        "source": "divineapi",
        "hindu_calendar": _hindu_calendar(query, panchang, tithi),
        "vaara": _first_value(panchang, "vaar", "vaara", "weekday", "day"),
        "tithi": _normalize_anga(tithi, "tithi"),
        "nakshatra": _normalize_anga(nakshatra, "nakshatra"),
        "yoga": _normalize_anga(yoga, "yoga"),
        "karana": _normalize_anga(karana, "karana"),
        "sunrise": _first_value(panchang, "sunrise", "sun_rise"),
        "sunset": _first_value(panchang, "sunset", "sun_set"),
        "moonrise": _first_value(panchang, "moonrise", "moon_rise"),
        "moonset": _first_value(panchang, "moonset", "moon_set"),
        "auspicious_period": _normalize_periods(auspicious, "Auspicious"),
        "inauspicious_period": _normalize_periods(inauspicious, "Inauspicious"),
        "choghadiya": _normalize_choghadiya(choghadiya),
        "festivals": _normalize_festivals(festivals),
        "hora": [],
        "raw": {
            "panchang": panchang,
            "auspicious_timings": auspicious,
            "inauspicious_timings": inauspicious,
            "choghadiya": choghadiya,
            "festivals": festivals,
        },
    }


def _data(response: dict[str, Any] | None) -> dict[str, Any]:
    if not response:
        return {}
    data = response.get("data", response)
    return data if isinstance(data, dict) else {}


def _current_or_first(items: Any) -> dict[str, Any]:
    if isinstance(items, dict):
        return items
    if isinstance(items, list) and items:
        first = items[0]
        return first if isinstance(first, dict) else {}
    return {}


def _hindu_calendar(query: PanchangQuery, panchang: dict[str, Any], tithi: dict[str, Any]) -> dict[str, Any]:
    chandramasa = _first_value(panchang, "chandramasa", "lunar_month", "hindu_month")
    samvat = _first_value(panchang, "samvat", "vikram_samvat", "shaka_samvat")
    day_value = _first_value(tithi, "number", "tithi_number", "day")
    return {
        "name": query.calendar.title(),
        "month_name": chandramasa,
        "day": day_value,
        "year": samvat,
        "year_name": "",
    }


def _normalize_anga(item: dict[str, Any], prefix: str) -> dict[str, Any]:
    lord = _first_value(item, "lord", "nak_lord", "ruling_planet")
    return {
        "id": _first_value(item, "id", "number", f"{prefix}_number"),
        "name": _first_value(item, "name", f"{prefix}", f"{prefix}_name", "nak_name", "karana_name", "yoga_name"),
        "paksha": _first_value(item, "paksha"),
        "start": _first_value(item, "start", "start_time"),
        "end": _first_value(item, "end", "end_time"),
        "lord": {"name": lord} if lord else {},
    }


def _normalize_periods(data: dict[str, Any], period_type: str) -> list[dict[str, Any]]:
    periods = []
    for key, value in data.items():
        if key in {"date", "sunrise", "sunset"} or not value:
            continue
        values = value if isinstance(value, list) else [value]
        normalized = []
        for item in values:
            if not isinstance(item, dict):
                continue
            start = _first_value(item, "start", "start_time")
            end = _first_value(item, "end", "end_time")
            if start and end:
                normalized.append({"start": start, "end": end})
        if normalized:
            periods.append({"name": _label(key), "type": period_type, "period": normalized})
    return periods


def _normalize_choghadiya(data: dict[str, Any]) -> list[dict[str, Any]]:
    output = []
    for key, is_day in (("day_choghadiyas", True), ("night_choghadiyas", False)):
        slots = data.get(key, {})
        if not isinstance(slots, dict):
            continue
        for name, time_range in slots.items():
            start, end = _split_range(str(time_range))
            clean_name = name.replace("Next ", "")
            output.append(
                {
                    "name": clean_name,
                    "type": _choghadiya_type(clean_name),
                    "is_day": is_day,
                    "start": start,
                    "end": end,
                    "time": time_range,
                }
            )
    return output


def _normalize_festivals(data: dict[str, Any]) -> list[dict[str, Any]]:
    festivals = []
    for key, value in data.items():
        if not isinstance(value, dict):
            continue
        festivals.append(
            {
                "name": _label(key),
                "date": value.get("date"),
                "start_date": value.get("start_date"),
                "end_date": value.get("end_date"),
                "image": value.get("image") or value.get("start_image") or value.get("end_image"),
            }
        )
    return festivals


def _first_value(source: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = source.get(key)
        if value not in (None, "", []):
            return value
    return ""


def _label(value: str) -> str:
    return value.replace("_", " ").strip().title()


def _split_range(value: str) -> tuple[str, str]:
    if " to " not in value:
        return "", ""
    start, end = value.split(" to ", 1)
    return start.strip(), end.strip()


def _choghadiya_type(name: str) -> str:
    base = name.lower().replace("next ", "")
    if base in {"amrit", "shubh", "labh"}:
        return "Auspicious"
    if base == "char":
        return "Good"
    if base in {"kaal", "rog", "udveg"}:
        return "Inauspicious"
    return ""
