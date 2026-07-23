"""
Sacred Books Library — table creation script.

Same pattern as scripts/create_volunteer_tables.py — run once, idempotent
(CREATE TABLE IF NOT EXISTS everywhere).

Usage:
    python scripts/create_library_tables.py
"""

import sys
from pathlib import Path

BACKEND_DIRECTORY = Path(__file__).resolve().parents[1]

if str(BACKEND_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIRECTORY))

from db.connection import get_db_connection


CREATE_LIBRARY_TABLES_SQL = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;


CREATE TABLE IF NOT EXISTS book_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,
    icon VARCHAR(60),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE IF NOT EXISTS books (
    id BIGSERIAL PRIMARY KEY,

    uuid UUID
        UNIQUE
        NOT NULL
        DEFAULT gen_random_uuid(),

    slug VARCHAR(160) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255),
    author VARCHAR(255),

    original_language VARCHAR(10) NOT NULL DEFAULT 'en',
    description TEXT,

    category_id BIGINT REFERENCES book_categories(id) ON DELETE SET NULL,

    cover_image_url TEXT,
    cover_image_public_id TEXT,           -- cloudinary public_id, for deletes

    original_pdf_url TEXT NOT NULL,       -- cloudinary "raw" resource URL
    original_pdf_public_id TEXT NOT NULL,

    page_count INT,
    file_size_bytes BIGINT,

    extraction_status VARCHAR(20)
        NOT NULL
        DEFAULT 'pending'
        CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed')),
    extraction_error TEXT,

    is_published BOOLEAN NOT NULL DEFAULT FALSE,

    uploaded_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_books_category ON books(category_id);
CREATE INDEX IF NOT EXISTS idx_books_published ON books(is_published) WHERE is_published = TRUE;
CREATE INDEX IF NOT EXISTS idx_books_search ON books
    USING GIN (to_tsvector('english', title || ' ' || COALESCE(author, '') || ' ' || COALESCE(description, '')));


-- One row per (book, page) — extracted original-language text.
CREATE TABLE IF NOT EXISTS book_pages (
    id BIGSERIAL PRIMARY KEY,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    raw_text TEXT,
    formatted_text JSONB,          -- [{type, text, ...}] structured blocks
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(book_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_book_pages_lookup ON book_pages(book_id, page_number);


CREATE TABLE IF NOT EXISTS book_translations (
    id BIGSERIAL PRIMARY KEY,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL,
    status VARCHAR(20)
        NOT NULL
        DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    progress_pct INT NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(book_id, language)
);


CREATE TABLE IF NOT EXISTS book_translation_pages (
    id BIGSERIAL PRIMARY KEY,
    translation_id BIGINT NOT NULL REFERENCES book_translations(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    translated_text JSONB,
    model_used VARCHAR(60),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(translation_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_translation_pages_lookup
    ON book_translation_pages(translation_id, page_number);


-- ── Reading experience ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_reading_progress (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    current_page INT NOT NULL DEFAULT 1,
    total_pages INT,
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS user_bookmarks (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    label VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_book ON user_bookmarks(user_id, book_id);

CREATE TABLE IF NOT EXISTS user_highlights (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    text_snippet TEXT NOT NULL,
    color VARCHAR(20) NOT NULL DEFAULT 'yellow',
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_highlights_user_book ON user_highlights(user_id, book_id);

CREATE TABLE IF NOT EXISTS user_favorites (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS user_library_preferences (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(10) NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark', 'sepia')),
    font_size INT NOT NULL DEFAULT 18,
    line_height NUMERIC(3,2) NOT NULL DEFAULT 1.6,
    preferred_language VARCHAR(10) NOT NULL DEFAULT 'en'
);

CREATE TABLE IF NOT EXISTS user_reading_stats (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id BIGINT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    stat_date DATE NOT NULL DEFAULT CURRENT_DATE,
    pages_read INT NOT NULL DEFAULT 0,
    minutes_spent INT NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, book_id, stat_date)
);


-- ── updated_at trigger, reusing the same helper style as volunteers ──

CREATE OR REPLACE FUNCTION update_library_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS books_updated_at_trigger ON books;

CREATE TRIGGER books_updated_at_trigger
BEFORE UPDATE ON books
FOR EACH ROW
EXECUTE FUNCTION update_library_updated_at();


-- Seed a starter set of categories (safe to re-run — ON CONFLICT DO NOTHING).
INSERT INTO book_categories (name, slug, icon, sort_order) VALUES
    ('Yoga & Philosophy', 'yoga-philosophy', 'flower-2', 1),
    ('Vedas', 'vedas', 'flame', 2),
    ('Upanishads', 'upanishads', 'sparkles', 3),
    ('Puranas', 'puranas', 'book-open', 4),
    ('Epics', 'epics', 'swords', 5),
    ('Devotional', 'devotional', 'heart', 6)
ON CONFLICT (slug) DO NOTHING;
"""


def create_library_tables():
    print("Creating Sacred Books Library tables...")

    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(CREATE_LIBRARY_TABLES_SQL)

    print("Library tables created successfully.")


if __name__ == "__main__":
    create_library_tables()