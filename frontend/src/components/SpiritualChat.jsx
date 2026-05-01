import { useState, useRef, useEffect } from 'react';

const SYSTEM_PROMPT = `You are a compassionate and professional Hindu spiritual guide for BharatMandir platform.

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

TONE: Warm, structured, professional, non-prescriptive. Never give medical or financial advice directly.`;

const QUICK_PROMPTS = [
  { label: '💰 Financial Stress', text: 'I am under a lot of financial stress. My business is not doing well.' },
  { label: '👨‍👩‍👧 Family Conflict', text: 'Mere ghar mein bahut jhagda ho raha hai. Parivaar ke saath conflict hai.' },
  { label: '🏥 Health Worry', text: 'I have been unwell for months and feeling hopeless about my health.' },
  { label: '☮️ Seeking Peace', text: 'I feel restless and anxious. I want to find inner peace and calm.' },
  { label: '💼 Career Confusion', text: 'Mujhe career ke baare mein bahut confusion hai. Sahi rasta kya hai?' },
];

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
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.content[0].text;
}

/** Bold **text** within a line */
function RichLine({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} style={{ color: '#c84b00' }}>{part.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

/** Detects Devanagari characters */
const isDevanagari = (str) => /[\u0900-\u097F]/.test(str);

/** Renders structured bot message */
function BotMessage({ content }) {
  const lines = content.split('\n');

  return (
    <div style={styles.botContent}>
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{ height: 5 }} />;

        // Devanagari mantra line
        if (isDevanagari(trimmed)) {
          return (
            <div key={i} style={styles.mantraBlock}>
              <span style={styles.mantraText}>{trimmed}</span>
            </div>
          );
        }

        // Transliteration line: (Om Namah Shivaya — ...)
        if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
          return (
            <div key={i} style={styles.translitLine}>
              <em>{trimmed}</em>
            </div>
          );
        }

        // Section header: **1. Title** or **Title:**
        if (/^\*\*\d+\./.test(trimmed) || /^\*\*[^*]+:\*\*$/.test(trimmed)) {
          return (
            <div key={i} style={styles.sectionHeader}>
              <RichLine text={trimmed} />
            </div>
          );
        }

        // Bullet line: - or •
        if (/^[-•]/.test(trimmed)) {
          return (
            <div key={i} style={styles.bulletLine}>
              <span style={styles.bulletDot}>›</span>
              <span><RichLine text={trimmed.replace(/^[-•]\s*/, '')} /></span>
            </div>
          );
        }

        // Normal line
        return (
          <div key={i} style={styles.normalLine}>
            <RichLine text={trimmed} />
          </div>
        );
      })}
    </div>
  );
}

export default function SpiritualChat() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Namaste 🙏 I am your AI Spiritual Guide.\n\nShare your worries, fears, or questions — I will suggest mantras, rituals, and deities that may help you find peace and clarity.\n\n**Write in Hindi or English** — I will respond in the same language.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = async (text) => {
    const userText = (text || input).trim();
    if (!userText || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: userText };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setLoading(true);

    try {
      const apiMessages = newHistory.map((m) => ({ role: m.role, content: m.content }));
      const reply = await callClaude(apiMessages);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ Could not reach the spiritual guide right now. Please check your API key or try again.',
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
    <div style={styles.wrapper}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.headerIcon}>🕉️</span>
          <div>
            <div style={styles.headerTitle}>Adhyatmik Margdarshak</div>
            <div style={styles.headerSub}>AI Spiritual Guide · BharatMandir</div>
          </div>
        </div>
        <div style={styles.statusDot} title="Online" />
      </div>

      {/* Quick prompts */}
      <div style={styles.quickBar}>
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p.label}
            style={styles.quickBtn}
            onClick={() => sendMessage(p.text)}
            disabled={loading}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={styles.messagesArea}>
        {messages.map((msg, i) => (
          <div key={i} style={msg.role === 'user' ? styles.rowUser : styles.rowBot}>
            {msg.role === 'assistant' && <div style={styles.avatar}>🛕</div>}

            {msg.role === 'user' ? (
              <div style={styles.bubbleUser}>{msg.content}</div>
            ) : (
              <div style={styles.bubbleBot}>
                <BotMessage content={msg.content} />
              </div>
            )}

            {msg.role === 'user' && <div style={styles.avatar}>🙏</div>}
          </div>
        ))}

        {loading && (
          <div style={styles.rowBot}>
            <div style={styles.avatar}>🛕</div>
            <div style={{ ...styles.bubbleBot, ...styles.typingBubble }}>
              <span style={styles.dot} />
              <span style={{ ...styles.dot, animationDelay: '0.2s' }} />
              <span style={{ ...styles.dot, animationDelay: '0.4s' }} />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={styles.inputArea}>
        <textarea
          style={styles.textarea}
          placeholder="Share your problem... (Hindi or English)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          disabled={loading}
        />
        <button
          style={{ ...styles.sendBtn, opacity: loading || !input.trim() ? 0.5 : 1 }}
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
        >
          🙏 Send
        </button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

/* ─── Design Tokens ─── */
const saffron = '#FF6B00';
const cream   = '#FFF8EE';
const gold    = '#D4A017';

const styles = {
  wrapper: {
    display: 'flex', flexDirection: 'column',
    height: '100%', minHeight: 520, maxHeight: 700,
    background: cream, borderRadius: 20, overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(212,160,23,0.18)',
    border: `1.5px solid ${gold}33`,
    fontFamily: "'Segoe UI', sans-serif",
  },
  header: {
    background: `linear-gradient(135deg, ${saffron} 0%, #c84b00 100%)`,
    padding: '14px 18px', display: 'flex',
    alignItems: 'center', justifyContent: 'space-between', color: 'white',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  headerIcon: { fontSize: 28 },
  headerTitle: { fontWeight: 700, fontSize: 16, letterSpacing: '.02em' },
  headerSub:   { fontSize: 11, opacity: 0.85 },
  statusDot: {
    width: 10, height: 10, borderRadius: '50%',
    background: '#4ade80', boxShadow: '0 0 6px #4ade80',
  },
  quickBar: {
    display: 'flex', gap: 6, padding: '10px 14px',
    overflowX: 'auto', background: '#fff5e6',
    borderBottom: `1px solid ${gold}22`, flexShrink: 0,
  },
  quickBtn: {
    flexShrink: 0, padding: '5px 12px', borderRadius: 20,
    border: `1.5px solid ${saffron}55`, background: 'white',
    color: saffron, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    whiteSpace: 'nowrap', transition: 'all .15s',
  },
  messagesArea: {
    flex: 1, overflowY: 'auto', padding: '16px 14px',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  rowUser: { display: 'flex', justifyContent: 'flex-end',  alignItems: 'flex-end', gap: 8 },
  rowBot:  { display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', gap: 8 },
  avatar:  { fontSize: 22, flexShrink: 0, lineHeight: 1 },
  bubbleUser: {
    maxWidth: '72%', padding: '10px 14px',
    borderRadius: '18px 18px 4px 18px',
    background: saffron, color: 'white', fontSize: 14, lineHeight: 1.55,
    boxShadow: '0 2px 8px rgba(255,107,0,0.25)',
  },
  bubbleBot: {
    maxWidth: '80%', padding: '12px 16px',
    borderRadius: '18px 18px 18px 4px',
    background: 'white', color: '#2a1a00', fontSize: 14, lineHeight: 1.7,
    border: `1px solid ${gold}33`,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  typingBubble: { display: 'flex', gap: 5, alignItems: 'center', padding: '14px 18px' },
  dot: {
    display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
    background: saffron, animation: 'bounce 1s infinite',
  },
  inputArea: {
    display: 'flex', gap: 8, padding: '12px 14px',
    borderTop: `1px solid ${gold}22`, background: 'white', flexShrink: 0,
  },
  textarea: {
    flex: 1, resize: 'none', border: `1.5px solid ${gold}44`,
    borderRadius: 12, padding: '9px 12px', fontSize: 14,
    fontFamily: 'inherit', outline: 'none', color: '#2a1a00',
    background: cream, lineHeight: 1.5,
  },
  sendBtn: {
    padding: '0 18px', borderRadius: 12, border: 'none',
    background: saffron, color: 'white', fontWeight: 700,
    fontSize: 13, cursor: 'pointer', flexShrink: 0, transition: 'opacity .15s',
  },

  /* ── Rich message styles ── */
  botContent:    { display: 'flex', flexDirection: 'column', gap: 3 },
  sectionHeader: {
    fontWeight: 700, fontSize: 13, color: saffron,
    marginTop: 10, marginBottom: 2, letterSpacing: '.01em',
  },
  bulletLine: { display: 'flex', gap: 7, alignItems: 'flex-start', paddingLeft: 6 },
  bulletDot:  { color: saffron, fontWeight: 900, flexShrink: 0, fontSize: 16, lineHeight: 1.4 },
  normalLine: { fontSize: 14, color: '#2a1a00', lineHeight: 1.65 },
  mantraBlock: {
    background: `linear-gradient(90deg, ${gold}20, ${saffron}14)`,
    border: `1px solid ${gold}55`, borderRadius: 8,
    padding: '7px 13px', marginTop: 8, marginBottom: 1,
  },
  mantraText: {
    fontSize: 17, fontWeight: 700, color: '#7a0000',
    letterSpacing: '.05em', fontFamily: 'serif',
  },
  translitLine: {
    fontSize: 12, color: '#6b4c00', paddingLeft: 13,
    marginBottom: 6, fontStyle: 'italic',
  },
};