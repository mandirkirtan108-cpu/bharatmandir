"""
Sacred Books Router — BharatMandir
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATA SOURCES (all free, no API key required):
  • Bhagavad Gita — github.com/gita/gita (701 verses, Sanskrit, transliteration,
                    Swami Sivananda translation + commentary, word meanings)
  • Other books    — curated static data (Ramayana, Mahabharata, Shiva Purana,
                    Devi Mahatmya, Hanuman Chalisa) with chapter summaries.
                    Full verse text for these can be added by seeding book_verses table.

WHY bhagavadgita.io WAS REMOVED:
  • Requires OAuth2 token (GITA_API_KEY env var) — fails silently when missing.
  • Blocked by Vercel/Railway/Render egress proxy allowlists.
  • The gita/gita GitHub dataset is identical in content, always free, and faster
    (GitHub CDN + 24h in-process cache means zero latency after first load).

ENDPOINTS:
  GET  /api/books                              — list all books
  GET  /api/books/{slug}                       — book metadata
  GET  /api/books/{slug}/chapters              — all chapters
  GET  /api/books/{slug}/chapters/{num}        — chapter + full verses
  GET  /api/books/{slug}/search?q=             — full-text search within book
  POST /api/books/progress                     — save reading progress
  GET  /api/books/progress/{session_id}        — get all progress
  POST /api/books/bookmarks                    — add bookmark
  GET  /api/books/bookmarks/{session_id}       — get all bookmarks
  DELETE /api/books/bookmarks/{bookmark_id}    — remove bookmark
"""

import os, sys, time, httpx
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from collections import defaultdict

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.connection import get_db_cursor

router = APIRouter(tags=["Sacred Books"])

# ═══════════════════════════════════════════════════════════════════════════════
# GITHUB RAW DATA SOURCE — gita/gita repo (MIT licence, no key needed)
# ═══════════════════════════════════════════════════════════════════════════════

_GITA_BASE = "https://raw.githubusercontent.com/gita/gita/master/data"

# In-process cache — survives across requests, reloaded every 24 h
_cache: dict = {}
_CACHE_TTL = 86400  # 24 hours


def _cache_get(key: str):
    entry = _cache.get(key)
    if entry and time.time() - entry["ts"] < _CACHE_TTL:
        return entry["data"]
    return None


def _cache_set(key: str, data):
    _cache[key] = {"data": data, "ts": time.time()}
    return data


def _fetch_json(url: str):
    """Fetch JSON from URL with 15s timeout."""
    with httpx.Client(timeout=15, follow_redirects=True) as client:
        r = client.get(url)
        r.raise_for_status()
        return r.json()


# ── Load all three Gita data files once and cache forever ──────────────────────

def _load_gita_dataset():
    """
    Returns (verses, trans_by_verse, comm_by_verse) from gita/gita GitHub repo.
    Cached for 24 hours. Each call after the first is instant (in-memory).
    """
    cached = _cache_get("gita_dataset")
    if cached:
        return cached

    try:
        verses       = _fetch_json(f"{_GITA_BASE}/verse.json")
        translations = _fetch_json(f"{_GITA_BASE}/translation.json")
        commentaries = _fetch_json(f"{_GITA_BASE}/commentary.json")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not load Gita dataset from GitHub: {e}")

    # Build lookup: verse_id → [translation objects]
    trans_by_verse: dict = defaultdict(list)
    for t in translations:
        trans_by_verse[t["verse_id"]].append(t)

    # Build lookup: verse_id → [commentary objects]
    comm_by_verse: dict = defaultdict(list)
    for c in commentaries:
        comm_by_verse[c["verse_id"]].append(c)

    dataset = (verses, dict(trans_by_verse), dict(comm_by_verse))
    return _cache_set("gita_dataset", dataset)


def _best_english_translation(verse_id: int, trans_by_verse: dict) -> str:
    """Pick the best English translation, preferring Swami Sivananda."""
    options = trans_by_verse.get(verse_id, [])
    en = [t for t in options if t.get("lang") == "english"]
    # Priority order
    for author in ["Swami Sivananda", "Shri Purohit Swami", "Dr. S. Sankaranarayan",
                   "Swami Gambirananda", "Swami Adidevananda"]:
        for t in en:
            if author.lower() in t.get("authorName", "").lower():
                return t.get("description", "")
    return en[0].get("description", "") if en else ""


def _best_english_commentary(verse_id: int, comm_by_verse: dict) -> str:
    """Pick Swami Sivananda's English commentary."""
    options = comm_by_verse.get(verse_id, [])
    en = [c for c in options if c.get("lang") == "english"]
    for c in en:
        if "sivananda" in c.get("authorName", "").lower():
            return c.get("description", "")
    return en[0].get("description", "") if en else ""


# ── Static chapter metadata for Bhagavad Gita ─────────────────────────────────

_GITA_CHAPTERS = {
    1:  ("Arjuna Vishada Yoga",          "Arjuna's Grief",
         "On the battlefield of Kurukshetra, Arjuna surveys the two armies and, overcome with grief and despair at the sight of his kinsmen and teachers, lays down his bow, declaring he cannot fight."),
    2:  ("Sankhya Yoga",                 "The Yoga of Knowledge",
         "Krishna begins his teachings by distinguishing the eternal soul from the mortal body. He declares the Atman is birthless and deathless, and introduces the concept of performing duty without attachment to results."),
    3:  ("Karma Yoga",                   "The Yoga of Action",
         "Action done without desire for fruits is true sacrifice. One must perform their duty in the world; inaction is impossible. Krishna explains why even the wise must act, for the sake of the world."),
    4:  ("Jnana Karma Sanyasa Yoga",     "Knowledge and Action",
         "Krishna reveals he has taught this imperishable yoga in earlier cosmic ages. He explains the mystery of his birth and action, the nature of sacrifice, and how wisdom destroys all karma."),
    5:  ("Karma Sanyasa Yoga",           "Renunciation of Action",
         "True renunciation is inner — surrendering desire for fruits. Both the path of action and the path of knowledge lead to the same liberation. The disciplined person sees the Self in all beings."),
    6:  ("Dhyana Yoga",                  "The Yoga of Meditation",
         "Krishna describes the method of meditation, the control of mind and senses, and the marks of the true yogi. The mind is the greatest friend and greatest enemy of the self."),
    7:  ("Jnana Vijnana Yoga",           "Knowledge and Wisdom",
         "Krishna reveals his divine nature as the source of all creation — earth, water, fire, air, ether, mind, intellect, and ego. He describes maya, the four types of devotees, and those who know him truly."),
    8:  ("Aksara Brahma Yoga",           "The Imperishable Brahman",
         "Krishna explains the nature of Brahman, the individual self, and the cosmos. He teaches how to remember him at the moment of death, and the paths of no-return versus return after death."),
    9:  ("Raja Vidya Raja Guhya Yoga",   "The Royal Knowledge",
         "The most secret and most holy knowledge — Krishna declares he pervades all existence yet is not in things. Pure devotion and surrender, even without elaborate ritual, is the highest and most direct path."),
    10: ("Vibhuti Yoga",                 "Divine Glories",
         "Krishna describes his divine manifestations: he is the best and most glorious in every category of existence — the Self in all beings, the beginning, middle, and end of creation."),
    11: ("Vishvarupa Darsana Yoga",      "Vision of the Cosmic Form",
         "Granted divine sight by Krishna, Arjuna beholds the awesome universal form — infinite mouths, eyes, arms, and faces devouring all the worlds. Terrified, he begs Krishna to return to his gentle human form."),
    12: ("Bhakti Yoga",                  "The Path of Devotion",
         "Krishna declares that devotees who worship him with pure love are most dear to him. He describes the qualities of his dearest devotees — equanimity, contentment, steadiness, compassion, and freedom from ego."),
    13: ("Kshetra Kshetrajna Yoga",      "The Field and Its Knower",
         "The body is the field; the soul is the knower of the field. True wisdom is recognising the Supreme Self equally present in all fields — in every body and every being."),
    14: ("Gunatraya Vibhaga Yoga",       "The Three Qualities",
         "All creation is bound by the three gunas: sattva (clarity), rajas (passion), and tamas (inertia). Krishna explains how each binds the soul and how transcending them leads to liberation."),
    15: ("Purushottama Yoga",            "The Supreme Person",
         "The world is like an eternal Ashvattha tree, roots above and branches below. Beyond both the perishable world and the imperishable Atman stands the Supreme Person — Purushottama — whom Krishna declares himself to be."),
    16: ("Daivasura Sampad Yoga",        "Divine and Demonic Qualities",
         "Krishna lists the divine virtues — fearlessness, purity, compassion, truthfulness — that lead to liberation, and the demonic traits — hypocrisy, arrogance, lust — that lead to bondage."),
    17: ("Sraddhatraya Vibhaga Yoga",    "The Threefold Faith",
         "Faith, food, worship, sacrifice, and austerity each bear the stamp of the three gunas. Action done without faith, without scripture, and without dedication to the Divine is tamasic and of no value."),
    18: ("Moksha Sanyasa Yoga",          "Liberation through Renunciation",
         "The final and complete teaching: understand the nature of renunciation and action. Abandon all dharmas and take refuge in Krishna alone — this is the highest secret, the path to eternal freedom from all sin."),
}


# ═══════════════════════════════════════════════════════════════════════════════
# 1. LIST ALL BOOKS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/books")
def list_books():
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
                   icon_emoji, accent_color, api_source
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
            SELECT id, api_source, total_chapters
            FROM sacred_books WHERE slug = %s AND is_active = TRUE
        """, (slug,))
        book = cur.fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    book = dict(book)

    # ── Bhagavad Gita: build from GitHub dataset ─────────────────────────────
    if book["api_source"] == "bhagavad_gita_api":
        return _gita_chapters()

    # ── Other books: read from DB (seeded via migration SQL) ─────────────────
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT chapter_number, title, summary, verse_count
            FROM book_chapters WHERE book_id = %s
            ORDER BY chapter_number
        """, (book["id"],))
        chapters = cur.fetchall()
    return {"chapters": [dict(c) for c in chapters]}


def _gita_chapters():
    """Return all 18 Gita chapters built from the static metadata + verse counts."""
    cached = _cache_get("gita_chapters_list")
    if cached:
        return cached

    verses, _, _ = _load_gita_dataset()

    # Count verses per chapter
    vc: dict = defaultdict(int)
    for v in verses:
        vc[v["chapter_number"]] += 1

    chapters = []
    for num in range(1, 19):
        title, subtitle, summary = _GITA_CHAPTERS.get(num, (f"Chapter {num}", "", ""))
        chapters.append({
            "chapter_number": num,
            "title":          title,
            "subtitle":       subtitle,
            "summary":        summary,
            "verse_count":    vc.get(num, 0),
        })

    result = {"chapters": chapters}
    return _cache_set("gita_chapters_list", result)


# ═══════════════════════════════════════════════════════════════════════════════
# 4. SINGLE CHAPTER WITH ALL VERSES
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/books/{slug}/chapters/{chapter_num}")
def get_chapter_verses(slug: str, chapter_num: int):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, api_source, total_chapters
            FROM sacred_books WHERE slug = %s AND is_active = TRUE
        """, (slug,))
        book = cur.fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    book = dict(book)

    if book["api_source"] == "bhagavad_gita_api":
        return _gita_chapter_verses(chapter_num)

    # ── Other books: return DB verses if seeded, else placeholder ─────────────
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT chapter_number, title, summary, verse_count
            FROM book_chapters WHERE book_id = %s AND chapter_number = %s
        """, (book["id"], chapter_num))
        ch = cur.fetchone()

    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")
    ch = dict(ch)

    # Try to load verses from book_verses table if it exists
    try:
        with get_db_cursor() as cur:
            cur.execute("""
                SELECT verse_number, chapter_number, sanskrit, transliteration,
                       translation, commentary, word_meanings
                FROM book_verses
                WHERE book_id = %s AND chapter_number = %s
                ORDER BY verse_number
            """, (book["id"], chapter_num))
            verses = cur.fetchall()
        if verses:
            return {**ch, "verses": [dict(v) for v in verses]}
    except Exception:
        pass  # table may not exist yet

    return {
        **ch,
        "verses": [],
        "note": "Full verse text for this scripture is coming soon. Bhagavad Gita is fully available — select it from the library.",
    }


def _gita_chapter_verses(chapter_num: int):
    """Return all verses of a Gita chapter, fully enriched."""
    if chapter_num < 1 or chapter_num > 18:
        raise HTTPException(status_code=404, detail="Chapter not found (1–18 only)")

    cache_key = f"gita_ch_{chapter_num}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    verses, trans_by_verse, comm_by_verse = _load_gita_dataset()

    title, subtitle, summary = _GITA_CHAPTERS.get(chapter_num, (f"Chapter {chapter_num}", "", ""))

    ch_verses = sorted(
        [v for v in verses if v["chapter_number"] == chapter_num],
        key=lambda v: v["verse_number"]
    )

    result_verses = []
    for v in ch_verses:
        vid = v["id"]
        result_verses.append({
            "verse_number":   v["verse_number"],
            "chapter_number": chapter_num,
            "sanskrit":       v.get("text", ""),
            "transliteration": v.get("transliteration", ""),
            "word_meanings":  v.get("word_meanings", ""),
            "translation":    _best_english_translation(vid, trans_by_verse),
            "commentary":     _best_english_commentary(vid, comm_by_verse),
        })

    result = {
        "chapter_number": chapter_num,
        "title":          title,
        "subtitle":       subtitle,
        "summary":        summary,
        "verse_count":    len(result_verses),
        "verses":         result_verses,
    }
    return _cache_set(cache_key, result)


# ═══════════════════════════════════════════════════════════════════════════════
# 5. SEARCH WITHIN A BOOK
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/api/books/{slug}/search")
def search_in_book(slug: str, q: str = Query(..., min_length=2)):
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT api_source FROM sacred_books WHERE slug = %s AND is_active = TRUE",
            (slug,)
        )
        book = cur.fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    if book["api_source"] != "bhagavad_gita_api":
        return {
            "results": [],
            "total": 0,
            "query": q,
            "message": "Full-text search is currently available for Bhagavad Gita only.",
        }

    q_lower = q.lower()
    results = []

    # Search across all 18 cached chapters
    for ch_num in range(1, 19):
        try:
            ch_data = _gita_chapter_verses(ch_num)
            for v in ch_data.get("verses", []):
                translation = (v.get("translation") or "").lower()
                commentary  = (v.get("commentary") or "").lower()
                word_means  = (v.get("word_meanings") or "").lower()
                if q_lower in translation or q_lower in commentary or q_lower in word_means:
                    results.append({
                        "chapter_number": ch_num,
                        "verse_number":   v["verse_number"],
                        "chapter_title":  ch_data["title"],
                        "translation":    v["translation"],
                        "sanskrit":       v["sanskrit"],
                    })
        except Exception:
            continue

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

    total_v  = book["total_verses"] or 1
    ch_done  = data.last_chapter - 1
    per_ch   = total_v / (book["total_chapters"] or 1)
    approx   = ch_done * per_ch + data.last_verse
    percent  = min(round((approx / total_v) * 100, 2), 100)

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