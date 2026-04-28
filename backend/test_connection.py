"""
Run this to verify everything is working.
Command: python test_connection.py
"""

from db.connection import test_connection
from db.queries import (
    get_all_temples,
    get_temple_by_slug,
    get_temples_near_location,
    get_temple_mantras,
    search_temples
)


def run_all_tests():
    print("\n" + "="*50)
    print("   BharatMandir — Database Connection Tests")
    print("="*50 + "\n")

    # Test 1: Basic connection
    print("TEST 1: Basic Connection")
    print("-" * 30)
    test_connection()

    # Test 2: Fetch all temples
    print("\nTEST 2: Fetch All Temples")
    print("-" * 30)
    temples = get_all_temples()
    print(f"✅ Found {len(temples)} published temples")
    for t in temples:
        print(f"   → {t['name']} | {t['city']} | {t['primary_deity']}")

    # Test 3: Fetch by slug
    print("\nTEST 3: Fetch Temple by Slug")
    print("-" * 30)
    temple = get_temple_by_slug('mahakaleshwar-jyotirlinga-ujjain')
    if temple:
        print(f"✅ Found: {temple['name']}")
        print(f"   Deity: {temple['primary_deity']}")
        print(f"   Type:  {temple['temple_type']}")
        print(f"   Open:  {temple['opening_time']} - {temple['closing_time']}")

    # Test 4: Nearby temples (from Ujjain city center)
    print("\nTEST 4: Temples Near Ujjain (10km radius)")
    print("-" * 30)
    nearby = get_temples_near_location(
        lat=23.1765, lng=75.7885,
        radius_km=10
    )
    print(f"✅ Found {len(nearby)} temples within 10km")
    for t in nearby:
        print(f"   → {t['name']:<40} {t['distance_km']} km away")

    # Test 5: Search
    print("\nTEST 5: Search for 'Shiva'")
    print("-" * 30)
    results = search_temples('Shiva')
    print(f"✅ Found {len(results)} results for 'Shiva'")
    for r in results:
        print(f"   → {r['name']} (rank: {r['rank']:.4f})")

    # Test 6: Mantras
    print("\nTEST 6: Mantras for Mahakaleshwar")
    print("-" * 30)
    mantras = get_temple_mantras(temple_id=1)
    print(f"✅ Found {len(mantras)} mantras")
    for m in mantras:
        print(f"   → {m['title']} ({m['mantra_type']})")

    print("\n" + "="*50)
    print("   All tests complete!")
    print("="*50 + "\n")


if __name__ == "__main__":
    run_all_tests()