"""
AI Festival Cache Router — BharatMandir
======================================================
GET  /api/festivals/ai-cache               → return cached or freshly fetched AI festivals
GET  /api/festivals/ai-cache?refresh=true  → force-refresh (wipe DB cache, re-fetch)
POST /api/admin/festivals/ai-refresh       → force-refresh AI festival cache (admin only)

Fix log:
- _get_cached_year has ZERO dependency on cached_year column being populated.
  Returns ALL rows where source='ai_cache', ordered by month.
  Claude is NEVER called if >= MIN_CACHE_COUNT rows exist.
- INSERT uses ON CONFLICT DO NOTHING and wraps errors per-row
- _fetch_and_store is strictly DB-first: Claude is NEVER called if >= MIN_CACHE_COUNT rows exist
- Force-refresh wipes only ai_cache rows, then re-fetches
- Added /api/festivals/ai-cache/debug endpoint for quick diagnostics
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
MIN_CACHE_COUNT   = 10   # fewer rows than this = treat as cache miss

_ADMIN_SECRET = os.getenv("ADMIN_SECRET_KEY", "change-me-now")


def require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != _ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden: invalid admin key")


# ── Prompts ───────────────────────────────────────────────────────────────────
def _make_prompt(year: int, months: str) -> str:
    return f"""List ALL Hindu festivals for {year} in months: {months}.
Return ONLY a valid JSON array. No explanation, no markdown, no backticks, no extra text.
Each object must have EXACTLY these fields:
{{"name":"string","month":1,"exact_date":"{year}-01-14","display_date":"14 January {year}","hindu_tithi":"string","hindu_month":"string","significance":"one sentence","description":"2-3 sentences max","is_major":true,"duration_days":1,"deity":"Surya","emoji":"🪁","color":"#E8650A"}}
Rules:
- Cover every festival, vrat, Ekadashi, Purnima, Amavasya, Chaturthi in those months
- Include regional festivals (Pongal, Onam, Bihu, Ugadi, Baisakhi, Lohri etc.)
- is_major=true only for nationally celebrated festivals
- deity: Shiva/Vishnu/Krishna/Rama/Ganesha/Durga/Lakshmi/Saraswati/Surya/Hanuman/Other
- description max 2-3 sentences
- Sort by exact_date ascending
- Output ONLY the JSON array, nothing else"""


# ── DB helpers ────────────────────────────────────────────────────────────────

def _get_cached_year(year: int) -> list[dict]:
    """
    Return all ai_cache festivals from DB.

    Deliberately does NOT filter by cached_year — the column may be NULL
    on existing rows, and filtering by it causes a false cache miss which
    triggers an unnecessary Claude API call.

    Only returns [] (cache miss) if the total count of ai_cache rows is
    below MIN_CACHE_COUNT — that is the only signal we need.
    """
    with get_db_cursor() as cur:

        # ── Count all ai_cache rows (no year filter) ──────────────────────
        cur.execute("""
            SELECT COUNT(*) AS cnt
            FROM public.festivals
            WHERE source = 'ai_cache'
        """)
        row   = cur.fetchone()
        total = int(row["cnt"]) if row else 0

        if total < MIN_CACHE_COUNT:
            logger.info(
                f"Cache MISS: {total} ai_cache rows in DB "
                f"(need >= {MIN_CACHE_COUNT}) — will call Claude"
            )
            return []

        # ── Cache hit: return all ai_cache rows ───────────────────────────
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
            ORDER BY f.month ASC, f.typical_date ASC NULLS LAST
        """)
        rows = [dict(r) for r in cur.fetchall()]
        logger.info(
            f"Cache HIT: returning {len(rows)} ai_cache festivals from DB "
            f"(total in DB: {total})"
        )
        return rows


def _delete_stale_cache(year: int, before_month: int):
    """Delete ai_cache rows for months that have already passed this year."""
    with get_db_cursor() as cur:
        cur.execute("""
            DELETE FROM public.festivals
            WHERE source = 'ai_cache'
              AND cached_year = %s
              AND cached_month IS NOT NULL
              AND cached_month < %s
        """, (year, before_month))
        deleted = cur.rowcount
        if deleted:
            logger.info(
                f"Pruned {deleted} stale ai_cache rows "
                f"(year={year}, before_month={before_month})"
            )


def _delete_year_cache(year: int):
    """Wipe ALL ai_cache rows (called only on force refresh)."""
    with get_db_cursor() as cur:
        cur.execute("""
            DELETE FROM public.festivals
            WHERE source = 'ai_cache'
        """)
        logger.info(f"Force-refresh: deleted {cur.rowcount} ai_cache rows")


def _ensure_cached_year_columns():
    """
    Add cached_year/cached_month columns if missing and backfill from typical_date.
    No-op if columns already exist and are populated.
    Safe to call on every request.
    """
    with get_db_cursor() as cur:
        cur.execute("""
            ALTER TABLE public.festivals
                ADD COLUMN IF NOT EXISTS cached_year  INT,
                ADD COLUMN IF NOT EXISTS cached_month INT
        """)
        # Backfill from typical_date
        cur.execute("""
            UPDATE public.festivals
            SET
                cached_year  = EXTRACT(YEAR  FROM typical_date::date)::INT,
                cached_month = EXTRACT(MONTH FROM typical_date::date)::INT
            WHERE source    = 'ai_cache'
              AND cached_year IS NULL
              AND typical_date IS NOT NULL
        """)
        # Rows without typical_date: use current year + the month column
        cur.execute("""
            UPDATE public.festivals
            SET
                cached_year  = EXTRACT(YEAR FROM NOW())::INT,
                cached_month = month
            WHERE source    = 'ai_cache'
              AND cached_year IS NULL
        """)
        if cur.rowcount:
            logger.info(f"Backfilled cached_year for {cur.rowcount} ai_cache rows")


def _insert_ai_festivals(festivals: list[dict], year: int):
    """
    Bulk-insert AI-fetched festivals into the festivals table.

    - temple_id = NULL  (AI festivals have no linked temple)
    - ON CONFLICT DO NOTHING — safe to call even if some rows already exist
    - Raises on unexpected DB errors
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

        logger.info(
            f"AI festivals stored: {inserted} inserted, "
            f"{skipped} skipped (year={year})"
        )


# ── Claude API call ───────────────────────────────────────────────────────────

async def _call_claude(prompt: str) -> list[dict]:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set in environment")

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
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

    if response.status_code != 200:
        raise RuntimeError(
            f"Claude API error {response.status_code}: {response.text[:300]}"
        )

    data = response.json()
    raw  = data.get("content", [{}])[0].get("text", "[]")

    # Strip markdown fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        cleaned = cleaned.rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(cleaned)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        # Attempt partial recovery (truncated response)
        try:
            idx = cleaned.rfind("},")
            if idx != -1:
                partial = cleaned[: idx + 1] + "]"
                parsed  = json.loads("[" + partial.lstrip("["))
                return parsed if isinstance(parsed, list) else []
        except Exception:
            pass
        logger.error("Failed to parse Claude JSON response")
        return []


async def _fetch_and_store(year: int, force: bool = False) -> list[dict]:
    """
    Main orchestrator:
      force=False (default) → DB-first; Claude called ONLY on genuine cache miss.
      force=True            → wipe all ai_cache rows, always call Claude.

    Returns list of festivals (from DB on hit, from Claude on miss/force).
    """
    # Ensure schema is ready before every fetch
    _ensure_cached_year_columns()

    if not force:
        existing = _get_cached_year(year)
        if existing:
            logger.info(
                f"_fetch_and_store: cache hit ({len(existing)} rows) "
                f"for year={year} — skipping Claude API call"
            )
            return existing

    if force:
        _delete_year_cache(year)

    logger.info(
        f"Calling Claude API for year={year} "
        f"({'force refresh' if force else 'cache miss'}) — 2 prompts..."
    )
    h1 = await _call_claude(
        _make_prompt(year, "January, February, March, April, May, June")
    )
    h2 = await _call_claude(
        _make_prompt(year, "July, August, September, October, November, December")
    )
    combined = h1 + h2
    logger.info(f"Claude returned {len(combined)} festivals for year={year}")

    if combined:
        _insert_ai_festivals(combined, year)

    return combined


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/api/festivals/ai-cache/debug")
async def debug_ai_cache():
    """
    Diagnostic endpoint — shows exactly what is stored in the DB.
    Call this first when troubleshooting repeated Claude calls.
    """
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                source,
                cached_year,
                COUNT(*)        AS total,
                MIN(month)      AS min_month,
                MAX(month)      AS max_month
            FROM public.festivals
            WHERE source = 'ai_cache'
            GROUP BY source, cached_year
            ORDER BY cached_year NULLS LAST
        """)
        rows = [dict(r) for r in cur.fetchall()]

        cur.execute("""
            SELECT COUNT(*) AS total_ai_cache
            FROM public.festivals
            WHERE source = 'ai_cache'
        """)
        total = cur.fetchone()["total_ai_cache"]

    return {
        "total_ai_cache_rows": total,
        "min_needed_for_cache_hit": MIN_CACHE_COUNT,
        "will_hit_cache": total >= MIN_CACHE_COUNT,
        "breakdown_by_year": rows,
    }


@router.get("/api/festivals/ai-cache")
async def get_ai_festival_cache(
    background_tasks: BackgroundTasks,
    refresh: bool = Query(
        False,
        description="Set true to wipe DB cache and re-fetch from Claude"
    ),
):
    """
    Return AI-generated festivals for the current year.

    Flow:
    1. Ensure cached_year/cached_month columns exist (idempotent, fast).
    2. ?refresh=true  → wipe DB cache → call Claude → store → return fresh data.
    3. DB has >= MIN_CACHE_COUNT rows → return immediately (zero Claude calls).
    4. DB empty / < MIN_CACHE_COUNT  → call Claude → store → return.
    """
    today         = date.today()
    current_year  = today.year
    current_month = today.month

    # Ensure columns exist on every request (no-op after first run)
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

    # Cache miss → call Claude
    logger.info(f"DB cache miss for year={current_year}, fetching from Claude...")
    try:
        await _fetch_and_store(current_year, force=False)
    except Exception as e:
        logger.error(f"Claude fetch failed: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Could not fetch festivals from AI: {str(e)}"
        )

    stored = _get_cached_year(current_year)
    if not stored:
        raise HTTPException(
            status_code=502,
            detail="AI returned empty festival list — check ANTHROPIC_API_KEY and DB commit"
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
    Admin endpoint: wipe ALL ai_cache rows and re-fetch from Claude.
    Requires X-Admin-Key header.
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
        "message":      f"Cache refreshed: {len(festivals)} festivals stored for {current_year}",
        "refreshed_at": datetime.utcnow().isoformat(),
    }