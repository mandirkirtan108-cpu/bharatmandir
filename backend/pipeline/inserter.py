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
                name, name_hindi, name_local, slug,
                latitude, longitude, location,
                address, city, district, state, pincode, country,
                primary_deity, secondary_deities, sect, temple_type,
                is_jyotirlinga, is_shaktipeeth, is_divya_desam,
                is_ashtavinayak, is_char_dham,
                is_heritage_site, is_asi_protected,
                is_pancha_bhuta, is_51_shakti_peeths,
                is_unesco_heritage, is_state_heritage,
                history, sthala_purana, significance,
                history_hindi, puranic_stories,
                architecture_style, estimated_year_built,
                founded_by, last_renovation_year, building_condition,
                opening_time, closing_time,
                afternoon_closure_start, afternoon_closure_end,
                entry_fee, dress_code, best_time_to_visit,
                nearest_railway, nearest_airport, nearest_bus_stand,
                local_landmark, google_maps_link,
                website_url, phone, whatsapp_number,
                official_email, facebook_page, youtube_channel,
                instagram_handle, best_time_to_call,
                hero_image_url, google_place_id,
                video_aarti_url, video_intro_url, video_360_url,
                live_stream_url, prasad_type,
                category_tags, status, source,
                managing_authority, trust_name, trust_registration_no,
                setting_environment,
                online_puja_available, live_darshan_available,
                weekly_special_day,
                puja_rudrabhishek, puja_satyanarayan, puja_havan_homa,
                puja_laghu_rudra, puja_mahamrityunjaya, puja_griha_pravesh,
                puja_naamkaran, puja_vivah, puja_annaprashan,
                puja_mundan, puja_pitru_tarpan, puja_sahasranamarchana,
                facility_electricity, facility_water_supply, facility_clean_toilets,
                facility_wheelchair, facility_dharamshala, facility_prasad_dining,
                facility_parking, facility_security, facility_cctv,
                facility_pa_system, facility_internet_wifi,
                facility_library_pathshala, facility_gaushaala,
                facility_medical_support,
                prog_free_food, prog_medical_camps, prog_scholarship_edu,
                prog_womens_selfhelp, prog_bhajan_kirtan, prog_disaster_relief,
                accept_online_donations, upi_id,
                bank_account_name, bank_name_branch,
                bank_account_number, bank_ifsc, certificate_80g_no,
                donation_temple_renovation, donation_annadanam,
                donation_priest_salary, donation_vedic_education,
                donation_festival, donation_medical_camps, donation_general,
                wikidata_id, wikipedia_url, osm_id,
                ai_generated, verified
            ) VALUES (
                %(name)s, %(name_hindi)s, %(name_local)s, %(slug)s,
                %(latitude)s, %(longitude)s,
                ST_GeogFromText(
                    'POINT(' || %(longitude)s || ' ' || %(latitude)s || ')'
                ),
                %(address)s, %(city)s, %(district)s, %(state)s, %(pincode)s, %(country)s,
                %(primary_deity)s, %(secondary_deities)s, %(sect)s, %(temple_type)s,
                %(is_jyotirlinga)s, %(is_shaktipeeth)s, %(is_divya_desam)s,
                %(is_ashtavinayak)s, %(is_char_dham)s,
                %(is_heritage_site)s, %(is_asi_protected)s,
                %(is_pancha_bhuta)s, %(is_51_shakti_peeths)s,
                %(is_unesco_heritage)s, %(is_state_heritage)s,
                %(history)s, %(sthala_purana)s, %(significance)s,
                %(history_hindi)s, %(puranic_stories)s,
                %(architecture_style)s, %(estimated_year_built)s,
                %(founded_by)s, %(last_renovation_year)s, %(building_condition)s,
                %(opening_time)s, %(closing_time)s,
                %(afternoon_closure_start)s, %(afternoon_closure_end)s,
                %(entry_fee)s, %(dress_code)s, %(best_time_to_visit)s,
                %(nearest_railway)s, %(nearest_airport)s, %(nearest_bus_stand)s,
                %(local_landmark)s, %(google_maps_link)s,
                %(website_url)s, %(phone)s, %(whatsapp_number)s,
                %(official_email)s, %(facebook_page)s, %(youtube_channel)s,
                %(instagram_handle)s, %(best_time_to_call)s,
                %(hero_image_url)s, %(google_place_id)s,
                %(video_aarti_url)s, %(video_intro_url)s, %(video_360_url)s,
                %(live_stream_url)s, %(prasad_type)s,
                %(category_tags)s, %(status)s, %(source)s,
                %(managing_authority)s, %(trust_name)s, %(trust_registration_no)s,
                %(setting_environment)s,
                %(online_puja_available)s, %(live_darshan_available)s,
                %(weekly_special_day)s,
                %(puja_rudrabhishek)s, %(puja_satyanarayan)s, %(puja_havan_homa)s,
                %(puja_laghu_rudra)s, %(puja_mahamrityunjaya)s, %(puja_griha_pravesh)s,
                %(puja_naamkaran)s, %(puja_vivah)s, %(puja_annaprashan)s,
                %(puja_mundan)s, %(puja_pitru_tarpan)s, %(puja_sahasranamarchana)s,
                %(facility_electricity)s, %(facility_water_supply)s, %(facility_clean_toilets)s,
                %(facility_wheelchair)s, %(facility_dharamshala)s, %(facility_prasad_dining)s,
                %(facility_parking)s, %(facility_security)s, %(facility_cctv)s,
                %(facility_pa_system)s, %(facility_internet_wifi)s,
                %(facility_library_pathshala)s, %(facility_gaushaala)s,
                %(facility_medical_support)s,
                %(prog_free_food)s, %(prog_medical_camps)s, %(prog_scholarship_edu)s,
                %(prog_womens_selfhelp)s, %(prog_bhajan_kirtan)s, %(prog_disaster_relief)s,
                %(accept_online_donations)s, %(upi_id)s,
                %(bank_account_name)s, %(bank_name_branch)s,
                %(bank_account_number)s, %(bank_ifsc)s, %(certificate_80g_no)s,
                %(donation_temple_renovation)s, %(donation_annadanam)s,
                %(donation_priest_salary)s, %(donation_vedic_education)s,
                %(donation_festival)s, %(donation_medical_camps)s, %(donation_general)s,
                %(wikidata_id)s, %(wikipedia_url)s, %(osm_id)s,
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