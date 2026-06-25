from __future__ import annotations

import argparse
import time
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from services.prokerala_client import DEFAULT_CALENDAR, DEFAULT_COORDINATES, DEFAULT_LANGUAGE, PanchangQuery, ProkeralaClient


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Bharat Mandir Panchang cache from Prokerala.")
    parser.add_argument("--year", type=int, required=True)
    parser.add_argument("--coordinates", default=DEFAULT_COORDINATES)
    parser.add_argument("--calendar", default=DEFAULT_CALENDAR)
    parser.add_argument("--language", default=DEFAULT_LANGUAGE)
    parser.add_argument("--delay", type=float, default=61.0, help="Delay between days. Sandbox/free tier is 5 requests per 60 seconds, and one day uses multiple calls.")
    parser.add_argument("--include-timing-details", action="store_true", help="Also fetch Choghadiya and Hora. This is slower and more likely to hit sandbox/free-tier limits.")
    parser.add_argument("--sandbox", action="store_true", help="Generate only January 1 because Prokerala sandbox clients reject other dates.")
    args = parser.parse_args()

    client = ProkeralaClient()
    total = 0
    month_range = [1] if args.sandbox else range(1, 13)
    for month in month_range:
        import calendar as calendar_module

        day_range = [1] if args.sandbox else range(1, calendar_module.monthrange(args.year, month)[1] + 1)
        for day in day_range:
            current = f"{args.year}-{month:02d}-{day:02d}"
            print(f"Generating {current}...")
            payload = client.get_day(
                PanchangQuery(
                    date=current,
                    coordinates=args.coordinates,
                    calendar=args.calendar,
                    language=args.language,
                ),
                force_refresh=True,
                include_timing_details=args.include_timing_details,
            )
            for warning in payload.get("warnings", []):
                print(f"  warning: {warning['endpoint']} skipped: {warning.get('message')}")
            total += 1
            time.sleep(args.delay)
    print(f"Generated {total} cached Panchang days for {args.year}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
