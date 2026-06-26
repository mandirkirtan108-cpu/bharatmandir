from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from db.panchang_cache import ensure_panchang_cache_table


def main() -> int:
    ensure_panchang_cache_table()
    print("panchang_cache table is ready.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
