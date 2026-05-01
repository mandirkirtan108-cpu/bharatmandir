"""
spiritual_chat.py — BharatMandir AI Spiritual Assistant (CLI Prototype)
Run: python spiritual_chat.py
Requires: pip install anthropic
"""

import anthropic
import os

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
# Test Inputs (5 scenarios — English + Hindi mix)
# ──────────────────────────────────────────────
TEST_INPUTS = [
    "I am under a lot of financial stress. My business is not doing well and I am worried about money.",
    "Mere ghar mein bahut jhagda ho raha hai. Parivaar ke saath bahut conflict hai. Kya karun?",
    "I am worried about my health. I have been sick for many months and doctors are not helping.",
    "I feel very restless and anxious. I want to find inner peace and calm in my life.",
    "Mujhe apne career ke baare mein bahut confusion hai. Kya main sahi raste par hoon?",
]


def get_spiritual_guidance(client: anthropic.Anthropic, user_message: str) -> str:
    """Send a message to Claude Haiku and return the spiritual guidance."""
    message = client.messages.create(
        model="claude-haiku-4-5",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": user_message}
        ]
    )
    return message.content[0].text


def interactive_chat(client: anthropic.Anthropic):
    """Run an interactive chat session."""
    print("\n" + "═" * 60)
    print("  🛕  BharatMandir — AI Spiritual Guide")
    print("  Type your problem in Hindi or English.")
    print("  Type 'quit' to exit.")
    print("═" * 60 + "\n")

    conversation = []

    while True:
        user_input = input("You: ").strip()
        if user_input.lower() in ("quit", "exit", "q"):
            print("\nNamaste 🙏 May your path be blessed.")
            break
        if not user_input:
            continue

        conversation.append({"role": "user", "content": user_input})

        print("\n🕉  Guide:\n", flush=True)
        message = client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=conversation
        )
        response = message.content[0].text
        print(response)
        conversation.append({"role": "assistant", "content": response})
        print()


def run_test_suite(client: anthropic.Anthropic):
    """Run all 5 test inputs and print responses."""
    categories = [
        "💰 Financial Stress (English)",
        "👨‍👩‍👧 Family Conflict (Hindi)",
        "🏥 Health Worry (English)",
        "☮️  Seeking Peace (English)",
        "💼 Career Confusion (Hindi)",
    ]

    print("\n" + "═" * 60)
    print("  🛕  BharatMandir — Spiritual Guide Test Suite")
    print("═" * 60)

    for i, (category, test_input) in enumerate(zip(categories, TEST_INPUTS), 1):
        print(f"\n[Test {i}/5] {category}")
        print(f"Input: {test_input}")
        print("-" * 40)
        response = get_spiritual_guidance(client, test_input)
        print(f"Response:\n{response}")
        print("─" * 60)


def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("❌ Error: ANTHROPIC_API_KEY environment variable not set.")
        print("   Export it: export ANTHROPIC_API_KEY=your_key_here")
        return

    client = anthropic.Anthropic(api_key=api_key)

    print("\nChoose mode:")
    print("  1. Run 5 test scenarios")
    print("  2. Interactive chat")
    choice = input("Enter 1 or 2: ").strip()

    if choice == "1":
        run_test_suite(client)
    else:
        interactive_chat(client)


if __name__ == "__main__":
    main()