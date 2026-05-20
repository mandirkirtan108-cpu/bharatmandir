"""
AI Festival Cache Router — BharatMandir
======================================================
GET  /api/festivals/ai-cache               → return cached festivals
GET  /api/festivals/ai-cache?refresh=true  → force-refresh from Calendarific
POST /api/admin/festivals/ai-refresh       → admin force-refresh

Data source: Calendarific API (verified Hindu festival dates)
Descriptions: OpenAI (gpt-4o) — used ONLY for text, never for dates
Year-aware: auto-detects new year, fetches fresh data for that year
"""

from fastapi import APIRouter, HTTPException, Header, Depends, BackgroundTasks, Query
import httpx, json, os, logging
from datetime import date, datetime
from db.connection import get_db_cursor

logger = logging.getLogger(__name__)
router = APIRouter(tags=["AI Festival Cache"])

# ── Config ────────────────────────────────────────────────────────────────────
CALENDARIFIC_API_KEY = os.getenv("CALENDARIFIC_API_KEY", "")
CALENDARIFIC_URL     = "https://calendarific.com/api/v2/holidays"

OPENAI_API_KEY       = os.getenv("VITE_OPENAI_API_KEY", "")
OPENAI_URL           = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL         = "gpt-4o"

MIN_CACHE_COUNT      = 10
_ADMIN_SECRET        = os.getenv("VITE_ADMIN_SECRET_KEY", "change-me-now")

# ── Hindu-related festival types from Calendarific ───────────────────────────
# Calendarific returns many types; we filter to only these
ALLOWED_TYPES = {
    "hindu",
    "hinduism",
    "jain",
    "jainism",
    "sikh",
    "sikhism",
    "observance",   # catches many Hindu vrats/ekadashis
    "optional holiday",
    "common local holiday",
}

# Keywords to INCLUDE even if type doesn't match (catches regional Hindu festivals)
INCLUDE_KEYWORDS = [
    "diwali", "holi", "navratri", "dussehra", "ram", "krishna", "shiva",
    "ganesh", "durga", "lakshmi", "saraswati", "hanuman", "puja", "purnima",
    "ekadashi", "amavasya", "chaturthi", "sankranti", "pongal", "onam",
    "bihu", "baisakhi", "ugadi", "gudi", "lohri", "teej", "vrat", "jayanti",
    "janmashtami", "shivaratri", "raksha", "dhanteras", "chhath", "karwa",
    "govardhan", "bhai", "guru", "rath yatra", "akshaya", "vasant",
    "mahavir", "guru nanak", "mahashivratri", "buddha", "holika",
    "nag panchami", "hartalika", "anant", "ahoi", "vivah panchami",
    "gita jayanti", "dev uthani", "kartik", "pausha", "magha", "phalguna",
    "chaitra", "vaishakha", "jyeshtha", "ashadha", "shravana", "bhadrapada",
    "ashwin", "vishu", "jain", "paryushana", "mahavir", "diwali", "deepavali",
    "muharram",  # some calendars mix; we keep Hindu ones via keyword filter
]

# Keywords to EXCLUDE (non-Hindu festivals we don't want)
EXCLUDE_KEYWORDS = [
    "christmas", "easter", "good friday", "halloween", "thanksgiving",
    "new year", "valentine", "mother's day", "father's day", "labor day",
    "independence day", "republic day",  # keep if Hindu context, remove generic
    "eid", "ramadan", "muharram", "prophet", "islamic",
    "baptist", "orthodox", "catholic", "protestant",
]


def require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != _ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")


# ── Emoji & color mapping ─────────────────────────────────────────────────────
FESTIVAL_EMOJI_MAP = {
    "diwali":        ("🪔", "#F59E0B"),
    "deepavali":     ("🪔", "#F59E0B"),
    "holi":          ("🎨", "#E85CA0"),
    "holika":        ("🔥", "#DC2626"),
    "navratri":      ("🪆", "#BE185D"),
    "durga":         ("🪆", "#BE185D"),
    "dussehra":      ("🏹", "#DC2626"),
    "vijayadashami": ("🏹", "#DC2626"),
    "ganesh":        ("🐘", "#D97706"),
    "chaturthi":     ("🐘", "#D97706"),
    "janmashtami":   ("🪈", "#1D4ED8"),
    "krishna":       ("🪈", "#1D4ED8"),
    "shivaratri":    ("🔱", "#5B4FDB"),
    "shiva":         ("🔱", "#5B4FDB"),
    "ram navami":    ("🏹", "#2E8B57"),
    "rama":          ("🏹", "#2E8B57"),
    "hanuman":       ("🐒", "#E8650A"),
    "raksha":        ("🪢", "#E85CA0"),
    "dhanteras":     ("🪙", "#C8960C"),
    "lakshmi":       ("✨", "#C8960C"),
    "saraswati":     ("🌸", "#C8960C"),
    "vasant":        ("🌸", "#C8960C"),
    "pongal":        ("🌾", "#E8650A"),
    "bihu":          ("🌾", "#D97706"),
    "baisakhi":      ("🌾", "#D97706"),
    "lohri":         ("🔥", "#DC2626"),
    "onam":          ("🌺", "#16a34a"),
    "ugadi":         ("🪔", "#E8650A"),
    "gudi":          ("🪔", "#E8650A"),
    "sankranti":     ("🪁", "#E8650A"),
    "surya":         ("☀️",  "#E8650A"),
    "chhath":        ("☀️",  "#E8650A"),
    "guru":          ("📿", "#8B5CF6"),
    "purnima":       ("🌕", "#C8960C"),
    "ekadashi":      ("📿", "#8B5CF6"),
    "amavasya":      ("🌑", "#1F2937"),
    "rath yatra":    ("🛕", "#E85C2A"),
    "jagannath":     ("🛕", "#E85C2A"),
    "karwa":         ("🌕", "#C8960C"),
    "teej":          ("🌿", "#16a34a"),
    "nag":           ("🐍", "#065F46"),
    "buddha":        ("☸️",  "#D97706"),
    "mahavir":       ("🙏", "#D97706"),
    "jain":          ("🙏", "#D97706"),
    "akshaya":       ("✨", "#C8960C"),
    "govardhan":     ("⛰️",  "#1D4ED8"),
    "bhai dooj":     ("🌺", "#E85CA0"),
    "gita":          ("📖", "#1D4ED8"),
    "vivah":         ("💐", "#EC4899"),
}

DEITY_KEYWORD_MAP = {
    "shiva": "Shiva", "shivaratri": "Shiva",
    "krishna": "Krishna", "janmashtami": "Krishna",
    "ram": "Rama", "rama": "Rama",
    "hanuman": "Hanuman",
    "ganesh": "Ganesha", "chaturthi": "Ganesha",
    "durga": "Durga", "navratri": "Durga",
    "lakshmi": "Lakshmi", "dhanteras": "Lakshmi", "diwali": "Lakshmi",
    "saraswati": "Saraswati", "vasant": "Saraswati",
    "surya": "Surya", "sankranti": "Surya", "pongal": "Surya", "chhath": "Surya",
    "vishnu": "Vishnu", "ekadashi": "Vishnu", "purnima": "Vishnu",
    "buddha": "Vishnu",
}


def _get_emoji_color(name: str):
    nl = name.lower()
    for key, (emoji, color) in FESTIVAL_EMOJI_MAP.items():
        if key in nl:
            return emoji, color
    return "🛕", "#E8650A"


def _get_deity(name: str):
    nl = name.lower()
    for key, deity in DEITY_KEYWORD_MAP.items():
        if key in nl:
            return deity
    return "Other"


def _is_hindu_festival(name: str, festival_type: str) -> bool:
    """Return True if this festival should be included."""
    nl   = name.lower()
    tl   = (festival_type or "").lower()

    # Hard exclude non-Hindu festivals
    for kw in EXCLUDE_KEYWORDS:
        if kw in nl:
            return False

    # Include if type is Hindu/Jain/Sikh
    for allowed in ALLOWED_TYPES:
        if allowed in tl:
            return True

    # Include if name contains Hindu keywords
    for kw in INCLUDE_KEYWORDS:
        if kw in nl:
            return True

    return False


# ── Calendarific API call ─────────────────────────────────────────────────────

async def _fetch_from_calendarific(year: int) -> list[dict]:
    """
    Fetch Hindu festivals from Calendarific for India.
    Returns normalized list ready for DB insert.
    """
    if not CALENDARIFIC_API_KEY:
        raise RuntimeError("CALENDARIFIC_API_KEY not set in Railway environment variables")

    params = {
        "api_key": CALENDARIFIC_API_KEY,
        "country": "IN",
        "year":    year,
        "type":    "religious",   # religious type gives Hindu/Jain/Sikh festivals
    }

    logger.info(f"Fetching from Calendarific for year={year}...")

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(CALENDARIFIC_URL, params=params)

    if response.status_code != 200:
        raise RuntimeError(
            f"Calendarific API error {response.status_code}: {response.text[:300]}"
        )

    data = response.json()

    if data.get("meta", {}).get("code") != 200:
        raise RuntimeError(
            f"Calendarific API returned error: {data.get('meta', {})}"
        )

    raw_holidays = data.get("response", {}).get("holidays", [])
    logger.info(f"Calendarific returned {len(raw_holidays)} total holidays for {year}")

    festivals = []
    seen_names = set()

    for h in raw_holidays:
        name  = h.get("name", "").strip()
        htype = h.get("type", [""])[0] if isinstance(h.get("type"), list) else h.get("type", "")

        # Filter to Hindu/Jain/Sikh only
        if not _is_hindu_festival(name, htype):
            continue

        # De-duplicate by name
        if name.lower() in seen_names:
            continue
        seen_names.add(name.lower())

        # Parse date
        date_obj  = h.get("date", {}).get("iso", "")
        if not date_obj:
            continue

        try:
            dt    = datetime.strptime(date_obj[:10], "%Y-%m-%d")
            month = dt.month
        except ValueError:
            continue

        emoji, color = _get_emoji_color(name)
        deity        = _get_deity(name)

        # Build display_date
        display_date = dt.strftime("%-d %B %Y")  # e.g. "8 November 2026"

        festivals.append({
            "name":         name,
            "month":        month,
            "exact_date":   date_obj[:10],
            "display_date": display_date,
            "hindu_tithi":  h.get("description", ""),
            "hindu_month":  "",           # filled by OpenAI enrichment
            "significance": "",           # filled by OpenAI enrichment
            "description":  "",           # filled by OpenAI enrichment
            "is_major":     htype.lower() in ["national holiday", "common local holiday", "hindu"] or any(
                                kw in name.lower() for kw in [
                                    "diwali","holi","navratri","dussehra","janmashtami",
                                    "ganesh chaturthi","ram navami","hanuman jayanti",
                                    "maha shivaratri","raksha bandhan","pongal","onam",
                                    "baisakhi","guru nanak","mahavir jayanti","buddha purnima",
                                    "chhath","dhanteras","bhai dooj","karwa chauth",
                                    "akshaya tritiya","guru purnima","rath yatra",
                                ]
                            ),
            "duration_days": _get_duration(name),
            "deity":        deity,
            "emoji":        emoji,
            "color":        color,
            "festival_type": htype,
        })

    logger.info(f"Filtered to {len(festivals)} Hindu/Jain/Sikh festivals for {year}")
    return festivals


def _get_duration(name: str) -> int:
    """Return known multi-day durations."""
    nl = name.lower()
    durations = {
        "navratri": 9, "navaratri": 9,
        "diwali": 5, "deepavali": 5,
        "pongal": 4, "chhath": 4,
        "onam": 10,
        "ganesh chaturthi": 10,
        "holi": 2,
        "janmashtami": 2,
        "rath yatra": 1,
        "durga puja": 5,
        "paryushana": 8,
    }
    for key, days in durations.items():
        if key in nl:
            return days
    return 1


# ── OpenAI enrichment (descriptions only, never dates) ───────────────────────

async def _enrich_with_descriptions(festivals: list[dict]) -> list[dict]:
    """
    Use OpenAI ONLY to add:
    - significance (1 sentence)
    - description (2-3 sentences)
    - hindu_month (Sanskrit month name)

    Dates, names, tithis — all come from Calendarific. Never from AI.
    Falls back to placeholder text if OpenAI fails.
    """
    if not OPENAI_API_KEY:
        for f in festivals:
            f["significance"] = f"{f['name']} is an important Hindu observance."
            f["description"]  = f"{f['name']} is celebrated with great devotion across India."
        return festivals

    # Batch all festivals in one call to save tokens
    names  = [f["name"] for f in festivals]
    prompt = (
        "For each Hindu/Jain/Sikh festival below, return a JSON array.\n"
        "Each object must have exactly these keys:\n"
        '{"name":"...","significance":"1 sentence","description":"2-3 sentences","hindu_month":"Sanskrit month name e.g. Kartika"}\n'
        "Return ONLY the JSON array. No markdown, no backticks, no extra text.\n\n"
        f"Festivals: {json.dumps(names)}"
    )

    try:
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(
                OPENAI_URL,
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type":  "application/json",
                },
                json={
                    "model": OPENAI_MODEL, "temperature": 0,
                    "messages": [
                        {"role": "system", "content": "You are an expert in Hindu, Jain, and Sikh festivals. Return only valid JSON arrays with no extra text."},
                        {"role": "user",   "content": prompt},
                    ],
                },
            )

        if r.status_code != 200:
            raise RuntimeError(f"OpenAI {r.status_code}: {r.text[:200]}")

        raw     = r.json().get("choices", [{}])[0].get("message", {}).get("content", "[]")
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        descs    = json.loads(cleaned)
        desc_map = {d["name"].lower(): d for d in descs if isinstance(d, dict) and "name" in d}

        for f in festivals:
            m = desc_map.get(f["name"].lower(), {})
            f["significance"] = m.get("significance", f"{f['name']} is an important Hindu observance.")
            f["description"]  = m.get("description",  f"{f['name']} is celebrated with great devotion across India.")
            f["hindu_month"]  = m.get("hindu_month",  f["hindu_month"] or "")

        logger.info(f"OpenAI enriched {len(festivals)} festivals with descriptions")

    except Exception as e:
        logger.warning(f"OpenAI enrichment failed: {e} — using placeholder descriptions")
        for f in festivals:
            f.setdefault("significance", f"{f['name']} is an important Hindu observance.")
            f.setdefault("description",  f"{f['name']} is celebrated with great devotion across India.")

    return festivals


# ── DB helpers ────────────────────────────────────────────────────────────────

def _ensure_cached_year_columns():
    with get_db_cursor() as cur:
        cur.execute("""
            ALTER TABLE public.festivals
                ADD COLUMN IF NOT EXISTS cached_year  INT,
                ADD COLUMN IF NOT EXISTS cached_month INT
        """)
        cur.execute("""
            UPDATE public.festivals
            SET cached_year  = EXTRACT(YEAR  FROM typical_date::date)::INT,
                cached_month = EXTRACT(MONTH FROM typical_date::date)::INT
            WHERE source = 'ai_cache' AND cached_year IS NULL AND typical_date IS NOT NULL
        """)
        cur.execute("""
            UPDATE public.festivals
            SET cached_year  = EXTRACT(YEAR FROM NOW())::INT,
                cached_month = month
            WHERE source = 'ai_cache' AND cached_year IS NULL
        """)


def _get_cached_year(year: int) -> list[dict]:
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS cnt FROM public.festivals WHERE source='ai_cache' AND cached_year=%s",
            (year,)
        )
        count = int(cur.fetchone()["cnt"] or 0)

        if count < MIN_CACHE_COUNT:
            logger.info(f"Cache MISS year={year}: {count} rows (need >={MIN_CACHE_COUNT})")
            return []

        cur.execute("""
            SELECT
                f.id, f.name, f.description, f.significance,
                f.month, f.hindu_month, f.hindu_tithi,
                f.typical_date AS exact_date, f.display_date,
                f.duration_days, f.is_major, f.deity,
                f.festival_type, f.emoji, f.color,
                f.cached_year, f.cached_month, f.source, f.ai_generated,
                NULL::int  AS temple_id, NULL::text AS temple_name,
                NULL::text AS temple_city, NULL::text AS temple_slug
            FROM public.festivals f
            WHERE f.source = 'ai_cache' AND f.cached_year = %s
            ORDER BY f.month ASC, f.typical_date ASC NULLS LAST
        """, (year,))
        rows = [dict(r) for r in cur.fetchall()]
        logger.info(f"Cache HIT year={year}: {len(rows)} rows")
        return rows


def _delete_year_cache(year: int):
    with get_db_cursor() as cur:
        cur.execute(
            "DELETE FROM public.festivals WHERE source='ai_cache' AND (cached_year=%s OR cached_year IS NULL)",
            (year,)
        )
        logger.info(f"Deleted {cur.rowcount} ai_cache rows for year={year}")


def _delete_stale_cache(year: int, before_month: int):
    with get_db_cursor() as cur:
        cur.execute("""
            DELETE FROM public.festivals
            WHERE source='ai_cache' AND cached_year=%s
              AND cached_month IS NOT NULL AND cached_month < %s
        """, (year, before_month))
        if cur.rowcount:
            logger.info(f"Pruned {cur.rowcount} stale rows (year={year}, before_month={before_month})")


def _insert_ai_festivals(festivals: list[dict], year: int):
    with get_db_cursor() as cur:
        inserted = skipped = 0
        for f in festivals:
            try:
                m = f.get("month")
                if not m or not (1 <= int(m) <= 12):
                    skipped += 1
                    continue
                cur.execute("""
                    INSERT INTO public.festivals (
                        temple_id, name, description, significance,
                        month, hindu_month, hindu_tithi,
                        typical_date, display_date, duration_days, is_major,
                        source, ai_generated, deity, festival_type, emoji, color,
                        cached_year, cached_month
                    ) VALUES (
                        NULL, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        'ai_cache', TRUE, %s, %s, %s, %s, %s, %s
                    ) ON CONFLICT DO NOTHING
                """, (
                    (f.get("name") or "")[:200],
                    f.get("description"),
                    f.get("significance"),
                    int(m),
                    f.get("hindu_month"),
                    f.get("hindu_tithi"),
                    f.get("exact_date"),
                    f.get("display_date"),
                    max(1, int(f.get("duration_days") or 1)),
                    bool(f.get("is_major")),
                    f.get("deity"),
                    f.get("festival_type"),
                    f.get("emoji"),
                    f.get("color"),
                    year,
                    int(m),
                ))
                inserted += 1
            except Exception as e:
                logger.error(f"Insert failed '{f.get('name')}': {e}")
                raise
        logger.info(f"Stored: {inserted} inserted, {skipped} skipped (year={year})")


# ── Main orchestrator ─────────────────────────────────────────────────────────

async def _fetch_and_store(year: int, force: bool = False) -> list[dict]:
    """
    1. Check DB cache — return immediately if data exists for this year.
    2. On miss: fetch from Calendarific (accurate real dates).
    3. Enrich with OpenAI descriptions (never dates).
    4. Store in DB.
    """
    _ensure_cached_year_columns()

    if not force:
        existing = _get_cached_year(year)
        if existing:
            return existing

    if force:
        _delete_year_cache(year)

    # Fetch verified dates from Calendarific
    festivals = await _fetch_from_calendarific(year)

    if not festivals:
        raise RuntimeError(
            f"Calendarific returned 0 Hindu festivals for {year}. "
            f"Check your CALENDARIFIC_API_KEY and API quota."
        )

    # Enrich with descriptions via OpenAI (dates never touched)
    festivals = await _enrich_with_descriptions(festivals)

    # Store in DB
    _insert_ai_festivals(festivals, year)
    logger.info(f"Successfully stored {len(festivals)} festivals for year={year}")
    return festivals


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/api/festivals/ai-cache/debug")
async def debug_ai_cache():
    """Diagnostic endpoint — call this to check DB state."""
    today = date.today()
    yr    = today.year
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT source, cached_year, COUNT(*) AS total,
                   MIN(month) AS min_month, MAX(month) AS max_month
            FROM public.festivals WHERE source='ai_cache'
            GROUP BY source, cached_year ORDER BY cached_year NULLS LAST
        """)
        breakdown = [dict(r) for r in cur.fetchall()]
        cur.execute("SELECT COUNT(*) AS t FROM public.festivals WHERE source='ai_cache'")
        total = cur.fetchone()["t"]
        cur.execute("SELECT COUNT(*) AS t FROM public.festivals WHERE source='ai_cache' AND cached_year=%s", (yr,))
        this_yr = cur.fetchone()["t"]

    return {
        "current_year":             yr,
        "total_ai_cache_rows":      total,
        "this_year_rows":           this_yr,
        "min_needed_for_cache_hit": MIN_CACHE_COUNT,
        "will_hit_cache":           this_yr >= MIN_CACHE_COUNT,
        "calendarific_key_set":     bool(CALENDARIFIC_API_KEY),
        "openai_key_set":           bool(OPENAI_API_KEY),
        "breakdown_by_year":        breakdown,
    }


@router.get("/api/festivals/ai-cache")
async def get_ai_festival_cache(
    background_tasks: BackgroundTasks,
    refresh: bool = Query(False, description="Force re-fetch from Calendarific"),
):
    """
    Return Hindu festivals for the current year.
    - DB hit  → instant response, no external API call
    - DB miss → Calendarific fetch + OpenAI descriptions + store → return
    - Year change on Jan 1 → automatic cache miss → fresh Calendarific data
    """
    today         = date.today()
    current_year  = today.year
    current_month = today.month

    _ensure_cached_year_columns()

    if today.day == 1 and current_month > 1:
        background_tasks.add_task(_delete_stale_cache, current_year, current_month)

    if refresh:
        logger.info(f"Force refresh for year={current_year}")
        try:
            await _fetch_and_store(current_year, force=True)
        except Exception as e:
            logger.error(f"Force refresh failed: {e}")
            raise HTTPException(status_code=503, detail=str(e))
        stored = _get_cached_year(current_year)
        return {"source": "fresh", "year": current_year, "count": len(stored), "festivals": stored}

    cached = _get_cached_year(current_year)
    if cached:
        return {"source": "db_cache", "year": current_year, "count": len(cached), "festivals": cached}

    logger.info(f"Cache miss for year={current_year} — fetching from Calendarific...")
    try:
        await _fetch_and_store(current_year, force=False)
    except Exception as e:
        logger.error(f"Fetch failed: {e}")
        raise HTTPException(status_code=503, detail=str(e))

    stored = _get_cached_year(current_year)
    if not stored:
        raise HTTPException(
            status_code=502,
            detail="No festivals stored — check CALENDARIFIC_API_KEY and DB commit"
        )
    return {"source": "fresh", "year": current_year, "count": len(stored), "festivals": stored}


@router.post("/api/admin/festivals/ai-refresh", dependencies=[Depends(require_admin)])
async def admin_force_refresh():
    """Admin: wipe and re-fetch from Calendarific. Requires X-Admin-Key header."""
    today = date.today()
    yr    = today.year
    try:
        festivals = await _fetch_and_store(yr, force=True)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))
    return {
        "success":      True,
        "year":         yr,
        "fetched":      len(festivals),
        "source":       "calendarific",
        "message":      f"Refreshed: {len(festivals)} festivals for {yr}",
        "refreshed_at": datetime.utcnow().isoformat(),
    }