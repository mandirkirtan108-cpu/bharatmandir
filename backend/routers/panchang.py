"""
routers/panchang.py — Panchang & Muhurat API
Uses server-side ANTHROPIC_API_KEY — no user key needed.

POST /api/panchang/daily   → Aaj Ka Panchang
POST /api/panchang/muhurat → Muhurat Finder
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import anthropic
import os
import json

router = APIRouter(prefix="/api/panchang", tags=["Panchang"])


# ── Models ────────────────────────────────────────────────────────────────────

class DailyPanchangRequest(BaseModel):
    date: str                        # e.g. "2026-05-08"
    city: Optional[str] = "India"

class MuhuratRequest(BaseModel):
    muhurat_type:  str               # e.g. "vivah", "griha", "vyapar"
    muhurat_label: str               # e.g. "Vivah"
    muhurat_hindi: str               # e.g. "विवाह"
    date:          str
    name:          Optional[str] = ""
    rashi:         Optional[str] = ""
    city:          Optional[str] = "India"


# ── Helper ────────────────────────────────────────────────────────────────────

def get_client() -> anthropic.Anthropic:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise HTTPException(500, "ANTHROPIC_API_KEY not configured on server")
    return anthropic.Anthropic(api_key=key)


def ask_claude(prompt: str, max_tokens: int = 2500) -> dict:
    """Call Claude and parse JSON response."""
    client = get_client()
    response = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": prompt}]
    )
    raw = response.content[0].text
    # Strip markdown fences if present
    raw = raw.replace("```json", "").replace("```", "").strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"Failed to parse AI response: {e}\nRaw: {raw[:200]}")


# ── POST /api/panchang/daily ──────────────────────────────────────────────────

@router.post("/daily")
def get_daily_panchang(req: DailyPanchangRequest):
    """
    Returns full Panchang for a given date and city.
    Uses server-side ANTHROPIC_API_KEY.
    """
    from datetime import datetime
    try:
        dt  = datetime.strptime(req.date, "%Y-%m-%d")
        full = dt.strftime("%-d %B %Y")
        day  = dt.strftime("%A")
    except Exception:
        full = req.date
        day  = ""

    prompt = f"""You are a learned Vedic pandit expert in Hindu Panchang calculations.
Provide the complete Panchang for: {full} ({day}), City: {req.city or 'India (general)'}

Return ONLY valid JSON, no markdown, no explanation, start directly with {{:
{{
  "tithi": {{ "name": "", "number": "", "deity": "", "nature": "" }},
  "nakshatra": {{ "name": "", "hindi": "", "lord": "", "quality": "" }},
  "yoga": {{ "name": "", "nature": "auspicious/inauspicious", "meaning": "" }},
  "karana": {{ "name": "", "nature": "" }},
  "var": {{ "day": "", "lord": "", "color": "", "good_for": "" }},
  "rahu_kaal": {{ "time": "" }},
  "brahma_muhurat": {{ "time": "", "benefit": "" }},
  "abhijit_muhurat": {{ "time": "", "benefit": "" }},
  "choghadiya": [
    {{ "time": "", "name": "", "nature": "good/bad/neutral", "good_for": "" }}
  ],
  "overall_day": "excellent/good/average/inauspicious",
  "pandit_blessings": "A warm Sanskrit-flavoured blessing sentence for the day",
  "do_today": ["action 1", "action 2", "action 3"],
  "avoid_today": ["thing 1", "thing 2", "thing 3"]
}}"""

    return ask_claude(prompt)


# ── POST /api/panchang/muhurat ────────────────────────────────────────────────

@router.post("/muhurat")
def get_muhurat(req: MuhuratRequest):
    """
    Returns Muhurat analysis for a given occasion and date.
    Uses server-side ANTHROPIC_API_KEY.
    """
    from datetime import datetime
    try:
        dt   = datetime.strptime(req.date, "%Y-%m-%d")
        full = dt.strftime("%-d %B %Y")
        day  = dt.strftime("%A")
    except Exception:
        full = req.date
        day  = ""

    prompt = f"""You are a highly learned Vedic pandit — expert in Muhurat Shastra and Jyotish. A devotee seeks your guidance.

QUERY:
- Muhurat for: {req.muhurat_label} ({req.muhurat_hindi})
- Date: {full} ({day})
- Person's name: {req.name or 'Not provided'}
- Rashi (Moon sign): {req.rashi or 'Not provided'}
- City: {req.city or 'India (general)'}

Analyse the tithi, nakshatra, yoga, var and planetary positions. Give a warm, authoritative pandit-style response.

Return ONLY valid JSON, no markdown, start directly with {{:
{{
  "verdict": "excellent/good/average/avoid",
  "verdict_reason": "One clear sentence why",
  "pandit_message": "Warm, wise 3-4 sentence message to the devotee as a real pandit would speak",
  "auspicious_timings": [
    {{ "time": "07:15 AM - 09:00 AM", "quality": "Shreshtha (Best)", "reason": "" }}
  ],
  "timings_to_avoid": [
    {{ "time": "", "reason": "" }}
  ],
  "tithi_today": {{ "name": "", "is_auspicious_for_this_muhurat": true, "reason": "" }},
  "nakshatra_today": {{ "name": "", "is_auspicious_for_this_muhurat": true, "reason": "" }},
  "rituals_recommended": ["ritual 1", "ritual 2", "ritual 3"],
  "mantras": [
    {{ "deity": "", "mantra": "", "chant_times": 108, "purpose": "" }}
  ],
  "special_notes": ["note 1", "note 2"],
  "alternative_dates": [
    {{ "date": "", "quality": "Excellent/Good", "reason": "" }}
  ]
}}"""

    return ask_claude(prompt, max_tokens=2500)