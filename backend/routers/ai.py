from fastapi import APIRouter
from pydantic import BaseModel
from anthropic import Anthropic
from dotenv import load_dotenv
from typing import List, Optional

import os
import re
import requests
from urllib.parse import quote_plus

load_dotenv()

router = APIRouter()

# ── Claude Client ──────────────────────────────────────────────────────────────
claude = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# ── Constants ──────────────────────────────────────────────────────────────────
MODEL          = "claude-haiku-4-5"
MAX_TEMPLES    = 30          # cap results to avoid overwhelming the user
MAX_TOKENS     = 1200

SYSTEM_PROMPT = """You are BharatMandir AI Guide — a warm, respectful, and knowledgeable Hindu spiritual assistant.

Your role:
- Help devotees find temples, understand rituals, mantras, festivals, and Hindu traditions.
- Provide compassionate spiritual guidance when users share personal concerns.
- If a user asks about temples in a location, ask them to clarify the city or district name so you can search the live map.

Tone: Respectful, composed, and spiritually authentic — like a learned pandit or helpful devotee.
Never give medical, legal, or financial advice.

Mantra format (always use when suggesting a mantra):
Line 1 — Devanagari/Sanskrit: ॐ नमः शिवाय
Line 2 — Transliteration + meaning: (Om Namah Shivaya — I bow to Lord Shiva)

Do NOT use asterisks (*) or markdown bullet dashes. Write in plain prose paragraphs."""

# ── Request / Response Models ──────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str       # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


# ── Location Extraction ────────────────────────────────────────────────────────
# Ordered from most-specific to least-specific to avoid greedy matches.
_LOCATION_PATTERNS = [
    r"temples?\s+in\s+(.+)",
    r"mandir\s+in\s+(.+)",
    r"mandir\s+(?:ke|near)\s+(.+)",
    r"near\s+(.+)",
    r"(?:show|find|list|search)\s+temples?\s+(?:in|near|around)\s+(.+)",
    r"temples?\s+near\s+(.+)",
]

_COMPILED = [re.compile(p, re.IGNORECASE) for p in _LOCATION_PATTERNS]

# Words that should never be treated as location names
_NOISE_WORDS = {
    "me", "my", "us", "here", "there", "this", "that", "a", "the",
    "some", "any", "all", "which", "what", "where", "how", "feeling",
    "today", "now", "please", "you", "i"
}

def extract_location(text: str) -> Optional[str]:
    for pattern in _COMPILED:
        m = pattern.search(text)
        if m:
            candidate = m.group(1).strip().rstrip("?.!")
            # Reject if too short or a noise word
            if len(candidate) < 3 or candidate.lower() in _NOISE_WORDS:
                continue
            # Reject if it looks like a sentence (contains a verb marker)
            if re.search(r"\b(is|are|was|were|be|am|have|has|had|do|did|feel|want|need)\b", candidate, re.I):
                continue
            return candidate
    return None


# ── Nominatim Geocoding ────────────────────────────────────────────────────────
def get_location_bbox(location: str) -> Optional[dict]:
    """Resolve a location name to a bounding box using Nominatim."""
    try:
        response = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": location, "format": "jsonv2", "limit": 1, "addressdetails": 1},
            headers={"User-Agent": "BharatMandir/1.0"},
            timeout=20,
        )
        response.raise_for_status()
        results = response.json()
    except Exception as e:
        print(f"Nominatim error: {e}")
        return None

    if not results:
        return None

    result = results[0]
    bbox = result.get("boundingbox")
    if not bbox or len(bbox) != 4:
        return None

    return {
        "south": float(bbox[0]),
        "north": float(bbox[1]),
        "west":  float(bbox[2]),
        "east":  float(bbox[3]),
        "display_name": result.get("display_name", location),
    }


# ── Temple Search (OpenStreetMap / Overpass) ───────────────────────────────────
_TEMPLE_KEYWORDS = {
    "temple", "mandir", "devi", "mata", "shri", "shree",
    "swamy", "swami", "devasthanam", "kovil", "devalayam",
    "bhagwan", "bhagavathi", "amman", "amma"
}

def _looks_like_temple(tags: dict) -> bool:
    religion = tags.get("religion", "").lower()
    # Must be hindu or untagged; skip mosques, churches, etc.
    if religion and religion not in ("hindu", ""):
        return False

    name = (tags.get("name") or "").lower()
    tag_blob = " ".join([
        str(tags.get("amenity", "")),
        str(tags.get("building", "")),
        str(tags.get("historic", "")),
        name,
    ]).lower()

    return any(kw in tag_blob for kw in _TEMPLE_KEYWORDS)


def search_temples(location: str) -> List[dict]:
    """Fetch temples from Overpass API and return a deduplicated, capped list."""
    bbox = get_location_bbox(location)
    if not bbox:
        return []

    query = f"""
    [out:json][timeout:30];
    (
      node["amenity"="place_of_worship"]({bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']});
      way["amenity"="place_of_worship"]({bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']});
      node["building"="temple"]({bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']});
      way["building"="temple"]({bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']});
      node["historic"="temple"]({bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']});
      way["historic"="temple"]({bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']});
    );
    out tags center;
    """

    try:
        response = requests.post(
            "https://overpass-api.de/api/interpreter",
            data={"data": query},
            headers={"User-Agent": "BharatMandir/1.0"},
            timeout=35,
        )
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"Overpass error: {e}")
        return []

    seen_names: set = set()
    temples: list = []

    for item in data.get("elements", []):
        tags = item.get("tags", {})
        name = tags.get("name", "").strip()

        if not name or not _looks_like_temple(tags):
            continue

        # Deduplicate by normalised name
        key = re.sub(r"\s+", " ", name.lower())
        if key in seen_names:
            continue
        seen_names.add(key)

        # Coordinates
        lat = lon = None
        if "lat" in item and "lon" in item:
            lat, lon = item["lat"], item["lon"]
        elif "center" in item:
            lat, lon = item["center"]["lat"], item["center"]["lon"]

        temples.append({
            "name":      name,
            "address":   tags.get("addr:full") or tags.get("addr:street") or "",
            "latitude":  lat,
            "longitude": lon,
            "source":    "osm",
        })

        if len(temples) >= MAX_TEMPLES:
            break

    temples.sort(key=lambda x: x["name"])
    return temples


# ── Response Formatter ─────────────────────────────────────────────────────────
def format_temples_reply(location: str, temples: List[dict]) -> str:
    if not temples:
        return (
            f"I couldn't find temples for '{location}' on the live map. "
            "Please try a nearby city, district, or state name."
        )

    lines = [f"Here are temples found in {location}:", ""]

    for idx, temple in enumerate(temples, 1):
        name    = temple.get("name", "Temple")
        address = temple.get("address", "")
        lat     = temple.get("latitude")
        lon     = temple.get("longitude")

        if lat is not None and lon is not None:
            maps_link = f"https://maps.google.com/?q={lat},{lon}"
        else:
            maps_link = f"https://www.google.com/maps/search/?api=1&query={quote_plus(name + ' ' + location)}"

        addr_part = f" — {address}" if address else ""
        lines.append(f"{idx}. {name}{addr_part} — [Get Directions]({maps_link})")

    if len(temples) == MAX_TEMPLES:
        lines.append(f"\n(Showing top {MAX_TEMPLES} results. Refine with a more specific locality for fewer results.)")

    return "\n".join(lines)


# ── Main AI Route ──────────────────────────────────────────────────────────────
@router.post("/spiritual-guide")
async def spiritual_guide(data: ChatRequest):
    user_message = data.message
    location     = extract_location(user_message)

    # Temple search path
    if location:
        temples = search_temples(location)
        return {"reply": format_temples_reply(location, temples)}

    # General spiritual guidance path — with conversation history
    history = [{"role": m.role, "content": m.content} for m in (data.history or [])]
    history.append({"role": "user", "content": user_message})

    response = claude.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        system=SYSTEM_PROMPT,
        messages=history,
    )

    return {"reply": response.content[0].text}


# ── Debug Endpoints ────────────────────────────────────────────────────────────
@router.post("/debug/temples")
async def debug_temples(data: ChatRequest):
    """Debug: inspect raw temple results for a location query."""
    location = extract_location(data.message)
    if not location:
        return {"error": "Could not extract location", "user_message": data.message}

    temples = search_temples(location)
    return {"location": location, "temple_count": len(temples), "temples": temples}


@router.post("/temples-list")
async def temples_list(data: ChatRequest):
    """Return structured temple list with Google Maps links."""
    location = extract_location(data.message)
    if not location:
        return {"success": False, "error": "Could not extract location", "message": data.message}

    temples = search_temples(location)
    if not temples:
        return {"success": False, "error": f"No temples found in {location}", "location": location}

    formatted = []
    for idx, t in enumerate(temples, 1):
        entry = {
            "number":    idx,
            "name":      t.get("name", ""),
            "address":   t.get("address", ""),
            "latitude":  t.get("latitude"),
            "longitude": t.get("longitude"),
            "source":    t.get("source", ""),
        }
        if entry["latitude"] and entry["longitude"]:
            entry["maps_link"] = f"https://maps.google.com/?q={entry['latitude']},{entry['longitude']}"
        formatted.append(entry)

    return {
        "success":      True,
        "location":     location,
        "temple_count": len(formatted),
        "temples":      formatted,
    }