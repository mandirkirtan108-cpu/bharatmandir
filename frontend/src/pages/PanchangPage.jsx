import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, Star, Sparkles, AlertCircle, Loader2, Sun, CheckCircle } from 'lucide-react';
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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function to12h(timeStr) {
  if (!timeStr) return timeStr;
  if (/am|pm/i.test(timeStr)) return timeStr;
  return timeStr.replace(/(\d{1,2}):(\d{2})/g, (_, h, m) => {
    const hour = parseInt(h, 10);
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${suffix}`;
  });
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

// ── Temple-style timing strip — plain readable font ──────────────────────────
function TimingStrip({ items }) {
  return (
    <div style={{
      display: 'flex',
      borderRadius: 'var(--radius)',
      border: '1px solid var(--cream-dark)',
      overflow: 'hidden',
    }}>
      {items.map((item, i) => (
        <div key={i} style={{
          flex: 1,
          padding: '18px 16px',
          textAlign: 'center',
          background: item.bg || 'var(--cream)',
          borderRight: i < items.length - 1 ? '1px solid var(--cream-dark)' : 'none',
        }}>
          {/* Label — small caps, plain font */}
          <p style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            fontSize: 11,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: item.labelColor || 'var(--text-light)',
            marginBottom: 8,
            fontWeight: 600,
          }}>{item.label}</p>

          {/* Time — large, bold, plain system font — no cursive */}
          <p style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Inter", sans-serif',
            fontSize: 22,
            fontWeight: 700,
            color: item.color || 'var(--brown)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            whiteSpace: 'nowrap',
          }}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export default function PanchangPage() {
  const { t } = useTranslation();
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

  const selectedType = MUHURAT_TYPES.find(m => m.id === selected);

  const fetchDailyPanchang = async () => {
    setDailyLoading(true); setDailyResult(null); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/panchang/daily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, city: city || 'India' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to load Panchang');
      setDailyResult(data);
    } catch (e) {
      setError('Could not load Panchang: ' + e.message);
    } finally {
      setDailyLoading(false);
    }
  };

  const findMuhurat = async () => {
    if (!selected) { setError('Please select a Muhurat type first.'); return; }
    setLoading(true); setResult(null); setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/panchang/muhurat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          muhurat_type:  selected,
          muhurat_label: selectedType?.label || selected,
          muhurat_hindi: selectedType?.hindi || '',
          date, name: name || '', rashi: rashi || '', city: city || 'India',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to get Muhurat');
      setResult(data);
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
    color: 'var(--text-light)', display: 'block', marginBottom: 6, textTransform: 'uppercase',
  };

  return (
    <>
      <Navbar />
      <div style={{ background: 'var(--cream)', minHeight: '100vh', paddingBottom: 80 }}>

        {/* HERO */}
        <section style={{
          position: 'relative', overflow: 'hidden', color: 'white',
          background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
          padding: '88px 24px 96px', textAlign: 'center',
        }}>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 360, color: 'rgba(255,255,255,0.028)', fontFamily: 'var(--font-hindi)',
            pointerEvents: 'none', userSelect: 'none', lineHeight: 1,
          }}>ॐ</div>
          <div style={{
            position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
            width: 600, height: 300,
            background: 'radial-gradient(ellipse, rgba(232,101,10,0.28) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,213,128,0.3)',
              borderRadius: 50, padding: '6px 20px', marginBottom: 20,
              color: '#FFD580', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
              fontWeight: 500, backdropFilter: 'blur(8px)',
            }}>
              <Sun size={13} /> {t('panchang.badge')}
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(38px,6vw,72px)', lineHeight: 1.05, marginBottom: 18,
              textShadow: '0 4px 40px rgba(0,0,0,0.3)', color: '#FFD580',
            }}>
              AI <span style={{ color: '#FFD580' }}>Pandit Ji</span> — Panchang {t('panchang.title_span')}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 18, maxWidth: 540, margin: '0 auto', fontWeight: 300, lineHeight: 1.7 }}>
              {t('panchang.subtitle')}
            </p>
          </div>
        </section>

        <div className="container" style={{ maxWidth: 960, paddingTop: 36 }}>

          {/* SECTION 1 — Daily Panchang */}
          <Card>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--brown)', marginBottom: 4 }}>
              {t('panchang.today')}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 22 }}>
              Get today's Tithi, Nakshatra, auspicious timings &amp; Choghadiya
            </p>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={date}
                  onChange={e => { setDate(e.target.value); setResult(null); setDailyResult(null); }}
                  style={{ ...inputStyle, width: 180, background: 'var(--cream)' }}
                />
              </div>
              <div>
                <label style={labelStyle}>City</label>
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
                  : <><Calendar size={15} /> Today's Panchang</>}
              </button>
            </div>

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

                {/* 5 Angas */}
                <div className="panchang-angas"
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 18 }}>
                  {[
                    { label: 'Tithi',     icon: '🌙', val: dailyResult.tithi?.name,     sub: dailyResult.tithi?.nature },
                    { label: 'Nakshatra', icon: '⭐', val: dailyResult.nakshatra?.name, sub: dailyResult.nakshatra?.lord },
                    { label: 'Yoga',      icon: '🔗', val: dailyResult.yoga?.name,      sub: dailyResult.yoga?.nature },
                    { label: 'Karana',    icon: '⚡', val: dailyResult.karana?.name,    sub: dailyResult.karana?.nature },
                    { label: 'Var',       icon: '☀️', val: dailyResult.var?.day,        sub: `Lord: ${dailyResult.var?.lord}` },
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

                {/* ✅ 3 key timings — Updated TimingStrip with large readable text */}
                <div style={{ marginBottom: 18 }}>
                  <TimingStrip items={[
                    {
                      value: to12h(dailyResult.brahma_muhurat?.time) || '—',
                      label: '🌅 Brahma Muhurat',
                      color: '#15803d', labelColor: '#16a34a', bg: '#f0fdf4',
                    },
                    {
                      value: to12h(dailyResult.abhijit_muhurat?.time) || '—',
                      label: '☀️ Abhijit Muhurat',
                      color: '#075985', labelColor: '#0369a1', bg: '#f0f9ff',
                    },
                    {
                      value: to12h(dailyResult.rahu_kaal?.time) || '—',
                      label: '🚫 Rahu Kaal',
                      color: '#b91c1c', labelColor: '#dc2626', bg: '#fef2f2',
                    },
                  ]} />
                  {/* sub-notes row */}
                  <div style={{ display: 'flex', gap: 0, marginTop: 0 }}>
                    {[
                      { note: dailyResult.brahma_muhurat?.benefit, color: '#16a34a' },
                      { note: dailyResult.abhijit_muhurat?.benefit, color: '#0369a1' },
                      { note: 'Avoid all auspicious work', color: '#dc2626' },
                    ].map((n, i) => (
                      <div key={i} style={{
                        flex: 1, padding: '6px 12px 10px',
                        fontSize: 11, color: n.color, textAlign: 'center', lineHeight: 1.4,
                        borderLeft: i > 0 ? '1px solid var(--cream-dark)' : 'none',
                        borderBottom: '1px solid var(--cream-dark)',
                        borderRight: i === 2 ? '1px solid var(--cream-dark)' : 'none',
                        background: i === 0 ? '#f0fdf4' : i === 1 ? '#f0f9ff' : '#fef2f2',
                        borderBottomLeftRadius: i === 0 ? 'var(--radius)' : 0,
                        borderBottomRightRadius: i === 2 ? 'var(--radius)' : 0,
                      }}>{n.note}</div>
                    ))}
                  </div>
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
                          <p style={{ fontSize: 11, color: 'var(--text-light)', whiteSpace: 'nowrap' }}>{to12h(c.time)}</p>
                          <p style={{ fontSize: 10, color: 'var(--text-light)', marginTop: 2 }}>{c.good_for}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Do / Avoid */}
                <div className="panchang-do-avoid"
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { title: '✅ DO TODAY',    items: dailyResult.do_today,    bg: '#f0fdf4', border: '#86efac', color: '#15803d', hdr: '#16a34a' },
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

          {/* SECTION 2 — Muhurat Finder */}
          <Card>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--brown)', marginBottom: 4 }}>
              Muhurat Finder
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 24 }}>
              Find the most auspicious time for your important occasion
            </p>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Select Occasion</label>
              <div className="muhurat-occasion-grid"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))', gap: 10 }}>
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

            <div className="muhurat-form-grid"
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 22 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ ...inputStyle, background: 'var(--cream)' }} />
              </div>
              <div>
                <label style={labelStyle}>Your Name (optional)</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--saffron)'}
                  onBlur={e => e.target.style.borderColor = 'var(--cream-dark)'} />
              </div>
              <div>
                <label style={labelStyle}>Rashi (Moon Sign)</label>
                <select value={rashi} onChange={e => setRashi(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer', background: 'white' }}>
                  <option value="">Select your Rashi…</option>
                  {RASHI_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>City</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)}
                  placeholder="e.g. Varanasi…" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--saffron)'}
                  onBlur={e => e.target.style.borderColor = 'var(--cream-dark)'} />
              </div>
            </div>

            <button className="btn-primary" onClick={findMuhurat} disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: 15, borderRadius: 'var(--radius)', gap: 10 }}>
              {loading
                ? <><Loader2 size={18} style={{ animation: 'spin .8s linear infinite' }} /> Finding Muhurat…</>
                : <><Sparkles size={18} /> Find Auspicious Muhurat</>}
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
              <p style={{ fontFamily: 'var(--font-hindi)', color: 'var(--text-light)', fontSize: 17 }}>Consulting the stars…</p>
              <p style={{ color: 'var(--text-light)', fontSize: 13, marginTop: 6 }}>Calculating auspicious timings based on Vedic astrology</p>
            </div>
          )}

          {/* Muhurat Results */}
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

              {/* Main + Sidebar */}
              <div className="muhurat-results-grid"
                style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 22, alignItems: 'start' }}>

                {/* LEFT col */}
                <div>

                  {/* ✅ Auspicious Timings — Temple strip style */}
                  <Card accent="rgba(34,197,94,0.3)">
                    <SectionTitle icon={<Clock size={14} color="white" />}>Shubh Muhurat Timings</SectionTitle>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {(result.auspicious_timings || []).map((timing, i) => (
                        <div key={i} style={{
                          borderRadius: 'var(--radius)',
                          border: '1px solid #86efac',
                          overflow: 'hidden',
                          background: '#f0fdf4',
                        }}>
                          {/* Top row: time strip */}
                          <div style={{
                            display: 'flex',
                            borderBottom: '1px solid #86efac',
                          }}>
                            {/* Time cell */}
                            <div style={{
                              flex: 1,
                              padding: '12px 16px',
                              borderRight: '1px solid #86efac',
                            }}>
                              <p style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: 16,
                                fontWeight: 700,
                                color: '#15803d',
                                whiteSpace: 'nowrap',
                                marginBottom: 2,
                              }}>{to12h(timing.time)}</p>
                              <p style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: 9,
                                letterSpacing: '.08em',
                                textTransform: 'uppercase',
                                color: '#16a34a',
                              }}>Shubh Timing</p>
                            </div>
                            {/* Quality badge cell */}
                            <div style={{
                              padding: '12px 20px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#dcfce7',
                            }}>
                              <p style={{
                                fontFamily: 'var(--font-display)',
                                fontSize: 13,
                                fontWeight: 700,
                                color: '#15803d',
                                whiteSpace: 'nowrap',
                                marginBottom: 2,
                                textAlign: 'center',
                              }}>{timing.quality}</p>
                            </div>
                          </div>
                          {/* Reason row */}
                          <div style={{ padding: '10px 16px' }}>
                            <p style={{ fontSize: 13, color: '#16a34a', lineHeight: 1.5 }}>{timing.reason}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>

                  {/* ✅ Inauspicious Timings — Temple strip style */}
                  {result.timings_to_avoid?.length > 0 && (
                    <Card accent="rgba(220,38,38,0.25)">
                      <SectionTitle icon={<AlertCircle size={14} color="white" />}>Inauspicious Timings to Avoid</SectionTitle>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {result.timings_to_avoid.map((timing, i) => (
                          <div key={i} style={{
                            borderRadius: 'var(--radius)',
                            border: '1px solid #fca5a5',
                            overflow: 'hidden',
                            background: '#fef2f2',
                          }}>
                            <div style={{
                              display: 'flex',
                              borderBottom: '1px solid #fca5a5',
                            }}>
                              {/* Time cell */}
                              <div style={{ padding: '10px 16px', borderRight: '1px solid #fca5a5' }}>
                                <p style={{
                                  fontFamily: 'var(--font-display)',
                                  fontSize: 15,
                                  fontWeight: 700,
                                  color: '#b91c1c',
                                  whiteSpace: 'nowrap',
                                  marginBottom: 2,
                                }}>{to12h(timing.time)}</p>
                                <p style={{
                                  fontFamily: 'var(--font-display)',
                                  fontSize: 9,
                                  letterSpacing: '.08em',
                                  textTransform: 'uppercase',
                                  color: '#dc2626',
                                }}>Avoid</p>
                              </div>
                              {/* Reason cell */}
                              <div style={{ flex: 1, padding: '10px 16px', display: 'flex', alignItems: 'center' }}>
                                <p style={{ fontSize: 13, color: '#dc2626', lineHeight: 1.4 }}>{timing.reason}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {/* Rituals */}
                  {result.rituals_recommended?.length > 0 && (
                    <Card>
                      <SectionTitle icon={<Star size={14} color="white" />}>Recommended Rituals</SectionTitle>
                      {result.rituals_recommended.map((ritual, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                          <CheckCircle size={16} color="var(--saffron)" style={{ marginTop: 3, flexShrink: 0 }} />
                          <span style={{ fontSize: 15, color: 'var(--text-mid)', lineHeight: 1.6 }}>{ritual}</span>
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

      <style>{`
        @keyframes spin        { to { transform: rotate(360deg); } }
        @keyframes fadeDown    { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-om    { 0%,100% { transform: scale(1); opacity: .7; } 50% { transform: scale(1.04); opacity: 1; } }
        @media (max-width: 720px) {
          .panchang-angas        { grid-template-columns: repeat(3,1fr) !important; }
          .panchang-timings      { grid-template-columns: 1fr !important; }
          .panchang-do-avoid     { grid-template-columns: 1fr !important; }
          .muhurat-form-grid     { grid-template-columns: 1fr 1fr !important; }
          .muhurat-results-grid  { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .panchang-angas        { grid-template-columns: repeat(2,1fr) !important; }
          .muhurat-form-grid     { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Footer />
    </>
  );
}