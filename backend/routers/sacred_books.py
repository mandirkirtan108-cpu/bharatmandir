import os, sys, time, httpx, re
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from collections import defaultdict

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
# BHAGAVAD GITA  (unchanged)
# ═════════════════════════════════════════════════════════════════════════════

_GITA_BASE = "https://raw.githubusercontent.com/gita/gita/master/data"

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


def _load_gita_dataset():
    cached = _cache_get("gita_dataset")
    if cached:
        return cached
    try:
        verses       = _fetch_json(f"{_GITA_BASE}/verse.json")
        translations = _fetch_json(f"{_GITA_BASE}/translation.json")
        commentaries = _fetch_json(f"{_GITA_BASE}/commentary.json")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not load Gita dataset from GitHub: {e}")
    trans_by_verse: dict = defaultdict(list)
    for t in translations:
        trans_by_verse[t["verse_id"]].append(t)
    comm_by_verse: dict = defaultdict(list)
    for c in commentaries:
        comm_by_verse[c["verse_id"]].append(c)
    dataset = (verses, dict(trans_by_verse), dict(comm_by_verse))
    return _cache_set("gita_dataset", dataset)


def _best_english_translation(verse_id: int, trans_by_verse: dict) -> str:
    options = trans_by_verse.get(verse_id, [])
    en = [t for t in options if t.get("lang") == "english"]
    for author in ["Swami Sivananda", "Shri Purohit Swami", "Dr. S. Sankaranarayan",
                   "Swami Gambirananda", "Swami Adidevananda"]:
        for t in en:
            if author.lower() in t.get("authorName", "").lower():
                return t.get("description", "")
    return en[0].get("description", "") if en else ""


def _best_english_commentary(verse_id: int, comm_by_verse: dict) -> str:
    options = comm_by_verse.get(verse_id, [])
    en = [c for c in options if c.get("lang") == "english"]
    for c in en:
        if "sivananda" in c.get("authorName", "").lower():
            return c.get("description", "")
    return en[0].get("description", "") if en else ""


def _gita_chapters():
    cached = _cache_get("gita_chapters_list")
    if cached:
        return cached
    verses, _, _ = _load_gita_dataset()
    vc: dict = defaultdict(int)
    for v in verses:
        vc[v["chapter_number"]] += 1
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
    verses, trans_by_verse, comm_by_verse = _load_gita_dataset()
    title, subtitle, summary = _GITA_CHAPTERS.get(chapter_num, (f"Chapter {chapter_num}", "", ""))
    ch_verses = sorted(
        [v for v in verses if v["chapter_number"] == chapter_num],
        key=lambda v: v["verse_number"]
    )
    result_verses = []
    for v in ch_verses:
        vid = v["id"]
        result_verses.append({
            "verse_number":    v["verse_number"],
            "chapter_number":  chapter_num,
            "sanskrit":        v.get("text", ""),
            "transliteration": v.get("transliteration", ""),
            "word_meanings":   v.get("word_meanings", ""),
            "translation":     _best_english_translation(vid, trans_by_verse),
            "commentary":      _best_english_commentary(vid, comm_by_verse),
        })
    result = {
        "chapter_number": chapter_num,
        "title":          title,
        "subtitle":       subtitle,
        "summary":        summary,
        "verse_count":    len(result_verses),
        "verses":         result_verses,
    }
    return _cache_set(cache_key, result)


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
        books = cur.fetchall()
    return {"books": [dict(b) for b in books]}


@router.get("/api/books/{slug}")
def get_book(slug: str):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, slug, title, sanskrit_title, deity, tradition,
                   language, total_chapters, total_verses, description,
                   icon_emoji, accent_color, api_source
            FROM sacred_books WHERE slug = %s AND is_active = TRUE
        """, (slug,))
        book = cur.fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return dict(book)


@router.get("/api/books/{slug}/chapters")
def get_chapters(slug: str):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, api_source, total_chapters
            FROM sacred_books WHERE slug = %s AND is_active = TRUE
        """, (slug,))
        book = cur.fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return _dispatch_chapters(slug, book["api_source"], book["id"])


@router.get("/api/books/{slug}/chapters/{chapter_num}")
def get_chapter_verses(slug: str, chapter_num: int):
    with get_db_cursor() as cur:
        cur.execute("""
            SELECT id, api_source, total_chapters
            FROM sacred_books WHERE slug = %s AND is_active = TRUE
        """, (slug,))
        book = cur.fetchone()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return _dispatch_chapter_verses(slug, book["api_source"], book["id"], chapter_num)


@router.get("/api/books/{slug}/search")
def search_in_book(slug: str, q: str = Query(..., min_length=2)):
    with get_db_cursor() as cur:
        cur.execute(
            "SELECT api_source FROM sacred_books WHERE slug = %s AND is_active = TRUE",
            (slug,)
        )
        book = cur.fetchone()
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

    elif api_source in ("hanuman_chalisa", "shiva_purana", "devi_mahatmya"):
        try:
            if api_source == "hanuman_chalisa":
                chapters = [_hanuman_chalisa_verses()]
            elif api_source == "shiva_purana":
                chapters = [_shiva_purana_chapter_verses(n) for n in range(1, 8)]
            else:
                chapters = [_devi_mahatmya_chapter_verses(n) for n in range(1, 14)]
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