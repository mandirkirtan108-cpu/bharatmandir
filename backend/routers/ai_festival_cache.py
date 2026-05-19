"""
AI Festival Cache Router — BharatMandir
Fixed: proper cache check, correct DB read/write, no silent failures
"""

from fastapi import APIRouter, HTTPException, Header, Depends, BackgroundTasks, Query
import httpx, json, os, logging
from datetime import date, datetime
from db.connection import get_db_cursor

logger = logging.getLogger(__name__)
router = APIRouter(tags=["AI Festival Cache"])

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_URL     = "https://api.anthropic.com/v1/messages"
CLAUDE_MODEL      = "claude-sonnet-4-20250514"

_ADMIN_SECRET = os.getenv("ADMIN_SECRET_KEY", "change-me-now")

def require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != _ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")


# ── Schema ensure ─────────────────────────────────────────────────────────────
def _ensure_schema():
    """temple_id ko nullable banao + missing columns add karo. Idempotent."""
    with get_db_cursor() as cur:
        try:
            cur.execute("ALTER TABLE public.festivals ALTER COLUMN temple_id DROP NOT NULL")
        except Exception:
            pass  # Already nullable — ignore

    with get_db_cursor() as cur:
        cur.execute("""
            ALTER TABLE public.festivals
                ADD COLUMN IF NOT EXISTS cached_year  INT,
                ADD COLUMN IF NOT EXISTS cached_month INT,
                ADD COLUMN IF NOT EXISTS display_date TEXT,
                ADD COLUMN IF NOT EXISTS hindu_tithi  TEXT,
                ADD COLUMN IF NOT EXISTS color        TEXT
        """)


# ── DB helpers ────────────────────────────────────────────────────────────────
def _count_cached(year: int) -> int:
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) AS cnt FROM public.festivals WHERE source='ai_cache' AND cached_year=%s",
            (year,)
        )
        row = cur.fetchone()
        return int(row["cnt"]) if row else 0


def _get_cached(year: int) -> list[dict]:
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                f.id, f.name, f.description, f.significance,
                f.month, f.hindu_month, f.hindu_tithi,
                f.typical_date AS exact_date,
                f.display_date, f.duration_days, f.is_major,
                f.deity, f.emoji, f.color,
                f.cached_year, f.source,
                NULL::int  AS temple_id,
                NULL::text AS temple_name,
                NULL::text AS temple_city,
                NULL::text AS temple_slug
            FROM public.festivals f
            WHERE f.source='ai_cache' AND f.cached_year=%s
            ORDER BY f.month ASC, f.typical_date ASC NULLS LAST, f.name ASC
        """, (year,))
        return [dict(r) for r in cur.fetchall()]


def _clear_cache(year: int):
    with get_db_cursor() as cur:
        cur.execute(
            "DELETE FROM public.festivals WHERE source='ai_cache' AND cached_year=%s",
            (year,)
        )
        logger.info(f"Cleared {cur.rowcount} ai_cache rows for year={year}")


def _insert(festivals: list[dict], year: int) -> int:
    inserted = 0
    with get_db_cursor() as cur:
        for f in festivals:
            try:
                month = int(f.get("month", 0))
                name  = (f.get("name") or "").strip()[:200]
                if not name or not (1 <= month <= 12):
                    continue

                exact_date = None
                rd = (f.get("exact_date") or "").strip()
                if len(rd) == 10:
                    try:
                        date.fromisoformat(rd)
                        exact_date = rd
                    except ValueError:
                        pass

                cur.execute("""
                    INSERT INTO public.festivals (
                        temple_id, name, description, significance,
                        month, hindu_month, hindu_tithi,
                        typical_date, display_date,
                        duration_days, is_major,
                        source, ai_generated,
                        deity, emoji, color,
                        cached_year, cached_month
                    ) VALUES (
                        NULL, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s,
                        %s, %s,
                        'ai_cache', TRUE,
                        %s, %s, %s,
                        %s, %s
                    )
                    ON CONFLICT DO NOTHING
                """, (
                    name,
                    (f.get("description") or "")[:1000] or None,
                    (f.get("significance") or "")[:500]  or None,
                    month,
                    (f.get("hindu_month") or "")[:100] or None,
                    (f.get("hindu_tithi") or "")[:200] or None,
                    exact_date,
                    (f.get("display_date") or "")[:100] or None,
                    max(1, int(f.get("duration_days") or 1)),
                    bool(f.get("is_major")),
                    (f.get("deity") or "Other")[:50],
                    (f.get("emoji") or "🛕")[:10],
                    (f.get("color") or "#E8650A")[:20],
                    year, month,
                ))
                inserted += 1
            except Exception as e:
                logger.error(f"Insert error '{f.get('name')}': {e}")
                continue
    logger.info(f"Inserted {inserted}/{len(festivals)} festivals for year={year}")
    return inserted


# ── Claude API ────────────────────────────────────────────────────────────────
def _make_prompt(year: int, months: str) -> str:
    return f"""List ALL Hindu festivals, vrats, Ekadashi, Purnima, Amavasya for {year} in months: {months}.
Return ONLY a valid JSON array. No markdown, no explanation, no extra text.
Each item must have exactly these fields:
{{"name":"Makar Sankranti","month":1,"exact_date":"{year}-01-14","display_date":"14 January {year}","hindu_tithi":"Uttarayan","hindu_month":"Pausha","significance":"Sun enters Capricorn marking harvest season.","description":"People fly kites and eat til-gur. Celebrated across India as Pongal, Lohri, Bihu.","is_major":true,"duration_days":1,"deity":"Surya","emoji":"🪁","color":"#E8650A"}}
Rules:
- Include ALL festivals + regional ones: Pongal, Onam, Bihu, Ugadi, Baisakhi, Lohri, Gudi Padwa, Vishu
- Every Ekadashi, Purnima, Amavasya of each month
- exact_date must be accurate for year {year} in YYYY-MM-DD format
- deity: Shiva/Vishnu/Krishna/Rama/Ganesha/Durga/Lakshmi/Saraswati/Surya/Hanuman/Other
- Sort by exact_date ascending
- Output ONLY the JSON array, nothing else"""


async def _call_claude(prompt: str) -> list[dict]:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set in environment")

    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(
            ANTHROPIC_URL,
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": CLAUDE_MODEL,
                "max_tokens": 8000,
                "messages": [{"role": "user", "content": prompt}],
            },
        )

    if resp.status_code != 200:
        raise RuntimeError(f"Claude API {resp.status_code}: {resp.text[:400]}")

    raw = resp.json().get("content", [{}])[0].get("text", "[]").strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    # Partial recovery for truncated response
    try:
        idx = raw.rfind("},")
        if idx != -1:
            partial = json.loads("[" + raw[:idx+1].lstrip("[") + "]")
            if isinstance(partial, list):
                logger.warning(f"Partial recovery: {len(partial)} items")
                return partial
    except Exception:
        pass

    logger.error("Could not parse Claude response")
    return []


# ── Orchestrator ──────────────────────────────────────────────────────────────
async def _fetch_and_store(year: int, force: bool = False) -> list[dict]:
    try:
        _ensure_schema()
    except Exception as e:
        logger.warning(f"Schema: {e}")

    if not force:
        count = _count_cached(year)
        logger.info(f"Cached count for {year}: {count}")
        if count > 0:
            return _get_cached(year)

    if force:
        _clear_cache(year)

    logger.info(f"Fetching from Claude for year={year}...")
    h1 = await _call_claude(_make_prompt(year, "January, February, March, April, May, June"))
    h2 = await _call_claude(_make_prompt(year, "July, August, September, October, November, December"))
    combined = h1 + h2
    logger.info(f"Claude returned {len(combined)} festivals")

    if not combined:
        raise RuntimeError("Claude returned empty list")

    _insert(combined, year)

    result = _get_cached(year)
    logger.info(f"Returning {len(result)} festivals from DB")
    return result


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/api/festivals/ai-cache/debug")
async def debug_cache():
    """Ek call mein pura diagnosis — kya stored hai, kya missing hai."""
    try:
        _ensure_schema()
    except Exception:
        pass

    year = date.today().year
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT cached_year, COUNT(*) AS total, MIN(month) AS min_m, MAX(month) AS max_m
            FROM public.festivals WHERE source='ai_cache'
            GROUP BY cached_year ORDER BY cached_year NULLS LAST
        """)
        breakdown = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT COUNT(*) AS c FROM public.festivals WHERE source='ai_cache'")
        total = cur.fetchone()["c"]

        cur.execute("""
            SELECT is_nullable FROM information_schema.columns
            WHERE table_name='festivals' AND column_name='temple_id' AND table_schema='public'
        """)
        nr = cur.fetchone()
        temple_nullable = dict(nr)["is_nullable"] if nr else "unknown"

    return {
        "current_year":       year,
        "total_ai_cache":     total,
        "cached_this_year":   _count_cached(year),
        "temple_id_nullable": temple_nullable,  # Must be 'YES'
        "anthropic_key_set":  bool(ANTHROPIC_API_KEY),
        "breakdown":          breakdown,
    }


@router.get("/api/festivals/ai-cache")
async def get_ai_cache(
    background_tasks: BackgroundTasks,
    refresh: bool = Query(False),
):
    today        = date.today()
    current_year = today.year

    try:
        _ensure_schema()
    except Exception as e:
        logger.warning(f"Schema: {e}")

    # 1st of month — prune old months in background
    if today.day == 1 and today.month > 1:
        def _prune():
            with get_db_cursor() as cur:
                cur.execute("""
                    DELETE FROM public.festivals
                    WHERE source='ai_cache' AND cached_year=%s AND cached_month<%s
                """, (current_year, today.month))
        background_tasks.add_task(_prune)

    # Force refresh
    if refresh:
        try:
            festivals = await _fetch_and_store(current_year, force=True)
        except Exception as e:
            raise HTTPException(503, f"Refresh failed: {e}")
        return {"source": "fresh", "year": current_year, "count": len(festivals), "festivals": festivals}

    # DB-first: agar kuch bhi cached hai to return karo
    count = _count_cached(current_year)
    if count > 0:
        festivals = _get_cached(current_year)
        return {"source": "db_cache", "year": current_year, "count": len(festivals), "festivals": festivals}

    # Cache empty — Claude se fetch karo
    try:
        festivals = await _fetch_and_store(current_year, force=False)
    except Exception as e:
        logger.error(f"Fetch failed: {e}")
        raise HTTPException(503, f"AI fetch failed: {e}")

    if not festivals:
        raise HTTPException(502,
            "Claude returned empty list — check ANTHROPIC_API_KEY and run /api/festivals/ai-cache/debug")

    return {"source": "fresh", "year": current_year, "count": len(festivals), "festivals": festivals}


@router.post("/api/admin/festivals/ai-refresh", dependencies=[Depends(require_admin)])
async def admin_refresh():
    year = date.today().year
    try:
        festivals = await _fetch_and_store(year, force=True)
    except Exception as e:
        raise HTTPException(503, str(e))
    return {
        "success": True,
        "year": year,
        "count": len(festivals),
        "refreshed_at": datetime.utcnow().isoformat(),
    }