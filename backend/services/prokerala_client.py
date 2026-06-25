from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
import json
import os
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv


PROKERALA_BASE_URL = "https://api.prokerala.com"
CACHE_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(CACHE_ROOT / ".env")
DEFAULT_COORDINATES = os.getenv("PANCHANG_DEFAULT_COORDINATES", "28.6139,77.2090")
DEFAULT_AYANAMSA = int(os.getenv("PROKERALA_AYANAMSA", "1"))
DEFAULT_LANGUAGE = os.getenv("PROKERALA_LANGUAGE", "en")
DEFAULT_CALENDAR = os.getenv("PROKERALA_CALENDAR", "amanta")

CACHE_DIR = Path(__file__).resolve().parents[1] / "data" / "prokerala_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)


class ProkeralaConfigError(RuntimeError):
    pass


class ProkeralaApiError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None, payload: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


@dataclass(frozen=True)
class PanchangQuery:
    date: str
    coordinates: str = DEFAULT_COORDINATES
    ayanamsa: int = DEFAULT_AYANAMSA
    language: str = DEFAULT_LANGUAGE
    calendar: str = DEFAULT_CALENDAR

    @property
    def datetime(self) -> str:
        return f"{self.date}T09:00:00+05:30"

    @property
    def cache_key(self) -> str:
        safe_coordinates = self.coordinates.replace(",", "_").replace(".", "-")
        return f"{self.date}_{safe_coordinates}_{self.calendar}_{self.language}_{self.ayanamsa}.json"


class ProkeralaClient:
    def __init__(self) -> None:
        self.client_id = os.getenv("PROKERALA_CLIENT_ID")
        self.client_secret = os.getenv("PROKERALA_CLIENT_SECRET")
        self.base_url = os.getenv("PROKERALA_BASE_URL", PROKERALA_BASE_URL).rstrip("/")
        self._access_token: str | None = None
        self._token_expires_at = datetime.min.replace(tzinfo=timezone.utc)
        if not self.client_id or not self.client_secret:
            raise ProkeralaConfigError("PROKERALA_CLIENT_ID and PROKERALA_CLIENT_SECRET must be set on the backend.")

    def get_day(self, query: PanchangQuery, force_refresh: bool = False, include_timing_details: bool = False) -> dict[str, Any]:
        cache_file = CACHE_DIR / query.cache_key
        if cache_file.exists() and not force_refresh:
            return json.loads(cache_file.read_text(encoding="utf-8"))

        warnings = []
        advanced = self._get(
            "/v2/astrology/panchang/advanced",
            {
                "ayanamsa": query.ayanamsa,
                "coordinates": query.coordinates,
                "datetime": query.datetime,
                "la": query.language,
            },
        ).get("data", {})
        calendar = self._get(
            "/v2/calendar",
            {
                "date": query.date,
                "calendar": query.calendar,
                "la": query.language,
            },
        ).get("data", {}).get("calendar_date", {})
        choghadiya = []
        hora = []
        if include_timing_details:
            choghadiya_response, warning = self._optional_get(
                "/v2/astrology/choghadiya",
                {
                    "ayanamsa": query.ayanamsa,
                    "coordinates": query.coordinates,
                    "datetime": query.datetime,
                    "la": query.language,
                },
                "choghadiya",
            )
            if warning:
                warnings.append(warning)
            choghadiya = choghadiya_response.get("data", {}).get("muhurat", []) if choghadiya_response else []

            hora_response, warning = self._optional_get(
                "/v2/astrology/hora",
                {
                    "ayanamsa": query.ayanamsa,
                    "coordinates": query.coordinates,
                    "datetime": query.datetime,
                    "la": query.language,
                },
                "hora",
            )
            if warning:
                warnings.append(warning)
            hora = hora_response.get("data", {}).get("hora_timing", []) if hora_response else []

        payload = normalize_day(query, advanced, calendar, choghadiya, hora)
        if warnings:
            payload["warnings"] = warnings
        cache_file.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return payload

    def get_month(self, year: int, month: int, coordinates: str = DEFAULT_COORDINATES, language: str = DEFAULT_LANGUAGE, calendar: str = DEFAULT_CALENDAR, include_timing_details: bool = False) -> dict[str, Any]:
        import calendar as calendar_module

        days = []
        for day in range(1, calendar_module.monthrange(year, month)[1] + 1):
            current = f"{year}-{month:02d}-{day:02d}"
            days.append(self.get_day(PanchangQuery(date=current, coordinates=coordinates, language=language, calendar=calendar), include_timing_details=include_timing_details))
        return {
            "status": "ok",
            "source": "prokerala-cache",
            "year": year,
            "month": month,
            "coordinates": coordinates,
            "calendar": calendar,
            "language": language,
            "days": days,
        }

    def get_year(self, year: int, coordinates: str = DEFAULT_COORDINATES, language: str = DEFAULT_LANGUAGE, calendar: str = DEFAULT_CALENDAR, include_timing_details: bool = False) -> dict[str, Any]:
        return {
            "status": "ok",
            "source": "prokerala-cache",
            "year": year,
            "coordinates": coordinates,
            "calendar": calendar,
            "language": language,
            "months": [self.get_month(year, month, coordinates, language, calendar, include_timing_details) for month in range(1, 13)],
        }

    def _token(self) -> str:
        now = datetime.now(timezone.utc)
        if self._access_token and now < self._token_expires_at:
            return self._access_token

        response = requests.post(
            f"{self.base_url}/token",
            data={
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            },
            timeout=30,
        )
        self._raise_for_response(response)
        payload = response.json()
        token = payload.get("access_token")
        if not token:
            raise ProkeralaApiError("Prokerala token response did not include access_token.", payload=payload)
        self._access_token = token
        self._token_expires_at = now + timedelta(seconds=max(int(payload.get("expires_in", 3600)) - 60, 60))
        return token

    def _get(self, path: str, params: dict[str, Any]) -> dict[str, Any]:
        response = requests.get(
            f"{self.base_url}{path}",
            params=params,
            headers={"Authorization": f"Bearer {self._token()}", "Accept": "application/json"},
            timeout=30,
        )
        self._raise_for_response(response)
        return response.json()

    def _optional_get(self, path: str, params: dict[str, Any], label: str) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
        try:
            return self._get(path, params), None
        except ProkeralaApiError as exc:
            return None, {
                "endpoint": label,
                "status_code": exc.status_code,
                "message": str(exc),
                "upstream": exc.payload,
            }

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
            errors = payload.get("errors")
            if errors and isinstance(errors, list):
                detail = "; ".join(error.get("detail") or error.get("title") or str(error) for error in errors)
            detail = detail or payload.get("message")
        raise ProkeralaApiError(detail or "Prokerala API request failed.", response.status_code, payload)


def normalize_day(query: PanchangQuery, panchang: dict[str, Any], calendar_date: dict[str, Any], choghadiya: list[dict[str, Any]], hora: list[dict[str, Any]]) -> dict[str, Any]:
    tithi = _current_or_first(panchang.get("tithi", []), query.datetime)
    nakshatra = _current_or_first(panchang.get("nakshatra", []), query.datetime)
    yoga = _current_or_first(panchang.get("yoga", []), query.datetime)
    karana = _current_or_first(panchang.get("karana", []), query.datetime)

    return {
        "date": query.date,
        "coordinates": query.coordinates,
        "calendar_type": query.calendar,
        "language": query.language,
        "source": "prokerala",
        "hindu_calendar": calendar_date,
        "vaara": panchang.get("vaara"),
        "tithi": tithi,
        "nakshatra": nakshatra,
        "yoga": yoga,
        "karana": karana,
        "sunrise": panchang.get("sunrise"),
        "sunset": panchang.get("sunset"),
        "moonrise": panchang.get("moonrise"),
        "moonset": panchang.get("moonset"),
        "auspicious_period": panchang.get("auspicious_period", []),
        "inauspicious_period": panchang.get("inauspicious_period", []),
        "choghadiya": choghadiya,
        "hora": hora,
        "raw": {
            "panchang": panchang,
            "calendar_date": calendar_date,
        },
    }


def _current_or_first(items: list[dict[str, Any]], dt_value: str) -> dict[str, Any]:
    if not items:
        return {}
    try:
        current = datetime.fromisoformat(dt_value)
        for item in items:
            start = datetime.fromisoformat(item["start"])
            end = datetime.fromisoformat(item["end"])
            if start <= current <= end:
                return item
    except Exception:
        pass
    return items[0]
