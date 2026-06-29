from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from db.connection import get_db_cursor


def main() -> int:
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT
                COUNT(*) AS total,
                MIN(date)::text AS first_date,
                MAX(date)::text AS last_date,
                coordinates,
                calendar_type,
                language,
                ayanamsa,
                source
            FROM panchang_cache
            WHERE date >= '2026-06-01'
              AND date <= '2026-07-31'
            GROUP BY coordinates, calendar_type, language, ayanamsa, source
            ORDER BY coordinates, calendar_type, language, ayanamsa, source
            """
        )
        rows = cur.fetchall()

    if not rows:
        print("No Panchang cache rows found for June-July 2026.")
        return 0

    for row in rows:
        print(
            f"{row['total']} rows | {row['first_date']} to {row['last_date']} | "
            f"coordinates={row['coordinates']} | calendar={row['calendar_type']} | "
            f"language={row['language']} | ayanamsa={row['ayanamsa']} | source={row['source']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
