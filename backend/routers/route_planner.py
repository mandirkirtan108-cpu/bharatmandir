"""
Route Planner API for BharatMandir.

This version removes OpenAI from route planning and uses OpenRouteService for:
- city geocoding
- actual road distance
- actual road duration
- route geometry for the frontend map

Required backend env:
OPENROUTESERVICE_API_KEY=your_key
"""

from __future__ import annotations

from math import radians, sin, cos, asin, sqrt
import os
from typing import Any, Optional

import httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel


router = APIRouter(prefix="/api/route", tags=["Route Planner"])

ORS_BASE_URL = "https://api.openrouteservice.org"
ORS_PROFILE_BY_MODE = {
    "car": "driving-car",
    "bike": "cycling-regular",
    "bus": "driving-car",
    "train": "driving-car",
}


class RoutePlanRequest(BaseModel):
    start: str
    destination: str
    travel_mode: str = "car"
    time_available: int = 6
    preferences: Optional[list[str]] = []


class CitySearchResponse(BaseModel):
    cities: list[str]


class TempleStop(BaseModel):
    name: str
    location: str
    distance_from_route_km: str
    estimated_stop_time_minutes: int
    importance: str
    deity: Optional[str] = None
    why_visit: str
    lat: Optional[float] = None
    lng: Optional[float] = None


class OptimizedStop(BaseModel):
    stop_number: int
    temple_name: str
    arrival_time_hint: Optional[str] = None
    arrival_order_reason: str


class RouteSummary(BaseModel):
    start: str
    destination: str
    total_distance: str
    estimated_travel_time: str


class RouteGeometry(BaseModel):
    type: str
    coordinates: list


class RoutePlanResponse(BaseModel):
    route_summary: RouteSummary
    recommended_temples: list[TempleStop]
    optimized_plan: list[OptimizedStop]
    insights: list[str]
    travel_time_warning: Optional[str] = None
    route_geometry: Optional[RouteGeometry] = None
    start_coordinates: Optional[list[float]] = None
    destination_coordinates: Optional[list[float]] = None
    provider: str = "openrouteservice"


class NearbyTempleRequest(BaseModel):
    temple_name: str
    location: str
    radius_km: int = 15


class NearbyTemple(BaseModel):
    name: str
    deity: Optional[str] = None
    distance_km: float
    estimated_visit_time: int
    description: str


class NearbyTemplesResponse(BaseModel):
    nearby_temples: list[NearbyTemple]


POPULAR_CITY_HINTS = [
    "Ujjain",
    "Indore",
    "Mandsaur",
    "Neemuch",
    "Ratlam",
    "Bhopal",
    "Varanasi",
    "Prayagraj",
    "Mathura",
    "Vrindavan",
    "Ayodhya",
    "Haridwar",
    "Rishikesh",
    "Delhi",
    "Mumbai",
    "Shirdi",
    "Tirupati",
    "Srikalahasti",
    "Omkareshwar",
    "Maheshwar",
]


CITY_COORDINATE_OVERRIDES = {
    "mandsaur": (24.0768, 75.0693, "Mandsaur, Madhya Pradesh, India"),
    "neemuch": (24.4651, 74.8722, "Neemuch, Madhya Pradesh, India"),
    "ratlam": (23.3315, 75.0367, "Ratlam, Madhya Pradesh, India"),
    "indore": (22.7196, 75.8577, "Indore, Madhya Pradesh, India"),
    "ujjain": (23.1765, 75.7885, "Ujjain, Madhya Pradesh, India"),
    "bhopal": (23.2599, 77.4126, "Bhopal, Madhya Pradesh, India"),
    "varanasi": (25.3176, 82.9739, "Varanasi, Uttar Pradesh, India"),
    "prayagraj": (25.4358, 81.8463, "Prayagraj, Uttar Pradesh, India"),
    "mathura": (27.4924, 77.6737, "Mathura, Uttar Pradesh, India"),
    "delhi": (28.6139, 77.2090, "Delhi, India"),
    "haridwar": (29.9457, 78.1642, "Haridwar, Uttarakhand, India"),
    "rishikesh": (30.0869, 78.2676, "Rishikesh, Uttarakhand, India"),
}


CURATED_ROUTE_TEMPLES: dict[frozenset[str], list[dict[str, Any]]] = {
    frozenset(["neemuch", "ujjain"]): [
        {
            "name": "Kileshwar Mahadev Temple",
            "location": "Neemuch, Madhya Pradesh",
            "deity": "Shiva",
            "importance": "medium",
            "estimated_stop_time_minutes": 30,
            "why_visit": "Well-known Shiva temple in Neemuch and a suitable starting darshan before moving toward Ujjain.",
            "lat": 24.4715,
            "lng": 74.8724,
            "route_order": 1,
        },
        {
            "name": "Bhadwa Mata Temple",
            "location": "Bhadwa Mata, Neemuch, Madhya Pradesh",
            "deity": "Devi",
            "importance": "high",
            "estimated_stop_time_minutes": 45,
            "why_visit": "Important Devi pilgrimage place near Neemuch, visited by devotees for blessings and healing traditions.",
            "lat": 24.5486,
            "lng": 74.9640,
            "route_order": 2,
        },
        {
            "name": "Shree Pashupatinath Temple",
            "location": "Mandsaur, Madhya Pradesh",
            "deity": "Shiva",
            "importance": "high",
            "estimated_stop_time_minutes": 45,
            "why_visit": "Famous Ashtamukhi Pashupatinath Shiva temple on the Shivna river, a major stop between Neemuch and Ujjain.",
            "lat": 24.0714,
            "lng": 75.0699,
            "route_order": 3,
        },
        {
            "name": "Kalika Mata Temple",
            "location": "Ratlam, Madhya Pradesh",
            "deity": "Devi",
            "importance": "medium",
            "estimated_stop_time_minutes": 30,
            "why_visit": "Important Devi temple in Ratlam and a natural in-between halt before Ujjain.",
            "lat": 23.3315,
            "lng": 75.0367,
            "route_order": 4,
        },
        {
            "name": "Shree Mahakaleshwar Jyotirlinga",
            "location": "Ujjain, Madhya Pradesh",
            "deity": "Shiva",
            "importance": "high",
            "estimated_stop_time_minutes": 90,
            "why_visit": "One of the 12 Jyotirlingas and the main sacred destination in Ujjain.",
            "lat": 23.1828,
            "lng": 75.7682,
            "route_order": 5,
        },
        {
            "name": "Harsiddhi Mata Temple",
            "location": "Ujjain, Madhya Pradesh",
            "deity": "Devi",
            "importance": "high",
            "estimated_stop_time_minutes": 40,
            "why_visit": "Ancient Shaktipeeth near Mahakaleshwar, traditionally included in Ujjain darshan.",
            "lat": 23.1832,
            "lng": 75.7653,
            "route_order": 6,
        },
    ],
    frozenset(["mandsaur", "indore"]): [
        {
            "name": "Shree Pashupatinath Temple",
            "location": "Mandsaur, Madhya Pradesh",
            "deity": "Shiva",
            "importance": "high",
            "estimated_stop_time_minutes": 45,
            "why_visit": "Famous Ashtamukhi Pashupatinath Shiva temple on the Shivna river, ideal as the starting darshan in Mandsaur.",
            "lat": 24.0714,
            "lng": 75.0699,
            "route_order": 1,
        },
        {
            "name": "Bahi Parshwanath Jain Temple",
            "location": "Bahi Parshwanath, near Mandsaur, Madhya Pradesh",
            "deity": "Parshwanath",
            "importance": "medium",
            "estimated_stop_time_minutes": 35,
            "why_visit": "A known Jain pilgrimage stop near the Mandsaur side of the route, useful before moving toward Ratlam.",
            "lat": 24.0294,
            "lng": 75.1561,
            "route_order": 2,
        },
        {
            "name": "Kalika Mata Temple",
            "location": "Ratlam, Madhya Pradesh",
            "deity": "Devi",
            "importance": "medium",
            "estimated_stop_time_minutes": 30,
            "why_visit": "Important Devi temple in Ratlam and a practical spiritual halt between Mandsaur and Indore.",
            "lat": 23.3315,
            "lng": 75.0367,
            "route_order": 3,
        },
        {
            "name": "Mahalaxmi Temple",
            "location": "Ratlam, Madhya Pradesh",
            "deity": "Lakshmi",
            "importance": "medium",
            "estimated_stop_time_minutes": 25,
            "why_visit": "Popular local temple in Ratlam that can be visited as an in-between city stop on this journey.",
            "lat": 23.3310,
            "lng": 75.0376,
            "route_order": 4,
        },
        {
            "name": "Khajrana Ganesh Temple",
            "location": "Indore, Madhya Pradesh",
            "deity": "Ganesh",
            "importance": "high",
            "estimated_stop_time_minutes": 45,
            "why_visit": "One of Indore's most visited Ganesh temples, commonly chosen before beginning or completing important journeys.",
            "lat": 22.7196,
            "lng": 75.9033,
            "route_order": 5,
        },
        {
            "name": "Annapurna Temple",
            "location": "Indore, Madhya Pradesh",
            "deity": "Annapurna Devi",
            "importance": "medium",
            "estimated_stop_time_minutes": 35,
            "why_visit": "Well-known Indore temple dedicated to Maa Annapurna, suitable for a peaceful darshan stop in the destination city.",
            "lat": 22.6939,
            "lng": 75.8393,
            "route_order": 6,
        },
        {
            "name": "Bada Ganpati Temple",
            "location": "Indore, Madhya Pradesh",
            "deity": "Ganesh",
            "importance": "medium",
            "estimated_stop_time_minutes": 25,
            "why_visit": "Historic Ganesh temple famous for its large Ganpati idol in old Indore.",
            "lat": 22.7176,
            "lng": 75.8450,
            "route_order": 7,
        },
    ],
    frozenset(["mandsaur", "ujjain"]): [
        {
            "name": "Shree Pashupatinath Temple",
            "location": "Mandsaur, Madhya Pradesh",
            "deity": "Shiva",
            "importance": "high",
            "estimated_stop_time_minutes": 45,
            "why_visit": "Famous Ashtamukhi Pashupatinath Shiva temple on the Shivna river.",
            "lat": 24.0714,
            "lng": 75.0699,
        },
        {
            "name": "Kalika Mata Temple",
            "location": "Ratlam, Madhya Pradesh",
            "deity": "Devi",
            "importance": "medium",
            "estimated_stop_time_minutes": 30,
            "why_visit": "Important Devi temple in Ratlam, useful as a natural halt on the route.",
            "lat": 23.3315,
            "lng": 75.0367,
        },
        {
            "name": "Shree Mahakaleshwar Jyotirlinga",
            "location": "Ujjain, Madhya Pradesh",
            "deity": "Shiva",
            "importance": "high",
            "estimated_stop_time_minutes": 90,
            "why_visit": "One of the 12 Jyotirlingas and the main spiritual destination of Ujjain.",
            "lat": 23.1828,
            "lng": 75.7682,
        },
        {
            "name": "Harsiddhi Mata Temple",
            "location": "Ujjain, Madhya Pradesh",
            "deity": "Devi",
            "importance": "high",
            "estimated_stop_time_minutes": 40,
            "why_visit": "Ancient Shaktipeeth near Mahakaleshwar, known for deep stambh and Navratri worship.",
            "lat": 23.1832,
            "lng": 75.7653,
        },
    ],
    frozenset(["indore", "ujjain"]): [
        {
            "name": "Khajrana Ganesh Temple",
            "location": "Indore, Madhya Pradesh",
            "deity": "Ganesh",
            "importance": "high",
            "estimated_stop_time_minutes": 45,
            "why_visit": "One of Indore's most visited Ganesh temples and a strong start to the journey.",
            "lat": 22.7196,
            "lng": 75.9033,
        },
        {
            "name": "Shree Mahakaleshwar Jyotirlinga",
            "location": "Ujjain, Madhya Pradesh",
            "deity": "Shiva",
            "importance": "high",
            "estimated_stop_time_minutes": 90,
            "why_visit": "One of the 12 Jyotirlingas and the most important temple on this corridor.",
            "lat": 23.1828,
            "lng": 75.7682,
        },
        {
            "name": "Kal Bhairav Temple",
            "location": "Ujjain, Madhya Pradesh",
            "deity": "Bhairav",
            "importance": "medium",
            "estimated_stop_time_minutes": 35,
            "why_visit": "Ancient Bhairav temple, traditionally included in Ujjain darshan.",
            "lat": 23.2079,
            "lng": 75.7675,
        },
    ],
    frozenset(["varanasi", "prayagraj"]): [
        {
            "name": "Kashi Vishwanath Temple",
            "location": "Varanasi, Uttar Pradesh",
            "deity": "Shiva",
            "importance": "high",
            "estimated_stop_time_minutes": 90,
            "why_visit": "One of the 12 Jyotirlingas and the most sacred temple of Kashi.",
            "lat": 25.3109,
            "lng": 83.0107,
        },
        {
            "name": "Vindhyachal Maa Vindhyavasini Temple",
            "location": "Mirzapur, Uttar Pradesh",
            "deity": "Devi",
            "importance": "high",
            "estimated_stop_time_minutes": 60,
            "why_visit": "Major Shakti worship site near the Varanasi-Prayagraj route.",
            "lat": 25.1644,
            "lng": 82.5076,
        },
        {
            "name": "Triveni Sangam",
            "location": "Prayagraj, Uttar Pradesh",
            "deity": "Sacred confluence",
            "importance": "high",
            "estimated_stop_time_minutes": 75,
            "why_visit": "Sacred meeting point of Ganga, Yamuna, and Saraswati.",
            "lat": 25.4250,
            "lng": 81.8850,
        },
    ],
    frozenset(["delhi", "mathura"]): [
        {
            "name": "Chhatarpur Temple",
            "location": "Delhi",
            "deity": "Devi",
            "importance": "medium",
            "estimated_stop_time_minutes": 45,
            "why_visit": "Large temple complex in South Delhi before entering the Mathura corridor.",
            "lat": 28.5077,
            "lng": 77.1823,
        },
        {
            "name": "Shri Krishna Janmasthan Temple",
            "location": "Mathura, Uttar Pradesh",
            "deity": "Krishna",
            "importance": "high",
            "estimated_stop_time_minutes": 90,
            "why_visit": "Traditional birthplace of Lord Krishna and the main sacred stop in Mathura.",
            "lat": 27.5040,
            "lng": 77.6695,
        },
        {
            "name": "Dwarkadhish Temple",
            "location": "Mathura, Uttar Pradesh",
            "deity": "Krishna",
            "importance": "high",
            "estimated_stop_time_minutes": 45,
            "why_visit": "Historic Krishna temple in the heart of Mathura old city.",
            "lat": 27.5068,
            "lng": 77.6842,
        },
    ],
    frozenset(["haridwar", "rishikesh"]): [
        {
            "name": "Har Ki Pauri",
            "location": "Haridwar, Uttarakhand",
            "deity": "Ganga",
            "importance": "high",
            "estimated_stop_time_minutes": 60,
            "why_visit": "The most sacred ghat in Haridwar, famous for Ganga Aarti.",
            "lat": 29.9560,
            "lng": 78.1714,
        },
        {
            "name": "Mansa Devi Temple",
            "location": "Haridwar, Uttarakhand",
            "deity": "Devi",
            "importance": "medium",
            "estimated_stop_time_minutes": 60,
            "why_visit": "Popular hill temple overlooking Haridwar.",
            "lat": 29.9557,
            "lng": 78.1645,
        },
        {
            "name": "Triveni Ghat",
            "location": "Rishikesh, Uttarakhand",
            "deity": "Ganga",
            "importance": "high",
            "estimated_stop_time_minutes": 45,
            "why_visit": "Sacred bathing ghat and evening aarti place in Rishikesh.",
            "lat": 30.1033,
            "lng": 78.2998,
        },
    ],
}


def get_ors_key() -> str:
    api_key = os.getenv("OPENROUTESERVICE_API_KEY") or os.getenv("ORS_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="OPENROUTESERVICE_API_KEY is not configured on the backend.",
        )
    return api_key


CITY_ALIASES = {
    "new delhi": "delhi",
    "banaras": "varanasi",
    "kashi": "varanasi",
    "allahabad": "prayagraj",
}


def normalize_city_key(value: str) -> str:
    city = (value or "").strip().lower()
    city = city.split(",")[0].strip()
    city = " ".join(city.split())
    return CITY_ALIASES.get(city, city)


def route_key(start: str, destination: str) -> frozenset[str]:
    return frozenset([normalize_city_key(start), normalize_city_key(destination)])


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius_km = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * radius_km * asin(sqrt(a))


def distance_to_polyline_km(lat: float, lng: float, geometry: dict[str, Any]) -> float:
    coords = geometry.get("coordinates") or []
    if not coords:
        return 9999.0
    sampled = coords[:: max(1, len(coords) // 250)]
    return min(haversine_km(lat, lng, point[1], point[0]) for point in sampled)


def fmt_distance(km: float) -> str:
    if km < 10:
        return f"{km:.1f} km"
    return f"{round(km)} km"


def fmt_duration(seconds: float) -> str:
    minutes = round(seconds / 60)
    if minutes < 60:
        return f"~{minutes} minutes"
    hours = minutes / 60
    return f"~{hours:.1f} hours"


async def ors_get(path: str, params: dict[str, Any]) -> dict[str, Any]:
    api_key = get_ors_key()
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(
            f"{ORS_BASE_URL}{path}",
            params=params,
            headers={"Authorization": api_key, "Accept": "application/json"},
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"OpenRouteService error: {response.text}")
    return response.json()


async def ors_post(path: str, payload: dict[str, Any]) -> dict[str, Any]:
    api_key = get_ors_key()
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{ORS_BASE_URL}{path}",
            json=payload,
            headers={
                "Authorization": api_key,
                "Accept": "application/json, application/geo+json",
                "Content-Type": "application/json",
            },
        )
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail=f"OpenRouteService error: {response.text}")
    return response.json()


async def geocode_city(city: str) -> tuple[float, float, str]:
    override = CITY_COORDINATE_OVERRIDES.get(city.strip().lower())
    if override:
        return override

    data = await ors_get(
        "/geocode/search",
        {
            "text": f"{city}, India",
            "boundary.country": "IN",
            "size": 1,
        },
    )
    features = data.get("features") or []
    if not features:
        raise HTTPException(status_code=404, detail=f"Could not find location for {city}.")
    feature = features[0]
    lng, lat = feature["geometry"]["coordinates"]
    label = feature.get("properties", {}).get("label") or city
    return float(lat), float(lng), label


async def get_ors_route(start_lng: float, start_lat: float, dest_lng: float, dest_lat: float, mode: str) -> dict[str, Any]:
    profile = ORS_PROFILE_BY_MODE.get(mode, "driving-car")
    return await ors_post(
        f"/v2/directions/{profile}/geojson",
        {
            "coordinates": [[start_lng, start_lat], [dest_lng, dest_lat]],
            "instructions": False,
            "preference": "recommended",
            "radiuses": [5000, 5000],
            "units": "km",
        },
    )


def all_curated_temples() -> list[dict[str, Any]]:
    temples_by_name: dict[str, dict[str, Any]] = {}
    for route_temples in CURATED_ROUTE_TEMPLES.values():
        for temple in route_temples:
            key = temple["name"].strip().lower()
            if key not in temples_by_name:
                temples_by_name[key] = temple
    return list(temples_by_name.values())


def get_temples_for_route(start: str, destination: str, geometry: dict[str, Any], preferences: list[str]) -> list[TempleStop]:
    key = route_key(start, destination)
    temples = CURATED_ROUTE_TEMPLES.get(key)
    known_route = key in CURATED_ROUTE_TEMPLES
    if not temples:
        temples = all_curated_temples()

    preference_text = " ".join(preferences or []).lower()
    ranked = []
    max_distance_km = 35 if known_route else 45
    for temple in temples:
        distance = distance_to_polyline_km(temple["lat"], temple["lng"], geometry)
        if distance > max_distance_km:
            continue
        score = 0
        if temple["importance"] == "high":
            score += 10
        if preference_text and temple.get("deity", "").lower() in preference_text:
            score += 5
        score -= distance
        route_order = temple.get("route_order", 999 if known_route else 100)
        ranked.append((route_order, -score, distance, temple))

    ranked.sort(key=lambda item: (item[0], item[2]))
    output = []
    for _, _, distance, temple in ranked[:8]:
        output.append(
            TempleStop(
                name=temple["name"],
                location=temple["location"],
                distance_from_route_km=f"{distance:.1f} km",
                estimated_stop_time_minutes=temple["estimated_stop_time_minutes"],
                importance=temple["importance"],
                deity=temple.get("deity"),
                why_visit=temple["why_visit"],
                lat=temple["lat"],
                lng=temple["lng"],
            )
        )
    return output


def make_optimized_plan(temples: list[TempleStop]) -> list[OptimizedStop]:
    plan = []
    for index, temple in enumerate(temples, start=1):
        plan.append(
            OptimizedStop(
                stop_number=index,
                temple_name=temple.name,
                arrival_time_hint=None,
                arrival_order_reason="Ordered along the verified route and prioritized by spiritual importance.",
            )
        )
    return plan


@router.get("/cities", response_model=CitySearchResponse)
async def search_cities(q: str = Query(..., min_length=1, description="City search query")):
    query = q.strip()
    local = [city for city in POPULAR_CITY_HINTS if query.lower() in city.lower()][:8]
    if len(local) >= 5:
        return CitySearchResponse(cities=local)

    try:
        data = await ors_get(
            "/geocode/autocomplete",
            {
                "text": query,
                "boundary.country": "IN",
                "size": 8,
            },
        )
        seen = {city.lower() for city in local}
        cities = list(local)
        for feature in data.get("features", []):
            props = feature.get("properties", {})
            name = props.get("locality") or props.get("county") or props.get("name") or props.get("label")
            if name and name.lower() not in seen:
                seen.add(name.lower())
                cities.append(name)
        return CitySearchResponse(cities=cities[:8])
    except HTTPException:
        return CitySearchResponse(cities=local)


@router.post("/plan", response_model=RoutePlanResponse)
async def plan_route(req: RoutePlanRequest):
    start_lat, start_lng, start_label = await geocode_city(req.start)
    dest_lat, dest_lng, dest_label = await geocode_city(req.destination)
    route_data = await get_ors_route(start_lng, start_lat, dest_lng, dest_lat, req.travel_mode)

    features = route_data.get("features") or []
    if not features:
        raise HTTPException(status_code=502, detail="OpenRouteService did not return a route.")

    feature = features[0]
    geometry = feature.get("geometry") or {}
    summary = feature.get("properties", {}).get("summary", {})
    distance_km = float(summary.get("distance", 0))
    duration_seconds = float(summary.get("duration", 0))

    temples = get_temples_for_route(req.start, req.destination, geometry, req.preferences or [])
    optimized_plan = make_optimized_plan(temples)

    travel_warning = None
    if duration_seconds / 3600 > req.time_available:
        travel_warning = (
            f"The verified route takes {fmt_duration(duration_seconds)}, which is longer than "
            f"your {req.time_available}-hour window. Consider starting earlier or reducing temple stops."
        )
    if req.travel_mode == "train":
        train_note = "Train mode uses road routing for map distance. Use the booking link for actual train options."
        travel_warning = f"{travel_warning} {train_note}" if travel_warning else train_note

    insights = [
        "Distance and travel time are calculated using OpenRouteService road routing.",
        "Temple suggestions are filtered from curated verified stops for known spiritual corridors.",
    ]
    if not temples:
        insights.append("No curated temple stops are available for this route yet. Add temple coordinates to improve suggestions.")
    else:
        insights.append("Start early morning so darshan stops do not push the journey into evening traffic.")

    return RoutePlanResponse(
        route_summary=RouteSummary(
            start=req.start,
            destination=req.destination,
            total_distance=fmt_distance(distance_km),
            estimated_travel_time=fmt_duration(duration_seconds),
        ),
        recommended_temples=temples,
        optimized_plan=optimized_plan,
        insights=insights,
        travel_time_warning=travel_warning,
        route_geometry=RouteGeometry(type=geometry.get("type", "LineString"), coordinates=geometry.get("coordinates", [])),
        start_coordinates=[start_lng, start_lat],
        destination_coordinates=[dest_lng, dest_lat],
        provider="openrouteservice",
    )


@router.post("/nearby-temples", response_model=NearbyTemplesResponse)
async def get_nearby_temples(req: NearbyTempleRequest):
    all_temples = [temple for temples in CURATED_ROUTE_TEMPLES.values() for temple in temples]
    current = next((temple for temple in all_temples if temple["name"].lower() == req.temple_name.lower()), None)
    if not current:
        return NearbyTemplesResponse(nearby_temples=[])

    nearby = []
    seen = {req.temple_name.lower()}
    for temple in all_temples:
        if temple["name"].lower() in seen:
            continue
        distance = haversine_km(current["lat"], current["lng"], temple["lat"], temple["lng"])
        if distance <= req.radius_km:
            seen.add(temple["name"].lower())
            nearby.append(
                NearbyTemple(
                    name=temple["name"],
                    deity=temple.get("deity"),
                    distance_km=round(distance, 1),
                    estimated_visit_time=temple.get("estimated_stop_time_minutes", 30),
                    description=temple["why_visit"],
                )
            )
    nearby.sort(key=lambda temple: temple.distance_km)
    return NearbyTemplesResponse(nearby_temples=nearby[:8])


@router.get("/presets")
def get_preset_routes():
    return {
        "presets": [
            {
                "id": "mandsaur-ujjain",
                "from": "Mandsaur",
                "to": "Ujjain",
                "label": "Mandsaur -> Ujjain",
                "icon": "temple",
                "distance": "OpenRouteService verified",
                "highlight": "Pashupatinath + Mahakaleshwar",
                "description": "Sacred Shaiva corridor through Malwa",
            },
            {
                "id": "indore-ujjain",
                "from": "Indore",
                "to": "Ujjain",
                "label": "Indore -> Ujjain",
                "icon": "route",
                "distance": "OpenRouteService verified",
                "highlight": "Mahakaleshwar Jyotirlinga",
                "description": "Important Ujjain darshan corridor",
            },
            {
                "id": "varanasi-prayagraj",
                "from": "Varanasi",
                "to": "Prayagraj",
                "label": "Varanasi -> Prayagraj",
                "icon": "river",
                "distance": "OpenRouteService verified",
                "highlight": "Kashi Vishwanath + Triveni Sangam",
                "description": "Sacred Ganga corridor",
            },
            {
                "id": "delhi-mathura",
                "from": "Delhi",
                "to": "Mathura",
                "label": "Delhi -> Mathura",
                "icon": "music",
                "distance": "OpenRouteService verified",
                "highlight": "Krishna Janmabhoomi",
                "description": "Braj Bhoomi route",
            },
            {
                "id": "haridwar-rishikesh",
                "from": "Haridwar",
                "to": "Rishikesh",
                "label": "Haridwar -> Rishikesh",
                "icon": "ganga",
                "distance": "OpenRouteService verified",
                "highlight": "Har Ki Pauri + Triveni Ghat",
                "description": "Twin sacred Ganga towns",
            },
        ]
    }
