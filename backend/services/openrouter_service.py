"""Small synchronous client for OpenRouter's chat-completions API."""

from __future__ import annotations

import os
from typing import Any

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_TTS_URL = "https://openrouter.ai/api/v1/audio/speech"


def api_key() -> str:
    return os.getenv("OPENROUTER_API_KEY", "").strip()


def chat(
    *,
    messages: list[dict[str, Any]],
    model: str,
    temperature: float = 0,
    max_tokens: int | None = None,
    response_format: dict[str, Any] | None = None,
    reasoning: dict[str, Any] | None = None,
    timeout: float = 180,
) -> dict[str, Any]:
    key = api_key()
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
    }
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    if response_format is not None:
        payload["response_format"] = response_format
    if reasoning is not None:
        payload["reasoning"] = reasoning

    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    site_url = os.getenv("OPENROUTER_SITE_URL", "").strip()
    site_name = os.getenv("OPENROUTER_SITE_NAME", "BharatMandir").strip()
    if site_url:
        headers["HTTP-Referer"] = site_url
    if site_name:
        headers["X-Title"] = site_name

    response = httpx.post(
        OPENROUTER_URL,
        headers=headers,
        json=payload,
        timeout=timeout,
    )
    if response.is_error:
        raise RuntimeError(
            f"OpenRouter {response.status_code}: {response.text[:500]}"
        )
    data = response.json()
    choices = data.get("choices") or []
    if not choices:
        raise RuntimeError("OpenRouter returned no choices")
    return data


def _tts_headers(key: str) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    site_url = os.getenv("OPENROUTER_SITE_URL", "").strip()
    site_name = os.getenv("OPENROUTER_SITE_NAME", "BharatMandir").strip()
    if site_url:
        headers["HTTP-Referer"] = site_url
    if site_name:
        headers["X-Title"] = site_name
    return headers


def speech(
    *,
    input: str,
    model: str,
    voice: str,
    response_format: str = "mp3",
    speed: float | None = None,
    instructions: str | None = None,
    timeout: float = 60,
) -> bytes:
    """Synthesizes speech via OpenRouter's /api/v1/audio/speech endpoint.

    Returns raw audio bytes (mp3 by default). Raises RuntimeError on any
    non-2xx response, mirroring the error style of `chat()` above.
    """

    key = api_key()
    if not key:
        raise RuntimeError("OPENROUTER_API_KEY is not configured")

    payload: dict[str, Any] = {
        "model": model,
        "input": input,
        "voice": voice,
        "response_format": response_format,
    }
    if speed is not None:
        payload["speed"] = speed
    if instructions:
        # Only OpenAI's TTS models honor this passthrough option today;
        # other providers silently ignore an unrecognized provider key.
        payload["provider"] = {"options": {"openai": {"instructions": instructions}}}

    response = httpx.post(
        OPENROUTER_TTS_URL,
        headers=_tts_headers(key),
        json=payload,
        timeout=timeout,
    )
    if response.is_error:
        raise RuntimeError(
            f"OpenRouter TTS {response.status_code}: {response.text[:500]}"
        )
    return response.content


def content(data: dict[str, Any]) -> str:
    value = data["choices"][0]["message"].get("content")
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, list):
        return "".join(
            part.get("text", "")
            for part in value
            if isinstance(part, dict) and part.get("type") == "text"
        ).strip()
    return ""