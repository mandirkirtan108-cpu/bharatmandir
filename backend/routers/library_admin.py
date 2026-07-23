"""
Admin endpoints for the Sacred Books Library — upload, extract, translate,
publish. Mirrors the auth/upload/error-handling conventions already used
in routers/admin.py.
"""

import json
import re
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile

from db.connection import get_db_connection, get_db_cursor
from models.library import BookUpdate, TranslationTriggerRequest
from routers.admin_auth import get_current_admin, require_editor_or_above
from services import library_storage
from services.pdf_service import extract_pdf_text, structure_page_text
from services.translation_service import chunk_pages, translate_page_batch

router = APIRouter(prefix="/api/admin/library", tags=["Admin - Library"])

ALLOWED_PDF_TYPES = {"application/pdf"}
MAX_PDF_SIZE = 100 * 1024 * 1024  # 100 MB
ALLOWED_COVER_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_COVER_SIZE = 10 * 1024 * 1024  # 10 MB


def _slugify(title: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    return slug or "book"


# ── Upload & create ─────────────────────────────────────────────────────

@router.post("/books", status_code=201)
async def create_book(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    subtitle: str | None = Form(None),
    author: str | None = Form(None),
    original_language: str = Form("en"),
    description: str | None = Form(None),
    category_id: int | None = Form(None),
    pdf_file: UploadFile = File(...),
    cover_image: UploadFile | None = File(None),
    admin: dict = Depends(require_editor_or_above),
):
    if pdf_file.content_type not in ALLOWED_PDF_TYPES:
        raise HTTPException(400, "Only PDF files are accepted for pdf_file")

    pdf_bytes = await pdf_file.read()
    if len(pdf_bytes) > MAX_PDF_SIZE:
        raise HTTPException(400, "PDF too large — max 100 MB")

    base_slug = _slugify(title)

    # Ensure slug uniqueness by suffixing if needed.
    with get_db_cursor() as cur:
        cur.execute("SELECT slug FROM books WHERE slug LIKE %s", (f"{base_slug}%",))
        existing = {row["slug"] for row in cur.fetchall()}
    slug = base_slug
    suffix = 2
    while slug in existing:
        slug = f"{base_slug}-{suffix}"
        suffix += 1

    pdf_upload = library_storage.upload_book_pdf(pdf_bytes, slug)

    cover_upload = None
    if cover_image is not None:
        if cover_image.content_type not in ALLOWED_COVER_TYPES:
            raise HTTPException(400, "Cover must be JPEG, PNG, or WebP")
        cover_bytes = await cover_image.read()
        if len(cover_bytes) > MAX_COVER_SIZE:
            raise HTTPException(400, "Cover image too large — max 10 MB")
        cover_upload = library_storage.upload_book_cover(cover_bytes, slug)

    with get_db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO books (
                slug, title, subtitle, author, original_language, description,
                category_id, cover_image_url, cover_image_public_id,
                original_pdf_url, original_pdf_public_id, file_size_bytes,
                extraction_status, uploaded_by
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'pending', %s)
            RETURNING id, uuid, slug
            """,
            (
                slug, title, subtitle, author, original_language, description,
                category_id,
                cover_upload["url"] if cover_upload else None,
                cover_upload["public_id"] if cover_upload else None,
                pdf_upload["url"], pdf_upload["public_id"], pdf_upload.get("bytes"),
                admin["id"],
            ),
        )
        book = cur.fetchone()

    # Extraction runs after the request returns — a several-hundred-page
    # PDF shouldn't hold the admin's upload request open.
    background_tasks.add_task(_run_extraction_job, book["id"], pdf_bytes)

    return {"id": book["id"], "uuid": str(book["uuid"]), "slug": book["slug"], "extraction_status": "pending"}


def _run_extraction_job(book_id: int, pdf_bytes: bytes) -> None:
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE books SET extraction_status = 'processing' WHERE id = %s",
                    (book_id,),
                )

        result = extract_pdf_text(pdf_bytes)

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                for page in result.pages:
                    blocks = structure_page_text(page.raw_text)
                    cur.execute(
                        """
                        INSERT INTO book_pages (book_id, page_number, raw_text, formatted_text)
                        VALUES (%s, %s, %s, %s)
                        ON CONFLICT (book_id, page_number)
                        DO UPDATE SET raw_text = EXCLUDED.raw_text,
                                      formatted_text = EXCLUDED.formatted_text
                        """,
                        (book_id, page.page_number, page.raw_text, json.dumps(blocks)),
                    )
                cur.execute(
                    """
                    UPDATE books
                    SET extraction_status = 'completed', page_count = %s
                    WHERE id = %s
                    """,
                    (result.page_count, book_id),
                )
        print(f"[library] extraction completed for book {book_id}: {result.page_count} pages")

    except Exception as error:
        print(f"[library] extraction FAILED for book {book_id}: {error}")
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE books SET extraction_status = 'failed', extraction_error = %s WHERE id = %s",
                        (str(error), book_id),
                    )
        except Exception:
            pass


# ── Translation ──────────────────────────────────────────────────────────

@router.post("/books/{book_id}/translate", status_code=202)
async def trigger_translation(
    book_id: int,
    body: TranslationTriggerRequest,
    background_tasks: BackgroundTasks,
    admin: dict = Depends(require_editor_or_above),
):
    with get_db_cursor() as cur:
        cur.execute("SELECT id, extraction_status FROM books WHERE id = %s", (book_id,))
        book = cur.fetchone()
        if not book:
            raise HTTPException(404, "Book not found")
        if book["extraction_status"] != "completed":
            raise HTTPException(409, "Wait for text extraction to complete before translating")

    for lang in body.languages:
        with get_db_cursor() as cur:
            cur.execute(
                """
                INSERT INTO book_translations (book_id, language, status)
                VALUES (%s, %s, 'pending')
                ON CONFLICT (book_id, language)
                DO UPDATE SET status = 'pending', progress_pct = 0, error_message = NULL
                RETURNING id
                """,
                (book_id, lang),
            )
            translation_id = cur.fetchone()["id"]

        background_tasks.add_task(_run_translation_job, book_id, translation_id, lang)

    return {"queued_languages": body.languages}


def _run_translation_job(book_id: int, translation_id: int, target_lang: str) -> None:
    try:
        with get_db_cursor() as cur:
            cur.execute(
                "SELECT page_number, formatted_text FROM book_pages WHERE book_id = %s ORDER BY page_number",
                (book_id,),
            )
            source_pages = cur.fetchall()

        if not source_pages:
            raise ValueError("No extracted pages found for this book")

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE book_translations SET status = 'processing', started_at = %s WHERE id = %s",
                    (datetime.utcnow(), translation_id),
                )

        total = len(source_pages)
        done = 0

        page_numbers = [p["page_number"] for p in source_pages]
        blocks_only = [p["formatted_text"] for p in source_pages]

        for batch_numbers, batch_blocks in zip(
            chunk_pages(page_numbers), chunk_pages(blocks_only)
        ):
            translated_batch = translate_page_batch(batch_blocks, target_lang)

            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    for page_number, translated_blocks in zip(batch_numbers, translated_batch):
                        cur.execute(
                            """
                            INSERT INTO book_translation_pages
                                (translation_id, page_number, translated_text, model_used)
                            VALUES (%s, %s, %s, %s)
                            ON CONFLICT (translation_id, page_number)
                            DO UPDATE SET translated_text = EXCLUDED.translated_text,
                                          model_used = EXCLUDED.model_used
                            """,
                            (translation_id, page_number, json.dumps(translated_blocks), "gpt-4.1"),
                        )

            done += len(batch_numbers)
            progress = int((done / total) * 100)
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE book_translations SET progress_pct = %s WHERE id = %s",
                        (progress, translation_id),
                    )

        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE book_translations
                    SET status = 'completed', progress_pct = 100, completed_at = %s
                    WHERE id = %s
                    """,
                    (datetime.utcnow(), translation_id),
                )
        print(f"[library] translation completed: book {book_id} -> {target_lang}")

    except Exception as error:
        print(f"[library] translation FAILED: book {book_id} -> {target_lang}: {error}")
        try:
            with get_db_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE book_translations SET status = 'failed', error_message = %s WHERE id = %s",
                        (str(error), translation_id),
                    )
        except Exception:
            pass


@router.get("/books/{book_id}/translation-status")
async def translation_status(book_id: int, admin: dict = Depends(get_current_admin)):
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT language, status, progress_pct, error_message FROM book_translations WHERE book_id = %s",
            (book_id,),
        )
        return cur.fetchall()


# ── CRUD ─────────────────────────────────────────────────────────────────

@router.get("/books")
async def list_books_admin(admin: dict = Depends(get_current_admin)):
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT b.*, c.name AS category_name
            FROM books b
            LEFT JOIN book_categories c ON c.id = b.category_id
            ORDER BY b.created_at DESC
            """
        )
        return cur.fetchall()


@router.patch("/books/{book_id}")
async def update_book(book_id: int, body: BookUpdate, admin: dict = Depends(require_editor_or_above)):
    fields = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if not fields:
        raise HTTPException(400, "No fields to update")

    set_clause = ", ".join(f"{key} = %s" for key in fields)
    values = list(fields.values()) + [book_id]

    with get_db_cursor() as cur:
        cur.execute(f"UPDATE books SET {set_clause} WHERE id = %s RETURNING id", values)
        if not cur.fetchone():
            raise HTTPException(404, "Book not found")

    return {"status": "updated"}


@router.delete("/books/{book_id}")
async def delete_book(book_id: int, admin: dict = Depends(require_editor_or_above)):
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT original_pdf_public_id, cover_image_public_id FROM books WHERE id = %s",
            (book_id,),
        )
        book = cur.fetchone()
        if not book:
            raise HTTPException(404, "Book not found")
        cur.execute("DELETE FROM books WHERE id = %s", (book_id,))

    library_storage.delete_book_pdf(book["original_pdf_public_id"])
    if book["cover_image_public_id"]:
        from services.cloudinary_service import delete_file

        delete_file(book["cover_image_public_id"], resource_type="image")

    return {"status": "deleted"}