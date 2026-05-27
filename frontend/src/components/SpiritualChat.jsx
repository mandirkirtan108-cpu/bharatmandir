import { useState, useRef, useEffect, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════
   STATIC SYSTEM PROMPT  —  BharatMandir AI Guide
   (date/time injected dynamically per call, not rebuilt entirely)
   ═══════════════════════════════════════════════════════════ */
const STATIC_PROMPT = `You are a compassionate Hindu spiritual guide for BharatMandir — a platform connecting devotees with India's sacred temples.

LANGUAGE RULE (STRICT):
- Detect the language of the user's message.
- If the user writes in ENGLISH → respond entirely in English.
- If the user writes in HINDI (Devanagari or Roman Hindi) → respond entirely in Hindi.
- If the user writes in mixed Hindi-English → match the dominant language.
- NEVER mix languages within section labels or bullet points.

FORMATTING RULE — CRITICAL (NO MARKDOWN SYMBOLS):
- Do NOT use asterisks (*) anywhere in your response — not for bold, not for bullets, not for italics. Never ever use * or ** in any response.
- Do NOT use dashes (-) or (•) as bullet points. Write everything as flowing prose paragraphs.
- For section headers, write them as plain text on their own line followed by a colon, e.g.: "Spiritual Perspective:" or "आध्यात्मिक दृष्टिकोण:"
- Separate sections with a blank line.
- Write answers in well-formed paragraphs, NOT as bullet lists.

MANTRA RULE (only when genuinely relevant):
- Do NOT include a mantra for greetings, simple factual questions, or casual messages like "hi", "hello", "what time is it", "thank you", etc.
- Only suggest a mantra when the user asks about a specific spiritual problem, ritual, deity, or personal hardship.
- When you do suggest a mantra, write it on TWO lines:
  Line 1: Devanagari / Sanskrit script
  Line 2: English transliteration + meaning in parentheses
- Example:
  ॐ नमः शिवाय
  (Om Namah Shivaya — I bow to Lord Shiva)
- Never add a mantra just to close a response or as a sign-off greeting.

RESPONSE LENGTH RULE (CRITICAL):
- Match your response length strictly to the complexity of the user's question.
- Simple or follow-up questions → answer concisely in 2–4 sentences.
- Complex or first-time questions → use the full structured format below.
- Never pad a short answer with extra spiritual elaboration just to fill space.

RESPONSE FORMAT (for complex / first-time questions) — use plain text headers, no asterisks:

1. Empathy
Write 1–2 warm sentences acknowledging the person's situation as a paragraph.

2. Spiritual Perspective
Write 2–3 sentences offering a dharmic or karmic view as a paragraph. Do not use bullets.

3. Spiritual Solutions
Write 2–3 sentences describing relevant mantras, prayers, or rituals as a paragraph. Include any mantra in the two-line format (Devanagari on Line 1, transliteration on Line 2).

4. Deity & Temple Recommendation
Write 1–2 sentences naming a relevant deity and type of temple to visit.

5. Closing Blessing
Write 1 sincere closing blessing in the user's language.

RESPONSE FORMAT (for simple / follow-up questions):
- Answer directly in 2–4 sentences as plain prose.
- Include a mantra ONLY if the user's question is directly about a spiritual practice, ritual, or personal hardship. Never add one to greetings or simple answers.
- End with a single short blessing line.

After the closing blessing, always add:

Suggested Questions:
- [a follow-up question phrased as if the USER is asking, in first person]
- [a follow-up question phrased as if the USER is asking, in first person]
- [a follow-up question phrased as if the USER is asking, in first person]

TONE:
- Respectful, composed, and spiritually authentic — like a learned pandit or spiritual counsellor.
- Never give medical, legal, or financial advice.`;

function buildSystemPrompt() {
  const now = new Date();
  const istOptions = { timeZone: 'Asia/Kolkata', hour12: true };
  const dateStr = now.toLocaleDateString('en-IN', { ...istOptions, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-IN', { ...istOptions, hour: '2-digit', minute: '2-digit' });

  return `${STATIC_PROMPT}

CURRENT DATE & TIME (India, IST):
- Today is: ${dateStr}
- Current time: ${timeStr} IST
- If the user asks what day, date, or time it is, answer directly and accurately using the above values.`;
}

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

const MAX_CHARS = 600;
const WELCOME_MSG = {
  role: 'assistant',
  content:
    'Namaste. I am your BharatMandir Spiritual Guide.\n\nPlease share your concerns, questions, or spiritual needs — I will offer guidance through mantras, prayers, rituals, and temple recommendations.\n\nYou may write in Hindi or English — I will respond in the same language.',
};

/* ═══════════════════════════════════════════════════════════
   API CALL  —  routed through /api/spiritual (server proxy)
   so the Anthropic key is never exposed in the browser.
   ═══════════════════════════════════════════════════════════ */
async function callClaude(messages) {
  const res = await fetch('/api/spiritual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1600,                      // bumped from 1200 — Hindi uses more tokens
      system: buildSystemPrompt(),
      messages,
    }),
  });

  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (res.status === 401) throw new Error('AUTH');
  if (!res.ok)            throw new Error(`API_${res.status}`);

  const data = await res.json();
  return data.content[0].text;
}

/* ═══════════════════════════════════════════════════════════
   EXTRACT SUGGESTED QUESTIONS
   ═══════════════════════════════════════════════════════════ */
function extractSuggestedQuestions(content) {
  if (!content) return [];
  const lines = content.split('\n');
  let inSection = false;
  const questions = [];
  for (const line of lines) {
    if (/suggested questions/i.test(line) || /सुझाए गए प्रश्न/i.test(line)) {
      inSection = true; continue;
    }
    if (inSection && /^[-•✦\d.]/.test(line.trim())) {
      questions.push(line.trim().replace(/^[-•✦\d.]\s*/, ''));
    }
  }
  return questions;
}

/* ═══════════════════════════════════════════════════════════
   BOT MESSAGE RENDERER
   ═══════════════════════════════════════════════════════════ */
const isDevanagari = (str) => /[\u0900-\u097F]/.test(str);

function BotMessage({ content, isWelcome }) {
  if (isWelcome) {
    return (
      <div style={S.welcomeContent}>
        <div style={S.welcomeIcon}>🪔</div>
        {content.split('\n\n').map((para, i) => (
          <p key={i} style={{ margin: '6px 0', fontSize: 14, lineHeight: 1.75, color: '#3D1F00' }}>{para}</p>
        ))}
      </div>
    );
  }

  const lines = content.split('\n');
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { elements.push(<div key={i} style={{ height: 6 }} />); i++; continue; }
    if (/^[-—]{2,}$/.test(trimmed)) { i++; continue; }
    if (/suggested questions/i.test(trimmed) || /सुझाए गए प्रश्न/i.test(trimmed)) break;

    const isSectionHeader = /^\d+\.\s/.test(trimmed) || trimmed.endsWith(':');
    if (isSectionHeader) {
      elements.push(<div key={i} style={S.sectionHeader}>{trimmed}</div>);
      i++; continue;
    }

    const isMantra = isDevanagari(trimmed) && trimmed.length < 80 && !trimmed.endsWith(':');
    if (isMantra) {
      elements.push(
        <div key={i} style={S.mantraBlock}>
          <span style={S.mantraText}>{trimmed}</span>
        </div>
      );
      i++;
      if (i < lines.length && lines[i].trim().startsWith('(')) {
        elements.push(
          <div key={`t${i}`} style={S.translitLine}><em>{lines[i].trim()}</em></div>
        );
        i++;
      }
      continue;
    }

    elements.push(<div key={i} style={S.normalLine}>{trimmed}</div>);
    i++;
  }

  return <div style={S.botContent}>{elements}</div>;
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
   ERROR MESSAGE helper
   ═══════════════════════════════════════════════════════════ */
function errorContent(code) {
  if (code === 'RATE_LIMIT') return '⏳ Too many requests — please wait a moment and try again.\n\nॐ शान्तिः शान्तिः शान्तिः';
  if (code === 'AUTH')       return '🔑 Authentication error — please contact support.\n\nॐ शान्तिः';
  return '⚠️ Could not reach the spiritual guide right now. Please try again.\n\nॐ शान्तिः शान्तिः शान्तिः';
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export default function SpiritualChat() {
  const [messages, setMessages]   = useState([WELCOME_MSG]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const messagesAreaRef           = useRef(null);
  const textareaRef               = useRef(null);

  /* Scroll messages area on new content */
  useEffect(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  /* Auto-expand textarea height */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 140) + 'px';
  }, [input]);

  const lastBotMsg = [...messages].reverse().find(m => m.role === 'assistant');
  const suggestedQuestions = extractSuggestedQuestions(lastBotMsg?.content || '');
  const charsLeft = MAX_CHARS - input.length;

  /* Clear conversation */
  const handleClear = useCallback(() => {
    setMessages([WELCOME_MSG]);
    setInput('');
  }, []);

  const sendMessage = useCallback(async (text) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    setInput('');

    const userMsg    = { role: 'user', content: userText };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setLoading(true);

    try {
      /* Sliding window: only last 10 messages to keep token cost bounded */
      const apiMessages = newHistory
        .slice(-10)
        .map(m => ({ role: m.role, content: m.content }));

      const reply = await callClaude(apiMessages);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: errorContent(err.message) }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
          <div style={S.liveChip}>
            <span style={S.liveDot} />
            Online
          </div>
          {/* Clear / New session button */}
          <button
            style={S.clearBtn}
            className="bm-clear-btn"
            onClick={handleClear}
            title="Start new conversation"
            aria-label="Start new conversation"
          >
            ↺
          </button>
        </div>
      </div>

      {/* ── Quick Prompts ── */}
      <div style={S.quickBar}>
        <div style={S.quickLabel}>Quick Topics:</div>
        <div style={S.quickScroll} className="bm-quick-scroll">
          {QUICK_PROMPTS.map(p => (
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
      <div ref={messagesAreaRef} style={S.messagesArea}>
        {messages.map((msg, i) => (
          <div key={i} style={msg.role === 'user' ? S.rowUser : S.rowBot}>
            {msg.role === 'assistant' && (
              <div style={S.botAvatar}><span style={{ fontSize: 17 }}>🛕</span></div>
            )}
            {msg.role === 'user' ? (
              <div style={S.bubbleUser}>{msg.content}</div>
            ) : (
              <div style={i === 0 ? S.bubbleBotWelcome : S.bubbleBot}>
                <BotMessage content={msg.content} isWelcome={i === 0} />
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
            <div style={{ ...S.bubbleBot, padding: '14px 18px' }}><TypingDots /></div>
          </div>
        )}
      </div>

      {/* ── Suggested Question Chips ── */}
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
        <div style={{ flex: 1, position: 'relative' }}>
          <textarea
            ref={textareaRef}
            style={S.textarea}
            className="bm-textarea"
            placeholder="Share your concern or question... (Hindi or English)"
            value={input}
            onChange={e => {
              if (e.target.value.length <= MAX_CHARS) setInput(e.target.value);
            }}
            onKeyDown={handleKey}
            rows={3}
            disabled={loading}
            maxLength={MAX_CHARS}
          />
          {/* Character counter — only visible when nearing limit */}
          {charsLeft <= 150 && (
            <div style={{
              position: 'absolute', bottom: 6, right: 10,
              fontSize: 10, color: charsLeft < 50 ? '#E24B4A' : '#9A7150',
              fontFamily: 'inherit', pointerEvents: 'none',
            }}>
              {charsLeft}
            </div>
          )}
        </div>
        <button
          style={{ ...S.sendBtn, opacity: loading || !input.trim() ? 0.45 : 1 }}
          className="bm-send-btn"
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
        >
          <span>🙏</span>
          <span className="bm-send-label">Send</span>
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
   CSS
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
    0%, 100% { text-shadow: 0 0 8px rgba(255,213,128,0.5); }
    50%       { text-shadow: 0 0 24px rgba(255,213,128,1); }
  }

  /* Hide scrollbar on quick prompts strip */
  .bm-quick-scroll { scrollbar-width: none; -ms-overflow-style: none; }
  .bm-quick-scroll::-webkit-scrollbar { display: none; }

  .bm-quick-btn:hover:not(:disabled) {
    background: rgba(255,213,128,0.15) !important;
    color: #FFD580 !important;
    border-color: rgba(255,213,128,0.5) !important;
    border-left-color: #E8650A !important;
  }
  .bm-send-btn:hover:not(:disabled) {
    box-shadow: 0 6px 20px rgba(232,101,10,0.45) !important;
    transform: translateY(-1px) scale(1.02) !important;
  }
  .bm-textarea:focus {
    border-color: rgba(255,213,128,0.6) !important;
    box-shadow: 0 0 0 3px rgba(255,213,128,0.12) !important;
    outline: none;
  }
  .bm-suggest-chip:hover:not(:disabled) {
    background: rgba(255,213,128,0.12) !important;
    border-color: rgba(255,213,128,0.5) !important;
    color: #FFD580 !important;
    transform: translateY(-1px) !important;
  }
  .bm-clear-btn {
    background: rgba(255,213,128,0.08) !important;
    border: 1px solid rgba(255,213,128,0.25) !important;
    color: #FFD580 !important;
    border-radius: 8px !important;
    width: 32px; height: 32px;
    font-size: 18px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.18s ease;
  }
  .bm-clear-btn:hover {
    background: rgba(255,213,128,0.18) !important;
    transform: rotate(-20deg);
  }

  /* Hide "Send" text on very narrow phones, show icon only */
  @media (max-width: 420px) {
    .bm-send-label { display: none; }
  }
`;

/* ═══════════════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════════════ */
const brown1  = '#3D1F00';
const brown2  = '#7a3208';
const orange  = '#E8650A';
const gold    = '#FFD580';
const goldMid = '#C8960C';
const cream   = '#f8f4ef';

/* ═══════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════ */
const S = {
  wrapper: {
    display: 'flex', flexDirection: 'column',
    height: '100%',
    minHeight: 560,
    maxHeight: 'min(760px, 85vh)',           /* was hard 760px — now screen-aware */
    background: 'white', borderRadius: 28, overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(61,31,0,0.15)',
    border: '1px solid rgba(232,101,10,0.12)',
    fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
    animation: 'bm-fadeUp 0.35s ease-out',
  },
  header: {
    position: 'relative',
    background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
    padding: '16px 20px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', color: gold, overflow: 'hidden', flexShrink: 0,
  },
  headerGlow: {
    position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
    width: 500, height: 200,
    background: 'radial-gradient(ellipse, rgba(232,101,10,0.25) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  headerInner: { display: 'flex', alignItems: 'center', gap: 12, position: 'relative' },
  omCircle: {
    width: 44, height: 44, borderRadius: '50%',
    background: 'rgba(255,213,128,0.12)',
    border: '1.5px solid rgba(255,213,128,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  omText: {
    fontSize: 21, fontFamily: "'Tiro Devanagari Sanskrit', serif",
    color: gold, animation: 'bm-omGlow 3s ease-in-out infinite', lineHeight: 1,
  },
  headerTitle: {
    fontFamily: "'Crimson Pro', Georgia, serif",
    fontWeight: 700, fontSize: 17, letterSpacing: '0.01em', lineHeight: 1.25, color: gold,
  },
  headerSub: {
    fontSize: 10, opacity: 0.65,
    letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2, color: gold,
  },
  liveChip: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(255,213,128,0.1)', border: '1px solid rgba(255,213,128,0.28)',
    borderRadius: 20, padding: '5px 12px',
    fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
    color: gold, flexShrink: 0,
  },
  liveDot: {
    width: 7, height: 7, borderRadius: '50%',
    background: '#4ade80', display: 'inline-block', animation: 'bm-pulse 2s infinite',
  },
  clearBtn: {
    /* base styles in CSS class .bm-clear-btn */
    flexShrink: 0,
  },
  quickBar: {
    background: '#fdf6ec',
    borderBottom: '1px solid rgba(232,101,10,0.1)',
    padding: '9px 16px', flexShrink: 0,
  },
  quickLabel: {
    fontSize: 10, color: '#9A7150', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7,
  },
  quickScroll: { display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 },
  quickBtn: {
    flexShrink: 0, padding: '6px 14px', borderRadius: 8,
    border: '1.5px solid rgba(232,101,10,0.2)',
    borderLeft: `3px solid ${orange}`,
    background: 'white', color: brown2,
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', transition: 'all 0.18s ease',
    fontFamily: 'inherit', letterSpacing: '0.01em',
  },
  messagesArea: {
    flex: 1, overflowY: 'auto', padding: '18px 16px 10px',
    display: 'flex', flexDirection: 'column', gap: 14, background: cream,
  },
  rowUser: {
    display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 8,
    animation: 'bm-fadeUp 0.22s ease-out',
  },
  rowBot: {
    display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', gap: 8,
    animation: 'bm-fadeUp 0.28s ease-out',
  },
  botAvatar: {
    width: 34, height: 34, borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(232,101,10,0.15), rgba(200,150,12,0.2))',
    border: '1.5px solid rgba(232,101,10,0.25)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  userAvatar: {
    width: 34, height: 34, borderRadius: '50%',
    background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 100%)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  bubbleUser: {
    maxWidth: '70%', padding: '11px 16px',
    borderRadius: '18px 18px 4px 18px',
    background: 'linear-gradient(135deg, #3D1F00 0%, #B84D00 50%, #E8650A 100%)',
    color: 'white', fontSize: 14, lineHeight: 1.6,
    boxShadow: '0 4px 16px rgba(184,77,0,0.3)', fontFamily: 'inherit',
  },
  bubbleBot: {
    maxWidth: '82%', padding: '14px 18px',
    borderRadius: '18px 18px 18px 4px',
    background: 'white', color: brown1,
    fontSize: 14, lineHeight: 1.72,
    border: '1px solid rgba(232,101,10,0.12)',
    boxShadow: '0 2px 12px rgba(61,31,0,0.07)',
  },
  /* Welcome bubble — distinct dashed border and cream background */
  bubbleBotWelcome: {
    maxWidth: '90%', padding: '16px 20px',
    borderRadius: 16,
    background: '#fffdf8', color: brown1,
    fontSize: 14, lineHeight: 1.72,
    border: '1.5px dashed rgba(200,150,12,0.35)',
    boxShadow: '0 2px 12px rgba(61,31,0,0.05)',
  },
  welcomeContent: { display: 'flex', flexDirection: 'column', gap: 4 },
  welcomeIcon: { fontSize: 24, marginBottom: 6 },
  typingWrap: { display: 'flex', alignItems: 'center', gap: 5 },
  dot: {
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
    background: orange, animation: 'bm-bounce 1.1s infinite',
  },
  typingLabel: { fontSize: 11, color: '#9A7150', fontStyle: 'italic', marginLeft: 5 },
  suggestBar: {
    background: '#fdf6ec', borderTop: '1px solid rgba(232,101,10,0.1)',
    padding: '9px 16px 11px', flexShrink: 0, animation: 'bm-fadeUp 0.3s ease-out',
  },
  suggestLabel: {
    fontSize: 10, color: goldMid, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7,
  },
  suggestScroll: { display: 'flex', flexWrap: 'wrap', gap: 7 },
  suggestChip: {
    padding: '6px 14px', borderRadius: 20,
    border: '1.5px solid rgba(232,101,10,0.2)',
    background: 'white', color: brown2,
    fontSize: 12, fontWeight: 500, cursor: 'pointer',
    whiteSpace: 'normal', textAlign: 'left', lineHeight: 1.45,
    transition: 'all 0.18s ease', fontFamily: 'inherit',
    letterSpacing: '0.01em',
    maxWidth: '280px',                        /* prevent oversized chips */
    overflow: 'hidden', textOverflow: 'ellipsis',
    boxShadow: '0 1px 4px rgba(61,31,0,0.06)',
  },
  divider: {
    height: 1,
    background: 'linear-gradient(90deg, transparent, rgba(232,101,10,0.2), transparent)',
    flexShrink: 0,
  },
  inputArea: {
    display: 'flex', gap: 10, padding: '10px 14px',
    background: 'white', flexShrink: 0, alignItems: 'flex-end',
  },
  textarea: {
    width: '100%', resize: 'none',
    border: '2px solid #EDE0CC', borderRadius: 16,
    padding: '11px 14px',
    fontSize: 14, fontFamily: 'inherit', outline: 'none',
    color: brown1, background: cream, lineHeight: 1.55,
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box',
    minHeight: 72,                            /* taller default for Hindi */
    maxHeight: 140,
    overflowY: 'auto',
  },
  sendBtn: {
    padding: '12px 18px', borderRadius: 16, border: 'none',
    background: 'linear-gradient(135deg, #3D1F00 0%, #B84D00 50%, #E8650A 100%)',
    color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0,
    transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
    display: 'flex', alignItems: 'center', gap: 6,
    boxShadow: '0 4px 16px rgba(184,77,0,0.3)',
    fontFamily: 'inherit', letterSpacing: '0.04em',
    alignSelf: 'flex-end',                   /* pin to bottom of textarea */
  },
  footerNote: {
    textAlign: 'center', fontSize: 10, color: '#9A7150',
    padding: '6px 16px 10px', background: 'white',
    letterSpacing: '0.02em', flexShrink: 0,
    borderTop: '1px solid rgba(232,101,10,0.08)',
  },
  botContent: { display: 'flex', flexDirection: 'column', gap: 4 },
  sectionHeader: {
    fontWeight: 700, fontSize: 13, color: brown2,
    marginTop: 10, marginBottom: 2, letterSpacing: '0.01em',
  },
  normalLine: { fontSize: 14, color: brown1, lineHeight: 1.75 },
  mantraBlock: {
    background: 'linear-gradient(100deg, rgba(200,150,12,0.08), rgba(232,101,10,0.05))',
    border: '1px solid rgba(200,150,12,0.25)',
    borderLeft: `3px solid ${goldMid}`,
    borderRadius: '0 10px 10px 0',
    padding: '10px 16px', marginTop: 10, marginBottom: 2,
  },
  mantraText: {
    fontSize: 18, fontWeight: 700, color: brown2,
    letterSpacing: '0.05em',
    fontFamily: "'Tiro Devanagari Sanskrit', serif",
    display: 'block', lineHeight: 1.7,
  },
  translitLine: {
    fontSize: 12, color: '#9A7150',
    paddingLeft: 14, marginBottom: 8,
    fontStyle: 'italic', lineHeight: 1.6,
  },
};