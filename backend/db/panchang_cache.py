from __future__ import annotations

from typing import Any

from psycopg2.extras import Json

from db.connection import get_db_cursor


def ensure_panchang_cache_table() -> None:
    with get_db_cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS panchang_cache (
                id BIGSERIAL PRIMARY KEY,
                date DATE NOT NULL,
                coordinates TEXT NOT NULL,
                calendar_type TEXT NOT NULL DEFAULT 'amanta',
                language TEXT NOT NULL DEFAULT 'en',
                ayanamsa INTEGER NOT NULL DEFAULT 1,
                payload JSONB NOT NULL,
                source TEXT NOT NULL DEFAULT 'divineapi',
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (date, coordinates, calendar_type, language, ayanamsa)
            );
            CREATE INDEX IF NOT EXISTS idx_panchang_cache_month
                ON panchang_cache (date, coordinates, calendar_type, language, ayanamsa);
            """
        )


def get_cached_panchang(
    date_value: str,
    coordinates: str,
    calendar_type: str,
    language: str,
    ayanamsa: int,
) -> dict[str, Any] | None:
    ensure_panchang_cache_table()
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT payload
            FROM panchang_cache
            WHERE date = %s
              AND coordinates = %s
              AND calendar_type = %s
              AND language = %s
              AND ayanamsa = %s
            """,
            (date_value, coordinates, calendar_type, language, ayanamsa),
        )
        row = cur.fetchone()
        return row["payload"] if row else None


def get_cached_panchang_month(
    start_date: str,
    end_date: str,
    coordinates: str,
    calendar_type: str,
    language: str,
    ayanamsa: int,
) -> dict[str, dict[str, Any]]:
    ensure_panchang_cache_table()
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT date::text AS date_key, payload
            FROM panchang_cache
            WHERE date >= %s
              AND date <= %s
              AND coordinates = %s
              AND calendar_type = %s
              AND language = %s
              AND ayanamsa = %s
            ORDER BY date
            """,
            (start_date, end_date, coordinates, calendar_type, language, ayanamsa),
        )
        return {row["date_key"]: row["payload"] for row in cur.fetchall()}


def save_cached_panchang(
    date_value: str,
    coordinates: str,
    calendar_type: str,
    language: str,
    ayanamsa: int,
    payload: dict[str, Any],
) -> None:
    ensure_panchang_cache_table()
    with get_db_cursor() as cur:
        cur.execute(
            """
            INSERT INTO panchang_cache (
                date, coordinates, calendar_type, language, ayanamsa, payload, source
            ) VALUES (%s, %s, %s, %s, %s, %s, 'divineapi')
            ON CONFLICT (date, coordinates, calendar_type, language, ayanamsa)
            DO UPDATE SET
                payload = EXCLUDED.payload,
                source = EXCLUDED.source,
                updated_at = NOW()
            """,
            (date_value, coordinates, calendar_type, language, ayanamsa, Json(payload)),
        )
