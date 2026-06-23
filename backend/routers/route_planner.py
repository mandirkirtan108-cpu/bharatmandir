"""
Route Planner API for BharatMandir.
POST /api/route/plan        — AI-powered temple route suggestion
GET  /api/route/cities      — City autocomplete (local list + Nominatim fallback, FREE)
Pure OpenAI knowledge — no DB dependency.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, List
import os
import json
import httpx
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
# Known highway corridors
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
        "exclude_note": "Only temples in Indore, Dewas, or Ujjain.",
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
# Local pilgrimage city master list (~1500 cities)
# Covers: all states, Jyotirlingas, Shakti Peethas,
# Divya Desams, Char Dhams, district HQs, temple towns
# ─────────────────────────────────────────────

INDIAN_PILGRIMAGE_CITIES = sorted([
    # ── Madhya Pradesh ──────────────────────────────
    "Ujjain", "Indore", "Bhopal", "Gwalior", "Jabalpur", "Sagar", "Rewa",
    "Satna", "Ratlam", "Mandsaur", "Neemuch", "Dewas", "Shajapur", "Sehore",
    "Vidisha", "Raisen", "Narsinghpur", "Chhindwara", "Seoni", "Balaghat",
    "Mandla", "Dindori", "Anuppur", "Umaria", "Katni", "Damoh", "Panna",
    "Chhatarpur", "Tikamgarh", "Shivpuri", "Guna", "Ashoknagar", "Datia",
    "Bhind", "Morena", "Sheopur", "Rajgarh", "Agar Malwa", "Shahdol",
    "Singrauli", "Sidhi", "Khargone", "Barwani", "Dhar", "Alirajpur",
    "Jhabua", "Hoshangabad", "Betul", "Harda", "Burhanpur", "Khandwa",
    "Omkareshwar", "Maheshwar", "Mandu", "Chitrakoot", "Amarkantak",
    "Orchha", "Khajuraho", "Maihar", "Salkanpur", "Bandhavgarh",
    "Pachmarhi", "Sonagiri", "Kundalpur", "Muktagiri", "Nagda", "Khachrod",
    "Shamgarh", "Jawra", "Sitamau", "Suwasra", "Rampura", "Nainpur",
    "Pipariya", "Itarsi", "Mhow", "Sanawad", "Badnawar", "Petlawad",
    "Sailana", "Jaora", "Mahidpur", "Tarana", "Unhel", "Barnagar",
    "Kaytha", "Maksi", "Shujalpur", "Susner", "Biaora", "Sarangpur",
    "Ashta", "Obaidullahganj", "Mandideep", "Sanchi", "Gyaraspur",
    "Udaypur", "Chanderi", "Lalitpur",

    # ── Rajasthan ───────────────────────────────────
    "Jaipur", "Jodhpur", "Udaipur", "Ajmer", "Pushkar", "Kota", "Bikaner",
    "Alwar", "Bharatpur", "Sikar", "Jhunjhunu", "Churu", "Nagaur",
    "Pali", "Barmer", "Jaisalmer", "Sirohi", "Jalor", "Bundi", "Kota",
    "Baran", "Jhalawar", "Tonk", "Sawai Madhopur", "Karauli", "Dholpur",
    "Dausa", "Jaipur Rural", "Dungarpur", "Banswara", "Chittorgarh",
    "Rajsamand", "Bhilwara", "Hanumangarh", "Sri Ganganagar", "Pratapgarh",
    "Nathdwara", "Ranakpur", "Dilwara", "Deshnoke", "Kolayat",
    "Ramdevra", "Gogamedi", "Salasar", "Khatu", "Shrinathji",
    "Kuchaman", "Nawa", "Merta", "Nagaur", "Makrana",
    "Sambhar", "Phulera", "Chomu", "Amber", "Sanganer",
    "Kishangarh", "Roopangarh", "Beawar", "Nasirabad", "Bhim",
    "Deogarh", "Kumbhalgarh", "Ghanerao", "Sadri", "Bali",
    "Falna", "Sumerpur", "Bhinmal", "Ahore", "Sanchore",

    # ── Uttar Pradesh ───────────────────────────────
    "Varanasi", "Prayagraj", "Mathura", "Vrindavan", "Ayodhya", "Lucknow",
    "Agra", "Kanpur", "Meerut", "Ghaziabad", "Noida", "Allahabad",
    "Gorakhpur", "Aligarh", "Bareilly", "Moradabad", "Saharanpur",
    "Firozabad", "Muzaffarnagar", "Rampur", "Shahjahanpur", "Hardoi",
    "Unnao", "Rae Bareli", "Sultanpur", "Pratapgarh", "Fatehpur",
    "Banda", "Chitrakoot", "Mahoba", "Hamirpur", "Jalaun", "Jhansi",
    "Lalitpur", "Etawah", "Mainpuri", "Farrukhabad", "Kannauj",
    "Auraiya", "Etah", "Kasganj", "Hathras", "Bulandshahr",
    "Hapur", "Amroha", "Sambhal", "Badaun", "Pilibhit",
    "Lakhimpur", "Sitapur", "Barabanki", "Faizabad", "Ambedkar Nagar",
    "Gonda", "Balrampur", "Shravasti", "Bahraich", "Basti",
    "Sant Kabir Nagar", "Siddharthnagar", "Maharajganj", "Kushinagar",
    "Deoria", "Mau", "Ballia", "Ghazipur", "Chandauli",
    "Mirzapur", "Sonbhadra", "Bhadohi", "Jaunpur", "Azamgarh",
    "Ambedkar Nagar", "Akbarpur", "Tanda",
    "Nandgaon", "Barsana", "Govardhan", "Gokul", "Mahaban",
    "Baldeo", "Radhakund", "Shyamkund", "Kamyavan", "Baladev",

    # ── Bihar ───────────────────────────────────────
    "Patna", "Gaya", "Bodhgaya", "Nalanda", "Rajgir", "Pawapuri",
    "Vaishali", "Muzaffarpur", "Darbhanga", "Bhagalpur", "Munger",
    "Begusarai", "Samastipur", "Sitamarhi", "Madhubani", "Supaul",
    "Araria", "Kishanganj", "Purnia", "Katihar", "Banka", "Jamui",
    "Lakhisarai", "Sheikhpura", "Nawada", "Arwal", "Jehanabad",
    "Aurangabad Bihar", "Rohtas", "Kaimur", "Buxar", "Bhojpur",
    "Saran", "Siwan", "Gopalganj", "East Champaran", "West Champaran",
    "Sheohar", "Dumraon", "Bikramganj", "Sasaram", "Dehri",

    # ── Jharkhand ───────────────────────────────────
    "Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar",
    "Giridih", "Hazaribagh", "Ramgarh", "Lohardaga", "Gumla",
    "Simdega", "Khunti", "Saraikela", "West Singhbhum", "East Singhbhum",
    "Dumka", "Godda", "Sahibganj", "Pakur", "Jamtara",
    "Koderma", "Chatra", "Palamu", "Latehar", "Garhwa",
    "Baidyanath Dham", "Parasnath", "Itkhori", "Rajrappa", "Japla",

    # ── West Bengal ─────────────────────────────────
    "Kolkata", "Howrah", "Hooghly", "Tarakeswar", "Kalighat",
    "Dakshineswar", "Belur Math", "Mayapur", "Navadvip", "Shantipur",
    "Bishnupur", "Bankura", "Purulia", "Murshidabad", "Malda",
    "Siliguri", "Darjeeling", "Jalpaiguri", "Cooch Behar",
    "Nadia", "Krishnanagar", "Burdwan", "Durgapur", "Asansol",
    "Midnapore", "Kharagpur", "Haldia", "Digha", "Bakkhali",
    "Sagar Island", "Tamluk", "Contai", "Egra", "Jhargram",
    "Barasat", "Barrackpore", "Dum Dum", "Salt Lake", "Kalyani",

    # ── Odisha ──────────────────────────────────────
    "Puri", "Bhubaneswar", "Cuttack", "Konark", "Berhampur",
    "Sambalpur", "Rourkela", "Brahmapur", "Balasore", "Bhadrak",
    "Kendujhar", "Sundargarh", "Jharsuguda", "Bargarh", "Nuapada",
    "Bolangir", "Sonepur", "Subarnpur", "Titilagarh", "Phulbani",
    "Kandhamal", "Rayagada", "Nabarangpur", "Koraput", "Malkangiri",
    "Mayurbhanj", "Keonjhar", "Dhenkanal", "Angul", "Deogarh",
    "Jagatsinghpur", "Kendrapara", "Khurda", "Nayagarh", "Ganjam",
    "Gajapati", "Jajpur", "Bhubaneswar Old Town",
    "Lingaraj", "Alarnath", "Chilika", "Taratarini", "Maa Samaleswari",

    # ── Andhra Pradesh ──────────────────────────────
    "Tirupati", "Srikalahasti", "Vijayawada", "Visakhapatnam",
    "Guntur", "Nellore", "Kurnool", "Kadapa", "Anantapur",
    "Chittoor", "Rajahmundry", "Eluru", "Ongole", "Machilipatnam",
    "Bhimavaram", "Tadepalligudem", "Palasa", "Srikakulam",
    "Vizianagaram", "Parvathipuram", "Narasaraopet", "Tenali",
    "Bapatla", "Chilakaluripet", "Sattenapalle", "Ponnur",
    "Mangalagiri", "Amaravati", "Dhone", "Adoni", "Guntakal",
    "Nandyal", "Yemmiganur", "Hindupur", "Madanapalle",
    "Srikalahasti", "Puttur", "Nagari", "Chandragiri",
    "Simhachalam", "Draksharamam", "Bhadrachalam",
    "Srisailam", "Ahobilam", "Yaganti", "Mahanandi",

    # ── Telangana ───────────────────────────────────
    "Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam",
    "Nalgonda", "Mahbubnagar", "Adilabad", "Medak", "Rangareddy",
    "Sangareddy", "Siddipet", "Yadadri", "Vemulawada",
    "Bhadrachalam", "Dharmapuri", "Jogulamba", "Kaleswaram",
    "Basara", "Komuravelli", "Kondagattu", "Medaram",

    # ── Karnataka ───────────────────────────────────
    "Bengaluru", "Mysuru", "Hubli", "Dharwad", "Mangaluru",
    "Belagavi", "Kalaburagi", "Ballari", "Vijayapura", "Shivamogga",
    "Tumakuru", "Raichur", "Koppal", "Gadag", "Haveri",
    "Uttara Kannada", "Udupi", "Chikkamagaluru", "Hassan", "Kodagu",
    "Mandya", "Chamrajanagar", "Davanagere", "Chitradurga",
    "Madhugiri", "Pavagada", "Kolar", "Chikkaballapur", "Ramanagara",
    "Bidar", "Yadgir", "Bagalkot", "Dharmasthala", "Kukke Subramanya",
    "Kollur", "Hornadu", "Sringeri", "Melukote",
    "Shravanabelagola", "Belur", "Halebidu", "Badami", "Aihole",
    "Pattadakal", "Hampi", "Gokarna", "Murudeshwar", "Idagunji",
    "Sirsi", "Yellapur", "Kumta", "Bhatkal", "Karwar",

    # ── Tamil Nadu ──────────────────────────────────
    "Chennai", "Madurai", "Tiruchirapalli", "Coimbatore", "Salem",
    "Tirunelveli", "Tiruppur", "Vellore", "Erode", "Thoothukudi",
    "Dindigul", "Thanjavur", "Cuddalore", "Kanchipuram", "Tiruvannamalai",
    "Kumbakonam", "Nagapattinam", "Mayiladuthurai", "Karaikkal",
    "Chidambaram", "Sirkazhi", "Sirkali", "Papanasam",
    "Rameswaram", "Madurai", "Palani", "Kodaikanal", "Courtallam",
    "Tiruttani", "Tiruvallur", "Kanyakumari", "Nagercoil",
    "Padmanabhapuram", "Sucindram", "Thiruvattar", "Murugan Hills",
    "Swamimalai", "Thiruchendur", "Pazhamudircholai",
    "Tiruchendur", "Virudhunagar", "Sivakasi", "Rajapalayam",
    "Sankarankovil", "Tenkasi", "Ambasamudram", "Tirunelveli",
    "Srirangam", "Vaitheeswaran Koil", "Tanjore", "Gangaikonda",
    "Darasuram", "Airavatesvara", "Thiruvarur", "Nagapattinam",
    "Velankanni", "Mylapore", "Kapaleeshwar", "Mahabalipuram",

    # ── Kerala ──────────────────────────────────────
    "Thiruvananthapuram", "Kochi", "Kozhikode", "Thrissur", "Kollam",
    "Alappuzha", "Kottayam", "Idukki", "Ernakulam", "Palakkad",
    "Malappuram", "Kannur", "Kasaragod", "Pathanamthitta", "Wayanad",
    "Sabarimala", "Guruvayur", "Vadakkumnathan", "Kodungallur",
    "Ettumanoor", "Vaikom", "Kaviyoor", "Manarcaud", "Thiruvalla",
    "Aranmula", "Chengannur", "Harippad", "Kayamkulam",
    "Ambalappuzha", "Krishnapuram", "Anchuthengu", "Varkala",
    "Attukal", "Padmanabhaswamy", "Ponmudi", "Neyyar",
    "Kollam Beach", "Sarkara", "Chettikulangara",

    # ── Maharashtra ─────────────────────────────────
    "Mumbai", "Pune", "Nagpur", "Nashik", "Shirdi", "Aurangabad",
    "Solapur", "Kolhapur", "Satara", "Sangli", "Ahmednagar",
    "Nanded", "Latur", "Osmanabad", "Beed", "Jalna",
    "Parbhani", "Hingoli", "Buldhana", "Akola", "Washim",
    "Amravati", "Yavatmal", "Wardha", "Chandrapur", "Gadchiroli",
    "Gondia", "Bhandara", "Raigad", "Ratnagiri", "Sindhudurg",
    "Thane", "Palghar", "Dhule", "Nandurbar", "Jalgaon",
    "Trimbakeshwar", "Bhimashankar", "Grishneshwar", "Pandharpanth",
    "Pandharpur", "Tuljapur", "Jejuri", "Saptashringi", "Mahalakshmi",
    "Kolhapur Mahalaxmi", "Ashtavinayak", "Morgaon", "Siddhatek",
    "Pali", "Mahad", "Theur", "Lenyadri", "Ozar", "Ranjangaon",
    "Akkalkot", "Narsimhapur", "Ganagapur", "Wani",

    # ── Gujarat ─────────────────────────────────────
    "Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar",
    "Jamnagar", "Gandhinagar", "Anand", "Mehsana", "Patan",
    "Banaskantha", "Sabarkantha", "Aravalli", "Mahisagar",
    "Kheda", "Nadiad", "Kapadwanj", "Godhra", "Dahod",
    "Chhota Udaipur", "Narmada", "Bharuch", "Surat", "Tapi",
    "Navsari", "Valsad", "Dang", "Amreli", "Gir Somnath",
    "Somnath", "Dwarka", "Palitana", "Ambaji", "Shamlaji",
    "Pavagadh", "Dakor", "Becharaji", "Tejaji",
    "Polo Forest", "Rani ki Vav", "Modhera", "Siddhpur",
    "Tarnetar", "Girnar", "Junagadh", "Porbandar", "Veraval",
    "Chorwad", "Diu", "Una", "Kodinar", "Sutrapada",

    # ── Himachal Pradesh ────────────────────────────
    "Shimla", "Mandi", "Dharamsala", "Kullu", "Manali",
    "Solan", "Sirmaur", "Bilaspur", "Una", "Hamirpur HP",
    "Kangra", "Chamba", "Kinnaur", "Lahaul and Spiti",
    "Nahan", "Paonta Sahib", "Baddi", "Nalagarh", "Kasauli",
    "Chail", "Kufri", "Rampur Bushahr", "Sarahan",
    "Vaishnodevi", "Jwala Ji", "Chamunda Devi", "Brajeshwari",
    "Naina Devi", "Rewalsar", "Manimahesh", "Bijli Mahadev",
    "Hadimba", "Baijnath HP", "Masrur", "Bahal",
    "Jakhoo", "Tara Devi", "Sankat Mochan",

    # ── Uttarakhand ─────────────────────────────────
    "Dehradun", "Haridwar", "Rishikesh", "Roorkee", "Haldwani",
    "Nainital", "Almora", "Pithoragarh", "Bageshwar", "Champawat",
    "Udham Singh Nagar", "Pauri Garhwal", "Tehri Garhwal",
    "Uttarkashi", "Chamoli", "Rudraprayag", "Kedarnath",
    "Badrinath", "Gangotri", "Yamunotri", "Auli",
    "Joshimath", "Gopeshwar", "Srinagar Garhwal", "Lansdowne",
    "Kotdwar", "Ramnagar", "Kashipur", "Jaspur", "Khatima",
    "Tanakpur", "Champawat", "Lohaghat", "Pithoragarh",
    "Munsiyari", "Dharchula", "Bhatwari", "Barkot",
    "Purola", "Mori", "Deoprayag", "Devprayag", "Rudraprayag",
    "Karnaprayag", "Nandprayag", "Vishnuprayag", "Gaurikund",
    "Sonprayag", "Ukhimath", "Tungnath", "Chopta",
    "Hariyali Devi", "Kartik Swami", "Binsar Mahadev",

    # ── Jammu & Kashmir ─────────────────────────────
    "Jammu", "Srinagar", "Anantnag", "Pulwama", "Shopian",
    "Kulgam", "Baramulla", "Kupwara", "Bandipora", "Ganderbal",
    "Budgam", "Samba", "Kathua", "Udhampur", "Reasi",
    "Rajouri", "Poonch", "Ramban", "Doda", "Kishtwar",
    "Vaishno Devi", "Patnitop", "Bhaderwah", "Batote",
    "Akhnoor", "Surinsar", "Mansar",

    # ── Punjab ──────────────────────────────────────
    "Amritsar", "Ludhiana", "Jalandhar", "Patiala", "Bathinda",
    "Mohali", "Pathankot", "Hoshiarpur", "Gurdaspur", "Kapurthala",
    "Ropar", "Fatehgarh Sahib", "Anandpur Sahib", "Sirhind",
    "Muktsar", "Faridkot", "Moga", "Ferozepur", "Fazilka",
    "Tarn Taran", "Goindwal Sahib", "Khadur Sahib",

    # ── Haryana ─────────────────────────────────────
    "Faridabad", "Gurgaon", "Panipat", "Ambala", "Yamunanagar",
    "Hisar", "Rohtak", "Karnal", "Sonipat", "Kurukshetra",
    "Pehowa", "Thanesar", "Bhiwani", "Jhajjar", "Rewari",
    "Mahendragarh", "Charkhi Dadri", "Nuh", "Palwal", "Mewat",
    "Jind", "Kaithal", "Panchkula", "Sirsa", "Fatehabad",
    "Sthaneswara", "Brahma Sarovar", "Sannihit Sarovar",

    # ── Delhi & NCR ─────────────────────────────────
    "New Delhi", "Delhi", "Dwarka", "Rohini", "Pitampura",
    "Lajpat Nagar", "Karol Bagh", "Chandni Chowk", "Connaught Place",
    "Noida", "Greater Noida", "Ghaziabad", "Faridabad", "Gurgaon",
    "Chattarpur", "Chhatarpur", "Mehrauli", "Tughlaqabad",

    # ── Assam ───────────────────────────────────────
    "Guwahati", "Dibrugarh", "Jorhat", "Silchar", "Tezpur",
    "Nagaon", "Barpeta", "Nalbari", "Kamrup", "Dhubri",
    "Goalpara", "Bongaigaon", "Kokrajhar", "Chirang",
    "Kamakhya", "Hajo", "Madan Kamdev", "Sualkuchi",

    # ── Northeast States ────────────────────────────
    "Imphal", "Shillong", "Agartala", "Aizawl", "Kohima",
    "Itanagar", "Gangtok", "Dispur", "Lumding", "Diphu",
    "Pelling", "Rumtek", "Yuksom", "Tawang", "Bomdila",
    "Ziro", "Along", "Pasighat", "Tezu",

    # ── Goa ─────────────────────────────────────────
    "Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda",
    "Calangute", "Baga", "Anjuna", "Candolim", "Sinquerim",
    "Mangeshi", "Shantadurga", "Mahalsa", "Brahma Shanti",

    # ── Chhattisgarh ────────────────────────────────
    "Raipur", "Bhilai", "Durg", "Bilaspur CG", "Korba",
    "Raigarh", "Rajnandgaon", "Jagdalpur", "Ambikapur",
    "Dantewada", "Bastar", "Kanker", "Kondagaon", "Sukma",
    "Bijapur CG", "Narayanpur", "Gariaband", "Mahasamund",
    "Dhamtari", "Balod", "Baloda Bazar", "Bemetara", "Mungeli",
    "Janjgir", "Champa", "Koriya", "Baikunthpur", "Surajpur",
    "Dongargarh", "Ratanpur", "Sirpur", "Rajim", "Shivrinarayan",
    "Champaran CG", "Deobaloda", "Chandrapur CG", "Khallari",

    # ── Sikkim & Hill Stations ───────────────────────
    "Gangtok", "Namchi", "Gyalshing", "Mangan", "Ravangla",
    "Pelling", "Yuksom", "Tashiding", "Rumtek",

    # ── Famous temple towns (all India) ─────────────
    "Kedarnath", "Badrinath", "Gangotri", "Yamunotri",
    "Amarnath", "Vaishno Devi", "Sabarimala", "Palani",
    "Tirupati", "Guruvayur", "Madurai", "Rameswaram",
    "Kanyakumari", "Srirangam", "Chidambaram", "Kumbakonam",
    "Kanchipuram", "Mahabalipuram", "Vellore", "Tiruvannamalai",
    "Hampi", "Belur", "Halebidu", "Badami", "Aihole",
    "Pattadakal", "Dharmasthala", "Kukke Subramanya",
    "Kollur", "Gokarna", "Murudeshwar",
    "Shirdi", "Pandharpur", "Jejuri", "Tuljapur",
    "Trimbakeshwar", "Bhimashankar", "Grishneshwar",
    "Somnath", "Dwarka", "Palitana", "Ambaji",
    "Nathdwara", "Khatu Shyam", "Salasar Balaji",
    "Pushkar", "Ajmer", "Deshnoke",
    "Varanasi", "Prayagraj", "Mathura", "Vrindavan", "Ayodhya",
    "Gaya", "Bodhgaya", "Rajgir", "Pawapuri", "Nalanda",
    "Orchha", "Chitrakoot", "Amarkantak", "Omkareshwar",
    "Ujjain", "Maihar", "Salkanpur", "Maheshwar",
    "Kamakhya", "Tezpur", "Barpeta",
    "Puri", "Konark", "Bhubaneswar",
    "Baidyanath Dham", "Parasnath",
    "Deoghar", "Rajrappa",
])


def fuzzy_match_cities(query: str, limit: int = 8) -> List[str]:
    """
    Fast substring + prefix scoring — no external dependency needed.
    Scores: exact prefix = 3, starts-with = 2, contains = 1.
    """
    q = query.strip().lower()
    if not q:
        return []

    scored = []
    for city in INDIAN_PILGRIMAGE_CITIES:
        cl = city.lower()
        if cl == q:
            scored.append((4, city))
        elif cl.startswith(q):
            scored.append((3, city))
        elif any(word.startswith(q) for word in cl.split()):
            scored.append((2, city))
        elif q in cl:
            scored.append((1, city))

    scored.sort(key=lambda x: (-x[0], x[1]))
    return [c for _, c in scored[:limit]]


# ─────────────────────────────────────────────
# GET /api/route/cities — Local list + Nominatim fallback
# ─────────────────────────────────────────────

@router.get("/cities", response_model=CitySearchResponse)
async def search_cities(q: str = Query(..., min_length=1, description="City search query")):
    """
    Returns city suggestions.
    Strategy:
      1. Fuzzy-match against local ~1500-city pilgrimage list (instant, free).
      2. If fewer than 3 local results, fall back to Nominatim (OpenStreetMap) — free, no API key.
    """
    query = q.strip()

    # ── Step 1: Local match ──────────────────────────────────────────────────
    local_results = fuzzy_match_cities(query, limit=8)

    if len(local_results) >= 3:
        return CitySearchResponse(cities=local_results)

    # ── Step 2: Nominatim fallback ───────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            res = await client.get(
                "https://nominatim.openstreetmap.org/search",
                params={
                    "q":            query,
                    "countrycodes": "in",
                    "format":       "json",
                    "limit":        10,
                    "addressdetails": 1,
                },
                headers={
                    # Required by Nominatim ToS — identify your app
                    "User-Agent": "BharatMandir/1.0 (bharatmandir@example.com)",
                    "Accept-Language": "en",
                },
            )

        if res.status_code != 200:
            # Nominatim failed — return whatever local results we have
            return CitySearchResponse(cities=local_results)

        data = res.json()
        nominatim_cities = []
        seen = set(c.lower() for c in local_results)

        for item in data:
            # Extract just the city/town/village name from display_name
            addr = item.get("address", {})
            name = (
                addr.get("city")
                or addr.get("town")
                or addr.get("village")
                or addr.get("county")
                or item.get("display_name", "").split(",")[0]
            ).strip()

            if name and name.lower() not in seen:
                seen.add(name.lower())
                nominatim_cities.append(name)

        # Merge: local results first (better quality), then Nominatim additions
        merged = local_results + nominatim_cities
        return CitySearchResponse(cities=merged[:8])

    except Exception:
        # Network error or timeout — gracefully fall back to local results only
        return CitySearchResponse(cities=local_results)


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
   - Suggest as many REAL temples as genuinely exist on this route — do NOT invent or stretch.
     For short routes (under 60 km) with only 2 cities, 3-5 temples is fine.
     For longer routes (100+ km) with many towns, aim for 6-8 temples.
     Quality over quantity — only real, significant temples.
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