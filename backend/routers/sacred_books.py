"""Database-backed, multilingual PDF library.

Public routes deliberately retain the existing /api/books namespace.
Admin routes upload a PDF and start a faithful, page-preserving translation
job. Binary files live in object storage; searchable structured text lives in
PostgreSQL.
"""

from __future__ import annotations

import hashlib
import io
import os
import re
import threading

import cloudinary.uploader
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from openai import OpenAI
from pypdf import PdfReader

from db.connection import get_db_cursor
from routers.admin_auth import get_current_admin
from services.cloudinary_service import _ensure_configured

router = APIRouter(tags=["Library"])

TARGET_LANGUAGES = {
    "en": "English",
    "hi": "Hindi (Devanagari)",
    "sa": "Sanskrit (Devanagari)",
}
MAX_PDF_BYTES = int(os.getenv("LIBRARY_MAX_PDF_MB", "40")) * 1024 * 1024
TRANSLATION_MODEL = os.getenv("LIBRARY_TRANSLATION_MODEL", "gpt-4.1")


def ensure_library_schema() -> None:
    """Idempotent migration, safe to run at application startup."""
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
            CREATE INDEX IF NOT EXISTS idx_library_pages_book
            ON library_book_pages(book_id, page_number)
        """)


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:70] or "book"


def _unique_slug(title: str) -> str:
    base = _slugify(title)
    with get_db_cursor() as cur:
        cur.execute("SELECT slug FROM library_books WHERE slug LIKE %s", (f"{base}%",))
        existing = {row["slug"] for row in cur.fetchall()}
    if base not in existing:
        return base
    index = 2
    while f"{base}-{index}" in existing:
        index += 1
    return f"{base}-{index}"


def _upload_pdf(content: bytes, filename: str, slug: str) -> dict:
    _ensure_configured()
    result = cloudinary.uploader.upload(
        content,
        resource_type="raw",
        type="upload",
        folder="bharatmandir/library",
        public_id=f"{slug}-{hashlib.sha256(content).hexdigest()[:12]}.pdf",
        overwrite=False,
        use_filename=False,
    )
    return {"url": result["secure_url"], "public_id": result["public_id"]}


def _extract_pages(content: bytes) -> list[str]:
    try:
        reader = PdfReader(io.BytesIO(content))
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
    if sum(len(page) for page in pages) < 20:
        raise ValueError(
            "No usable text was found. Scan-only PDFs must be OCR-processed before upload."
        )
    return pages


def _translate(client: OpenAI, text: str, source_language: str, target_code: str) -> str:
    if not text.strip():
        return ""
    target = TARGET_LANGUAGES[target_code]
    prompt = f"""Translate the source document text from {source_language} to {target}.

NON-NEGOTIABLE RULES:
- Translate every sentence, heading, caption, footnote, list item, verse, and page marker.
- Do not summarize, omit, shorten, censor, explain, modernize, or add commentary.
- Preserve paragraph breaks, headings, list structure, numbering, names, citations, and repetitions.
- Keep unclear or damaged source passages visible, marking only the unclear fragment as [illegible].
- Return only the translated document text, with no preface and no Markdown code fence.

SOURCE TEXT:
{text}"""
    response = client.responses.create(
        model=TRANSLATION_MODEL,
        input=prompt,
        temperature=0,
    )
    return response.output_text.strip()


def _process_book(book_id: int, pdf_bytes: bytes, source_language: str) -> None:
    try:
        pages = _extract_pages(pdf_bytes)
        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        for page_number, source_text in enumerate(pages, 1):
            translations = {
                code: _translate(client, source_text, source_language, code)
                for code in TARGET_LANGUAGES
            }
            with get_db_cursor() as cur:
                cur.execute("""
                    INSERT INTO library_book_pages
                        (book_id, page_number, source_text, text_en, text_hi, text_sa)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (book_id, page_number) DO UPDATE SET
                        source_text=EXCLUDED.source_text, text_en=EXCLUDED.text_en,
                        text_hi=EXCLUDED.text_hi, text_sa=EXCLUDED.text_sa
                """, (
                    book_id, page_number, source_text,
                    translations["en"], translations["hi"], translations["sa"],
                ))
        with get_db_cursor() as cur:
            cur.execute("""
                UPDATE library_books
                SET status='ready', page_count=%s, processing_error=NULL, updated_at=NOW()
                WHERE id=%s
            """, (len(pages), book_id))
    except Exception as exc:
        with get_db_cursor() as cur:
            cur.execute("""
                UPDATE library_books
                SET status='failed', processing_error=%s, updated_at=NOW()
                WHERE id=%s
            """, (str(exc)[:2000], book_id))


BOOK_SELECT = """
    SELECT id, slug, title, author, description, source_language,
           original_filename, original_pdf_url, page_count, status,
           processing_error, created_at, updated_at
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
        cur.execute("SELECT id, page_count FROM library_books WHERE slug=%s AND status='ready'", (slug,))
        book = cur.fetchone()
        if not book:
            raise HTTPException(404, "Book not found")
        cur.execute(f"""
            SELECT page_number, {column} AS text
            FROM library_book_pages WHERE book_id=%s
            ORDER BY page_number LIMIT %s OFFSET %s
        """, (book["id"], per_page, (page - 1) * per_page))
        pages = [dict(row) for row in cur.fetchall()]
    return {"pages": pages, "page": page, "per_page": per_page, "total_pages": book["page_count"]}


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
            SELECT page_number, {column} AS text FROM library_book_pages
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
    try:
        _extract_pages(content)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    slug = _unique_slug(title)
    uploaded = _upload_pdf(content, file.filename, slug)
    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO library_books
                (slug, title, author, description, source_language, original_filename,
                 original_pdf_url, storage_public_id, file_sha256, created_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        """, (
            slug, title.strip(), author.strip() or None, description.strip() or None,
            source_language.strip(), file.filename, uploaded["url"], uploaded["public_id"],
            hashlib.sha256(content).hexdigest(), admin["id"],
        ))
        book_id = cur.fetchone()["id"]

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
        cur.execute(BOOK_SELECT + " WHERE status <> 'archived' ORDER BY created_at DESC")
        return {"books": [dict(row) for row in cur.fetchall()]}


@router.delete("/api/admin/books/{book_id}")
def archive_book(book_id: int, admin: dict = Depends(get_current_admin)):
    with get_db_cursor() as cur:
        cur.execute("""
            UPDATE library_books SET status='archived', updated_at=NOW()
            WHERE id=%s AND status <> 'archived' RETURNING id
        """, (book_id,))
        if not cur.fetchone():
            raise HTTPException(404, "Book not found")
    return {"status": "archived"}