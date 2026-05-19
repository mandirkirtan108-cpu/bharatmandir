"""
AI Festival Cache Router — BharatMandir
======================================================
GET  /api/festivals/ai-cache               → return cached or freshly fetched AI festivals
GET  /api/festivals/ai-cache?refresh=true  → force-refresh (wipe DB cache, re-fetch)
POST /api/admin/festivals/ai-refresh       → force-refresh AI festival cache (admin only)

Switched from Claude to OpenAI (gpt-4o) for accurate festival dates.
Year-aware: festivals are fetched and cached PER YEAR.
If the year changes (e.g. 2026 → 2027), a fresh fetch is triggered automatically.
"""

from fastapi import APIRouter, HTTPException, Header, Depends, BackgroundTasks, Query
from typing import Optional
import httpx
import json
import os
import logging
from datetime import date, datetime

from db.connection import get_db_cursor

logger = logging.getLogger(__name__)
router = APIRouter(tags=["AI Festival Cache"])

# ── Config ────────────────────────────────────────────────────────────────────
OPENAI_API_KEY  = os.getenv("VITE_OPENAI_API_KEY", "")
OPENAI_URL      = "https://api.openai.com/v1/chat/completions"
OPENAI_MODEL    = "gpt-4o"          # accurate dates; swap to gpt-4o-mini to save cost
MIN_CACHE_COUNT = 10                # fewer rows than this = treat as cache miss

_ADMIN_SECRET = os.getenv("VITE_ADMIN_SECRET_KEY", "change-me-now")


def require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != _ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden: invalid admin key")


# ── Prompts ───────────────────────────────────────────────────────────────────
def _make_prompt(year: int, months: str) -> str:
    return f"""You are an expert in the Hindu calendar. List ALL Hindu festivals, vrats, and observances for the year {year} occurring in these months: {months}.

CRITICAL: Use the EXACT Gregorian calendar dates for {year}. Do NOT guess or reuse dates from other years. Hindu festival dates shift every year based on the lunisolar calendar — calculate them accurately for {year}.

Return ONLY a valid JSON array. No explanation, no markdown, no backticks, no extra text before or after.

Each object must have EXACTLY these fields:
{{"name":"string","month":1,"exact_date":"{year}-01-14","display_date":"14 January {year}","hindu_tithi":"string","hindu_month":"string","significance":"one sentence","description":"2-3 sentences","is_major":true,"duration_days":1,"deity":"Surya","emoji":"🪁","color":"#E8650A"}}

Rules:
- month: integer 1-12 (Gregorian month number)
- exact_date: YYYY-MM-DD format, must be a real date in {year}
- display_date: human-readable, e.g. "14 January {year}"
- Cover every festival, vrat, Ekadashi, Purnima, Amavasya, Chaturthi, Sankashti
- Include regional festivals: Pongal, Onam, Bihu, Ugadi, Baisakhi, Lohri, Gudi Padwa, Vishu, Rath Yatra, Chhath Puja
- is_major: true only for nationally celebrated festivals
- deity: one of Shiva/Vishnu/Krishna/Rama/Ganesha/Durga/Lakshmi/Saraswati/Surya/Hanuman/Other
- duration_days: accurate multi-day festivals (e.g. Navratri=9, Diwali=5)
- Sort by exact_date ascending
- Output ONLY the JSON array, nothing else"""


# ── DB helpers ────────────────────────────────────────────────────────────────

def _ensure_cached_year_columns():
    """
    Idempotently add cached_year/cached_month columns if missing.
    Backfills NULL values from typical_date or month column.
    Safe to call on every request — no-op after first run.
    """
    with get_db_cursor() as cur:
        cur.execute("""
            ALTER TABLE public.festivals
                ADD COLUMN IF NOT EXISTS cached_year  INT,
                ADD COLUMN IF NOT EXISTS cached_month INT
        """)
        # Backfill from typical_date where available
        cur.execute("""
            UPDATE public.festivals
            SET
                cached_year  = EXTRACT(YEAR  FROM typical_date::date)::INT,
                cached_month = EXTRACT(MONTH FROM typical_date::date)::INT
            WHERE source     = 'ai_cache'
              AND cached_year IS NULL
              AND typical_date IS NOT NULL
        """)
        # Rows without typical_date: use current year + month column
        cur.execute("""
            UPDATE public.festivals
            SET
                cached_year  = EXTRACT(YEAR FROM NOW())::INT,
                cached_month = month
            WHERE source     = 'ai_cache'
              AND cached_year IS NULL
        """)
        if cur.rowcount:
            logger.info(f"Backfilled cached_year for {cur.rowcount} ai_cache rows")


def _get_cached_year(year: int) -> list[dict]:
    """
    Return all ai_cache festivals for the given year from DB.

    Cache hit:  returns rows if >= MIN_CACHE_COUNT rows exist for this specific year.
    Cache miss: returns [] — caller must fetch from OpenAI.

    Strict year filter ensures each year gets its own accurate dated data.
    Includes NULL cached_year fallback for migration compatibility.
    """
    with get_db_cursor() as cur:
        # Check rows for THIS specific year
        cur.execute("""
            SELECT COUNT(*) AS cnt
            FROM public.festivals
            WHERE source      = 'ai_cache'
              AND cached_year = %s
        """, (year,))
        year_count = int(cur.fetchone()["cnt"] or 0)

        if year_count >= MIN_CACHE_COUNT:
            cur.execute("""
                SELECT
                    f.id,
                    f.name,
                    f.description,
                    f.significance,
                    f.month,
                    f.hindu_month,
                    f.hindu_tithi,
                    f.typical_date    AS exact_date,
                    f.display_date,
                    f.duration_days,
                    f.is_major,
                    f.deity,
                    f.festival_type,
                    f.emoji,
                    f.color,
                    f.cached_year,
                    f.cached_month,
                    f.source,
                    f.ai_generated,
                    NULL::int         AS temple_id,
                    NULL::text        AS temple_name,
                    NULL::text        AS temple_city,
                    NULL::text        AS temple_slug
                FROM public.festivals f
                WHERE f.source      = 'ai_cache'
                  AND f.cached_year = %s
                ORDER BY f.month ASC, f.typical_date ASC NULLS LAST
            """, (year,))
            rows = [dict(r) for r in cur.fetchall()]
            logger.info(f"Cache HIT for year={year}: returning {len(rows)} festivals")
            return rows

        # Fallback: rows with NULL cached_year (pre-migration data)
        cur.execute("""
            SELECT COUNT(*) AS cnt
            FROM public.festivals
            WHERE source = 'ai_cache'
              AND cached_year IS NULL
        """)
        null_count = int(cur.fetchone()["cnt"] or 0)

        if null_count >= MIN_CACHE_COUNT:
            logger.warning(
                f"No year={year} rows, but {null_count} rows have cached_year=NULL. "
                f"Backfilling and returning them."
            )
            # Stamp them with the current year so future requests hit the fast path
            cur.execute("""
                UPDATE public.festivals
                SET cached_year  = %s,
                    cached_month = month
                WHERE source      = 'ai_cache'
                  AND cached_year IS NULL
            """, (year,))
            cur.execute("""
                SELECT
                    f.id, f.name, f.description, f.significance,
                    f.month, f.hindu_month, f.hindu_tithi,
                    f.typical_date AS exact_date, f.display_date,
                    f.duration_days, f.is_major, f.deity,
                    f.festival_type, f.emoji, f.color,
                    f.cached_year, f.cached_month,
                    f.source, f.ai_generated,
                    NULL::int  AS temple_id, NULL::text AS temple_name,
                    NULL::text AS temple_city, NULL::text AS temple_slug
                FROM public.festivals f
                WHERE f.source = 'ai_cache'
                ORDER BY f.month ASC, f.typical_date ASC NULLS LAST
            """)
            rows = [dict(r) for r in cur.fetchall()]
            return rows

        logger.info(
            f"Cache MISS for year={year}: "
            f"{year_count} year-matched rows, {null_count} NULL-year rows "
            f"(need >= {MIN_CACHE_COUNT}) — will call OpenAI"
        )
        return []


def _delete_year_cache(year: int):
    """
    Wipe ai_cache rows for the given year only.
    Called only on force refresh — preserves cached data for other years.
    """
    with get_db_cursor() as cur:
        cur.execute("""
            DELETE FROM public.festivals
            WHERE source = 'ai_cache'
              AND (cached_year = %s OR cached_year IS NULL)
        """, (year,))
        logger.info(f"Force-refresh: deleted {cur.rowcount} ai_cache rows for year={year}")


def _delete_stale_cache(year: int, before_month: int):
    """Delete ai_cache rows for months that have already passed this year."""
    with get_db_cursor() as cur:
        cur.execute("""
            DELETE FROM public.festivals
            WHERE source       = 'ai_cache'
              AND cached_year  = %s
              AND cached_month IS NOT NULL
              AND cached_month < %s
        """, (year, before_month))
        deleted = cur.rowcount
        if deleted:
            logger.info(f"Pruned {deleted} stale ai_cache rows (year={year}, before_month={before_month})")


def _insert_ai_festivals(festivals: list[dict], year: int):
    """
    Bulk-insert OpenAI-fetched festivals into the festivals table.
    - temple_id = NULL (AI festivals have no linked temple)
    - ON CONFLICT DO NOTHING — safe to re-run without duplicates
    """
    with get_db_cursor() as cur:
        inserted = 0
        skipped  = 0

        for f in festivals:
            try:
                month = f.get("month")
                if not month or not (1 <= int(month) <= 12):
                    skipped += 1
                    continue
                month = int(month)

                cur.execute("""
                    INSERT INTO public.festivals (
                        temple_id,
                        name,
                        description,
                        significance,
                        month,
                        hindu_month,
                        hindu_tithi,
                        typical_date,
                        display_date,
                        duration_days,
                        is_major,
                        source,
                        ai_generated,
                        deity,
                        festival_type,
                        emoji,
                        color,
                        cached_year,
                        cached_month
                    ) VALUES (
                        NULL,
                        %s, %s, %s,
                        %s, %s, %s,
                        %s, %s,
                        %s, %s,
                        'ai_cache', TRUE,
                        %s, %s, %s, %s,
                        %s, %s
                    )
                    ON CONFLICT DO NOTHING
                """, (
                    (f.get("name") or "")[:200],
                    f.get("description"),
                    f.get("significance"),
                    month,
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
                    month,
                ))
                inserted += 1

            except Exception as e:
                logger.error(f"Failed to insert festival '{f.get('name')}': {e}")
                raise

        logger.info(f"AI festivals stored: {inserted} inserted, {skipped} skipped (year={year})")


# ── OpenAI API call ───────────────────────────────────────────────────────────

async def _call_openai(prompt: str) -> list[dict]:
    """Call OpenAI chat completions and return parsed festival list."""
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY not set in environment")

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            OPENAI_URL,
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type":  "application/json",
            },
            json={
                "model":       OPENAI_MODEL,
                "temperature": 0,       # deterministic output — no hallucinated dates
                "messages": [
                    {
                        "role":    "system",
                        "content": (
                            "You are an expert in the Hindu lunisolar calendar. "
                            "You always return accurate Gregorian dates for Hindu festivals "
                            "for the exact year requested. You never guess or reuse dates from other years. "
                            "You output only valid JSON arrays with no extra text."
                        ),
                    },
                    {
                        "role":    "user",
                        "content": prompt,
                    },
                ],
            },
        )

    if response.status_code != 200:
        raise RuntimeError(
            f"OpenAI API error {response.status_code}: {response.text[:400]}"
        )

    data    = response.json()
    raw     = data.get("choices", [{}])[0].get("message", {}).get("content", "[]")
    cleaned = raw.strip()

    # Strip markdown fences if model wraps response in ```json ... ```
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        # Partial recovery for truncated responses
        try:
            idx = cleaned.rfind("},")
            if idx != -1:
                partial = cleaned[: idx + 1] + "]"
                parsed  = json.loads("[" + partial.lstrip("["))
                return parsed if isinstance(parsed, list) else []
        except Exception:
            pass
        logger.error(f"Failed to parse OpenAI JSON. Raw snippet: {cleaned[:300]}")
        return []


async def _fetch_and_store(year: int, force: bool = False) -> list[dict]:
    """
    Main orchestrator.
      force=False → DB-first; OpenAI called ONLY on genuine cache miss for this year.
      force=True  → wipe year cache, always call OpenAI.

    Two API calls (Jan–Jun + Jul–Dec) for complete yearly coverage within token limits.
    """
    _ensure_cached_year_columns()

    if not force:
        existing = _get_cached_year(year)
        if existing:
            logger.info(f"_fetch_and_store: cache hit ({len(existing)} rows) for year={year} — skipping OpenAI")
            return existing

    if force:
        _delete_year_cache(year)

    logger.info(
        f"Calling OpenAI ({OPENAI_MODEL}) for year={year} "
        f"({'force refresh' if force else 'cache miss'}) — 2 prompts..."
    )

    h1 = await _call_openai(_make_prompt(year, "January, February, March, April, May, June"))
    h2 = await _call_openai(_make_prompt(year, "July, August, September, October, November, December"))

    combined = h1 + h2
    logger.info(f"OpenAI returned {len(combined)} festivals for year={year}")

    if combined:
        _insert_ai_festivals(combined, year)

    return combined


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/api/festivals/ai-cache/debug")
async def debug_ai_cache():
    """
    Diagnostic endpoint — shows exactly what is stored in DB per year.
    Check this first when troubleshooting repeated OpenAI calls.
    """
    today        = date.today()
    current_year = today.year

    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                source,
                cached_year,
                COUNT(*)   AS total,
                MIN(month) AS min_month,
                MAX(month) AS max_month
            FROM public.festivals
            WHERE source = 'ai_cache'
            GROUP BY source, cached_year
            ORDER BY cached_year NULLS LAST
        """)
        breakdown = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT COUNT(*) AS total_ai_cache
            FROM public.festivals
            WHERE source = 'ai_cache'
        """)
        total = cur.fetchone()["total_ai_cache"]

        cur.execute("""
            SELECT COUNT(*) AS this_year_count
            FROM public.festivals
            WHERE source      = 'ai_cache'
              AND cached_year = %s
        """, (current_year,))
        this_year = cur.fetchone()["this_year_count"]

    return {
        "current_year":             current_year,
        "total_ai_cache_rows":      total,
        "this_year_rows":           this_year,
        "min_needed_for_cache_hit": MIN_CACHE_COUNT,
        "will_hit_cache":           this_year >= MIN_CACHE_COUNT,
        "model_used":               OPENAI_MODEL,
        "breakdown_by_year":        breakdown,
    }


@router.get("/api/festivals/ai-cache")
async def get_ai_festival_cache(
    background_tasks: BackgroundTasks,
    refresh: bool = Query(False, description="Set true to wipe DB cache and re-fetch from OpenAI"),
):
    """
    Return AI-generated festivals for the CURRENT calendar year.

    Year-aware behaviour:
    - current_year is computed fresh on every request from date.today().year
    - Cache is keyed by cached_year in the DB
    - When the year rolls over (Jan 1), cached_year won't match → automatic cache miss
      → OpenAI fetches the new year's accurate dates → stored for the whole new year

    Flow:
    1. _ensure_cached_year_columns() — schema migration, idempotent
    2. refresh=true → delete this year's rows → OpenAI → store → return
    3. DB has >= MIN_CACHE_COUNT rows for current_year → return from DB (no AI call)
    4. DB miss → OpenAI → store → return
    """
    today         = date.today()
    current_year  = today.year
    current_month = today.month

    _ensure_cached_year_columns()

    # Prune past months in background on 1st of each month
    if today.day == 1 and current_month > 1:
        background_tasks.add_task(_delete_stale_cache, current_year, current_month)

    # ── Force refresh ──────────────────────────────────────────────────────
    if refresh:
        logger.info(f"Force refresh requested for year={current_year}")
        try:
            await _fetch_and_store(current_year, force=True)
        except Exception as e:
            logger.error(f"Force refresh failed: {e}")
            raise HTTPException(status_code=503, detail=f"Refresh failed: {str(e)}")

        stored = _get_cached_year(current_year)
        return {
            "source":    "fresh",
            "year":      current_year,
            "count":     len(stored),
            "festivals": stored,
        }

    # ── Normal: DB-first ──────────────────────────────────────────────────
    cached = _get_cached_year(current_year)
    if cached:
        return {
            "source":    "db_cache",
            "year":      current_year,
            "count":     len(cached),
            "festivals": cached,
        }

    # Cache miss → call OpenAI
    logger.info(f"DB cache miss for year={current_year}, fetching from OpenAI...")
    try:
        await _fetch_and_store(current_year, force=False)
    except Exception as e:
        logger.error(f"OpenAI fetch failed: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Could not fetch festivals from AI: {str(e)}"
        )

    stored = _get_cached_year(current_year)
    if not stored:
        raise HTTPException(
            status_code=502,
            detail="AI returned empty festival list — check OPENAI_API_KEY and DB commit"
        )

    return {
        "source":    "fresh",
        "year":      current_year,
        "count":     len(stored),
        "festivals": stored,
    }


@router.post(
    "/api/admin/festivals/ai-refresh",
    dependencies=[Depends(require_admin)],
)
async def admin_force_refresh():
    """
    Admin endpoint: wipe this year's ai_cache rows and re-fetch from OpenAI.
    Requires X-Admin-Key header matching ADMIN_SECRET_KEY env var.
    """
    today        = date.today()
    current_year = today.year

    logger.info(f"Admin triggered AI festival cache refresh for year={current_year}")

    try:
        festivals = await _fetch_and_store(current_year, force=True)
    except Exception as e:
        logger.error(f"Admin refresh failed: {e}")
        raise HTTPException(status_code=503, detail=str(e))

    return {
        "success":      True,
        "year":         current_year,
        "fetched":      len(festivals),
        "model":        OPENAI_MODEL,
        "message":      f"Cache refreshed: {len(festivals)} festivals stored for {current_year}",
        "refreshed_at": datetime.utcnow().isoformat(),
    }