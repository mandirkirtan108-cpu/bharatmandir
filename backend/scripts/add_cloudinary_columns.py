"""
One-time migration: add Cloudinary public_id columns.

Run once after deploying the Cloudinary integration:
    cd backend
    python scripts/add_cloudinary_columns.py

Safe to re-run (uses IF NOT EXISTS).
"""

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from db.connection import get_db_cursor


def main() -> int:
    with get_db_cursor() as cur:
        cur.execute("ALTER TABLE temples ADD COLUMN IF NOT EXISTS hero_image_public_id TEXT;")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS temple_media (
                id                    SERIAL PRIMARY KEY,
                temple_id             INTEGER NOT NULL REFERENCES temples(id) ON DELETE CASCADE,
                media_type            VARCHAR(10) NOT NULL CHECK (media_type IN ('image','video')),
                file_url              TEXT NOT NULL,
                file_name             TEXT,
                caption               TEXT,
                is_hero               BOOLEAN DEFAULT FALSE,
                sort_order            INTEGER DEFAULT 0,
                cloudinary_public_id  TEXT,
                uploaded_at           TIMESTAMPTZ DEFAULT NOW()
            );
        """)
        cur.execute("ALTER TABLE temple_media ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;")
    print("✅ temples.hero_image_public_id and temple_media.cloudinary_public_id are ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())