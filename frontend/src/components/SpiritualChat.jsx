import { useState, useRef, useEffect } from 'react';

/* ═══════════════════════════════════════════════════════════
   SYSTEM PROMPT  —  BharatMandir AI Guide
   ═══════════════════════════════════════════════════════════ */
const SYSTEM_PROMPT = `You are a compassionate Hindu spiritual guide for BharatMandir — a platform connecting devotees with India's sacred temples.

LANGUAGE RULE (STRICT):
- Detect the language of the user's message.
- If the user writes in ENGLISH → respond entirely in English.
- If the user writes in HINDI (Devanagari or Roman Hindi) → respond entirely in Hindi.
- If the user writes in mixed Hindi-English → match the dominant language.
- NEVER mix languages within section labels or bullet points.

MANTRA RULE (MANDATORY — always apply):
- Whenever you suggest a mantra or shloka, write it on TWO lines:
  Line 1: Devanagari / Sanskrit script
  Line 2: English transliteration + meaning in parentheses
- Example:
  ॐ नमः शिवाय
  (Om Namah Shivaya — I bow to Lord Shiva)
- This format is required regardless of response language.

RESPONSE LENGTH RULE (CRITICAL):
- Match your response length strictly to the complexity of the user's question.
- Simple or follow-up questions (e.g. "How many times to chant?", "What time is best?", "Which temple should I visit?") → answer concisely in 3–5 lines. Do NOT expand into long paragraphs or add unrequested details.
- Complex or first-time questions (e.g. sharing a major life problem) → use the full structured format below.
- Never pad a short answer with extra spiritual elaboration just to fill space. Brevity with depth is more respectful than length without need.

RESPONSE FORMAT (for complex / first-time questions):
**1. Empathy** — 1–2 respectful, warm sentences acknowledging the person's situation.
**2. Spiritual Perspective** — 2–3 bullet points offering a dharmic or karmic lens on the situation.
**3. Spiritual Solutions** — 2–3 bullet points with relevant mantras, prayers, or rituals. Include mantras in the two-line format above.
**4. Deity & Temple Recommendation** — 1–2 sentences naming a relevant deity and type of temple to visit.
**5. Closing Blessing** — 1 sincere closing blessing in the user's language.

RESPONSE FORMAT (for simple / follow-up questions):
- Answer directly and clearly in 3–5 lines.
- Include a mantra only if directly relevant to the question.
- End with a single short blessing line.

After the closing blessing, always add:
**Suggested Questions:**
- [a follow-up question phrased as if the USER is asking you, in first person — e.g. "Which mantra should I chant daily for peace?"]
- [a follow-up question phrased as if the USER is asking you, in first person — e.g. "How do I perform a Lakshmi Puja at home?"]
- [a follow-up question phrased as if the USER is asking you, in first person — e.g. "Which deity should I pray to for my health?"]

IMPORTANT: Every suggested question MUST be written from the USER's perspective (first person "I / my / me"), as if the user is asking the guide. Never phrase them as questions directed AT the user.

FORMATTING RULES (STRICT):
- Use **double asterisks** for bold section headers ONLY.
- NEVER use single asterisks around any word for italics. Write Sanskrit or Hindi terms plainly without asterisks (e.g. write: punya, dharma, puja — NOT *punya*, *dharma*, *puja*).
- Do not wrap any word or phrase in single asterisks for any reason.

TONE:
- Respectful, composed, and spiritually authentic — like a learned pandit or spiritual counsellor.
- Avoid casual or colloquial expressions. Maintain dignity in every response.
- Do not use informal address. Speak to the person with warmth and reverence.
- Never give medical, legal, or financial advice. Stay within spiritual guidance only.
- Keep responses clear and accessible to any devotee, regardless of their background.`;

/* ═══════════════════════════════════════════════════════════
   QUICK PROMPTS
   ═══════════════════════════════════════════════════════════ */
const QUICK_PROMPTS = [
  { label: 'Financial Stress', text: 'I am under a lot of financial stress. My business is not doing well and I am worried about my family.' },
  { label: 'Family Conflict',  text: 'There is a lot of conflict in my home. Relations with family members have become very difficult.' },
  { label: 'Health Concern',   text: 'I have been unwell for months and feeling hopeless about my health.' },
  { label: 'Seeking Peace',    text: 'I feel restless and anxious all the time. I want to find inner peace and calm.' },
  { label: 'Career Guidance',  text: 'I am confused about my career path and do not know which direction to take.' },
  { label: 'Grief & Loss',     text: 'I have experienced a significant loss and I am struggling to find solace.' },
];

/* ═══════════════════════════════════════════════════════════
   API CALL
   ═══════════════════════════════════════════════════════════ */
async function callClaude(messages) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY not set in frontend/.env');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}

/* ═══════════════════════════════════════════════════════════
   EXTRACT SUGGESTED QUESTIONS from last bot message
   ═══════════════════════════════════════════════════════════ */
function extractSuggestedQuestions(content) {
  if (!content) return [];
  const lines = content.split('\n');
  let inSection = false;
  const questions = [];
  for (const line of lines) {
    if (/suggested questions/i.test(line)) { inSection = true; continue; }
    if (inSection && /^[-•✦]/.test(line.trim())) {
      questions.push(line.trim().replace(/^[-•✦]\s*/, ''));
    }
  }
  return questions;
}

/* ═══════════════════════════════════════════════════════════
   RICH TEXT HELPERS
   ═══════════════════════════════════════════════════════════ */
const isDevanagari = (str) => /[\u0900-\u097F]/.test(str);

/**
 * Renders a line with **bold** markdown.
 * Single asterisks (italic markers) are stripped entirely to avoid stray * characters.
 */
function RichLine({ text }) {
  // Strip all single asterisks that aren't part of **bold**
  const cleaned = text.replace(/\*\*([^*]+)\*\*/g, '\u0002$1\u0003').replace(/\*/g, '').replace(/\u0002([^\u0003]*)\u0003/g, '**$1**');
  const parts = cleaned.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} style={{ color: '#8B1A1A', fontWeight: 700 }}>
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   BOT MESSAGE RENDERER
   ═══════════════════════════════════════════════════════════ */
function BotMessage({ content }) {
  const lines = content.split('\n');

  return (
    <div style={S.botContent}>
      {lines.map((line, i) => {
        const trimmed = line.trim();

        if (!trimmed) return <div key={i} style={{ height: 4 }} />;

        // Skip separator lines like --, ---, —— etc.
        if (/^[-—]{2,}$/.test(trimmed)) return null;

        // Devanagari mantra line
        if (isDevanagari(trimmed)) {
          return (
            <div key={i} style={S.mantraBlock}>
              <span style={S.mantraText}>{trimmed}</span>
            </div>
          );
        }

        // Transliteration: (Om Namah Shivaya — ...)
        if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
          return (
            <div key={i} style={S.translitLine}>
              <em>{trimmed}</em>
            </div>
          );
        }

        // Follow-up header: **Suggested Questions:**
        if (/suggested questions/i.test(trimmed)) {
          // Hide this header — questions are shown as chips above input
          return null;
        }

        // Section header: **1. Empathy** etc.
        if (/^\*\*\d+\./.test(trimmed) || /^\*\*[^*]{2,40}\*\*/.test(trimmed)) {
          return (
            <div key={i} style={S.sectionHeader}>
              <RichLine text={trimmed} />
            </div>
          );
        }

        // Check if we're past the "Suggested Questions:" header
        const inFollowUp = lines
          .slice(0, i)
          .some(l => /suggested questions/i.test(l));

        // Bullet line: - or •
        if (/^[-•]/.test(trimmed)) {
          if (inFollowUp) {
            // Hide follow-up bullets from message body — shown as chips instead
            return null;
          }

          return (
            <div key={i} style={S.bulletLine}>
              <span style={S.bulletDot}>›</span>
              <span><RichLine text={trimmed.replace(/^[-•]\s*/, '')} /></span>
            </div>
          );
        }

        // Normal line
        return (
          <div key={i} style={S.normalLine}>
            <RichLine text={trimmed} />
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   TYPING INDICATOR
   ═══════════════════════════════════════════════════════════ */
function TypingDots() {
  return (
    <div style={S.typingWrap}>
      {[0, 1, 2].map(i => (
        <span key={i} style={{ ...S.dot, animationDelay: `${i * 0.2}s` }} />
      ))}
      <span style={S.typingLabel}>Guiding you…</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function SpiritualChat() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        '**Namaste. I am your BharatMandir Spiritual Guide.**\n\nPlease share your concerns, questions, or spiritual needs — I will offer guidance through mantras, prayers, rituals, and temple recommendations.\n\nYou may write in **Hindi or English** — I will respond in the same language.\n\nॐ शान्तिः शान्तिः शान्तिः',
    },
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Extract suggested questions from the last bot message
  const lastBotMsg = [...messages].reverse().find(m => m.role === 'assistant');
  const suggestedQuestions = extractSuggestedQuestions(lastBotMsg?.content || '');

  const sendMessage = async (text) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    setInput('');

    const userMsg    = { role: 'user', content: userText };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setLoading(true);

    try {
      const apiMessages = newHistory.map((m) => ({ role: m.role, content: m.content }));
      const reply       = await callClaude(apiMessages);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            '⚠️ Could not reach the spiritual guide right now. Please check your API key or try again later.\n\n*ॐ शान्तिः शान्तिः शान्तिः*',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={S.wrapper}>
      <style>{CSS}</style>

      {/* ── Header ── */}
      <div style={S.header}>
        <div style={S.headerGlow} />
        <div style={S.headerInner}>
          <div style={S.omCircle}>
            <span style={S.omText}>ॐ</span>
          </div>
          <div>
            <div style={S.headerTitle}>Adhyatmik Margdarshak</div>
            <div style={S.headerSub}>AI Spiritual Guide · BharatMandir</div>
          </div>
        </div>
        <div style={S.liveChip}>
          <span style={S.liveDot} />
          Online
        </div>
      </div>

      {/* ── Quick Prompts ── */}
      <div style={S.quickBar}>
        <div style={S.quickLabel}>Quick Topics:</div>
        <div style={S.quickScroll}>
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p.label}
              style={S.quickBtn}
              className="bm-quick-btn"
              onClick={() => sendMessage(p.text)}
              disabled={loading}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={S.messagesArea}>
        {messages.map((msg, i) => (
          <div key={i} style={msg.role === 'user' ? S.rowUser : S.rowBot}>

            {msg.role === 'assistant' && (
              <div style={S.botAvatar}><span style={{ fontSize: 17 }}>🛕</span></div>
            )}

            {msg.role === 'user' ? (
              <div style={S.bubbleUser}>{msg.content}</div>
            ) : (
              <div style={S.bubbleBot}>
                <BotMessage content={msg.content} />
              </div>
            )}

            {msg.role === 'user' && (
              <div style={S.userAvatar}><span style={{ fontSize: 17 }}>🙏</span></div>
            )}
          </div>
        ))}

        {loading && (
          <div style={S.rowBot}>
            <div style={S.botAvatar}><span style={{ fontSize: 17 }}>🛕</span></div>
            <div style={{ ...S.bubbleBot, padding: '14px 18px' }}>
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Suggested Question Chips (above input) ── */}
      {suggestedQuestions.length > 0 && !loading && (
        <div style={S.suggestBar}>
          <div style={S.suggestLabel}>✦ Suggested Questions</div>
          <div style={S.suggestScroll}>
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                style={S.suggestChip}
                className="bm-suggest-chip"
                onClick={() => sendMessage(q)}
                disabled={loading}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Divider ── */}
      <div style={S.divider} />

      {/* ── Input ── */}
      <div style={S.inputArea}>
        <textarea
          style={S.textarea}
          className="bm-textarea"
          placeholder="Share your concern or question... (Hindi or English)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          disabled={loading}
        />
        <button
          style={{
            ...S.sendBtn,
            opacity:    loading || !input.trim() ? 0.45 : 1,
            transform:  loading || !input.trim() ? 'scale(0.97)' : 'scale(1)',
          }}
          className="bm-send-btn"
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
        >
          <span>🙏</span>
          <span>Send</span>
        </button>
      </div>

      {/* ── Footer note ── */}
      <div style={S.footerNote}>
        🕉️ &nbsp;Spiritual inspiration only — not a substitute for professional advice.
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   CSS ANIMATIONS & HOVER STATES
   ═══════════════════════════════════════════════════════════ */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Tiro+Devanagari+Sanskrit:ital@0;1&family=Crimson+Pro:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap');

  @keyframes bm-bounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.55; }
    40%           { transform: translateY(-7px); opacity: 1; }
  }
  @keyframes bm-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(74,222,128,0.5); }
    50%       { box-shadow: 0 0 0 6px rgba(74,222,128,0); }
  }
  @keyframes bm-fadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes bm-omGlow {
    0%, 100% { text-shadow: 0 0 6px rgba(255,195,0,0.4); }
    50%       { text-shadow: 0 0 22px rgba(255,195,0,0.9); }
  }

  .bm-quick-btn:hover:not(:disabled) {
    background: #fff3e6 !important;
    color: #8B1A1A !important;
    border-left-color: #8B1A1A !important;
    border-color: #C8922A88 !important;
  }
  .bm-send-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #ff8800, #c63a00) !important;
    box-shadow: 0 6px 20px rgba(255,107,0,0.38) !important;
    transform: translateY(-1px) scale(1.02) !important;
  }
  .bm-textarea:focus {
    border-color: #C8922A !important;
    box-shadow: 0 0 0 3px rgba(200,146,42,0.15) !important;
    outline: none;
  }
  .bm-suggest-chip:hover:not(:disabled) {
    background: #fff3e0 !important;
    border-color: #C8922A !important;
    color: #8B1A1A !important;
    transform: translateY(-1px) !important;
  }
`;

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════════ */
const saffron  = '#FF6B00';
const deepRed  = '#8B1A1A';
const cream    = '#FDF6EC';
const gold     = '#C8922A';
const darkText = '#2A1500';
const mutedText = '#7A5C2E';

/* ═══════════════════════════════════════════════════════════
   STYLES OBJECT
   ═══════════════════════════════════════════════════════════ */
const S = {
  /* Wrapper */
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 560,
    maxHeight: 760,
    background: cream,
    borderRadius: 22,
    overflow: 'hidden',
    boxShadow: '0 12px 56px rgba(139,26,26,0.13), 0 2px 8px rgba(0,0,0,0.06)',
    border: `1.5px solid ${gold}44`,
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    animation: 'bm-fadeUp 0.35s ease-out',
  },

  /* Header */
  header: {
    position: 'relative',
    background: `linear-gradient(135deg, ${saffron} 0%, ${deepRed} 100%)`,
    padding: '15px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: 'white',
    overflow: 'hidden',
    flexShrink: 0,
  },
  headerGlow: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'radial-gradient(ellipse at 15% 50%, rgba(255,210,60,0.16) 0%, transparent 60%)',
    pointerEvents: 'none',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
  },
  omCircle: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.16)',
    border: '1.5px solid rgba(255,255,255,0.32)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backdropFilter: 'blur(4px)',
    flexShrink: 0,
  },
  omText: {
    fontSize: 21,
    fontFamily: "'Tiro Devanagari Sanskrit', serif",
    color: '#FFE57A',
    animation: 'bm-omGlow 3s ease-in-out infinite',
    lineHeight: 1,
  },
  headerTitle: {
    fontFamily: "'Crimson Pro', Georgia, serif",
    fontWeight: 700,
    fontSize: 17,
    letterSpacing: '0.01em',
    lineHeight: 1.25,
  },
  headerSub: {
    fontSize: 10.5,
    opacity: 0.78,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  liveChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(255,255,255,0.16)',
    border: '1px solid rgba(255,255,255,0.28)',
    borderRadius: 20,
    padding: '4px 11px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.03em',
    position: 'relative',
    flexShrink: 0,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#4ade80',
    display: 'inline-block',
    animation: 'bm-pulse 2s infinite',
  },

  /* Quick Prompts */
  quickBar: {
    background: '#fff9f2',
    borderBottom: `1px solid ${gold}22`,
    padding: '8px 14px',
    flexShrink: 0,
  },
  quickLabel: {
    fontSize: 10,
    color: mutedText,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    marginBottom: 6,
  },
  quickScroll: {
    display: 'flex',
    gap: 6,
    overflowX: 'auto',
    paddingBottom: 2,
  },
  quickBtn: {
    flexShrink: 0,
    padding: '5px 14px',
    borderRadius: 6,
    border: `1px solid ${gold}55`,
    borderLeft: `3px solid ${saffron}`,
    background: 'white',
    color: darkText,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.18s ease',
    fontFamily: 'inherit',
    letterSpacing: '0.01em',
  },

  /* Messages */
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 14px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 13,
  },
  rowUser: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    gap: 8,
    animation: 'bm-fadeUp 0.22s ease-out',
  },
  rowBot: {
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    gap: 8,
    animation: 'bm-fadeUp 0.28s ease-out',
  },
  botAvatar: {
    width: 33,
    height: 33,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${saffron}20, ${gold}30)`,
    border: `1.5px solid ${gold}50`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  userAvatar: {
    width: 33,
    height: 33,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${saffron}, ${deepRed})`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  bubbleUser: {
    maxWidth: '70%',
    padding: '10px 16px',
    borderRadius: '18px 18px 4px 18px',
    background: `linear-gradient(135deg, ${saffron} 0%, #e05500 100%)`,
    color: 'white',
    fontSize: 14,
    lineHeight: 1.6,
    boxShadow: '0 3px 12px rgba(255,107,0,0.26)',
    fontFamily: 'inherit',
  },
  bubbleBot: {
    maxWidth: '82%',
    padding: '13px 16px',
    borderRadius: '18px 18px 18px 4px',
    background: 'white',
    color: darkText,
    fontSize: 14,
    lineHeight: 1.72,
    border: `1px solid ${gold}30`,
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
  },

  /* Typing */
  typingWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    display: 'inline-block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: saffron,
    animation: 'bm-bounce 1.1s infinite',
  },
  typingLabel: {
    fontSize: 11,
    color: mutedText,
    fontStyle: 'italic',
    marginLeft: 5,
  },

  /* ── Suggested Question Chips ── */
  suggestBar: {
    background: '#fffaf3',
    borderTop: `1px solid ${gold}22`,
    padding: '8px 14px 10px',
    flexShrink: 0,
    animation: 'bm-fadeUp 0.3s ease-out',
  },
  suggestLabel: {
    fontSize: 10,
    color: gold,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 7,
  },
  suggestScroll: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 7,
  },
  suggestChip: {
    padding: '6px 14px',
    borderRadius: 20,
    border: `1px solid ${gold}55`,
    background: 'white',
    color: darkText,
    fontSize: 12,
    fontWeight: 400,
    cursor: 'pointer',
    whiteSpace: 'normal',
    textAlign: 'left',
    lineHeight: 1.45,
    transition: 'all 0.18s ease',
    fontFamily: 'inherit',
    letterSpacing: '0.01em',
    maxWidth: '100%',
    boxShadow: `0 1px 4px ${gold}18`,
  },

  /* Divider */
  divider: {
    height: 1,
    background: `linear-gradient(90deg, transparent, ${gold}44, transparent)`,
    flexShrink: 0,
  },

  /* Input */
  inputArea: {
    display: 'flex',
    gap: 8,
    padding: '11px 13px',
    background: '#fffdf8',
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  textarea: {
    flex: 1,
    resize: 'none',
    border: `1.5px solid ${gold}50`,
    borderRadius: 14,
    padding: '10px 13px',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    color: darkText,
    background: cream,
    lineHeight: 1.55,
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
  },
  sendBtn: {
    padding: '11px 17px',
    borderRadius: 14,
    border: 'none',
    background: `linear-gradient(135deg, ${saffron} 0%, #d44a00 100%)`,
    color: 'white',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    boxShadow: '0 3px 12px rgba(255,107,0,0.22)',
    fontFamily: 'inherit',
    letterSpacing: '0.02em',
  },

  /* Footer */
  footerNote: {
    textAlign: 'center',
    fontSize: 10,
    color: `${mutedText}aa`,
    padding: '6px 16px 9px',
    background: '#fffdf8',
    letterSpacing: '0.02em',
    flexShrink: 0,
  },

  /* ── Rich message styles ── */
  botContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  sectionHeader: {
    fontWeight: 700,
    fontSize: 13,
    color: deepRed,
    marginTop: 12,
    marginBottom: 3,
    letterSpacing: '0.01em',
  },
  bulletLine: {
    display: 'flex',
    gap: 7,
    alignItems: 'flex-start',
    paddingLeft: 4,
    marginBottom: 1,
  },
  bulletDot: {
    color: saffron,
    fontWeight: 900,
    flexShrink: 0,
    fontSize: 17,
    lineHeight: 1.4,
  },
  normalLine: {
    fontSize: 14,
    color: darkText,
    lineHeight: 1.7,
  },
  mantraBlock: {
    background: `linear-gradient(100deg, rgba(200,146,42,0.11), rgba(255,107,0,0.07))`,
    border: `1px solid ${gold}50`,
    borderLeft: `3px solid ${gold}`,
    borderRadius: '0 10px 10px 0',
    padding: '9px 14px',
    marginTop: 10,
    marginBottom: 2,
  },
  mantraText: {
    fontSize: 18,
    fontWeight: 700,
    color: '#6B0F0F',
    letterSpacing: '0.05em',
    fontFamily: "'Tiro Devanagari Sanskrit', serif",
    display: 'block',
    lineHeight: 1.7,
  },
  translitLine: {
    fontSize: 12,
    color: mutedText,
    paddingLeft: 14,
    marginBottom: 8,
    fontStyle: 'italic',
    lineHeight: 1.6,
  },
};