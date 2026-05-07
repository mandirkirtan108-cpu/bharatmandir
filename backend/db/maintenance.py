"""
Database maintenance tasks for BharatMandir.
Run weekly in production to keep the DB healthy.
"""

import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.connection import get_db_cursor, get_db_connection


def run_vacuum_analyze():
    print("🧹 Running VACUUM ANALYZE...")
    with get_db_connection() as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("VACUUM ANALYZE temples;")
            # BUG FIX: table is 'temple_media' not 'photos'
            # (photos is a separate legacy table; temple_media is what admin routes use)
            cur.execute("VACUUM ANALYZE temple_media;")
            cur.execute("VACUUM ANALYZE photos;")      # legacy — keep for safety
            cur.execute("VACUUM ANALYZE mantras;")
            cur.execute("VACUUM ANALYZE festivals;")
            cur.execute("VACUUM ANALYZE sevas;")
            cur.execute("VACUUM ANALYZE temple_puja_schedule;")
            cur.execute("VACUUM ANALYZE temple_priests;")
    print("✅ VACUUM ANALYZE complete")


def get_table_stats():
    print("\n📊 TABLE STATISTICS")
    print("─" * 60)
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                relname        AS table_name,
                n_live_tup     AS live_rows,
                n_dead_tup     AS dead_rows,
                pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
                pg_size_pretty(pg_indexes_size(relid))        AS index_size,
                last_vacuum,
                last_analyze
            FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC;
        """)
        for row in cur.fetchall():
            print(f"\n  Table: {row['table_name']}")
            print(f"    Live rows:  {row['live_rows']}")
            print(f"    Dead rows:  {row['dead_rows']}")
            print(f"    Total size: {row['total_size']}")
            print(f"    Index size: {row['index_size']}")


def get_index_health():
    print("\n🗂️  INDEX HEALTH REPORT")
    print("─" * 60)
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                relname        AS tablename,
                indexrelname   AS indexname,
                idx_scan       AS times_used,
                pg_size_pretty(pg_relation_size(indexrelid)) AS size
            FROM pg_stat_user_indexes
            ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;
        """)
        for idx in cur.fetchall():
            flag = "⚠️ " if idx['times_used'] == 0 else "✅ "
            print(f"  {flag} {idx['indexname']:<45} used={idx['times_used']:<6} size={idx['size']}")


def get_null_data_report():
    """Show which temples are still missing key fields — useful after patch_temples.py."""
    print("\n🔍 TEMPLE DATA COMPLETENESS")
    print("─" * 60)
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                name, slug, status,
                CASE WHEN history IS NULL THEN '❌' ELSE '✅' END AS has_history,
                CASE WHEN significance IS NULL THEN '❌' ELSE '✅' END AS has_significance,
                CASE WHEN opening_time IS NULL THEN '❌' ELSE '✅' END AS has_timings,
                CASE WHEN hero_image_url IS NULL THEN '❌' ELSE '✅' END AS has_image,
                CASE WHEN dress_code IS NULL THEN '❌' ELSE '✅' END AS has_dress_code
            FROM temples
            ORDER BY name;
        """)
        rows = cur.fetchall()
        for r in rows:
            print(f"\n  {r['name']} ({r['status']})")
            print(f"    History:{r['has_history']}  Significance:{r['has_significance']}  "
                  f"Timings:{r['has_timings']}  Image:{r['has_image']}  Dress:{r['has_dress_code']}")


def get_slow_queries():
    print("\n🐢 SLOW QUERY CHECK")
    print("─" * 60)
    with get_db_cursor() as cur:
        cur.execute("SELECT COUNT(*) as count FROM pg_extension WHERE extname = 'pg_stat_statements';")
        if cur.fetchone()['count'] == 0:
            print("  ℹ️  pg_stat_statements not enabled — fine for dev.")
        else:
            print("  ✅ pg_stat_statements is enabled")


if __name__ == "__main__":
    get_table_stats()
    get_index_health()
    get_null_data_report()
    get_slow_queries()
    print("\n✅ Maintenance report complete\n")