"""
Schema Inspector for BharatMandir
Run this to see actual column names in your database tables
python schema_inspector.py
"""

import os
import sys
from dotenv import load_dotenv
from db.connection import get_db_cursor

load_dotenv()

def inspect_table(table_name):
    """Show all columns in a table."""
    print(f"\n{'='*60}")
    print(f"TABLE: {table_name}")
    print('='*60)
    
    with get_db_cursor() as cur:
        cur.execute(f"""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = %s
            ORDER BY ordinal_position
        """, (table_name,))
        
        rows = cur.fetchall()
        
        if not rows:
            print(f"❌ Table '{table_name}' not found!")
            return
        
        print(f"\n{'Column Name':<30} {'Data Type':<20} {'Nullable':<10}")
        print("-" * 60)
        for row in rows:
            col_name = row['column_name']
            data_type = row['data_type']
            nullable = 'YES' if row['is_nullable'] == 'YES' else 'NO'
            print(f"{col_name:<30} {data_type:<20} {nullable:<10}")
        
        print(f"\nTotal columns: {len(rows)}")


def inspect_all():
    """Inspect all BharatMandir tables."""
    tables = [
        'temples',
        'mantras',
        'festivals',
        'sevas',
        'photos',
        'temple_puja_schedule',
        'temple_priests',
        'temple_media',
        'temple_committees',
    ]
    
    for table in tables:
        try:
            inspect_table(table)
        except Exception as e:
            print(f"\n❌ Error inspecting {table}: {e}")


if __name__ == '__main__':
    print("\n🔍 BharatMandir Schema Inspector\n")
    
    try:
        inspect_all()
        print("\n" + "="*60)
        print("✅ Schema inspection complete!")
        print("="*60 + "\n")
    except Exception as e:
        print(f"\n❌ Failed to inspect schema: {e}")
        print("Make sure your database connection is working.")