"""
Translation pipeline for the Sacred Books Library.

Uses the `openai` package already in backend/requirements.txt.
Requires OPENAI_API_KEY in backend/.env (same style as your other services
reading env vars via python-dotenv).

Design:
- Translate once at publish/trigger time, store in Postgres, never
  translate on read (see routers/library.py) — this is what keeps
  OpenAI cost bounded regardless of traffic.
- Batch ~8 pages per API call to cut round-trips on long books.
- Resumable: each page's translation is written individually, so a job
  that fails on page 400 of 1000 resumes from 400, not from zero.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(ENV_PATH)

_client: OpenAI | None = None

MODEL = os.getenv("LIBRARY_TRANSLATION_MODEL", "gpt-4.1")
PAGES_PER_BATCH = 8

_LANGUAGE_NAMES = {"en": "English", "hi": "Hindi", "sa": "Sanskrit"}

SYSTEM_PROMPT = """You are translating pages of a religious/philosophical \
text for a scripture-reading app. You will receive a JSON array of pages, \
each page itself an array of content blocks with a "type" \
(heading | verse | paragraph) and "text" (and "number" for verses).

Rules:
- Preserve the exact block structure and order — same number of pages, \
same number of blocks per page, same "type" and "number" fields.
- Translate the "text" field of every block into the target language.
- Preserve verse numbering exactly as given.
- Proper nouns and established Sanskrit/Hindi terms (e.g. dharma, yoga, \
Atman, Brahman) may stay transliterated if there is no natural equivalent \
in the target language, rather than being forced into an awkward literal \
translation.
- If the target language is Sanskrit and a block's original text is \
already Sanskrit (e.g. a verse quoted in the source), preserve it as-is \
rather than re-"translating" it.
- Return ONLY a JSON object: {"pages": [[{...blocks...}], [{...}], ...]} \
matching the input page order — no commentary, no markdown fences."""


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY is not set in backend/.env")
        _client = OpenAI(api_key=api_key)
    return _client


def chunk_pages(pages: list[list[dict]], size: int = PAGES_PER_BATCH):
    for i in range(0, len(pages), size):
        yield pages[i : i + size]


def translate_page_batch(pages: list[list[dict]], target_lang: str) -> list[list[dict]]:
    """
    pages: list of pages, each a list of structured blocks
           (see pdf_service.structure_page_text).
    Returns the same shape, translated.
    """
    lang_name = _LANGUAGE_NAMES.get(target_lang, target_lang)
    client = _get_client()

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Target language: {lang_name} ({target_lang}).\n\n"
                    f"Pages:\n{json.dumps(pages, ensure_ascii=False)}"
                ),
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )

    parsed = json.loads(response.choices[0].message.content)
    translated_pages = parsed.get("pages")

    if not isinstance(translated_pages, list) or len(translated_pages) != len(pages):
        raise ValueError(
            f"Translation batch mismatch: sent {len(pages)} pages, "
            f"got back {len(translated_pages) if isinstance(translated_pages, list) else 'invalid'}"
        )

    return translated_pages