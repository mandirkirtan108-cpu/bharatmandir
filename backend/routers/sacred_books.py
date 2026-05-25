"""
Sacred Books Router — BharatMandir
Hybrid approach:
  • Book metadata & user data  → PostgreSQL (Neon DB)
  • Bhagavad Gita full content → bhagavadgita.io (free public API)
  • Other books                → static curated data (extendable)

Endpoints:
  GET  /api/books                          — list all books
  GET  /api/books/{slug}                   — book metadata
  GET  /api/books/{slug}/chapters          — all chapters
  GET  /api/books/{slug}/chapters/{num}    — single chapter with full verses
  GET  /api/books/{slug}/search?q=         — search within book
  POST /api/books/progress                 — save reading progress
  GET  /api/books/progress/{session_id}/{slug} — get progress
  POST /api/books/bookmarks               — add bookmark
  GET  /api/books/bookmarks/{session_id}  — get all bookmarks
  DELETE /api/books/bookmarks/{id}        — remove bookmark
"""

import os
import sys
import httpx
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from functools import lru_cache
import time

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.connection import get_db_cursor

router = APIRouter(tags=["Sacred Books"])

# ── External API config ───────────────────────────────────────────────────────
GITA_API_BASE = "https://bhagavadgita.io/api/v1"
GITA_API_KEY  = os.getenv("GITA_API_KEY", "")   # Free key from bhagavadgita.io

# Simple in-memory cache (chapter → data, expires after 24h)
_cache: dict = {}
CACHE_TTL = 86400  # 24 hours

def _cached(key: str, fetch_fn):
    now = time.time()
    if key in _cache and now - _cache[key]["ts"] < CACHE_TTL:
        return _cache[key]["data"]
    data = fetch_fn()
    _cache[key] = {"data": data, "ts": now}
    return data


# ═══════════════════════════════════════════════════════════════════════════════
# 1. LIST ALL BOOKS
# ═══════════════════════════════════════════════════════════════════════════════
@router.get("/api/books")
def list_books():
    """Return all active sacred books from DB."""
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, slug, title, sanskrit_title, deity, tradition,
                   language, total_chapters, total_verses, description,
                   icon_emoji, accent_color, api_source
            FROM sacred_books
            WHERE is_active = TRUE
            ORDER BY id
        """)
        books = cur.fetchall()
    return {"books": [dict(b) for b in books]}


# ═══════════════════════════════════════════════════════════════════════════════
# 2. SINGLE BOOK METADATA
# ═══════════════════════════════════════════════════════════════════════════════
@router.get("/api/books/{slug}")
def get_book(slug: str):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, slug, title, sanskrit_title, deity, tradition,
                   language, total_chapters, total_verses, description,
                   icon_emoji, accent_color, api_source, api_book_id
            FROM sacred_books WHERE slug = %s AND is_active = TRUE
        """, (slug,))
        book = cur.fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return dict(book)


# ═══════════════════════════════════════════════════════════════════════════════
# 3. ALL CHAPTERS OF A BOOK
# ═══════════════════════════════════════════════════════════════════════════════
@router.get("/api/books/{slug}/chapters")
def get_chapters(slug: str):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT sb.id, sb.api_source, sb.api_book_id, sb.total_chapters
            FROM sacred_books sb WHERE sb.slug = %s AND sb.is_active = TRUE
        """, (slug,))
        book = cur.fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    book = dict(book)

    # ── Bhagavad Gita: fetch from live API ───────────────────────────────────
    if book["api_source"] == "bhagavad_gita_api":
        return _chapters_from_gita_api()

    # ── Other books: fetch from DB (populated from seed / admin) ─────────────
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT chapter_number, title, summary, verse_count
            FROM book_chapters WHERE book_id = %s
            ORDER BY chapter_number
        """, (book["id"],))
        chapters = cur.fetchall()
    return {"chapters": [dict(c) for c in chapters]}


def _chapters_from_gita_api():
    """Fetch all 18 chapters list from bhagavadgita.io."""
    def fetch():
        headers = {"Authorization": f"Bearer {GITA_API_KEY}"} if GITA_API_KEY else {}
        with httpx.Client(timeout=10) as client:
            r = client.get(f"{GITA_API_BASE}/chapters/", headers=headers)
            r.raise_for_status()
            data = r.json()
        chapters = []
        for ch in data:
            chapters.append({
                "chapter_number": ch.get("chapter_number"),
                "title":          ch.get("name_translated") or ch.get("name"),
                "sanskrit_title": ch.get("name"),
                "summary":        ch.get("chapter_summary"),
                "verse_count":    ch.get("verses_count"),
            })
        return {"chapters": chapters}

    try:
        return _cached("gita_chapters", fetch)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gita API error: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# 4. SINGLE CHAPTER WITH ALL VERSES (full book reading)
# ═══════════════════════════════════════════════════════════════════════════════
@router.get("/api/books/{slug}/chapters/{chapter_num}")
def get_chapter_verses(slug: str, chapter_num: int):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, api_source, api_book_id, total_chapters
            FROM sacred_books WHERE slug = %s AND is_active = TRUE
        """, (slug,))
        book = cur.fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    book = dict(book)

    if book["api_source"] == "bhagavad_gita_api":
        return _chapter_verses_gita(chapter_num)

    # For other books — return DB verses (if seeded) or placeholder
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT chapter_number, title, summary
            FROM book_chapters
            WHERE book_id = %s AND chapter_number = %s
        """, (book["id"], chapter_num))
        ch = cur.fetchone()

    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")

    return {
        "chapter_number": ch["chapter_number"],
        "title":          ch["title"],
        "summary":        ch["summary"],
        "verses":         [],  # Future: seed full text here
        "note":           "Full verse text coming soon. Currently available for Bhagavad Gita.",
    }


def _chapter_verses_gita(chapter_num: int):
    """Fetch all verses of a Gita chapter from bhagavadgita.io."""
    def fetch():
        headers = {"Authorization": f"Bearer {GITA_API_KEY}"} if GITA_API_KEY else {}
        with httpx.Client(timeout=15) as client:
            # Chapter metadata
            ch_r = client.get(f"{GITA_API_BASE}/chapters/{chapter_num}/", headers=headers)
            ch_r.raise_for_status()
            ch_data = ch_r.json()

            # All verses
            v_r = client.get(f"{GITA_API_BASE}/chapters/{chapter_num}/verses/", headers=headers)
            v_r.raise_for_status()
            v_data = v_r.json()

        verses = []
        for v in v_data:
            verses.append({
                "verse_number":   v.get("verse_number"),
                "chapter_number": chapter_num,
                "sanskrit":       v.get("text"),
                "transliteration":v.get("transliteration"),
                "translation":    _best_translation(v.get("translations", [])),
                "commentary":     _best_commentary(v.get("commentaries", [])),
            })

        return {
            "chapter_number": chapter_num,
            "title":          ch_data.get("name_translated") or ch_data.get("name"),
            "sanskrit_title": ch_data.get("name"),
            "summary":        ch_data.get("chapter_summary"),
            "verse_count":    ch_data.get("verses_count"),
            "verses":         verses,
        }

    try:
        return _cached(f"gita_ch_{chapter_num}", fetch)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gita API error: {e}")


def _best_translation(translations: list) -> str:
    """Pick the best English translation available."""
    preferred = ["Swami Sivananda", "Dr. S. Sankaranarayan", "Shri Purohit Swami"]
    for pref in preferred:
        for t in translations:
            if pref.lower() in (t.get("author_name") or "").lower():
                return t.get("description", "")
    # Fall back to first available
    return translations[0].get("description", "") if translations else ""


def _best_commentary(commentaries: list) -> str:
    """Pick commentary — prefer Swami Sivananda."""
    for c in commentaries:
        if "sivananda" in (c.get("author_name") or "").lower():
            return c.get("description", "")
    return commentaries[0].get("description", "") if commentaries else ""


# ═══════════════════════════════════════════════════════════════════════════════
# 5. SEARCH WITHIN A BOOK
# ═══════════════════════════════════════════════════════════════════════════════
@router.get("/api/books/{slug}/search")
def search_in_book(slug: str, q: str = Query(..., min_length=2)):
    """Search for keyword across all verses of Bhagavad Gita (cached chapters)."""
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT api_source FROM sacred_books WHERE slug = %s AND is_active = TRUE",
            (slug,)
        )
        book = cur.fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    if book["api_source"] != "bhagavad_gita_api":
        return {"results": [], "message": "Full-text search available only for Bhagavad Gita currently."}

    q_lower = q.lower()
    results = []

    # Search through all cached chapters (won't re-fetch if cached)
    for ch_num in range(1, 19):
        try:
            ch_data = _chapter_verses_gita(ch_num)
            for v in ch_data.get("verses", []):
                translation = (v.get("translation") or "").lower()
                commentary  = (v.get("commentary") or "").lower()
                if q_lower in translation or q_lower in commentary:
                    results.append({
                        "chapter_number": ch_num,
                        "verse_number":   v["verse_number"],
                        "chapter_title":  ch_data["title"],
                        "translation":    v["translation"],
                        "sanskrit":       v["sanskrit"],
                    })
        except Exception:
            continue  # Skip chapters that fail to load

    return {"query": q, "total": len(results), "results": results[:50]}


# ═══════════════════════════════════════════════════════════════════════════════
# 6. READING PROGRESS
# ═══════════════════════════════════════════════════════════════════════════════
class ProgressUpdate(BaseModel):
    session_id:   str
    slug:         str
    last_chapter: int
    last_verse:   int

@router.post("/api/books/progress")
def save_progress(data: ProgressUpdate):
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT id, total_chapters, total_verses FROM sacred_books WHERE slug = %s",
            (data.slug,)
        )
        book = cur.fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Calculate rough percent
    total_v = book["total_verses"] or 1
    # Approximate: assume uniform verse distribution across chapters
    chapters_done = data.last_chapter - 1
    verses_per_ch = total_v / (book["total_chapters"] or 1)
    approx_done = (chapters_done * verses_per_ch + data.last_verse)
    percent = min(round((approx_done / total_v) * 100, 2), 100)

    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO reading_progress (session_id, book_id, last_chapter, last_verse, percent_done, updated_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (session_id, book_id)
            DO UPDATE SET
                last_chapter = EXCLUDED.last_chapter,
                last_verse   = EXCLUDED.last_verse,
                percent_done = EXCLUDED.percent_done,
                updated_at   = NOW()
        """, (data.session_id, book["id"], data.last_chapter, data.last_verse, percent))

    return {"status": "saved", "percent_done": percent}


@router.get("/api/books/progress/{session_id}")
def get_all_progress(session_id: str):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT sb.slug, sb.title, sb.icon_emoji,
                   rp.last_chapter, rp.last_verse, rp.percent_done, rp.updated_at
            FROM reading_progress rp
            JOIN sacred_books sb ON sb.id = rp.book_id
            WHERE rp.session_id = %s
            ORDER BY rp.updated_at DESC
        """, (session_id,))
        rows = cur.fetchall()
    return {"progress": [dict(r) for r in rows]}


# ═══════════════════════════════════════════════════════════════════════════════
# 7. BOOKMARKS
# ═══════════════════════════════════════════════════════════════════════════════
class BookmarkCreate(BaseModel):
    session_id:     str
    slug:           str
    chapter_number: int
    verse_number:   int
    note:           Optional[str] = None

@router.post("/api/books/bookmarks")
def add_bookmark(data: BookmarkCreate):
    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM sacred_books WHERE slug = %s", (data.slug,))
        book = cur.fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO book_bookmarks
                (session_id, book_id, chapter_number, verse_number, note)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (session_id, book_id, chapter_number, verse_number)
            DO UPDATE SET note = EXCLUDED.note
            RETURNING id
        """, (data.session_id, book["id"], data.chapter_number, data.verse_number, data.note))
        bm = cur.fetchone()

    return {"status": "bookmarked", "bookmark_id": bm["id"]}


@router.get("/api/books/bookmarks/{session_id}")
def get_bookmarks(session_id: str):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT bm.id, sb.slug, sb.title, sb.icon_emoji,
                   bm.chapter_number, bm.verse_number, bm.note, bm.created_at
            FROM book_bookmarks bm
            JOIN sacred_books sb ON sb.id = bm.book_id
            WHERE bm.session_id = %s
            ORDER BY bm.created_at DESC
        """, (session_id,))
        rows = cur.fetchall()
    return {"bookmarks": [dict(r) for r in rows]}


@router.delete("/api/books/bookmarks/{bookmark_id}")
def delete_bookmark(bookmark_id: int, session_id: str = Query(...)):
    with get_db_cursor() as cur:
        cur.execute("""
            DELETE FROM book_bookmarks
            WHERE id = %s AND session_id = %s
            RETURNING id
        """, (bookmark_id, session_id))
        deleted = cur.fetchone()
    if not deleted:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    return {"status": "deleted"}