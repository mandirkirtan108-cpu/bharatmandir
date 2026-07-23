"""Automation helpers for the volunteer Add Temple workflow."""

import base64
import json
import math
import os
import re
import time
from typing import Any
from urllib.parse import parse_qs, unquote, urljoin, urlparse

import httpx
from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile
from pydantic import BaseModel, Field

from db.connection import get_db_cursor
from routers.volunteer_auth import get_current_volunteer


router = APIRouter(
    prefix="/api/volunteer/automation",
    tags=["Volunteer Automation"],
)

NOMINATIM_URL = "https://nominatim.openstreetmap.org"
REQUEST_HEADERS = {
    "User-Agent": os.getenv(
        "GEOCODING_USER_AGENT",
        "BharatMandir/1.0 (temple-data-volunteers)",
    )
}
_GEOCODE_CACHE: dict[str, tuple[float, Any]] = {}
GEOCODE_CACHE_TTL_SECONDS = 60 * 60 * 24
ORS_REVERSE_URL = "https://api.openrouteservice.org/geocode/reverse"
ORS_SEARCH_URL = "https://api.openrouteservice.org/geocode/search"
ORS_MATRIX_URL = "https://api.openrouteservice.org/v2/matrix/driving-car"
GOOGLE_MAP_HOSTS = {
    "google.com", "www.google.com", "maps.google.com", "maps.app.goo.gl",
    "goo.gl", "www.goo.gl",
}


class SuggestionRequest(BaseModel):
    temple_name: str = Field(max_length=255)
    city: str | None = Field(default=None, max_length=120)
    state: str | None = Field(default=None, max_length=120)
    signboard_text: str | None = Field(default=None, max_length=5000)


class TranslationRequest(BaseModel):
    text: str = Field(min_length=2, max_length=12000)


def _address_payload(item: dict[str, Any]) -> dict[str, Any]:
    address = item.get("address") or {}
    return {
        "display_name": item.get("display_name"),
        "latitude": float(item["lat"]) if item.get("lat") else None,
        "longitude": float(item["lon"]) if item.get("lon") else None,
        "address": item.get("display_name"),
        "city": address.get("city") or address.get("town") or address.get("village") or address.get("hamlet"),
        "district": address.get("state_district") or address.get("county"),
        "state": address.get("state"),
        "pincode": address.get("postcode"),
        "country": address.get("country"),
        "osm_id": str(item.get("osm_id") or ""),
        "source": "openstreetmap",
    }


async def _nominatim_get(path: str, params: dict[str, Any]) -> Any:
    cache_key = f"{path}:{json.dumps(params, sort_keys=True)}"
    cached = _GEOCODE_CACHE.get(cache_key)
    if cached and cached[0] > time.time():
        return cached[1]
    try:
        async with httpx.AsyncClient(timeout=12, headers=REQUEST_HEADERS) as client:
            response = await client.get(f"{NOMINATIM_URL}{path}", params=params)
            response.raise_for_status()
            payload = response.json()
            if len(_GEOCODE_CACHE) > 1000:
                _GEOCODE_CACHE.clear()
            _GEOCODE_CACHE[cache_key] = (time.time() + GEOCODE_CACHE_TTL_SECONDS, payload)
            return payload
    except httpx.HTTPError as error:
        raise HTTPException(status_code=502, detail="Location service is temporarily unavailable") from error


def _validate_google_maps_url(value: str) -> str:
    value = value.strip()
    if not value.startswith(("https://", "http://")):
        value = f"https://{value}"
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or (parsed.hostname or "").lower() not in GOOGLE_MAP_HOSTS:
        raise HTTPException(status_code=400, detail="Paste a valid Google Maps link")
    return value


async def _expand_google_maps_url(value: str) -> str:
    current = _validate_google_maps_url(value)
    async with httpx.AsyncClient(timeout=10, follow_redirects=False, headers=REQUEST_HEADERS) as client:
        for _ in range(6):
            try:
                response = await client.get(current)
            except httpx.HTTPError as error:
                raise HTTPException(status_code=502, detail="The Google Maps link could not be opened") from error
            if response.status_code not in {301, 302, 303, 307, 308}:
                return str(response.url)
            location = response.headers.get("location")
            if not location:
                break
            current = _validate_google_maps_url(urljoin(current, location))
    raise HTTPException(status_code=400, detail="The Google Maps link has too many redirects")


def _extract_maps_coordinates(value: str) -> tuple[float, float]:
    decoded = unquote(value)
    # Google URLs may contain both a viewport centre (`@lat,lng`) and the
    # actual selected place (`!3dlat!4dlng`). Always prefer the place pin.
    direct_patterns = (
        (r"!3d(-?\d{1,2}(?:\.\d+)?)[^!]*!4d(-?\d{1,3}(?:\.\d+)?)", False),
        # Some Google data blocks encode longitude first as !2d, then latitude as !3d.
        (r"!2d(-?\d{1,3}(?:\.\d+)?)[^!]*!3d(-?\d{1,2}(?:\.\d+)?)", True),
    )
    for pattern, reverse_order in direct_patterns:
        match = re.search(pattern, decoded)
        if match:
            first, second = map(float, match.groups())
            latitude, longitude = (second, first) if reverse_order else (first, second)
            if -90 <= latitude <= 90 and -180 <= longitude <= 180:
                return latitude, longitude

    # Explicit coordinate query parameters are also exact user selections.
    query = parse_qs(urlparse(decoded).query)
    for key in ("q", "query", "ll", "center"):
        raw = (query.get(key) or [""])[0]
        match = re.search(r"(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)", raw)
        if match:
            latitude, longitude = map(float, match.groups())
            if -90 <= latitude <= 90 and -180 <= longitude <= 180:
                return latitude, longitude

    # Last resort only: this is often the visible map centre, not the place pin.
    viewport_match = re.search(
        r"@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)",
        decoded,
    )
    if viewport_match:
        latitude, longitude = map(float, viewport_match.groups())
        if -90 <= latitude <= 90 and -180 <= longitude <= 180:
            return latitude, longitude
    raise HTTPException(status_code=422, detail="Coordinates were not found in this link. Open the exact place in Google Maps, tap Share, and paste that link.")


def _maps_place_name(value: str) -> str | None:
    match = re.search(r"/maps/place/([^/@?]+)", unquote(value), re.IGNORECASE)
    if match:
        return re.sub(r"\s+", " ", match.group(1).replace("+", " ")).strip() or None
    return None


def _complete_address(location: dict[str, Any], place_name: str | None = None) -> str | None:
    """Build a readable address from all non-duplicate geocoder fields."""
    parts: list[str] = []

    def add(value: Any) -> None:
        text = re.sub(r"\s+", " ", str(value or "")).strip(" ,")
        if not text:
            return
        normalized = text.casefold()
        if any(normalized == existing.casefold() for existing in parts):
            return
        # Do not add a component already contained in a longer address part.
        if any(normalized in existing.casefold() for existing in parts):
            return
        parts.append(text)

    add(place_name)
    add(location.get("address") or location.get("display_name"))
    add(location.get("city"))
    add(location.get("district"))
    add(location.get("state"))
    add(location.get("pincode"))
    add(location.get("country") or "India")
    return ", ".join(parts) or None


def _distance_km(latitude: float, longitude: float, other_latitude: float, other_longitude: float) -> float:
    p1, p2 = math.radians(latitude), math.radians(other_latitude)
    dp = math.radians(other_latitude - latitude)
    dl = math.radians(other_longitude - longitude)
    value = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 6371 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


async def _nearby_pincode(latitude: float, longitude: float, location: dict[str, Any]) -> str | None:
    """Find a nearby postal code without guessing from an unrelated district."""
    city, district, state = location.get("city"), location.get("district"), location.get("state")
    queries = [
        ", ".join(filter(None, (city, district, state, "India"))),
        ", ".join(filter(None, (district, state, "India"))),
    ]
    candidates: list[tuple[float, str]] = []
    for query in dict.fromkeys(item for item in queries if item and item != "India"):
        try:
            results = await _nominatim_get(
                "/search",
                {"q": query, "format": "jsonv2", "addressdetails": 1, "limit": 8, "countrycodes": "in"},
            )
        except HTTPException:
            continue
        for result in results or []:
            postcode = (result.get("address") or {}).get("postcode")
            try:
                result_latitude, result_longitude = float(result["lat"]), float(result["lon"])
            except (KeyError, TypeError, ValueError):
                continue
            if postcode and re.fullmatch(r"[1-9]\d{5}", str(postcode)):
                candidates.append((_distance_km(latitude, longitude, result_latitude, result_longitude), str(postcode)))
    if not candidates:
        return None
    distance, postcode = min(candidates, key=lambda item: item[0])
    return postcode if distance <= 25 else None


async def _postal_location_from_ors(pincode: str) -> dict[str, Any] | None:
    """Resolve a PIN code so border-area state/district labels stay consistent."""
    ors_key = os.getenv("OPENROUTESERVICE_API_KEY")
    if not ors_key or not re.fullmatch(r"[1-9]\d{5}", pincode or ""):
        return None
    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(
                ORS_SEARCH_URL,
                params={"text": pincode, "boundary.country": "IN", "size": 5},
                headers={"Authorization": ors_key},
            )
            response.raise_for_status()
            for feature in response.json().get("features") or []:
                props = feature.get("properties") or {}
                if str(props.get("postalcode") or "") == pincode:
                    return {
                        "city": props.get("locality") or props.get("localadmin"),
                        "district": props.get("county") or props.get("macrocounty"),
                        "state": props.get("region") or props.get("macroregion"),
                    }
    except (httpx.HTTPError, ValueError, TypeError):
        return None
    return None


async def _reconcile_postal_location(location: dict[str, Any]) -> dict[str, Any]:
    pincode = str(location.get("pincode") or "")
    postal = await _postal_location_from_ors(pincode)
    if not postal:
        return location
    # A validated PIN is more reliable than a border-area reverse-geocoder
    # label for state and district. Keep the detected locality when possible.
    if postal.get("state"):
        location["state"] = postal["state"]
    if postal.get("district"):
        location["district"] = postal["district"]
    if not location.get("city") and postal.get("city"):
        location["city"] = postal["city"]
    return location


async def _reverse_location(latitude: float, longitude: float) -> dict[str, Any]:
    ors_location: dict[str, Any] | None = None
    ors_key = os.getenv("OPENROUTESERVICE_API_KEY")
    if ors_key:
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                response = await client.get(
                    ORS_REVERSE_URL,
                    params={"point.lon": longitude, "point.lat": latitude, "size": 1},
                    headers={"Authorization": ors_key},
                )
                response.raise_for_status()
                feature = (response.json().get("features") or [None])[0]
                if feature:
                    props = feature.get("properties") or {}
                    label = props.get("label") or ""
                    pincode = props.get("postalcode")
                    if not pincode:
                        pin_match = re.search(r"(?<!\d)[1-9]\d{5}(?!\d)", label)
                        pincode = pin_match.group(0) if pin_match else None
                    ors_location = {
                        "display_name": props.get("label"), "address": props.get("label"),
                        "latitude": latitude, "longitude": longitude,
                        "city": props.get("locality") or props.get("localadmin") or props.get("neighbourhood"),
                        "district": props.get("county") or props.get("macrocounty"),
                        "state": props.get("region") or props.get("macroregion"),
                        "pincode": pincode, "country": props.get("country"),
                        "source": "openrouteservice",
                    }
        except (httpx.HTTPError, ValueError, TypeError):
            pass

    # ORS sometimes omits the Indian PIN code. Enrich only missing address
    # fields with Nominatim while keeping ORS as the primary data source.
    if ors_location and all(ors_location.get(key) for key in ("pincode", "city", "district", "state")):
        return await _reconcile_postal_location(ors_location)
    try:
        item = await _nominatim_get(
            "/reverse",
            {"lat": latitude, "lon": longitude, "format": "jsonv2", "addressdetails": 1, "zoom": 18},
        )
        osm_location = _address_payload(item)
    except HTTPException:
        if ors_location:
            return ors_location
        raise
    if not ors_location:
        if not osm_location.get("pincode"):
            osm_location["pincode"] = await _nearby_pincode(latitude, longitude, osm_location)
        return await _reconcile_postal_location(osm_location)
    for key in ("display_name", "address", "city", "district", "state", "pincode", "country", "osm_id"):
        if not ors_location.get(key) and osm_location.get(key):
            ors_location[key] = osm_location[key]
    ors_location["source"] = "openrouteservice+openstreetmap"
    if not ors_location.get("pincode"):
        ors_location["pincode"] = await _nearby_pincode(latitude, longitude, ors_location)
    return await _reconcile_postal_location(ors_location)


async def _ors_transport_candidates(
    api_key: str,
    latitude: float,
    longitude: float,
) -> list[dict[str, Any]]:
    """Find nearby transport places with ORS geocoding and add road distances."""
    searches = {
        "railway": (("railway station", "train station"), 100),
        "airport": (("airport",), 300),
        "bus": (("bus station", "bus stand"), 60),
    }
    candidates: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=18) as client:
        for transport_type, (queries, search_radius_km) in searches.items():
            found: dict[tuple[float, float], dict[str, Any]] = {}
            for search_text in queries:
                response = await client.get(
                    ORS_SEARCH_URL,
                    params={
                        "text": search_text,
                        "focus.point.lat": latitude,
                        "focus.point.lon": longitude,
                        "boundary.circle.lat": latitude,
                        "boundary.circle.lon": longitude,
                        "boundary.circle.radius": search_radius_km,
                        "boundary.country": "IN",
                        "layers": "venue",
                        "size": 8,
                    },
                    headers={"Authorization": api_key},
                )
                response.raise_for_status()
                for feature in response.json().get("features") or []:
                    coordinates = (feature.get("geometry") or {}).get("coordinates") or []
                    if len(coordinates) < 2:
                        continue
                    candidate_lon, candidate_lat = map(float, coordinates[:2])
                    props = feature.get("properties") or {}
                    name = (
                        props.get("name")
                        or props.get("label")
                        or props.get("locality")
                        or search_text.title()
                    )
                    key = (round(candidate_lat, 6), round(candidate_lon, 6))
                    found[key] = {
                        "type": transport_type,
                        "name": str(name).split(",")[0].strip(),
                        "latitude": candidate_lat,
                        "longitude": candidate_lon,
                        "straight_distance_km": _distance_km(
                            latitude, longitude, candidate_lat, candidate_lon
                        ),
                    }
            # Limit matrix usage while retaining the closest geocoding results.
            candidates.extend(
                sorted(found.values(), key=lambda item: item["straight_distance_km"])[:6]
            )

        if not candidates:
            return []

        matrix_response = await client.post(
            ORS_MATRIX_URL,
            json={
                "locations": [
                    [longitude, latitude],
                    *[
                        [candidate["longitude"], candidate["latitude"]]
                        for candidate in candidates
                    ],
                ],
                "sources": [0],
                "destinations": list(range(1, len(candidates) + 1)),
                "metrics": ["distance", "duration"],
                "units": "km",
            },
            headers={"Authorization": api_key, "Content-Type": "application/json"},
        )
        matrix_response.raise_for_status()
        matrix = matrix_response.json()
        distances = (matrix.get("distances") or [[]])[0]
        durations = (matrix.get("durations") or [[]])[0]
        for index, candidate in enumerate(candidates):
            candidate["distance_km"] = (
                float(distances[index])
                if index < len(distances) and distances[index] is not None
                else candidate["straight_distance_km"]
            )
            candidate["duration_minutes"] = (
                round(float(durations[index]) / 60)
                if index < len(durations) and durations[index] is not None
                else None
            )
    return candidates


@router.get("/nearby-transport")
async def nearby_transport(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    _volunteer: dict = Depends(get_current_volunteer),
):
    """Return the nearest railway station, airport and bus stand by road."""
    api_key = os.getenv("OPENROUTESERVICE_API_KEY") or os.getenv("ORS_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENROUTESERVICE_API_KEY is not configured on the backend",
        )
    try:
        candidates = await _ors_transport_candidates(api_key, latitude, longitude)
    except (httpx.HTTPError, ValueError, TypeError) as error:
        raise HTTPException(
            status_code=502,
            detail="The nearby transport service is temporarily unavailable",
        ) from error

    result: dict[str, Any] = {}
    field_names = {
        "railway": "nearest_railway",
        "airport": "nearest_airport",
        "bus": "nearest_bus_stand",
    }
    for transport_type, field_name in field_names.items():
        matching = [
            candidate for candidate in candidates
            if candidate["type"] == transport_type
        ]
        if not matching:
            result[field_name] = None
            continue
        nearest = min(matching, key=lambda item: item["distance_km"])
        distance = round(nearest["distance_km"], 1)
        result[field_name] = f"{nearest['name']} — {distance:g} km"
        result[f"{field_name}_details"] = nearest
    return result


@router.get("/reverse-geocode")
async def reverse_geocode(
    latitude: float = Query(ge=-90, le=90),
    longitude: float = Query(ge=-180, le=180),
    _volunteer: dict = Depends(get_current_volunteer),
):
    location = await _reverse_location(latitude, longitude)
    location["address"] = _complete_address(location)
    return location


@router.get("/maps-link")
async def maps_link_autofill(
    url: str = Query(min_length=10, max_length=2048),
    _volunteer: dict = Depends(get_current_volunteer),
):
    expanded_url = await _expand_google_maps_url(url)
    latitude, longitude = _extract_maps_coordinates(expanded_url)
    location = await _reverse_location(latitude, longitude)
    place_name = _maps_place_name(expanded_url)
    location["address"] = _complete_address(location, place_name)
    return {
        **location,
        "name": place_name,
        "latitude": latitude,
        "longitude": longitude,
        "google_maps_link": url.strip(),
        "expanded_google_maps_link": expanded_url,
    }


@router.get("/place-search")
async def place_search(
    q: str = Query(min_length=3, max_length=255),
    limit: int = Query(default=6, ge=1, le=10),
    _volunteer: dict = Depends(get_current_volunteer),
):
    google_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if google_key:
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                response = await client.get(
                    "https://maps.googleapis.com/maps/api/place/textsearch/json",
                    params={"query": q, "key": google_key},
                )
                response.raise_for_status()
                results = response.json().get("results", [])[:limit]
                return [
                    {
                        "name": item.get("name"),
                        "display_name": item.get("formatted_address"),
                        "address": item.get("formatted_address"),
                        "latitude": item.get("geometry", {}).get("location", {}).get("lat"),
                        "longitude": item.get("geometry", {}).get("location", {}).get("lng"),
                        "google_place_id": item.get("place_id"),
                        "photo_reference": (item.get("photos") or [{}])[0].get("photo_reference"),
                        "opening_hours": item.get("opening_hours"),
                        "source": "google_places",
                    }
                    for item in results
                ]
        except httpx.HTTPError:
            pass

    results = await _nominatim_get(
        "/search",
        {"q": q, "format": "jsonv2", "addressdetails": 1, "limit": limit, "countrycodes": "in"},
    )
    return [{**_address_payload(item), "name": item.get("name") or item.get("display_name", "").split(",")[0]} for item in results]


@router.get("/duplicates")
def duplicate_candidates(
    name: str = Query(min_length=2, max_length=255),
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    address: str | None = Query(default=None, max_length=1000),
    _volunteer: dict = Depends(get_current_volunteer),
):
    with get_db_cursor() as cursor:
        cursor.execute(
            """
            SELECT id, name, address, city, district, state, latitude, longitude, slug
            FROM temples
            WHERE status = 'published'
              AND (
                name ILIKE %s
                OR (%s IS NOT NULL AND address ILIKE %s)
                OR (
                  %s IS NOT NULL AND %s IS NOT NULL
                  AND latitude BETWEEN %s - 0.01 AND %s + 0.01
                  AND longitude BETWEEN %s - 0.01 AND %s + 0.01
                )
              )
            LIMIT 12
            """,
            (
                f"%{name.strip()}%",
                address,
                f"%{(address or '').strip()[:80]}%",
                latitude,
                longitude,
                latitude,
                latitude,
                longitude,
                longitude,
            ),
        )
        rows = cursor.fetchall()

    for row in rows:
        row["distance_km"] = None
        if latitude is not None and longitude is not None and row.get("latitude") is not None:
            lat2, lon2 = float(row["latitude"]), float(row["longitude"])
            p1, p2 = math.radians(latitude), math.radians(lat2)
            dp, dl = math.radians(lat2 - latitude), math.radians(lon2 - longitude)
            a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
            row["distance_km"] = round(6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)), 2)
    return rows


@router.get("/place-details")
async def place_details(
    place_id: str = Query(min_length=5, max_length=255),
    _volunteer: dict = Depends(get_current_volunteer),
):
    google_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not google_key:
        raise HTTPException(status_code=503, detail="Google Places is not configured")
    async with httpx.AsyncClient(timeout=12) as client:
        response = await client.get(
            "https://maps.googleapis.com/maps/api/place/details/json",
            params={
                "place_id": place_id,
                "fields": "name,formatted_address,geometry,photos,opening_hours,formatted_phone_number,website",
                "key": google_key,
            },
        )
        response.raise_for_status()
        result = response.json().get("result") or {}
    periods = (result.get("opening_hours") or {}).get("periods") or []
    first_period = periods[0] if periods else {}
    opening_time = (first_period.get("open") or {}).get("time")
    closing_time = (first_period.get("close") or {}).get("time")
    normalize_time = lambda value: f"{value[:2]}:{value[2:]}" if value and len(value) == 4 else None
    location = (result.get("geometry") or {}).get("location") or {}
    photos = result.get("photos") or []
    return {
        "name": result.get("name"),
        "address": result.get("formatted_address"),
        "latitude": location.get("lat"),
        "longitude": location.get("lng"),
        "phone": result.get("formatted_phone_number"),
        "website_url": result.get("website"),
        "opening_time": normalize_time(opening_time),
        "closing_time": normalize_time(closing_time),
        "opening_hours_text": (result.get("opening_hours") or {}).get("weekday_text") or [],
        "photo_reference": photos[0].get("photo_reference") if photos else None,
    }


@router.get("/place-photo")
async def place_photo(
    reference: str = Query(min_length=10, max_length=1000),
    _volunteer: dict = Depends(get_current_volunteer),
):
    google_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not google_key:
        raise HTTPException(status_code=503, detail="Google Places is not configured")
    async with httpx.AsyncClient(timeout=18, follow_redirects=True) as client:
        response = await client.get(
            "https://maps.googleapis.com/maps/api/place/photo",
            params={"photoreference": reference, "maxwidth": 1600, "key": google_key},
        )
        response.raise_for_status()
    return Response(
        content=response.content,
        media_type=response.headers.get("content-type", "image/jpeg"),
        headers={"Cache-Control": "private, max-age=86400"},
    )


def _openai_json(prompt: str, image_data_url: str | None = None) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("VITE_OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="AI automation is not configured")
    from openai import OpenAI

    content: list[dict[str, Any]] = [{"type": "text", "text": prompt}]
    if image_data_url:
        content.append({"type": "image_url", "image_url": {"url": image_data_url}})
    response = OpenAI(api_key=api_key).chat.completions.create(
        model=os.getenv("OPENAI_AUTOFILL_MODEL", "gpt-4o-mini"),
        response_format={"type": "json_object"},
        messages=[{"role": "user", "content": content}],
        temperature=0.1,
        max_tokens=700,
    )
    return json.loads(response.choices[0].message.content or "{}")


@router.post("/ocr")
async def ocr_signboard(
    image: UploadFile = File(...),
    _volunteer: dict = Depends(get_current_volunteer),
):
    if image.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG, or WebP image")
    raw = await image.read()
    if len(raw) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image must be smaller than 8 MB")
    data_url = f"data:{image.content_type};base64,{base64.b64encode(raw).decode('ascii')}"
    prompt = (
        "Read this Indian temple signboard. Return JSON only with keys extracted_text, "
        "temple_name, address, trust_name, contact_phone. Use null when unknown. Do not invent facts."
    )
    return _openai_json(prompt, data_url)


@router.post("/suggestions")
def ai_suggestions(
    body: SuggestionRequest,
    _volunteer: dict = Depends(get_current_volunteer),
):
    prompt = (
        "Suggest metadata for an Indian temple volunteer to review. Return JSON only with keys "
        "primary_deity, temple_type, architecture_style, historical_period, famous_festivals "
        "(array), confidence_notes. Do not present guesses as verified facts. Input: "
        f"{body.model_dump_json()}"
    )
    return _openai_json(prompt)


@router.post("/translate-to-hindi")
def translate_to_hindi(
    body: TranslationRequest,
    _volunteer: dict = Depends(get_current_volunteer),
):
    """Translate volunteer-entered English temple content into natural Hindi."""
    source_text = body.text.strip()
    prompt = (
        "Translate the following Indian temple history from English into clear, "
        "natural Hindi written in Devanagari. Preserve temple names, place names, "
        "dates, numbers and factual meaning. Do not add, remove or invent facts. "
        "Return JSON only with one key named translation. Text: "
        f"{source_text}"
    )
    result = _openai_json(prompt)
    translation = str(result.get("translation") or "").strip()
    if not translation:
        raise HTTPException(status_code=502, detail="Hindi translation was not returned")
    return {"translation": translation}
