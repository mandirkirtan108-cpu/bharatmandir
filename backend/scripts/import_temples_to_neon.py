#!/usr/bin/env python3
"""
CSV -> existing temples table importer.

This script loads the generic numbered CSV in backend/data/temples.csv,
maps the values into the existing temples schema, and inserts rows into the
already-created Neon/Supabase database table.

Run from the repo root:
    python backend/scripts/import_temples_to_neon.py --csv backend/data/temples.csv

The `--create-table` flag is accepted for compatibility but ignored, because
the table already exists and has foreign-key dependents.
"""
import argparse
import ast
import csv
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pipeline.cleaner import clean_temple_row, clean_boolean
from pipeline.inserter import bulk_insert_temples


def parse_list(value):
    if value is None:
        return []
    text = str(value).strip()
    if not text:
        return []
    try:
        parsed = ast.literal_eval(text)
        if isinstance(parsed, list):
            return parsed
    except Exception:
        pass
    # fall back to comma-separated text
    text = text.strip('[]')
    return [part.strip().strip("'").strip('"') for part in text.split(',') if part.strip()]


def list_to_pipe(value):
    return '|'.join(str(item).strip() for item in parse_list(value) if str(item).strip())


def csv_row_to_raw_dict(row):
    row = list(row)

    puja_flags = parse_list(row[60]) if len(row) >= 61 else []
    donation_flags = parse_list(row[75]) if len(row) >= 76 else []
    facility_flags = parse_list(row[76]) if len(row) >= 77 else []
    program_flags = parse_list(row[77]) if len(row) >= 78 else []

    raw = {
        'name': row[1] if len(row) > 1 else None,
        'name_hindi': row[2] if len(row) > 2 else None,
        'name_local': row[3] if len(row) > 3 else None,
        'slug': row[4] if len(row) > 4 else None,
        'latitude': row[5] if len(row) > 5 else None,
        'longitude': row[6] if len(row) > 6 else None,
        'address': row[7] if len(row) > 7 else None,
        'city': row[8] if len(row) > 8 else None,
        'district': row[9] if len(row) > 9 else None,
        'state': row[10] if len(row) > 10 else None,
        'pincode': row[11] if len(row) > 11 else None,
        'country': 'India',
        'primary_deity': row[12] if len(row) > 12 else None,
        'secondary_deities': list_to_pipe(row[13]) if len(row) > 13 else None,
        'sect': row[14] if len(row) > 14 else None,
        'temple_type': row[15] if len(row) > 15 else None,
        'is_jyotirlinga': row[16] if len(row) > 16 else None,
        'is_shaktipeeth': row[17] if len(row) > 17 else None,
        'is_divya_desam': row[18] if len(row) > 18 else None,
        'is_ashtavinayak': row[19] if len(row) > 19 else None,
        'is_char_dham': row[20] if len(row) > 20 else None,
        'is_heritage_site': row[21] if len(row) > 21 else None,
        'is_asi_protected': row[22] if len(row) > 22 else None,
        'history': row[23] if len(row) > 23 else None,
        'sthala_purana': row[24] if len(row) > 24 else None,
        'significance': row[25] if len(row) > 25 else None,
        'architecture_style': row[26] if len(row) > 26 else None,
        'estimated_year_built': row[27] if len(row) > 27 else None,
        'opening_time': row[28] if len(row) > 28 else None,
        'closing_time': row[29] if len(row) > 29 else None,
        'entry_fee': row[30] if len(row) > 30 else None,
        'dress_code': row[31] if len(row) > 31 else None,
        'best_time_to_visit': row[32] if len(row) > 32 else None,
        'nearest_railway': row[33] if len(row) > 33 else None,
        'nearest_airport': row[34] if len(row) > 34 else None,
        'website_url': row[35] if len(row) > 35 else None,
        'phone': row[36] if len(row) > 36 else None,
        'hero_image_url': row[37] if len(row) > 37 else None,
        'google_place_id': row[38] if len(row) > 38 else None,
        'category_tags': list_to_pipe(row[39]) if len(row) > 39 else None,
        'managing_authority': row[42] if len(row) > 42 else None,
        'trust_name': row[43] if len(row) > 43 else None,
        'trust_registration_no': row[44] if len(row) > 44 else None,
        'setting_environment': row[45] if len(row) > 45 else None,
        'google_maps_link': row[46] if len(row) > 46 else None,
        'nearest_bus_stand': row[47] if len(row) > 47 else None,
        'local_landmark': row[48] if len(row) > 48 else None,
        'history_hindi': row[49] if len(row) > 49 else None,
        'founded_by': row[50] if len(row) > 50 else None,
        'last_renovation_year': row[51] if len(row) > 51 else None,
        'building_condition': row[52] if len(row) > 52 else None,
        'puranic_stories': row[53] if len(row) > 53 else None,
        'is_pancha_bhuta': row[54] if len(row) > 54 else None,
        'is_51_shakti_peeths': row[55] if len(row) > 55 else None,
        'is_unesco_heritage': row[56] if len(row) > 56 else None,
        'is_state_heritage': row[57] if len(row) > 57 else None,
        'afternoon_closure_start': row[58] if len(row) > 58 else None,
        'afternoon_closure_end': row[59] if len(row) > 59 else None,
        'puja_rudrabhishek': puja_flags[0] if len(puja_flags) > 0 else None,
        'puja_satyanarayan': puja_flags[1] if len(puja_flags) > 1 else None,
        'puja_havan_homa': puja_flags[2] if len(puja_flags) > 2 else None,
        'puja_laghu_rudra': puja_flags[3] if len(puja_flags) > 3 else None,
        'puja_mahamrityunjaya': puja_flags[4] if len(puja_flags) > 4 else None,
        'puja_griha_pravesh': puja_flags[5] if len(puja_flags) > 5 else None,
        'puja_naamkaran': puja_flags[6] if len(puja_flags) > 6 else None,
        'puja_vivah': puja_flags[7] if len(puja_flags) > 7 else None,
        'puja_annaprashan': puja_flags[8] if len(puja_flags) > 8 else None,
        'puja_mundan': puja_flags[9] if len(puja_flags) > 9 else None,
        'puja_pitru_tarpan': puja_flags[10] if len(puja_flags) > 10 else None,
        'puja_sahasranamarchana': puja_flags[11] if len(puja_flags) > 11 else None,
        'online_puja_available': row[61] if len(row) > 61 else None,
        'weekly_special_day': row[62] if len(row) > 62 else None,
        'live_darshan_available': row[63] if len(row) > 63 else None,
        'live_stream_url': row[64] if len(row) > 64 else None,
        'prasad_type': row[65] if len(row) > 65 else None,
        'video_aarti_url': row[66] if len(row) > 66 else None,
        'video_intro_url': row[67] if len(row) > 67 else None,
        'video_360_url': row[68] if len(row) > 68 else None,
        'bank_account_name': row[69] if len(row) > 69 else None,
        'bank_name_branch': row[70] if len(row) > 70 else None,
        'bank_account_number': row[71] if len(row) > 71 else None,
        'bank_ifsc': row[72] if len(row) > 72 else None,
        'upi_id': row[73] if len(row) > 73 else None,
        'certificate_80g_no': row[74] if len(row) > 74 else None,
        'accept_online_donations': donation_flags[0] if len(donation_flags) > 0 else row[75] if len(row) > 75 else None,
        'donation_temple_renovation': donation_flags[1] if len(donation_flags) > 1 else None,
        'donation_annadanam': donation_flags[2] if len(donation_flags) > 2 else None,
        'donation_priest_salary': donation_flags[3] if len(donation_flags) > 3 else None,
        'donation_vedic_education': donation_flags[4] if len(donation_flags) > 4 else None,
        'donation_festival': donation_flags[5] if len(donation_flags) > 5 else None,
        'donation_medical_camps': donation_flags[6] if len(donation_flags) > 6 else None,
        'donation_general': donation_flags[7] if len(donation_flags) > 7 else None,
        'facility_electricity': facility_flags[0] if len(facility_flags) > 0 else None,
        'facility_water_supply': facility_flags[1] if len(facility_flags) > 1 else None,
        'facility_clean_toilets': facility_flags[2] if len(facility_flags) > 2 else None,
        'facility_wheelchair': facility_flags[3] if len(facility_flags) > 3 else None,
        'facility_dharamshala': facility_flags[4] if len(facility_flags) > 4 else None,
        'facility_prasad_dining': facility_flags[5] if len(facility_flags) > 5 else None,
        'facility_parking': facility_flags[6] if len(facility_flags) > 6 else None,
        'facility_security': facility_flags[7] if len(facility_flags) > 7 else None,
        'facility_cctv': facility_flags[8] if len(facility_flags) > 8 else None,
        'facility_pa_system': facility_flags[9] if len(facility_flags) > 9 else None,
        'facility_internet_wifi': facility_flags[10] if len(facility_flags) > 10 else None,
        'facility_library_pathshala': facility_flags[11] if len(facility_flags) > 11 else None,
        'facility_gaushaala': facility_flags[12] if len(facility_flags) > 12 else None,
        'facility_medical_support': facility_flags[13] if len(facility_flags) > 13 else None,
        'prog_free_food': program_flags[0] if len(program_flags) > 0 else None,
        'prog_medical_camps': program_flags[1] if len(program_flags) > 1 else None,
        'prog_scholarship_edu': program_flags[2] if len(program_flags) > 2 else None,
        'prog_womens_selfhelp': program_flags[3] if len(program_flags) > 3 else None,
        'prog_bhajan_kirtan': program_flags[4] if len(program_flags) > 4 else None,
        'prog_disaster_relief': program_flags[5] if len(program_flags) > 5 else None,
        'whatsapp_number': row[78] if len(row) > 78 else None,
        'official_email': row[79] if len(row) > 79 else None,
        'facebook_page': row[80] if len(row) > 80 else None,
        'youtube_channel': row[81] if len(row) > 81 else None,
        'instagram_handle': row[82] if len(row) > 82 else None,
        'best_time_to_call': row[83] if len(row) > 83 else None,
        'status': 'published',
        'source': 'csv_import',
    }

    return raw


def main():
    parser = argparse.ArgumentParser(description='Import temple CSV rows into the existing temples table')
    parser.add_argument('--csv', default='backend/data/temples.csv', help='Path to the numbered temple CSV')
    parser.add_argument('--create-table', action='store_true', help='Ignored; table already exists')
    args = parser.parse_args()

    csv_path = args.csv
    if not os.path.exists(csv_path):
        print(f'CSV file not found: {csv_path}', file=sys.stderr)
        sys.exit(2)

    if args.create_table:
        print('Notice: --create-table is ignored because the live temples table already exists.')

    with open(csv_path, 'r', encoding='utf-8', newline='') as f:
        reader = csv.reader(f)
        try:
            next(reader)
        except StopIteration:
            print('CSV is empty', file=sys.stderr)
            sys.exit(2)

        cleaned_rows = []
        for row in reader:
            raw_row = csv_row_to_raw_dict(row)
            cleaned_rows.append(clean_temple_row(raw_row))

    print(f'Importing {len(cleaned_rows)} rows into the existing temples table...')
    results = bulk_insert_temples(cleaned_rows)
    print(f"Import complete. Inserted={len(results['inserted'])}, skipped={len(results['skipped'])}, failed={len(results['failed'])}")


if __name__ == '__main__':
    main()


if __name__ == '__main__':
    main()
