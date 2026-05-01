"""
Database Connection Manager for BharatMandir
Uses connection pooling for production scalability.
A connection pool keeps multiple DB connections open and reuses them,
instead of opening/closing a new connection for every request.

Fixes applied:
- Stale connection detection (Neon DB drops idle SSL connections)
- Safe rollback that handles already-closed connections
- TCP keepalives to prevent Neon from dropping idle connections
- Pool recreation if the entire pool goes bad
"""

import os
import psycopg2
from psycopg2 import pool, extras, OperationalError, InterfaceError
from dotenv import load_dotenv
from contextlib import contextmanager

# Load environment variables from .env file
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

# ─────────────────────────────────────────────
# Connection Pool (Production Ready)
# ─────────────────────────────────────────────
# minconn=2  → always keep 2 connections open (ready to use)
# maxconn=10 → never open more than 10 at once

_pool = None  # Global pool instance


def _create_pool():
    """Create a new connection pool with keepalive settings."""
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL is not set in your .env file")
    return psycopg2.pool.ThreadedConnectionPool(
        minconn=2,
        maxconn=10,
        dsn=DATABASE_URL,
        # ── Keepalives: prevent Neon from dropping idle SSL connections ──
        keepalives=1,
        keepalives_idle=30,      # Send first keepalive after 30s of idle
        keepalives_interval=10,  # Retry every 10s if no response
        keepalives_count=5,      # Drop connection after 5 failed keepalives
    )


def get_pool():
    global _pool
    if _pool is None or _pool.closed:
        try:
            _pool = _create_pool()
            print("✅ Connected to Neon DB successfully")
        except OperationalError as e:
            print(f"❌ Failed to connect: {e}")
            raise
    return _pool


def _is_connection_alive(conn) -> bool:
    """
    Ping the connection with a cheap query.
    Returns False if the connection is stale/closed.
    """
    try:
        conn.cursor().execute("SELECT 1")
        return True
    except (OperationalError, InterfaceError):
        return False


def close_pool():
    """Cleanly close all connections. Call when app shuts down."""
    global _pool
    if _pool and not _pool.closed:
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
    - Gets a live connection from pool (replaces stale ones)
    - Commits on success
    - Rolls back on error (safely, even if connection dropped mid-request)
    - Returns connection to pool
    """
    p = get_pool()
    conn = p.getconn()

    # ── Stale connection check ──────────────────────────────────────────
    # Neon DB (serverless Postgres) aggressively closes idle SSL connections.
    # If the pooled connection is dead, discard it and get a fresh one.
    if not _is_connection_alive(conn):
        print("⚠️  Stale connection detected, replacing...")
        try:
            p.putconn(conn, close=True)  # Discard the dead connection
        except Exception:
            pass
        conn = p.getconn()              # Get a fresh one
    # ───────────────────────────────────────────────────────────────────

    try:
        yield conn
        conn.commit()       # Auto-commit on success
    except Exception as e:
        # ── Safe rollback ───────────────────────────────────────────────
        # The connection may have dropped mid-request (e.g. Neon SSL drop).
        # Attempting rollback on a closed connection raises InterfaceError,
        # so we catch and suppress it — the transaction is already gone.
        try:
            conn.rollback()
        except (OperationalError, InterfaceError):
            print("⚠️  Connection lost mid-request, skipping rollback")
        # ───────────────────────────────────────────────────────────────
        print(f"❌ Database error, rolling back: {e}")
        raise
    finally:
        # Return connection to pool. If it's broken, close it outright.
        try:
            p.putconn(conn)
        except Exception:
            try:
                p.putconn(conn, close=True)
            except Exception:
                pass


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