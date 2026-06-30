import json
import os
import re
from typing import Dict, List

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/api/translate", tags=["Translation"])

SUPPORTED_LANGUAGES = {"hi": "Hindi"}
_CACHE: Dict[str, str] = {}


class TranslateBatchRequest(BaseModel):
    texts: List[str] = Field(default_factory=list, max_length=80)
    target_lang: str = "hi"


class TranslateBatchResponse(BaseModel):
    translations: Dict[str, str]
    provider: str


def _clean_text(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def _should_translate(text: str) -> bool:
    text = _clean_text(text)
    if not text or len(text) < 2:
        return False
    if len(text) > 1500:
        return False
    if re.fullmatch(r"[\d\s:.,/+()₹$%-]+", text):
        return False
    if re.fullmatch(r"https?://\S+|\S+@\S+\.\S+", text):
        return False
    return bool(re.search(r"[A-Za-z]", text))


def _cache_key(target_lang: str, text: str) -> str:
    return f"{target_lang}:{_clean_text(text)}"


def _fallback(texts: list[str], target_lang: str) -> dict[str, str]:
    return {text: text for text in texts}


def _parse_json_object(raw: str) -> dict:
    cleaned = raw.strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.I).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    return json.loads(cleaned)


def _translate_with_anthropic(texts: list[str], target_lang: str) -> dict[str, str]:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return _fallback(texts, target_lang)
    try:
        import anthropic
    except ImportError:
        return _fallback(texts, target_lang)

    language_name = SUPPORTED_LANGUAGES[target_lang]
    numbered = [{"id": str(i), "text": text} for i, text in enumerate(texts)]

    prompt = f"""
Translate each item into natural, user-facing {language_name}.

Rules:
- Return ONLY valid JSON.
- JSON shape must be: {{"0":"translated text","1":"translated text"}}
- Preserve names such as BharatMandir, URL text, IDs, numbers, dates, amounts, and emojis.
- Translate religious/platform UI text naturally, not word-by-word.
- Do not add explanations.

Items:
{json.dumps(numbered, ensure_ascii=False)}
""".strip()

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model=os.getenv("ANTHROPIC_TRANSLATION_MODEL", "claude-3-5-haiku-latest"),
        max_tokens=3000,
        temperature=0,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = "".join(
        block.text for block in message.content
        if getattr(block, "type", None) == "text"
    )
    parsed = _parse_json_object(raw)

    translations = {}
    for i, source in enumerate(texts):
      translated = parsed.get(str(i), source)
      translations[source] = translated if isinstance(translated, str) else source
    return translations


@router.post("/batch", response_model=TranslateBatchResponse)
def translate_batch(body: TranslateBatchRequest):
    target_lang = body.target_lang if body.target_lang in SUPPORTED_LANGUAGES else "hi"
    raw_texts = [_clean_text(text) for text in body.texts]
    texts = []
    seen = set()
    for text in raw_texts:
        if text in seen or not _should_translate(text):
            continue
        seen.add(text)
        texts.append(text)

    translations: dict[str, str] = {}
    missing: list[str] = []

    for text in texts:
        key = _cache_key(target_lang, text)
        if key in _CACHE:
            translations[text] = _CACHE[key]
        else:
            missing.append(text)

    if missing:
        try:
            fresh = _translate_with_anthropic(missing, target_lang)
        except Exception:
            fresh = _fallback(missing, target_lang)
        for source, translated in fresh.items():
            _CACHE[_cache_key(target_lang, source)] = translated
            translations[source] = translated

    return {"translations": translations, "provider": "anthropic" if os.getenv("ANTHROPIC_API_KEY") else "fallback"}
