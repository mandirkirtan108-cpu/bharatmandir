#!/usr/bin/env python3
"""
BharatMandir - Admin User Creator Script
Run this to: 
  1. Create the admin_users table (if not exists)
  2. Create your first super_admin account

Usage:
  cd backend
  python scripts/create_admin.py
"""

import os
import sys
import bcrypt
import psycopg2
from datetime import datetime

# ── Load DATABASE_URL from .env if not in environment ──────────────
def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, _, val = line.partition('=')
                    os.environ.setdefault(key.strip(), val.strip())

load_env()

DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    print("❌ DATABASE_URL not found in environment or .env file")
    sys.exit(1)


# ── Create table ────────────────────────────────────────────────────
CREATE_TABLE_SQL = """
CREATE TYPE IF NOT EXISTS admin_role AS ENUM (
    'super_admin', 'editor', 'moderator'
);

CREATE TABLE IF NOT EXISTS admin_users (
    id              BIGSERIAL PRIMARY KEY,
    uuid            UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    role            admin_role NOT NULL DEFAULT 'moderator',
    is_active       BOOLEAN DEFAULT TRUE,
    last_login_at   TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

CREATE TABLE IF NOT EXISTS admin_activity_log (
    id              BIGSERIAL PRIMARY KEY,
    admin_id        BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    action          VARCHAR(100) NOT NULL,
    target_type     VARCHAR(50),
    target_id       BIGINT,
    details         JSONB,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_admin ON admin_activity_log(admin_id);
"""


def create_tables(conn):
    with conn.cursor() as cur:
        # Handle enum separately (CREATE TYPE IF NOT EXISTS not supported in older PG)
        try:
            cur.execute("CREATE TYPE admin_role AS ENUM ('super_admin', 'editor', 'moderator')")
            conn.commit()
            print("✅ Created enum: admin_role")
        except psycopg2.errors.DuplicateObject:
            conn.rollback()
            print("ℹ️  Enum admin_role already exists — skipping")

        cur.execute("""
            CREATE TABLE IF NOT EXISTS admin_users (
                id              BIGSERIAL PRIMARY KEY,
                uuid            UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
                email           VARCHAR(255) NOT NULL UNIQUE,
                password_hash   TEXT NOT NULL,
                full_name       VARCHAR(255) NOT NULL,
                role            admin_role NOT NULL DEFAULT 'moderator',
                is_active       BOOLEAN DEFAULT TRUE,
                last_login_at   TIMESTAMP WITH TIME ZONE,
                created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)

        cur.execute("CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email)")

        cur.execute("""
            CREATE TABLE IF NOT EXISTS admin_activity_log (
                id              BIGSERIAL PRIMARY KEY,
                admin_id        BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
                action          VARCHAR(100) NOT NULL,
                target_type     VARCHAR(50),
                target_id       BIGINT,
                details         JSONB,
                ip_address      VARCHAR(45),
                created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """)

        cur.execute("CREATE INDEX IF NOT EXISTS idx_activity_log_admin ON admin_activity_log(admin_id)")
        conn.commit()
        print("✅ Tables created/verified: admin_users, admin_activity_log")


def create_admin(conn, email: str, full_name: str, password: str, role: str = 'super_admin'):
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt(rounds=12)).decode('utf-8')

    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO admin_users (email, password_hash, full_name, role)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (email) DO UPDATE
                SET password_hash = EXCLUDED.password_hash,
                    full_name     = EXCLUDED.full_name,
                    role          = EXCLUDED.role,
                    updated_at    = NOW()
            RETURNING id, uuid, email, role
            """,
            (email, password_hash, full_name, role)
        )
        row = cur.fetchone()
        conn.commit()
    return row


def main():
    print("\n🛕  BharatMandir — Admin User Setup\n" + "="*40)

    # Connect
    try:
        conn = psycopg2.connect(DATABASE_URL, sslmode='require')
        print("✅ Connected to Neon DB")
    except Exception as e:
        print(f"❌ DB connection failed: {e}")
        sys.exit(1)

    # Create tables
    create_tables(conn)

    # Gather admin details
    print("\nEnter details for the Super Admin account:")
    email     = input("  Email:     ").strip()
    full_name = input("  Full name: ").strip()
    password  = input("  Password:  ").strip()

    if not email or not password:
        print("❌ Email and password cannot be empty")
        sys.exit(1)

    if len(password) < 8:
        print("❌ Password must be at least 8 characters")
        sys.exit(1)

    # Create
    row = create_admin(conn, email, full_name, password, role='super_admin')
    conn.close()

    print(f"\n✅ Super Admin created!")
    print(f"   ID:    {row[0]}")
    print(f"   UUID:  {row[1]}")
    print(f"   Email: {row[2]}")
    print(f"   Role:  {row[3]}")
    print(f"\n🚀 You can now log in at /admin/login with these credentials.")
    print(f"⚠️  Keep your password safe — no recovery mechanism exists yet.\n")


if __name__ == '__main__':
    main()