"""
AI Festival Cache Router — BharatMandir
======================================================
GET  /api/festivals/ai-cache          → return cached or freshly fetched AI festivals
POST /api/admin/festivals/ai-refresh  → force-refresh AI festival cache (admin only)

Logic:
- Festivals are fetched from Claude API once and stored in the `festivals` table
  with source='ai_cache' and ai_generated=True.
- Cache is keyed by (year, month=NULL means "full year data").
- On the 1st of every month, stale months are pruned automatically.
- If no data exists for current year → fetch from Claude → store → return.
- temple_id=0 is used as a sentinel for AI-generated festivals with no real temple.
  (Make sure your DB has a row: INSERT INTO temples (id, name, city, state, status)
   VALUES (0, 'AI Generated', 'India', 'India', 'published') ON CONFLICT DO NOTHING;)
"""

from fastapi import APIRouter, HTTPException, Header, Depends, BackgroundTasks
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
AI_SENTINEL_TEMPLE_ID = 0   # sentinel temple_id for AI festivals (no real temple)

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
    """Return all ai_cache festivals for a given year from DB."""
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                f.id, f.name, f.description, f.significance,
                f.month, f.hindu_month, f.typical_date AS exact_date,
                f.duration_days, f.is_major,
                f.source, f.ai_generated,
                f.deity, f.festival_type, f.emoji,
                f.display_date, f.color,
                f.cached_year, f.cached_month,
                NULL::int  AS temple_id,
                NULL::text AS temple_name,
                NULL::text AS temple_city,
                NULL::text AS temple_slug
            FROM festivals f
            WHERE f.source = 'ai_cache'
              AND f.cached_year = %s
            ORDER BY f.month ASC, f.typical_date ASC
        """, (year,))
        return [dict(r) for r in cur.fetchall()]


def _delete_stale_cache(year: int, before_month: int):
    """Delete ai_cache rows for months that have already passed this year."""
    with get_db_cursor() as cur:
        cur.execute("""
            DELETE FROM festivals
            WHERE source = 'ai_cache'
              AND cached_year = %s
              AND cached_month < %s
        """, (year, before_month))
        deleted = cur.rowcount
        if deleted:
            logger.info(f"Pruned {deleted} stale ai_cache festival rows (year={year}, before_month={before_month})")


def _cache_exists_for_year(year: int) -> bool:
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT 1 FROM festivals
            WHERE source = 'ai_cache' AND cached_year = %s
            LIMIT 1
        """, (year,))
        return cur.fetchone() is not None


def _insert_ai_festivals(festivals: list[dict], year: int):
    """Bulk-insert AI-fetched festivals into the festivals table."""
    with get_db_cursor() as cur:
        # Ensure sentinel temple exists
        cur.execute("""
            INSERT INTO temples (id, name, city, state, slug, status)
            VALUES (0, 'AI Generated', 'India', 'India', 'ai-generated', 'published')
            ON CONFLICT (id) DO NOTHING
        """)

        # Clear existing ai_cache for this year before inserting fresh data
        cur.execute("""
            DELETE FROM festivals
            WHERE source = 'ai_cache' AND cached_year = %s
        """, (year,))

        for f in festivals:
            month = f.get("month")
            if not month or not (1 <= int(month) <= 12):
                continue
            month = int(month)

            cur.execute("""
                INSERT INTO festivals (
                    temple_id, name, description, significance,
                    month, hindu_month, typical_date,
                    duration_days, is_major,
                    source, ai_generated,
                    deity, emoji,
                    display_date, color,
                    cached_year, cached_month
                ) VALUES (
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    'ai_cache', TRUE,
                    %s, %s,
                    %s, %s,
                    %s, %s
                )
                ON CONFLICT DO NOTHING
            """, (
                AI_SENTINEL_TEMPLE_ID,
                (f.get("name") or "")[:200],
                f.get("description"),
                f.get("significance"),
                month,
                f.get("hindu_month"),
                f.get("exact_date"),
                max(1, int(f.get("duration_days") or 1)),
                bool(f.get("is_major")),
                f.get("deity"),
                f.get("emoji"),
                f.get("display_date"),
                f.get("color"),
                year,
                month,
            ))


# ── Claude API call ───────────────────────────────────────────────────────────

async def _call_claude(prompt: str) -> list[dict]:
    if not ANTHROPIC_API_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set in environment")

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
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

    if response.status_code != 200:
        raise RuntimeError(f"Claude API error {response.status_code}: {response.text[:300]}")

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
        # Attempt partial recovery
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


async def _fetch_and_store(year: int):
    """Call Claude for full year, store in DB. Used on cache miss."""
    h1 = await _call_claude(_make_prompt(year, "January, February, March, April, May, June"))
    h2 = await _call_claude(_make_prompt(year, "July, August, September, October, November, December"))
    combined = h1 + h2
    if combined:
        _insert_ai_festivals(combined, year)
    return combined


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/api/festivals/ai-cache")
async def get_ai_festival_cache(background_tasks: BackgroundTasks):
    """
    Return AI-generated festivals for the current year.

    Cache logic:
    1. Check DB for cached data (source='ai_cache', cached_year=current_year).
    2. If found → return immediately (no Claude call).
    3. If NOT found → fetch from Claude, save to DB, return.
    4. On the 1st of each month → prune past months from DB in the background.
    """
    today        = date.today()
    current_year = today.year
    current_month = today.month

    # Prune stale months in background on 1st of each month
    if today.day == 1 and current_month > 1:
        background_tasks.add_task(_delete_stale_cache, current_year, current_month)

    # Cache hit?
    cached = _get_cached_year(current_year)
    if cached:
        return {
            "source": "cache",
            "year": current_year,
            "count": len(cached),
            "festivals": cached,
        }

    # Cache miss → fetch from Claude
    logger.info(f"AI festival cache miss for year {current_year}. Fetching from Claude...")
    try:
        festivals = await _fetch_and_store(current_year)
    except Exception as e:
        logger.error(f"Claude fetch failed: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Could not fetch festivals from AI: {str(e)}"
        )

    if not festivals:
        raise HTTPException(status_code=502, detail="AI returned empty festival list")

    # Re-read from DB so we return consistent DB rows (with ids etc.)
    stored = _get_cached_year(current_year)
    return {
        "source": "fresh",
        "year": current_year,
        "count": len(stored),
        "festivals": stored,
    }


@router.post(
    "/api/admin/festivals/ai-refresh",
    dependencies=[Depends(require_admin)],
)
async def admin_force_refresh():
    """
    Admin endpoint: wipe ai_cache for current year and re-fetch from Claude.
    Use this after testing or if festival data needs an update.
    """
    today        = date.today()
    current_year = today.year

    logger.info(f"Admin forced AI festival cache refresh for year {current_year}")

    try:
        festivals = await _fetch_and_store(current_year)
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

    return {
        "success":  True,
        "year":     current_year,
        "fetched":  len(festivals),
        "message":  f"Cache refreshed: {len(festivals)} festivals stored for {current_year}",
        "refreshed_at": datetime.utcnow().isoformat(),
    }