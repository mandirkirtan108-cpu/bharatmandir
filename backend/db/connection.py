"""
Database Connection Manager for BharatMandir
Uses connection pooling for production scalability.
A connection pool keeps multiple DB connections open and reuses them,
instead of opening/closing a new connection for every request.
"""

import os
import psycopg2
from psycopg2 import pool, extras
from dotenv import load_dotenv
from contextlib import contextmanager

# Load environment variables from .env file
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# ─────────────────────────────────────────────
# Database Configuration
# ─────────────────────────────────────────────

DB_CONFIG = {
    "host":     os.getenv("DB_HOST", "localhost"),
    "port":     int(os.getenv("DB_PORT", 5432)),
    "dbname":   os.getenv("DB_NAME", "bharatmandir"),
    "user":     os.getenv("DB_USER", "postgres"),
    "password": os.getenv("DB_PASSWORD", ""),
}


# ─────────────────────────────────────────────
# Connection Pool (Production Ready)
# ─────────────────────────────────────────────
# minconn=2  → always keep 2 connections open (ready to use)
# maxconn=10 → never open more than 10 at once
# At 10,000 temples with 1000 users, 10 connections is enough.

_pool = None  # Global pool instance


def get_pool():
    global _pool
    if _pool is None:
        try:
            _pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=2,
                maxconn=10,
                dsn=DATABASE_URL  # 🔥 THIS IS THE KEY CHANGE
            )
            print("✅ Connected to Neon DB successfully")
        except psycopg2.OperationalError as e:
            print(f"❌ Failed to connect: {e}")
            raise
    return _pool


def close_pool():
    """Cleanly close all connections. Call when app shuts down."""
    global _pool
    if _pool:
        _pool.closeall()
        _pool = None
        print("🔒 Connection pool closed")


# ─────────────────────────────────────────────
# Context Manager (The RIGHT way to use connections)
# ─────────────────────────────────────────────

@contextmanager
def get_db_connection():
    """
    Context manager for database connections.
    
    Usage:
        with get_db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT ...")
    
    Automatically:
    - Gets connection from pool
    - Commits on success
    - Rolls back on error
    - Returns connection to pool
    """
    pool = get_pool()
    conn = pool.getconn()
    
    try:
        yield conn
        conn.commit()  # Auto-commit on success
    except Exception as e:
        conn.rollback()  # Auto-rollback on any error
        print(f"❌ Database error, rolling back: {e}")
        raise
    finally:
        pool.putconn(conn)  # Always return to pool


@contextmanager
def get_db_cursor(cursor_factory=None):
    """
    Context manager for database cursors.
    RealDictCursor returns rows as dicts instead of tuples.
    
    Usage:
        with get_db_cursor() as cur:
            cur.execute("SELECT * FROM temples")
            rows = cur.fetchall()
            # rows[0]['name'] ← dict access (much better!)
    """
    factory = cursor_factory or extras.RealDictCursor
    
    with get_db_connection() as conn:
        cursor = conn.cursor(cursor_factory=factory)
        try:
            yield cursor
        finally:
            cursor.close()


# ─────────────────────────────────────────────
# Simple test function
# ─────────────────────────────────────────────

def test_connection():
    """Test that database connection works."""
    try:
        with get_db_cursor() as cur:
            cur.execute("SELECT version();")
            version = cur.fetchone()
            print(f"✅ Connected to: {version['version'][:50]}")
            
            cur.execute("SELECT COUNT(*) as count FROM temples;")
            result = cur.fetchone()
            print(f"✅ Temples in database: {result['count']}")
            
            cur.execute("SELECT PostGIS_Version();")
            postgis = cur.fetchone()
            print(f"✅ PostGIS version: {postgis['postgis_version'][:30]}")
            
        return True
    except Exception as e:
        print(f"❌ Connection test failed: {e}")
        return False