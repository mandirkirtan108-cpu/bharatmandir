"""Database-backed multilingual PDF library."""

from __future__ import annotations

import hashlib
import io
import logging
import json
import os
import re
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

import cloudinary.uploader
import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from openai import OpenAI
from pypdf import PdfReader

from db.connection import get_db_cursor
from routers.admin_auth import get_current_admin
from routers.user_auth import decode_token, get_current_user, get_user_by_id
from services.cloudinary_service import _ensure_configured

load_dotenv(
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
    override=False,
)

router = APIRouter(tags=["Library"])
logger = logging.getLogger(__name__)

TARGET_LANGUAGES = {
    "en": "English",
    "hi": "Hindi (Devanagari)",
    "sa": "Sanskrit (Devanagari)",
}
MAX_PDF_BYTES = int(os.getenv("LIBRARY_MAX_PDF_MB", "40")) * 1024 * 1024
TRANSLATION_MODEL = os.getenv("LIBRARY_TRANSLATION_MODEL", "gpt-4.1")
TRANSLATION_WORKERS = max(1, min(int(os.getenv("LIBRARY_TRANSLATION_WORKERS", "4")), 8))
TRANSLATION_TIMEOUT = max(30, int(os.getenv("LIBRARY_TRANSLATION_TIMEOUT_SECONDS", "180")))
TRANSLATION_CHUNK_CHARS = max(4000, int(os.getenv("LIBRARY_TRANSLATION_CHUNK_CHARS", "12000")))
_translation_slots = threading.BoundedSemaphore(TRANSLATION_WORKERS)


def _api_key() -> str:
    return (
        os.getenv("OPENAI_API_KEY")
        or os.getenv("VITE_OPENAI_API_KEY")
        or ""
    ).strip()


def ensure_library_schema() -> None:
    with get_db_cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS library_books (
                id BIGSERIAL PRIMARY KEY,
                slug TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                author TEXT,
                description TEXT,
                source_language TEXT NOT NULL,
                original_filename TEXT NOT NULL,
                original_pdf_url TEXT NOT NULL,
                storage_public_id TEXT,
                file_sha256 TEXT NOT NULL,
                page_count INTEGER NOT NULL DEFAULT 0,
                processed_pages INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'processing'
                    CHECK (status IN ('processing','ready','failed','archived')),
                processing_error TEXT,
                created_by BIGINT REFERENCES admin_users(id),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS library_book_pages (
                id BIGSERIAL PRIMARY KEY,
                book_id BIGINT NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
                page_number INTEGER NOT NULL,
                source_text TEXT NOT NULL,
                text_en TEXT,
                text_hi TEXT,
                text_sa TEXT,
                UNIQUE(book_id, page_number)
            )
        """)
        cur.execute("""
            ALTER TABLE library_books
            ADD COLUMN IF NOT EXISTS processed_pages INTEGER NOT NULL DEFAULT 0
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_library_pages_book
            ON library_book_pages(book_id, page_number)
        """)
        # AI-generated table of contents — one row per detected section/chapter.
        cur.execute("""
            CREATE TABLE IF NOT EXISTS library_book_sections (
                id BIGSERIAL PRIMARY KEY,
                book_id BIGINT NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                page_number INTEGER NOT NULL,
                order_index INTEGER NOT NULL,
                UNIQUE(book_id, page_number)
            )
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_library_sections_book
            ON library_book_sections(book_id, order_index)
        """)
        # Per-user reading progress — one row per (user, book), so Rohit's
        # place in a book never overwrites Tanisha's and vice versa.
        cur.execute("""
            CREATE TABLE IF NOT EXISTS library_reading_progress (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                book_id BIGINT NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
                language TEXT NOT NULL DEFAULT 'en',
                page_number INTEGER NOT NULL DEFAULT 1,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(user_id, book_id)
            )
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_library_progress_user
            ON library_reading_progress(user_id, book_id)
        """)


def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:70] or "book"


def _unique_slug(title: str) -> str:
    base = _slugify(title)
    with get_db_cursor() as cur:
        cur.execute("SELECT slug FROM library_books WHERE slug LIKE %s", (f"{base}%",))
        existing = {row["slug"] for row in cur.fetchall()}
    if base not in existing:
        return base
    number = 2
    while f"{base}-{number}" in existing:
        number += 1
    return f"{base}-{number}"


def _upload_pdf(content: bytes, slug: str) -> dict:
    _ensure_configured()
    result = cloudinary.uploader.upload(
        content,
        resource_type="raw",
        type="upload",
        folder="bharatmandir/library",
        public_id=f"{slug}-{hashlib.sha256(content).hexdigest()[:12]}.pdf",
        overwrite=False,
    )
    return {"url": result["secure_url"], "public_id": result["public_id"]}


def _extract_pages(content: bytes) -> list[str]:
    try:
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            reader.decrypt("")
        pages = []
        for page_number, page in enumerate(reader.pages, 1):
            try:
                pages.append((page.extract_text() or "").strip())
            except Exception as exc:
                raise ValueError(
                    f"Text could not be extracted from PDF page {page_number}. "
                    "Please export the document as a text-based PDF and try again."
                ) from exc
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(
            "The uploaded file is unreadable or password-protected. "
            "Please upload a valid text-based PDF."
        ) from exc

    if not pages:
        raise ValueError("The PDF has no pages.")
    if sum(map(len, pages)) < 20:
        raise ValueError("No usable text was found. Scan-only PDFs require OCR before upload.")
    return pages


def _split_text(text: str) -> list[str]:
    if len(text) <= TRANSLATION_CHUNK_CHARS:
        return [text]
    chunks, remaining = [], text
    while remaining:
        if len(remaining) <= TRANSLATION_CHUNK_CHARS:
            chunks.append(remaining)
            break
        boundary = remaining.rfind("\n\n", 0, TRANSLATION_CHUNK_CHARS)
        if boundary < TRANSLATION_CHUNK_CHARS // 2:
            boundary = remaining.rfind("\n", 0, TRANSLATION_CHUNK_CHARS)
        if boundary < TRANSLATION_CHUNK_CHARS // 2:
            boundary = remaining.rfind(" ", 0, TRANSLATION_CHUNK_CHARS)
        if boundary < 1:
            boundary = TRANSLATION_CHUNK_CHARS
        chunks.append(remaining[:boundary])
        remaining = remaining[boundary:].lstrip("\n")
    return chunks


def _translate_chunk(client: OpenAI, text: str, source_language: str, code: str) -> str:
    if not text.strip():
        return ""
    prompt = f"""Translate this document text from {source_language} to {TARGET_LANGUAGES[code]}.

RULES:
- Translate every heading, sentence, caption, footnote, list item, verse and repetition.
- Never summarize, omit, shorten, explain, censor, modernize, or add commentary.
- Preserve paragraphs, headings, numbering, lists, names and citations.
- Mark only genuinely unreadable fragments as [illegible].
- Return only translated document text without a preface or code fence.

SOURCE TEXT:
{text}"""
    with _translation_slots:
        response = client.responses.create(
            model=TRANSLATION_MODEL,
            input=prompt,
            temperature=0,
            timeout=TRANSLATION_TIMEOUT,
        )
    return response.output_text.strip()


def _translate(client: OpenAI, text: str, source_language: str, code: str) -> str:
    return "\n\n".join(
        _translate_chunk(client, chunk, source_language, code)
        for chunk in _split_text(text)
    )


def _generate_sections(client: OpenAI, book_id: int, page_texts: dict[int, str]) -> None:
    """Ask the model to read through the (English) page text and propose a
    table of contents — chapter/canto/part boundaries with the page each one
    starts on. This is best-effort: any failure here is swallowed so a book
    still finishes processing even if the index can't be generated.
    """
    if not page_texts:
        return
    ordered = sorted(page_texts.items())
    # Bound the prompt size regardless of book length by shrinking the
    # per-page snippet for very long books, rather than dropping pages.
    snippet_len = max(60, min(220, 90000 // max(len(ordered), 1)))
    lines = []
    for page_number, text in ordered:
        snippet = re.sub(r"\s+", " ", (text or "")).strip()[:snippet_len]
        lines.append(f"--- PAGE {page_number} ---\n{snippet}")
    prompt = f"""You are building a clickable table of contents for a digitized book.
Below is the start of every page (truncated), in order.

Identify the natural high-level sections of this book — chapters, parts, cantos (kand), books, or similarly major divisions. Do NOT list minor subheadings, verse numbers, or every page.
- Return between 3 and 40 entries depending on the book's actual structure. If the book is short or has no clear divisions, return as few as make sense (even just 1).
- "page_number" must be the exact page where that section begins, taken from the "PAGE" markers below.
- "title" should be short (a few words), in English, using the book's own naming when evident (e.g. "Bal Kand", "Chapter 3: The Forest").
- Order entries by ascending page_number.

Respond with ONLY a JSON array, no prose, no code fences, in this exact shape:
[{{"title": "...", "page_number": 1}}, ...]

PAGES:
{chr(10).join(lines)}"""

    with _translation_slots:
        response = client.responses.create(
            model=TRANSLATION_MODEL,
            input=prompt,
            temperature=0,
            timeout=TRANSLATION_TIMEOUT,
        )
    raw = response.output_text.strip()
    raw = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    sections = json.loads(raw)
    if not isinstance(sections, list):
        return

    max_page = ordered[-1][0]
    cleaned: list[tuple[str, int]] = []
    seen_pages: set[int] = set()
    for entry in sections:
        if not isinstance(entry, dict):
            continue
        title = str(entry.get("title") or "").strip()
        try:
            page_number = int(entry.get("page_number"))
        except (TypeError, ValueError):
            continue
        if not title or page_number < 1 or page_number > max_page or page_number in seen_pages:
            continue
        seen_pages.add(page_number)
        cleaned.append((title[:200], page_number))
    cleaned.sort(key=lambda item: item[1])
    if not cleaned:
        return

    with get_db_cursor() as cur:
        cur.execute("DELETE FROM library_book_sections WHERE book_id=%s", (book_id,))
        for order_index, (title, page_number) in enumerate(cleaned):
            cur.execute("""
                INSERT INTO library_book_sections (book_id, title, page_number, order_index)
                VALUES (%s,%s,%s,%s)
                ON CONFLICT (book_id, page_number) DO UPDATE SET
                    title=EXCLUDED.title, order_index=EXCLUDED.order_index
            """, (book_id, title, page_number, order_index))


def _process_book(book_id: int, pdf_bytes: bytes, source_language: str) -> None:
    try:
        pages = _extract_pages(pdf_bytes)
        key = _api_key()
        if not key:
            raise RuntimeError(
                "OPENAI_API_KEY is unavailable to the backend. Add it and restart the backend."
            )
        client = OpenAI(api_key=key, timeout=TRANSLATION_TIMEOUT, max_retries=2)

        with get_db_cursor() as cur:
            cur.execute("""
                UPDATE library_books SET page_count=%s, processed_pages=0,
                    processing_error=NULL, updated_at=NOW() WHERE id=%s
            """, (len(pages), book_id))

        def translate_page(page_number: int, source_text: str):
            try:
                translated = {
                    code: _translate(client, source_text, source_language, code)
                    for code in TARGET_LANGUAGES
                }
                return page_number, source_text, translated
            except Exception as exc:
                raise RuntimeError(f"Translation stopped on PDF page {page_number}: {exc}") from exc

        page_text_en: dict[int, str] = {}
        with ThreadPoolExecutor(max_workers=TRANSLATION_WORKERS) as executor:
            jobs = [
                executor.submit(translate_page, number, text)
                for number, text in enumerate(pages, 1)
            ]
            for job in as_completed(jobs):
                page_number, source_text, translated = job.result()
                page_text_en[page_number] = translated["en"]
                with get_db_cursor() as cur:
                    cur.execute("""
                        INSERT INTO library_book_pages
                            (book_id,page_number,source_text,text_en,text_hi,text_sa)
                        VALUES (%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (book_id,page_number) DO UPDATE SET
                            source_text=EXCLUDED.source_text,
                            text_en=EXCLUDED.text_en,
                            text_hi=EXCLUDED.text_hi,
                            text_sa=EXCLUDED.text_sa
                    """, (
                        book_id, page_number, source_text, translated["en"],
                        translated["hi"], translated["sa"],
                    ))
                    cur.execute("""
                        UPDATE library_books SET processed_pages=processed_pages+1,
                            updated_at=NOW() WHERE id=%s
                    """, (book_id,))

        # Best-effort: build the AI table of contents. Never let a hiccup here
        # (bad JSON, model timeout, etc.) stop the book from going live.
        try:
            _generate_sections(client, book_id, page_text_en)
        except Exception:
            pass

        with get_db_cursor() as cur:
            cur.execute("""
                UPDATE library_books SET status='ready', page_count=%s,
                    processed_pages=%s, processing_error=NULL, updated_at=NOW()
                WHERE id=%s
            """, (len(pages), len(pages), book_id))
    except Exception as exc:
        with get_db_cursor() as cur:
            cur.execute("""
                UPDATE library_books SET status='failed', processing_error=%s,
                    updated_at=NOW() WHERE id=%s
            """, (str(exc)[:2000], book_id))


BOOK_SELECT = """
SELECT id,slug,title,author,description,source_language,original_filename,
       original_pdf_url,page_count,processed_pages,status,processing_error,
       created_at,updated_at
FROM library_books
"""


@router.get("/api/books")
def list_books():
    with get_db_cursor() as cur:
        cur.execute(BOOK_SELECT + " WHERE status='ready' ORDER BY created_at DESC")
        return {"books": [dict(row) for row in cur.fetchall()]}


@router.get("/api/books/{slug}")
def get_book(slug: str):
    with get_db_cursor() as cur:
        cur.execute(BOOK_SELECT + " WHERE slug=%s AND status='ready'", (slug,))
        book = cur.fetchone()
    if not book:
        raise HTTPException(404, "Book not found")
    return dict(book)


@router.get("/api/books/{slug}/pages")
def get_pages(
    slug: str,
    language: str = Query("en", pattern="^(en|hi|sa|original)$"),
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=25),
):
    column = {"en": "text_en", "hi": "text_hi", "sa": "text_sa", "original": "source_text"}[language]
    with get_db_cursor() as cur:
        cur.execute("SELECT id,page_count FROM library_books WHERE slug=%s AND status='ready'", (slug,))
        book = cur.fetchone()
        if not book:
            raise HTTPException(404, "Book not found")
        cur.execute(f"""
            SELECT page_number,{column} AS text FROM library_book_pages
            WHERE book_id=%s ORDER BY page_number LIMIT %s OFFSET %s
        """, (book["id"], per_page, (page - 1) * per_page))
        pages = [dict(row) for row in cur.fetchall()]
    return {"pages": pages, "page": page, "per_page": per_page, "total_pages": book["page_count"]}


@router.get("/api/books/{slug}/sections")
def get_sections(slug: str):
    """AI-generated table of contents for the reader's chapter/section jump menu."""
    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM library_books WHERE slug=%s AND status='ready'", (slug,))
        book = cur.fetchone()
        if not book:
            raise HTTPException(404, "Book not found")
        cur.execute("""
            SELECT title, page_number FROM library_book_sections
            WHERE book_id=%s ORDER BY order_index
        """, (book["id"],))
        sections = [dict(row) for row in cur.fetchall()]
    return {"sections": sections}


_optional_bearer = HTTPBearer(auto_error=False)


def get_optional_user(credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer)) -> dict | None:
    """Same as user_auth.get_current_user, but returns None instead of 401
    when there's no/invalid token — so guests can still read books, they
    just won't get progress saved/restored."""
    if not credentials:
        return None
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = get_user_by_id(int(user_id))
        if not user or not user.get("is_active"):
            return None
        return user
    except Exception:
        return None


@router.get("/api/books/{slug}/progress")
def get_progress(slug: str, user: dict | None = Depends(get_optional_user)):
    """Returns this user's saved place in the book, or null for guests /
    users who haven't read this book before."""
    if not user:
        return {"progress": None}
    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM library_books WHERE slug=%s AND status='ready'", (slug,))
        book = cur.fetchone()
        if not book:
            raise HTTPException(404, "Book not found")
        cur.execute("""
            SELECT language, page_number, updated_at FROM library_reading_progress
            WHERE user_id=%s AND book_id=%s
        """, (user["id"], book["id"]))
        row = cur.fetchone()
    return {"progress": dict(row) if row else None}


@router.put("/api/books/{slug}/progress")
def save_progress(slug: str, payload: dict = Body(...), user: dict = Depends(get_current_user)):
    """Saves/updates where this logged-in user is in the book. Each user has
    their own row, so Rohit's progress and Tanisha's progress never collide."""
    language = str(payload.get("language") or "en")
    if language not in {"en", "hi", "sa", "original"}:
        raise HTTPException(422, "Unsupported language")
    try:
        page_number = int(payload.get("page_number"))
    except (TypeError, ValueError):
        raise HTTPException(422, "page_number is required")

    with get_db_cursor() as cur:
        cur.execute("SELECT id,page_count FROM library_books WHERE slug=%s AND status='ready'", (slug,))
        book = cur.fetchone()
        if not book:
            raise HTTPException(404, "Book not found")
        if book["page_count"]:
            page_number = max(1, min(page_number, book["page_count"]))
        else:
            page_number = max(1, page_number)
        cur.execute("""
            INSERT INTO library_reading_progress (user_id, book_id, language, page_number, updated_at)
            VALUES (%s,%s,%s,%s,NOW())
            ON CONFLICT (user_id, book_id) DO UPDATE SET
                language=EXCLUDED.language, page_number=EXCLUDED.page_number, updated_at=NOW()
        """, (user["id"], book["id"], language, page_number))
    return {"status": "saved", "language": language, "page_number": page_number}


@router.get("/api/books/{slug}/search")
def search_book(slug: str, q: str = Query(..., min_length=2), language: str = "en"):
    column = {"en": "text_en", "hi": "text_hi", "sa": "text_sa", "original": "source_text"}.get(language)
    if not column:
        raise HTTPException(422, "Unsupported language")
    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM library_books WHERE slug=%s AND status='ready'", (slug,))
        book = cur.fetchone()
        if not book:
            raise HTTPException(404, "Book not found")
        cur.execute(f"""
            SELECT page_number,{column} AS text FROM library_book_pages
            WHERE book_id=%s AND {column} ILIKE %s ORDER BY page_number LIMIT 50
        """, (book["id"], f"%{q}%"))
        results = [dict(row) for row in cur.fetchall()]
    return {"results": results}


@router.post("/api/admin/books", status_code=202)
async def upload_book(
    title: str = Form(...),
    author: str = Form(""),
    description: str = Form(""),
    source_language: str = Form(...),
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin),
):
    if file.content_type != "application/pdf" and not file.filename.lower().endswith(".pdf"):
        raise HTTPException(415, "Only PDF files are accepted")

    try:
        content = await file.read(MAX_PDF_BYTES + 1)
    except Exception as exc:
        logger.exception("Could not read uploaded library PDF")
        raise HTTPException(400, "The uploaded PDF could not be read. Please select it again.") from exc

    if not content or len(content) > MAX_PDF_BYTES:
        raise HTTPException(413, f"PDF must be smaller than {MAX_PDF_BYTES // 1024 // 1024} MB")

    try:
        pages = _extract_pages(content)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    if not _api_key():
        raise HTTPException(
            503,
            "OPENAI_API_KEY is not configured on the backend. "
            "Add it in Railway Variables and redeploy.",
        )

    try:
        slug = _unique_slug(title)
    except Exception as exc:
        logger.exception("Could not prepare a unique library book slug")
        raise HTTPException(503, "The library database is currently unavailable.") from exc

    try:
        uploaded = _upload_pdf(content, slug)
    except Exception as exc:
        logger.exception("Cloudinary PDF upload failed for %s", file.filename)
        raise HTTPException(
            502,
            "PDF storage upload failed. Check the Cloudinary credentials and "
            "whether raw PDF delivery is enabled.",
        ) from exc

    try:
        with get_db_cursor() as cur:
            cur.execute("""
                INSERT INTO library_books
                    (slug,title,author,description,source_language,original_filename,
                     original_pdf_url,storage_public_id,file_sha256,page_count,created_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
            """, (
                slug, title.strip(), author.strip() or None, description.strip() or None,
                source_language.strip(), file.filename, uploaded["url"], uploaded["public_id"],
                hashlib.sha256(content).hexdigest(), len(pages), admin["id"],
            ))
            book_id = cur.fetchone()["id"]
    except Exception as exc:
        logger.exception("Could not save uploaded library book metadata")
        try:
            cloudinary.uploader.destroy(uploaded["public_id"], resource_type="raw")
        except Exception:
            logger.warning("Could not remove orphaned Cloudinary PDF", exc_info=True)
        raise HTTPException(
            503,
            "The PDF was uploaded, but its library record could not be saved. "
            "Please check the database schema and try again.",
        ) from exc

    threading.Thread(
        target=_process_book,
        args=(book_id, content, source_language),
        daemon=True,
        name=f"library-book-{book_id}",
    ).start()
    return {"id": book_id, "slug": slug, "status": "processing"}


@router.get("/api/admin/books")
def admin_list_books(admin: dict = Depends(get_current_admin)):
    with get_db_cursor() as cur:
        cur.execute(BOOK_SELECT + " WHERE status<>'archived' ORDER BY created_at DESC")
        return {"books": [dict(row) for row in cur.fetchall()]}


@router.delete("/api/admin/books/{book_id}")
def archive_book(book_id: int, admin: dict = Depends(get_current_admin)):
    with get_db_cursor() as cur:
        cur.execute("""
            UPDATE library_books SET status='archived',updated_at=NOW()
            WHERE id=%s AND status<>'archived' RETURNING id
        """, (book_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Book not found")
    return {"status": "archived"}


@router.post("/api/admin/books/{book_id}/retry", status_code=202)
def retry_book(book_id: int, admin: dict = Depends(get_current_admin)):
    if not _api_key():
        raise HTTPException(503, "OpenAI key is unavailable to the backend process.")
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id,original_pdf_url,source_language FROM library_books
            WHERE id=%s AND status='failed'
        """, (book_id,))
        book = cur.fetchone()
    if not book:
        raise HTTPException(404, "Failed book not found")
    try:
        response = httpx.get(book["original_pdf_url"], timeout=60, follow_redirects=True)
        response.raise_for_status()
        pdf_bytes = response.content
        _extract_pages(pdf_bytes)
    except Exception as exc:
        raise HTTPException(502, f"Could not retrieve the original PDF: {exc}") from exc
    with get_db_cursor() as cur:
        cur.execute("DELETE FROM library_book_pages WHERE book_id=%s", (book_id,))
        cur.execute("""
            UPDATE library_books SET status='processing',processed_pages=0,
                processing_error=NULL,updated_at=NOW() WHERE id=%s
        """, (book_id,))
    threading.Thread(
        target=_process_book,
        args=(book_id, pdf_bytes, book["source_language"]),
        daemon=True,
        name=f"library-book-retry-{book_id}",
    ).start()
    return {"id": book_id, "status": "processing"}
