"""Database-backed multilingual PDF library."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import io
import json
import os
import re
import tempfile
import threading
import time
import uuid
import wave
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path

import cloudinary.uploader
import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, Body, Depends, File, Form, HTTPException, Query, Response, UploadFile
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
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
from services.library_audio_storage import delete_audio, upload_audio
from services.openrouter_service import api_key, chat, content, speech

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
MAX_AUDIO_BYTES = int(os.getenv("LIBRARY_MAX_AUDIO_MB", "100")) * 1024 * 1024
TRANSLATION_MODEL = os.getenv("LIBRARY_TRANSLATION_MODEL", "openrouter/auto")
OCR_MODEL = os.getenv("LIBRARY_OCR_MODEL", TRANSLATION_MODEL)
# OpenRouter vision OCR is used only for pages without usable embedded text.
# It is more reliable than local Tesseract for low-quality devotional scans.
TRANSLATION_WORKERS = max(1, min(int(os.getenv("LIBRARY_TRANSLATION_WORKERS", "4")), 8))
OCR_WORKERS = max(1, min(int(os.getenv("LIBRARY_OCR_WORKERS", "2")), 4))
TRANSLATION_TIMEOUT = max(30, int(os.getenv("LIBRARY_TRANSLATION_TIMEOUT_SECONDS", "180")))
TRANSLATION_CHUNK_CHARS = max(4000, int(os.getenv("LIBRARY_TRANSLATION_CHUNK_CHARS", "12000")))
PAGE_IMAGE_DPI = max(72, int(os.getenv("LIBRARY_PAGE_IMAGE_DPI", "150")))
OCR_RETRY_DPI = max(PAGE_IMAGE_DPI, int(os.getenv("LIBRARY_OCR_RETRY_DPI", "400")))
AI_MAX_ATTEMPTS = max(1, min(int(os.getenv("LIBRARY_AI_MAX_ATTEMPTS", "3")), 5))
# Qwen can otherwise put a long "Thinking Process" in the normal content.
# Disabling it makes OCR/translation faster, cheaper, and keeps JSON clean.
LIBRARY_DISABLE_REASONING = os.getenv("LIBRARY_DISABLE_REASONING", "true").strip().lower() in {"1", "true", "yes"}
LIBRARY_REASONING = {"effort": "none", "exclude": True} if LIBRARY_DISABLE_REASONING else None
# Minimum extracted-text length below which a page is treated as having no
# usable text layer (i.e. a scanned image) and is sent through OCR instead.
OCR_MIN_TEXT_CHARS = max(1, int(os.getenv("LIBRARY_OCR_MIN_TEXT_CHARS", "20")))
_translation_slots = threading.BoundedSemaphore(TRANSLATION_WORKERS)

# ── Voice reading (OpenRouter text-to-speech) ───────────────────────────────
# One model/voice pair per reader language. English uses OpenAI's TTS voices;
# Hindi and Sanskrit use Gemini's TTS model instead, since it covers far more
# languages than OpenAI's voices do and reads Devanagari text correctly for
# both (mirroring the old browser fallback of reading Sanskrit with a Hindi
# voice, but with a model actually trained on it).
TTS_MODELS = {
    "en": os.getenv("LIBRARY_TTS_MODEL_EN", "google/gemini-3.1-flash-tts-preview"),
    "hi": os.getenv("LIBRARY_TTS_MODEL_HI", "google/gemini-3.1-flash-tts-preview"),
    "sa": os.getenv("LIBRARY_TTS_MODEL_SA", "google/gemini-3.1-flash-tts-preview"),
}
TTS_VOICES = {
    "en": os.getenv("LIBRARY_TTS_VOICE_EN", "Kore"),
    "hi": os.getenv("LIBRARY_TTS_VOICE_HI", "Kore"),
    "sa": os.getenv("LIBRARY_TTS_VOICE_SA", "Kore"),
}
# Not every TTS model supports every response_format — Gemini's TTS models
# only support "pcm" (OpenRouter rejects "mp3" for them with a 400), while
# OpenAI's TTS models support "mp3" directly. This must match whatever
# model each language above is actually using.
TTS_FORMATS = {
    "en": os.getenv("LIBRARY_TTS_FORMAT_EN", "pcm"),
    "hi": os.getenv("LIBRARY_TTS_FORMAT_HI", "pcm"),
    "sa": os.getenv("LIBRARY_TTS_FORMAT_SA", "pcm"),
}
# Sample rate of the raw PCM Gemini's TTS returns (24kHz/16-bit mono), used
# to wrap it in a playable WAV container — see _pcm_to_wav() below.
TTS_PCM_SAMPLE_RATE = int(os.getenv("LIBRARY_TTS_PCM_SAMPLE_RATE", "24000"))
# A page's worth of prose comfortably fits under this; longer input is
# truncated so one request can't blow past a TTS model's context window.
TTS_MAX_CHARS = max(500, int(os.getenv("LIBRARY_TTS_MAX_CHARS", "4000")))
# Small in-memory cache so replaying the same page's audio (switching tabs
# and back, re-opening "Listen") doesn't re-pay OpenRouter's per-character
# TTS cost every time. Bounded and process-local — fine for a "nice to have",
# not meant as a durable cache.
_TTS_CACHE_LIMIT = 200
_tts_cache: dict[str, bytes] = {}
_tts_cache_order: list[str] = []

# Original PDFs are never kept permanently — a book only needs its raw file
# on disk for the duration of extraction/translation. This directory lives
# on Railway's local (ephemeral) container disk and every file in it is
# deleted the moment processing finishes, whether it succeeds or fails.
LIBRARY_TMP_DIR = Path(os.getenv("LIBRARY_TMP_DIR") or tempfile.gettempdir()) / "bharatmandir-library"

# Rough characters-per-token estimate used only to size max_tokens for the
# combined multi-language translation call below — doesn't need to be exact,
# just needs to keep us from truncating a large combined JSON response.
_CHARS_PER_TOKEN_ESTIMATE = 2.5
_COMBINED_TRANSLATION_MIN_TOKENS = 2000
_COMBINED_TRANSLATION_MAX_TOKENS = 16000


def _api_key() -> str:
    return api_key()


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
        # Generated once per (page, language) and reused forever after —
        # see synthesize_speech() below. Cached permanently in Cloudinary,
        # not just in-process memory, so it survives restarts/deploys and
        # is shared across every reader instead of being regenerated.
        cur.execute("""
            ALTER TABLE library_book_pages
            ADD COLUMN IF NOT EXISTS audio_en_url TEXT
        """)
        cur.execute("""
            ALTER TABLE library_book_pages
            ADD COLUMN IF NOT EXISTS audio_hi_url TEXT
        """)
        cur.execute("""
            ALTER TABLE library_book_pages
            ADD COLUMN IF NOT EXISTS audio_sa_url TEXT
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
        # Uploaded bhajans, kirtans and other devotional audio. The storage
        # provider/path are retained so an admin deletion can remove the
        # Cloudinary file as well as its database record.
        cur.execute("""
            CREATE TABLE IF NOT EXISTS library_audio (
                id BIGSERIAL PRIMARY KEY,
                slug TEXT UNIQUE NOT NULL,
                title TEXT NOT NULL,
                artist TEXT,
                description TEXT,
                category TEXT NOT NULL DEFAULT 'bhajan'
                    CHECK (category IN ('bhajan','kirtan','chalisa','mantra','aarti','other')),
                language TEXT,
                audio_url TEXT NOT NULL,
                storage_provider TEXT NOT NULL DEFAULT 'cloudinary'
                    CHECK (storage_provider = 'cloudinary'),
                storage_path TEXT,
                original_filename TEXT NOT NULL,
                file_size_bytes BIGINT NOT NULL DEFAULT 0,
                is_published BOOLEAN NOT NULL DEFAULT TRUE,
                created_by BIGINT REFERENCES admin_users(id),
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_library_audio_published
            ON library_audio(is_published, created_at DESC)
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


def _unique_audio_slug(title: str) -> str:
    """Generate a stable, readable unique slug for devotional audio."""
    base = _slugify(title)
    with get_db_cursor() as cur:
        cur.execute("SELECT slug FROM library_audio WHERE slug LIKE %s", (f"{base}%",))
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


def _upload_page_audio(audio_bytes: bytes, slug: str, page_number: int, language: str, audio_format: str) -> str:
    """Upload a synthesized page's audio so it's generated via OpenRouter only
    once per (page, language) and served from Cloudinary's CDN every time
    after. Cloudinary treats audio under its "video" resource type."""
    _ensure_configured()
    result = cloudinary.uploader.upload(
        audio_bytes,
        resource_type="video",
        folder=f"bharatmandir/library/{slug}/audio",
        public_id=f"page-{page_number:04d}-{language}",
        overwrite=True,
        format=audio_format,
    )
    return result["secure_url"]


def _pcm_to_wav(pcm_bytes: bytes, *, sample_rate: int, channels: int = 1, sample_width: int = 2) -> bytes:
    """Wraps raw PCM16 bytes (what Gemini's TTS models return — OpenRouter
    rejects "mp3" for them) in a minimal WAV header. Raw PCM has no
    container/header at all, so it won't play from a plain <audio src=...>
    or upload as a recognizable file type without this."""
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(sample_width)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm_bytes)
    return buffer.getvalue()


# Base per-attempt timeout for a single TTS synthesis call. Longer page
# text takes longer for the provider to generate, so this needs headroom
# beyond a typical short-request timeout — see _synthesize_tts_audio()
# below, which also retries the correct format with a longer timeout
# before giving up, rather than switching to an incompatible format.
TTS_TIMEOUT_SECONDS = max(30, int(os.getenv("LIBRARY_TTS_TIMEOUT_SECONDS", "90")))


def _synthesize_tts_audio(text: str, model: str, voice: str, preferred_format: str) -> tuple[bytes, str, str]:
    """Try a few OpenRouter TTS output formats because provider support varies.

    Timeouts are handled differently from format-rejection errors: a
    timeout just means the provider was still generating (longer page text
    takes longer), so the SAME (already-correct) format is retried with a
    longer timeout instead of cycling through other formats — trying a
    format the provider has already told us it doesn't support wastes a
    round trip without addressing the actual problem.
    """
    formats: list[str | None] = []
    for candidate in (preferred_format, "mp3", "wav", "pcm", None):
        if candidate not in formats:
            formats.append(candidate)

    last_error: Exception | None = None
    for audio_format in formats:
        # Give the preferred (correct) format more than one shot, with an
        # increasing timeout, before falling through to a different format.
        attempt_timeouts = (
            [TTS_TIMEOUT_SECONDS, TTS_TIMEOUT_SECONDS * 2]
            if audio_format == preferred_format
            else [TTS_TIMEOUT_SECONDS]
        )
        for attempt_timeout in attempt_timeouts:
            try:
                audio = speech(
                    input=text,
                    model=model,
                    voice=voice,
                    response_format=audio_format,
                    timeout=attempt_timeout,
                )
                if audio_format == "pcm":
                    return _pcm_to_wav(audio, sample_rate=TTS_PCM_SAMPLE_RATE), "wav", "audio/wav"
                if audio_format == "wav":
                    return audio, "wav", "audio/wav"
                return audio, "mp3", "audio/mpeg"
            except Exception as exc:
                last_error = exc
                print(
                    f"[library] TTS attempt failed "
                    f"(model={model}, voice={voice}, format={audio_format or 'default'}, "
                    f"timeout={attempt_timeout}s): {exc}"
                )
                # Only a genuine timeout is worth retrying with more time on
                # this same format. Any other error (e.g. the provider
                # explicitly rejecting the format) won't be fixed by waiting
                # longer, so move on to the next candidate format instead.
                if not isinstance(exc, httpx.TimeoutException):
                    break

    raise RuntimeError(str(last_error or "Voice reading is temporarily unavailable."))


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
    """One text string per page, taken straight from the PDF's embedded text
    layer. Pages with no usable text layer — i.e. scanned image pages, which
    is common for older Gita Press-style scans — come back as "" here rather
    than raising. Those get a second chance via OCR in _process_book() once
    page images and an OpenRouter connection are available; only if a page still has
    no text after that fallback does the book actually fail.
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
    pages = [(page.extract_text() or "").strip() for page in reader.pages]
    if not pages:
        raise ValueError("The PDF has no pages.")
    return pages


_DEVANAGARI_RANGE = (0x0900, 0x097F)


def _extraction_looks_valid(text: str, source_language: str) -> bool:
    """Detects legacy 8-bit Hindi fonts (Kruti Dev / DevLys / Chanakya-style)
    whose embedded text layer decodes to non-Devanagari glyph bytes.

    These fonts render as correct-looking Devanagari on screen (the font's
    glyph table maps ASCII/Latin byte codes to Devanagari shapes), but the
    underlying text layer pypdf extracts is NOT real Unicode Devanagari —
    it's mojibake like "üÊË„UÁ⁄U—H". Because this text is non-empty and
    often long, it passes the OCR_MIN_TEXT_CHARS length check and looks like
    a "native text layer" page, so it never gets routed through the OCR
    fallback. It then goes straight to the translation model as if it were
    real Hindi, which has no choice but to hallucinate a "translation" of
    text that carries no actual linguistic content (this is what produces
    unrelated output or endless [illegible] repeats).

    We guard against this by checking what fraction of a Devanagari-source
    page's non-whitespace characters actually fall in the Devanagari Unicode
    block. A real Devanagari page should be overwhelmingly Devanagari
    codepoints; legacy-font mojibake is typically close to 0%.
    """
    stripped = re.sub(r"\s+", "", text)
    if not stripped:
        return False
    is_devanagari_source = source_language.strip().lower() in {
        "hindi", "hi", "sanskrit", "sa", "devanagari",
    }
    if not is_devanagari_source:
        return True  # this guard only applies to Devanagari-script sources
    devanagari_chars = sum(
        1 for ch in stripped if _DEVANAGARI_RANGE[0] <= ord(ch) <= _DEVANAGARI_RANGE[1]
    )
    return (devanagari_chars / len(stripped)) > 0.3


def _render_page_images(pdf_path: Path, book_id: int | None = None) -> list[bytes | None]:
    """Render every PDF page to a PNG at PAGE_IMAGE_DPI so embedded pictures,
    diagrams, and layout are preserved exactly as printed — not just the text.
    Returns one entry per page; entries are None only if rendering is
    unavailable, in which case the rest of the book still processes normally.

    Rendered in parallel across pages. Each worker opens its own
    fitz.Document via _render_single_page() — PyMuPDF Document objects
    aren't safe to share/read concurrently across threads, so every page
    gets its own open/close rather than reusing one shared doc.
    """
    if fitz is None:
        return []

    with fitz.open(str(pdf_path)) as doc:
        page_count = len(doc)

    if page_count == 0:
        return []

    images: list[bytes | None] = [None] * page_count

    def _render_one(index: int) -> tuple[int, bytes | None]:
        try:
            img = _render_single_page(pdf_path, index, PAGE_IMAGE_DPI)
            if img:
                print(f"[library] book {book_id}: rendered page image {index + 1}/{page_count} ({len(img)} bytes)")
            else:
                print(f"[library] book {book_id}: page image {index + 1}/{page_count} render returned nothing")
            return index, img
        except Exception as exc:
            print(f"[library] book {book_id}: page image {index + 1}/{page_count} render FAILED — {type(exc).__name__}: {exc}")
            return index, None

    # This is CPU/IO-bound rendering work, not an OpenRouter call, so it
    # doesn't share _translation_slots — give it its own worker budget.
    render_workers = max(1, min(TRANSLATION_WORKERS * 2, 8))
    with ThreadPoolExecutor(max_workers=render_workers) as executor:
        futures = [executor.submit(_render_one, i) for i in range(page_count)]
        for future in as_completed(futures):
            index, img = future.result()
            images[index] = img

    return images


def _render_single_page(pdf_path: Path, page_index: int, dpi: int) -> bytes | None:
    """Re-render one difficult scan at a higher resolution for OCR retry."""
    if fitz is None:
        return None
    doc = fitz.open(str(pdf_path))
    try:
        if page_index < 0 or page_index >= len(doc):
            return None
        zoom = dpi / 72
        pix = doc[page_index].get_pixmap(
            matrix=fitz.Matrix(zoom, zoom), alpha=False
        )
        return pix.tobytes("png")
    except Exception:
        return None
    finally:
        doc.close()


def _enhance_scan(image_bytes: bytes) -> bytes:
    """Improve scan contrast and sharpness without altering its content."""
    with Image.open(io.BytesIO(image_bytes)) as image:
        image = ImageOps.exif_transpose(image).convert("L")
        image = ImageOps.autocontrast(image, cutoff=1)
        image = ImageEnhance.Contrast(image).enhance(1.7)
        image = image.filter(ImageFilter.MedianFilter(size=3))
        image = image.filter(ImageFilter.SHARPEN)
        output = io.BytesIO()
        image.save(output, format="PNG", optimize=True)
        return output.getvalue()


def _chat_with_retries(**kwargs) -> dict:
    """Retry temporary, empty, and malformed OpenRouter responses."""
    last_error: Exception | None = None
    for attempt in range(1, AI_MAX_ATTEMPTS + 1):
        try:
            response = chat(**kwargs)
            if not content(response):
                raise RuntimeError("The language service returned an empty response.")
            return response
        except Exception as exc:
            last_error = exc
            if attempt < AI_MAX_ATTEMPTS:
                time.sleep(min(2 ** (attempt - 1), 4))
    raise RuntimeError(
        "The language service is temporarily unavailable after several attempts."
    ) from last_error


def _source_language_code(source_language: str) -> str | None:
    """Map the upload form's language code to the matching reader tab."""
    value = (source_language or "").strip().lower()
    return {
        "en": "en", "english": "en",
        "hi": "hi", "hindi": "hi", "devanagari": "hi",
        "sa": "sa", "sanskrit": "sa",
    }.get(value)


def _ocr_page_with_openrouter(image_bytes: bytes, source_language: str) -> str:
    """Transcribes a scanned page image via vision when the PDF has no
    extractable text layer (e.g. Gita Press-style scans where every page is
    a printed photo, not real text). Used only as a fallback for pages
    where pypdf's extract_text() came back empty/too short. Returns plain
    source-language text — never a translation, never commentary — so it
    can be fed straight into the normal _translate() pipeline afterwards.
    """
    if not image_bytes:
        return ""
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    prompt = (
        f"Transcribe every visible word of text on this scanned book page, "
        f"written in {source_language}. Preserve headings, verse breaks, "
        f"line breaks, numbering and punctuation exactly as printed. "
        f"Never summarize, omit, shorten, explain, censor, or add commentary. "
        f"Mark only genuinely unreadable fragments as [illegible]. "
        f"Return only the transcribed source-language text — no translation, "
        f"no preface, no code fence."
    )
    with _translation_slots:
        response = _chat_with_retries(
            model=OCR_MODEL,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}},
                ],
            }],
            temperature=0,
            timeout=TRANSLATION_TIMEOUT,
            reasoning=LIBRARY_REASONING,
        )
    return content(response)


def _ocr_page_image(image_bytes: bytes, source_language: str) -> str:
    """OCR a scanned page through OpenRouter vision."""
    if not image_bytes:
        return ""
    print(f"[library] OCR via OpenRouter vision ({OCR_MODEL})")
    return _ocr_page_with_openrouter(image_bytes, source_language)

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


def _translate_chunk(text: str, source_language: str, code: str) -> str:
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
        response = _chat_with_retries(
            model=TRANSLATION_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            timeout=TRANSLATION_TIMEOUT,
            reasoning=LIBRARY_REASONING,
        )
    return content(response)


def _translate(text: str, source_language: str, code: str) -> str:
    return "\n\n".join(
        _translate_chunk(chunk, source_language, code)
        for chunk in _split_text(text)
    )


def _estimate_combined_max_tokens(text: str, target_codes: tuple[str, ...]) -> int:
    """Size max_tokens for the combined multi-language JSON call so a
    response covering several full-length translations in one payload
    never gets silently truncated mid-JSON — the most common cause of the
    combined call's JSON parse failing. Scales with input length and the
    number of languages being generated in this one call."""
    per_language_tokens = int(len(text) / _CHARS_PER_TOKEN_ESTIMATE)
    estimated = per_language_tokens * max(1, len(target_codes)) + 1000
    return max(_COMBINED_TRANSLATION_MIN_TOKENS, min(estimated, _COMBINED_TRANSLATION_MAX_TOKENS))


def _extract_json_object(raw: str) -> dict | None:
    """Best-effort repair for a combined-translation response that has stray
    preamble/postamble text wrapped around otherwise-valid JSON, by pulling
    out the outermost {...} block before giving up and falling back to
    per-language calls."""
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
    except Exception:
        return None
    return parsed if isinstance(parsed, dict) else None


def _translate_chunk_all_languages(
    text: str, source_language: str, target_codes: tuple[str, ...]
) -> dict[str, str]:
    """Translate one chunk into only the language tabs that are needed, in a
    single combined call rather than one call per language — this is what
    keeps a Hindi-source book down to one call for (en, sa) instead of two,
    and an English-source book to one call for (hi, sa) instead of two.
    """
    if not text.strip():
        return {code: "" for code in target_codes}

    language_lines = "\n".join(f'- "{code}": {TARGET_LANGUAGES[code]}' for code in target_codes)
    json_shape = ", ".join(f'"{code}": "<complete translation>"' for code in target_codes)
    prompt = f"""Translate this document text from {source_language} into these languages:
{language_lines}

RULES:
- Translate every heading, sentence, caption, footnote, list item, verse and repetition, separately and completely into each requested language.
- Never summarize, omit, shorten, explain, censor, modernize, or add commentary.
- Preserve paragraphs, headings, numbering, lists, names and citations in every language's version.
- Mark only genuinely unreadable fragments as [illegible].
- Respond with ONLY a single JSON object, no prose or code fence, in exactly this shape:
{{{json_shape}}}

SOURCE TEXT:
{text}"""

    # max_tokens sized to the input — a combined en+hi+sa (or en+sa)
    # response is much longer than a single-language one, and an
    # unset/too-small max_tokens was the most likely cause of the response
    # getting cut off mid-JSON, which is what the parse failures traced
    # back to.
    #
    # Note: response_format={"type":"json_object"} was tried here too, but
    # qwen3.5-flash occasionally returned a degenerate non-object JSON
    # value (e.g. a bare "-1.0000000000000002e+77") when that was set —
    # technically valid JSON, so it didn't even raise, it just silently
    # wasn't a dict and forced a fallback anyway. Since it didn't fix
    # anything response_format was supposed to help with and introduced
    # this new failure mode, it's left out — the prompt's own "respond
    # with ONLY a JSON object" instruction plus a correctly-sized
    # max_tokens does the job without it.
    max_tokens = _estimate_combined_max_tokens(text, target_codes)
    with _translation_slots:
        response = _chat_with_retries(
            model=TRANSLATION_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            timeout=TRANSLATION_TIMEOUT,
            max_tokens=max_tokens,
            reasoning=LIBRARY_REASONING,
        )

    raw = content(response)
    raw = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    try:
        parsed = json.loads(raw)
        if not isinstance(parsed, dict):
            raise ValueError(f"parsed to {type(parsed).__name__}, not a JSON object")
    except Exception as parse_err:
        # Log exactly what broke — head/tail of the raw output — instead of
        # failing blind. This tells us truncation vs. stray text vs. bad
        # escaping vs. degenerate non-object output the next time this
        # happens, instead of just a generic "falling back" line with no
        # diagnostic value.
        print(f"[library] combined translation JSON parse failed: {type(parse_err).__name__}: {parse_err}")
        print(f"[library] raw response length={len(raw)} head={raw[:300]!r}")
        print(f"[library] raw response tail={raw[-150:]!r}")

        repaired = _extract_json_object(raw)
        if repaired is not None:
            print("[library] recovered JSON object from surrounding text — no per-language fallback needed")
            return {code: str(repaired.get(code) or "") for code in target_codes}

        print("[library] combined translation JSON parse failed for one chunk — falling back per-language")
        return {code: _translate_chunk(text, source_language, code) for code in target_codes}
    return {code: str(parsed.get(code) or "") for code in target_codes}


def _translate_all_languages(text: str, source_language: str) -> dict[str, str]:
    """Preserve the original tab exactly and translate only the other tabs.

    If the book's source language is Hindi, target_codes is just (en, sa) —
    Hindi is reused verbatim from the source, never re-translated — so this
    already costs one combined call for two languages, not three separate
    calls. Same for an English or Sanskrit source.
    """
    source_code = _source_language_code(source_language)
    target_codes = tuple(code for code in TARGET_LANGUAGES if code != source_code)
    if not target_codes:
        return {code: text for code in TARGET_LANGUAGES}

    chunks = _split_text(text)
    merged: dict[str, list[str]] = {code: [] for code in target_codes}
    for chunk in chunks:
        result = _translate_chunk_all_languages(chunk, source_language, target_codes)
        for code in target_codes:
            merged[code].append(result[code])
    translated = {code: "\n\n".join(parts) for code, parts in merged.items()}
    if source_code:
        translated[source_code] = text
    return {code: translated.get(code, "") for code in TARGET_LANGUAGES}


def _generate_sections(book_id: int, page_texts: dict[int, str]) -> None:
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
        response = _chat_with_retries(
            model=TRANSLATION_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            timeout=TRANSLATION_TIMEOUT,
            reasoning=LIBRARY_REASONING,
        )
    raw = content(response)
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
        native_count = sum(
            1 for p in pages
            if len(p) >= OCR_MIN_TEXT_CHARS and _extraction_looks_valid(p, source_language)
        )
        print(f"[library] book {book_id}: {len(pages)} pages total, {native_count} with a native, valid-script text layer")

        key = _api_key()
        if not key:
            raise RuntimeError(
                "OPENROUTER_API_KEY is unavailable to the backend. Add it and restart the backend."
            )

        # Render page images up front. If PyMuPDF isn't installed, or a
        # specific page fails to rasterize, translation still proceeds —
        # those pages simply won't have a preserved scan.
        try:
            page_images = _render_page_images(pdf_path, book_id)
        except Exception:
            page_images = []
        if len(page_images) != len(pages):
            page_images = [None] * len(pages)
        print(f"[library] book {book_id}: rendered {sum(1 for i in page_images if i)}/{len(pages)} page images")

        # OCR fallback: pages with no (or a near-empty) text layer are
        # scanned images — common for older Gita Press-style PDFs where
        # every page is a printed photo rather than real text. Transcribe
        # those specific pages via vision before falling back to a hard
        # failure. Pages that already have a native text layer are left
        # untouched to avoid unnecessary AI calls.
        needs_ocr = [
            i for i, text in enumerate(pages)
            if (
                len(text) < OCR_MIN_TEXT_CHARS
                or not _extraction_looks_valid(text, source_language)
            )
            and page_images[i]
        ]
        if needs_ocr:
            print(
                f"[library] book {book_id}: {len(needs_ocr)}/{len(pages)} pages have "
                f"no usable native text layer (missing or legacy-font mojibake) — running OCR"
            )

            def _ocr_one(index: int):
                page_number = index + 1
                try:
                    text = _ocr_page_image(page_images[index], source_language)
                    if len(text.strip()) < OCR_MIN_TEXT_CHARS:
                        retry_image = _render_single_page(pdf_path, index, OCR_RETRY_DPI)
                        if retry_image:
                            text = _ocr_page_image(
                                _enhance_scan(retry_image), source_language
                            )
                    print(f"[library] book {book_id}: OCR page {page_number}/{len(pages)} — {len(text)} chars")
                    return index, text
                except Exception as exc:
                    print(f"[library] book {book_id}: OCR FAILED on page {page_number}/{len(pages)} — {type(exc).__name__}: {exc}")
                    try:
                        retry_image = _render_single_page(pdf_path, index, OCR_RETRY_DPI)
                        retry_text = (
                            _ocr_page_image(_enhance_scan(retry_image), source_language)
                            if retry_image
                            else ""
                        )
                        return index, retry_text
                    except Exception:
                        return index, ""

            # Tesseract is CPU-intensive. Keep a separate small worker pool so
            # OCR cannot starve the web server or translation workers.
            with ThreadPoolExecutor(max_workers=OCR_WORKERS) as executor:
                jobs = [executor.submit(_ocr_one, index) for index in needs_ocr]
                for job in as_completed(jobs):
                    index, text = job.result()
                    if text:
                        pages[index] = text

        if sum(map(len, pages)) < OCR_MIN_TEXT_CHARS:
            raise ValueError(
                "No usable text was found, even after OCR. The scan may be too low "
                "quality to transcribe — try a higher-resolution scan of this PDF."
            )

        with get_db_cursor() as cur:
            cur.execute("""
                UPDATE library_books SET page_count=%s, processed_pages=0,
                    processing_error=NULL, updated_at=NOW() WHERE id=%s
            """, (len(pages), book_id))

        def translate_page(page_number: int, source_text: str, image_bytes: bytes | None):
            print(f"[library] book {book_id}: page {page_number} — calling OpenRouter ({TRANSLATION_MODEL}) for combined translation")
            page_started = datetime.utcnow()
            try:
                # One combined call per chunk covering only the languages
                # that actually need translating (the source language is
                # reused verbatim) — see _translate_all_languages().
                translated = _translate_all_languages(source_text, source_language)

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
                raise RuntimeError(
                    f"We couldn't prepare page {page_number} after several attempts. "
                    "Please upload the book again in a few moments."
                ) from exc

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
                            page_image_url=EXCLUDED.page_image_url,
                            audio_en_url=NULL,
                            audio_hi_url=NULL,
                            audio_sa_url=NULL
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
            _generate_sections(book_id, page_text_en)
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


@router.get("/api/library-audio")
def list_library_audio():
    """Public devotional-audio shelf. Only published recordings are shown."""
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id,slug,title,artist,description,category,language,audio_url,
                   original_filename,file_size_bytes,created_at
            FROM library_audio
            WHERE is_published=TRUE
            ORDER BY created_at DESC
        """)
        return {"audio": [dict(row) for row in cur.fetchall()]}


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


AUDIO_COLUMNS = {"en": "audio_en_url", "hi": "audio_hi_url", "sa": "audio_sa_url"}


@router.post("/api/books/tts")
def synthesize_speech(payload: dict = Body(...)):
    """Text-to-speech for the reader's "Listen" button, via OpenRouter.

    Public (no auth) — mirrors /api/books/{slug}/pages, which any reader,
    logged in or not, can already fetch.

    When `slug` + `page_number` are supplied, this generates each page's
    audio via OpenRouter only the first time it's ever requested, uploads
    it to Cloudinary, and remembers the URL on that library_book_pages row.
    Every request after that 307-redirects straight to the stored CDN URL
    instead of calling OpenRouter again — so a page is paid for once and
    reused by every reader, not re-synthesized on every "Listen" click.

    Without `slug`/`page_number` (or if storing fails for any reason) this
    falls back to synthesizing on the spot and serving the bytes directly,
    backed by the small in-process cache below.
    """

    text = (payload.get("text") or "").strip()
    language = payload.get("language") or "en"
    if language not in TTS_MODELS:
        language = "en"
    if not text:
        raise HTTPException(400, "text is required")
    if len(text) > TTS_MAX_CHARS:
        text = text[:TTS_MAX_CHARS]

    slug = (payload.get("slug") or "").strip()
    page_number = payload.get("page_number")
    audio_column = AUDIO_COLUMNS[language]
    book_id = None

    if slug and isinstance(page_number, int):
        with get_db_cursor() as cur:
            cur.execute(
                f"""
                SELECT b.id AS book_id, p.{audio_column} AS audio_url
                FROM library_books b
                JOIN library_book_pages p ON p.book_id = b.id
                WHERE b.slug=%s AND p.page_number=%s AND b.status='ready'
                """,
                (slug, page_number),
            )
            row = cur.fetchone()
        if row:
            book_id = row["book_id"]
            if row["audio_url"]:
                # Do not redirect this POST request to Cloudinary. A 307 keeps
                # the POST method, while a Cloudinary delivery URL expects GET;
                # browser fetch can also be blocked by the CDN's CORS response.
                # Proxy the cached file through this same-origin API instead.
                try:
                    cached_response = httpx.get(
                        row["audio_url"],
                        timeout=60,
                        follow_redirects=True,
                    )
                    cached_response.raise_for_status()
                    cached_media_type = (
                        cached_response.headers.get("content-type", "")
                        .split(";", 1)[0]
                        .strip()
                    )
                    if not cached_media_type.startswith("audio/"):
                        cached_media_type = (
                            "audio/wav"
                            if TTS_FORMATS[language] == "pcm"
                            else "audio/mpeg"
                        )
                    return Response(
                        content=cached_response.content,
                        media_type=cached_media_type,
                        headers={"Cache-Control": "public, max-age=31536000"},
                    )
                except httpx.HTTPError as exc:
                    # If an old Cloudinary asset is missing or temporarily
                    # unavailable, continue below and regenerate the page audio.
                    print(
                        f"[library] cached TTS unavailable for "
                        f"{slug} page {page_number} ({language}): {exc}"
                    )

    model = TTS_MODELS[language]
    voice = TTS_VOICES[language]
    audio_format = TTS_FORMATS[language]  # preferred format; fallbacks are tried below

    try:
        audio, upload_format, media_type = _synthesize_tts_audio(text, model, voice, audio_format)
    except Exception as exc:
        print(f"[library] TTS failed for {slug or 'one-off'} page {page_number or '-'} ({language}): {exc}")
        raise HTTPException(
            502,
            "We couldn't prepare the sacred reading right now. Please try again in a few moments.",
        ) from exc


    if book_id is not None:
        try:
            audio_url = _upload_page_audio(audio, slug, page_number, language, upload_format)
            with get_db_cursor() as cur:
                cur.execute(
                    f"UPDATE library_book_pages SET {audio_column}=%s WHERE book_id=%s AND page_number=%s",
                    (audio_url, book_id, page_number),
                )
        except Exception:
            # Storing is a bonus, not a requirement — a Cloudinary/DB hiccup
            # here shouldn't stop this request's audio from playing.
            pass
        return Response(content=audio, media_type=media_type)

    # No book context to store against — fall back to the process-local
    # cache so at least identical repeat requests in this session are free.
    cache_key = hashlib.sha256(f"{language}:{model}:{voice}:{text}".encode("utf-8")).hexdigest()
    cached = _tts_cache.get(cache_key)
    if cached is not None:
        return Response(content=cached, media_type=media_type)
    _tts_cache[cache_key] = audio
    _tts_cache_order.append(cache_key)
    if len(_tts_cache_order) > _TTS_CACHE_LIMIT:
        oldest = _tts_cache_order.pop(0)
        _tts_cache.pop(oldest, None)
    return Response(content=audio, media_type=media_type)


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


@router.get("/api/admin/library-audio")
def admin_list_library_audio(admin: dict = Depends(get_current_admin)):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id,slug,title,artist,description,category,language,audio_url,
                   storage_provider,original_filename,file_size_bytes,is_published,
                   created_at,updated_at
            FROM library_audio
            ORDER BY created_at DESC
        """)
        return {"audio": [dict(row) for row in cur.fetchall()]}


@router.post("/api/admin/library-audio", status_code=201)
async def upload_library_audio(
    title: str = Form(...),
    artist: str = Form(""),
    description: str = Form(""),
    category: str = Form("bhajan"),
    language: str = Form(""),
    audio_file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin),
):
    allowed_categories = {"bhajan", "kirtan", "chalisa", "mantra", "aarti", "other"}
    allowed_extensions = {".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".webm"}
    filename = audio_file.filename or ""
    extension = Path(filename).suffix.lower()
    if category not in allowed_categories:
        raise HTTPException(422, "Please choose a valid devotional-audio category.")
    if not filename or (not (audio_file.content_type or "").startswith("audio/") and extension not in allowed_extensions):
        raise HTTPException(415, "Please choose an audio file in MP3, WAV, M4A, AAC, OGG, FLAC, or WebM format.")

    audio_bytes = await audio_file.read(MAX_AUDIO_BYTES + 1)
    if not audio_bytes:
        raise HTTPException(422, "The selected audio file is empty. Please choose another recording.")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(413, f"Please choose an audio file smaller than {MAX_AUDIO_BYTES // 1024 // 1024} MB.")

    slug = _unique_audio_slug(title.strip())
    try:
        audio_url, provider, storage_path = await asyncio.to_thread(
            upload_audio, audio_bytes, filename, audio_file.content_type, slug
        )
    except Exception as exc:
        print(f"[library-audio] upload failed: {type(exc).__name__}: {exc}")
        raise HTTPException(502, "We couldn't place this sacred audio in the library right now. Please try again in a few moments.") from exc

    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO library_audio
                (slug,title,artist,description,category,language,audio_url,
                 storage_provider,storage_path,original_filename,file_size_bytes,created_by)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            RETURNING id,slug,title,artist,description,category,language,audio_url,
                      storage_provider,original_filename,file_size_bytes,is_published,created_at
        """, (
            slug, title.strip(), artist.strip() or None, description.strip() or None,
            category, language.strip() or None, audio_url, provider, storage_path,
            filename, len(audio_bytes), admin["id"],
        ))
        return {"audio": dict(cur.fetchone())}


@router.patch("/api/admin/library-audio/{audio_id}")
def update_library_audio(audio_id: int, payload: dict = Body(...), admin: dict = Depends(get_current_admin)):
    if "is_published" not in payload or not isinstance(payload["is_published"], bool):
        raise HTTPException(422, "Please provide the publishing status for this audio.")
    with get_db_cursor() as cur:
        cur.execute("""
            UPDATE library_audio SET is_published=%s, updated_at=NOW()
            WHERE id=%s
            RETURNING id,is_published
        """, (payload["is_published"], audio_id))
        audio = cur.fetchone()
    if not audio:
        raise HTTPException(404, "This audio recording could not be found.")
    return {"audio": dict(audio)}


@router.delete("/api/admin/library-audio/{audio_id}")
def delete_library_audio(audio_id: int, admin: dict = Depends(get_current_admin)):
    with get_db_cursor() as cur:
        cur.execute("SELECT storage_provider,storage_path FROM library_audio WHERE id=%s", (audio_id,))
        audio = cur.fetchone()
        if not audio:
            raise HTTPException(404, "This audio recording could not be found.")
        cur.execute("DELETE FROM library_audio WHERE id=%s", (audio_id,))
    delete_audio(audio["storage_provider"], audio["storage_path"])
    return {"status": "deleted"}


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
