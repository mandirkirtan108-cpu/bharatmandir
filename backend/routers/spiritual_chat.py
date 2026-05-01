"""
routers/spiritual_chat.py — BharatMandir Spiritual Chat API
Add to main.py: from routers import spiritual_chat; app.include_router(spiritual_chat.router)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import anthropic
import os
import time

router = APIRouter(prefix="/api/spiritual", tags=["Spiritual Chat"])

# ──────────────────────────────────────────────
# System Prompt — Language-aware, structured
# ──────────────────────────────────────────────
SYSTEM_PROMPT = """You are a compassionate and professional Hindu spiritual guide for BharatMandir platform.

LANGUAGE RULE (STRICT — follow exactly):
- Detect the language of the user's message.
- If the user writes in ENGLISH → respond entirely in English. Do NOT use Hindi for section labels, causes, or solutions.
- If the user writes in HINDI → respond entirely in Hindi. Do NOT use English for section labels, causes, or solutions.
- If the message is mixed → match the dominant language.

MANTRA / SANSKRIT RULE (always apply, regardless of detected language):
- Whenever you suggest a mantra, shloka, or sacred chant, ALWAYS write it on TWO separate lines:
  Line 1: Original text in Devanagari/Sanskrit script
  Line 2: English transliteration + meaning in parentheses
- Example:
  ॐ नमः शिवाय
  (Om Namah Shivaya — I bow to Lord Shiva)
- This two-line mantra format is mandatory even when responding in English.

RESPONSE FORMAT (structured, professional — use this every time):
**1. Empathy** — 1-2 warm sentences acknowledging the person's situation.
**2. Possible Causes** — 2-3 short bullet points (spiritual perspective only).
**3. Spiritual Solutions** — 2-3 bullet points with mantras, rituals, or prayers. Include mantras in the two-line format above.
**4. Deity & Temple Recommendation** — 1-2 sentences naming a relevant deity and type of temple to visit.
**5. Closing Blessing** — 1 warm closing line.

TONE: Warm, structured, professional, non-prescriptive. Never give medical or financial advice directly."""


# ──────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str          # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []

class ChatResponse(BaseModel):
    reply: str
    response_time_ms: int
    model: str


# ──────────────────────────────────────────────
# Endpoint
# ──────────────────────────────────────────────

@router.post("/chat", response_model=ChatResponse)
def spiritual_chat(req: ChatRequest):
    """
    Send a message to the AI spiritual guide.
    Responds in the same language as the user's message.
    Maintains conversation history for multi-turn context.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    client = anthropic.Anthropic(api_key=api_key)

    # Build messages list from history + current message
    messages = [{"role": m.role, "content": m.content} for m in (req.history or [])]
    messages.append({"role": "user", "content": req.message})

    start = time.time()
    try:
        response = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=messages
        )
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Claude API error: {str(e)}")

    elapsed_ms = int((time.time() - start) * 1000)

    return ChatResponse(
        reply=response.content[0].text,
        response_time_ms=elapsed_ms,
        model=response.model,
    )


@router.get("/health")
def spiritual_health():
    return {"status": "ok", "model": "claude-haiku-4-5"}