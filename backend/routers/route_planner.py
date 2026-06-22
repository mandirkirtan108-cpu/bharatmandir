"""
Route Planner API for BharatMandir.
POST /api/route/plan   — AI-powered temple route suggestion
POST /api/route/cities — AI-powered city autocomplete (all Indian cities)
Pure OpenAI knowledge — no DB dependency.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import os
import json
from openai import OpenAI
import openai as openai_lib

router = APIRouter(
    prefix="/api/route",
    tags=["Route Planner"]
)


# ─────────────────────────────────────────────
# Request / Response Models
# ─────────────────────────────────────────────

class RoutePlanRequest(BaseModel):
    start:          str
    destination:    str
    travel_mode:    str                 = "car"
    time_available: int                 = 6
    preferences:    Optional[List[str]] = []


class CitySearchRequest(BaseModel):
    query: str


class CitySearchResponse(BaseModel):
    cities: List[str]


class TempleStop(BaseModel):
    name:                        str
    location:                    str
    distance_from_route_km:      str
    estimated_stop_time_minutes: int
    importance:                  str        # "high" / "medium"
    deity:                       Optional[str] = None
    why_visit:                   str


class OptimizedStop(BaseModel):
    stop_number:          int
    temple_name:          str
    arrival_time_hint:    Optional[str] = None
    arrival_order_reason: str


class RouteSummary(BaseModel):
    start:                 str
    destination:           str
    total_distance:        str
    estimated_travel_time: str


class RoutePlanResponse(BaseModel):
    route_summary:       RouteSummary
    recommended_temples: List[TempleStop]
    optimized_plan:      List[OptimizedStop]
    insights:            List[str]
    travel_time_warning: Optional[str] = None


# ─────────────────────────────────────────────
# Speed lookup (km/h, conservative Indian roads)
# ─────────────────────────────────────────────

SPEED_KMH = {
    "car":   65,
    "bike":  55,
    "train": 75,
    "bus":   50,
}

def realistic_hours(distance_km: float, mode: str) -> float:
    speed = SPEED_KMH.get(mode, 60)
    return round((distance_km / speed) * 1.25, 1)


# ─────────────────────────────────────────────
# Known road distances to prevent GPT hallucination
# ─────────────────────────────────────────────

KNOWN_ROAD_DISTANCES = {
    frozenset(["mandsaur", "ujjain"]):        165,
    frozenset(["indore", "ujjain"]):           56,
    frozenset(["varanasi", "prayagraj"]):      125,
    frozenset(["mumbai", "shirdi"]):           240,
    frozenset(["delhi", "mathura"]):           160,
    frozenset(["haridwar", "rishikesh"]):       25,
    frozenset(["tirupati", "srikalahasti"]):    36,
    frozenset(["indore", "omkareshwar"]):       78,
    frozenset(["bhopal", "ujjain"]):           186,
    frozenset(["ratlam", "ujjain"]):            95,
    frozenset(["mandsaur", "ratlam"]):          68,
    frozenset(["mandsaur", "neemuch"]):         45,
}

def get_known_distance(start: str, destination: str):
    key = frozenset([start.strip().lower(), destination.strip().lower()])
    return KNOWN_ROAD_DISTANCES.get(key)


# ─────────────────────────────────────────────
# Known highway corridors — exact towns on the road
# ─────────────────────────────────────────────

HIGHWAY_CORRIDORS = {
    frozenset(["mandsaur", "neemuch"]): {
        "highway": "NH-52",
        "towns": ["Mandsaur", "Neemuch"],
        "direction": "south-west",
        "exclude_note": (
            "This is a SHORT 45 km direct highway — only 2 cities: Mandsaur and Neemuch. "
            "Do NOT include temples from Sitamau, Suwasra, Rampura, Shamgarh, or Jawra — "
            "none of these are on the Mandsaur–Neemuch NH-52 road. "
            "Only suggest temples physically located IN Mandsaur city or IN Neemuch city."
        ),
    },
    frozenset(["mandsaur", "ujjain"]): {
        "highway": "NH-52 / SH-31",
        "towns": ["Mandsaur", "Shamgarh", "Jawra", "Ratlam", "Nagda", "Khachrod", "Ujjain"],
        "direction": "east then south",
        "exclude_note": "Do NOT include temples far off this highway corridor.",
    },
    frozenset(["indore", "ujjain"]): {
        "highway": "NH-52",
        "towns": ["Indore", "Dewas", "Ujjain"],
        "direction": "north-east",
        "exclude_note": "Only temples in Indore, Dewas, or Ujjain. Do not suggest temples in other districts.",
    },
    frozenset(["bhopal", "ujjain"]): {
        "highway": "SH-18",
        "towns": ["Bhopal", "Sehore", "Shajapur", "Ujjain"],
        "direction": "west",
        "exclude_note": "Only temples along Bhopal–Sehore–Shajapur–Ujjain corridor.",
    },
    frozenset(["ratlam", "ujjain"]): {
        "highway": "NH-52",
        "towns": ["Ratlam", "Nagda", "Khachrod", "Ujjain"],
        "direction": "east",
        "exclude_note": "Only temples along Ratlam–Nagda–Ujjain corridor.",
    },
    frozenset(["varanasi", "prayagraj"]): {
        "highway": "NH-19",
        "towns": ["Varanasi", "Mirzapur", "Prayagraj"],
        "direction": "west",
        "exclude_note": "Only temples along the NH-19 corridor.",
    },
    frozenset(["delhi", "mathura"]): {
        "highway": "NH-19 / Yamuna Expressway",
        "towns": ["Delhi", "Faridabad", "Palwal", "Mathura"],
        "direction": "south",
        "exclude_note": "Only temples along Delhi–Mathura Yamuna Expressway corridor.",
    },
    frozenset(["mumbai", "shirdi"]): {
        "highway": "Mumbai-Nashik Expressway / NH-60",
        "towns": ["Mumbai", "Thane", "Nashik", "Shirdi"],
        "direction": "north-east",
        "exclude_note": "Only temples along Mumbai–Nashik–Shirdi corridor.",
    },
}

def get_highway_corridor(start: str, destination: str):
    key = frozenset([start.strip().lower(), destination.strip().lower()])
    return HIGHWAY_CORRIDORS.get(key)


def get_openai_client() -> OpenAI:
    api_key = os.environ.get("VITE_OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="VITE_OPENAI_API_KEY not configured on server.")
    return OpenAI(api_key=api_key)


# ─────────────────────────────────────────────
# POST /api/route/cities  — AI city autocomplete
# ─────────────────────────────────────────────

@router.post("/cities", response_model=CitySearchResponse)
async def search_cities(req: CitySearchRequest):
    """
    Returns up to 10 Indian city/town names that match the given query string.
    Covers all cities — metros, tier-2, tier-3, pilgrimage towns, and more.
    """
    query = req.query.strip()
    if not query:
        return CitySearchResponse(cities=[])

    client = get_openai_client()

    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",       # fast + cheap for autocomplete
            max_tokens=300,
            temperature=0,             # deterministic results
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a comprehensive database of every city, town, and village in India. "
                        "You know all metros, tier-2, tier-3 cities, pilgrimage towns, district headquarters, "
                        "tehsil towns, and well-known villages across all 28 states and 8 UTs. "
                        "Always respond with valid JSON only."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f'List up to 10 Indian city or town names that contain or start with "{query}". '
                        f"Include all city types: metros, tier-2, tier-3, pilgrimage cities, district towns. "
                        f"Sort results: names that START with '{query}' first, then names that CONTAIN it. "
                        f'Return ONLY a JSON object with a single key "cities" containing an array of strings. '
                        f'Example: {{"cities": ["Agra", "Ahmedabad", "Akola"]}}'
                    ),
                },
            ],
        )

        raw = response.choices[0].message.content
        parsed = json.loads(raw)
        cities = parsed.get("cities", [])

        # Sanitize: keep only strings, strip whitespace, remove duplicates
        seen = set()
        clean = []
        for c in cities:
            if isinstance(c, str):
                c = c.strip()
                lower = c.lower()
                if c and lower not in seen:
                    seen.add(lower)
                    clean.append(c)

        return CitySearchResponse(cities=clean[:10])

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {e}")
    except openai_lib.APIError as e:
        raise HTTPException(status_code=502, detail=f"OpenAI API error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# POST /api/route/plan
# ─────────────────────────────────────────────

@router.post("/plan", response_model=RoutePlanResponse)
async def plan_route(req: RoutePlanRequest):
    client = get_openai_client()

    known_distance_km = get_known_distance(req.start, req.destination)
    corridor          = get_highway_corridor(req.start, req.destination)

    if corridor:
        corridor_instruction = (
            f"HIGHWAY CORRIDOR: This route follows {corridor['highway']} going {corridor['direction']}.\n"
            f"Towns on this road: {' → '.join(corridor['towns'])}\n"
            f"STRICT RULE: {corridor['exclude_note']}\n"
            f"Only suggest temples that are physically on or within 10 km of this highway corridor."
        )
    else:
        corridor_instruction = (
            f"Only suggest temples that are physically on or within 10 km of the actual road "
            f"from {req.start} to {req.destination}. Do NOT suggest temples in towns that require "
            f"a significant detour off the main route."
        )

    if known_distance_km:
        realistic_hrs = realistic_hours(known_distance_km, req.travel_mode)
        distance_instruction = (
            f"VERIFIED ROAD DISTANCE: {req.start} to {req.destination} = {known_distance_km} km by road. "
            f"Realistic travel time by {req.travel_mode} = ~{realistic_hrs} hours. "
            f"USE THESE EXACT VALUES in route_summary. Do not change them."
        )
    else:
        distance_instruction = (
            f"Estimate the ACTUAL ROAD distance (not straight-line) between {req.start} and {req.destination} "
            f"using your knowledge of Indian highways and NH routes. "
            f"Indian roads are never straight — always use road km, not aerial distance."
        )

    prompt = f"""You are an expert spiritual travel planner with deep knowledge of every temple in India.

TASK: Plan a temple route from {req.start} to {req.destination} for a spiritual traveller.

═══ CRITICAL RULES ═══

1. DISTANCE & TRAVEL TIME:
   {distance_instruction}
   - For car/bike: 60-65 km/h average on Indian roads (traffic, tolls, ghats).
   - For train: 70-75 km/h. For bus: 50 km/h.
   - Add 25% buffer for real-world conditions.

2. HIGHWAY CORRIDOR — STRICT:
   {corridor_instruction}

3. TEMPLES — USE YOUR OWN KNOWLEDGE ONLY:
   - Use your knowledge of famous, historically significant, and spiritually important
     temples ONLY in the towns listed in the corridor above.
   - Do NOT suggest temples in towns that are off this highway/road.
   - Suggest as many REAL temples as genuinely exist on this route — do NOT invent or stretch. For short routes (under 60 km) with only 2 cities, 3-5 temples is fine. For longer routes (100+ km) with many towns, aim for 6-8 temples. Quality over quantity — only real, significant temples.
   - Priority order: Jyotirlinga > Shaktipeeth > Ancient/Famous > Local significant temples.
   - Every temple must be REAL and must actually exist on or near this exact route.

4. TEMPLE QUALITY — only valuable temples:
   - Include temples that are historically significant, architecturally notable,
     or spiritually powerful (major festivals, ancient origin, high footfall).
   - Each temple should have a compelling, specific reason to visit.

5. PREFERENCES: {', '.join(req.preferences) if req.preferences else 'All types of temples welcome'}

6. TIME PLANNING:
   - User has {req.time_available} hours total.
   - If drive time alone exceeds this, set travel_time_warning with a friendly message.
   - Mark temples "high" importance only if they are truly exceptional or Jyotirlinga/Shaktipeeth level.

7. Return ONLY valid JSON — no markdown, no explanation, no extra text.

═══ ROUTE ═══
From:        {req.start}
To:          {req.destination}
Travel mode: {req.travel_mode}
Time budget: {req.time_available} hours

═══ OUTPUT FORMAT (strict JSON) ═══
{{
  "route_summary": {{
    "start": "{req.start}",
    "destination": "{req.destination}",
    "total_distance": "165 km",
    "estimated_travel_time": "~3.5 hours"
  }},
  "recommended_temples": [
    {{
      "name": "Temple Name",
      "location": "City, State",
      "distance_from_route_km": "2 km",
      "estimated_stop_time_minutes": 45,
      "importance": "high",
      "deity": "Shiva",
      "why_visit": "One of the 12 Jyotirlingas, ancient 9th century temple..."
    }}
  ],
  "optimized_plan": [
    {{
      "stop_number": 1,
      "temple_name": "Temple Name",
      "arrival_time_hint": "8:00 AM",
      "arrival_order_reason": "Visit early to avoid crowds, opens at 6 AM"
    }}
  ],
  "insights": [
    "Best time to start your journey: early morning (6-7 AM)",
    "Crowd tip: ...",
    "Dress code / prasad / festival tip: ..."
  ],
  "travel_time_warning": null
}}"""

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            max_tokens=3500,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are India's most knowledgeable spiritual travel guide. "
                        "You know every significant temple in India — their history, deity, location, "
                        "significance, and exact position on Indian highways. "
                        "You always use ACTUAL ROAD distances, never aerial/straight-line distances. "
                        "Example: Mandsaur to Ujjain is 165 km by road, NOT 75 km. "
                        "You always suggest at least 6 real, valuable temples along any route. "
                        "Respond only with valid JSON matching the exact schema given."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
        )

        raw    = response.choices[0].message.content
        parsed = json.loads(raw)

        # Hard override: fix distance/time with verified values
        if known_distance_km and "route_summary" in parsed:
            realistic_hrs = realistic_hours(known_distance_km, req.travel_mode)
            parsed["route_summary"]["total_distance"]        = f"{known_distance_km} km"
            parsed["route_summary"]["estimated_travel_time"] = f"~{realistic_hrs} hours"

            if realistic_hrs > req.time_available and not parsed.get("travel_time_warning"):
                parsed["travel_time_warning"] = (
                    f"The drive from {req.start} to {req.destination} typically takes "
                    f"~{realistic_hrs} hours by {req.travel_mode}, which is longer than your "
                    f"{req.time_available}-hour window. Consider an overnight stay or an earlier start."
                )

        return RoutePlanResponse(**parsed)

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {e}")
    except openai_lib.APIError as e:
        raise HTTPException(status_code=502, detail=f"OpenAI API error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─────────────────────────────────────────────
# GET /api/route/presets
# ─────────────────────────────────────────────

@router.get("/presets")
def get_preset_routes():
    return {
        "presets": [
            { "id": "mandsaur-ujjain",      "from": "Mandsaur", "to": "Ujjain",       "label": "Mandsaur → Ujjain",      "icon": "🕉️", "distance": "~165 km", "highlight": "Pashupatinath + Mahakaleshwar",    "description": "Sacred Shaiva corridor through Malwa" },
            { "id": "indore-ujjain",         "from": "Indore",   "to": "Ujjain",       "label": "Indore → Ujjain",        "icon": "🔱", "distance": "~56 km",  "highlight": "Mahakaleshwar Jyotirlinga",        "description": "The most sacred Shaiva route in Madhya Pradesh" },
            { "id": "varanasi-prayagraj",    "from": "Varanasi", "to": "Prayagraj",    "label": "Varanasi → Prayagraj",   "icon": "🪔", "distance": "~125 km", "highlight": "Kashi Vishwanath + Triveni Sangam", "description": "The holiest corridor along the Ganga" },
            { "id": "mumbai-shirdi",         "from": "Mumbai",   "to": "Shirdi",       "label": "Mumbai → Shirdi",        "icon": "🙏", "distance": "~240 km", "highlight": "Sai Baba Mandir",                  "description": "Maharashtra's most visited pilgrimage route" },
            { "id": "delhi-mathura",         "from": "Delhi",    "to": "Mathura",      "label": "Delhi → Mathura",        "icon": "🎵", "distance": "~160 km", "highlight": "Krishna Janmabhoomi",              "description": "Braj Bhoomi — birthplace of Lord Krishna" },
            { "id": "haridwar-rishikesh",    "from": "Haridwar", "to": "Rishikesh",    "label": "Haridwar → Rishikesh",   "icon": "🌊", "distance": "~25 km",  "highlight": "Har Ki Pauri + Triveni Ghat",      "description": "The Ganga's twin sacred towns" },
            { "id": "tirupati-srikalahasti", "from": "Tirupati", "to": "Srikalahasti", "label": "Tirupati → Srikalahasti","icon": "🏔️", "distance": "~36 km",  "highlight": "Venkateswara + Srikalahasteeswara", "description": "South India's most powerful Shaiva-Vaishnava corridor" },
        ]
    }