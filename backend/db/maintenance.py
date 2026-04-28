"""
Database maintenance tasks for BharatMandir.
Run weekly in production to keep the DB healthy.
"""

import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.connection import get_db_cursor, get_db_connection


def run_vacuum_analyze():
    """
    VACUUM  = reclaim storage from deleted rows
    ANALYZE = update statistics so query planner makes better decisions
    """
    print("🧹 Running VACUUM ANALYZE...")
    with get_db_connection() as conn:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("VACUUM ANALYZE temples;")
            cur.execute("VACUUM ANALYZE photos;")
            cur.execute("VACUUM ANALYZE mantras;")
            cur.execute("VACUUM ANALYZE festivals;")
            cur.execute("VACUUM ANALYZE sevas;")
    print("✅ VACUUM ANALYZE complete")


def get_table_stats():
    """Show size and row counts for all tables."""
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
        rows = cur.fetchall()

        for row in rows:
            print(f"\n  Table: {row['table_name']}")
            print(f"    Live rows:  {row['live_rows']}")
            print(f"    Dead rows:  {row['dead_rows']}")
            print(f"    Total size: {row['total_size']}")
            print(f"    Index size: {row['index_size']}")


def get_index_health():
    """Find unused indexes that waste space."""
    print("\n🗂️  INDEX HEALTH REPORT")
    print("─" * 60)

    with get_db_cursor() as cur:
        cur.execute("""
            SELECT
                schemaname,
                relname        AS tablename,
                indexrelname   AS indexname,
                idx_scan       AS times_used,
                pg_size_pretty(pg_relation_size(indexrelid)) AS size
            FROM pg_stat_user_indexes
            ORDER BY idx_scan ASC,
                     pg_relation_size(indexrelid) DESC;
        """)
        indexes = cur.fetchall()

        print("\n  Index usage report:")
        for idx in indexes:
            flag = "⚠️ " if idx['times_used'] == 0 else "✅ "
            print(
                f"  {flag} {idx['indexname']:<45} "
                f"used={idx['times_used']:<6} "
                f"size={idx['size']}"
            )


def get_slow_queries():
    """Check if slow query tracking is enabled."""
    print("\n🐢 SLOW QUERY CHECK")
    print("─" * 60)

    with get_db_cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) as count
            FROM pg_extension
            WHERE extname = 'pg_stat_statements';
        """)
        result = cur.fetchone()

        if result['count'] == 0:
            print("  ℹ️  pg_stat_statements not enabled yet.")
            print("  This is fine for now — we will enable it in production.")
        else:
            print("  ✅ pg_stat_statements is enabled")


if __name__ == "__main__":
    get_table_stats()
    get_index_health()
    get_slow_queries()
    print("\n✅ Maintenance report complete\n")