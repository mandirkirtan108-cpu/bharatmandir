"""Small synchronous client for OpenRouter's chat-completions API."""

from __future__ import annotations

import os
from typing import Any

import httpx

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


def api_key() -> str:
    return os.getenv("OPENROUTER_API_KEY", "").strip()


def chat(
    *,
    messages: list[dict[str, Any]],
    model: str,
    temperature: float = 0,
    max_tokens: int | None = None,
    response_format: dict[str, Any] | None = None,
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
