import sys
from pathlib import Path

# backend directory ko Python import path mein add karta hai.
BACKEND_DIRECTORY = (
    Path(__file__).resolve().parents[1]
)

if str(BACKEND_DIRECTORY) not in sys.path:
    sys.path.insert(
        0,
        str(BACKEND_DIRECTORY),
    )

from db.connection import get_db_connection


CREATE_VOLUNTEER_TABLES_SQL = """
CREATE EXTENSION IF NOT EXISTS pgcrypto;


CREATE TABLE IF NOT EXISTS volunteers (
    id BIGSERIAL PRIMARY KEY,

    uuid UUID
        UNIQUE
        NOT NULL
        DEFAULT gen_random_uuid(),

    name VARCHAR(120) NOT NULL,

    email VARCHAR(255)
        UNIQUE
        NOT NULL,

    password_hash TEXT NOT NULL,

    phone VARCHAR(20),

    city VARCHAR(120),

    state VARCHAR(120),

    is_active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

    approval_status VARCHAR(20)
        NOT NULL
        DEFAULT 'pending'
        CHECK (approval_status IN ('pending', 'approved', 'rejected')),

    approved_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    last_login_at TIMESTAMPTZ
);


CREATE TABLE IF NOT EXISTS temple_submissions (
    id BIGSERIAL PRIMARY KEY,

    uuid UUID
        UNIQUE
        NOT NULL
        DEFAULT gen_random_uuid(),

    volunteer_id BIGINT
        NOT NULL
        REFERENCES volunteers(id)
        ON DELETE CASCADE,

    temple_name VARCHAR(255)
        NOT NULL,

    deity VARCHAR(150),

    temple_type VARCHAR(120),

    address TEXT,

    city VARCHAR(120),

    district VARCHAR(120),

    state VARCHAR(120),

    pincode VARCHAR(10),

    latitude NUMERIC(10, 7),

    longitude NUMERIC(10, 7),

    description TEXT,

    history TEXT,

    timings TEXT,

    contact_phone VARCHAR(20),

    image_url TEXT,

    form_payload JSONB
        NOT NULL
        DEFAULT '{}'::jsonb,

    status VARCHAR(30)
        NOT NULL
        DEFAULT 'draft'
        CHECK (
            status IN (
                'draft',
                'pending_review',
                'changes_requested',
                'published',
                'rejected'
            )
        ),

    admin_note TEXT,

    reviewed_by BIGINT
        REFERENCES admin_users(id)
        ON DELETE SET NULL,

    reviewed_at TIMESTAMPTZ,

    published_temple_id BIGINT
        REFERENCES temples(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    updated_at TIMESTAMPTZ
        NOT NULL
        DEFAULT NOW(),

    submitted_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    rejection_reason TEXT,

    CONSTRAINT temple_submission_latitude_check
        CHECK (
            latitude IS NULL
            OR (
                latitude >= -90
                AND latitude <= 90
            )
        ),

    CONSTRAINT temple_submission_longitude_check
        CHECK (
            longitude IS NULL
            OR (
                longitude >= -180
                AND longitude <= 180
            )
        )
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'volunteers' AND column_name = 'approval_status'
    ) THEN
        ALTER TABLE volunteers ADD COLUMN approval_status VARCHAR(20) NOT NULL DEFAULT 'pending';
        UPDATE volunteers SET approval_status = 'approved';
    END IF;
END $$;
ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS approved_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE volunteers ADD COLUMN IF NOT EXISTS registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE temple_submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE temple_submissions ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE temple_submissions ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE temple_submissions ADD COLUMN IF NOT EXISTS form_payload JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE temple_submissions ALTER COLUMN address DROP NOT NULL;
ALTER TABLE temple_submissions ALTER COLUMN city DROP NOT NULL;
ALTER TABLE temple_submissions ALTER COLUMN state DROP NOT NULL;
ALTER TABLE temple_submissions DROP CONSTRAINT IF EXISTS temple_submissions_status_check;
UPDATE temple_submissions SET status = 'pending_review' WHERE status IN ('pending', 'under_review');
UPDATE temple_submissions SET status = 'published' WHERE status = 'approved';
ALTER TABLE temple_submissions ADD CONSTRAINT temple_submissions_status_check
    CHECK (status IN ('draft', 'pending_review', 'changes_requested', 'published', 'rejected'));


CREATE UNIQUE INDEX IF NOT EXISTS
    idx_volunteers_email_lower
ON volunteers (
    LOWER(email)
);


CREATE INDEX IF NOT EXISTS
    idx_volunteers_active
ON volunteers (
    is_active
);


CREATE INDEX IF NOT EXISTS
    idx_temple_submissions_volunteer
ON temple_submissions (
    volunteer_id
);


CREATE INDEX IF NOT EXISTS
    idx_temple_submissions_status
ON temple_submissions (
    status
);


CREATE INDEX IF NOT EXISTS
    idx_temple_submissions_created_at
ON temple_submissions (
    created_at DESC
);


CREATE INDEX IF NOT EXISTS
    idx_temple_submissions_volunteer_status
ON temple_submissions (
    volunteer_id,
    status
);


CREATE OR REPLACE FUNCTION
update_volunteer_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS
    volunteers_updated_at_trigger
ON volunteers;


CREATE TRIGGER
    volunteers_updated_at_trigger
BEFORE UPDATE
ON volunteers
FOR EACH ROW
EXECUTE FUNCTION
    update_volunteer_updated_at();


DROP TRIGGER IF EXISTS
    temple_submissions_updated_at_trigger
ON temple_submissions;


CREATE TRIGGER
    temple_submissions_updated_at_trigger
BEFORE UPDATE
ON temple_submissions
FOR EACH ROW
EXECUTE FUNCTION
    update_volunteer_updated_at();
"""


def create_volunteer_tables():
    print(
        "Creating volunteer portal tables..."
    )

    with get_db_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                CREATE_VOLUNTEER_TABLES_SQL
            )

    print(
        "Volunteer portal tables created successfully."
    )


if __name__ == "__main__":
    create_volunteer_tables()
