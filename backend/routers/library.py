"""Public API used by the new LibraryPage and ReaderPage.

This adapter presents the existing sacred-books catalogue as the page-based
library contract. It can be removed once the native library tables/API are
deployed, without changing the frontend pages.
"""

from fastapi import APIRouter, HTTPException, Query

from routers.sacred_books import (
    _STATIC_BOOKS,
    _dispatch_chapter_verses,
    _dispatch_chapters,
)
from db.connection import get_db_cursor


router = APIRouter(prefix="/api/library", tags=["Library"])

SOURCE_CATEGORIES = {
    "bhagavad_gita_api": ("gita", "Bhagavad Gita"),
    "valmiki_ramayana": ("itihasa", "Itihasa"),
    "mahabharata": ("itihasa", "Itihasa"),
    "ramcharitmanas": ("itihasa", "Itihasa"),
    "shiva_purana": ("purana", "Puranas"),
    "devi_mahatmya": ("purana", "Puranas"),
    "vishnu_purana": ("purana", "Puranas"),
    "bhagavata_purana": ("purana", "Puranas"),
    "hanuman_chalisa": ("chalisa", "Chalisa"),
    "rigveda": ("veda", "Vedas"),
    "yajurveda": ("veda", "Vedas"),
    "atharvaveda": ("veda", "Vedas"),
    "upanishads": ("upanishad", "Upanishads"),
    "manusmriti": ("dharmashastra", "Dharmashastra"),
    "yoga_sutras": ("yoga", "Yoga"),
}
NEW_PUBLICATIONS = ("new-publications", "New Publications")


def _category_for(book):
    return SOURCE_CATEGORIES.get(book.get("api_source"), NEW_PUBLICATIONS)


def _available_languages(book):
    language = (book.get("language") or "").lower()
    available = ["sa"] if "sanskrit" in language else []
    if "english" in language or "translation" in language or "notes" in language:
        available.append("en")
    return available or ["en"]


def _serialize_book(book):
    category_slug, category_name = _category_for(book)
    return {
        **book,
        "category": category_slug,
        "category_name": category_name,
        "author": book.get("author") or book.get("tradition"),
        "cover_image_url": book.get("cover_image_url"),
        "available_languages": _available_languages(book),
    }


def _all_books():
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT id, slug, title, sanskrit_title, deity, tradition,
                   language, total_chapters, total_verses, description,
                   icon_emoji, accent_color, api_source
            FROM sacred_books
            WHERE is_active = TRUE
            ORDER BY id
            """
        )
        books = [dict(row) for row in cur.fetchall()]

    known_slugs = {book["slug"] for book in books}
    books.extend(
        dict(book)
        for slug, book in _STATIC_BOOKS.items()
        if slug not in known_slugs
    )
    return [_serialize_book(book) for book in books]


def _book_by_id(book_id: int):
    return next((book for book in _all_books() if int(book["id"]) == book_id), None)


@router.get("/categories")
def list_categories():
    categories = {}
    for book in _all_books():
        slug = book["category"]
        categories.setdefault(
            slug,
            {
                "id": slug,
                "slug": slug,
                "name": book["category_name"],
            },
        )
    return list(categories.values())


@router.get("/books")
def list_library_books(
    category: str | None = None,
    search: str | None = None,
    limit: int = Query(24, ge=1, le=100),
    offset: int = Query(0, ge=0),
):
    books = _all_books()
    if category:
        books = [book for book in books if book["category"] == category]
    if search:
        term = search.casefold()
        books = [
            book
            for book in books
            if term in (book.get("title") or "").casefold()
            or term in (book.get("sanskrit_title") or "").casefold()
            or term in (book.get("author") or "").casefold()
            or term in (book.get("description") or "").casefold()
        ]
    return books[offset: offset + limit]


@router.get("/books/{book_id}/pages/{page_number}")
def get_library_page(
    book_id: int,
    page_number: int,
    language: str = Query("en", pattern="^(en|hi|sa)$"),
):
    book = _book_by_id(book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    chapters = _dispatch_chapters(book["slug"], book["api_source"], book["id"])
    chapter_list = chapters.get("chapters", [])
    if page_number < 1 or page_number > len(chapter_list):
        raise HTTPException(status_code=404, detail="Page not found")

    chapter = _dispatch_chapter_verses(
        book["slug"],
        book["api_source"],
        book["id"],
        page_number,
    )
    blocks = [{
        "type": "heading",
        "text": chapter.get("title") or f"Chapter {page_number}",
    }]

    for verse in chapter.get("verses", []):
        if language == "sa":
            text = verse.get("sanskrit") or verse.get("text")
        elif language == "hi":
            text = (
                verse.get("translation_hi")
                or verse.get("hindi")
                or verse.get("translation")
                or verse.get("text")
            )
        else:
            text = verse.get("translation") or verse.get("text") or verse.get("sanskrit")
        if text:
            blocks.append({
                "type": "verse",
                "number": verse.get("verse_number") or verse.get("number"),
                "text": text,
            })

    if len(blocks) == 1 and chapter.get("note"):
        blocks.append({"type": "paragraph", "text": chapter["note"]})

    return {
        "book_id": book_id,
        "page_number": page_number,
        "total_pages": len(chapter_list),
        "language": language,
        "title": chapter.get("title"),
        "blocks": blocks,
    }
