"""
Route Planner API for BharatMandir.
POST /api/route/plan — AI-powered temple route suggestion
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
# POST /api/route/plan
# ─────────────────────────────────────────────

@router.post("/plan", response_model=RoutePlanResponse)
async def plan_route(req: RoutePlanRequest):
    api_key = os.environ.get("VITE_OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=500, detail="VITE_OPENAI_API_KEY not configured on server.")

    known_distance_km = get_known_distance(req.start, req.destination)

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

2. TEMPLES — USE YOUR OWN KNOWLEDGE ONLY:
   - Use your knowledge of famous, historically significant, and spiritually important
     temples along the {req.start} → {req.destination} corridor.
   - Include temples in ALL towns and cities along the entire route, not just start and end.
   - Suggest MINIMUM 6 temples, maximum 10.
   - Priority order: Jyotirlinga > Shaktipeeth > Ancient/Famous > Local significant temples.
   - Every temple must be REAL and must actually exist on or near this route.

3. TEMPLE QUALITY — only valuable temples:
   - Include temples that are historically significant, architecturally notable,
     or spiritually powerful (major festivals, ancient origin, high footfall).
   - Each temple should have a compelling, specific reason to visit.

4. PREFERENCES: {', '.join(req.preferences) if req.preferences else 'All types of temples welcome'}

5. TIME PLANNING:
   - User has {req.time_available} hours total.
   - If drive time alone exceeds this, set travel_time_warning with a friendly message.
   - Mark temples "high" importance only if they are truly exceptional or Jyotirlinga/Shaktipeeth level.

6. Return ONLY valid JSON — no markdown, no explanation, no extra text.

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
        client = OpenAI(api_key=api_key)
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