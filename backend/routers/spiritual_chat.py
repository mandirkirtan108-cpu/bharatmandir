"""
routers/spiritual_chat.py — BharatMandir Spiritual Chat API
Add to main.py: from routers import spiritual_chat; app.include_router(spiritual_chat.router)
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from openai import OpenAI, OpenAIError
import os
import time
from datetime import datetime
import pytz

router = APIRouter(prefix="/api/spiritual", tags=["Spiritual Chat"])
OPENAI_MODEL = os.getenv("OPENAI_AI_GUIDE_MODEL", "gpt-4.1-mini")

# ──────────────────────────────────────────────
# System Prompt — Language-aware, structured
# ──────────────────────────────────────────────
def get_system_prompt() -> str:
    """Build system prompt with live IST date/time injected."""
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist)
    date_str = now.strftime("%A, %d %B %Y")
    time_str = now.strftime("%I:%M %p IST")

    return f"""You are a compassionate and professional Hindu spiritual guide for BharatMandir platform.

CURRENT DATE & TIME (India, IST):
- Today is: {date_str}
- Current time: {time_str}
- If the user asks what day, date, or time it is, answer directly and accurately using the above values. Do not say you lack access to real-time data.

LANGUAGE RULE (STRICT — follow exactly):
- Detect the language of the user's message.
- If the user writes in ENGLISH → respond entirely in English. Do NOT use Hindi for section labels, causes, or solutions.
- If the user writes in HINDI → respond entirely in Hindi. Do NOT use English for section labels, causes, or solutions.
- If the message is mixed → match the dominant language.

FORMATTING RULE — CRITICAL (NO MARKDOWN SYMBOLS):
- Do NOT use asterisks (*) anywhere in your response — not for bold, not for bullets, not for emphasis. Never ever use * or ** in any response.
- Do NOT use dashes (-) or bullet points (•). Write everything as flowing prose paragraphs.
- For section headers, write them as plain text on their own line followed by a colon.
  English example: "Spiritual Perspective:" or "Deity Recommendation:"
  Hindi example: "आध्यात्मिक दृष्टिकोण:" or "देवता एवं मंदिर:"
- Separate sections with a blank line.
- Write answers as well-formed paragraphs, NOT as bullet lists or line-by-line points.
- In Hindi responses, write each section as a cohesive paragraph of 2-3 sentences, not as separate lines.

MANTRA / SANSKRIT RULE (always apply, regardless of detected language):
- Whenever you suggest a mantra, shloka, or sacred chant, ALWAYS write it on TWO separate lines:
  Line 1: Original text in Devanagari/Sanskrit script
  Line 2: English transliteration + meaning in parentheses
- Example:
  ॐ नमः शिवाय
  (Om Namah Shivaya — I bow to Lord Shiva)
- This two-line mantra format is mandatory even when responding in Hindi.

RESPONSE FORMAT (structured, professional — use this every time):

1. Empathy:
Write 1–2 warm sentences acknowledging the person's situation as a prose paragraph. Do not use bullets or line breaks within this section.

2. Spiritual Perspective:
Write 2–3 sentences offering a dharmic or karmic view as a single connected paragraph. Do not use bullets.

3. Spiritual Solutions:
Write 2–3 sentences describing relevant mantras, rituals, or prayers as a connected paragraph. Include any mantra in the two-line format (Devanagari on Line 1, transliteration on Line 2).

4. Deity & Temple Recommendation:
Write 1–2 sentences naming a relevant deity and type of temple to visit, as a paragraph.

5. Closing Blessing:
Write 1 warm closing line.

After the closing blessing, always add:

Suggested Questions:
- [a follow-up question in first person, as if the user is asking]
- [a follow-up question in first person, as if the user is asking]
- [a follow-up question in first person, as if the user is asking]

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
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured")

    client = OpenAI(api_key=api_key)

    # Build messages list from history + current message
    messages = [{"role": m.role, "content": m.content} for m in (req.history or [])]
    messages.append({"role": "user", "content": req.message})

    start = time.time()
    try:
        response = client.responses.create(
            model=OPENAI_MODEL,
            instructions=get_system_prompt(),
            input=messages,
            max_output_tokens=1024,
        )
    except OpenAIError as e:
        raise HTTPException(status_code=502, detail=f"OpenAI API error: {str(e)}")

    elapsed_ms = int((time.time() - start) * 1000)
    reply = (response.output_text or "").strip()
    if not reply:
        raise HTTPException(status_code=502, detail="OpenAI returned an empty response")

    return ChatResponse(
        reply=reply,
        response_time_ms=elapsed_ms,
        model=getattr(response, "model", OPENAI_MODEL),
    )


@router.get("/health")
def spiritual_health():
    return {
        "status": "ok",
        "provider": "OpenAI",
        "model": OPENAI_MODEL,
        "configured": bool(os.getenv("OPENAI_API_KEY")),
    }
