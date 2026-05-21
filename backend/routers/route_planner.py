"""
Route Planner API for BharatMandir.
POST /api/route/plan — AI-powered temple route suggestion

Uses server-side OPENAI_API_KEY (GPT) — no user key needed.
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
    travel_mode:    str                     = "car"
    time_available: int                     = 6       # hours (user's stated availability)
    preferences:    Optional[List[str]]     = []


class TempleStop(BaseModel):
    name:                        str
    location:                    str
    distance_from_route_km:      str
    estimated_stop_time_minutes: int
    importance:                  str       # "high" / "medium"
    deity:                       Optional[str] = None
    why_visit:                   str


class OptimizedStop(BaseModel):
    stop_number:           int
    temple_name:           str
    arrival_time_hint:     Optional[str] = None
    arrival_order_reason:  str


class RouteSummary(BaseModel):
    start:                 str
    destination:           str
    total_distance:        str
    estimated_travel_time: str


class RoutePlanResponse(BaseModel):
    route_summary:        RouteSummary
    recommended_temples:  List[TempleStop]
    optimized_plan:       List[OptimizedStop]
    insights:             List[str]
    travel_time_warning:  Optional[str] = None   # ← NEW: shown when user's time is unrealistic


# ─────────────────────────────────────────────
# Speed lookup by travel mode (km/h, conservative)
# ─────────────────────────────────────────────

SPEED_KMH = {
    "car":   70,   # Indian highways with breaks
    "bike":  60,
    "train": 80,   # average express train
    "bus":   55,
}

def realistic_hours(distance_km: float, mode: str) -> float:
    speed = SPEED_KMH.get(mode, 65)
    # Add 20% buffer for stops, traffic, toll gates
    return round((distance_km / speed) * 1.2, 1)


# ─────────────────────────────────────────────
# Helper: DB temples near route
# ─────────────────────────────────────────────

def get_temples_in_region(start: str, destination: str) -> str:
    try:
        from db.connection import get_db_cursor
        with get_db_cursor() as cur:
            cur.execute("""
                SELECT name, city, state, primary_deity, is_jyotirlinga, is_shaktipeeth
                FROM temples
                WHERE status = 'published'
                  AND (
                    city ILIKE %s OR city ILIKE %s
                    OR state IN (
                      SELECT state FROM temples WHERE city ILIKE %s OR city ILIKE %s LIMIT 1
                    )
                  )
                ORDER BY is_jyotirlinga DESC, is_shaktipeeth DESC, name
                LIMIT 30
            """, (f"%{start}%", f"%{destination}%", f"%{start}%", f"%{destination}%"))
            rows = cur.fetchall()

        if not rows:
            return "No temples found in DB for this region."

        lines = ["Temples in your database for this region:\n"]
        for r in rows:
            tags = []
            if r.get('is_jyotirlinga'): tags.append("Jyotirlinga")
            if r.get('is_shaktipeeth'): tags.append("Shaktipeeth")
            tag_str = f" [{', '.join(tags)}]" if tags else ""
            lines.append(
                f"• {r['name']}{tag_str} — {r['city']}, {r['state']} "
                f"(Deity: {r.get('primary_deity', 'N/A')})"
            )
        return "\n".join(lines)
    except Exception as e:
        return f"(DB query failed: {e} — use your knowledge instead)"


# ─────────────────────────────────────────────
# POST /api/route/plan
# ─────────────────────────────────────────────

@router.post("/plan", response_model=RoutePlanResponse)
async def plan_route(req: RoutePlanRequest):
    api_key = os.environ.get("VITE_OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="VITE_OPENAI_API_KEY not configured on server."
        )

    db_context = get_temples_in_region(req.start, req.destination)

    prompt = f"""You are an advanced AI spiritual travel planner for BharatMandir — India's temple discovery platform.

CRITICAL RULES — READ CAREFULLY:
1. Only suggest REAL, well-known temples that actually exist in India.
2. Prioritize temples from the DB context provided.
3. Temples should be within 5-10 km of the main route.
4. REALISTIC TRAVEL TIME: First estimate the actual road distance between {req.start} and {req.destination}.
   - For car/bike: assume 60-70 km/h average on Indian roads (highways have traffic, tolls, ghats).
   - For train: assume 70-80 km/h average.
   - For bus: assume 50-55 km/h average.
   - Add 20% buffer for real-world conditions.
   - Put the REAL estimated travel time in route_summary.estimated_travel_time.
   - The user said they have {req.time_available} hours. If the drive alone takes MORE than that,
     set travel_time_warning to a friendly note like:
     "The drive from {req.start} to {req.destination} typically takes X hours by {req.travel_mode},
      which is longer than your {req.time_available}-hour window. We've planned the best stops
      within the available time — consider an overnight stay or an earlier start."
   - If travel time is realistic, set travel_time_warning to null.
5. Only include temple stops that genuinely fit within the user's time after accounting for travel.
6. Return ONLY valid JSON — no markdown, no preamble, no trailing text.

ROUTE DETAILS:
- From: {req.start}
- To: {req.destination}
- Travel mode: {req.travel_mode}
- User's available time: {req.time_available} hours
- Preferences: {', '.join(req.preferences) if req.preferences else 'Any temples'}

{db_context}

OUTPUT (strict JSON, no markdown):
{{
  "route_summary": {{
    "start": "",
    "destination": "",
    "total_distance": "",
    "estimated_travel_time": ""
  }},
  "recommended_temples": [
    {{
      "name": "",
      "location": "",
      "distance_from_route_km": "3 km",
      "estimated_stop_time_minutes": 30,
      "importance": "high",
      "deity": "",
      "why_visit": ""
    }}
  ],
  "optimized_plan": [
    {{
      "stop_number": 1,
      "temple_name": "",
      "arrival_time_hint": "9:00 AM",
      "arrival_order_reason": ""
    }}
  ],
  "insights": [
    "Best time to start: ...",
    "Crowd tips: ...",
    "Festival or seasonal tip: ..."
  ],
  "travel_time_warning": null
}}"""

    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=2000,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a spiritual travel planner for India. "
                        "Always respond with valid JSON only, matching the exact schema provided. "
                        "Never hallucinate distances or travel times — estimate them realistically "
                        "based on actual Indian road/rail conditions."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
        )
        raw = response.choices[0].message.content
        parsed = json.loads(raw)
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
            { "id": "indore-ujjain",        "from": "Indore",   "to": "Ujjain",        "label": "Indore → Ujjain",        "icon": "🔱", "distance": "~55 km",  "highlight": "Mahakaleshwar Jyotirlinga",         "description": "The most sacred Shaiva route in Madhya Pradesh" },
            { "id": "varanasi-prayagraj",   "from": "Varanasi", "to": "Prayagraj",     "label": "Varanasi → Prayagraj",   "icon": "🪔", "distance": "~125 km", "highlight": "Kashi Vishwanath + Triveni Sangam",  "description": "The holiest corridor along the Ganga" },
            { "id": "mumbai-shirdi",         "from": "Mumbai",   "to": "Shirdi",        "label": "Mumbai → Shirdi",        "icon": "🙏", "distance": "~240 km", "highlight": "Sai Baba Mandir",                   "description": "Maharashtra's most visited pilgrimage route" },
            { "id": "delhi-mathura",         "from": "Delhi",    "to": "Mathura",       "label": "Delhi → Mathura",        "icon": "🎵", "distance": "~160 km", "highlight": "Krishna Janmabhoomi",               "description": "Braj Bhoomi — birthplace of Lord Krishna" },
            { "id": "haridwar-rishikesh",    "from": "Haridwar", "to": "Rishikesh",     "label": "Haridwar → Rishikesh",   "icon": "🌊", "distance": "~25 km",  "highlight": "Har Ki Pauri + Triveni Ghat",       "description": "The Ganga's twin sacred towns" },
            { "id": "tirupati-srikalahasti", "from": "Tirupati", "to": "Srikalahasti",  "label": "Tirupati → Srikalahasti","icon": "🏔️", "distance": "~35 km",  "highlight": "Venkateswara + Srikalahasteeswara",  "description": "South India's most powerful Shaiva-Vaishnava corridor" },
        ]
    }