"""
AI Festival Cache Router — BharatMandir
======================================================
Ek baar Claude se data fetch karo → festivals table mein daalo (source='ai_cache')
Agle baar seedha festivals table se lo — koi AI call nahi

Routes:
  GET  /api/festivals/ai-cache          → DB se lo (cache miss pe Claude call)
  GET  /api/festivals/ai-cache?refresh=true  → force wipe + re-fetch
  GET  /api/festivals/ai-cache/debug    → diagnostics
  POST /api/admin/festivals/ai-refresh  → admin force refresh (X-Admin-Key required)

Storage:
  Table: public.festivals
  source = 'ai_cache'
  temple_id = NULL (AI festivals ka koi temple nahi hota)

Cache Logic:
  - >= MIN_CACHE_COUNT rows with source='ai_cache' → CACHE HIT → sirf DB se return
  - < MIN_CACHE_COUNT → CACHE MISS → Claude call → insert → return
  - ON CONFLICT DO NOTHING → duplicate-safe
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
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_URL     = "https://api.anthropic.com/v1/messages"
CLAUDE_MODEL      = "claude-sonnet-4-20250514"
MIN_CACHE_COUNT   = 50   # itne se kam rows = cache miss → Claude call

_ADMIN_SECRET = os.getenv("ADMIN_SECRET_KEY", "change-me-now")


def require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != _ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden: invalid admin key")


# ── Schema ensure ─────────────────────────────────────────────────────────────

def _ensure_schema():
    """
    festivals table mein required columns add karo agar missing hain.
    Safe to call on every request — ALTER TABLE IF NOT EXISTS is idempotent.
    """
    with get_db_cursor() as cur:
        cur.execute("""
            ALTER TABLE public.festivals
                ADD COLUMN IF NOT EXISTS cached_year  INT,
                ADD COLUMN IF NOT EXISTS cached_month INT,
                ADD COLUMN IF NOT EXISTS display_date TEXT,
                ADD COLUMN IF NOT EXISTS hindu_tithi  TEXT,
                ADD COLUMN IF NOT EXISTS color        TEXT
        """)
        # Backfill cached_year/cached_month from typical_date for existing ai_cache rows
        cur.execute("""
            UPDATE public.festivals
            SET
                cached_year  = EXTRACT(YEAR  FROM typical_date::date)::INT,
                cached_month = EXTRACT(MONTH FROM typical_date::date)::INT
            WHERE source     = 'ai_cache'
              AND cached_year IS NULL
              AND typical_date IS NOT NULL
              AND typical_date ~ '^\d{4}-\d{2}-\d{2}$'
        """)
        cur.execute("""
            UPDATE public.festivals
            SET
                cached_year  = EXTRACT(YEAR FROM NOW())::INT,
                cached_month = month
            WHERE source     = 'ai_cache'
              AND cached_year IS NULL
        """)


# ── DB read ───────────────────────────────────────────────────────────────────

def _get_cached_festivals(year: int) -> list[dict]:
    """
    festivals table se source='ai_cache' rows lo.
    Return [] agar < MIN_CACHE_COUNT rows hain (cache miss signal).
    Year filter: cached_year = year, ya fallback to typical_date year.
    """
    with get_db_cursor() as cur:
        # Total count check (year-specific)
        cur.execute("""
            SELECT COUNT(*) AS cnt
            FROM public.festivals
            WHERE source = 'ai_cache'
              AND (
                cached_year = %s
                OR (cached_year IS NULL AND EXTRACT(YEAR FROM typical_date::date)::INT = %s)
              )
        """, (year, year))
        row   = cur.fetchone()
        total = int(row["cnt"]) if row else 0

        if total < MIN_CACHE_COUNT:
            logger.info(
                f"Cache MISS: {total} ai_cache rows for year={year} "
                f"(need >= {MIN_CACHE_COUNT}) — will call Claude"
            )
            return []

        # Cache hit — return all rows for this year
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
            WHERE f.source = 'ai_cache'
              AND (
                f.cached_year = %s
                OR (f.cached_year IS NULL AND EXTRACT(YEAR FROM f.typical_date::date)::INT = %s)
              )
            ORDER BY f.month ASC, f.typical_date ASC NULLS LAST, f.name ASC
        """, (year, year))

        rows = [dict(r) for r in cur.fetchall()]
        logger.info(f"Cache HIT: {len(rows)} festivals for year={year}")
        return rows


# ── DB write ──────────────────────────────────────────────────────────────────

def _clear_ai_cache(year: int):
    """Force refresh ke liye — sirf is saal ke ai_cache rows delete karo."""
    with get_db_cursor() as cur:
        cur.execute("""
            DELETE FROM public.festivals
            WHERE source      = 'ai_cache'
              AND cached_year = %s
        """, (year,))
        logger.info(f"Cleared {cur.rowcount} ai_cache rows for year={year}")


def _insert_festivals(festivals: list[dict], year: int) -> int:
    """
    Claude se aaye festivals ko festivals table mein insert karo.
    ON CONFLICT DO NOTHING — duplicate-safe (name + month + cached_year unique hona chahiye).
    Returns count of inserted rows.
    """
    inserted = 0
    skipped  = 0

    with get_db_cursor() as cur:
        for f in festivals:
            try:
                month = f.get("month")
                if not month or not (1 <= int(month) <= 12):
                    skipped += 1
                    continue
                month = int(month)

                name = (f.get("name") or "").strip()[:200]
                if not name:
                    skipped += 1
                    continue

                # exact_date validation
                exact_date = None
                raw_date   = f.get("exact_date") or ""
                if raw_date and len(raw_date) == 10:
                    try:
                        date.fromisoformat(raw_date)
                        exact_date = raw_date
                    except ValueError:
                        pass

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
                    name,
                    (f.get("description") or "")[:1000] or None,
                    (f.get("significance") or "")[:500] or None,
                    month,
                    (f.get("hindu_month") or "")[:100] or None,
                    (f.get("hindu_tithi") or "")[:200] or None,
                    exact_date,
                    (f.get("display_date") or "")[:100] or None,
                    max(1, int(f.get("duration_days") or 1)),
                    bool(f.get("is_major")),
                    (f.get("deity") or "Other")[:50],
                    None,  # festival_type
                    (f.get("emoji") or "🛕")[:10],
                    (f.get("color") or "#E8650A")[:20],
                    year,
                    month,
                ))
                inserted += 1

            except Exception as e:
                logger.error(f"Insert failed for '{f.get('name')}': {e}")
                # Ek festival fail ho to baki continue karo
                continue

    logger.info(f"Inserted {inserted}, skipped {skipped} for year={year}")
    return inserted


# ── Claude API ────────────────────────────────────────────────────────────────

def _make_prompt(year: int, months: str) -> str:
    return f"""List ALL major and minor Hindu festivals, vrats, Ekadashi, Purnima, Amavasya, and Chaturthi for {year} in months: {months}.
Return ONLY a valid JSON array. No explanation, no markdown, no backticks.
Each object must have EXACTLY these fields:
{{"name":"string","month":1,"exact_date":"{year}-01-14","display_date":"14 January {year}","hindu_tithi":"Makar Sankranti","hindu_month":"Pausha","significance":"one clear sentence about why this festival is celebrated","description":"2-3 sentences about rituals and traditions","is_major":true,"duration_days":1,"deity":"Surya","emoji":"🪁","color":"#E8650A"}}
Rules:
- Include ALL festivals including regional ones: Pongal, Onam, Bihu, Ugadi, Baisakhi, Lohri, Gudi Padwa, Vishu etc.
- Include all Ekadashi, Purnima, Amavasya of each month
- is_major=true for nationally celebrated festivals only
- deity must be one of: Shiva/Vishnu/Krishna/Rama/Ganesha/Durga/Lakshmi/Saraswati/Surya/Hanuman/Other
- exact_date must be accurate for year {year} in YYYY-MM-DD format
- description: max 2-3 sentences, keep concise
- Sort by exact_date ascending within the months
- Output ONLY the JSON array, nothing else, no trailing text"""


async def _call_claude(prompt: str) -> list[dict]:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY environment variable not set")

    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(
            ANTHROPIC_URL,
            headers={
                "x-api-key":         ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type":      "application/json",
            },
            json={
                "model":      CLAUDE_MODEL,
                "max_tokens": 8000,
                "messages":   [{"role": "user", "content": prompt}],
            },
        )

    if resp.status_code != 200:
        raise RuntimeError(f"Claude API {resp.status_code}: {resp.text[:400]}")

    data    = resp.json()
    raw     = data.get("content", [{}])[0].get("text", "[]")
    cleaned = raw.strip()

    # Strip markdown fences
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        pass

    # Partial recovery — truncated response
    try:
        idx = cleaned.rfind("},")
        if idx != -1:
            partial = cleaned[:idx + 1] + "]"
            parsed  = json.loads("[" + partial.lstrip("["))
            if isinstance(parsed, list):
                logger.warning(f"Partial recovery: got {len(parsed)} items")
                return parsed
    except Exception:
        pass

    logger.error("Could not parse Claude response as JSON")
    return []


# ── Main orchestrator ─────────────────────────────────────────────────────────

async def _fetch_and_store(year: int, force: bool = False) -> list[dict]:
    """
    force=False: DB check → cache hit return, miss pe Claude call
    force=True : clear cache → Claude call → store → return
    """
    _ensure_schema()

    if not force:
        existing = _get_cached_festivals(year)
        if existing:
            logger.info(f"Returning {len(existing)} cached festivals for year={year}")
            return existing

    if force:
        _clear_ai_cache(year)

    # Claude se 2 prompts — H1 aur H2
    logger.info(f"Calling Claude for year={year} ({'force' if force else 'miss'})...")

    try:
        h1 = await _call_claude(_make_prompt(year, "January, February, March, April, May, June"))
        h2 = await _call_claude(_make_prompt(year, "July, August, September, October, November, December"))
    except Exception as e:
        logger.error(f"Claude API call failed: {e}")
        raise

    combined = h1 + h2
    logger.info(f"Claude returned {len(combined)} festivals total")

    if combined:
        count = _insert_festivals(combined, year)
        logger.info(f"Stored {count} new festivals in DB for year={year}")

    # DB se fresh read karke return karo
    return _get_cached_festivals(year)


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/api/festivals/ai-cache/debug")
async def debug_ai_cache():
    """
    Diagnostic — DB mein kya stored hai instantly dekho.
    Troubleshoot karne ke liye pehle yahi call karo.
    """
    _ensure_schema()
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                cached_year,
                COUNT(*)     AS total,
                MIN(month)   AS min_month,
                MAX(month)   AS max_month,
                SUM(CASE WHEN is_major THEN 1 ELSE 0 END) AS major_count
            FROM public.festivals
            WHERE source = 'ai_cache'
            GROUP BY cached_year
            ORDER BY cached_year NULLS LAST
        """)
        breakdown = [dict(r) for r in cur.fetchall()]

        cur.execute("SELECT COUNT(*) AS total FROM public.festivals WHERE source = 'ai_cache'")
        total = cur.fetchone()["total"]

    current_year = date.today().year
    return {
        "total_ai_cache_rows":      total,
        "min_needed_for_cache_hit": MIN_CACHE_COUNT,
        "will_hit_cache":           total >= MIN_CACHE_COUNT,
        "current_year":             current_year,
        "breakdown_by_year":        breakdown,
        "anthropic_key_set":        bool(ANTHROPIC_API_KEY),
    }


@router.get("/api/festivals/ai-cache")
async def get_ai_festival_cache(
    background_tasks: BackgroundTasks,
    refresh: bool = Query(False, description="true = wipe cache and re-fetch from Claude"),
):
    """
    Main endpoint — festivals return karo.

    Flow:
    1. Schema ensure (fast, idempotent)
    2. refresh=true → wipe → Claude → store → return
    3. DB >= MIN_CACHE_COUNT rows → seedha return (NO Claude call)
    4. DB empty/kam → Claude → store → return
    """
    today         = date.today()
    current_year  = today.year
    current_month = today.month

    _ensure_schema()

    # 1st of month pe purane months ki rows background mein clean karo
    if today.day == 1 and current_month > 1:
        def _prune():
            with get_db_cursor() as cur:
                cur.execute("""
                    DELETE FROM public.festivals
                    WHERE source      = 'ai_cache'
                      AND cached_year = %s
                      AND cached_month IS NOT NULL
                      AND cached_month < %s
                """, (current_year, current_month))
                logger.info(f"Pruned {cur.rowcount} past-month ai_cache rows")
        background_tasks.add_task(_prune)

    # Force refresh
    if refresh:
        logger.info(f"Force refresh: year={current_year}")
        try:
            festivals = await _fetch_and_store(current_year, force=True)
        except Exception as e:
            raise HTTPException(503, f"Refresh failed: {e}")
        return {
            "source":    "fresh",
            "year":      current_year,
            "count":     len(festivals),
            "festivals": festivals,
        }

    # Normal DB-first flow
    cached = _get_cached_festivals(current_year)
    if cached:
        return {
            "source":    "db_cache",
            "year":      current_year,
            "count":     len(cached),
            "festivals": cached,
        }

    # Cache miss — Claude call karo
    logger.info(f"Cache miss for year={current_year}, calling Claude...")
    try:
        festivals = await _fetch_and_store(current_year, force=False)
    except Exception as e:
        logger.error(f"Claude fetch failed: {e}")
        raise HTTPException(503, f"AI fetch failed: {e}")

    if not festivals:
        raise HTTPException(502, "Claude returned empty list — check ANTHROPIC_API_KEY")

    return {
        "source":    "fresh",
        "year":      current_year,
        "count":     len(festivals),
        "festivals": festivals,
    }


@router.post("/api/admin/festivals/ai-refresh", dependencies=[Depends(require_admin)])
async def admin_force_refresh():
    """
    Admin: Force wipe + re-fetch from Claude.
    Header required: X-Admin-Key: <ADMIN_SECRET_KEY>
    """
    today        = date.today()
    current_year = today.year

    logger.info(f"Admin force refresh triggered for year={current_year}")
    try:
        festivals = await _fetch_and_store(current_year, force=True)
    except Exception as e:
        raise HTTPException(503, str(e))

    return {
        "success":      True,
        "year":         current_year,
        "count":        len(festivals),
        "message":      f"{len(festivals)} festivals stored for {current_year}",
        "refreshed_at": datetime.utcnow().isoformat(),
    }