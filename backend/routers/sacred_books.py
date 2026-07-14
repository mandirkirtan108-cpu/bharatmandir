import os, sys, time, httpx, re
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from db.connection import get_db_cursor

router = APIRouter(tags=["Sacred Books"])

# ─────────────────────────────────────────────────────────────────────────────
# CACHE
# ─────────────────────────────────────────────────────────────────────────────
_cache: dict = {}
_CACHE_TTL = 86400  # 24 hours


def _cache_get(key: str):
    entry = _cache.get(key)
    if entry and time.time() - entry["ts"] < _CACHE_TTL:
        return entry["data"]
    return None


def _cache_set(key: str, data):
    _cache[key] = {"data": data, "ts": time.time()}
    return data


def _fetch_json(url: str):
    with httpx.Client(timeout=30, follow_redirects=True) as client:
        r = client.get(url)
        r.raise_for_status()
        return r.json()


# ═════════════════════════════════════════════════════════════════════════════
# BHAGAVAD GITA  (vedicscriptures.github.io — all 21 commentators)
# ═════════════════════════════════════════════════════════════════════════════

_GITA_CHAPTERS = {
    1:  ("Arjuna Vishada Yoga", "Arjuna's Grief",
         "On the battlefield of Kurukshetra, Arjuna surveys the two armies and, overcome with grief and despair at the sight of his kinsmen and teachers, lays down his bow, declaring he cannot fight."),
    2:  ("Sankhya Yoga", "The Yoga of Knowledge",
         "Krishna begins his teachings by distinguishing the eternal soul from the mortal body. He declares the Atman is birthless and deathless, and introduces performing duty without attachment to results."),
    3:  ("Karma Yoga", "The Yoga of Action",
         "Action done without desire for fruits is true sacrifice. One must perform their duty; inaction is impossible. Krishna explains why even the wise must act, for the sake of the world."),
    4:  ("Jnana Karma Sanyasa Yoga", "Knowledge and Action",
         "Krishna reveals he has taught this imperishable yoga in earlier cosmic ages. He explains the mystery of his birth and action, the nature of sacrifice, and how wisdom destroys all karma."),
    5:  ("Karma Sanyasa Yoga", "Renunciation of Action",
         "True renunciation is inner — surrendering desire for fruits. Both the path of action and the path of knowledge lead to the same liberation."),
    6:  ("Dhyana Yoga", "The Yoga of Meditation",
         "Krishna describes the method of meditation, the control of mind and senses, and the marks of the true yogi. The mind is the greatest friend and greatest enemy of the self."),
    7:  ("Jnana Vijnana Yoga", "Knowledge and Wisdom",
         "Krishna reveals his divine nature as the source of all creation. He describes maya, the four types of devotees, and those who know him truly."),
    8:  ("Aksara Brahma Yoga", "The Imperishable Brahman",
         "Krishna explains the nature of Brahman and the cosmos, and how to remember him at the moment of death."),
    9:  ("Raja Vidya Raja Guhya Yoga", "The Royal Knowledge",
         "Pure devotion and surrender, even without elaborate ritual, is the highest and most direct path to the Divine."),
    10: ("Vibhuti Yoga", "Divine Glories",
         "Krishna describes his divine manifestations — he is the best and most glorious in every category of existence."),
    11: ("Vishvarupa Darsana Yoga", "Vision of the Cosmic Form",
         "Granted divine sight, Arjuna beholds the awesome universal form — infinite, devouring all the worlds. Terrified, he begs Krishna to return to his gentle human form."),
    12: ("Bhakti Yoga", "The Path of Devotion",
         "Krishna declares that devotees who worship him with pure love are most dear to him. He describes the qualities of his dearest devotees — equanimity, contentment, compassion."),
    13: ("Kshetra Kshetrajna Yoga", "The Field and Its Knower",
         "The body is the field; the soul is the knower. True wisdom is recognising the Supreme Self equally present in all beings."),
    14: ("Gunatraya Vibhaga Yoga", "The Three Qualities",
         "All creation is bound by three gunas: sattva, rajas, and tamas. Transcending them leads to liberation."),
    15: ("Purushottama Yoga", "The Supreme Person",
         "Beyond the perishable world and the imperishable Atman stands the Supreme Person — Purushottama — whom Krishna declares himself to be."),
    16: ("Daivasura Sampad Yoga", "Divine and Demonic Qualities",
         "Krishna lists divine virtues that lead to liberation and demonic traits that lead to bondage."),
    17: ("Sraddhatraya Vibhaga Yoga", "The Threefold Faith",
         "Faith, food, worship, sacrifice, and austerity each bear the stamp of the three gunas. Action done without faith is tamasic and of no value."),
    18: ("Moksha Sanyasa Yoga", "Liberation through Renunciation",
         "The final teaching: abandon all dharmas and take refuge in Krishna alone — the path to eternal freedom."),
}


_GITA_VS_BASE = "https://vedicscriptures.github.io"

# Every commentator code the vedicscriptures API may return per verse.
# Each verse payload already embeds "author" inside its own object, so no
# separate author/language lookup table is needed — we just copy through
# whichever of these keys are present for that particular verse.
_GITA_COMMENTATOR_CODES = {
    "tej", "siva", "purohit", "chinmay", "san", "adi", "gambir", "madhav",
    "anand", "rams", "raman", "abhinav", "sankar", "jaya", "vallabh",
    "ms", "srid", "dhan", "venkat", "puru", "neel",
}

# Preference order for picking the single "headline" translation/commentary
# shown by default in the reader UI. Full scholarly set still travels in
# each verse's `commentaries` field for a future expanded/translator-picker view.
_GITA_PRIMARY_TRANSLATION_ORDER = ["siva", "purohit", "gambir", "adi", "san", "raman"]


def _fetch_gita_verse_raw(chapter_num: int, verse_num: int):
    """Fetch + validate a single verse from the vedicscriptures API, cached 24h."""
    cache_key = f"gita_verse_raw_{chapter_num}_{verse_num}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    url = f"{_GITA_VS_BASE}/slok/{chapter_num}/{verse_num}"
    try:
        data = _fetch_json(url)
    except Exception as e:
        print(f"[gita] fetch failed for {chapter_num}.{verse_num}: {e}")
        return None
    # Validate core fields before ever caching/serving — an incomplete
    # payload should never get treated as good data.
    if not data or "_id" not in data or not data.get("slok"):
        print(f"[gita] invalid payload for {chapter_num}.{verse_num} — skipping")
        return None
    return _cache_set(cache_key, data)


def _clean_gita_gloss_text(text: str) -> str:
    """The vedicscriptures API's word-meaning glossary fields (the 'ec' key)
    use a bare '?' as the separator between a Sanskrit word and its English
    gloss -- e.g. "dharmakshetre on the holy plain? kurukshetre in
    Kurukshetra?" -- confirmed present in the API's own published docs, so
    this is corrupted source data (almost certainly a dash that got mangled
    during digitization), not something introduced by our fetch/cache layer.
    Converts that separator into a proper dash for readability."""
    if not text:
        return text
    return re.sub(r"\?(\s+)", r" –\1", text)


def _build_gita_verse(payload: dict, chapter_num: int, verse_num: int) -> dict:
    commentaries = {}
    for code in _GITA_COMMENTATOR_CODES:
        entry = payload.get(code)
        if not entry:
            continue
        entry = dict(entry)
        if entry.get("ec"):
            entry["ec"] = _clean_gita_gloss_text(entry["ec"])
        commentaries[code] = entry

    translation = ""
    for code in _GITA_PRIMARY_TRANSLATION_ORDER:
        entry = commentaries.get(code)
        if entry and entry.get("et"):
            translation = entry["et"]
            break

    commentary = (commentaries.get("siva") or {}).get("ec", "")

    return {
        "verse_number":    verse_num,
        "chapter_number":  chapter_num,
        "sanskrit":        payload.get("slok", ""),
        "transliteration": payload.get("transliteration", ""),
        "word_meanings":   commentary,   # kept for backward compat with search()
        "translation":     translation,
        "commentary":      commentary,
        "commentaries":    commentaries,  # full scholarly set, all available codes
    }


def _gita_chapters():
    cached = _cache_get("gita_chapters_list")
    if cached:
        return cached
    try:
        api_chapters = _fetch_json(f"{_GITA_VS_BASE}/chapters")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not load Gita chapter list: {e}")
    vc = {ch.get("chapter_number"): ch.get("verses_count", 0) for ch in api_chapters}
    chapters = []
    for num in range(1, 19):
        title, subtitle, summary = _GITA_CHAPTERS.get(num, (f"Chapter {num}", "", ""))
        chapters.append({
            "chapter_number": num,
            "title": title,
            "subtitle": subtitle,
            "summary": summary,
            "verse_count": vc.get(num, 0),
        })
    return _cache_set("gita_chapters_list", {"chapters": chapters})


def _gita_chapter_verses(chapter_num: int):
    if chapter_num < 1 or chapter_num > 18:
        raise HTTPException(status_code=404, detail="Chapter not found (1–18 only)")
    cache_key = f"gita_ch_{chapter_num}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    title, subtitle, summary = _GITA_CHAPTERS.get(chapter_num, (f"Chapter {chapter_num}", "", ""))
    verses_count = _gita_chapters()["chapters"][chapter_num - 1]["verse_count"]

    # Fetch this chapter's verses concurrently — one HTTP call per verse,
    # up to 78 for chapter 18, so serial fetching would be too slow on a
    # cold cache. Bounded worker pool keeps us polite to the free API.
    result_verses = [None] * verses_count
    with ThreadPoolExecutor(max_workers=10) as pool:
        futures = {
            pool.submit(_fetch_gita_verse_raw, chapter_num, vn): vn
            for vn in range(1, verses_count + 1)
        }
        for future in as_completed(futures):
            verse_num = futures[future]
            payload = future.result()
            if payload:
                result_verses[verse_num - 1] = _build_gita_verse(payload, chapter_num, verse_num)

    result_verses = [v for v in result_verses if v is not None]
    if len(result_verses) < verses_count:
        print(f"[gita] chapter {chapter_num}: only {len(result_verses)}/{verses_count} verses "
              f"fetched successfully — re-request later to retry the missing ones.")

    result = {
        "chapter_number": chapter_num,
        "title":          title,
        "subtitle":       subtitle,
        "summary":        summary,
        "verse_count":    len(result_verses),
        "verses":         result_verses,
    }
    # Only cache a fully-complete chapter — a partial result (e.g. from a
    # transient outage) should be retried on the next request, not locked
    # in for 24 hours. Same principle as the DivineAPI cache validation.
    if len(result_verses) == verses_count:
        return _cache_set(cache_key, result)
    return result


# ═════════════════════════════════════════════════════════════════════════════
# VALMIKI RAMAYANA  (bhavykhatri/DharmicData)
# ═════════════════════════════════════════════════════════════════════════════
# Actual JSON structure per entry:
#   { "kaanda": "balakanda", "sarg": 1, "shloka": 1, "text": "<Sanskrit>" }
# NOTE: No English translation in the dataset — Sanskrit text shown with note.

_DHARMIC_BASE = "https://raw.githubusercontent.com/bhavykhatri/DharmicData/main"

_RAMAYANA_KANDAS = {
    1: ("Bala Kanda",       "बालकाण्ड",         "1_balakanda.json",
        "The story of Rama's divine birth in Ayodhya, his childhood, his training under sage Vishwamitra, and his winning of Princess Sita's hand in marriage by breaking the great bow of Shiva."),
    2: ("Ayodhya Kanda",    "अयोध्याकाण्ड",     "2_ayodhyakanda.json",
        "Rama is exiled for 14 years by King Dasharatha at Queen Kaikeyi's demand. He departs to the forest with Sita and Lakshmana. Dasharatha, grief-stricken, dies. Bharata refuses the throne and places Rama's sandals on it as regent."),
    3: ("Aranya Kanda",     "अरण्यकाण्ड",       "3_aranyakanda.json",
        "Rama, Sita, and Lakshmana live in the Dandaka forest. Ravana, the demon king of Lanka, kidnaps Sita. The vulture Jatayu dies fighting to save her. Rama and Lakshmana begin their search."),
    4: ("Kishkindha Kanda", "किष्किन्धाकाण्ड",  "4_kishkindhakanda.json",
        "Rama meets the monkey king Sugriva and his devoted general Hanuman. He helps Sugriva defeat his brother Vali. In gratitude, Sugriva sends the monkey army to search for Sita across the world."),
    5: ("Sundara Kanda",    "सुन्दरकाण्ड",      "5_sundarakanda.json",
        "Hanuman leaps across the ocean to Lanka, finds Sita imprisoned in Ashoka grove, delivers Rama's message, and returns with news of her whereabouts. This kanda celebrates Hanuman's devotion and courage."),
    6: ("Yuddha Kanda",     "युद्धकाण्ड",       "6_yudhhakanda.json",
        "Rama builds a bridge across the ocean with the monkey army, invades Lanka, and wages a great war against Ravana. Ravana is slain. Sita passes the fire test, and Rama is restored to his rightful throne in Ayodhya."),
    7: ("Uttara Kanda",     "उत्तरकाण्ड",       "7_uttarakanda.json",
        "Rama rules Ayodhya in the ideal Ram Rajya. Sita is exiled to the forest where she raises Rama's twin sons Lava and Kusha, before returning to Mother Earth."),
}


def _load_ramayana_kanda(kanda_num: int):
    if kanda_num not in _RAMAYANA_KANDAS:
        raise HTTPException(status_code=404, detail="Kanda not found")
    cache_key = f"ramayana_kanda_{kanda_num}_raw"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    _, _, filename, _ = _RAMAYANA_KANDAS[kanda_num]
    url = f"{_DHARMIC_BASE}/ValmikiRamayana/{filename}"
    try:
        data = _fetch_json(url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not load Ramayana kanda {kanda_num}: {e}")
    return _cache_set(cache_key, data)


def _ramayana_chapters():
    cached = _cache_get("ramayana_chapters_list")
    if cached:
        return cached
    chapters = []
    for num, (title, sanskrit, filename, summary) in _RAMAYANA_KANDAS.items():
        chapters.append({
            "chapter_number": num,
            "title":          title,
            "sanskrit_title": sanskrit,
            "summary":        summary,
            "verse_count":    None,
        })
    return _cache_set("ramayana_chapters_list", {"chapters": chapters})


def _ramayana_kanda_verses(kanda_num: int):
    cache_key = f"ramayana_kanda_{kanda_num}_verses"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    raw = _load_ramayana_kanda(kanda_num)
    title_en, title_sa, _, summary = _RAMAYANA_KANDAS[kanda_num]

    # Actual structure: { "kaanda": "balakanda", "sarg": 1, "shloka": 1, "text": "<Sanskrit>" }
    verses = []
    for i, entry in enumerate(raw):
        sarg   = entry.get("sarg", 0)
        shloka = entry.get("shloka", i + 1)
        # "text" contains Sanskrit shloka
        sanskrit = entry.get("text", "")
        sanskrit = re.sub(r"<[^>]+>", " ", sanskrit).strip()

        verses.append({
            "verse_number":    i + 1,
            "chapter_number":  kanda_num,
            "sarga":           sarg,
            "shloka":          shloka,
            "label":           f"Sarga {sarg}, Shloka {shloka}",
            "sanskrit":        sanskrit,
            "transliteration": "",
            # No English translation in this dataset — show Sanskrit as the text
            "translation":     sanskrit,
            "commentary":      "",
        })

    result = {
        "chapter_number":  kanda_num,
        "title":           title_en,
        "sanskrit_title":  title_sa,
        "summary":         summary,
        "verse_count":     len(verses),
        "verses":          verses,
        "note":            "Valmiki Ramayana Sanskrit shlokas (Devanagari). English translation edition coming soon.",
        "source_credit":   "DharmicData/bhavykhatri (MIT) · Original source: svenkatreddy/Ramayana_Book",
    }
    return _cache_set(cache_key, result)


# ═════════════════════════════════════════════════════════════════════════════
# MAHABHARATA  (bhavykhatri/DharmicData)
# ═════════════════════════════════════════════════════════════════════════════
# Actual JSON structure per entry:
#   { "book": 1, "chapter": 1, "shloka": 0, "text": "<Sanskrit>" }
# Files: mahabharata_book_{n}.json  (n = 1..18)

_MAHABHARATA_PARVAS = {
    1:  ("Adi Parva",            "आदि पर्व",        "mahabharata_book_1.json",
         "The beginning — origins of the Kuru dynasty, birth of the Pandavas and Kauravas, their education, and the events leading to the great rivalry between cousins."),
    2:  ("Sabha Parva",          "सभा पर्व",         "mahabharata_book_2.json",
         "The Pandavas build the magnificent Indraprastha. Yudhishthira's Rajasuya yajna. The fateful dice game, in which the Pandavas lose their kingdom and Draupadi is humiliated."),
    3:  ("Vana Parva",           "वन पर्व",          "mahabharata_book_3.json",
         "The Pandavas' 12-year forest exile. Arjuna obtains divine weapons. Stories of Nala-Damayanti, Savitri-Satyavan, and other tales of devotion and righteousness."),
    4:  ("Virata Parva",         "विराट पर्व",       "mahabharata_book_4.json",
         "The Pandavas' 13th year of incognito exile in the court of King Virata. Their identities are revealed when Arjuna single-handedly defeats the Kaurava army."),
    5:  ("Udyoga Parva",         "उद्योग पर्व",      "mahabharata_book_5.json",
         "Preparations for war. Krishna's peace mission to Hastinapura fails. Duryodhana refuses to return even five villages. Both sides raise armies."),
    6:  ("Bhishma Parva",        "भीष्म पर्व",       "mahabharata_book_6.json",
         "The first 10 days of the Kurukshetra war under Bhishma's command. Contains the Bhagavad Gita. Bhishma is felled by Shikhandi and Arjuna."),
    7:  ("Drona Parva",          "द्रोण पर्व",       "mahabharata_book_7.json",
         "Drona becomes commander. Abhimanyu is treacherously killed in the Chakravyuha. Arjuna vows to kill Jayadratha by sunset and succeeds. Drona is slain."),
    8:  ("Karna Parva",          "कर्ण पर्व",        "mahabharata_book_8.json",
         "Karna becomes commander. The great duel between Arjuna and Karna. Karna's chariot wheel sinks. Arjuna kills the unarmed Karna at Krishna's bidding."),
    9:  ("Shalya Parva",         "शल्य पर्व",        "mahabharata_book_9.json",
         "Shalya becomes the final Kaurava commander. Yudhishthira slays him. Duryodhana hides in a lake and is finally slain by Bhima in a mace duel."),
    10: ("Sauptika Parva",       "सौप्तिक पर्व",     "mahabharata_book_10.json",
         "The night massacre. Ashwatthama kills the sleeping warriors including the five sons of Draupadi. Ashwatthama is cursed by Krishna."),
    11: ("Stri Parva",           "स्त्री पर्व",       "mahabharata_book_11.json",
         "The women of Hastinapura mourn their fallen. Gandhari's grief and curse upon Krishna. Yudhishthira performs last rites of the fallen warriors."),
    12: ("Shanti Parva",         "शांति पर्व",        "mahabharata_book_12.json",
         "The longest parva. Bhishma, on his bed of arrows, delivers vast teachings on statecraft, ethics, philosophy, and the nature of dharma to Yudhishthira."),
    13: ("Anushasana Parva",     "अनुशासन पर्व",     "mahabharata_book_13.json",
         "Bhishma continues teachings on duties, gifts, and the path to liberation, before finally departing his body at an auspicious moment he himself had chosen."),
    14: ("Ashvamedhika Parva",   "अश्वमेधिक पर्व",   "mahabharata_book_14.json",
         "Yudhishthira performs the Ashwamedha yajna to atone for the war's bloodshed. Arjuna follows the sacrificial horse across the land."),
    15: ("Ashramavasika Parva",  "आश्रमवासिक पर्व",  "mahabharata_book_15.json",
         "Dhritarashtra, Gandhari, and Kunti retire to the forest. They perish in a forest fire. Vidura and Sanjaya attain liberation."),
    16: ("Mausala Parva",        "मौसल पर्व",        "mahabharata_book_16.json",
         "The Yadavas destroy each other in a drunken civil war. Krishna departs from the world. The Dwarka kingdom sinks into the sea."),
    17: ("Mahaprasthanika Parva","महाप्रस्थानिक पर्व","mahabharata_book_17.json",
         "The Pandavas and Draupadi renounce the kingdom and walk toward the Himalayas. One by one they fall until only Yudhishthira and a faithful dog remain."),
    18: ("Svargarohana Parva",   "स्वर्गारोहण पर्व",  "mahabharata_book_18.json",
         "Yudhishthira reaches heaven. The dog is revealed as Dharma (Yama). All are finally united in heaven in their divine forms."),
}


def _load_mahabharata_parva(parva_num: int):
    if parva_num not in _MAHABHARATA_PARVAS:
        raise HTTPException(status_code=404, detail="Parva not found")
    cache_key = f"mbh_parva_{parva_num}_raw"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    _, _, filename, _ = _MAHABHARATA_PARVAS[parva_num]
    url = f"{_DHARMIC_BASE}/Mahabharata/{filename}"
    try:
        data = _fetch_json(url)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not load Mahabharata parva {parva_num}: {e}")
    return _cache_set(cache_key, data)


def _mahabharata_chapters():
    cached = _cache_get("mahabharata_chapters_list")
    if cached:
        return cached
    chapters = []
    for num, (title, sanskrit, filename, summary) in _MAHABHARATA_PARVAS.items():
        chapters.append({
            "chapter_number": num,
            "title":          title,
            "sanskrit_title": sanskrit,
            "summary":        summary,
            "verse_count":    None,
        })
    return _cache_set("mahabharata_chapters_list", {"chapters": chapters})


def _mahabharata_parva_verses(parva_num: int):
    cache_key = f"mbh_parva_{parva_num}_verses"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    raw = _load_mahabharata_parva(parva_num)
    title_en, title_sa, _, summary = _MAHABHARATA_PARVAS[parva_num]

    # Actual structure: { "book": 1, "chapter": 1, "shloka": 0, "text": "<Sanskrit>" }
    verses = []
    for i, entry in enumerate(raw):
        chapter_num = entry.get("chapter", 0)
        shloka_num  = entry.get("shloka", i + 1)
        sanskrit    = entry.get("text", "")
        sanskrit    = re.sub(r"<[^>]+>", " ", sanskrit).strip()

        verses.append({
            "verse_number":    i + 1,
            "chapter_number":  parva_num,
            "section":         chapter_num,
            "shloka":          shloka_num,
            "label":           f"Chapter {chapter_num}, Shloka {shloka_num}",
            "sanskrit":        sanskrit,
            "transliteration": "",
            # No English translation in dataset — show Sanskrit
            "translation":     sanskrit,
            "commentary":      "",
        })

    result = {
        "chapter_number":  parva_num,
        "title":           title_en,
        "sanskrit_title":  title_sa,
        "summary":         summary,
        "verse_count":     len(verses),
        "verses":          verses,
        "note":            "Mahabharata Sanskrit shlokas (Devanagari). English translation edition coming soon.",
        "source_credit":   "DharmicData/bhavykhatri (MIT)",
    }
    return _cache_set(cache_key, result)


# ═════════════════════════════════════════════════════════════════════════════
# HANUMAN CHALISA  (hardcoded — Tulsidas, public domain)
# ═════════════════════════════════════════════════════════════════════════════

_HANUMAN_CHALISA_DOHA_INTRO = [
    {
        "verse_number": 0,
        "chapter_number": 1,
        "label": "Doha (Opening)",
        "sanskrit": "श्रीगुरु चरन सरोज रज निज मनु मुकुरु सुधारि।\nबरनउँ रघुबर बिमल जसु जो दायकु फल चारि॥",
        "transliteration": "Shri Guru charan saroj raj nij manu mukuru sudhari.\nBarnau Raghubar bimal jasu jo daayaku phala chari.",
        "translation": "Cleansing the mirror of my mind with the dust of the lotus feet of my Guru, I narrate the pure and sacred glory of Shri Raghuvira which bestows the four fruits of life (Dharma, Artha, Kama, Moksha).",
        "commentary": "",
    },
    {
        "verse_number": -1,
        "chapter_number": 1,
        "label": "Doha (Second)",
        "sanskrit": "बुद्धिहीन तनु जानिके सुमिरौं पवन-कुमार।\nबल बुधि बिद्या देहु मोहिं हरहु कलेस बिकार॥",
        "transliteration": "Buddhihin tanu janike sumirau Pavan-Kumara.\nBala budhi bidya dehu mohi harahu kalesha bikara.",
        "translation": "Knowing this body to be devoid of intelligence, I remember you, O son of the Wind. Grant me strength, wisdom, and knowledge, and remove my afflictions and impurities.",
        "commentary": "",
    },
]

_HANUMAN_CHALISA_VERSES = [
    ("जय हनुमान ज्ञान गुन सागर। जय कपीस तिहुँ लोक उजागर॥",
     "Jai Hanuman gyan gun saagar. Jai Kapis tihun lok ujaagar.",
     "Victory to Hanuman, ocean of wisdom and virtue. Victory to the Lord of Monkeys who illuminates all three worlds."),
    ("राम दूत अतुलित बल धामा। अंजनि-पुत्र पवनसुत नामा॥",
     "Ram doot atulit bal dhaama. Anjani-putra Pavansut naama.",
     "You are the divine messenger of Rama, the abode of immeasurable strength. You are known as the son of Anjani and the son of the wind."),
    ("महाबीर बिक्रम बजरंगी। कुमति निवार सुमति के संगी॥",
     "Mahabir bikram Bajrangi. Kumati nivar sumati ke sangi.",
     "O mighty hero of tremendous courage, with a body as strong as a thunderbolt! You remove evil intellect and are a companion of good wisdom."),
    ("कंचन बरन बिराज सुबेसा। कानन कुंडल कुंचित केसा॥",
     "Kanchan baran biraaj subesa. Kaanan kundal kunchit kesa.",
     "Your complexion is golden and your dress is resplendent. You wear earrings in your ears and have curly hair."),
    ("हाथ बज्र औ ध्वजा बिराजै। काँधे मूँज जनेऊ साजै॥",
     "Haath bajra au dhvaja birajai. Kaandhe moonj janeu saajai.",
     "In your hand gleams the thunderbolt and a flag. A sacred thread of munja grass adorns your shoulder."),
    ("संकर सुवन केसरीनंदन। तेज प्रताप महा जग बंदन॥",
     "Sankar suvan Kesarinandan. Tej pratap maha jag bandan.",
     "O son of Shiva and beloved of Kesari! Your brilliance and glory are revered throughout the world."),
    ("विद्यावान गुणी अति चातुर। राम काज करिबे को आतुर॥",
     "Vidyaavan guni ati chaatur. Ram kaaj karibe ko aaatur.",
     "You are learned, virtuous, and supremely clever. You are ever eager to carry out the tasks of Rama."),
    ("प्रभु चरित्र सुनिबे को रसिया। राम लखन सीता मन बसिया॥",
     "Prabhu charitra sunibe ko rasiya. Ram Lakhan Sita man basiya.",
     "You delight in listening to the stories of the Lord. Ram, Lakshman, and Sita dwell in your heart."),
    ("सूक्ष्म रूप धरि सियहिं दिखावा। बिकट रूप धरि लंक जरावा॥",
     "Sookshm roop dhari Siyahi dikhaava. Bikat roop dhari Lanka jaraava.",
     "You appeared before Sita in a tiny form, and assumed a terrifying form to burn Lanka."),
    ("भीम रूप धरि असुर सँहारे। रामचंद्र के काज सँवारे॥",
     "Bheem roop dhari asur sanhaare. Ramachandra ke kaaj sanwaare.",
     "Taking a fearsome form you slew the demons and accomplished the tasks of Shri Ramachandra."),
    ("लाय सजीवन लखन जियाये। श्रीरघुबीर हरषि उर लाये॥",
     "Laay sanjivan Lakhan jiyaaye. Shri Raghubir harashi ur laaye.",
     "You brought the Sanjeevani herb and revived Lakshmana. Shri Raghuvira, overjoyed, embraced you to his heart."),
    ("रघुपति कीन्ही बहुत बड़ाई। तुम मम प्रिय भरतहि सम भाई॥",
     "Raghupati kinhi bahut badai. Tum mam priya Bharatahi sam bhai.",
     "The Lord of the Raghus praised you greatly, saying: You are as dear to me as my own brother Bharata."),
    ("सहस बदन तुम्हरो जस गावैं। अस कहि श्रीपति कंठ लगावैं॥",
     "Sahas badan tumharo jas gaavain. As kahi Shripati kanth lagavain.",
     "The thousand-headed Shesha sings your praises — saying this, the Lord of Lakshmi (Rama) embraced you."),
    ("सनकादिक ब्रह्मादि मुनीसा। नारद सारद सहित अहीसा॥",
     "Sankaadik Brahmaadi muneesa. Naarad Sarad sahit Aheesa.",
     "Sages like Sanaka, Brahma and other great sages, Narada, Saraswati, and the Lord of serpents (Shesha) —"),
    ("जम कुबेर दिगपाल जहाँ ते। कबि कोबिद कहि सके कहाँ ते॥",
     "Yam Kuber Digpaal jahaan te. Kabi kobid kahi sake kahaan te.",
     "Yama, Kubera, the guardians of the directions — neither poets nor scholars can fully describe your glory."),
    ("तुम उपकार सुग्रीवहिं कीन्हा। राम मिलाय राज पद दीन्हा॥",
     "Tum upkaar Sugreevahi keenha. Ram milaay raaj pad deenha.",
     "You did a great service to Sugriva — you united him with Rama and restored his lost kingdom to him."),
    ("तुम्हरो मंत्र बिभीषन माना। लंकेस्वर भए सब जग जाना॥",
     "Tumharo mantra Vibheeshan maana. Lankeshwar bhaye sab jag jaana.",
     "Vibhishana accepted your counsel, and became the Lord of Lanka — as all the world knows."),
    ("जुग सहस्र जोजन पर भानू। लील्यो ताहि मधुर फल जानू॥",
     "Yug sahastra jojan par bhaanu. Lilyo taahi madhur phal jaanu.",
     "The sun, millions of yojanas away, you swallowed thinking it to be a sweet fruit — such was your childhood feat."),
    ("प्रभु मुद्रिका मेलि मुख माहीं। जलधि लाँघि गये अचरज नाहीं॥",
     "Prabhu mudrika meli mukh maahin. Jaladhi laanghi gaye acharaj naahin.",
     "Holding the Lord's signet ring in your mouth, you leapt across the ocean — no wonder there!"),
    ("दुर्गम काज जगत के जेते। सुगम अनुग्रह तुम्हरे तेते॥",
     "Durgam kaaj jagat ke jete. Sugam anugraha tumhre tete.",
     "All the difficult tasks of the world become easy by your grace."),
    ("राम दुआरे तुम रखवारे। होत न आज्ञा बिनु पैसारे॥",
     "Ram duaare tum rakhwaare. Hot na aagya binu paisaare.",
     "You are the guardian at Rama's gate. None may enter without your permission."),
    ("सब सुख लहै तुम्हारी सरना। तुम रक्षक काहू को डर ना॥",
     "Sab sukh lahai tumhaari sarna. Tum rakshak kaahu ko dar na.",
     "All happiness is obtained by taking refuge in you. With you as protector, there is nothing to fear."),
    ("आपन तेज सम्हारो आपै। तीनों लोक हाँक ते काँपै॥",
     "Aapan tej samhaaro aapai. Teenon lok haank te kaanpai.",
     "Only you can contain your own power. All three worlds tremble at your roar."),
    ("भूत पिसाच निकट नहिं आवै। महाबीर जब नाम सुनावै॥",
     "Bhoot pisaach nikat nahin aavai. Mahabir jab naam sunaavai.",
     "Ghosts and evil spirits dare not come near when the name of Mahavira Hanuman is uttered."),
    ("नासै रोग हरै सब पीरा। जपत निरंतर हनुमत बीरा॥",
     "Naasai rog harai sab peera. Japat nirantar Hanumat beera.",
     "All diseases are destroyed and all pain is removed by the continuous chanting of Hanuman's name."),
    ("संकट ते हनुमान छुड़ावै। मन क्रम बचन ध्यान जो लावै॥",
     "Sankat te Hanuman chhudaavai. Man kram bachan dhyan jo laavai.",
     "Hanuman delivers from all distress those who contemplate him in thought, word, and deed."),
    ("सब पर राम तपस्वी राजा। तिन के काज सकल तुम साजा॥",
     "Sab par Ram tapasvi raaja. Tin ke kaaj sakal tum saaja.",
     "Rama is the sovereign and supreme ascetic over all. You accomplish all his works."),
    ("और मनोरथ जो कोई लावै। सोइ अमित जीवन फल पावै॥",
     "Aur manorath jo koi laavai. Soi amit jeevan phal paavai.",
     "Whoever brings any desire to you, they receive the boundless fruit of life."),
    ("चारों जुग परताप तुम्हारा। है परसिद्ध जगत उजियारा॥",
     "Chaaron yug partaap tumhaara. Hai parsiddh jagat ujiyaara.",
     "Your glory shines across all four ages. Your fame illuminates the entire world."),
    ("साधु-संत के तुम रखवारे। असुर निकंदन राम दुलारे॥",
     "Saadhu sant ke tum rakhwaare. Asur nikandan Ram dulaare.",
     "You are the protector of saints and sages, the destroyer of demons, and the beloved of Rama."),
    ("अष्ट सिद्धि नौ निधि के दाता। अस बर दीन जानकी माता॥",
     "Asht siddhi nau nidhi ke daataa. As bar deen Janaki maata.",
     "You are the bestower of the eight mystic powers and nine divine treasures — such is the boon granted by Mother Janaki (Sita)."),
    ("राम रसायन तुम्हरे पासा। सदा रहो रघुपति के दासा॥",
     "Ram rasaayan tumhre paasaa. Sadaa raho Raghupati ke daasaa.",
     "You hold the elixir of Rama's name. Remain always the devoted servant of Shri Raghupati."),
    ("तुम्हरे भजन राम को पावै। जनम-जनम के दुख बिसरावै॥",
     "Tumhre bhajan Ram ko paavai. Janam janam ke dukh bisraavai.",
     "By singing your praises one attains Rama, and the sorrows of countless births are forgotten."),
    ("अंत काल रघुबर पुर जाई। जहाँ जन्म हरि-भक्त कहाई॥",
     "Ant kaal Raghubarpuree jaaee. Jahaan janm Hari bhakt kahaaee.",
     "At the time of death one goes to the abode of Shri Raghuvira, and wherever one is born one is known as a devotee of Hari."),
    ("और देवता चित्त न धरई। हनुमत सेइ सर्ब सुख करई॥",
     "Aur devata chitt na dharai. Hanumat sei sarb sukh karai.",
     "Without giving your heart to other deities, by serving Hanuman alone all happiness is achieved."),
    ("संकट कटै मिटै सब पीरा। जो सुमिरै हनुमत बलबीरा॥",
     "Sankat katai mitai sab peera. Jo sumirai Hanumat Balbeera.",
     "All suffering is cut away and all pain is erased for one who remembers mighty Hanuman."),
    ("जय जय जय हनुमान गोसाईं। कृपा करहु गुरुदेव की नाईं॥",
     "Jai Jai Jai Hanuman Gosain. Kripa karahu Gurudev ki naayin.",
     "Victory, victory, victory to Hanuman the Lord! Shower your grace upon me as a Guru upon his disciple."),
    ("जो सत बार पाठ कर कोई। छूटहि बंदि महा सुख होई॥",
     "Jo sat baar paath kar koi. Chhootahi bandi mahaa sukh hoi.",
     "Whoever recites this Chalisa a hundred times is freed from the bondage of worldly existence and attains supreme happiness."),
    ("जो यह पढ़ै हनुमान चालीसा। होय सिद्धि साखी गौरीसा॥",
     "Jo yah padhai Hanuman Chalisa. Hoy siddhi saakhi Gaureesha.",
     "Whoever reads this Hanuman Chalisa attains perfection — Lord Shiva himself is witness to this."),
    ("तुलसीदास सदा हरि चेरा। कीजै नाथ हृदय मह डेरा॥",
     "Tulsidas sadaa Hari cheraa. Keejai naath hriday mah deraa.",
     "Tulsidas is ever a servant of Hari. O Lord, make your abode in his heart."),
]

_HANUMAN_CHALISA_DOHA_CLOSING = {
    "verse_number": 42,
    "chapter_number": 1,
    "label": "Doha (Closing)",
    "sanskrit": "पवनतनय संकट हरन, मंगल मूरति रूप।\nराम लखन सीता सहित, हृदय बसहु सुर भूप॥",
    "transliteration": "Pavantanay sankat haran, mangal moorati roop.\nRam Lakhan Sita sahit, hriday basahu sur bhoop.",
    "translation": "O son of the Wind, remover of all distress, embodiment of auspiciousness! O king of the gods, dwell in my heart together with Rama, Lakshmana, and Sita.",
    "commentary": "",
}


def _hanuman_chalisa_chapters():
    return {"chapters": [
        {
            "chapter_number": 1,
            "title":          "Hanuman Chalisa",
            "sanskrit_title": "हनुमान चालीसा",
            "summary":        "The complete 40-verse devotional hymn composed by Tulsidas in Awadhi Hindi, singing the glories of Lord Hanuman — with two introductory and one closing doha.",
            "verse_count":    43,
        }
    ]}


def _hanuman_chalisa_verses():
    verses = list(_HANUMAN_CHALISA_DOHA_INTRO)
    for i, (sk, tl, tr) in enumerate(_HANUMAN_CHALISA_VERSES):
        verses.append({
            "verse_number":    i + 1,
            "chapter_number":  1,
            "label":           f"Chaupai {i + 1}",
            "sanskrit":        sk,
            "transliteration": tl,
            "translation":     tr,
            "commentary":      "",
        })
    verses.append(_HANUMAN_CHALISA_DOHA_CLOSING)
    return {
        "chapter_number":  1,
        "title":           "Hanuman Chalisa",
        "sanskrit_title":  "हनुमान चालीसा",
        "summary":         "The complete 40-verse devotional hymn composed by Tulsidas in Awadhi Hindi, singing the glories of Lord Hanuman — with two introductory and one closing doha.",
        "verse_count":     len(verses),
        "verses":          verses,
        "source_credit":   "Tulsidas (c.1574 CE), public domain text",
    }


# ═════════════════════════════════════════════════════════════════════════════
# SHIVA PURANA  (curated)
# ═════════════════════════════════════════════════════════════════════════════

_SHIVA_PURANA_SAMHITAS = {
    1: ("Vidyeshvara Samhita",  "विद्येश्वर संहिता",
        "The glory of Shiva Linga worship, the nature of the Absolute, the five elements, and the sacred syllable Om. Shiva declares himself the supreme consciousness beyond all creation.",
        [
            ("The Supremacy of Shiva", "The Lord Shiva speaks: I am the consciousness that pervades all — the witness, the pure awareness, unbounded and eternal. All creation arises in me, is sustained in me, and dissolves back into me. I am the beginning, the middle, and the end.", "Shiva's declaration of his supreme nature as pure consciousness from whom all creation emerges"),
            ("The Glory of Om", "Om is my body. The past, present, and future are all OM. Whatever is beyond these three phases of time — that too is OM. OM is Brahman, OM is the universe.", "The Mandukya Upanishad teaching integrated into Shiva Purana on the sacred syllable"),
            ("Linga Worship", "The Linga represents the formless, infinite Shiva. Worshipping the Linga is worshipping the divine column of cosmic light (Jyotirlinga) that has no beginning and no end.", "Philosophical basis of Shiva Linga worship as symbol of the infinite"),
            ("Five Elements", "Earth, water, fire, air, and ether — these five great elements arise from my energy. The entire universe is woven from these five. Know this and you know me.", "Shiva as the source of the Pancha Bhutas (five elements)"),
            ("The Sacred Bilva Leaf", "The Bilva tree is my favourite. Its three leaves represent Sat-Chit-Ananda (Being-Consciousness-Bliss) — my very nature. Offering a single Bilva leaf with devotion pleases me more than elaborate rituals.", "On the significance of Bilva patra in Shiva worship"),
        ]),
    2: ("Rudra Samhita", "रुद्र संहिता",
        "The most extensive section. Contains Shiva's marriage to Sati and Parvati, the destruction of Daksha's yajna, the birth of Kartikeya, the killing of Tarakasura.",
        [
            ("Sati and the Daksha Yajna", "Sati, daughter of Daksha, was devoted entirely to Shiva. When Daksha insulted Shiva by not inviting him to the great yajna, Sati could not bear the humiliation of her husband. She gave up her life in the sacred fire. Shiva, grief-stricken, carried her body across the world.", "The tragic story of Sati's self-immolation and Shiva's grief"),
            ("Shiva's Grief", "Shiva wandered the three worlds, carrying the body of Sati. Vishnu used his Sudarshana Chakra to slowly sever Sati's body piece by piece. Where each piece fell, a Shakti Pitha arose — 51 sacred sites of the Goddess.", "Origin of the 51 Shakti Pithas across India"),
            ("Parvati's Tapas", "Parvati, the daughter of King Himavan, was Sati reborn. She performed extraordinary austerities to win Shiva as her husband again. Even the god of love Kamadeva was burned to ash when he tried to distract Shiva from meditation.", "Parvati's great penance to win Shiva's love"),
            ("The Marriage of Shiva and Parvati", "When Shiva accepted Parvati, the entire cosmos rejoiced. Parvati became Ardhanari — the left half of Shiva's body — representing the inseparable union of Purusha and Prakriti.", "The cosmic wedding and its spiritual significance"),
            ("Birth of Kartikeya", "The seed of Shiva was so powerful that none could contain it. Finally it was received by the six Krittikas (the Pleiades). The child born was Kartikeya — the general of the gods — who would slay the demon Tarakasura.", "Story of Kartikeya's miraculous birth"),
        ]),
    3: ("Shatarudra Samhita", "शतरुद्र संहिता",
        "The hundred forms of Rudra-Shiva, his divine sports and manifestations, stories of his grace toward devotees, and the sacred sites associated with Shiva's presence.",
        [
            ("The Hundred Names of Rudra", "Rudra is the roarer, the destroyer of sorrow. He is Shankara — the giver of peace. He is Mahadeva — the greatest of gods. He is Nataraja — the cosmic dancer. He is Bhairava — the fierce. He is Pashupatinath — the lord of all creatures.", "The multifarious forms and names of Shiva-Rudra"),
            ("Shiva as Nataraja", "The dance of Shiva in the hall of Chidambaram is the dance of creation. His right hand holds the drum of creation; his left holds the fire of destruction; his foot raised in grace; his foot crushing the demon of ignorance. This is the cosmic dance — Ananda Tandava.", "The philosophical meaning of Nataraja"),
            ("Shiva and the Hunter", "A hunter spent the night in a Bilva tree above a Shiva Linga. Through the night he accidentally dropped Bilva leaves on the Linga and his tears of cold fell upon it. Though he performed no conscious worship, Shiva was pleased by his innocent devotion.", "Story illustrating that sincere devotion transcends ritual"),
            ("Pashupatinath", "I am the lord of all pashus — all bound souls. My grace is the rope that first binds and then releases. The mark of Pashupata knowledge is: know that you are bound, seek the lord of the bound, and be liberated.", "Shiva as Pashupati — the liberator of all souls"),
            ("The Grace of Bilva", "Even a leaf, even a flower, even a drop of water offered to Shiva with devotion liberates the devotee from the cycle of rebirth. Shiva is easily pleased — he is Ashutosh.", "The compassionate and easily-pleased nature of Shiva"),
        ]),
    4: ("Kotirudra Samhita", "कोटिरुद्र संहिता",
        "The glory of Shiva Linga worship, the twelve Jyotirlingas, their locations and sacred significance, and the liberation attained by their pilgrimage.",
        [
            ("The Twelve Jyotirlingas", "The supreme Shiva manifests as a column of endless light — the Jyotirlinga. There are twelve such sacred sites across Bharat: Somnath in Gujarat, Mallikarjuna in Andhra, Mahakaleshwar in Ujjain, Omkareshwar in Madhya Pradesh, Kedarnath in the Himalayas, Bhimashankar in Maharashtra, Kashi Vishwanath in Varanasi, Triambakeshwar near Nashik, Vaidyanath in Jharkhand, Nageshwar in Gujarat, Rameshwaram in Tamil Nadu, and Grishneshwar in Maharashtra.", "The twelve Jyotirlingas of India and their locations"),
            ("Somnath — The First Jyotirlinga", "At the edge of the western sea, Somnath shines as the first and most sacred Jyotirlinga. The moon god Soma worshipped Shiva here to be freed from the curse of Daksha. The place became Somnath — Lord of the Moon.", "Story and significance of the Somnath Jyotirlinga"),
            ("Kedarnath — The Himalayan Shrine", "In the high Himalayas, where the Mandakini river flows, stands Kedarnath. The Pandavas sought Shiva here after the Kurukshetra war. Shiva, to avoid them, dived into the earth as a bull. Bhima caught hold of the hump — that hump is worshipped at Kedarnath to this day.", "Origin story of the Kedarnath Jyotirlinga"),
            ("Kashi Vishwanath", "Kashi — the city of light — is the most sacred city in the universe. Shiva himself walks these streets. Kashi Vishwanath grants liberation to all who die within this city, whispering the Taraka mantra into their ear.", "The supreme sanctity of Varanasi and the Kashi Vishwanath temple"),
            ("The Merit of Jyotirlinga Pilgrimage", "He who visits all twelve Jyotirlingas, or who hears their names with devotion, or who recites this hymn at dawn and at dusk — that person is freed from all sins accumulated across seven births.", "The spiritual merit of visiting or remembering the Jyotirlingas"),
        ]),
    5: ("Uma Samhita", "उमा संहिता",
        "The teachings of Goddess Uma (Parvati) on cosmology, devotion, and liberation. The doctrine of Shiva-Shakti as inseparable.",
        [
            ("Shiva and Shakti as One", "As fire cannot be separated from its heat, as the sun cannot be separated from its light — so Shiva cannot be separated from Shakti. They are one consciousness appearing as two for the joy of creation. They are Ardhanarisvara — the Lord who is half woman.", "The non-dual teaching of Shiva-Shakti as inseparable consciousness"),
            ("Parvati's Teaching on Dharma", "Parvati said: The highest dharma is ahimsa — non-violence. But greater than all dharmas is devotion to Shiva. And beyond even devotion is the knowledge that I and Shiva are one — that the devotee, the deity, and the act of devotion are all manifestations of one consciousness.", "Uma's teaching on the hierarchy of dharma, bhakti, and jnana"),
            ("The Nature of Liberation", "Liberation is not going somewhere — it is the removal of ignorance. When the cloud of maya disperses, the sun of pure consciousness shines. That sun is Shiva. You have always been that. Liberation is simply the recognition of what you have always been.", "Non-dual teaching on moksha"),
            ("The Grace of the Goddess", "Uma said: I am the mother of the universe. In my benign form I grant all desires. In my fierce form as Kali, as Durga, I destroy what must be destroyed — the ego, the ignorance, the false identity.", "The dual nature of the Goddess as both benign and fierce"),
            ("Shiva Panchakshara", "Na-Ma-Shi-Va-Ya — these five syllables are the five elements. Na is earth, Ma is water, Shi is fire, Va is air, Ya is ether. Chanting Namashivaya is worshipping all of creation. It is Shiva's own mantra — his essence in five syllables.", "The Panchakshara mantra and its cosmic significance"),
        ]),
    6: ("Kailasa Samhita", "कैलास संहिता",
        "Descriptions of Kailasa, Shiva's abode, yoga practices for liberation, the nature of the soul and its relationship to the supreme Shiva.",
        [
            ("Mount Kailasa", "Beyond the Himalayas, in the region of eternal snow, rises Mount Kailasa — the abode of Shiva. It is made of crystal and gold. At its peak Shiva sits in eternal meditation, Parvati at his side. This is the centre of the cosmos.", "Description of Kailasa and its cosmic significance"),
            ("Shiva Yoga", "The highest yoga is not posture or breath — it is the merger of the individual consciousness (Atman) into the cosmic consciousness (Shiva). When the meditator, meditation, and the meditated become one — that is Shiva-yoga, that is liberation.", "Teaching on Shiva yoga as union of individual and cosmic consciousness"),
            ("The Soul's Journey", "The Atman descends from Shiva, takes birth after birth, gathering experience. By devotion, by yoga, by knowledge, it begins to remember its true nature. Finally, the veil of maya falls. The Atman recognises itself as Shiva — that recognition is liberation.", "The soul's cycle of descent and liberation in Shaiva philosophy"),
            ("Panchaksha Meditation", "Sit in a comfortable posture. Close the eyes. On the inhale, mentally chant 'Na-Ma-Shi'. On the exhale, 'Va-Ya'. Feel each syllable as a wave of Shiva's presence washing through you. This is Shiva-dhyana.", "Practical instruction for Panchakshara meditation"),
            ("The Final Teaching", "Shiva said: I am everywhere. I am in your breath. I am in your heartbeat. I am the awareness by which you know you exist. When you seek me with the totality of your being — I reveal myself as the very one who is seeking. Tat Tvam Asi — Thou art That.", "Shiva's ultimate non-dual teaching to Parvati"),
        ]),
    7: ("Vayaviya Samhita", "वायवीय संहिता",
        "Narrated by the wind god Vayu. Contains the highest philosophical teachings on the nature of Shiva, the path of liberation through Shaiva Siddhanta.",
        [
            ("Vayu's Narration", "The wind god Vayu said: Long ago, in Naimisharanya, the sages asked Shiva about the supreme truth. Shiva taught them: I am the absolute. I am beyond all categories, beyond form and formless. Yet for the sake of the devotee, I take form.", "Framing narrative of Vayu's teaching from Shiva"),
            ("Shaiva Siddhanta", "The Shaiva Siddhanta teaches three eternal realities: Pati (the Lord — Shiva), Pashu (the bound soul), and Pasha (the bonds of ignorance). Shiva's grace removes the bonds. The liberated soul remains distinct yet united, like light in light.", "Core teaching of Shaiva Siddhanta philosophy"),
            ("Creation as Shiva's Sport", "Why did Shiva create the universe? From no necessity — only from pure, overflowing joy. Creation is Shiva's lila, his divine sport. The universe is not a mistake or a fall — it is a joyful expression of infinite consciousness playing with itself.", "Shiva's creation as divine lila (play)"),
            ("Liberation While Living (Jivanmukta)", "The highest state is not to die and then be liberated — it is to be liberated while still living. The Jivanmukta acts in the world but is not bound by it. Like a lotus untouched by water, the Jivanmukta lives in Shiva-consciousness.", "Teaching on Jivanmukti — liberation while alive"),
            ("The Grace of Shiva", "Shiva's grace (anugraha) is the cause of liberation. It cannot be earned through action alone — it descends when the devotee is ripe, like rain that falls when the cloud is full. Keep your vessel clean through devotion and austerity, and the grace will come.", "Final teaching on Shiva's grace as the cause of liberation"),
        ]),
}


def _shiva_purana_chapters():
    cached = _cache_get("shiva_purana_chapters")
    if cached:
        return cached
    chapters = []
    for num, (title, sanskrit, summary, _) in _SHIVA_PURANA_SAMHITAS.items():
        chapters.append({
            "chapter_number": num,
            "title":          title,
            "sanskrit_title": sanskrit,
            "summary":        summary,
            "verse_count":    5,
        })
    return _cache_set("shiva_purana_chapters", {"chapters": chapters})


def _shiva_purana_chapter_verses(chapter_num: int):
    if chapter_num not in _SHIVA_PURANA_SAMHITAS:
        raise HTTPException(status_code=404, detail="Samhita not found")
    title_en, title_sa, summary, key_verses = _SHIVA_PURANA_SAMHITAS[chapter_num]
    verses = []
    for i, (vtitle, translation, commentary) in enumerate(key_verses):
        verses.append({
            "verse_number":    i + 1,
            "chapter_number":  chapter_num,
            "label":           vtitle,
            "sanskrit":        "",
            "transliteration": "",
            "translation":     translation,
            "commentary":      commentary,
        })
    return {
        "chapter_number":  chapter_num,
        "title":           title_en,
        "sanskrit_title":  title_sa,
        "summary":         summary,
        "verse_count":     len(verses),
        "verses":          verses,
        "note":            "Shiva Purana — curated key teachings per Samhita. Full Sanskrit text edition coming soon.",
        "source_credit":   "Shiva Purana (public domain) — Motilal Banarsidass edition",
    }


# ═════════════════════════════════════════════════════════════════════════════
# DEVI MAHATMYA  (curated — 13 chapters)
# ═════════════════════════════════════════════════════════════════════════════

_DEVI_MAHATMYA_CHAPTERS = {
    1:  ("Madhu-Kaitabha Vadha",   "मधु-कैटभ वध",
         "The slaying of the demons Madhu and Kaitabha. Vishnu lies in cosmic sleep; Brahma praises the Goddess to awaken him.",
         [("Vishnu's Cosmic Sleep", "At the end of a cosmic age, Vishnu sleeps on the cosmic ocean. The demons Madhu and Kaitabha, born from his ear-wax, attack Brahma. Brahma praises the Devi who is the power of sleep within Vishnu: 'O Goddess, you are the soul of all, the consciousness of all, the mother of all. Withdraw your power from Vishnu so he may awaken and slay these demons.'", "Opening narrative of the Devi Mahatmya"),
            ("Brahma's Hymn to the Goddess", "You are the one Shakti — the power behind all powers. You are Vishnu's Maya; you are Brahma's knowledge; you are Shiva's consciousness. You are both the creator and the created, both the bound and the liberator.", "Brahma's praises to the Devi showing her as supreme reality"),
            ("The Devi Grants Victory", "Hearing Brahma's hymn, the Goddess withdrew from Vishnu. He awoke and fought the demons. She deluded them with her maya, and Vishnu placed them on his own thighs — the only dry land — and slew them.", "The Devi's maya enabling Vishnu's victory"),
         ]),
    2:  ("Mahisha Asura Vadha Praarambha", "महिषासुर वध प्रारम्भ",
         "The demon Mahishasura defeats the gods and takes over heaven. From the collective divine energy, the great Devi (Durga) is born.",
         [("Heaven Conquered", "Mahishasura, the buffalo demon, performed great austerities and received a boon — he could be killed by no male. With this boon, he made war on the gods. For a hundred divine years the battle raged, and the gods were defeated.", "The demons' conquest of heaven"),
            ("Birth of the Goddess", "The gods concentrated their divine energies. From Shiva came a great light; from Vishnu came another; from each god came a ray of power. These lights merged into a single blazing mass — and from that mass the Goddess Durga arose.", "The miraculous birth of Durga from the collective divine energy"),
            ("The Gods Offer Weapons", "Each god offered the Goddess a weapon: Shiva gave his trident, Vishnu his Sudarshana Chakra, Indra his Vajra, Himalaya gave a lion as her mount. The Goddess accepted all.", "The arming of the Goddess"),
         ]),
    3:  ("Mahisha Vadha",     "महिषासुर वध",
         "The great battle between Durga and Mahishasura. The demon changes forms repeatedly but is finally slain.",
         [("The Great Battle", "Mahishasura's army attacked the Goddess. She fought them all — laughing, her lion roaring. The demon generals fell before her. The earth trembled, the sky filled with her weapons.", "The cosmic battle between Durga and Mahishasura's army"),
            ("Mahisha Changes Forms", "Mahishasura himself entered the battle, changing from buffalo to lion to man to elephant and back. She pinned his buffalo form, and as he emerged as a human from the buffalo's neck, she struck off his head.", "The slaying of Mahishasura"),
            ("The Gods Praise Durga", "The gods rained flowers on the victorious Goddess. The Goddess spoke: 'Whenever you are in distress, call upon me and I will come.' Thus she became Durga — the remover of difficulties.", "The gods' celebration and Durga's promise"),
         ]),
    4:  ("Shakti Stuti",      "शक्ति स्तुति",
         "The gods praise the victorious Goddess. The first great hymn of the Devi Mahatmya is sung.",
         [("Ya Devi Sarva Bhuteshu", "O Goddess who dwells in all beings as consciousness — salutation to you! O Goddess who dwells in all beings as intelligence — salutation! O Goddess who dwells in all beings as sleep, as hunger, as strength, as thirst — salutation always to you!", "The famous Ya Devi verse — the Goddess as consciousness in all beings"),
            ("The Goddess as Universal Mother", "You are the mother of this universe. You are the power of Brahma, of Vishnu, of Shiva. Without you, none of them can function. You are the Shakti — the power — without which power itself would be powerless.", "The Goddess as the supreme Shakti behind all divine power"),
            ("The Goddess Grants Boons", "The Goddess said: 'In every age I will take birth to protect the dharma. Call upon me by any name — Durga, Kali, Lakshmi, Saraswati — I am one. My grace is upon all who seek it with a pure heart.'", "The Goddess's promise of repeated manifestation"),
         ]),
    5:  ("Shumbha Nishumbha Vadha Praarambha", "शुम्भ-निशुम्भ वध प्रारम्भ",
         "The demons Shumbha and Nishumbha conquer the gods. They demand the Goddess as wife. She refuses with fierce dignity.",
         [("The Goddess Alone", "In the Himalayas, the demon Chanda saw the Goddess and was struck by her beauty. He reported to Shumbha: 'In the Himalayas lives a woman of incomparable beauty — fit only for you, O king.' Shumbha sent his messenger to demand her.", "The demons' coveting of the Goddess"),
            ("The Goddess's Reply", "The Goddess said: 'I have made a foolish vow in childhood — I will marry only one who defeats me in battle. Let Shumbha come and fight. If he wins, I am his.' The messenger was astonished at her boldness.", "The Goddess's proud challenge to Shumbha"),
            ("Kali Arises from the Goddess's Frown", "When the demon armies attacked, the Goddess frowned with anger — and from the space between her eyebrows, the black goddess Kali sprang forth, sword in hand, skull-garlanded, hungry for battle.", "The birth of Kali from Durga's wrathful brow"),
         ]),
    6:  ("Dhoomralochana Vadha",  "धूम्रलोचन वध",
         "Shumbha sends his general Dhoomralochana to capture the Goddess. She destroys him with a single breath.",
         [("The General Advances", "Shumbha sent his general Dhoomralochana with sixty thousand demons to capture the Goddess. 'Bring her to me by force if she refuses,' he commanded.", "Shumbha's command"),
            ("Destroyed by a Single Sound", "The Goddess looked at the approaching general and simply exhaled — a sound like the roar of fire. Dhoomralochana was reduced to ash instantly. His army was scattered and destroyed.", "The ease with which the Goddess destroys the demon general"),
            ("Shumbha's Rage", "When news came that Dhoomralochana was destroyed by a single breath, Shumbha was furious. He sent his next two generals — Chanda and Munda — with the entire demon army.", "Escalation of the conflict"),
         ]),
    7:  ("Chanda-Munda Vadha",    "चण्ड-मुण्ड वध",
         "The demons Chanda and Munda attack the Goddess. Kali emerges from her brow and slays them both.",
         [("Kali Fights", "Chanda and Munda advanced with a vast demon army. Kali, sprung from the Goddess's brow, stood before them — black as storm clouds, red-eyed, tongue lolling, wearing a garland of severed heads. She laughed and fell upon the demons.", "Kali's fearsome battle"),
            ("The Slaying of Chanda and Munda", "Chanda hurled weapons; Kali caught them in her mouth. She seized Chanda by the hair and severed his head. Then she seized Munda and did the same. She returned to Durga carrying both heads as gifts.", "Kali's victory"),
            ("Chamunda", "Durga laughed and said: 'Because you slew Chanda and Munda, you will be known as Chamunda.' And Kali became known as Chamunda — one of the many names of the fierce Goddess.", "Origin of Kali's name Chamunda"),
         ]),
    8:  ("Raktabija Vadha",       "रक्तबीज वध",
         "The demon Raktabija — each drop of his blood spawns a new demon. Kali defeats him by drinking every drop.",
         [("The Demon's Terrible Boon", "Raktabija — 'blood-seed' — had received a boon: every drop of his blood that fell to earth would instantly produce a demon exactly like him. When the gods cut him with weapons, each drop produced thousands of new Raktabijas.", "The terrifying boon of Raktabija"),
            ("Kali's Solution", "The Goddess directed Kali: 'Open your mouth wide and spread your tongue over the battlefield. Drink every drop of his blood as it falls. Let not a drop touch the earth.' Kali spread her vast tongue over the field.", "The strategic solution to Raktabija's invincibility"),
            ("Victory", "As the Goddess struck Raktabija again and again, Kali's tongue caught every drop. No new demon could arise. Finally, drained of blood, Raktabija fell and died. Kali, drunk on demon blood, began to dance wildly.", "The defeat of Raktabija"),
         ]),
    9:  ("Nishumbha Vadha",       "निशुम्भ वध",
         "The Goddess fights and slays Nishumbha — the brother of Shumbha.",
         [("Nishumbha Falls", "Nishumbha entered the battle himself, filled with rage. She endured each blow and struck back. Finally, she drove her spear through his chest.", "The battle with Nishumbha"),
            ("Nishumbha Refuses to Die", "Even with the spear through him, another form of Nishumbha tried to emerge from his wound. The Goddess severed his head instantly, saying: 'Where will you go now?'", "The final death of Nishumbha"),
            ("Shumbha Sees His Army Fall", "Shumbha witnessed the destruction of his brother and his entire army. He was filled with grief and rage. He himself descended into battle to face the Goddess directly.", "Shumbha prepares to fight"),
         ]),
    10: ("Shumbha Vadha",         "शुम्भ वध",
         "The final battle. Shumbha fights the Goddess. She absorbs all her manifestations back into herself and defeats him alone.",
         [("The Final Challenge", "Shumbha said: 'O Devi, you fight with the help of all the other goddesses. That is not real strength.' The Goddess smiled: 'I stand alone in the universe. All these are my own manifestations. Watch.' She called all the other goddesses back into her body.", "The Goddess's ultimate demonstration of her singular nature"),
            ("The Cosmic Battle", "Shumbha and the Goddess fought a tremendous battle. They both rose into the sky. Their weapons clashed like lightning. The worlds trembled.", "The cosmic duel"),
            ("The Fall of Shumbha", "As he fell, Shumbha had a moment of clarity and saw the Goddess as she truly is — infinite, luminous. In that final moment of recognition, even the demon attained liberation. Such is the grace of the Goddess.", "Shumbha's liberation through the Goddess's grace"),
         ]),
    11: ("Narayani Stuti",        "नारायणी स्तुति",
         "The great hymn to the Goddess Narayani sung by the gods after her final victory.",
         [("Ya Devi Sarva Bhuteshu — Full Verse", "O Devi who dwells in all beings as consciousness, as intelligence, as sleep, as hunger, as shadow, as power, as thirst, as forgiveness, as beauty, as lineage, as peace, as faith, as loveliness, as fortune, as activity, as memory, as compassion, as contentment, as mother, as error — I bow to you, I bow always to you.", "The complete Ya Devi verse"),
            ("Sarva Mangala Mangalye", "O most auspicious of all auspicious things, O refuge of all, O three-eyed one, O Gauri, O Narayani, I bow to you. You are the power of Brahma as Saraswati; of Vishnu as Lakshmi; of Shiva as Parvati. You are the mother of the universe.", "The Sarva Mangala verse"),
            ("The Goddess's Promise", "Wherever this story of my glory is told — in assembly halls, in forests — there I will be present. Wherever this is heard with faith, I will destroy all obstacles for that devotee.", "The Goddess's promise to devotees"),
         ]),
    12: ("Phalashruthi",          "फलश्रुति",
         "The fruits of reciting and hearing the Devi Mahatmya. The kings Suratha and the merchant Samadhi receive her blessings.",
         [("Suratha and Samadhi Worship the Goddess", "King Suratha, who had lost his kingdom, and Samadhi the merchant, abandoned by his family, met the sage Medha in the forest. He taught them the Devi Mahatmya. They performed three years of intense worship, and the Goddess appeared before them.", "The frame story of the Devi Mahatmya's devotees"),
            ("The Goddess Grants Boons", "The Goddess said to Suratha: 'You will recover your kingdom, and at the end of the age you will become the Manu.' To Samadhi: 'The knowledge of the Self will arise in you and you will attain liberation.' Thus she blessed both.", "The different boons granted according to spiritual levels"),
            ("The Fruits of Recitation", "Whoever hears this glory of mine with full attention — from them all calamities will be removed, all poverty will leave, all diseases will be cured. On auspicious occasions, in times of distress, recite this — and I will be there.", "The phalaśruti — the fruits of reading the Devi Mahatmya"),
         ]),
    13: ("Aparadha Kshamapana Stotram", "अपराध क्षमापन स्तोत्रम्",
         "The final hymn — asking forgiveness from the Goddess for any errors committed in worship.",
         [("Asking Forgiveness", "O Devi, whatever errors I have made in your worship — wrong mantras, wrong gestures, wrong timings — whatever was done from ignorance, please forgive it all with your motherly grace.", "The devotee's humble request for forgiveness"),
            ("The Perfection of Devotion", "O Mother, you know the heart of the devotee. You do not judge the outer form of worship — you see the inner devotion. A flower offered with a pure heart is worth more than a thousand rituals performed without love.", "On the primacy of inner devotion"),
            ("The Final Salutation", "Salutation to you, O Chandika! Salutation to you, O Ambika, O Uma, O Devi! You who are beyond all names and forms, yet take form out of compassion — salutation, salutation, salutation always to you.", "Final salutation to the Goddess"),
         ]),
}


def _devi_mahatmya_chapters():
    cached = _cache_get("devi_mahatmya_chapters")
    if cached:
        return cached
    chapters = []
    for num, (title, sanskrit, summary, _) in _DEVI_MAHATMYA_CHAPTERS.items():
        chapters.append({
            "chapter_number": num,
            "title":          title,
            "sanskrit_title": sanskrit,
            "summary":        summary,
            "verse_count":    3,
        })
    return _cache_set("devi_mahatmya_chapters", {"chapters": chapters})


def _devi_mahatmya_chapter_verses(chapter_num: int):
    if chapter_num not in _DEVI_MAHATMYA_CHAPTERS:
        raise HTTPException(status_code=404, detail="Chapter not found")
    title_en, title_sa, summary, key_verses = _DEVI_MAHATMYA_CHAPTERS[chapter_num]
    verses = []
    for i, (vtitle, translation, commentary) in enumerate(key_verses):
        verses.append({
            "verse_number":    i + 1,
            "chapter_number":  chapter_num,
            "label":           vtitle,
            "sanskrit":        "",
            "transliteration": "",
            "translation":     translation,
            "commentary":      commentary,
        })
    return {
        "chapter_number":  chapter_num,
        "title":           title_en,
        "sanskrit_title":  title_sa,
        "summary":         summary,
        "verse_count":     len(verses),
        "verses":          verses,
        "note":            "Devi Mahatmya (Durga Saptashati) — key teachings per chapter. Full Sanskrit edition coming soon.",
        "source_credit":   "Devi Mahatmya / Durga Saptashati (public domain) — Ramakrishna Math edition",
    }


# ═════════════════════════════════════════════════════════════════════════════
# RAMCHARITMANAS  (curated — Tulsidas, 7 kandas)
# ═════════════════════════════════════════════════════════════════════════════
# Tulsidas's Awadhi retelling of the Rama story (c. 1574 CE), same author as
# the Hanuman Chalisa above. The full text runs to roughly 10,900 chaupais
# and dohas across 7 kandas — far too large to hand-curate in full, so (as
# with Shiva Purana / Devi Mahatmya above) we curate the best-known moments
# per kanda rather than attempting a complete verse-by-verse edition.

_RAMCHARITMANAS_KANDAS = {
    1: ("Bala Kanda", "बालकाण्ड",
        "Tulsidas opens with invocations to his gurus and the Divine, then narrates Rama's birth in Ayodhya, his childhood, Vishwamitra's tutelage, and the breaking of Shiva's bow to win Sita's hand.",
        [
            ("Invocation to the Guru", "Tulsidas opens by bowing to the dust of his Guru's lotus feet, which purify the mirror of the mind, before setting out to describe the spotless glory of Raghuvira (Rama) that grants the four fruits of life.", "The Manas's famous opening invocation, echoed later in the Hanuman Chalisa by the same author"),
            ("Rama's Birth in Ayodhya", "King Dasharatha of Ayodhya, after long-awaited sons through the Putrakameshti yajna, rejoices as Kaushalya gives birth to Rama, an incarnation of Vishnu, alongside his brothers Bharata, Lakshmana, and Shatrughna.", "The divine birth narrative shared with the Valmiki Ramayana's Bala Kanda"),
            ("Vishwamitra's Tutelage", "The sage Vishwamitra takes young Rama and Lakshmana to protect his forest sacrifice from demons, teaching them sacred weapons (astras) along the way and preparing Rama for his destiny.", "Rama's early training under sage Vishwamitra"),
            ("The Breaking of Shiva's Bow", "At King Janaka's court in Mithila, Rama effortlessly lifts and breaks the mighty bow of Shiva that no other king could even move, winning the hand of Princess Sita in marriage.", "The pivotal Sita-swayamvara episode"),
        ]),
    2: ("Ayodhya Kanda", "अयोध्याकाण्ड",
        "On the eve of Rama's coronation, Queen Kaikeyi is provoked by her maid Manthara into demanding Rama's 14-year exile and her own son Bharata's crowning. Rama departs for the forest; Bharata refuses the throne.",
        [
            ("Manthara's Provocation", "Manthara, Kaikeyi's hunchbacked maid, convinces the queen that Rama's coronation threatens her son Bharata's future, turning Kaikeyi's joy into jealousy and fear.", "The turning point that sets the exile in motion"),
            ("Kaikeyi's Two Boons", "Kaikeyi reminds Dasharatha of two boons he once owed her, demanding Rama's 14-year exile to the forest and Bharata's coronation instead. Bound by his word, the grief-stricken king can only comply.", "Dasharatha's dilemma between truthfulness and love for Rama"),
            ("Rama's Cheerful Obedience", "Rama accepts the exile without a trace of resentment, seeing obedience to his father's word as dharma itself. Sita and Lakshmana insist on accompanying him into the forest.", "Tulsidas's portrayal of Rama as the ideal of filial duty (maryada purushottama)"),
            ("Bharata Refuses the Throne", "On learning of the events, Bharata is horrified and refuses to accept the kingdom gained through his mother's scheme. He travels to the forest to beg Rama to return, and when Rama insists on completing the exile, Bharata rules only as regent, placing Rama's sandals upon the throne.", "Bharata's devotion, considered the moral high point of this kanda"),
        ]),
    3: ("Aranya Kanda", "अरण्यकाण्ड",
        "Life in the Dandaka forest; the demoness Shurpanakha's disfigurement, Ravana's abduction of Sita through the golden-deer ruse, and Jatayu's sacrifice.",
        [
            ("Shurpanakha's Rejection", "The demoness Shurpanakha, smitten with Rama, is rebuffed and then mocks Sita, provoking Lakshmana to disfigure her. She flees to her brother Ravana in Lanka seeking revenge.", "The provocation that draws Ravana's attention to Sita"),
            ("The Golden Deer", "The demon Maricha, at Ravana's command, transforms into a dazzling golden deer to lure Rama away from the hermitage, leaving Sita momentarily unprotected.", "Ravana's ruse to separate Rama from Sita"),
            ("The Abduction of Sita", "While Rama and Lakshmana are drawn away, Ravana appears disguised as an ascetic and abducts Sita, carrying her off in his aerial chariot to Lanka.", "The central crisis of the epic"),
            ("Jatayu's Sacrifice", "The aged vulture-king Jatayu, seeing Sita's abduction, attacks Ravana's chariot to rescue her. Mortally wounded, he lives just long enough to tell Rama what happened before passing away in Rama's arms.", "Jatayu's devotion honoured by Rama performing his last rites"),
        ]),
    4: ("Kishkindha Kanda", "किष्किन्धाकाण्ड",
        "Rama's alliance with the monkey-king Sugriva and his minister Hanuman; the killing of the tyrant Vali; the search for Sita begins.",
        [
            ("Meeting Hanuman and Sugriva", "In the Kishkindha forest, Rama and Lakshmana meet Hanuman, who recognises Rama's divinity, and through him the exiled monkey-king Sugriva, forging an alliance of mutual aid.", "The beginning of Rama's friendship with the vanara kingdom"),
            ("The Slaying of Vali", "Rama helps Sugriva reclaim his kingdom and wife from his tyrannical brother Vali by killing Vali from concealment during their duel — an episode Tulsidas frames as restoring rightful dharma.", "One of the more debated episodes of the epic, addressed directly by Tulsidas through Rama's own explanation to the dying Vali"),
            ("Sugriva's Coronation", "With Vali slain, Sugriva is crowned king of Kishkindha and pledges his monkey army to help Rama find Sita, fulfilling his debt of gratitude.", "The alliance that makes the rescue of Sita possible"),
            ("The Search Begins", "Sugriva dispatches search parties of monkeys in all four directions. The southern party, led by Hanuman, Angada, and Jambavan, eventually learns of Sita's location in Lanka.", "Setting up the events of the Sundara Kanda"),
        ]),
    5: ("Sundara Kanda", "सुन्दरकाण्ड",
        "Hanuman's leap across the ocean, his discovery of Sita in the Ashoka grove, the burning of Lanka, and his triumphant return — the most widely recited kanda of the Manas.",
        [
            ("Hanuman's Leap Across the Ocean", "Growing to an immense size, Hanuman leaps across the ocean to Lanka, overcoming the mountain Mainaka's offer of rest, the demoness Surasa's test, and the shadow-catching demon Simhika along the way.", "The most celebrated feat of the Sundara Kanda"),
            ("Finding Sita in the Ashoka Grove", "Hanuman finds Sita, captive in Ravana's Ashoka grove, steadfastly refusing Ravana's advances. He identifies himself with Rama's signet ring and delivers a message of hope and reassurance.", "The emotional heart of the kanda"),
            ("The Burning of Lanka", "Captured and mocked by Ravana's court, Hanuman allows his tail to be set alight — then uses the flames to burn down much of Lanka before extinguishing himself in the sea and escaping.", "Hanuman's fearless retaliation"),
            ("The Return with News", "Hanuman leaps back across the ocean and reports to Rama that Sita has been found, setting in motion the building of the bridge and the war to come.", "The kanda's resolution, prized above all for devotees of Hanuman"),
        ]),
    6: ("Lanka Kanda", "लंकाकाण्ड",
        "Also called Yuddha Kanda — the building of the bridge to Lanka, the great war with Ravana's forces, and Rama's final victory.",
        [
            ("Building the Bridge (Rama Setu)", "The monkey army, led by the engineers Nala and Nila, builds a floating bridge of stones across the ocean to Lanka, each stone inscribed with Rama's name.", "The famous Rama Setu bridge-building episode"),
            ("Vibhishana's Surrender", "Ravana's righteous brother Vibhishana, unable to dissuade him from returning Sita, defects to Rama's side and is later crowned king of Lanka after the war.", "Vibhishana as an example of righteousness over blood loyalty"),
            ("The Fall of Kumbhakarna and Meghnada", "Ravana's giant brother Kumbhakarna and his powerful son Indrajit (Meghnada) both fall in battle against the vanara army and Rama's brothers, weakening Ravana's forces decisively.", "Key turning points of the war"),
            ("The Death of Ravana", "After a fierce final duel, Rama slays Ravana with a divine arrow aimed at his navel, where his life force was concealed, ending the ten-headed demon king's tyranny.", "The epic's climactic battle"),
            ("Sita's Fire Test and the Return to Ayodhya", "Sita undergoes the Agni Pariksha (fire ordeal) to prove her purity, after which Rama, Sita, and Lakshmana return to Ayodhya, where Bharata joyfully restores the kingdom to Rama.", "The joyous conclusion of the exile, celebrated to this day as Diwali"),
        ]),
    7: ("Uttara Kanda", "उत्तरकाण्ड",
        "Rama's ideal reign (Ram Rajya), Sita's later exile due to public rumour, the birth of Lava and Kusha, and the epic's closing teachings on devotion.",
        [
            ("Ram Rajya", "Rama's reign in Ayodhya becomes the very model of just and prosperous governance — a golden age remembered ever after as 'Ram Rajya', where dharma flourishes and all citizens live in harmony.", "The ideal of righteous kingship central to the Manas's teaching"),
            ("Sita's Second Exile", "Hearing a washerman's doubt about Sita's purity after her long captivity, Rama, bound by his duty as king to public perception, reluctantly sends the pregnant Sita to the forest, where she is sheltered by the sage Valmiki.", "One of the epic's most poignant and debated episodes"),
            ("Lava and Kusha", "Sita raises her twin sons Lava and Kusha in Valmiki's hermitage, where they are trained in the Vedas and in the very story of their father's deeds — the Ramayana itself.", "The frame in which the epic is said to have first been recited"),
            ("Tulsidas's Closing Teaching", "The Manas closes not with narrative but with teaching: Tulsidas declares that the repetition of Rama's name (Rama-nama) is the surest raft across the ocean of worldly existence, open to every being regardless of caste or learning.", "The devotional (bhakti) message that made the Manas the most widely read scripture in North India"),
        ]),
}


def _ramcharitmanas_chapters():
    cached = _cache_get("ramcharitmanas_chapters")
    if cached:
        return cached
    chapters = []
    for num, (title, sanskrit, summary, verses) in _RAMCHARITMANAS_KANDAS.items():
        chapters.append({
            "chapter_number": num,
            "title":          title,
            "sanskrit_title": sanskrit,
            "summary":        summary,
            "verse_count":    len(verses),
        })
    return _cache_set("ramcharitmanas_chapters", {"chapters": chapters})


def _ramcharitmanas_kanda_verses(kanda_num: int):
    if kanda_num not in _RAMCHARITMANAS_KANDAS:
        raise HTTPException(status_code=404, detail="Kanda not found")
    title_en, title_sa, summary, key_verses = _RAMCHARITMANAS_KANDAS[kanda_num]
    verses = []
    for i, (vtitle, translation, commentary) in enumerate(key_verses):
        verses.append({
            "verse_number":    i + 1,
            "chapter_number":  kanda_num,
            "label":           vtitle,
            "sanskrit":        "",
            "transliteration": "",
            "translation":     translation,
            "commentary":      commentary,
        })
    return {
        "chapter_number":  kanda_num,
        "title":           title_en,
        "sanskrit_title":  title_sa,
        "summary":         summary,
        "verse_count":     len(verses),
        "verses":          verses,
        "note":            "Ramcharitmanas — curated key episodes per kanda. Full Awadhi chaupai-by-chaupai edition coming soon.",
        "source_credit":   "Tulsidas, Ramcharitmanas (c. 1574 CE, public domain) — cf. F.S. Growse's English prose translation, The Rámáyana of Tulasidasa (1883, public domain)",
    }


# ═════════════════════════════════════════════════════════════════════════════
# UPANISHADS  (curated — 13 principal Upanishads)
# ═════════════════════════════════════════════════════════════════════════════
# The "principal Upanishads" traditionally commented on by Adi Shankara are
# the first 10 below; Svetasvatara, Kaushitaki, and Maitri are very
# commonly included alongside them to make the wider set of 13 referenced
# in scholarship (e.g. Max Müller's Sacred Books of the East, vols. 1 & 15).

_UPANISHADS = {
    1:  ("Isha Upanishad", "ईशोपनिषद्", "Yajur Veda",
         "The shortest and one of the most quoted Upanishads — only 18 verses — teaching that the divine pervades everything and that renunciation and action must be held together.",
         [
            ("Ishavasyam", "All this — whatever moves in this moving world — is enveloped by the Lord. Renounce it, then, and enjoy; do not covet the wealth of anyone.", "The opening verse and namesake of the Upanishad"),
            ("Action and Renunciation United", "Performing works in this world, one should wish to live a hundred years. This alone is the way for you to live without works clinging to you — there is no other way.", "The Isha's distinctive teaching that right action, not mere withdrawal, is the path"),
            ("The Golden Vessel", "The face of truth is covered by a golden disc. Remove it, O sustainer, so that one who is devoted to truth may see it.", "A celebrated verse on the veil between appearance and ultimate reality"),
         ]),
    2:  ("Kena Upanishad", "केनोपनिषद्", "Sama Veda",
         "Opens with the question 'By whom (kena) willed does the mind go forth?' and teaches that Brahman is the power behind the powers of mind, speech, breath, and the senses — unknowable by ordinary knowing.",
         [
            ("By Whom Willed?", "By whom willed and directed does the mind go forth to its objects? By whom commanded does the first breath move? By whom willed do people utter this speech? Who is the god that directs the eye and the ear?", "The Upanishad's opening question"),
            ("Known of No Knower", "It is other than the known, and beyond the unknown. So we have heard from the ancient teachers who explained this to us. That which is not expressed through speech, but by which speech itself is expressed — know that alone to be Brahman.", "The famous teaching that Brahman cannot be grasped as an object of ordinary knowledge"),
            ("The Parable of Fire and Wind", "Fire once boasted it could burn anything, but when tested by a blade of grass placed before it by a mysterious spirit (Brahman in disguise), it could not burn it alone. Wind likewise could not blow it away. Only when Indra approached humbly did the spirit reveal itself as Brahman, the source of all power.", "A teaching story on the humbling of divine pride before the Absolute"),
         ]),
    3:  ("Katha Upanishad", "कठोपनिषद्", "Krishna Yajur Veda",
         "The dialogue between the boy Nachiketa and Yama, the god of death, on the nature of the soul, the difference between the pleasant and the good, and the path beyond death.",
         [
            ("Nachiketa's Three Boons", "Sent to the abode of Death by his father's rash words, young Nachiketa waits three days unfed at Yama's door. Yama, ashamed, offers three boons. For the third, Nachiketa asks to know what happens to a person after death — the one question Yama tries hardest to deflect.", "The framing story of the Upanishad"),
            ("The Good and the Pleasant", "The good is one thing, the pleasant another; both, of different aims, bind a person. It is well for one who chooses the good; one who chooses the pleasant misses the true end.", "One of the Upanishads' most quoted ethical teachings"),
            ("The Chariot Simile", "Know the Self as the rider in a chariot, the body as the chariot itself. Know the intellect as the charioteer, and the mind as the reins. The senses are the horses, and the objects of sense their roads.", "The famous chariot analogy for self-mastery, later echoed in the Bhagavad Gita"),
            ("Subtler Than the Subtle", "The Self is smaller than the small, greater than the great, hidden in the heart of every creature. One who is free from desire sees the majesty of the Self through the grace of the creator, and beyond sorrow.", "On the paradoxical, all-pervading nature of Atman"),
         ]),
    4:  ("Prashna Upanishad", "प्रश्नोपनिषद्", "Atharva Veda",
         "Six disciples each ask the sage Pippalada one deep question — on the origin of beings, the nature of prana (life-force), sleep and dream, meditation on Om, and the nature of the sixteen-fold soul.",
         [
            ("The Origin of Beings", "Asked where creatures come from, Pippalada teaches that the Creator, desiring offspring, produced pairs — matter and life-breath (prana) — from which all beings arise.", "The cosmogonic teaching of the first question"),
            ("The Glory of Prana", "Prana, the life-breath, is likened to a king whose ministers are the senses; when prana prepares to depart the body, all the senses depart with it, showing its supremacy among the body's faculties.", "The Prashna's extended meditation on the life-force"),
            ("Meditation on Om", "Whoever meditates on the syllable Om with full understanding as the support for reaching the highest and the lowest is led, according to the depth of that meditation, either to a human birth, to the world of the moon, or to the world of Brahman itself.", "Teaching on Om as a graded vehicle of meditation"),
         ]),
    5:  ("Mundaka Upanishad", "मुण्डकोपनिषद्", "Atharva Veda",
         "Distinguishes the 'lower knowledge' of ritual and scripture from the 'higher knowledge' of Brahman, using the image of two birds on one tree, and the arrow-and-target metaphor for meditation.",
         [
            ("Two Kinds of Knowledge", "There are two kinds of knowledge to be known — the higher and the lower. The lower is the four Vedas and their auxiliary sciences; the higher is that by which the Imperishable is apprehended.", "The Mundaka's foundational distinction between ritual learning and direct realization"),
            ("Two Birds on One Tree", "Two birds, close companions, cling to the same tree. One eats the sweet fruit; the other looks on without eating. The eating bird is the individual self absorbed in experience; the watching bird is the Self as pure witness.", "One of the most celebrated images in all Upanishadic literature"),
            ("Truth Alone Triumphs", "Truth alone triumphs, not falsehood. By truth the path is spread out, the pathway on which the sages, whose desires have been fulfilled, travel to where that supreme treasure of Truth resides.", "Satyameva Jayate — later adopted as India's national motto"),
            ("The Bow and Arrow of Meditation", "Taking the great bow of the Upanishads, one should place upon it the arrow sharpened by devotion; drawing it back with a mind absorbed in the Self, one should penetrate that Imperishable as the target.", "The famous archery metaphor for one-pointed meditation on Brahman"),
         ]),
    6:  ("Mandukya Upanishad", "माण्डूक्योपनिषद्", "Atharva Veda",
         "The shortest Upanishad, just 12 verses, yet considered the most philosophically dense — it identifies the syllable Om with the four states of consciousness: waking, dreaming, deep sleep, and the fourth, Turiya.",
         [
            ("Om Is All", "Om is imperishable. It is all — the past, present, future, and whatever transcends the three divisions of time — all of it is verily Om.", "The Mandukya's opening identification of Om with all of time and existence"),
            ("The Four States", "The waking state is the sound A, experiencing the external world; the dreaming state is U, experiencing the subtle inner world; deep sleep is M, a state of undifferentiated bliss. Beyond all three, silent and whole, is Turiya — the fourth, the Self itself.", "The core teaching mapping the syllable Om onto the four states of consciousness"),
            ("Turiya, the Fourth", "Turiya is not knowledge of the internal, nor of the external, nor of both together; it is not a mass of consciousness, nor simple consciousness, nor unconsciousness. It is unseen, ungraspable, the essence of the one Self, the cessation of all relative existence — that is the Self, and that is to be known.", "The description of the fourth, non-dual state, the goal of the entire Upanishad"),
         ]),
    7:  ("Taittiriya Upanishad", "तैत्तिरीयोपनिषद्", "Krishna Yajur Veda",
         "Famous for its teaching of the five sheaths (koshas) that cover the Self, and its closing convocation address urging truthfulness, duty, and hospitality.",
         [
            ("The Five Sheaths (Koshas)", "The Self is covered by five sheaths, one within the other like nested boxes: the sheath of food (the physical body), the sheath of breath, the sheath of mind, the sheath of intellect, and innermost, the sheath of bliss — within which dwells the Self itself.", "The Taittiriya's celebrated Panchakosha (five-sheath) model of the human being"),
            ("Brahman Is Bliss", "He who knows the bliss of Brahman, from which words turn back along with the mind, unable to reach it, fears nothing whatsoever.", "The teaching that Brahman's essential nature is Ananda, bliss"),
            ("The Convocation Address", "Speak the truth. Practice virtue. Do not neglect your studies. Treat your mother, father, teacher, and guest as gods. Give with faith, in abundance, with modesty, and with sympathy. Let these be your vows.", "The Taittiriya's famous ethical instructions to departing students, still cited in Indian graduation ceremonies today"),
         ]),
    8:  ("Aitareya Upanishad", "ऐतरेयोपनिषद्", "Rig Veda",
         "A short but foundational Upanishad on cosmology and the nature of consciousness, containing the celebrated declaration 'Prajnanam Brahma' — consciousness is Brahman.",
         [
            ("Creation from the Self", "In the beginning, the Self alone existed, nothing else stirring. It thought, 'Let me create the worlds,' and so created the heavens, the mid-region, the earth, and the waters.", "The Aitareya's account of creation as unfolding from the Self alone"),
            ("The Self Enters the Body", "Having created the body, the Self wondered how it might enter it to experience it, and entered through the crown of the head, taking up residence within.", "On the indwelling presence of the Self within the created form"),
            ("Prajnanam Brahma — Consciousness Is Brahman", "Whatever this is — whether the eye's seeing, the mind's thinking, or the breath's breathing — all of it is guided by consciousness (prajnana). That very consciousness is Brahman.", "One of the four Mahavakyas (great sayings) of the Upanishads, one drawn from each Veda"),
         ]),
    9:  ("Chandogya Upanishad", "छान्दोग्योपनिषद्", "Sama Veda",
         "One of the longest and oldest Upanishads, containing the celebrated Uddalaka-Shvetaketu dialogue and its refrain 'Tat Tvam Asi' — Thou Art That.",
         [
            ("Tat Tvam Asi — Thou Art That", "Uddalaka teaches his son Shvetaketu through a series of examples — salt dissolved invisibly yet present throughout water, the unseen essence within a banyan seed — each time concluding: 'That subtle essence, this whole world has as its Self. That is Reality. That is the Self. Thou art That, Shvetaketu.'", "The most famous of the four Mahavakyas, repeated nine times across the dialogue"),
            ("The Parable of the Bees and Honey", "As bees gather nectar from many different flowers and blend it into one undifferentiated honey, so do all beings, upon merging into pure Being in deep sleep, lose their sense of separateness — though they do not know this upon waking.", "An image of the underlying unity beneath apparent multiplicity"),
            ("Satyakama Jabala's Honesty", "The boy Satyakama, unsure of his father's identity, honestly tells the sage Gautama that he does not know his lineage — a truthfulness so rare and admirable that the sage accepts him as a student regardless of birth.", "A widely cited episode emphasizing truthfulness over social status"),
         ]),
    10: ("Brihadaranyaka Upanishad", "बृहदारण्यकोपनिषद्", "Shukla Yajur Veda",
         "The longest of the Upanishads, containing the sage Yajnavalkya's teachings to his wife Maitreyi on the nature of the Self, and the Mahavakya 'Aham Brahmasmi' — I am Brahman.",
         [
            ("Yajnavalkya and Maitreyi", "Preparing to renounce worldly life, the sage Yajnavalkya offers to divide his wealth between his two wives. Maitreyi asks: 'Would wealth make me immortal?' Told no, she replies: 'Then what should I do with what will not make me immortal? Teach me instead what you know of that.'", "A celebrated dialogue on the limits of material wealth and the pursuit of Self-knowledge"),
            ("Aham Brahmasmi — I Am Brahman", "In the beginning, this universe was Brahman alone, and it knew only itself, thinking, 'I am Brahman.' Whoever among gods or humans awakens to this same truth becomes that very reality.", "The second of the four great Mahavakyas"),
            ("Neti Neti — Not This, Not This", "The Self can only be described as 'not this, not this' (neti neti) — it is ungraspable, for it cannot be grasped; it is imperishable, unattached, unbound, and untroubled.", "The Upanishad's method of pointing to the Self through negation of all finite descriptions"),
         ]),
    11: ("Svetasvatara Upanishad", "श्वेताश्वतरोपनिषद्", "Krishna Yajur Veda",
         "A theistic Upanishad that identifies the impersonal Brahman with a personal Lord (Ishvara, here as Rudra-Shiva), and introduces the Samkhya-Yoga concepts of Purusha and Prakriti.",
         [
            ("The One God Behind All Names", "He is the one God, hidden in all beings, all-pervading, the inner Self of all creatures, the overseer of all actions, dwelling in all beings, the witness, the pure consciousness alone, free of all qualities.", "The Svetasvatara's synthesis of the impersonal Brahman with a personal, worshipped Lord"),
            ("The Two Birds Revisited", "Two birds, inseparable companions, cling to the same tree. One eats the fruit of the tree with relish; the other, not eating, merely looks on. Grieving over its own powerlessness, when it beholds the glory and greatness of the other, its grief passes away.", "A restatement of the Mundaka's image, here framed as liberation through recognizing the Lord's glory"),
            ("Not by Reasoning Alone", "This Self is not to be attained through much learning, nor through intellect, nor through much hearing of scripture. It is attained by the one whom It chooses; to such a one the Self reveals its own true form.", "On grace as necessary alongside effort and study"),
         ]),
    12: ("Kaushitaki Upanishad", "कौषीतकि ब्राह्मणोपनिषद्", "Rig Veda",
         "Contains the dialogue between King Ajatashatru and the proud Brahmin Balaki on the true nature of Brahman, and teachings on prana as the unifying life-principle.",
         [
            ("Ajatashatru Humbles Balaki", "The learned Balaki boasts to King Ajatashatru that he can teach him about Brahman, offering a dozen different identifications of gods and cosmic forces with Brahman. The king rejects each in turn, and finally, reversing roles, teaches the proud Brahmin himself the deeper truth of the Self.", "A striking episode where a kshatriya king instructs a Brahmin priest, illustrating that wisdom is not bound by social role"),
            ("Prana as the Unifying Principle", "As the spokes are held together in the hub and felly of a wheel, so are all things held together in prana, in speech, and in mind.", "The Kaushitaki's teaching on the life-breath as the unifying support of all faculties"),
            ("The Path of the Departed", "Those who depart this world travel first to the moon; those who cannot answer its questions are reborn into new bodies according to their deeds, while those who answer rightly proceed onward toward Brahman.", "An early articulation of the 'path of the fathers' and 'path of the gods' found across the Upanishads"),
         ]),
    13: ("Maitri Upanishad", "मैत्रायणीयोपनिषद्", "Krishna Yajur Veda",
         "One of the later principal Upanishads, notable for its extended treatment of the mind as the cause of both bondage and liberation, and its synthesis with early Yoga and Samkhya ideas.",
         [
            ("The Mind as Cause of Bondage and Freedom", "Mind alone is the cause of bondage and liberation for human beings: bondage if attached to sense-objects, freedom if free from them. This is the definitive teaching.", "The Maitri's central psychological teaching on the mind's dual role"),
            ("The King Brihadratha's Renunciation", "King Brihadratha, having placed his son on the throne, retreats to the forest in disgust at the fleeting nature of pleasures, seeking from the sage Shakayanya the knowledge that leads beyond the perishable body.", "The framing story that opens the Upanishad"),
            ("Six-Limbed Yoga", "Breath control, withdrawal of the senses, meditation, concentration, contemplation, and absorption — these six are taught here as the limbs of yoga, an early ancestor of the eight-limbed system later systematized by Patanjali.", "An early Upanishadic articulation of yogic practice, predating the classical Yoga Sutras"),
         ]),
}


def _upanishad_chapters():
    cached = _cache_get("upanishad_chapters")
    if cached:
        return cached
    chapters = []
    for num, (title, sanskrit, veda, summary, verses) in _UPANISHADS.items():
        chapters.append({
            "chapter_number": num,
            "title":          title,
            "sanskrit_title": sanskrit,
            "veda":           veda,
            "summary":        summary,
            "verse_count":    len(verses),
        })
    return _cache_set("upanishad_chapters", {"chapters": chapters})


def _upanishad_chapter_verses(chapter_num: int):
    if chapter_num not in _UPANISHADS:
        raise HTTPException(status_code=404, detail="Upanishad not found (1–13 only)")
    title_en, title_sa, veda, summary, key_verses = _UPANISHADS[chapter_num]
    verses = []
    for i, (vtitle, translation, commentary) in enumerate(key_verses):
        verses.append({
            "verse_number":    i + 1,
            "chapter_number":  chapter_num,
            "label":           vtitle,
            "sanskrit":        "",
            "transliteration": "",
            "translation":     translation,
            "commentary":      commentary,
        })
    return {
        "chapter_number":  chapter_num,
        "title":           title_en,
        "sanskrit_title":  title_sa,
        "veda":            veda,
        "summary":         summary,
        "verse_count":     len(verses),
        "verses":          verses,
        "note":            "Curated key mantras per Upanishad. Full Sanskrit verse-by-verse edition coming soon.",
        "source_credit":   "Principal Upanishads (public domain Sanskrit) — cf. Max Müller's English translation, Sacred Books of the East vols. 1 & 15 (1879, public domain)",
    }


# ═════════════════════════════════════════════════════════════════════════════
# RIG VEDA  (curated — 10 mandalas, most celebrated hymns)
# ═════════════════════════════════════════════════════════════════════════════
# The Rig Veda has 1,028 hymns (~10,552 verses) across 10 mandalas — an
# archive-scale corpus. Rather than a fragile page-by-page scrape of a
# century-old translation, we curate the hymns of greatest historical and
# philosophical significance from each mandala, in the spirit of Griffith's
# 1896 translation (long public domain).

_RIGVEDA_MANDALAS = {
    1:  ("Mandala 1", "प्रथम मण्डलम्",
         "The largest mandala (191 hymns), opening the Rig Veda with invocations to Agni and containing the celebrated 'Riddle Hymn'.",
         [
            ("Hymn to Agni (1.1)", "I laud Agni, the priest set before the sacrifice, the divine minister of the ritual, the invoker who bestows the greatest wealth. Through Agni one obtains wealth, and prosperity increasing day by day, most rich in heroes and renown.", "The very first hymn of the Rig Veda, addressed to the fire-god Agni as intermediary between humans and gods"),
            ("The Riddle Hymn (1.164)", "Seven yoke the one-wheeled chariot drawn by a single horse with seven names; the wheel has three naves, is imperishable, and upon it rest all these worlds. This whole universe is founded on syllables of imperishable sound.", "A famously enigmatic hymn of cosmological riddles, among the most philosophically rich in the entire text"),
         ]),
    2:  ("Mandala 2", "द्वितीय मण्डलम्",
         "Attributed to the Gritsamada family of sages, largely devoted to Agni and Indra.",
         [
            ("Hymn to Agni (2.1)", "Thou, Agni, art Indra, the bull of all that lives; thou art wide-striding Vishnu, worthy of worship. Thou art Brahmanaspati, the priest whose wealth is prayer; thou, O sustainer, art linked with holy thought.", "A hymn identifying Agni with the powers of many other gods, an early expression of unity behind the pantheon"),
            ("Hymn to Brihaspati (2.23)", "We call on Brihaspati, chief and king of prayer, best of sages, whose might no foe can conquer; the beautiful, the ancient, the friend well-praised, whose aid the wise entreat.", "Praise of Brihaspati, the god of sacred speech and wisdom"),
         ]),
    3:  ("Mandala 3", "तृतीय मण्डलम्",
         "Attributed to sage Vishwamitra, containing the Gayatri Mantra — perhaps the single most recited verse in all of Hindu practice.",
         [
            ("The Gayatri Mantra (3.62.10)", "Let us meditate on the most excellent light and power of that divine Sun (Savitr); may that radiance illumine our minds.", "The Gayatri Mantra, chanted daily by millions, attributed to sage Vishwamitra"),
            ("Hymn to Mitra (3.59)", "Mitra, when he speaks, stirs the people to action; Mitra sustains both earth and heaven; Mitra beholds all beings with unwinking eye; to Mitra we bring our offering of clarified butter.", "Praise of Mitra, god of covenant, friendship, and the binding truth between beings"),
         ]),
    4:  ("Mandala 4", "चतुर्थ मण्डलम्",
         "Attributed to the Vamadeva family, largely hymns to Agni and Indra with vivid nature imagery.",
         [
            ("Hymn to Agni (4.1)", "Thou, Agni, born through sacred acts, art established among mortal men as their guest; through thee the gods enjoy their share of the oblation, and through thee, O radiant one, do we prosper.", "Agni's role as the messenger carrying offerings from earth to the gods"),
            ("The Falcon and the Soma (4.26–27)", "I was Manu, I was the sun, declares the soaring falcon, who carries the soma plant down from the heavens to the earth for the sacrifice — pursued swiftly by the archer Krishanu, yet outracing his arrow.", "A vivid mythic narrative of the eagle/falcon bringing soma to humankind"),
         ]),
    5:  ("Mandala 5", "पञ्चम मण्डलम्",
         "Attributed to the Atri family, notable for its hymn to Parjanya, the rain-god.",
         [
            ("Hymn to Parjanya (5.83)", "Sing forth with these to mighty Parjanya, and magnify him; with reverence seek his favour; the roaring bull who quickens seed in creatures sends the rain-bearing clouds across the sky.", "A vivid nature hymn to the rain-god, celebrating the monsoon's life-giving power"),
            ("Hymn to Agni (5.1)", "Awake, O Agni, as the friend of the dawn when she awakens; may all who worship gain the wide-spread wealth that comes from you.", "Agni invoked at the break of day, in step with dawn rituals"),
         ]),
    6:  ("Mandala 6", "षष्ठ मण्डलम्",
         "Attributed to the Bharadvaja family, including a distinctive hymn on weapons and armour.",
         [
            ("Hymn to Arms (6.75)", "With the bow let us win cattle, with the bow let us win the fierce, hard-fought battle; the bow brings grief to the enemy; armed with the bow may we conquer every quarter.", "A striking hymn invoking the protective and martial power of the bow and armour, recited even today for protection"),
            ("Riddle Hymn to Vishnu and Indra (6.9)", "One half of the day is dark, the other bright; both, though of one substance, revolve as if by magic. As a father, so is Agni to his son; may he come to us as our benevolent friend.", "A hymn playing on the riddle of day and night as expressions of a single underlying reality"),
         ]),
    7:  ("Mandala 7", "सप्तम मण्डलम्",
         "Attributed to the sage Vasishtha, containing the celebrated 'Frog Hymn' and important hymns to Varuna.",
         [
            ("Hymn to Varuna (7.86)", "Wise and mighty are the works of him who fixed apart the wide earth and heaven; who spurred the high and starry sky to motion. If I have sinned against a friend through thoughtlessness, O Varuna, free me from that transgression.", "One of the Rig Veda's rare hymns of moral confession and appeal for forgiveness"),
            ("The Frog Hymn (7.103)", "Like Brahmins seated round the brimming vessel, chanting on the holy Soma day, so, frogs, do you sit round the pool and celebrate the coming of the rains with croaking chorus.", "A playful hymn comparing the croaking of frogs at the monsoon's onset to Brahmin priests chanting at a sacrifice"),
         ]),
    8:  ("Mandala 8", "अष्टम मण्डलम्",
         "Attributed largely to the Kanva family, rich in hymns to Soma and containing several 'danastuti' hymns praising royal patrons' generosity.",
         [
            ("Hymn to Soma (8.48)", "We have drunk the Soma; we have become immortal; we have gone to the light; we have found the gods. What can hostility now do to us, O immortal one, and what the malice of any mortal?", "One of the most famous hymns of the Rig Veda, celebrating the exalted, immortalizing effect of the sacred Soma drink"),
            ("A Danastuti (Gift-Praise) Hymn (8.1)", "Let no one, not even a friend who wishes you ill, turn you from this path; sing to Indra, most manly of all, the bestower of great gifts to his devoted worshippers.", "An example of the danastuti genre, praising a patron's generosity to the officiating poet"),
         ]),
    9:  ("Mandala 9", "नवम मण्डलम्",
         "Devoted entirely to Soma Pavamana — the purifying, clarifying flow of the sacred Soma juice as it is pressed for the ritual.",
         [
            ("Soma Pavamana (9.113)", "Where there is eternal light, in the world where the sun is placed, in that immortal, imperishable world, O purifying Soma, place me. Where there is joy and delight, where gladness and rejoicing dwell, where all desires are fulfilled — there, make me immortal.", "One of the most lyrical hymns in the Rig Veda, longing for the eternal, luminous world beyond death"),
         ]),
    10: ("Mandala 10", "दशम मण्डलम्",
         "The latest and most philosophically developed mandala, containing the Purusha Sukta, the Nasadiya Sukta (Hymn of Creation), the Hiranyagarbha hymn, and the Devi Sukta.",
         [
            ("Purusha Sukta (10.90)", "The Cosmic Person (Purusha) has a thousand heads, a thousand eyes, a thousand feet; he pervades the earth on every side and extends beyond it by ten fingers' breadth. All beings are but a quarter of him; three-quarters, immortal, remain in heaven.", "The famous hymn of the Cosmic Person from whose sacrifice the universe and social orders are said to arise"),
            ("Nasadiya Sukta — The Hymn of Creation (10.129)", "There was neither non-existence nor existence then; there was no realm of air, no sky beyond it. Who really knows? Who will here proclaim it? Whence was it born, whence came this creation? Even the gods came after its creation, so who truly knows whence it arose?", "Perhaps the most celebrated philosophical hymn in the Rig Veda, ending in radical, honest uncertainty about the origin of the universe"),
            ("Hiranyagarbha Sukta (10.121)", "In the beginning arose the Golden Embryo (Hiranyagarbha); as soon as born, he was the one lord of all that is. He held the earth and this sky. To what god shall we offer our oblation?", "A hymn to the singular divine source of creation, its refrain 'Kasmai devaya havisha vidhema' ('to what god shall we offer?') echoed throughout"),
            ("Devi Sukta (10.125)", "I move with the Rudras, with the Vasus, with the Adityas and All-Gods; I support both Mitra and Varuna, both Indra and Agni, and the two Ashvins. I am the sovereign queen, the gatherer-up of treasures, the first of those worthy of worship.", "A hymn spoken in the voice of the Goddess (Vak, speech personified) declaring her supremacy among all divine powers"),
            ("The Gambler's Lament (10.34)", "The dice, rolling down from the tall Vibhidaka tree, roll me about as the wind tosses cotton. My wife holds me not dear, nor do others; I find no pleasure in the gambling hall, and yet I cannot leave the dice.", "A remarkably human, confessional hymn on the ruin brought by gambling addiction"),
         ]),
}


def _rigveda_chapters():
    cached = _cache_get("rigveda_chapters")
    if cached:
        return cached
    chapters = []
    for num, (title, sanskrit, summary, verses) in _RIGVEDA_MANDALAS.items():
        chapters.append({
            "chapter_number": num,
            "title":          title,
            "sanskrit_title": sanskrit,
            "summary":        summary,
            "verse_count":    len(verses),
        })
    return _cache_set("rigveda_chapters", {"chapters": chapters})


def _rigveda_mandala_verses(mandala_num: int):
    if mandala_num not in _RIGVEDA_MANDALAS:
        raise HTTPException(status_code=404, detail="Mandala not found (1–10 only)")
    title_en, title_sa, summary, key_verses = _RIGVEDA_MANDALAS[mandala_num]
    verses = []
    for i, (vtitle, translation, commentary) in enumerate(key_verses):
        verses.append({
            "verse_number":    i + 1,
            "chapter_number":  mandala_num,
            "label":           vtitle,
            "sanskrit":        "",
            "transliteration": "",
            "translation":     translation,
            "commentary":      commentary,
        })
    return {
        "chapter_number":  mandala_num,
        "title":           title_en,
        "sanskrit_title":  title_sa,
        "summary":         summary,
        "verse_count":     len(verses),
        "verses":          verses,
        "note":            "Curated selection of the most historically and philosophically significant hymns from this mandala. Full 1,028-hymn text coming soon.",
        "source_credit":   "Rig Veda (public domain Sanskrit) — cf. Ralph T.H. Griffith's English translation, The Hymns of the Rigveda (1896, public domain)",
    }


# ═════════════════════════════════════════════════════════════════════════════
# MANUSMRITI  (curated — 12 chapters)
# ═════════════════════════════════════════════════════════════════════════════
# The Manusmriti (Laws of Manu) is a Dharmashastra text of roughly 2,685
# verses across 12 chapters. It is presented here as a historical legal and
# ethical treatise for study purposes; several of its provisions on caste
# and gender are widely and rightly contested today and are described here
# descriptively, not as endorsement.

_MANUSMRITI_CHAPTERS = {
    1:  ("Creation", "सृष्टि",
         "Cosmogony — the origin of the universe, the creation of Manu, and the divine basis claimed for dharma and the four varnas (social classes).",
         [
            ("The Self-Existent Creates", "The Self-Existent Lord, desiring to bring forth beings of many kinds from his own body, first created the waters and placed a seed in them, from which arose a golden egg, in which he himself was born as Brahma.", "The text's cosmogonic opening, framing all subsequent law as divinely grounded"),
            ("The Four Varnas from the Cosmic Body", "For the growth of the worlds, from his mouth, arms, thighs, and feet, the Brahmin, Kshatriya, Vaishya, and Shudra are said to have been created, each assigned distinct duties.", "The text's foundational — and historically most contested — claim for the origin of the varna system"),
            ("Dharma as the Only True Friend", "A person is born alone and dies alone; alone one enjoys the rewards of good deeds and alone bears the consequences of evil ones. Dharma alone will remain with a person after death; all else is left behind.", "A widely quoted verse on personal moral responsibility, independent of the varna material"),
         ]),
    2:  ("Sources of Dharma and the Student Stage", "धर्मस्य मूलानि",
         "The scriptural and customary sources of dharma, followed by detailed rules for the brahmacharya (student) stage of life, including duties toward one's teacher.",
         [
            ("The Sources of Law", "The whole Veda is the first source of dharma; next, the tradition and virtuous conduct of those who know the Veda; then the customs of righteous persons; and finally, satisfaction of one's own conscience.", "The text's own account of its methodology and authority"),
            ("Reverence for the Teacher (Guru)", "The teacher who imparts knowledge of the Self is to be honoured above the teacher of ordinary learning, for from that teacher comes an immortal birth of the mind, greater than the birth given by one's parents.", "On the elevated status accorded to spiritual teachers relative to birth parents"),
            ("The Value of a Learned Person Regardless of Age", "A person is not to be considered venerable merely because their head has turned grey; even a child who has mastered knowledge is regarded by the wise as an elder.", "A verse valuing wisdom over mere seniority in age"),
         ]),
    3:  ("Marriage and the Householder", "विवाह एवं गृहस्थ",
         "The eight recognized forms of marriage, the duties of the householder stage of life, and rules concerning hospitality to guests.",
         [
            ("The Eight Forms of Marriage", "Eight forms of marriage are described, ranging from the Brahma marriage (gift of a daughter to a learned suitor) to the much-criticized Rakshasa and Paishacha forms associated with abduction or deceit — the text itself ranks the former as commendable and the latter as blameworthy.", "The text's own internal hierarchy distinguishing approved from disapproved marriage customs"),
            ("The Householder as the Support of All Stages", "As all rivers, great and small, find their rest in the ocean, so all the stages of life find their support in the householder; the householder stage is therefore declared the most important of the four ashramas.", "On the centrality of family and domestic life in the text's framework"),
            ("Duty to the Unexpected Guest", "A guest who arrives at sunset should not be turned away; whether he comes at an unsuitable time or not, he should not go without food from a householder's house.", "A widely cited teaching on hospitality (atithi dharma)"),
         ]),
    4:  ("Rules of Livelihood", "जीविकोपाय",
         "Guidance on earning a living, daily conduct, purity, study, and general ethical restraint for the householder.",
         [
            ("Right Means of Livelihood", "One should follow that mode of livelihood which causes no injury to others, or the least injury possible, except in times of extreme distress.", "A general ethical principle of minimizing harm in one's occupation"),
            ("Restraint of Speech", "One should speak the truth, and speak what is pleasant; one should not speak an unpleasant truth, nor speak a pleasant falsehood — this is the eternal law.", "A frequently quoted teaching on truthful yet compassionate speech"),
            ("Company and Character", "By company with the virtuous, even the wicked attain to goodness in time, as a cloth takes on the fragrance of the flowers it is kept among.", "A verse on the formative influence of one's associations"),
         ]),
    5:  ("Diet, Purification, and Duties of Women", "आहारशुद्धि एवं स्त्रीधर्म",
         "Rules on permitted and forbidden foods, rites of purification, and — most contested historically — a chapter on the duties and subordination expected of women within the patriarchal household structure of the period.",
         [
            ("Rules on Diet", "Various rules on which foods are and are not to be consumed by different groups are set out at length, reflecting the ritual purity concerns characteristic of the text's era.", "A summary of the chapter's extensive dietary regulations"),
            ("On the Independence of Women", "This chapter contains some of the Manusmriti's most widely criticized verses, asserting that a woman should be under the protection of her father in childhood, her husband in youth, and her son in old age, and should never be considered fit for independence.", "Historically significant and heavily criticized content, presented descriptively as part of the primary source rather than as an endorsed view"),
            ("Honouring Women", "Elsewhere the same chapter states that where women are honoured, the gods are pleased, but where they are not honoured, all rites are fruitless — an internally inconsistent tension often noted by scholars studying the text.", "A frequently cited counterpoint verse, illustrating the text's internal contradictions on this subject"),
         ]),
    6:  ("The Forest Dweller and the Renunciate", "वानप्रस्थ एवं संन्यास",
         "Duties of the vanaprastha (forest-dwelling) and sannyasa (renunciate) stages of life, describing detachment from worldly ties in pursuit of liberation.",
         [
            ("Entering the Forest", "When a householder sees his skin wrinkled and his hair turned grey, and sees his grandchildren, he may then resort to the forest, gradually loosening his ties to household life.", "The transition marking entry into the third stage of life"),
            ("The Renunciate's Detachment", "The renunciate should wander alone, without a companion, seeking neither companionship nor solitude for its own sake, ever intent on realizing the Self, seeking that alone which is imperishable.", "The ideal of the wandering ascetic (sannyasi) seeking liberation"),
            ("Equanimity in All Circumstances", "Neither by praise nor blame should the wise person be moved; free from attachment and aversion, treating all creatures as one's self, such a person is fit for liberation.", "A widely-quoted teaching on equanimity, echoing themes found across the Gita and Upanishads"),
         ]),
    7:  ("Duties of the King", "राजधर्म",
         "Extensive guidance for kings on governance, justice, taxation, warfare, and the appointment of ministers — an early treatise on statecraft.",
         [
            ("The Divine Origin of Kingship", "Because all this world would perish without a ruler to punish wrongdoing, the Lord created the king by taking eternal particles from the essence of Indra, Vayu, Yama, and other gods.", "The text's justification for the institution of monarchy as necessary for social order"),
            ("The King's Duty to Protect", "The king's chief duty is protection of his subjects; a king who protects his people according to the law and duly punishes those who deserve punishment thrives, while one who fails in this duty declines.", "The core justification for royal authority — protection in exchange for legitimacy"),
            ("Choosing Wise Counsellors", "A king should appoint seven or eight ministers, learned in the sacred law, brave, experienced in war, of noble family, and tested for integrity, and should consult with them both individually and together before acting.", "Early guidance on collective, tested counsel in governance"),
         ]),
    8:  ("Law and Judicial Procedure", "व्यवहार",
         "The longest chapter — detailed rules of civil and criminal law, including property disputes, contracts, witnesses, and penalties for various offenses.",
         [
            ("Eighteen Grounds for Litigation", "Eighteen categories of legal dispute are enumerated, including non-payment of debts, deposits, sale without ownership, boundary disputes, defamation, assault, and theft, forming an early systematic civil and criminal code.", "The chapter's organizing framework for legal disputes"),
            ("The Standard for Judges", "A king or judge should decide cases only after examining the true facts, considering local custom, and consulting the sacred law texts; a judgment made through favoritism or in ignorance of the law is condemned as void.", "An early articulation of judicial impartiality and reliance on evidence"),
            ("Graduated Punishment by Circumstance", "The text prescribes highly unequal punishments for identical offences depending on the varna of the offender and victim — provisions widely regarded by modern scholars as reflecting, and reinforcing, the caste hierarchy of its time.", "Historically significant and much-criticized content, noted here descriptively rather than endorsed"),
         ]),
    9:  ("Family Law and the Duties of Vaishyas and Shudras", "स्त्रीपुरुषधर्म एवं वैश्यशूद्रधर्म",
         "Rules of inheritance, family property, remarriage, and the prescribed occupations of the vaishya and shudra varnas.",
         [
            ("Rules of Inheritance", "Detailed rules are given for the division of a father's property among sons, generally favouring the eldest son with a larger share while providing for younger sons and, in some verses, for unmarried daughters.", "An early system of inheritance law"),
            ("Occupations of the Vaishya", "The vaishya is enjoined to tend cattle, engage in trade, lend money at interest, and cultivate the land, sustaining the material economy of society.", "The prescribed economic role of the merchant/agriculturalist class"),
            ("Occupations of the Shudra", "The shudra is enjoined to serve the other three classes, a provision that, together with related verses restricting shudra access to education and ritual, is among the most widely condemned in the entire text by modern readers and reformers, including B.R. Ambedkar.", "Historically significant and heavily criticized content, included descriptively for its historical role rather than as endorsement"),
         ]),
    10: ("Mixed Castes and Duties in Times of Adversity", "वर्णसंकर एवं आपद्धर्म",
         "Rules concerning the offspring of inter-varna unions, and exceptional conduct permitted for any varna during times of extreme hardship (apad-dharma).",
         [
            ("On Mixed Lineages", "The chapter classifies numerous mixed castes said to arise from unions between different varnas, assigning them specific hereditary occupations — a classification system modern historians view as reflecting later social stratification projected back onto the text.", "Historical content on the varna-sankara (mixed-caste) framework, presented descriptively"),
            ("Exceptions in Times of Distress", "In times of extreme distress or famine, the text permits a Brahmin to take up occupations normally reserved for other varnas in order to survive, showing the system was not regarded as absolutely rigid even by the text itself.", "A notable acknowledgment of practical flexibility within the varna framework"),
            ("Priority of Non-Violence Even in Adversity", "Even under the pressure of livelihood, one should not adopt a means of living that involves cruelty toward living beings; better a modest, harmless life than a prosperous one built on the suffering of others.", "An ethical constraint placed even upon the apad-dharma exceptions"),
         ]),
    11: ("Penances", "प्रायश्चित्त",
         "An extensive catalogue of penances (prayashchitta) prescribed for various transgressions, along with rules on charitable giving.",
         [
            ("The Purpose of Penance", "Sinful acts committed by a person become known through their bodily marks and afflictions; penance is the means by which those consequences are removed and the mind restored to purity.", "The text's rationale for the practice of penance"),
            ("Study, Fasting, and Charity as Purifiers", "Recitation of the Vedas, austerity, fasting, offering oblations, and truthfulness are each capable of destroying past faults, in proportion to the sincerity with which they are undertaken.", "General means of purification recommended across many offenses"),
            ("Charity in Proportion to Ability", "Gifts should be given according to one's means and to those deserving of them; even a small gift given with faith and to a worthy recipient bears far greater fruit than a large gift given without faith.", "A widely-cited teaching on the spirit, not merely the scale, of charitable giving"),
         ]),
    12: ("Transmigration and Final Liberation", "कर्मफल एवं मोक्ष",
         "The final chapter — the doctrine of karma and rebirth across the three gunas, and the path to ultimate liberation (moksha) through knowledge of the Self.",
         [
            ("The Threefold Fruit of Action", "Action performed with the body, speech, or mind yields good or bad results; the three kinds of action lead respectively to a good, mixed, or evil condition of existence for those subject to their consequences in future lives.", "The text's account of karma across the three domains of action"),
            ("Rebirth According to the Gunas", "Those in whom sattva (goodness) predominates rise to the state of gods; those dominated by rajas (passion) are reborn as humans; those dominated by tamas (inertia) sink toward the state of animals — the guna framework shared with the Bhagavad Gita's later teaching.", "On the moral-cosmological framework of the three gunas determining rebirth"),
            ("The Self Beyond All Distinctions", "One who recognizes the Self existing equally in all creatures, and behaves toward all beings as toward one's own self, attains the highest state — beyond all further transmigration.", "The text's concluding teaching, pointing toward liberation through recognition of the universal Self"),
         ]),
}


def _manusmriti_chapters():
    cached = _cache_get("manusmriti_chapters")
    if cached:
        return cached
    chapters = []
    for num, (title, sanskrit, summary, verses) in _MANUSMRITI_CHAPTERS.items():
        chapters.append({
            "chapter_number": num,
            "title":          title,
            "sanskrit_title": sanskrit,
            "summary":        summary,
            "verse_count":    len(verses),
        })
    return _cache_set("manusmriti_chapters", {"chapters": chapters})


def _manusmriti_chapter_verses(chapter_num: int):
    if chapter_num not in _MANUSMRITI_CHAPTERS:
        raise HTTPException(status_code=404, detail="Chapter not found (1–12 only)")
    title_en, title_sa, summary, key_verses = _MANUSMRITI_CHAPTERS[chapter_num]
    verses = []
    for i, (vtitle, translation, commentary) in enumerate(key_verses):
        verses.append({
            "verse_number":    i + 1,
            "chapter_number":  chapter_num,
            "label":           vtitle,
            "sanskrit":        "",
            "transliteration": "",
            "translation":     translation,
            "commentary":      commentary,
        })
    return {
        "chapter_number":  chapter_num,
        "title":           title_en,
        "sanskrit_title":  title_sa,
        "summary":         summary,
        "verse_count":     len(verses),
        "verses":          verses,
        "note":            "Manusmriti — curated key verses per chapter, presented as historical Dharmashastra text for study; several provisions on caste and gender are widely contested today. Full verse-by-verse edition coming soon.",
        "source_credit":   "Manusmriti (public domain Sanskrit) — cf. Georg Bühler's English translation, The Laws of Manu, Sacred Books of the East vol. 25 (1886, public domain)",
    }


# ═════════════════════════════════════════════════════════════════════════════
# VISHNU PURANA  (curated — 6 amshas/books)
# ═════════════════════════════════════════════════════════════════════════════

_VISHNU_PURANA_BOOKS = {
    1: ("First Amsha — Creation", "प्रथम अंश",
        "Cosmology and creation narrated by the sage Parashara to his disciple Maitreya, including the story of the devoted child-sage Dhruva and the demon-king Hiranyakashipu.",
        [
            ("Parashara's Discourse", "The sage Parashara, asked by his disciple Maitreya to explain the origin of the universe, begins the Vishnu Purana by describing Vishnu as both the material and efficient cause of creation — the universe emanating from, sustained by, and dissolving back into him.", "The frame narrative introducing the entire Purana"),
            ("Dhruva's Devotion", "The young prince Dhruva, hurt by his stepmother's rejection, retreats to the forest and performs such intense devotion to Vishnu that he is granted an eternal, unmoving place in the sky — becoming the Pole Star (Dhruva Tara).", "One of the most beloved devotional stories of the Purana, still told to children today"),
            ("Prahlada and Hiranyakashipu", "The demon-king Hiranyakashipu, having gained a near-invulnerability boon, persecutes his own son Prahlada for his unshakeable devotion to Vishnu. Vishnu ultimately appears as Narasimha, half-man half-lion, to slay the tyrant at twilight, on a threshold, neither indoors nor out — circumventing every term of his boon.", "The Narasimha avatara story, a major episode of divine protection of the devotee"),
        ]),
    2: ("Second Amsha — The World and Bharata", "द्वितीय अंश",
        "The geography and cosmography of the seven dvipas (continents) with Jambudvipa and Bharatavarsha (India) at their centre, and the story of the sage-king Bharata.",
        [
            ("The Geography of Jambudvipa", "The Purana describes the world as composed of seven concentric island-continents (dvipas) separated by seas of different substances, with Jambudvipa — centred on Mount Meru — regarded as the innermost and holiest, containing Bharatavarsha, the land later known as India.", "The Purana's cosmographic map of the known and mythic world"),
            ("King Bharata's Renunciation", "King Bharata, after a righteous reign, renounces his kingdom, but becomes so attached to a fawn he rescues that he is reborn first as a deer and then as a brahmin, illustrating how even a virtuous mind can be bound by subtle, unexamined attachment.", "A cautionary teaching on the danger of attachment, however seemingly innocent"),
            ("Land Named for Bharata", "The land of Bharatavarsha (India) is said in the text to take its name either from this King Bharata or from an earlier king of the same name, son of Rishabha — the Purana itself notes both traditions.", "The Puranic explanation for the traditional Sanskrit name of India"),
        ]),
    3: ("Third Amsha — The Vedas and Social Order", "तृतीय अंश",
        "The compilation of the Vedas by Vyasa across different cosmic ages, the duties proper to each varna and life-stage, and funeral rites (shraddha).",
        [
            ("Vyasa's Compilation of the Vedas", "In every Dvapara Yuga, an incarnation of Vyasa arises to divide the single, immense primeval Veda into four for the convenience of humankind, whose memory and capacity for austerity diminish across the ages.", "The Purana's account of how the four Vedas as we know them came to be organized"),
            ("Duties Across Life's Stages", "The Purana enumerates the proper conduct expected in the stages of student, householder, forest-dweller, and renunciate, presenting them as complementary phases of a single well-ordered life rather than competing paths.", "A restatement of the ashrama system found across many Puranic and dharmashastra texts"),
            ("Shraddha — Rites for the Ancestors", "Detailed instructions are given for the shraddha ceremony, performed to honour and sustain deceased ancestors, reflecting the importance of ancestor veneration in the tradition.", "On the ritual obligations owed to one's forebears"),
        ]),
    4: ("Fourth Amsha — Royal Genealogies", "चतुर्थ अंश",
        "Extensive dynastic lists of the Solar (Suryavamsha) and Lunar (Chandravamsha) royal lineages, including the ancestors of Rama and the Pandavas.",
        [
            ("The Solar Dynasty", "The Purana traces the Solar dynasty from Vivasvat (the Sun) down through many generations to Ikshvaku and eventually to Rama of Ayodhya, situating the Ramayana's hero within a vast historical-mythic genealogy.", "The dynastic lineage claimed for Lord Rama"),
            ("The Lunar Dynasty", "The Lunar dynasty is traced from the moon-god Soma down through Puru, Yayati, and the Kuru line, eventually reaching the generation of the Pandavas and Kauravas of the Mahabharata.", "The dynastic lineage claimed for the Mahabharata's protagonists"),
            ("The Purpose of Genealogy", "The Purana states that hearing the genealogies of kings and sages purifies the listener of sin and confers merit equal to that of performing a great sacrifice — genealogy here functioning as a form of sacred remembrance, not mere record-keeping.", "The devotional significance the text itself attaches to these long king-lists"),
        ]),
    5: ("Fifth Amsha — The Life of Krishna", "पञ्चम अंश",
        "One of the earliest and most complete Puranic accounts of Krishna's life — birth, childhood in Vrindavana, the slaying of Kansa, and his role in restoring dharma.",
        [
            ("Krishna's Birth in Prison", "Krishna is born to Devaki and Vasudeva in the prison of the tyrant Kansa, who has been warned that Devaki's eighth child will slay him. Vasudeva secretly carries the infant across the flooding Yamuna river to safety in Gokula, exchanging him for a girl child.", "The dramatic nativity narrative shared with other Krishna-centred Puranas"),
            ("Govardhana Lifted", "When the villagers of Vrindavana are threatened by the wrath of Indra's storms after Krishna redirects their worship toward the local mountain, Krishna lifts Mount Govardhana on his little finger for seven days, sheltering the entire community beneath it.", "One of Krishna's most iconic childhood miracles"),
            ("The Slaying of Kansa", "Krishna and his brother Balarama travel to Mathura and, in a public wrestling arena, Krishna kills the tyrant king Kansa, fulfilling the prophecy and freeing his imprisoned parents.", "The climactic episode of Krishna's youth, marking his emergence as a public deliverer from tyranny"),
        ]),
    6: ("Sixth Amsha — Kali Yuga and Dissolution", "षष्ठ अंश",
        "A prophetic description of the moral decline of the Kali Yuga (the current age), followed by an account of the cosmic dissolution (pralaya) and teachings on final liberation.",
        [
            ("The Characteristics of Kali Yuga", "In the Kali Yuga, the text foretells, wealth alone will confer status, hypocrisy will be mistaken for virtue, marriage will be arranged by mutual consent alone without regard for family, and rulers will tax their subjects while providing no real protection.", "A frequently cited prophetic passage on moral decline in the present age"),
            ("The Fourfold Dissolution", "The Purana describes dissolution occurring on multiple scales: the daily dissolution of sleep, the periodic dissolution at the end of each cosmic day of Brahma, the elemental dissolution at the end of Brahma's life, and the final, absolute dissolution into the unmanifest.", "The Purana's layered cosmology of time and dissolution"),
            ("Liberation as Recognition, Not Escape", "True liberation, the text teaches through Parashara's final words to Maitreya, is not a physical departure to some other place but the recognition that one's own self was never actually bound — bondage itself being a product of ignorance (avidya).", "The Purana's closing teaching on the nature of moksha"),
        ]),
}


def _vishnu_purana_chapters():
    cached = _cache_get("vishnu_purana_chapters")
    if cached:
        return cached
    chapters = []
    for num, (title, sanskrit, summary, verses) in _VISHNU_PURANA_BOOKS.items():
        chapters.append({
            "chapter_number": num,
            "title":          title,
            "sanskrit_title": sanskrit,
            "summary":        summary,
            "verse_count":    len(verses),
        })
    return _cache_set("vishnu_purana_chapters", {"chapters": chapters})


def _vishnu_purana_book_verses(book_num: int):
    if book_num not in _VISHNU_PURANA_BOOKS:
        raise HTTPException(status_code=404, detail="Amsha not found (1–6 only)")
    title_en, title_sa, summary, key_verses = _VISHNU_PURANA_BOOKS[book_num]
    verses = []
    for i, (vtitle, translation, commentary) in enumerate(key_verses):
        verses.append({
            "verse_number":    i + 1,
            "chapter_number":  book_num,
            "label":           vtitle,
            "sanskrit":        "",
            "transliteration": "",
            "translation":     translation,
            "commentary":      commentary,
        })
    return {
        "chapter_number":  book_num,
        "title":           title_en,
        "sanskrit_title":  title_sa,
        "summary":         summary,
        "verse_count":     len(verses),
        "verses":          verses,
        "note":            "Vishnu Purana — curated key episodes per amsha (book). Full Sanskrit verse-by-verse edition coming soon.",
        "source_credit":   "Vishnu Purana (public domain Sanskrit) — cf. H.H. Wilson's English translation, The Vishńu Puráńa (1840, public domain)",
    }


# ═════════════════════════════════════════════════════════════════════════════
# YOGA SUTRAS OF PATANJALI  (curated — 4 padas)
# ═════════════════════════════════════════════════════════════════════════════
# The Yoga Sutras are short — only 196 sutras across 4 padas (chapters) —
# so a substantially larger fraction of the actual text is represented here
# than for the longer scriptures above, each sutra rendered in a concise
# paraphrase true to its well-established public domain translations.

_YOGA_SUTRAS_PADAS = {
    1: ("Samadhi Pada", "समाधि पाद",
        "The chapter on meditative absorption — defining yoga itself, the fluctuations of the mind it aims to still, and the varieties of samadhi.",
        [
            ("The Definition of Yoga (1.2)", "Yoga is the stilling of the fluctuations (vrittis) of the mind.", "The single most quoted sutra in the entire text, defining yoga's essential goal"),
            ("Then the Seer Rests in Its Own Nature (1.3)", "When the mind's fluctuations are stilled, the seer (the Self) abides in its own true nature; at other times, it appears to take the form of whatever fluctuation arises.", "The consequence of achieving the stillness defined in 1.2"),
            ("The Five Fluctuations (1.6)", "The fluctuations of the mind are of five kinds: right knowledge, misconception, imagination, sleep, and memory — whether or not they cause suffering.", "Patanjali's classification of all possible mental activity"),
            ("Practice and Non-Attachment (1.12)", "These fluctuations of the mind are stilled through sustained practice (abhyasa) and non-attachment (vairagya) together — neither is sufficient alone.", "The Yoga Sutras' twin foundational methods"),
            ("Obstacles on the Path (1.30)", "Disease, mental dullness, doubt, carelessness, laziness, sensory indulgence, false perception, failure to reach firm ground, and instability — these nine are the distractions that obstruct the mind's progress.", "Patanjali's enumeration of common obstacles to sustained practice"),
        ]),
    2: ("Sadhana Pada", "साधन पाद",
        "The chapter of practice — introducing kriya yoga, the causes of suffering (kleshas), and the eight limbs (ashtanga) of yoga culminating in this chapter's first five limbs.",
        [
            ("Kriya Yoga (2.1)", "Yoga in practice is composed of discipline (tapas), self-study (svadhyaya), and surrender to the Divine (Ishvara-pranidhana).", "The practical, action-oriented yoga recommended for daily life"),
            ("The Five Kleshas (2.3)", "Ignorance, egoism, attachment, aversion, and clinging to life are the five afflictions (kleshas) that are the root causes of all suffering.", "Patanjali's diagnosis of the sources of human suffering, with ignorance (avidya) as the root of the other four"),
            ("The Eight Limbs of Yoga (2.29)", "The eight limbs of yoga are: yama (ethical restraints), niyama (observances), asana (posture), pranayama (breath control), pratyahara (withdrawal of the senses), dharana (concentration), dhyana (meditation), and samadhi (absorption).", "The famous ashtanga (eight-limbed) framework that structures the rest of the text"),
            ("Steady and Comfortable Posture (2.46)", "Asana (posture) should be steady and comfortable.", "One of the most quoted sutras in modern yoga practice, though the original text says little else about physical postures specifically"),
            ("The Yamas — Ethical Restraints (2.30)", "The yamas are: non-violence (ahimsa), truthfulness (satya), non-stealing (asteya), continence (brahmacharya), and non-possessiveness (aparigraha).", "The first and foundational limb of the eight, concerned with one's conduct toward others"),
        ]),
    3: ("Vibhuti Pada", "विभूति पाद",
        "The chapter on the extraordinary powers (siddhis) said to arise from advanced yogic mastery, alongside a caution against becoming attached to them.",
        [
            ("Concentration, Meditation, and Absorption Together (3.4)", "Dharana, dhyana, and samadhi together, applied to a single object, constitute samyama — the combined instrument of deep yogic insight.", "The technical term samyama, central to this entire chapter's account of yogic powers"),
            ("Powers Arising from Samyama", "Through samyama practiced upon particular objects, the text describes a range of extraordinary attainments — from knowledge of past and future to control over hunger, thirst, and physical strength.", "A general summary of the many specific siddhis catalogued across this pada"),
            ("A Caution Against the Powers (3.37)", "These powers are considered accomplishments in the outward-turned, worldly state of mind, but are obstacles to samadhi itself — the very stillness that is yoga's actual goal.", "Patanjali's own warning that the siddhis are a distraction from, not the point of, yogic practice"),
        ]),
    4: ("Kaivalya Pada", "कैवल्य पाद",
        "The final, shortest chapter — on kaivalya, the ultimate liberation and isolation of pure consciousness (purusha) from all worldly entanglement.",
        [
            ("The Unchanging Witness (4.18)", "The changing states of the mind are always known to their unchanging witness, the purusha (pure consciousness), because the purusha itself does not change.", "On the eternal, unmoving nature of the true Self compared to the ever-shifting mind"),
            ("Kaivalya Defined (4.34)", "Kaivalya (final liberation) occurs when the three gunas, having fulfilled their purpose, revert to their source, and pure consciousness (purusha) stands established in its own true, isolated nature.", "The Yoga Sutras' closing definition of the goal of the entire eight-limbed path"),
        ]),
}


def _yoga_sutras_chapters():
    cached = _cache_get("yoga_sutras_chapters")
    if cached:
        return cached
    chapters = []
    for num, (title, sanskrit, summary, verses) in _YOGA_SUTRAS_PADAS.items():
        chapters.append({
            "chapter_number": num,
            "title":          title,
            "sanskrit_title": sanskrit,
            "summary":        summary,
            "verse_count":    len(verses),
        })
    return _cache_set("yoga_sutras_chapters", {"chapters": chapters})


def _yoga_sutras_pada_verses(pada_num: int):
    if pada_num not in _YOGA_SUTRAS_PADAS:
        raise HTTPException(status_code=404, detail="Pada not found (1–4 only)")
    title_en, title_sa, summary, key_verses = _YOGA_SUTRAS_PADAS[pada_num]
    verses = []
    for i, (vtitle, translation, commentary) in enumerate(key_verses):
        verses.append({
            "verse_number":    i + 1,
            "chapter_number":  pada_num,
            "label":           vtitle,
            "sanskrit":        "",
            "transliteration": "",
            "translation":     translation,
            "commentary":      commentary,
        })
    return {
        "chapter_number":  pada_num,
        "title":           title_en,
        "sanskrit_title":  title_sa,
        "summary":         summary,
        "verse_count":     len(verses),
        "verses":          verses,
        "note":            "Curated key sutras per pada, rendered as concise paraphrase. Full 196-sutra edition coming soon.",
        "source_credit":   "Patanjali's Yoga Sutras (public domain Sanskrit) — cf. Charles Johnston's English translation, The Yoga Sutras of Patanjali (1912, public domain)",
    }


# ═════════════════════════════════════════════════════════════════════════════
# ROUTING HELPERS
# ═════════════════════════════════════════════════════════════════════════════

def _dispatch_chapters(slug: str, api_source: str, book_id: int):
    if api_source == "bhagavad_gita_api":
        return _gita_chapters()
    if api_source == "valmiki_ramayana":
        return _ramayana_chapters()
    if api_source == "mahabharata":
        return _mahabharata_chapters()
    if api_source == "hanuman_chalisa":
        return _hanuman_chalisa_chapters()
    if api_source == "shiva_purana":
        return _shiva_purana_chapters()
    if api_source == "devi_mahatmya":
        return _devi_mahatmya_chapters()
    if api_source == "ramcharitmanas":
        return _ramcharitmanas_chapters()
    if api_source == "upanishads":
        return _upanishad_chapters()
    if api_source == "rigveda":
        return _rigveda_chapters()
    if api_source == "manusmriti":
        return _manusmriti_chapters()
    if api_source == "vishnu_purana":
        return _vishnu_purana_chapters()
    if api_source == "yoga_sutras":
        return _yoga_sutras_chapters()
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT chapter_number, title, summary, verse_count
            FROM book_chapters WHERE book_id = %s ORDER BY chapter_number
        """, (book_id,))
        rows = cur.fetchall()
    return {"chapters": [dict(r) for r in rows]}


def _dispatch_chapter_verses(slug: str, api_source: str, book_id: int, chapter_num: int):
    if api_source == "bhagavad_gita_api":
        return _gita_chapter_verses(chapter_num)
    if api_source == "valmiki_ramayana":
        return _ramayana_kanda_verses(chapter_num)
    if api_source == "mahabharata":
        return _mahabharata_parva_verses(chapter_num)
    if api_source == "hanuman_chalisa":
        return _hanuman_chalisa_verses()
    if api_source == "shiva_purana":
        return _shiva_purana_chapter_verses(chapter_num)
    if api_source == "devi_mahatmya":
        return _devi_mahatmya_chapter_verses(chapter_num)
    if api_source == "ramcharitmanas":
        return _ramcharitmanas_kanda_verses(chapter_num)
    if api_source == "upanishads":
        return _upanishad_chapter_verses(chapter_num)
    if api_source == "rigveda":
        return _rigveda_mandala_verses(chapter_num)
    if api_source == "manusmriti":
        return _manusmriti_chapter_verses(chapter_num)
    if api_source == "vishnu_purana":
        return _vishnu_purana_book_verses(chapter_num)
    if api_source == "yoga_sutras":
        return _yoga_sutras_pada_verses(chapter_num)
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT chapter_number, title, summary, verse_count
            FROM book_chapters WHERE book_id = %s AND chapter_number = %s
        """, (book_id, chapter_num))
        ch = cur.fetchone()
    if not ch:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return {**dict(ch), "verses": [],
            "note": "Full verse text for this scripture is coming soon."}


# ═════════════════════════════════════════════════════════════════════════════
# STATIC BOOKS  (no DB row — metadata lives in code, content is scraped live
# or curated in code)
# ═════════════════════════════════════════════════════════════════════════════
# For books where you don't want a `sacred_books` DB row at all, add an entry
# here. list_books/get_book/get_chapters/get_chapter_verses/search all check
# this registry before touching Postgres. Note: reading progress and
# bookmarks (reading_progress / book_bookmarks tables) are FK'd to a real
# sacred_books.id, so those two features are unavailable for static-only
# books — everything else (browsing, reading, search) works fully.
#
# The six scriptures below (ids -1..-6) are added as static/curated entries
# since they rely on hand-curated content rather than a live JSON API, in
# the same style as the Shiva Purana / Devi Mahatmya / Hanuman Chalisa
# sections above. If you'd rather they live in Postgres like the Gita and
# the two epics, just insert matching rows into `sacred_books` with the
# same `api_source` values and remove the corresponding entries here.

_STATIC_BOOKS = {
    "ramcharitmanas": {
        "id": -1, "slug": "ramcharitmanas", "title": "Ramcharitmanas",
        "sanskrit_title": "श्रीरामचरितमानस", "deity": "Rama", "tradition": "Vaishnavism",
        "language": "Awadhi (with English notes)", "total_chapters": 7, "total_verses": None,
        "description": "Tulsidas's 16th-century Awadhi retelling of the Rama story — the most widely read scripture in North Indian households, by the same author as the Hanuman Chalisa.",
        "icon_emoji": "🏹", "accent_color": "#B45309", "api_source": "ramcharitmanas",
    },
    "upanishads": {
        "id": -2, "slug": "upanishads", "title": "Upanishads",
        "sanskrit_title": "उपनिषद्", "deity": None, "tradition": "Vedanta",
        "language": "Sanskrit (with English notes)", "total_chapters": 13, "total_verses": None,
        "description": "The philosophical core of the Vedas — 13 principal Upanishads exploring the nature of the Self (Atman), ultimate reality (Brahman), and the path to liberation.",
        "icon_emoji": "🕉️", "accent_color": "#7C3AED", "api_source": "upanishads",
    },
    "rig-veda": {
        "id": -3, "slug": "rig-veda", "title": "Rig Veda",
        "sanskrit_title": "ऋग्वेद", "deity": None, "tradition": "Vedic",
        "language": "Sanskrit (with English notes)", "total_chapters": 10, "total_verses": 10552,
        "description": "The oldest of the four Vedas — 1,028 hymns across 10 mandalas, addressed to Agni, Indra, Soma, and the wider Vedic pantheon, including the philosophically celebrated Hymn of Creation.",
        "icon_emoji": "🔥", "accent_color": "#DC2626", "api_source": "rigveda",
    },
    "manusmriti": {
        "id": -4, "slug": "manusmriti", "title": "Manusmriti",
        "sanskrit_title": "मनुस्मृति", "deity": None, "tradition": "Dharmashastra",
        "language": "Sanskrit (with English notes)", "total_chapters": 12, "total_verses": 2685,
        "description": "An ancient Dharmashastra (legal-ethical treatise) of roughly 2,685 verses covering cosmology, social duties, law, and liberation — presented here as a historical text for study; several of its provisions are widely contested today.",
        "icon_emoji": "⚖️", "accent_color": "#57534E", "api_source": "manusmriti",
    },
    "vishnu-purana": {
        "id": -5, "slug": "vishnu-purana", "title": "Vishnu Purana",
        "sanskrit_title": "विष्णुपुराण", "deity": "Vishnu", "tradition": "Vaishnavism",
        "language": "Sanskrit (with English notes)", "total_chapters": 6, "total_verses": None,
        "description": "One of the oldest and most celebrated Puranas — cosmology, royal genealogies, and one of the earliest complete accounts of the life of Krishna, across 6 amshas (books).",
        "icon_emoji": "🐚", "accent_color": "#1D4ED8", "api_source": "vishnu_purana",
    },
    "yoga-sutras": {
        "id": -6, "slug": "yoga-sutras", "title": "Yoga Sutras of Patanjali",
        "sanskrit_title": "योगसूत्र", "deity": None, "tradition": "Yoga",
        "language": "Sanskrit (with English notes)", "total_chapters": 4, "total_verses": 196,
        "description": "Patanjali's foundational 196-sutra treatise on the theory and practice of yoga, defining yoga as the stilling of the mind's fluctuations and laying out the eight-limbed (ashtanga) path.",
        "icon_emoji": "🧘", "accent_color": "#0D9488", "api_source": "yoga_sutras",
    },
}


def _lookup_book(slug: str):
    """Returns a book dict for either a static (code-defined) book or a DB
    row, or None if the slug matches neither. Checked in that order so a
    static entry always wins if a slug were ever to collide."""
    if slug in _STATIC_BOOKS:
        return _STATIC_BOOKS[slug]
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, slug, title, sanskrit_title, deity, tradition,
                   language, total_chapters, total_verses, description,
                   icon_emoji, accent_color, api_source
            FROM sacred_books WHERE slug = %s AND is_active = TRUE
        """, (slug,))
        row = cur.fetchone()
    return dict(row) if row else None


# ═════════════════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ═════════════════════════════════════════════════════════════════════════════

@router.get("/api/books")
def list_books():
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, slug, title, sanskrit_title, deity, tradition,
                   language, total_chapters, total_verses, description,
                   icon_emoji, accent_color, api_source
            FROM sacred_books
            WHERE is_active = TRUE
            ORDER BY id
        """)
        books = [dict(b) for b in cur.fetchall()]
    books.extend(_STATIC_BOOKS.values())
    return {"books": books}


@router.get("/api/books/{slug}")
def get_book(slug: str):
    book = _lookup_book(slug)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return book


@router.get("/api/books/{slug}/chapters")
def get_chapters(slug: str):
    book = _lookup_book(slug)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return _dispatch_chapters(slug, book["api_source"], book["id"])


@router.get("/api/books/{slug}/chapters/{chapter_num}")
def get_chapter_verses(slug: str, chapter_num: int):
    book = _lookup_book(slug)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return _dispatch_chapter_verses(slug, book["api_source"], book["id"], chapter_num)


@router.get("/api/books/{slug}/search")
def search_in_book(slug: str, q: str = Query(..., min_length=2)):
    book = _lookup_book(slug)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    api_source = book["api_source"]
    q_lower = q.lower()
    results = []

    if api_source == "bhagavad_gita_api":
        for ch_num in range(1, 19):
            try:
                ch_data = _gita_chapter_verses(ch_num)
                for v in ch_data.get("verses", []):
                    if (q_lower in (v.get("translation") or "").lower() or
                            q_lower in (v.get("commentary") or "").lower() or
                            q_lower in (v.get("word_meanings") or "").lower()):
                        results.append({
                            "chapter_number": ch_num,
                            "verse_number":   v["verse_number"],
                            "chapter_title":  ch_data["title"],
                            "translation":    v["translation"],
                            "sanskrit":       v["sanskrit"],
                        })
            except Exception:
                continue

    elif api_source == "valmiki_ramayana":
        for kanda_num in range(1, 8):
            try:
                data = _ramayana_kanda_verses(kanda_num)
                for v in data.get("verses", []):
                    if q_lower in (v.get("sanskrit") or "").lower():
                        results.append({
                            "chapter_number": kanda_num,
                            "verse_number":   v["verse_number"],
                            "chapter_title":  data["title"],
                            "translation":    v["sanskrit"],
                            "sanskrit":       v.get("sanskrit", ""),
                            "label":          v.get("label", ""),
                        })
                        if len(results) >= 50:
                            break
            except Exception:
                continue

    elif api_source == "mahabharata":
        for parva_num in range(1, 19):
            try:
                data = _mahabharata_parva_verses(parva_num)
                for v in data.get("verses", []):
                    if q_lower in (v.get("sanskrit") or "").lower():
                        results.append({
                            "chapter_number": parva_num,
                            "verse_number":   v["verse_number"],
                            "chapter_title":  data["title"],
                            "translation":    v["sanskrit"],
                            "sanskrit":       v.get("sanskrit", ""),
                            "label":          v.get("label", ""),
                        })
                        if len(results) >= 50:
                            break
            except Exception:
                continue

    elif api_source in (
        "hanuman_chalisa", "shiva_purana", "devi_mahatmya",
        "ramcharitmanas", "upanishads", "rigveda", "manusmriti",
        "vishnu_purana", "yoga_sutras",
    ):
        try:
            if api_source == "hanuman_chalisa":
                chapters = [_hanuman_chalisa_verses()]
            elif api_source == "shiva_purana":
                chapters = [_shiva_purana_chapter_verses(n) for n in range(1, 8)]
            elif api_source == "devi_mahatmya":
                chapters = [_devi_mahatmya_chapter_verses(n) for n in range(1, 14)]
            elif api_source == "ramcharitmanas":
                chapters = [_ramcharitmanas_kanda_verses(n) for n in range(1, 8)]
            elif api_source == "upanishads":
                chapters = [_upanishad_chapter_verses(n) for n in range(1, 14)]
            elif api_source == "rigveda":
                chapters = [_rigveda_mandala_verses(n) for n in range(1, 11)]
            elif api_source == "manusmriti":
                chapters = [_manusmriti_chapter_verses(n) for n in range(1, 13)]
            elif api_source == "vishnu_purana":
                chapters = [_vishnu_purana_book_verses(n) for n in range(1, 7)]
            else:
                chapters = [_yoga_sutras_pada_verses(n) for n in range(1, 5)]
            for ch_data in chapters:
                for v in ch_data.get("verses", []):
                    if q_lower in (v.get("translation") or "").lower():
                        results.append({
                            "chapter_number": ch_data["chapter_number"],
                            "verse_number":   v["verse_number"],
                            "chapter_title":  ch_data["title"],
                            "translation":    v["translation"],
                            "sanskrit":       v.get("sanskrit", ""),
                            "label":          v.get("label", ""),
                        })
        except Exception:
            pass

    return {"query": q, "total": len(results), "results": results[:50]}


# ─────────────────────────────────────────────────────────────────────────────
# PROGRESS
# ─────────────────────────────────────────────────────────────────────────────

class ProgressUpdate(BaseModel):
    session_id:   str
    slug:         str
    last_chapter: int
    last_verse:   int


@router.post("/api/books/progress")
def save_progress(data: ProgressUpdate):
    if data.slug in _STATIC_BOOKS:
        # No DB row for this book (see _STATIC_BOOKS) -- can't persist or
        # compute against a real total_verses. Return a best-effort percent
        # so the reader's progress bar still works within this session;
        # it just won't survive a reload or show up in "Continue Reading".
        total_chapters = _STATIC_BOOKS[data.slug]["total_chapters"] or 1
        percent = min(round((data.last_chapter / total_chapters) * 100, 2), 100)
        return {"status": "unsupported", "percent_done": percent}

    with get_db_cursor() as cur:
        cur.execute(
            "SELECT id, total_chapters, total_verses FROM sacred_books WHERE slug = %s",
            (data.slug,)
        )
        book = cur.fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    total_v = book["total_verses"] or 1
    ch_done = data.last_chapter - 1
    per_ch  = total_v / (book["total_chapters"] or 1)
    approx  = ch_done * per_ch + data.last_verse
    percent = min(round((approx / total_v) * 100, 2), 100)

    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO reading_progress
                (session_id, book_id, last_chapter, last_verse, percent_done, updated_at)
            VALUES (%s, %s, %s, %s, %s, NOW())
            ON CONFLICT (session_id, book_id)
            DO UPDATE SET
                last_chapter = EXCLUDED.last_chapter,
                last_verse   = EXCLUDED.last_verse,
                percent_done = EXCLUDED.percent_done,
                updated_at   = NOW()
        """, (data.session_id, book["id"], data.last_chapter, data.last_verse, percent))

    return {"status": "saved", "percent_done": percent}


@router.get("/api/books/progress/{session_id}")
def get_all_progress(session_id: str):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT sb.slug, sb.title, sb.icon_emoji,
                   rp.last_chapter, rp.last_verse, rp.percent_done, rp.updated_at
            FROM reading_progress rp
            JOIN sacred_books sb ON sb.id = rp.book_id
            WHERE rp.session_id = %s
            ORDER BY rp.updated_at DESC
        """, (session_id,))
        rows = cur.fetchall()
    return {"progress": [dict(r) for r in rows]}


# ─────────────────────────────────────────────────────────────────────────────
# BOOKMARKS
# ─────────────────────────────────────────────────────────────────────────────

class BookmarkCreate(BaseModel):
    session_id:     str
    slug:           str
    chapter_number: int
    verse_number:   int
    note:           Optional[str] = None


@router.post("/api/books/bookmarks")
def add_bookmark(data: BookmarkCreate):
    with get_db_cursor() as cur:
        cur.execute("SELECT id FROM sacred_books WHERE slug = %s", (data.slug,))
        book = cur.fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    with get_db_cursor() as cur:
        cur.execute("""
            INSERT INTO book_bookmarks
                (session_id, book_id, chapter_number, verse_number, note)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (session_id, book_id, chapter_number, verse_number)
            DO UPDATE SET note = EXCLUDED.note
            RETURNING id
        """, (data.session_id, book["id"], data.chapter_number, data.verse_number, data.note))
        bm = cur.fetchone()

    return {"status": "bookmarked", "bookmark_id": bm["id"]}


@router.get("/api/books/bookmarks/{session_id}")
def get_bookmarks(session_id: str):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT bm.id, sb.slug, sb.title, sb.icon_emoji,
                   bm.chapter_number, bm.verse_number, bm.note, bm.created_at
            FROM book_bookmarks bm
            JOIN sacred_books sb ON sb.id = bm.book_id
            WHERE bm.session_id = %s
            ORDER BY bm.created_at DESC
        """, (session_id,))
        rows = cur.fetchall()
    return {"bookmarks": [dict(r) for r in rows]}


@router.delete("/api/books/bookmarks/{bookmark_id}")
def delete_bookmark(bookmark_id: int, session_id: str = Query(...)):
    with get_db_cursor() as cur:
        cur.execute("""
            DELETE FROM book_bookmarks
            WHERE id = %s AND session_id = %s
            RETURNING id
        """, (bookmark_id, session_id))
        deleted = cur.fetchone()
    if not deleted:
        raise HTTPException(status_code=404, detail="Bookmark not found")
    return {"status": "deleted"}