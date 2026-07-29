"""Database-backed multilingual PDF library."""

from __future__ import annotations

import asyncio
import hashlib
import json
import os
import re
import tempfile
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import cloudinary.uploader
from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from openai import OpenAI
from pypdf import PdfReader

try:
    import fitz  # PyMuPDF — used to render each page to an image so embedded
    #                        illustrations/diagrams survive exactly as printed.
except ImportError:  # pragma: no cover - optional at runtime, degrades gracefully
    fitz = None

from db.connection import get_db_cursor
from routers.admin_auth import get_current_admin
from routers.user_auth import decode_token, get_current_user, get_user_by_id
from services.cloudinary_service import _ensure_configured

load_dotenv(
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
    override=False,
)

router = APIRouter(tags=["Library"])

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
PAGE_IMAGE_DPI = max(72, int(os.getenv("LIBRARY_PAGE_IMAGE_DPI", "150")))
_translation_slots = threading.BoundedSemaphore(TRANSLATION_WORKERS)

# Original PDFs are never kept permanently — a book only needs its raw file
# on disk for the duration of extraction/translation. This directory lives
# on Railway's local (ephemeral) container disk and every file in it is
# deleted the moment processing finishes, whether it succeeds or fails.
LIBRARY_TMP_DIR = Path(os.getenv("LIBRARY_TMP_DIR") or tempfile.gettempdir()) / "bharatmandir-library"


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
                original_pdf_url TEXT,
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
                page_image_url TEXT,
                UNIQUE(book_id, page_number)
            )
        """)
        cur.execute("""
            ALTER TABLE library_books
            ADD COLUMN IF NOT EXISTS processed_pages INTEGER NOT NULL DEFAULT 0
        """)
        # The original PDF is no longer stored permanently (see LIBRARY_TMP_DIR
        # below), so this column is no longer always populated. Relax the
        # constraint for databases created before this change.
        cur.execute("""
            ALTER TABLE library_books
            ALTER COLUMN original_pdf_url DROP NOT NULL
        """)
        cur.execute("""
            ALTER TABLE library_book_pages
            ADD COLUMN IF NOT EXISTS page_image_url TEXT
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
        # Per-user bookmarks — a reader can save any number of pages in a
        # book. Scoped to user_id (not a device/browser), so Rohit's
        # bookmarks and Tanisha's bookmarks stay separate and each follows
        # their own account across every device they log in on.
        cur.execute("""
            CREATE TABLE IF NOT EXISTS library_bookmarks (
                id BIGSERIAL PRIMARY KEY,
                user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                book_id BIGINT NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
                page_number INTEGER NOT NULL,
                language TEXT NOT NULL DEFAULT 'en',
                label TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE(user_id, book_id, page_number)
            )
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_library_bookmarks_user
            ON library_bookmarks(user_id, book_id)
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


def _write_temp_pdf(content: bytes) -> Path:
    """Write the uploaded PDF to local disk just long enough to process it.

    This replaces permanent Cloudinary storage of the raw PDF — the file
    only needs to exist for the lifetime of one upload's extraction +
    translation run, so it's written under LIBRARY_TMP_DIR and always
    removed afterwards via _cleanup_temp_pdf(), success or failure.
    """
    LIBRARY_TMP_DIR.mkdir(parents=True, exist_ok=True)
    path = LIBRARY_TMP_DIR / f"{uuid.uuid4().hex}.pdf"
    path.write_bytes(content)
    return path


def _cleanup_temp_pdf(path: Path) -> None:
    """Best-effort delete of a temp PDF. Never let cleanup failure mask a
    real processing error or crash a background thread."""
    try:
        path.unlink(missing_ok=True)
    except Exception:
        pass


def _upload_page_image(image_bytes: bytes, slug: str, page_number: int) -> str:
    """Upload a rendered page image, keeping every diagram/illustration on that
    page exactly as it appears in the original PDF."""
    _ensure_configured()
    result = cloudinary.uploader.upload(
        image_bytes,
        resource_type="image",
        folder=f"bharatmandir/library/{slug}/pages",
        public_id=f"page-{page_number:04d}",
        overwrite=True,
    )
    return result["secure_url"]


def _quick_page_count(pdf_path: Path) -> int:
    """Fast upload-time check: is this a readable, non-empty, non-password
    -protected PDF? Only opens the PDF and counts pages — does NOT call
    extract_text() on every page, which is the slow part for large books
    and is exactly what made big uploads block the request until the proxy
    gave up. Full text extraction still happens in the background job.
    """
    try:
        reader = PdfReader(str(pdf_path))
    except Exception as exc:
        raise ValueError("The uploaded file is not a readable PDF.") from exc
    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception as exc:
            raise ValueError("Password-protected PDFs are not supported.") from exc
    page_count = len(reader.pages)
    if page_count == 0:
        raise ValueError("The PDF has no pages.")
    return page_count


def _extract_pages(pdf_path: Path) -> list[str]:
    try:
        reader = PdfReader(str(pdf_path))
    except Exception as exc:
        raise ValueError("The uploaded file is not a readable PDF.") from exc
    if reader.is_encrypted:
        try:
            reader.decrypt("")
        except Exception as exc:
            raise ValueError("Password-protected PDFs are not supported.") from exc
    pages = [(page.extract_text() or "").strip() for page in reader.pages]
    if not pages:
        raise ValueError("The PDF has no pages.")
    if sum(map(len, pages)) < 20:
        raise ValueError("No usable text was found. Scan-only PDFs require OCR before upload.")
    return pages


def _render_page_images(pdf_path: Path) -> list[bytes | None]:
    """Render every PDF page to a PNG at PAGE_IMAGE_DPI so embedded pictures,
    diagrams, and layout are preserved exactly as printed — not just the text.
    Returns one entry per page; entries are None only if rendering is
    unavailable, in which case the rest of the book still processes normally.
    """
    if fitz is None:
        return []
    images: list[bytes | None] = []
    doc = fitz.open(str(pdf_path))
    try:
        zoom = PAGE_IMAGE_DPI / 72
        matrix = fitz.Matrix(zoom, zoom)
        for page in doc:
            try:
                pix = page.get_pixmap(matrix=matrix, alpha=False)
                images.append(pix.tobytes("png"))
            except Exception:
                images.append(None)
    finally:
        doc.close()
    return images


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


def _process_book(book_id: int, slug: str, pdf_path: Path, source_language: str) -> None:
    print(f"[library] book {book_id}: processing started (file={pdf_path.name})")
    try:
        pages = _extract_pages(pdf_path)
        print(f"[library] book {book_id}: extracted {len(pages)} pages of text")

        key = _api_key()
        if not key:
            raise RuntimeError(
                "OPENAI_API_KEY is unavailable to the backend. Add it and restart the backend."
            )
        client = OpenAI(api_key=key, timeout=TRANSLATION_TIMEOUT, max_retries=2)

        # Render page images up front. If PyMuPDF isn't installed, or a
        # specific page fails to rasterize, translation still proceeds —
        # those pages simply won't have a preserved scan.
        try:
            page_images = _render_page_images(pdf_path)
        except Exception:
            page_images = []
        if len(page_images) != len(pages):
            page_images = [None] * len(pages)
        print(f"[library] book {book_id}: rendered {sum(1 for i in page_images if i)}/{len(pages)} page images")

        with get_db_cursor() as cur:
            cur.execute("""
                UPDATE library_books SET page_count=%s, processed_pages=0,
                    processing_error=NULL, updated_at=NOW() WHERE id=%s
            """, (len(pages), book_id))

        def translate_page(page_number: int, source_text: str, image_bytes: bytes | None):
            print(f"[library] book {book_id}: page {page_number} — calling OpenAI ({TRANSLATION_MODEL}) for en/hi/sa")
            page_started = datetime.utcnow()
            try:
                translated = {
                    code: _translate(client, source_text, source_language, code)
                    for code in TARGET_LANGUAGES
                }
                elapsed = (datetime.utcnow() - page_started).total_seconds()
                print(f"[library] book {book_id}: page {page_number} — translated in {elapsed:.1f}s")
                image_url = None
                if image_bytes:
                    try:
                        image_url = _upload_page_image(image_bytes, slug, page_number)
                    except Exception:
                        image_url = None  # keep the book processing even if one upload fails
                return page_number, source_text, translated, image_url
            except Exception as exc:
                elapsed = (datetime.utcnow() - page_started).total_seconds()
                print(
                    f"[library] book {book_id}: page {page_number} FAILED after {elapsed:.1f}s "
                    f"— {type(exc).__name__}: {exc}"
                )
                raise RuntimeError(f"Translation stopped on PDF page {page_number}: {exc}") from exc

        page_text_en: dict[int, str] = {}
        with ThreadPoolExecutor(max_workers=TRANSLATION_WORKERS) as executor:
            jobs = [
                executor.submit(translate_page, number, text, page_images[number - 1])
                for number, text in enumerate(pages, 1)
            ]
            for job in as_completed(jobs):
                page_number, source_text, translated, image_url = job.result()
                page_text_en[page_number] = translated["en"]
                with get_db_cursor() as cur:
                    cur.execute("""
                        INSERT INTO library_book_pages
                            (book_id,page_number,source_text,text_en,text_hi,text_sa,page_image_url)
                        VALUES (%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (book_id,page_number) DO UPDATE SET
                            source_text=EXCLUDED.source_text,
                            text_en=EXCLUDED.text_en,
                            text_hi=EXCLUDED.text_hi,
                            text_sa=EXCLUDED.text_sa,
                            page_image_url=EXCLUDED.page_image_url
                    """, (
                        book_id, page_number, source_text, translated["en"],
                        translated["hi"], translated["sa"], image_url,
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
        print(f"[library] book {book_id}: DONE — status=ready, {len(pages)} pages")
    except Exception as exc:
        print(f"[library] book {book_id}: FAILED — {type(exc).__name__}: {exc}")
        with get_db_cursor() as cur:
            cur.execute("""
                UPDATE library_books SET status='failed', processing_error=%s,
                    updated_at=NOW() WHERE id=%s
            """, (str(exc)[:2000], book_id))


def _process_and_cleanup(book_id: int, slug: str, pdf_path: Path, source_language: str) -> None:
    """Runs entirely in a background thread, off the request/response cycle.

    The PDF is no longer uploaded to Cloudinary or kept anywhere permanent —
    it was already written to LIBRARY_TMP_DIR (local Railway disk) by the
    upload endpoint before this thread started. This function processes
    directly from that temp file and unconditionally deletes it afterwards,
    whether processing succeeds or fails, so nothing outlives one book's
    extraction + translation run.
    """
    try:
        _process_book(book_id, slug, pdf_path, source_language)
    finally:
        _cleanup_temp_pdf(pdf_path)
        print(f"[library] book {book_id}: temp file cleaned up ({pdf_path.name})")


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
            SELECT page_number,{column} AS text,page_image_url FROM library_book_pages
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


@router.get("/api/library/progress")
def list_all_progress(user: dict | None = Depends(get_optional_user)):
    """This logged-in user's reading progress across every book in the
    library, keyed by slug — powers the "Continue reading" badges on the
    shelf. Read from the same library_reading_progress table the reader
    page writes to, so it's the identical progress on every device this
    person signs into. Guests get an empty list."""
    if not user:
        return {"progress": []}
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT b.slug, p.language, p.page_number, b.page_count, p.updated_at
            FROM library_reading_progress p
            JOIN library_books b ON b.id = p.book_id
            WHERE p.user_id=%s AND b.status='ready'
        """, (user["id"],))
        rows = [dict(r) for r in cur.fetchall()]
    for row in rows:
        page_count = row.get("page_count") or 0
        row["percent"] = round(min(100, (row["page_number"] / page_count) * 100)) if page_count else 0
    return {"progress": rows}


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


@router.get("/api/books/{slug}/bookmarks")
def list_bookmarks(slug: str, user: dict | None = Depends(get_optional_user)):
    """This user's saved bookmarks for the book, in page order. Guests get
    an empty list — bookmarks are per-account, same as reading progress."""
    if not user:
        return {"bookmarks": []}
    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM library_books WHERE slug=%s AND status='ready'", (slug,))
        book = cur.fetchone()
        if not book:
            raise HTTPException(404, "Book not found")
        cur.execute("""
            SELECT id, page_number, language, label, created_at
            FROM library_bookmarks WHERE user_id=%s AND book_id=%s
            ORDER BY page_number
        """, (user["id"], book["id"]))
        bookmarks = [dict(row) for row in cur.fetchall()]
    return {"bookmarks": bookmarks}


@router.post("/api/books/{slug}/bookmarks", status_code=201)
def create_bookmark(slug: str, payload: dict = Body(...), user: dict = Depends(get_current_user)):
    """Saves a bookmark at the given page for this logged-in user. Stored
    under their user_id (not a device id), so it shows up the same way on
    any device they sign into."""
    try:
        page_number = int(payload.get("page_number"))
    except (TypeError, ValueError):
        raise HTTPException(422, "page_number is required")
    language = str(payload.get("language") or "en")
    if language not in {"en", "hi", "sa", "original"}:
        raise HTTPException(422, "Unsupported language")
    label = (payload.get("label") or "").strip() or None

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
            INSERT INTO library_bookmarks (user_id, book_id, page_number, language, label)
            VALUES (%s,%s,%s,%s,%s)
            ON CONFLICT (user_id, book_id, page_number) DO UPDATE SET
                language=EXCLUDED.language, label=EXCLUDED.label
            RETURNING id, page_number, language, label, created_at
        """, (user["id"], book["id"], page_number, language, label))
        row = cur.fetchone()
    return {"bookmark": dict(row)}


@router.delete("/api/books/{slug}/bookmarks/{bookmark_id}")
def delete_bookmark(slug: str, bookmark_id: int, user: dict = Depends(get_current_user)):
    """Removes one of this user's own bookmarks. Scoped by user_id so nobody
    can delete another account's bookmark by guessing an id."""
    with get_db_cursor() as cur:
        cur.execute("""
            DELETE FROM library_bookmarks WHERE id=%s AND user_id=%s RETURNING id
        """, (bookmark_id, user["id"]))
        if not cur.fetchone():
            raise HTTPException(404, "Bookmark not found")
    return {"status": "deleted"}


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
            SELECT page_number,{column} AS text,page_image_url FROM library_book_pages
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
    content = await file.read(MAX_PDF_BYTES + 1)
    if not content or len(content) > MAX_PDF_BYTES:
        raise HTTPException(413, f"PDF must be smaller than {MAX_PDF_BYTES // 1024 // 1024} MB")

    file_sha256 = hashlib.sha256(content).hexdigest()

    # Write the PDF to local (Railway) disk once, up front. Everything after
    # this — the quick page-count check and the full background processing
    # job — reads from this temp file. It is never uploaded to Cloudinary or
    # kept anywhere permanent; _process_and_cleanup() deletes it once the
    # book finishes processing (success or failure).
    pdf_path = await asyncio.to_thread(_write_temp_pdf, content)
    del content  # the temp file is now the only copy we need going forward

    try:
        # Just count pages here — full per-page text extraction is slow for
        # large books and happens in the background job below. Doing it here
        # (synchronously, inside an async route) used to stall the event loop
        # long enough for the reverse proxy to kill the connection, which is
        # what showed up as "Failed to fetch" on bigger PDFs.
        page_count = await asyncio.to_thread(_quick_page_count, pdf_path)
    except ValueError as exc:
        _cleanup_temp_pdf(pdf_path)
        raise HTTPException(422, str(exc)) from exc

    slug = _unique_slug(title)

    # Insert a placeholder row right away (no original_pdf_url — the PDF
    # only ever exists temporarily on local disk, see LIBRARY_TMP_DIR) so
    # the admin panel shows the book as "processing" immediately. Full
    # extraction/translation happens in the background thread below, right
    # after this returns, so the response always comes back fast regardless
    # of file size.
    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO library_books
                (slug,title,author,description,source_language,original_filename,
                 original_pdf_url,storage_public_id,file_sha256,page_count,created_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        """, (
            slug, title.strip(), author.strip() or None, description.strip() or None,
            source_language.strip(), file.filename, None, None,
            file_sha256, page_count, admin["id"],
        ))
        book_id = cur.fetchone()["id"]

    threading.Thread(
        target=_process_and_cleanup,
        args=(book_id, slug, pdf_path, source_language),
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
    """Retrying a failed book used to re-download the original PDF from
    Cloudinary and reprocess it. Since the PDF is no longer stored anywhere
    after its first (and only) processing run — see LIBRARY_TMP_DIR — there
    is nothing left to retry from. The admin needs to re-upload the file,
    which starts a fresh processing run from scratch.
    """
    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM library_books WHERE id=%s AND status='failed'", (book_id,))
        book = cur.fetchone()
    if not book:
        raise HTTPException(404, "Failed book not found")
    raise HTTPException(
        409,
        "The original PDF isn't kept in storage, so failed books can't be "
        "automatically retried. Please delete this entry and upload the file again.",
    )