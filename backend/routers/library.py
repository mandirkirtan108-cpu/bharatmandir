"""
Public + authenticated-user endpoints for the Sacred Books Library.
"""

from fastapi import APIRouter, Depends, HTTPException, Query

from db.connection import get_db_cursor
from models.library import (
    BookmarkCreate,
    HighlightCreate,
    PreferencesUpdate,
    ReadingProgressUpdate,
)
from routers.user_auth import get_current_user

router = APIRouter(prefix="/api/library", tags=["Library"])


# ── Browse ───────────────────────────────────────────────────────────────

@router.get("/categories")
async def list_categories():
    with get_db_cursor() as cur:
        cur.execute("SELECT id, name, slug, icon FROM book_categories ORDER BY sort_order")
        return cur.fetchall()


@router.get("/books")
async def list_books(
    category: str | None = Query(None, description="category slug"),
    search: str | None = Query(None),
    limit: int = Query(40, le=100),
    offset: int = Query(0),
):
    conditions = ["b.is_published = TRUE"]
    params: list = []

    if category:
        conditions.append("c.slug = %s")
        params.append(category)

    if search:
        conditions.append(
            "to_tsvector('english', b.title || ' ' || COALESCE(b.author, '') || ' ' || COALESCE(b.description, '')) "
            "@@ plainto_tsquery('english', %s)"
        )
        params.append(search)

    where_clause = " AND ".join(conditions)
    params.extend([limit, offset])

    with get_db_cursor() as cur:
        cur.execute(
            f"""
            SELECT b.id, b.uuid, b.slug, b.title, b.subtitle, b.author,
                   b.original_language, b.cover_image_url, b.page_count,
                   b.created_at, c.name AS category_name, c.slug AS category_slug
            FROM books b
            LEFT JOIN book_categories c ON c.id = b.category_id
            WHERE {where_clause}
            ORDER BY b.created_at DESC
            LIMIT %s OFFSET %s
            """,
            params,
        )
        return cur.fetchall()


@router.get("/books/{slug}")
async def get_book(slug: str):
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT b.*, c.name AS category_name, c.slug AS category_slug
            FROM books b
            LEFT JOIN book_categories c ON c.id = b.category_id
            WHERE b.slug = %s AND b.is_published = TRUE
            """,
            (slug,),
        )
        book = cur.fetchone()
        if not book:
            raise HTTPException(404, "Book not found")

        cur.execute(
            "SELECT language, status, progress_pct FROM book_translations WHERE book_id = %s",
            (book["id"],),
        )
        book["translations"] = cur.fetchall()

    return book


# ── Reading ──────────────────────────────────────────────────────────────

@router.get("/books/{book_id}/pages/{page_number}")
async def get_page(book_id: int, page_number: int, lang: str = Query("en")):
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT original_language, page_count, is_published FROM books WHERE id = %s",
            (book_id,),
        )
        book = cur.fetchone()
        if not book or not book["is_published"]:
            raise HTTPException(404, "Book not found")

        if lang == book["original_language"]:
            cur.execute(
                "SELECT page_number, formatted_text FROM book_pages WHERE book_id = %s AND page_number = %s",
                (book_id, page_number),
            )
            page = cur.fetchone()
            if not page:
                raise HTTPException(404, "Page not found")
            return {
                "page_number": page["page_number"],
                "total_pages": book["page_count"],
                "language": lang,
                "blocks": page["formatted_text"],
            }

        cur.execute(
            "SELECT id, status FROM book_translations WHERE book_id = %s AND language = %s",
            (book_id, lang),
        )
        translation = cur.fetchone()
        if not translation:
            raise HTTPException(404, f"No translation requested for language '{lang}'")
        if translation["status"] != "completed":
            # 202 tells the frontend "not an error, just not ready yet" so
            # the reader can show a translating-in-progress state instead
            # of a blank/broken page.
            raise HTTPException(202, f"Translation to '{lang}' is {translation['status']}")

        cur.execute(
            "SELECT page_number, translated_text FROM book_translation_pages "
            "WHERE translation_id = %s AND page_number = %s",
            (translation["id"], page_number),
        )
        page = cur.fetchone()
        if not page:
            raise HTTPException(404, "Page not found")

        return {
            "page_number": page["page_number"],
            "total_pages": book["page_count"],
            "language": lang,
            "blocks": page["translated_text"],
        }


# ── Reading progress ───────────────────────────────────────────────────

@router.put("/progress")
async def update_progress(body: ReadingProgressUpdate, user: dict = Depends(get_current_user)):
    with get_db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO user_reading_progress (user_id, book_id, language, current_page, total_pages, last_read_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (user_id, book_id)
            DO UPDATE SET language = EXCLUDED.language,
                          current_page = EXCLUDED.current_page,
                          total_pages = COALESCE(EXCLUDED.total_pages, user_reading_progress.total_pages),
                          last_read_at = NOW()
            """,
            (user["id"], body.book_id, body.language, body.current_page, body.total_pages),
        )
    return {"status": "saved"}


@router.get("/continue-reading")
async def continue_reading(user: dict = Depends(get_current_user), limit: int = 10):
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT p.book_id, p.language, p.current_page, p.total_pages, p.last_read_at,
                   b.title, b.slug, b.cover_image_url
            FROM user_reading_progress p
            JOIN books b ON b.id = p.book_id
            WHERE p.user_id = %s
            ORDER BY p.last_read_at DESC
            LIMIT %s
            """,
            (user["id"], limit),
        )
        return cur.fetchall()


# ── Bookmarks ────────────────────────────────────────────────────────────

@router.post("/bookmarks", status_code=201)
async def create_bookmark(body: BookmarkCreate, user: dict = Depends(get_current_user)):
    with get_db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO user_bookmarks (user_id, book_id, page_number, label)
            VALUES (%s, %s, %s, %s) RETURNING id
            """,
            (user["id"], body.book_id, body.page_number, body.label),
        )
        return cur.fetchone()


@router.get("/bookmarks/{book_id}")
async def list_bookmarks(book_id: int, user: dict = Depends(get_current_user)):
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT id, page_number, label, created_at FROM user_bookmarks "
            "WHERE user_id = %s AND book_id = %s ORDER BY page_number",
            (user["id"], book_id),
        )
        return cur.fetchall()


@router.delete("/bookmarks/{bookmark_id}")
async def delete_bookmark(bookmark_id: int, user: dict = Depends(get_current_user)):
    with get_db_cursor() as cur:
        cur.execute(
            "DELETE FROM user_bookmarks WHERE id = %s AND user_id = %s RETURNING id",
            (bookmark_id, user["id"]),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Bookmark not found")
    return {"status": "deleted"}


# ── Highlights ───────────────────────────────────────────────────────────

@router.post("/highlights", status_code=201)
async def create_highlight(body: HighlightCreate, user: dict = Depends(get_current_user)):
    with get_db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO user_highlights (user_id, book_id, page_number, text_snippet, color, note)
            VALUES (%s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (user["id"], body.book_id, body.page_number, body.text_snippet, body.color, body.note),
        )
        return cur.fetchone()


@router.get("/highlights/{book_id}")
async def list_highlights(book_id: int, user: dict = Depends(get_current_user)):
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT id, page_number, text_snippet, color, note, created_at FROM user_highlights "
            "WHERE user_id = %s AND book_id = %s ORDER BY page_number",
            (user["id"], book_id),
        )
        return cur.fetchall()


@router.delete("/highlights/{highlight_id}")
async def delete_highlight(highlight_id: int, user: dict = Depends(get_current_user)):
    with get_db_cursor() as cur:
        cur.execute(
            "DELETE FROM user_highlights WHERE id = %s AND user_id = %s RETURNING id",
            (highlight_id, user["id"]),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Highlight not found")
    return {"status": "deleted"}


# ── Favorites ────────────────────────────────────────────────────────────

@router.post("/favorites/{book_id}", status_code=201)
async def add_favorite(book_id: int, user: dict = Depends(get_current_user)):
    with get_db_cursor() as cur:
        cur.execute(
            "INSERT INTO user_favorites (user_id, book_id) VALUES (%s, %s) "
            "ON CONFLICT DO NOTHING",
            (user["id"], book_id),
        )
    return {"status": "favorited"}


@router.delete("/favorites/{book_id}")
async def remove_favorite(book_id: int, user: dict = Depends(get_current_user)):
    with get_db_cursor() as cur:
        cur.execute(
            "DELETE FROM user_favorites WHERE user_id = %s AND book_id = %s",
            (user["id"], book_id),
        )
    return {"status": "removed"}


@router.get("/favorites")
async def list_favorites(user: dict = Depends(get_current_user)):
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT b.id, b.slug, b.title, b.cover_image_url, f.created_at AS favorited_at
            FROM user_favorites f
            JOIN books b ON b.id = f.book_id
            WHERE f.user_id = %s
            ORDER BY f.created_at DESC
            """,
            (user["id"],),
        )
        return cur.fetchall()


# ── Preferences ──────────────────────────────────────────────────────────

@router.get("/preferences")
async def get_preferences(user: dict = Depends(get_current_user)):
    with get_db_cursor() as cur:
        cur.execute("SELECT * FROM user_library_preferences WHERE user_id = %s", (user["id"],))
        prefs = cur.fetchone()
        if not prefs:
            cur.execute(
                "INSERT INTO user_library_preferences (user_id) VALUES (%s) RETURNING *",
                (user["id"],),
            )
            prefs = cur.fetchone()
    return prefs


@router.put("/preferences")
async def update_preferences(body: PreferencesUpdate, user: dict = Depends(get_current_user)):
    fields = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not fields:
        raise HTTPException(400, "No fields to update")

    with get_db_cursor() as cur:
        cur.execute("SELECT 1 FROM user_library_preferences WHERE user_id = %s", (user["id"],))
        if not cur.fetchone():
            cur.execute("INSERT INTO user_library_preferences (user_id) VALUES (%s)", (user["id"],))

        set_clause = ", ".join(f"{key} = %s" for key in fields)
        values = list(fields.values()) + [user["id"]]
        cur.execute(
            f"UPDATE user_library_preferences SET {set_clause} WHERE user_id = %s RETURNING *",
            values,
        )
        return cur.fetchone()