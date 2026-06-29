import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, Clock, Star, Sparkles, AlertCircle, Loader2, Sun, CheckCircle, XCircle, MinusCircle, ChevronRight } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PanchangCalendar from '../components/PanchangCalendar';

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

const VERDICT_COLOR = { excellent: '#16a34a', good: '#2563eb', average: '#d97706', avoid: '#dc2626', 'not recommended': '#dc2626' };
const VERDICT_BG    = { excellent: '#f0fdf4', good: '#eff6ff', average: '#fffbeb', avoid: '#fef2f2', 'not recommended': '#fef2f2' };
const VERDICT_ICON  = { excellent: '🌟', good: '✅', average: '⚡', avoid: '❌', 'not recommended': '❌' };

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const DEFAULT_COORDINATES = '28.6139,77.2090';

function apiErrorMessage(data, fallback) {
  if (!data?.detail) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  return data.detail.message || fallback;
}

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

/* ── Shared styles ───────────────────────────────────────────────── */
const UI_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Roboto", sans-serif';

function Card({ children, accent, style = {} }) {
  return (
    <div style={{
      background: 'white',
      borderRadius: 'var(--radius-lg)',
      padding: '24px 26px',
      border: `1px solid ${accent || 'var(--cream-dark)'}`,
      boxShadow: '0 2px 16px var(--shadow)',
      marginBottom: 20,
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, children }) {
  return (
    <h3 style={{
      fontFamily: 'var(--font-display)',
      fontSize: 15,
      color: 'var(--brown)',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
    }}>
      <span style={{
        width: 28, height: 28,
        background: 'linear-gradient(135deg,var(--saffron),var(--saffron-dark))',
        borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, fontSize: 14,
      }}>{icon}</span>
      {children}
    </h3>
  );
}

/* ── Compatibility row item ────────────────────────────────────────── */
function CompatibilityRow({ label, value, status }) {
  // status: 'good' | 'bad' | 'neutral'
  const iconColor = status === 'good' ? '#16a34a' : status === 'bad' ? '#dc2626' : '#d97706';
  const bgColor   = status === 'good' ? '#f0fdf4' : status === 'bad' ? '#fef2f2' : '#fffbeb';
  const borderColor = status === 'good' ? '#bbf7d0' : status === 'bad' ? '#fecaca' : '#fde68a';

  const Icon = status === 'good' ? CheckCircle : status === 'bad' ? XCircle : MinusCircle;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: bgColor, border: `1px solid ${borderColor}`,
      borderRadius: 10, padding: '10px 14px', marginBottom: 8,
    }}>
      <div>
        <p style={{ fontFamily: UI_FONT, fontSize: 10, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#9A7150', marginBottom: 2 }}>{label}</p>
        <p style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#3D1F00' }}>{value || '—'}</p>
      </div>
      <Icon size={20} color={iconColor} strokeWidth={2.5} />
    </div>
  );
}

/* ── Named timing window row ───────────────────────────────────────── */
function TimingWindowRow({ name, subtitle, timeRange, quality, qualityColor, qualityBg }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px',
      borderBottom: '1px solid #f0e4d2',
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#3D1F00', marginBottom: 2 }}>{name}</p>
        {subtitle && <p style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150' }}>{subtitle}</p>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {quality && (
          <span style={{
            fontFamily: UI_FONT, fontSize: 11, fontWeight: 700,
            color: qualityColor || '#16a34a',
            background: qualityBg || '#f0fdf4',
            borderRadius: 50, padding: '3px 10px',
            border: `1px solid ${qualityColor || '#16a34a'}40`,
            whiteSpace: 'nowrap',
          }}>{quality}</span>
        )}
        <p style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#16a34a', whiteSpace: 'nowrap' }}>{timeRange}</p>
      </div>
    </div>
  );
}

/* ── 3-column timing strip ────────────────────────────────────────── */
function TimingStrip({ items }) {
  return (
    <div style={{ display: 'flex', borderRadius: 'var(--radius)', border: '1px solid var(--cream-dark)', overflow: 'hidden' }}>
      {items.map((item, i) => (
        <div key={i} style={{
          flex: 1, padding: '18px 16px', textAlign: 'center',
          background: item.bg || 'var(--cream)',
          borderRight: i < items.length - 1 ? '1px solid var(--cream-dark)' : 'none',
        }}>
          <p style={{
            fontFamily: UI_FONT,
            fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase',
            color: item.labelColor || 'var(--text-light)', marginBottom: 8, fontWeight: 600,
          }}>{item.label}</p>
          <p style={{
            fontFamily: UI_FONT,
            fontSize: 22, fontWeight: 700, color: item.color || 'var(--brown)',
            lineHeight: 1.1, letterSpacing: '-0.02em', whiteSpace: 'nowrap',
          }}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Loading skeleton ─────────────────────────────────────────────── */
function LoadingState({ message = 'Consulting the stars…' }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 52, marginBottom: 16, animation: 'pulse-om 2s ease-in-out infinite' }}>🛕</div>
      <p style={{ fontFamily: 'var(--font-hindi)', color: 'var(--text-light)', fontSize: 17 }}>{message}</p>
      <p style={{ color: 'var(--text-light)', fontSize: 13, marginTop: 6 }}>
        Calculating auspicious timings based on Vedic astrology
      </p>
    </div>
  );
}

/* ── Verdict alert banner (NOT RECOMMENDED / EXCELLENT etc.) ──────── */
function VerdictBanner({ result, selectedType }) {
  const verdict = (result.verdict || '').toLowerCase();
  const isNegative = verdict === 'avoid' || verdict === 'not recommended';

  const bannerBg     = isNegative ? '#fef2f2' : verdict === 'excellent' ? '#f0fdf4' : verdict === 'good' ? '#eff6ff' : '#fffbeb';
  const bannerBorder = isNegative ? '#fca5a5' : verdict === 'excellent' ? '#86efac' : verdict === 'good' ? '#93c5fd' : '#fde68a';
  const badgeColor   = isNegative ? '#dc2626' : verdict === 'excellent' ? '#16a34a' : verdict === 'good' ? '#2563eb' : '#d97706';
  const textColor    = isNegative ? '#b91c1c' : verdict === 'excellent' ? '#15803d' : verdict === 'good' ? '#1d4ed8' : '#92400e';

  return (
    <div style={{
      background: bannerBg,
      border: `1.5px solid ${bannerBorder}`,
      borderRadius: 14,
      padding: '20px 22px',
      marginBottom: 20,
    }}>
      {/* Badge + title row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <AlertCircle size={22} color={badgeColor} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
            <span style={{
              fontFamily: UI_FONT, fontSize: 11, fontWeight: 800, letterSpacing: '.09em',
              textTransform: 'uppercase', color: 'white', background: badgeColor,
              padding: '3px 12px', borderRadius: 50,
            }}>{result.verdict}</span>
            <span style={{ fontFamily: UI_FONT, fontSize: 15, fontWeight: 700, color: '#3D1F00' }}>
              {selectedType?.label} on this date {isNegative ? 'is generally avoided' : 'is favourable'}
            </span>
          </div>

          {/* Reason detail */}
          <p style={{ fontFamily: UI_FONT, fontSize: 14, color: textColor, lineHeight: 1.65, marginBottom: result.next_favorable_date ? 10 : 0 }}>
            {result.verdict_reason}
          </p>

          {/* Next favourable date */}
          {result.next_favorable_date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontFamily: UI_FONT, fontSize: 13, color: '#3D1F00', fontWeight: 600 }}>
                Next favorable date:
              </span>
              <span style={{ fontFamily: UI_FONT, fontSize: 13, color: textColor }}>
                {result.next_favorable_date}
              </span>
              {result.next_favorable_detail && (
                <button style={{
                  fontFamily: UI_FONT, fontSize: 12, color: badgeColor, background: 'none',
                  border: 'none', cursor: 'pointer', padding: 0,
                  display: 'flex', alignItems: 'center', gap: 2, fontWeight: 600,
                }}>
                  Show details <ChevronRight size={13} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
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
      const trimmedCity = city.trim();
      const res = await fetch(`${API_BASE}/api/panchang/daily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          city: trimmedCity || 'India',
          coordinates: trimmedCity ? null : DEFAULT_COORDINATES,
          calendar: 'amanta',
          language: 'en',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to load Panchang'));
      setDailyResult(data);
    } catch (e) {
      setError('Could not load Panchang: ' + e.message);
    } finally {
      setDailyLoading(false);
    }
  };

  const findMuhurat = async () => {
    if (!selected) { setError('Please select an occasion first.'); return; }
    setLoading(true); setResult(null); setError(null);
    try {
      const trimmedCity = city.trim();
      const res = await fetch(`${API_BASE}/api/panchang/muhurat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          muhurat_type:  selected,
          muhurat_label: selectedType?.label || selected,
          muhurat_hindi: selectedType?.hindi || '',
          date,
          name: name || '',
          rashi: rashi || '',
          city: trimmedCity || 'India',
          coordinates: trimmedCity ? null : DEFAULT_COORDINATES,
          calendar: 'amanta',
          language: 'en',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to get Muhurat'));
      setResult(data);
    } catch (e) {
      setError('Could not get Muhurat: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  /* shared input / label styles */
  const inputStyle = {
    width: '100%', padding: '11px 14px',
    border: '2px solid var(--cream-dark)', borderRadius: 'var(--radius)',
    fontFamily: UI_FONT, fontSize: 14, outline: 'none',
    transition: 'var(--transition)', color: 'var(--text-dark)', background: 'white',
    boxSizing: 'border-box',
  };
  const labelStyle = {
    fontFamily: UI_FONT, fontWeight: 600,
    fontSize: 11, letterSpacing: '.07em', textTransform: 'uppercase',
    color: 'var(--text-light)', display: 'block', marginBottom: 6,
  };

  /* Helper: map timing quality string to color/bg */
  function qualityStyle(quality) {
    const q = (quality || '').toLowerCase();
    if (q.includes('best') || q.includes('excellent') || q.includes('brahma') || q.includes('abhijit'))
      return { color: '#16a34a', bg: '#f0fdf4' };
    if (q.includes('good') || q.includes('acceptable'))
      return { color: '#d97706', bg: '#fffbeb' };
    return { color: '#2563eb', bg: '#eff6ff' };
  }

  /* Helper: map panchang element status to 'good'|'bad'|'neutral' */
  function elementStatus(data) {
    if (!data) return 'neutral';
    if (data.is_auspicious_for_this_muhurat === true) return 'good';
    if (data.is_auspicious_for_this_muhurat === false) return 'bad';
    return 'neutral';
  }

  return (
    <>
      <Navbar />
      <div style={{ background: 'var(--cream)', minHeight: '100vh', paddingBottom: 80 }}>

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section style={{
          position: 'relative', overflow: 'hidden', color: 'white',
          background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
          padding: '50px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          <div style={{
            position: 'relative', zIndex: 1,
            width: '100%', maxWidth: 700,
            padding: '0 24px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,213,128,0.3)',
              borderRadius: 50, padding: '5px 16px', marginBottom: 14,
              color: 'rgba(255,213,128,0.85)', fontSize: 11, letterSpacing: '.1em',
              textTransform: 'uppercase', fontWeight: 500,
              backdropFilter: 'blur(8px)',
              whiteSpace: 'nowrap',
              fontFamily: UI_FONT,
            }}>
              <Sun size={11} /> {t('panchang.badge')}
            </div>

            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1,
              marginBottom: 10, marginTop: 0,
              textShadow: '0 4px 40px rgba(0,0,0,0.3)',
              color: '#ffffff',
              width: '100%',
            }}>
              AI Pandit Ji —{' '}
              <span style={{ color: '#FFD580' }}>Panchang &amp; Muhurat</span>
            </h1>

            <p style={{
              color: 'rgba(255,255,255,0.7)', fontSize: 14,
              width: '100%', maxWidth: 520,
              margin: '0 0 0 0',
              fontWeight: 300, lineHeight: 1.7,
              textAlign: 'center',
              fontFamily: UI_FONT,
            }}>
              {t('panchang.subtitle')}
            </p>
          </div>
        </section>

        {/* ── PANCHANG CALENDAR ───────────────────────────────────────── */}
        <PanchangCalendar />

        <div className="container" style={{ maxWidth: 960, paddingTop: 36 }}>

          {/* ── SECTION 1 — Daily Panchang ─────────────────────────────── */}
          <Card>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--brown)', marginBottom: 4 }}>
              {t('panchang.today')}
            </h2>
            <p style={{ fontFamily: UI_FONT, fontSize: 14, color: 'var(--text-light)', marginBottom: 22 }}>
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
                style={{ padding: '12px 26px', borderRadius: 50 }}>
                {dailyLoading
                  ? <><Loader2 size={15} style={{ animation: 'spin .8s linear infinite' }} /> Loading…</>
                  : <><Calendar size={15} /> Today's Panchang</>}
              </button>
            </div>

            {dailyLoading && <LoadingState message="Loading today's Panchang…" />}

            {dailyResult && !dailyLoading && (
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
                      fontFamily: UI_FONT, fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase',
                      color: VERDICT_COLOR[dailyResult.overall_day] || '#d97706', fontWeight: 700, marginBottom: 4,
                    }}>{dailyResult.overall_day} Day</p>
                    <p style={{ fontFamily: 'var(--font-hindi)', fontSize: 15, color: 'var(--text-mid)' }}>
                      {dailyResult.pandit_blessings}
                    </p>
                  </div>
                </div>

                {/* 5 Angas */}
                <div style={{ overflowX: 'auto', marginBottom: 18, WebkitOverflowScrolling: 'touch' }}>
                  <div className="panchang-angas" style={{
                    display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
                    gap: 10, minWidth: 480,
                  }}>
                    {[
                      { label: 'Tithi',     icon: '🌙', val: dailyResult.tithi?.name,     sub: dailyResult.tithi?.nature },
                      { label: 'Nakshatra', icon: '⭐', val: dailyResult.nakshatra?.name, sub: dailyResult.nakshatra?.lord },
                      { label: 'Yoga',      icon: '🔗', val: dailyResult.yoga?.name,      sub: dailyResult.yoga?.nature },
                      { label: 'Karana',    icon: '⚡', val: dailyResult.karana?.name,    sub: dailyResult.karana?.nature },
                      { label: 'Var',       icon: '☀️', val: dailyResult.var?.day,        sub: `Lord: ${dailyResult.var?.lord}` },
                    ].map(a => (
                      <div key={a.label} style={{
                        background: 'var(--cream)', borderRadius: 'var(--radius)',
                        padding: '12px 8px', textAlign: 'center', border: '1px solid var(--cream-dark)',
                      }}>
                        <span style={{ fontSize: 20 }}>{a.icon}</span>
                        <p style={{ fontFamily: UI_FONT, fontSize: 10, fontWeight: 600, color: 'var(--text-light)', letterSpacing: '.07em', textTransform: 'uppercase', marginTop: 4 }}>{a.label}</p>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--brown)', fontWeight: 700, marginTop: 2 }}>{a.val}</p>
                        <p style={{ fontFamily: UI_FONT, fontSize: 11, color: 'var(--text-light)', marginTop: 2 }}>{a.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3 key timings */}
                <div style={{ marginBottom: 18 }}>
                  <TimingStrip items={[
                    { value: to12h(dailyResult.brahma_muhurat?.time) || '—', label: '🌅 Brahma Muhurat', color: '#15803d', labelColor: '#16a34a', bg: '#f0fdf4' },
                    { value: to12h(dailyResult.abhijit_muhurat?.time) || '—', label: '☀️ Abhijit Muhurat', color: '#075985', labelColor: '#0369a1', bg: '#f0f9ff' },
                    { value: to12h(dailyResult.rahu_kaal?.time) || '—', label: '🚫 Rahu Kaal', color: '#b91c1c', labelColor: '#dc2626', bg: '#fef2f2' },
                  ]} />
                  <div style={{ display: 'flex', gap: 0 }}>
                    {[
                      { note: dailyResult.brahma_muhurat?.benefit, color: '#16a34a', bg: '#f0fdf4' },
                      { note: dailyResult.abhijit_muhurat?.benefit, color: '#0369a1', bg: '#f0f9ff' },
                      { note: 'Avoid all auspicious work', color: '#dc2626', bg: '#fef2f2' },
                    ].map((n, i) => (
                      <div key={i} style={{
                        flex: 1, padding: '6px 12px 10px',
                        fontFamily: UI_FONT, fontSize: 11, color: n.color,
                        textAlign: 'center', lineHeight: 1.4,
                        borderLeft: i > 0 ? '1px solid var(--cream-dark)' : 'none',
                        borderBottom: '1px solid var(--cream-dark)',
                        borderRight: i === 2 ? '1px solid var(--cream-dark)' : 'none',
                        background: n.bg,
                        borderBottomLeftRadius: i === 0 ? 'var(--radius)' : 0,
                        borderBottomRightRadius: i === 2 ? 'var(--radius)' : 0,
                      }}>{n.note}</div>
                    ))}
                  </div>
                </div>

                {/* Choghadiya */}
                {dailyResult.choghadiya?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--brown)', marginBottom: 10 }}>
                      🕐 Choghadiya
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {dailyResult.choghadiya.map((c, i) => (
                        <div key={i} style={{
                          padding: '8px 12px', borderRadius: 8,
                          background: 'var(--cream)',
                          border: '1px solid var(--cream-dark)',
                          borderLeft: `3px solid ${c.nature === 'good' ? '#16a34a' : c.nature === 'bad' ? '#dc2626' : '#94a3b8'}`,
                        }}>
                          <p style={{ fontFamily: UI_FONT, fontSize: 12, fontWeight: 700, color: c.nature === 'good' ? '#15803d' : c.nature === 'bad' ? '#b91c1c' : 'var(--text-mid)' }}>{c.name}</p>
                          <p style={{ fontFamily: UI_FONT, fontSize: 11, color: 'var(--text-light)', whiteSpace: 'nowrap', marginTop: 2 }}>{to12h(c.time)}</p>
                          {c.good_for && <p style={{ fontFamily: UI_FONT, fontSize: 10, color: 'var(--text-light)', marginTop: 2 }}>{c.good_for}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Do / Avoid */}
                <div className="panchang-do-avoid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { title: '✅ Do today',    items: dailyResult.do_today,    bg: '#f0fdf4', border: '#86efac', color: '#15803d', hdr: '#16a34a' },
                    { title: '🚫 Avoid today', items: dailyResult.avoid_today, bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c', hdr: '#dc2626' },
                  ].map(s => (
                    <div key={s.title} style={{ background: s.bg, borderRadius: 'var(--radius)', padding: '14px 16px', border: `1px solid ${s.border}` }}>
                      <p style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: s.hdr, marginBottom: 8 }}>{s.title}</p>
                      {(s.items || []).map((d, i) => (
                        <p key={i} style={{ fontFamily: UI_FONT, fontSize: 13, color: s.color, marginBottom: 5, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <span style={{ flexShrink: 0 }}>•</span><span>{d}</span>
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* ── SECTION 2 — Muhurat Finder ─────────────────────────────── */}
          <Card>
            {/* Eyebrow */}
            <p style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--saffron-dark)', marginBottom: 4 }}>
              MUHURAT FINDER — PROPER ICONS + A REAL PANDIT RULE ENGINE
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--brown)', marginBottom: 4 }}>
              Muhurat Finder
            </h2>
            <p style={{ fontFamily: UI_FONT, fontSize: 14, color: 'var(--text-light)', marginBottom: 24 }}>
              Find the most auspicious time for your important occasion
            </p>

            {/* Occasion grid */}
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Select Occasion</label>
              <div className="muhurat-occasion-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: 10,
              }}>
                {MUHURAT_TYPES.map(m => (
                  <button key={m.id} onClick={() => setSelected(m.id)} style={{
                    padding: '14px 8px', borderRadius: 'var(--radius)',
                    border: `2px solid ${selected === m.id ? 'var(--saffron)' : 'var(--cream-dark)'}`,
                    background: selected === m.id ? 'rgba(232,101,10,0.07)' : 'white',
                    cursor: 'pointer', textAlign: 'center', transition: 'var(--transition)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{ fontSize: 24 }}>{m.emoji}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: selected === m.id ? 'var(--saffron-dark)' : 'var(--brown)', fontWeight: 700, lineHeight: 1.2 }}>{m.label}</span>
                    <span style={{ fontFamily: 'var(--font-hindi)', fontSize: 10, color: 'var(--text-light)' }}>{m.hindi}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Form row */}
            <div className="muhurat-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 22 }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  style={{ ...inputStyle, background: 'var(--cream)' }} />
              </div>
              <div>
                <label style={labelStyle}>City</label>
                <input type="text" value={city} onChange={e => setCity(e.target.value)}
                  placeholder="e.g. Varanasi…" style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--saffron)'}
                  onBlur={e => e.target.style.borderColor = 'var(--cream-dark)'} />
              </div>
              <div>
                <label style={labelStyle}>Rashi (Moon Sign)</label>
                <select value={rashi} onChange={e => setRashi(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="">Select your Rashi…</option>
                  {RASHI_LIST.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <button className="btn-primary" onClick={findMuhurat} disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '15px', fontSize: 15, borderRadius: 50, gap: 10 }}>
              {loading
                ? <><Loader2 size={18} style={{ animation: 'spin .8s linear infinite' }} /> Finding Muhurat…</>
                : <><Sparkles size={18} /> Find auspicious muhurat</>}
            </button>

            {/* Empty state */}
            {!loading && !result && (
              <div style={{
                marginTop: 28, textAlign: 'center', padding: '28px 24px',
                background: 'var(--cream)', borderRadius: 'var(--radius)',
                border: '1px dashed var(--cream-dark)',
              }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🪔</div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-light)', lineHeight: 1.6 }}>
                  Select an occasion above and click <strong>Find auspicious muhurat</strong><br />
                  to see Vedic timing recommendations
                </p>
              </div>
            )}
          </Card>

          {/* Error */}
          {error && (
            <div style={{ background: '#FFF4F4', border: '1px solid #FFCDD2', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 10 }}>
              <AlertCircle size={18} color="#D32F2F" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontFamily: UI_FONT, color: '#C62828', fontSize: 14 }}>{error}</p>
            </div>
          )}

          {/* Loading */}
          {loading && <LoadingState />}

          {/* ── Muhurat Results ─────────────────────────────────────────── */}
          {result && !loading && (
            <div style={{ animation: 'fadeDown .6s ease both' }}>

              {/* Verdict / Warning Banner */}
              <VerdictBanner result={result} selectedType={selectedType} />

              {/* Two-column layout: main left, compatibility right */}
              <div className="muhurat-results-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' }}>

                {/* LEFT COLUMN */}
                <div>
                  {/* Today's Shubh Windows */}
                  <div style={{
                    background: 'white',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--cream-dark)',
                    boxShadow: '0 2px 16px var(--shadow)',
                    marginBottom: 20,
                    overflow: 'hidden',
                  }}>
                    <div style={{ padding: '18px 20px 12px', borderBottom: '1px solid #f0e4d2' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Clock size={16} color="var(--saffron)" />
                        <h3 style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: 'var(--brown)', margin: 0 }}>
                          Today's shubh windows
                          {result.if_proceeding_anyway && (
                            <span style={{ fontFamily: UI_FONT, fontSize: 12, fontWeight: 400, color: '#9A7150', marginLeft: 8 }}>
                              (if proceeding anyway)
                            </span>
                          )}
                        </h3>
                      </div>
                    </div>

                    {/* Named timing rows */}
                    {(result.auspicious_timings || []).map((timing, i) => {
                      const qs = qualityStyle(timing.quality || timing.name || '');
                      return (
                        <TimingWindowRow
                          key={i}
                          name={timing.name || timing.window_name || `Window ${i + 1}`}
                          subtitle={timing.subtitle || timing.reason}
                          timeRange={to12h(timing.time) || to12h(timing.time_range) || '—'}
                          quality={timing.quality}
                          qualityColor={qs.color}
                          qualityBg={qs.bg}
                        />
                      );
                    })}

                    {/* Fallback if no named timings */}
                    {(!result.auspicious_timings || result.auspicious_timings.length === 0) && (
                      <div style={{ padding: '20px', textAlign: 'center', color: '#9A7150', fontFamily: UI_FONT, fontSize: 14 }}>
                        No auspicious windows found for this date.
                      </div>
                    )}
                  </div>

                  {/* Timings to avoid */}
                  {result.timings_to_avoid?.length > 0 && (
                    <Card accent="rgba(220,38,38,0.25)">
                      <SectionTitle icon={<AlertCircle size={14} color="white" />}>Timings to Avoid</SectionTitle>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {result.timings_to_avoid.map((timing, i) => (
                          <div key={i} style={{ borderRadius: 'var(--radius)', border: '1px solid #fca5a5', overflow: 'hidden', background: '#fef2f2' }}>
                            <div style={{ display: 'flex', borderBottom: '1px solid #fca5a5' }}>
                              <div style={{ padding: '10px 16px', borderRight: '1px solid #fca5a5' }}>
                                <p style={{ fontFamily: UI_FONT, fontSize: 16, fontWeight: 700, color: '#b91c1c', whiteSpace: 'nowrap', marginBottom: 2 }}>{to12h(timing.time)}</p>
                                <p style={{ fontFamily: UI_FONT, fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: '#dc2626' }}>Avoid</p>
                              </div>
                              <div style={{ flex: 1, padding: '10px 16px', display: 'flex', alignItems: 'center' }}>
                                <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#dc2626', lineHeight: 1.4 }}>{timing.reason}</p>
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
                          <span style={{ fontFamily: UI_FONT, fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.6 }}>{ritual}</span>
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

                  {/* Pandit's Note */}
                  {result.pandit_message && (
                    <div style={{
                      background: '#fffdf5',
                      border: '1px solid #fde68a',
                      borderRadius: 'var(--radius-lg)',
                      padding: '18px 20px',
                      marginBottom: 20,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
                        <div>
                          <p style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 6 }}>
                            Pandit's note
                          </p>
                          <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#78350f', lineHeight: 1.7 }}>
                            {result.pandit_message}
                          </p>
                          {result.special_notes?.map((n, i) => (
                            <p key={i} style={{ fontFamily: UI_FONT, fontSize: 13, color: '#78350f', lineHeight: 1.7, marginTop: 6 }}>{n}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN — Day Compatibility */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{
                    background: 'white',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--cream-dark)',
                    boxShadow: '0 2px 12px var(--shadow)',
                    overflow: 'hidden',
                  }}>
                    {/* Header */}
                    <div style={{ padding: '16px 18px', borderBottom: '1px solid #f0e4d2' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Calendar size={15} color="var(--saffron)" />
                        <h3 style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: 'var(--brown)', margin: 0 }}>
                          Day compatibility
                        </h3>
                      </div>
                    </div>

                    {/* Compatibility items */}
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {/* Vaar */}
                      {result.var_today && (
                        <CompatibilityRow
                          label="VAAR"
                          value={result.var_today?.name || result.var_today?.day}
                          status={result.var_today?.is_auspicious_for_this_muhurat ? 'good' : result.var_today?.is_auspicious_for_this_muhurat === false ? 'bad' : 'neutral'}
                        />
                      )}

                      {/* Tithi */}
                      {result.tithi_today && (
                        <CompatibilityRow
                          label="TITHI"
                          value={result.tithi_today?.name}
                          status={elementStatus(result.tithi_today)}
                        />
                      )}

                      {/* Nakshatra */}
                      {result.nakshatra_today && (
                        <CompatibilityRow
                          label="NAKSHATRA"
                          value={result.nakshatra_today?.name}
                          status={elementStatus(result.nakshatra_today)}
                        />
                      )}

                      {/* Yoga */}
                      {result.yoga_today && (
                        <CompatibilityRow
                          label="YOGA"
                          value={result.yoga_today?.name}
                          status={elementStatus(result.yoga_today)}
                        />
                      )}

                      {/* Chandra Bala */}
                      {result.chandra_bala && (
                        <CompatibilityRow
                          label="CHANDRA BALA"
                          value={result.chandra_bala?.status || result.chandra_bala}
                          status={
                            (result.chandra_bala?.status || result.chandra_bala || '')
                              .toLowerCase().includes('favorable') ? 'good'
                              : (result.chandra_bala?.status || result.chandra_bala || '')
                                .toLowerCase().includes('unfavorable') ? 'bad'
                              : 'neutral'
                          }
                        />
                      )}

                      {/* Fallback: show tithi + nakshatra from result if specific fields absent */}
                      {!result.var_today && !result.tithi_today && !result.nakshatra_today && (
                        <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#9A7150', padding: '8px 0' }}>
                          Compatibility data not available.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Alternative Dates */}
                  {result.alternative_dates?.length > 0 && (
                    <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--cream-dark)', padding: '18px', boxShadow: '0 2px 12px var(--shadow)' }}>
                      <h3 style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: 'var(--brown)', marginBottom: 14 }}>📆 Alternative Dates</h3>
                      {result.alternative_dates.map((d, i) => (
                        <div key={i} style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 8, background: 'var(--cream)', border: '1px solid var(--cream-dark)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontFamily: UI_FONT, fontSize: 13, color: 'var(--brown)', fontWeight: 700 }}>{d.date}</span>
                            <span style={{ fontFamily: UI_FONT, fontSize: 10, background: 'var(--saffron)', color: 'white', borderRadius: 50, padding: '2px 8px', fontWeight: 700 }}>{d.quality}</span>
                          </div>
                          <p style={{ fontFamily: UI_FONT, fontSize: 12, color: 'var(--text-light)' }}>{d.reason}</p>
                        </div>
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
        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes fadeDown  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-om  { 0%,100% { transform:scale(1); opacity:.7; } 50% { transform:scale(1.04); opacity:1; } }

        @media (max-width: 900px) {
          .muhurat-results-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 720px) {
          .muhurat-occasion-grid { grid-template-columns: repeat(4,1fr) !important; }
          .muhurat-form-grid     { grid-template-columns: 1fr 1fr !important; }
          .panchang-do-avoid     { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .muhurat-occasion-grid { grid-template-columns: repeat(3,1fr) !important; }
          .muhurat-form-grid     { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Footer />
    </>
  );
}