from fastapi import APIRouter
from pydantic import BaseModel
from anthropic import Anthropic
from dotenv import load_dotenv

import os
import requests
from urllib.parse import quote_plus

load_dotenv()

router = APIRouter()

# Claude Client
claude = Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY")
)

# Request Model
class ChatRequest(BaseModel):
    message: str


# Extract location from query
def extract_location(text):

    text = text.lower().strip()

    patterns = [
        "temples in ",
        "mandir in ",
        "temple in ",
        "near ",
        "in "
    ]

    for pattern in patterns:
        if pattern in text:
            return text.split(pattern)[-1].strip()

    return None


def get_location_bbox(location):
    """Resolve a location name to a bounding box using Nominatim."""
    response = requests.get(
        "https://nominatim.openstreetmap.org/search",
        params={
            "q": location,
            "format": "jsonv2",
            "limit": 1,
            "addressdetails": 1,
        },
        headers={"User-Agent": "BharatMandir/1.0"},
        timeout=20,
    )
    response.raise_for_status()
    results = response.json()
    if not results:
        return None

    result = results[0]
    bbox = result.get("boundingbox")
    if not bbox or len(bbox) != 4:
        return None

    return {
        "south": float(bbox[0]),
        "north": float(bbox[1]),
        "west": float(bbox[2]),
        "east": float(bbox[3]),
        "display_name": result.get("display_name", location),
    }

# Search temples from OpenStreetMap only
def search_temples(location):
    """
    Fetch temples from OpenStreetMap API only.
    Combines results and removes duplicates.
    Includes coordinates for Google Maps directions.
    """
    temples_dict = {}  # Use dict to store unique temples by name

    def looks_like_temple(tags):
        name = (tags.get("name") or "").lower()
        temple_keywords = ["temple", "mandir", "devi", "dev", "mata", "shri", "shree", "swamy", "swami", "devasthanam"]
        tag_blob = " ".join([
            str(tags.get("amenity", "")),
            str(tags.get("building", "")),
            str(tags.get("religion", "")),
            str(tags.get("tourism", "")),
            name,
        ]).lower()
        return any(keyword in tag_blob for keyword in temple_keywords)

    # 2. Get temples from OpenStreetMap API
    try:
        location_bbox = get_location_bbox(location)
        if not location_bbox:
            return list(temples_dict.values())

        query = f"""
        [out:json][timeout:25];

        (
          node["amenity"="place_of_worship"]({location_bbox['south']},{location_bbox['west']},{location_bbox['north']},{location_bbox['east']});
          way["amenity"="place_of_worship"]({location_bbox['south']},{location_bbox['west']},{location_bbox['north']},{location_bbox['east']});

          node["building"="temple"]({location_bbox['south']},{location_bbox['west']},{location_bbox['north']},{location_bbox['east']});
          way["building"="temple"]({location_bbox['south']},{location_bbox['west']},{location_bbox['north']},{location_bbox['east']});

          node["historic"="temple"]({location_bbox['south']},{location_bbox['west']},{location_bbox['north']},{location_bbox['east']});
          way["historic"="temple"]({location_bbox['south']},{location_bbox['west']},{location_bbox['north']},{location_bbox['east']});

          node["tourism"="attraction"]({location_bbox['south']},{location_bbox['west']},{location_bbox['north']},{location_bbox['east']});
          way["tourism"="attraction"]({location_bbox['south']},{location_bbox['west']},{location_bbox['north']},{location_bbox['east']});
        );

        out tags center;
        """

        response = requests.post(
            "https://overpass-api.de/api/interpreter",
            data={"data": query},
            headers={"User-Agent": "BharatMandir/1.0"},
            timeout=30,
        )

        data = response.json()

        for item in data.get("elements", []):
            tags = item.get("tags", {})
            name = tags.get("name")

            # Skip unnamed temples
            if not name or not looks_like_temple(tags):
                continue

            # Extract coordinates
            lat = None
            lon = None
            
            if "lat" in item and "lon" in item:
                lat = item["lat"]
                lon = item["lon"]
            elif "center" in item:
                lat = item["center"]["lat"]
                lon = item["center"]["lon"]

            # Add only if not already in our dict (avoid duplicates)
            if name not in temples_dict:
                temples_dict[name] = {
                    "name": name,
                    "address": tags.get("addr:full", tags.get("addr:street", tags.get("name", ""))),
                    "latitude": lat,
                    "longitude": lon,
                    "source": "osm"
                }
    except Exception as e:
        print(f"Error fetching from OSM: {e}")
    
    # Convert dict to list
    temples = list(temples_dict.values())
    
    # Sort alphabetically
    temples.sort(key=lambda x: x["name"])
    
    return temples


def format_temples_reply(location, temples):
    """Create a deterministic temple list with directions links."""
    if not temples:
        return f"I couldn't find temples for {location}. Please try a nearby city, district, or state name."

    lines = [f"Temples in {location}:", ""]

    for idx, temple in enumerate(temples, 1):
        name = temple.get("name", "Temple")
        city = temple.get("city", location)
        district = temple.get("district", "")
        address = temple.get("address", "")
        latitude = temple.get("latitude")
        longitude = temple.get("longitude")

        location_text = address or ", ".join([part for part in [city, district] if part]) or location

        if latitude is not None and longitude is not None:
            maps_link = f"https://maps.google.com/?q={latitude},{longitude}"
        else:
            maps_link = f"https://www.google.com/maps/search/?api=1&query={quote_plus(name + ' ' + location)}"

        lines.append(f"{idx}. {name} — {location_text} — [Get Directions]({maps_link})")

    return "\n".join(lines)


# Main AI Route
@router.post("/spiritual-guide")
async def spiritual_guide(data: ChatRequest):

    user_message = data.message
    location = extract_location(user_message)
    
    # If location detected, fetch temples
    temples_list = []
    if location:
        temples_list = search_temples(location)

    # If we found temples, return them directly so Claude cannot rewrite or omit fields.
    if temples_list:
        return {
            "reply": format_temples_reply(location, temples_list)
        }
    
    # If no temples found but location was extracted, ask clarifying questions
    if location and not temples_list:
        return {
            "reply": f"I couldn't find temple results from the live map API for {location}. Try a nearby city, district, or a more specific location name."
        }
    
    # If no location detected, provide general spiritual guidance
    prompt = f"""You are BharatMandir AI Guide.

User message: "{user_message}"

Provide helpful spiritual guidance. If they're asking about temples in a location, ask them to clarify which city/location they're interested in.

Be warm, respectful, and compassionate."""
    
    response = claude.messages.create(
        model="claude-3-5-haiku-latest",
        max_tokens=1200,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )
    
    return {
        "reply": response.content[0].text
    }


# Debug endpoint to test temple search
@router.post("/debug/temples")
async def debug_temples(data: ChatRequest):
    """Debug endpoint to see what temples are being retrieved"""
    user_message = data.message
    location = extract_location(user_message)
    
    if not location:
        return {
            "error": "Could not extract location",
            "user_message": user_message
        }
    
    temples = search_temples(location)
    
    return {
        "location": location,
        "temple_count": len(temples),
        "temples": temples
    }


# New endpoint for temples list with directions
@router.post("/temples-list")
async def temples_list(data: ChatRequest):
    """Return list of temples with addresses and Google Maps links"""
    user_message = data.message
    location = extract_location(user_message)
    
    if not location:
        return {
            "success": False,
            "error": "Could not extract location from your message",
            "message": user_message
        }
    
    temples = search_temples(location)
    
    if not temples:
        return {
            "success": False,
            "error": f"No temples found in {location}",
            "location": location
        }
    
    # Format temples with all details
    formatted_temples_list = []
    for idx, temple in enumerate(temples, 1):
        temple_data = {
            "number": idx,
            "name": temple.get("name", ""),
            "address": temple.get("address", ""),
            "city": temple.get("city", ""),
            "deity": temple.get("deity", ""),
            "latitude": temple.get("latitude"),
            "longitude": temple.get("longitude"),
            "source": temple.get("source", "")
        }
        
        # Add Google Maps link if coordinates exist
        if temple_data["latitude"] and temple_data["longitude"]:
            temple_data["maps_link"] = f"https://maps.google.com/?q={temple_data['latitude']},{temple_data['longitude']}"
        
        formatted_temples_list.append(temple_data)
    
    return {
        "success": True,
        "location": location,
        "temple_count": len(formatted_temples_list),
        "temples": formatted_temples_list
    }