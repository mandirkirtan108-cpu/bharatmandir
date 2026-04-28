"""
BharatMandir Data Pipeline — Master Script
Run this to import temples from CSV/Excel into PostgreSQL.

Usage:
    python pipeline/run_pipeline.py
    python pipeline/run_pipeline.py --file data/temples_ujjain.csv
    python pipeline/run_pipeline.py --file data/temples.xlsx
"""

import sys
import os
import argparse
import pandas as pd

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.validator import validate_dataframe
from pipeline.cleaner   import clean_temple_row
from pipeline.inserter  import bulk_insert_temples


def load_file(filepath: str) -> pd.DataFrame:
    """Load CSV or Excel file into DataFrame."""
    ext = os.path.splitext(filepath)[1].lower()

    if ext == '.csv':
        df = pd.read_csv(filepath, dtype=str, encoding='utf-8')
    elif ext in ('.xlsx', '.xls'):
        df = pd.read_excel(filepath, dtype=str)
    else:
        raise ValueError(f"Unsupported file type: {ext}. Use .csv or .xlsx")

    # Strip whitespace from all column names
    df.columns = df.columns.str.strip()
    print(f"📂 Loaded {len(df)} rows from {filepath}")
    return df


def print_validation_report(valid, invalid, all_results):
    """Print a clear validation summary."""
    print(f"\n{'─'*50}")
    print(f"📋 VALIDATION REPORT")
    print(f"{'─'*50}")
    print(f"  ✅ Valid rows:   {len(valid)}")
    print(f"  ❌ Invalid rows: {len(invalid)}")

    # Print warnings for valid rows
    warnings_found = False
    for result in all_results:
        if result.warnings and result.is_valid:
            if not warnings_found:
                print(f"\n  ⚠️  Warnings (rows will still insert):")
                warnings_found = True
            print(f"    Row {result.row_index}: {', '.join(result.warnings)}")

    # Print errors for invalid rows
    if invalid:
        print(f"\n  🚨 Errors (rows will be SKIPPED):")
        for index, row, errors in invalid:
            name = row.get('name', 'Unknown')
            print(f"    Row {index} ({name}):")
            for err in errors:
                print(f"      → {err}")


def run_pipeline(filepath: str):
    """Main pipeline execution."""
    
    print("\n" + "="*50)
    print("  🛕  BharatMandir Data Pipeline")
    print("="*50)

    # ── STEP 1: LOAD ──────────────────────────────────
    print(f"\n📂 STEP 1: Loading file...")
    df = load_file(filepath)
    print(f"  Columns found: {list(df.columns)}")

    # ── STEP 2: VALIDATE ──────────────────────────────
    print(f"\n🔍 STEP 2: Validating {len(df)} rows...")
    valid_rows, invalid_rows, all_results = validate_dataframe(df)
    print_validation_report(valid_rows, invalid_rows, all_results)

    if not valid_rows:
        print("\n❌ No valid rows to insert. Fix errors above and retry.")
        return

    # ── STEP 3: CLEAN ─────────────────────────────────
    print(f"\n🧹 STEP 3: Cleaning {len(valid_rows)} valid rows...")
    cleaned_rows = [clean_temple_row(row) for row in valid_rows]
    print(f"  ✅ Cleaning complete")

    # ── STEP 4: INSERT ────────────────────────────────
    print(f"\n💾 STEP 4: Inserting into database...")
    results = bulk_insert_temples(cleaned_rows)

    # ── FINAL SUMMARY ─────────────────────────────────
    print(f"\n{'='*50}")
    print(f"  🏁 PIPELINE COMPLETE")
    print(f"{'='*50}")
    print(f"  ✅ Inserted:  {len(results['inserted'])} temples")
    print(f"  ⏭️  Skipped:   {len(results['skipped'])} (duplicates)")
    print(f"  ❌ Failed:    {len(results['failed'])} temples")

    if results['inserted']:
        print(f"\n  Newly added temples:")
        for t in results['inserted']:
            print(f"    → {t['name']} (id: {t['id']})")

    if results['failed']:
        print(f"\n  Failed temples:")
        for f in results['failed']:
            print(f"    → {f['name']}: {f['error']}")

    print()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='BharatMandir Data Pipeline')
    parser.add_argument(
        '--file',
        default='data/temples_ujjain.csv',
        help='Path to CSV or Excel file'
    )
    args = parser.parse_args()

    filepath = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        args.file
    )

    run_pipeline(filepath)