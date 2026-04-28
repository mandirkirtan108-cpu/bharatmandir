"""
Database Inserter for BharatMandir Pipeline.
Handles bulk inserts with conflict resolution.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.connection import get_db_cursor


def insert_temple_from_pipeline(cleaned_row: dict) -> dict:
    """
    Insert a single cleaned temple row.
    ON CONFLICT DO NOTHING = skip duplicates safely.
    Returns inserted record or None if duplicate.
    """
    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO temples (
                name, name_hindi, slug,
                latitude, longitude, location,
                address, city, district, state, pincode,
                primary_deity, secondary_deities,
                sect, temple_type,
                is_jyotirlinga, is_shaktipeeth,
                is_heritage_site, is_asi_protected,
                history, significance,
                architecture_style, estimated_year_built,
                opening_time, closing_time,
                entry_fee, best_time_to_visit,
                nearest_railway, nearest_airport,
                website_url, category_tags,
                status, source,
                ai_generated, verified
            ) VALUES (
                %(name)s, %(name_hindi)s, %(slug)s,
                %(latitude)s, %(longitude)s,
                ST_GeogFromText(
                    'POINT(' || %(longitude)s || ' ' || %(latitude)s || ')'
                ),
                %(address)s, %(city)s, %(district)s, %(state)s, %(pincode)s,
                %(primary_deity)s, %(secondary_deities)s,
                %(sect)s, %(temple_type)s,
                %(is_jyotirlinga)s, %(is_shaktipeeth)s,
                %(is_heritage_site)s, %(is_asi_protected)s,
                %(history)s, %(significance)s,
                %(architecture_style)s, %(estimated_year_built)s,
                %(opening_time)s, %(closing_time)s,
                %(entry_fee)s, %(best_time_to_visit)s,
                %(nearest_railway)s, %(nearest_airport)s,
                %(website_url)s, %(category_tags)s,
                %(status)s, %(source)s,
                FALSE, FALSE
            )
            ON CONFLICT (slug) DO NOTHING
            RETURNING id, name, slug
        """, cleaned_row)

        return cur.fetchone()


def bulk_insert_temples(cleaned_rows: list) -> dict:
    """
    Insert multiple temples and return summary stats.
    Processes one by one so a single failure 
    doesn't kill the entire batch.
    """
    results = {
        'inserted': [],
        'skipped':  [],
        'failed':   []
    }

    for i, row in enumerate(cleaned_rows):
        try:
            record = insert_temple_from_pipeline(row)

            if record:
                results['inserted'].append(record)
                print(f"  ✅ [{i+1}] Inserted: {row['name']}")
            else:
                results['skipped'].append(row['name'])
                print(f"  ⏭️  [{i+1}] Skipped (duplicate): {row['name']}")

        except Exception as e:
            results['failed'].append({
                'name':  row.get('name', 'Unknown'),
                'error': str(e)
            })
            print(f"  ❌ [{i+1}] Failed: {row.get('name')} → {e}")

    return results