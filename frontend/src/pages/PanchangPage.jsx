import { useState } from 'react';
import { Calendar, Clock, Star, Sparkles, AlertCircle, Loader2, Key, Sun, CheckCircle } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const MUHURAT_TYPES = [
  { id: 'vivah',      emoji: '💍', label: 'Vivah',          hindi: 'विवाह',        desc: 'Marriage ceremony' },
  { id: 'griha',      emoji: '🏠', label: 'Griha Pravesh',  hindi: 'गृह प्रवेश',   desc: 'New home entry' },
  { id: 'naamkaran',  emoji: '👶', label: 'Naamkaran',      hindi: 'नामकरण',       desc: 'Baby naming' },
  { id: 'vyapar',     emoji: '🏪', label: 'Vyapar Aarambh', hindi: 'व्यापार आरंभ', desc: 'Business launch' },
  { id: 'yatra',      emoji: '✈️', label: 'Yatra',          hindi: 'यात्रा',        desc: 'Journey / travel' },
  { id: 'vastu',      emoji: '🧱', label: 'Vastu / Bhoomi', hindi: 'वास्तु/भूमि',  desc: 'Construction' },
  { id: 'vidyarambh', emoji: '📚', label: 'Vidyarambh',     hindi: 'विद्यारंभ',    desc: 'Starting education' },
  { id: 'vahan',      emoji: '🚗', label: 'Vahan Puja',     hindi: 'वाहन पूजा',    desc: 'New vehicle' },
  { id: 'mundan',     emoji: '✂️', label: 'Mundan',         hindi: 'मुंडन',        desc: 'First haircut' },
  { id: 'investment', emoji: '💰', label: 'Nivesh',         hindi: 'निवेश',        desc: 'Investment / gold' },
  { id: 'chikitsa',   emoji: '🏥', label: 'Chikitsa',       hindi: 'चिकित्सा',     desc: 'Medical procedure' },
  { id: 'naukri',     emoji: '💼', label: 'Naukri / Job',   hindi: 'नौकरी',        desc: 'Job interview' },
];

const RASHI_LIST = [
  'मेष (Aries)', 'वृषभ (Taurus)', 'मिथुन (Gemini)', 'कर्क (Cancer)',
  'सिंह (Leo)', 'कन्या (Virgo)', 'तुला (Libra)', 'वृश्चिक (Scorpio)',
  'धनु (Sagittarius)', 'मकर (Capricorn)', 'कुंभ (Aquarius)', 'मीन (Pisces)',
];

const TODAY = new Date().toISOString().split('T')[0];

const VERDICT_COLOR = { excellent: '#16a34a', good: '#2563eb', average: '#d97706', avoid: '#dc2626' };
const VERDICT_BG    = { excellent: '#f0fdf4', good: '#eff6ff', average: '#fffbeb', avoid: '#fef2f2' };
const VERDICT_ICON  = { excellent: '🌟', good: '✅', average: '⚡', avoid: '❌' };

async function askClaude(apiKey, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || `Claude API error ${res.status}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

function Card({ children, accent, style = {} }) {
  return (
    <div style={{
      background: 'white', borderRadius: 'var(--radius-lg)', padding: '24px 26px',
      border: `1px solid ${accent || 'var(--cream-dark)'}`,
      boxShadow: '0 2px 16px var(--shadow)', marginBottom: 20, ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, children }) {
  return (
    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--brown)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        width: 28, height: 28, background: 'linear-gradient(135deg,var(--saffron),var(--saffron-dark))',
        borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14,
      }}>{icon}</span>
      {children}
    </h3>
  );
}

export default function PanchangPage() {
  const [apiKey,       setApiKey]       = useState(() => localStorage.getItem('bm_claude_key') || '');
  const [showKey,      setShowKey]      = useState(false);
  const [selected,     setSelected]     = useState(null);
  const [date,         setDate]         = useState(TODAY);
  const [rashi,        setRashi]        = useState('');
  const [name,         setName]         = useState('');
  const [city,         setCity]         = useState('');
  const [loading,      setLoading]      = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [result,       setResult]       = useState(null);
  const [dailyResult,  setDailyResult]  = useState(null);
  const [error,        setError]        = useState(null);

  const saveKey = () => { localStorage.setItem('bm_claude_key', apiKey); setShowKey(false); };
  const selectedType = MUHURAT_TYPES.find(m => m.id === selected);

  const getFullDate = (d) => {
    const obj = new Date(d);
    return {
      full: obj.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      day:  obj.toLocaleDateString('en-IN', { weekday: 'long' }),
    };
  };

  // ── Daily Panchang ──────────────────────────────────────────────────────────
  const fetchDailyPanchang = async () => {
    if (!apiKey.trim()) { setShowKey(true); return; }
    setDailyLoading(true); setDailyResult(null); setError(null);
    const { full, day } = getFullDate(date);

    const prompt = `You are a learned Vedic pandit expert in Hindu Panchang calculations.
Provide the complete Panchang for: ${full} (${day}), City: ${city || 'India (general)'}

Return ONLY valid JSON, no markdown, no explanation, start directly with {:
{
  "tithi": { "name": "", "number": "", "deity": "", "nature": "" },
  "nakshatra": { "name": "", "hindi": "", "lord": "", "quality": "" },
  "yoga": { "name": "", "nature": "auspicious/inauspicious", "meaning": "" },
  "karana": { "name": "", "nature": "" },
  "var": { "day": "", "lord": "", "color": "", "good_for": "" },
  "rahu_kaal": { "time": "" },
  "brahma_muhurat": { "time": "", "benefit": "" },
  "abhijit_muhurat": { "time": "", "benefit": "" },
  "choghadiya": [
    { "time": "", "name": "", "nature": "good/bad/neutral", "good_for": "" }
  ],
  "overall_day": "excellent/good/average/inauspicious",
  "pandit_blessings": "A warm Sanskrit-flavoured blessing sentence for the day",
  "do_today": ["action 1", "action 2", "action 3"],
  "avoid_today": ["thing 1", "thing 2", "thing 3"]
}`;

    try {
      const raw = await askClaude(apiKey, prompt);
      setDailyResult(JSON.parse(raw.replace(/```json|```/g, '').trim()));
    } catch (e) {
      setError('Could not load Panchang: ' + e.message);
    } finally {
      setDailyLoading(false);
    }
  };

  // ── Muhurat Finder ──────────────────────────────────────────────────────────
  const findMuhurat = async () => {
    if (!selected) { setError('Please select a Muhurat type first.'); return; }
    if (!apiKey.trim()) { setShowKey(true); return; }
    setLoading(true); setResult(null); setError(null);
    const { full, day } = getFullDate(date);

    const prompt = `You are a highly learned Vedic pandit — expert in Muhurat Shastra and Jyotish. A devotee seeks your guidance.

QUERY:
- Muhurat for: ${selectedType?.label} (${selectedType?.hindi})
- Date: ${full} (${day})
- Person's name: ${name || 'Not provided'}
- Rashi (Moon sign): ${rashi || 'Not provided'}
- City: ${city || 'India (general)'}

Analyse the tithi, nakshatra, yoga, var and planetary positions. Give a warm, authoritative pandit-style response.

Return ONLY valid JSON, no markdown, start directly with {:
{
  "verdict": "excellent/good/average/avoid",
  "verdict_reason": "One clear sentence why",
  "pandit_message": "Warm, wise 3-4 sentence message to the devotee as a real pandit would speak",
  "auspicious_timings": [
    { "time": "07:15 AM - 09:00 AM", "quality": "Shreshtha (Best)", "reason": "" }
  ],
  "timings_to_avoid": [
    { "time": "", "reason": "" }
  ],
  "tithi_today": { "name": "", "is_auspicious_for_this_muhurat": true, "reason": "" },
  "nakshatra_today": { "name": "", "is_auspicious_for_this_muhurat": true, "reason": "" },
  "rituals_recommended": ["ritual 1", "ritual 2", "ritual 3"],
  "mantras": [
    { "deity": "", "mantra": "", "chant_times": 108, "purpose": "" }
  ],
  "special_notes": ["note 1", "note 2"],
  "alternative_dates": [
    { "date": "", "quality": "Excellent/Good", "reason": "" }
  ]
}`;

    try {
      const raw = await askClaude(apiKey, prompt);
      setResult(JSON.parse(raw.replace(/```json|```/g, '').trim()));
    } catch (e) {
      setError('Could not get Muhurat: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '11px 14px', border: '2px solid var(--cream-dark)',
    borderRadius: 'var(--radius)', fontFamily: 'var(--font-body)', fontSize: 14, outline: 'none',
    transition: 'var(--transition)',
  };
  const labelStyle = {
    fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.08em',
    color: 'var(--text-light)', display: 'block', marginBottom: 6,
  };

  return (
    <>
      <Navbar />
      <div style={{ background: 'var(--cream)', minHeight: '100vh', paddingBottom: 80 }}>

        {/* ── Hero ── */}
        <div style={{
          background: 'linear-gradient(135deg,#1a0a00 0%,#3D1F00 50%,#6B3A10 100%)',
          padding: '52px 24px 44px', textAlign: 'center', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-hindi)', fontSize: 280, color: 'rgba(240,192,64,0.04)',
            pointerEvents: 'none', letterSpacing: 8,
          }}>ॐ</div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(240,192,64,0.12)', border: '1px solid rgba(240,192,64,0.3)',
              borderRadius: 50, padding: '6px 20px', marginBottom: 16,
              color: '#F0C040', fontFamily: 'var(--font-hindi)', fontSize: 13, letterSpacing: '.1em',
            }}>
              <Sun size={13} /> पंचांग एवं मुहूर्त
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900, color: 'white',
              fontSize: 'clamp(26px,5vw,50px)', marginBottom: 10,
            }}>
              AI <span style={{ color: 'var(--gold-light)' }}>Pandit Ji</span> — Panchang & Muhurat
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>
              Your personal digital Pandit — auspicious timings for every occasion, powered by Claude AI with deep Vedic knowledge
            </p>
          </div>
        </div>

        <div className="container" style={{ maxWidth: 960, paddingTop: 36 }}>

          {/* ── API Key Banner ── */}
          <div style={{
            background: 'white', borderRadius: 'var(--radius-lg)', padding: '14px 20px',
            border: `2px solid ${apiKey ? 'rgba(34,197,94,0.3)' : 'rgba(234,179,8,0.4)'}`,
            marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Key size={15} color={apiKey ? '#16a34a' : 'var(--gold)'} />
              <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>
                {apiKey
                  ? '✅ Claude API key saved — Pandit Ji is ready to guide you!'
                  : '⚠️ Add your Anthropic API key to activate Pandit Ji'}
              </span>
            </div>
            <button className="btn-outline" style={{ fontSize: 12, padding: '6px 16px' }} onClick={() => setShowKey(v => !v)}>
              {apiKey ? '🔑 Change Key' : '🔑 Add Key'}
            </button>
          </div>

          {showKey && (
            <div style={{
              background: 'white', borderRadius: 'var(--radius)', padding: '18px 20px',
              border: '2px solid var(--saffron)', marginBottom: 20, boxShadow: '0 4px 16px rgba(232,101,10,0.1)',
            }}>
              <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 10 }}>
                🔒 Stored in your browser only · Get key at{' '}
                <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{ color: 'var(--saffron)' }}>
                  console.anthropic.com
                </a>
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-ant-..." onKeyDown={e => e.key === 'Enter' && saveKey()}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button className="btn-primary" style={{ padding: '10px 22px' }} onClick={saveKey}>Save</button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              SECTION 1 — Daily Panchang
          ════════════════════════════════════════════════════════ */}
          <Card>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--brown)', marginBottom: 4 }}>
              📅 Aaj Ka Panchang
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 22 }}>
              Full daily overview — Tithi, Nakshatra, Yoga, Rahu Kaal and Choghadiya
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>DATE</label>
                <input type="date" value={date}
                  onChange={e => { setDate(e.target.value); setResult(null); setDailyResult(null); }}
                  style={{ ...inputStyle, width: 180, background: 'var(--cream)' }}
                />
              </div>
              <div>
                <label style={labelStyle}>CITY (optional)</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)}
                  placeholder="e.g. Ujjain, Mumbai…"
                  style={{ ...inputStyle, width: 210 }}
                  onFocus={e => e.target.style.borderColor = 'var(--saffron)'}
                  onBlur={e => e.target.style.borderColor = 'var(--cream-dark)'}
                />
              </div>
              <button className="btn-primary" onClick={fetchDailyPanchang} disabled={dailyLoading}
                style={{ padding: '12px 24px', borderRadius: 'var(--radius)' }}>
                {dailyLoading
                  ? <><Loader2 size={15} style={{ animation: 'spin .8s linear infinite' }} /> Loading…</>
                  : <><Calendar size={15} /> Get Today's Panchang</>}
              </button>
            </div>

            {/* ── Daily Result ── */}
            {dailyResult && (
              <div style={{ animation: 'fadeDown .5s ease both' }}>

                {/* Overall Day Banner */}
                <div style={{
                  background: VERDICT_BG[dailyResult.overall_day] || '#fffbeb',
                  borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 20,
                  border: `1px solid ${VERDICT_COLOR[dailyResult.overall_day] || '#d97706'}40`,
                  display: 'flex', alignItems: 'center', gap: 14,
                }}>
                  <span style={{ fontSize: 36 }}>{VERDICT_ICON[dailyResult.overall_day] || '🌤️'}</span>
                  <div>
                    <p style={{
                      fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
                      color: VERDICT_COLOR[dailyResult.overall_day] || '#d97706', fontWeight: 700, marginBottom: 4,
                    }}>{dailyResult.overall_day} Day</p>
                    <p style={{ fontSize: 15, color: 'var(--text-mid)', fontFamily: 'var(--font-hindi)' }}>
                      {dailyResult.pandit_blessings}
                    </p>
                  </div>
                </div>

                {/* 5 Angas — RESPONSIVE CLASS ADDED */}
                <div
                  className="panchang-angas"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 18 }}
                >
                  {[
                    { label: 'Tithi',    icon: '🌙', val: dailyResult.tithi?.name,      sub: dailyResult.tithi?.nature },
                    { label: 'Nakshatra',icon: '⭐', val: dailyResult.nakshatra?.name,  sub: dailyResult.nakshatra?.lord },
                    { label: 'Yoga',     icon: '🔗', val: dailyResult.yoga?.name,       sub: dailyResult.yoga?.nature },
                    { label: 'Karana',   icon: '⚡', val: dailyResult.karana?.name,     sub: dailyResult.karana?.nature },
                    { label: 'Var',      icon: '☀️', val: dailyResult.var?.day,         sub: `Lord: ${dailyResult.var?.lord}` },
                  ].map(a => (
                    <div key={a.label} style={{
                      background: 'var(--cream)', borderRadius: 'var(--radius)', padding: '12px 8px',
                      textAlign: 'center', border: '1px solid var(--cream-dark)',
                    }}>
                      <span style={{ fontSize: 20 }}>{a.icon}</span>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--text-light)', letterSpacing: '.07em', marginTop: 4 }}>{a.label}</p>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--brown)', fontWeight: 700, marginTop: 2 }}>{a.val}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>{a.sub}</p>
                    </div>
                  ))}
                </div>

                {/* 3 key timings — RESPONSIVE CLASS ADDED */}
                <div
                  className="panchang-timings"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 18 }}
                >
                  {[
                    { label: '🌅 BRAHMA MUHURAT', time: dailyResult.brahma_muhurat?.time, note: dailyResult.brahma_muhurat?.benefit, bg: '#f0fdf4', border: '#86efac', color: '#15803d', labelColor: '#16a34a' },
                    { label: '☀️ ABHIJIT MUHURAT', time: dailyResult.abhijit_muhurat?.time, note: dailyResult.abhijit_muhurat?.benefit, bg: '#f0f9ff', border: '#7dd3fc', color: '#075985', labelColor: '#0369a1' },
                    { label: '🚫 RAHU KAAL',      time: dailyResult.rahu_kaal?.time,       note: 'Avoid all auspicious work',          bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c', labelColor: '#dc2626' },
                  ].map(t => (
                    <div key={t.label} style={{ background: t.bg, borderRadius: 'var(--radius)', padding: '14px 16px', border: `1px solid ${t.border}` }}>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: t.labelColor, letterSpacing: '.07em', marginBottom: 4 }}>{t.label}</p>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: t.color, fontWeight: 700 }}>{t.time}</p>
                      <p style={{ fontSize: 11, color: t.labelColor, marginTop: 4 }}>{t.note}</p>
                    </div>
                  ))}
                </div>

                {/* Choghadiya */}
                {dailyResult.choghadiya?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--brown)', marginBottom: 10, letterSpacing: '.05em' }}>
                      🕐 CHOGHADIYA
                    </p>
                    <div className="panchang-choghadiya" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {dailyResult.choghadiya.map((c, i) => (
                        <div key={i} style={{
                          padding: '8px 14px', borderRadius: 8,
                          background: c.nature === 'good' ? '#f0fdf4' : c.nature === 'bad' ? '#fef2f2' : '#f8fafc',
                          border: `1px solid ${c.nature === 'good' ? '#86efac' : c.nature === 'bad' ? '#fca5a5' : '#e2e8f0'}`,
                        }}>
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: c.nature === 'good' ? '#16a34a' : c.nature === 'bad' ? '#dc2626' : '#64748b' }}>{c.name}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-light)' }}>{c.time}</p>
                          <p style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 2 }}>{c.good_for}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Do / Avoid — RESPONSIVE CLASS ADDED */}
                <div
                  className="panchang-do-avoid"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
                >
                  {[
                    { title: '✅ DO TODAY', items: dailyResult.do_today, bg: '#f0fdf4', border: '#86efac', color: '#15803d', hdr: '#16a34a' },
                    { title: '🚫 AVOID TODAY', items: dailyResult.avoid_today, bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c', hdr: '#dc2626' },
                  ].map(s => (
                    <div key={s.title} style={{ background: s.bg, borderRadius: 'var(--radius)', padding: '14px 16px', border: `1px solid ${s.border}` }}>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: s.hdr, marginBottom: 8, letterSpacing: '.05em' }}>{s.title}</p>
                      {(s.items || []).map((d, i) => (
                        <p key={i} style={{ fontSize: 13, color: s.color, marginBottom: 5, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <span style={{ flexShrink: 0 }}>•</span><span>{d}</span>
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* ════════════════════════════════════════════════════════
              SECTION 2 — Muhurat Finder
          ════════════════════════════════════════════════════════ */}
          <Card>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--brown)', marginBottom: 4 }}>
              🙏 Muhurat Finder — Shubh Samay
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 24 }}>
              Select your occasion — Pandit Ji will find the most auspicious time
            </p>

            {/* Occasion Grid — RESPONSIVE CLASS ADDED */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>SELECT YOUR OCCASION</label>
              <div
                className="muhurat-occasion-grid"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))', gap: 10 }}
              >
                {MUHURAT_TYPES.map(m => (
                  <button key={m.id} onClick={() => setSelected(m.id)} style={{
                    padding: '14px 10px', borderRadius: 'var(--radius)',
                    border: `2px solid ${selected === m.id ? 'var(--saffron)' : 'var(--cream-dark)'}`,
                    background: selected === m.id ? 'rgba(232,101,10,0.07)' : 'white',
                    cursor: 'pointer', textAlign: 'center', transition: 'var(--transition)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{ fontSize: 26 }}>{m.emoji}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: selected === m.id ? 'var(--saffron-dark)' : 'var(--brown)', fontWeight: 700 }}>{m.label}</span>
                    <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 11, color: 'var(--text-light)' }}>{m.hindi}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-light)', lineHeight: 1.3 }}>{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Personal Details — RESPONSIVE CLASS ADDED */}
            <div
              className="muhurat-form-grid"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 22 }}
            >
              <div>
                <label style={labelStyle}>DATE FOR MUHURAT</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ ...inputStyle, background: 'var(--cream)' }}
                />
              </div>
              <div>
                <label style={labelStyle}>YOUR NAME (optional)</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--saffron)'}
                  onBlur={e => e.target.style.borderColor = 'var(--cream-dark)'}
                />
              </div>
              <div>
                <label style={labelStyle}>YOUR RASHI (optional)</label>
                <select value={rashi} onChange={e => setRashi(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer', background: 'white' }}>
                  <option value="">Select Rashi…</option>
                  {RASHI_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>CITY (optional)</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)}
                  placeholder="e.g. Varanasi…" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--saffron)'}
                  onBlur={e => e.target.style.borderColor = 'var(--cream-dark)'}
                />
              </div>
            </div>

            <button className="btn-primary" onClick={findMuhurat} disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: 15, borderRadius: 'var(--radius)', gap: 10 }}>
              {loading
                ? <><Loader2 size={18} style={{ animation: 'spin .8s linear infinite' }} /> Pandit Ji is consulting the Panchang…</>
                : <><Sparkles size={18} /> Ask Pandit Ji for Muhurat</>}
            </button>
          </Card>

          {/* Error */}
          {error && (
            <div style={{ background: '#FFF4F4', border: '1px solid #FFCDD2', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 10 }}>
              <AlertCircle size={18} color="#D32F2F" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ color: '#C62828', fontSize: 14 }}>{error}</p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 56, marginBottom: 16, animation: 'pulse-om 2s ease-in-out infinite' }}>🛕</div>
              <p style={{ fontFamily: 'var(--font-hindi)', color: 'var(--text-light)', fontSize: 17 }}>
                Pandit Ji is consulting the Panchang…
              </p>
              <p style={{ color: 'var(--text-light)', fontSize: 13, marginTop: 6 }}>
                Checking tithi, nakshatra, yoga and planetary positions for {selectedType?.label}
              </p>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              Muhurat Results
          ════════════════════════════════════════════════════════ */}
          {result && !loading && (
            <div style={{ animation: 'fadeDown .6s ease both' }}>

              {/* Verdict Banner */}
              <div style={{
                background: VERDICT_BG[result.verdict] || '#fffbeb',
                border: `2px solid ${VERDICT_COLOR[result.verdict] || '#d97706'}40`,
                borderRadius: 'var(--radius-lg)', padding: '24px 28px', marginBottom: 24,
                display: 'flex', alignItems: 'flex-start', gap: 18,
              }}>
                <span style={{ fontSize: 52 }}>{VERDICT_ICON[result.verdict] || '🌤️'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase',
                      color: 'white', background: VERDICT_COLOR[result.verdict] || '#d97706',
                      padding: '3px 14px', borderRadius: 50,
                    }}>{result.verdict}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--brown)', fontWeight: 700 }}>
                      {selectedType?.label} Muhurat
                    </span>
                  </div>
                  <p style={{ fontSize: 15, color: VERDICT_COLOR[result.verdict] || '#d97706', marginBottom: 10, fontWeight: 600 }}>
                    {result.verdict_reason}
                  </p>
                  <p style={{ fontSize: 16, color: 'var(--text-mid)', lineHeight: 1.75, fontStyle: 'italic' }}>
                    "{result.pandit_message}"
                  </p>
                </div>
              </div>

              {/* Main + Sidebar — RESPONSIVE CLASS ADDED */}
              <div
                className="muhurat-results-grid"
                style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 22, alignItems: 'start' }}
              >

                {/* LEFT col */}
                <div>

                  {/* Auspicious Timings */}
                  <Card accent="rgba(34,197,94,0.3)">
                    <SectionTitle icon={<Clock size={14} color="white" />}>Shubh Muhurat Timings</SectionTitle>
                    {(result.auspicious_timings || []).map((t, i) => (
                      <div key={i} style={{
                        background: '#f0fdf4', borderRadius: 'var(--radius)', padding: '14px 18px',
                        border: '1px solid #86efac', marginBottom: 10,
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12,
                      }}>
                        <div>
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: '#15803d', fontWeight: 700 }}>{t.time}</p>
                          <p style={{ fontSize: 13, color: '#16a34a', marginTop: 4 }}>{t.reason}</p>
                        </div>
                        <span style={{
                          background: '#16a34a', color: 'white', borderRadius: 50, padding: '3px 12px',
                          fontSize: 11, fontFamily: 'var(--font-display)', flexShrink: 0,
                        }}>{t.quality}</span>
                      </div>
                    ))}
                  </Card>

                  {/* Avoid */}
                  {result.timings_to_avoid?.length > 0 && (
                    <Card accent="rgba(220,38,38,0.25)">
                      <SectionTitle icon={<AlertCircle size={14} color="white" />}>Timings to Avoid</SectionTitle>
                      {result.timings_to_avoid.map((t, i) => (
                        <div key={i} style={{
                          background: '#fef2f2', borderRadius: 'var(--radius)', padding: '12px 16px',
                          border: '1px solid #fca5a5', marginBottom: 8,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                        }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: '#b91c1c', fontWeight: 700 }}>{t.time}</span>
                          <span style={{ fontSize: 13, color: '#dc2626' }}>{t.reason}</span>
                        </div>
                      ))}
                    </Card>
                  )}

                  {/* Rituals */}
                  {result.rituals_recommended?.length > 0 && (
                    <Card>
                      <SectionTitle icon={<Star size={14} color="white" />}>Recommended Rituals</SectionTitle>
                      {result.rituals_recommended.map((r, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                          <CheckCircle size={16} color="var(--saffron)" style={{ marginTop: 3, flexShrink: 0 }} />
                          <span style={{ fontSize: 15, color: 'var(--text-mid)', lineHeight: 1.6 }}>{r}</span>
                        </div>
                      ))}
                    </Card>
                  )}

                  {/* Mantras */}
                  {result.mantras?.length > 0 && (
                    <Card>
                      <SectionTitle icon="🕉️">Mantras to Chant</SectionTitle>
                      {result.mantras.map((m, i) => (
                        <div key={i} className="mantra-card" style={{ marginBottom: 12 }}>
                          <div className="mantra-title">{m.deity} · Chant {m.chant_times} times</div>
                          <div className="mantra-sanskrit">{m.mantra}</div>
                          <div className="mantra-meaning">{m.purpose}</div>
                        </div>
                      ))}
                    </Card>
                  )}
                </div>

                {/* RIGHT sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Planetary Check */}
                  <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--cream-dark)', padding: '20px', boxShadow: '0 2px 12px var(--shadow)' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--brown)', marginBottom: 14 }}>🔭 Planetary Check</h3>
                    {[
                      { label: 'Tithi',     data: result.tithi_today },
                      { label: 'Nakshatra', data: result.nakshatra_today },
                    ].map(item => item.data && (
                      <div key={item.label} style={{
                        background: item.data.is_auspicious_for_this_muhurat ? '#f0fdf4' : '#fef2f2',
                        borderRadius: 10, padding: '12px 14px', marginBottom: 10,
                        border: `1px solid ${item.data.is_auspicious_for_this_muhurat ? '#86efac' : '#fca5a5'}`,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--text-light)', letterSpacing: '.06em' }}>{item.label}</span>
                          <span style={{ fontSize: 11, color: item.data.is_auspicious_for_this_muhurat ? '#16a34a' : '#dc2626' }}>
                            {item.data.is_auspicious_for_this_muhurat ? '✅ Auspicious' : '⚠️ Caution'}
                          </span>
                        </div>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--brown)', fontWeight: 700 }}>{item.data.name}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-light)', marginTop: 4, lineHeight: 1.5 }}>{item.data.reason}</p>
                      </div>
                    ))}
                  </div>

                  {/* Alternative Dates */}
                  {result.alternative_dates?.length > 0 && (
                    <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--cream-dark)', padding: '20px', boxShadow: '0 2px 12px var(--shadow)' }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--brown)', marginBottom: 14 }}>📆 Alternative Dates</h3>
                      {result.alternative_dates.map((d, i) => (
                        <div key={i} style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 8, background: 'var(--cream)', border: '1px solid var(--cream-dark)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--brown)', fontWeight: 700 }}>{d.date}</span>
                            <span style={{ fontSize: 10, background: 'var(--saffron)', color: 'white', borderRadius: 50, padding: '2px 8px', fontFamily: 'var(--font-display)' }}>{d.quality}</span>
                          </div>
                          <p style={{ fontSize: 12, color: 'var(--text-light)' }}>{d.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Special Notes */}
                  {result.special_notes?.length > 0 && (
                    <div style={{
                      background: 'linear-gradient(135deg,rgba(200,150,12,0.08),rgba(232,101,10,0.05))',
                      borderRadius: 'var(--radius-lg)', border: '1px solid rgba(200,150,12,0.2)', padding: '20px',
                    }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--brown)', marginBottom: 12 }}>💡 Pandit Ji's Notes</h3>
                      {result.special_notes.map((n, i) => (
                        <p key={i} style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.6, marginBottom: 8, display: 'flex', gap: 8 }}>
                          <Star size={12} color="var(--gold)" style={{ marginTop: 5, flexShrink: 0 }} />
                          {n}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}