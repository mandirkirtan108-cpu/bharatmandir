import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, AlertCircle, Loader2, Sun } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PanchangCalendar from '../components/PanchangCalendar';

const MUHURAT_TYPES = [
  { id: 'vivah',      emoji: null, icon: '🏛️', label: 'Vivah',          hindi: 'विवाह' },
  { id: 'griha',      emoji: null, icon: '🏠', label: 'Griha Pravesh',  hindi: 'गृह प्रवेश' },
  { id: 'naamkaran',  emoji: null, icon: '👶', label: 'Naamkaran',      hindi: 'नामकरण' },
  { id: 'vyapar',     emoji: null, icon: '🏪', label: 'Vyapar Aarambh', hindi: 'व्यापार आरंभ' },
  { id: 'yatra',      emoji: null, icon: '✈️', label: 'Yatra',          hindi: 'यात्रा' },
  { id: 'vastu',      emoji: null, icon: '🧱', label: 'Vastu',          hindi: 'वास्तु/भूमि' },
  { id: 'vidyarambh', emoji: null, icon: '📖', label: 'Vidyarambh',     hindi: 'विद्यारंभ' },
  { id: 'vahan',      emoji: null, icon: '🚗', label: 'Vahan Puja',     hindi: 'वाहन पूजा' },
  { id: 'mundan',     emoji: null, icon: '✂️', label: 'Mundan',         hindi: 'मुंडन' },
  { id: 'investment', emoji: null, icon: '💰', label: 'Nivesh',         hindi: 'निवेश' },
  { id: 'chikitsa',   emoji: null, icon: '🏥', label: 'Chikitsa',       hindi: 'चिकित्सा' },
  { id: 'naukri',     emoji: null, icon: '💼', label: 'Naukri / Job',   hindi: 'नौकरी' },
];

const RASHI_LIST = [
  'मेष (Aries)', 'वृषभ (Taurus)', 'मिथुन (Gemini)', 'कर्क (Cancer)',
  'सिंह (Leo)', 'कन्या (Virgo)', 'तुला (Libra)', 'वृश्चिक (Scorpio)',
  'धनु (Sagittarius)', 'मकर (Capricorn)', 'कुंभ (Aquarius)', 'मीन (Pisces)',
];

const TODAY = new Date().toISOString().split('T')[0];

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const DEFAULT_COORDINATES = '28.6139,77.2090';

const UI_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Roboto", sans-serif';

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

// Choghadiya color mapping
const CHOGHADIYA_COLORS = {
  udveg:  { bg: '#f87171', text: '#fff' },
  char:   { bg: '#34d399', text: '#fff' },
  labh:   { bg: '#6ee7b7', text: '#064e3b' },
  amrit:  { bg: '#34d399', text: '#fff' },
  kaal:   { bg: '#f87171', text: '#fff' },
  shubh:  { bg: '#86efac', text: '#14532d' },
  rog:    { bg: '#f87171', text: '#fff' },
};

function getChogColor(name) {
  const key = (name || '').toLowerCase();
  for (const [k, v] of Object.entries(CHOGHADIYA_COLORS)) {
    if (key.includes(k)) return v;
  }
  return { bg: '#fbbf24', text: '#78350f' };
}

/* ─── TODAY'S PANCHANG SECTION (Screenshot 1) ─────────────── */
function TodaysPanchang({ dailyResult, dailyLoading, date, city, setDate, setCity, onFetch }) {
  const inputStyle = {
    padding: '8px 12px', border: '1px solid #e5d9c8', borderRadius: 8,
    fontFamily: UI_FONT, fontSize: 14, outline: 'none', color: '#1a1a1a', background: '#fff',
  };
  const labelStyle = {
    fontFamily: UI_FONT, fontWeight: 600, fontSize: 11,
    letterSpacing: '.07em', textTransform: 'uppercase',
    color: '#6b7280', display: 'block', marginBottom: 5,
  };

  // Compute current choghadiya slot
  const nowStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px 0' }}>
      {/* Title */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: UI_FONT, fontSize: 22, fontWeight: 800, color: '#1a1a1a', margin: 0 }}>
            Today's Panchang
          </h2>
          <span style={{ fontFamily: 'serif', fontSize: 17, color: '#6b7280' }}>आज का पंचांग</span>
        </div>
        {dailyResult && (
          <div style={{ fontFamily: UI_FONT, fontSize: 13, color: '#6b7280', marginTop: 4 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {city ? ` · ${city}` : ''}
            {dailyResult.tithi?.name && dailyResult.nakshatra?.name
              ? ` · ${dailyResult.tithi.paksha || ''} ${dailyResult.tithi.name}`
              : ''}
          </div>
        )}
      </div>

      {/* Form row */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" value={date}
            onChange={e => setDate(e.target.value)}
            style={{ ...inputStyle, width: 160 }}
          />
        </div>
        <div>
          <label style={labelStyle}>City</label>
          <input type="text" value={city} onChange={e => setCity(e.target.value)}
            placeholder="e.g. Varanasi, Ujjain…"
            style={{ ...inputStyle, width: 200 }}
          />
        </div>
        <button onClick={onFetch} disabled={dailyLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 20px', borderRadius: 8,
            background: '#E8650A', color: '#fff', border: 'none',
            fontFamily: UI_FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
          {dailyLoading
            ? <><Loader2 size={14} style={{ animation: 'spin .8s linear infinite' }} /> Loading…</>
            : 'Get Panchang'}
        </button>
      </div>

      {dailyLoading && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9A7150', fontFamily: UI_FONT }}>
          <Loader2 size={28} style={{ animation: 'spin .8s linear infinite', color: '#E8650A', marginBottom: 8 }} />
          <p>Fetching today's Panchang…</p>
        </div>
      )}

      {dailyResult && !dailyLoading && (
        <div style={{ animation: 'fadeDown .4s ease both' }}>

          {/* TODAY AT A GLANCE banner */}
          {dailyResult.today_at_glance && (
            <div style={{
              background: '#fef9ee', border: '1px solid #fde68a',
              borderLeft: '4px solid #f59e0b',
              borderRadius: 10, padding: '14px 16px', marginBottom: 22,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Sparkles size={14} color="#f59e0b" />
                <span style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#b45309' }}>
                  TODAY AT A GLANCE
                </span>
              </div>
              <p style={{ fontFamily: UI_FONT, fontSize: 14, color: '#78350f', lineHeight: 1.6, margin: 0 }}>
                {dailyResult.today_at_glance}
              </p>
            </div>
          )}

          {/* 5 Angas grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 10, marginBottom: 22,
          }} className="panchang-angas">
            {[
              { label: 'TITHI',     icon: '🌙', val: dailyResult.tithi?.name,          sub: `${dailyResult.tithi?.nature || dailyResult.tithi?.paksha || ''} · ${dailyResult.tithi?.end_time || ''}` },
              { label: 'NAKSHATRA', icon: '⭐', val: dailyResult.nakshatra?.name,      sub: `until ${dailyResult.nakshatra?.end_time || ''}` },
              { label: 'YOGA',      icon: '∞',  val: dailyResult.yoga?.name,           sub: `until ${dailyResult.yoga?.end_time || ''}` },
              { label: 'KARANA',    icon: '⏹',  val: dailyResult.karana?.name,         sub: `until ${dailyResult.karana?.end_time || ''}` },
              { label: 'VAAR',      icon: '☀️', val: dailyResult.var?.day,             sub: `Lord: ${dailyResult.var?.lord || ''}` },
            ].map(a => (
              <div key={a.label} style={{
                background: '#fff', borderRadius: 10, padding: '14px 10px',
                textAlign: 'center', border: '1px solid #e5d9c8',
              }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{a.icon}</div>
                <div style={{ fontFamily: UI_FONT, fontSize: 10, fontWeight: 700, color: '#9A7150', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>{a.label}</div>
                <div style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 3 }}>{a.val || '—'}</div>
                <div style={{ fontFamily: UI_FONT, fontSize: 11, color: '#9A7150' }}>{a.sub}</div>
              </div>
            ))}
          </div>

          {/* Day Choghadiya timeline */}
          {dailyResult.choghadiya?.length > 0 && (
            <div style={{
              background: '#fff', border: '1px solid #e5d9c8',
              borderRadius: 12, padding: '16px 18px', marginBottom: 22,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>⏱</span>
                  <span style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>Day Choghadiya</span>
                </div>
                <span style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150' }}>
                  {to12h(dailyResult.sunrise)} → {to12h(dailyResult.sunset)}
                </span>
              </div>

              {/* Color timeline bar */}
              <div style={{ position: 'relative', marginBottom: 8 }}>
                {/* Now marker */}
                <div style={{
                  position: 'absolute', top: -24, left: '50%', transform: 'translateX(-50%)',
                  background: '#1a1a1a', color: '#fff',
                  fontFamily: UI_FONT, fontSize: 11, fontWeight: 700,
                  padding: '3px 10px', borderRadius: 50, whiteSpace: 'nowrap', zIndex: 2,
                }}>
                  Now · {nowStr}
                </div>
                {/* Vertical line */}
                <div style={{
                  position: 'absolute', top: 0, left: '50%', width: 2,
                  height: '100%', background: '#1a1a1a', zIndex: 1,
                }} />
                {/* Segments */}
                <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', height: 44 }}>
                  {dailyResult.choghadiya.map((c, i) => {
                    const col = getChogColor(c.name);
                    return (
                      <div key={i} style={{
                        flex: 1, background: col.bg,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 700, color: col.text }}>
                          {c.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Time labels */}
                <div style={{ display: 'flex', marginTop: 4 }}>
                  {dailyResult.choghadiya.map((c, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'left' }}>
                      <span style={{ fontFamily: UI_FONT, fontSize: 10, color: '#9A7150' }}>
                        {to12h(c.start_time || c.time?.split(' - ')[0] || '')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Currently in / Next */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                {dailyResult.current_choghadiya && (
                  <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontFamily: UI_FONT, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#16a34a', marginBottom: 4 }}>
                      CURRENTLY IN
                    </div>
                    <div style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#14532d' }}>
                      {dailyResult.current_choghadiya.name} · {to12h(dailyResult.current_choghadiya.time)}
                    </div>
                  </div>
                )}
                {dailyResult.next_choghadiya && (
                  <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontFamily: UI_FONT, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 4 }}>
                      NEXT
                    </div>
                    <div style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#374151' }}>
                      {dailyResult.next_choghadiya.name} · {dailyResult.next_choghadiya.in_minutes ? `in ${dailyResult.next_choghadiya.in_minutes} min` : ''}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3 Key Timings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 22 }} className="timing-cards">
            {[
              {
                icon: '⬆',
                label: 'BRAHMA',
                color: '#16a34a',
                bg: '#f0fdf4',
                border: '#bbf7d0',
                time: to12h(dailyResult.brahma_muhurat?.time) || '—',
                sub: dailyResult.brahma_muhurat?.benefit || 'Spiritual practice',
              },
              {
                icon: '✳',
                label: 'ABHIJIT',
                color: '#2563eb',
                bg: '#eff6ff',
                border: '#bfdbfe',
                time: to12h(dailyResult.abhijit_muhurat?.time) || '—',
                sub: dailyResult.abhijit_muhurat?.benefit || 'All-purpose auspicious',
              },
              {
                icon: '⊘',
                label: 'RAHU KAAL',
                color: '#dc2626',
                bg: '#fef2f2',
                border: '#fecaca',
                time: to12h(dailyResult.rahu_kaal?.time) || '—',
                sub: 'Avoid new beginnings',
              },
            ].map(t => (
              <div key={t.label} style={{
                background: t.bg, border: `1px solid ${t.border}`,
                borderRadius: 10, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: t.color }}>{t.icon}</span>
                  <span style={{ fontFamily: UI_FONT, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: t.color }}>
                    {t.label}
                  </span>
                </div>
                <div style={{ fontFamily: UI_FONT, fontSize: 20, fontWeight: 800, color: t.color, marginBottom: 4 }}>
                  {t.time}
                </div>
                <div style={{ fontFamily: UI_FONT, fontSize: 12, color: t.color, opacity: 0.8 }}>{t.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── MUHURAT FINDER SECTION (Screenshot 3) ────────────────── */
function MuhuratFinder({ result, loading, error, date, setDate, city, setCity, rashi, setRashi, name, setName, selected, setSelected, onFind }) {
  const selectedType = MUHURAT_TYPES.find(m => m.id === selected);

  const inputStyle = {
    width: '100%', padding: '9px 12px',
    border: '1px solid #e5d9c8', borderRadius: 8,
    fontFamily: UI_FONT, fontSize: 14, outline: 'none', color: '#1a1a1a', background: '#fff',
    boxSizing: 'border-box',
  };
  const labelStyle = {
    fontFamily: UI_FONT, fontWeight: 600, fontSize: 11,
    letterSpacing: '.07em', textTransform: 'uppercase',
    color: '#6b7280', display: 'block', marginBottom: 5,
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px 60px' }}>
      <div style={{ fontFamily: UI_FONT, fontSize: 12, fontWeight: 600, color: '#9A7150', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
        Muhurat Finder — proper icons + a real pandit rule engine
      </div>
      <h2 style={{ fontFamily: UI_FONT, fontSize: 22, fontWeight: 800, color: '#1a1a1a', margin: '0 0 4px' }}>
        Muhurat Finder
      </h2>
      <p style={{ fontFamily: UI_FONT, fontSize: 14, color: '#6b7280', marginBottom: 22 }}>
        Find the most auspicious time for your important occasion
      </p>

      {/* Occasion grid — 6 cols */}
      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle}>Select Occasion</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }} className="muhurat-occasion-grid">
          {MUHURAT_TYPES.map(m => (
            <button key={m.id} onClick={() => setSelected(m.id)} style={{
              padding: '12px 6px', borderRadius: 8,
              border: `2px solid ${selected === m.id ? '#E8650A' : '#e5d9c8'}`,
              background: selected === m.id ? '#fff7f0' : '#fff',
              cursor: 'pointer', textAlign: 'center',
              transition: 'all .12s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            }}>
              <span style={{ fontSize: 22 }}>{m.icon}</span>
              <span style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 700, color: selected === m.id ? '#E8650A' : '#374151', lineHeight: 1.2 }}>{m.label}</span>
              <span style={{ fontFamily: 'serif', fontSize: 10, color: '#9A7150' }}>{m.hindi}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Form row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr auto', gap: 12, alignItems: 'flex-end', marginBottom: 20 }} className="muhurat-form-row">
        <div>
          <label style={labelStyle}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...inputStyle, width: 160 }} />
        </div>
        <div>
          <label style={labelStyle}>City</label>
          <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Varanasi" style={{ ...inputStyle, width: 160 }} />
        </div>
        <div>
          <label style={labelStyle}>Rashi</label>
          <select value={rashi} onChange={e => setRashi(e.target.value)} style={{ ...inputStyle }}>
            <option value="">Select Rashi…</option>
            {RASHI_LIST.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button onClick={onFind} disabled={loading} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 20px', borderRadius: 8,
          background: '#E8650A', color: '#fff', border: 'none',
          fontFamily: UI_FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}>
          {loading
            ? <><Loader2 size={14} style={{ animation: 'spin .8s linear infinite' }} /> Finding…</>
            : <><Sparkles size={14} /> Find auspicious muhurat</>}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ fontFamily: UI_FONT, color: '#b91c1c', fontSize: 14, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div style={{ animation: 'fadeDown .4s ease both' }}>

          {/* NOT RECOMMENDED / WARNING banner */}
          {result.verdict === 'avoid' && (
            <div style={{
              background: '#fff5f5', border: '1px solid #fecaca',
              borderRadius: 10, padding: '14px 16px', marginBottom: 20,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{
                  background: '#dc2626', color: '#fff',
                  fontFamily: UI_FONT, fontSize: 10, fontWeight: 800,
                  letterSpacing: '.08em', textTransform: 'uppercase',
                  padding: '3px 10px', borderRadius: 4,
                }}>NOT RECOMMENDED</span>
                <span style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#7f1d1d' }}>
                  {selectedType?.label} on {new Date(result.date || date).toLocaleDateString('en-US', { weekday: 'long' })} is generally avoided
                </span>
              </div>
              <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#991b1b', lineHeight: 1.6, margin: 0, marginBottom: result.next_favorable_date ? 10 : 0 }}>
                {result.verdict_reason}
              </p>
              {result.next_favorable_date && (
                <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#7f1d1d', margin: 0 }}>
                  <strong>Next favorable date:</strong> {result.next_favorable_date.date} — {result.next_favorable_date.reason}{' '}
                  <a href="#" style={{ color: '#E8650A', textDecoration: 'none', fontWeight: 600 }}>Show details →</a>
                </p>
              )}
            </div>
          )}

          {/* Good verdict banner */}
          {result.verdict !== 'avoid' && result.pandit_message && (
            <div style={{
              background: result.verdict === 'excellent' ? '#f0fdf4' : '#fffbeb',
              border: `1px solid ${result.verdict === 'excellent' ? '#86efac' : '#fde68a'}`,
              borderRadius: 10, padding: '14px 16px', marginBottom: 20,
            }}>
              <p style={{ fontFamily: UI_FONT, fontSize: 14, color: result.verdict === 'excellent' ? '#15803d' : '#92400e', margin: 0 }}>
                {result.pandit_message}
              </p>
            </div>
          )}

          {/* Two-column layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 22 }} className="muhurat-results-grid">

            {/* LEFT: Today's shubh windows */}
            <div>
              <div style={{
                background: '#fff', border: '1px solid #e5d9c8',
                borderRadius: 10, padding: '18px', marginBottom: 18,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 15 }}>⏱</span>
                    <span style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>Today's shubh windows</span>
                  </div>
                  <span style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150' }}>
                    {result.verdict === 'avoid' ? '(If proceeding anyway)' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(result.auspicious_timings || []).map((timing, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                      padding: '12px 14px', borderRadius: 8,
                      background: '#fafafa', border: '1px solid #f0e8da',
                    }}>
                      <div>
                        <div style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 2 }}>
                          {timing.quality || timing.name}
                        </div>
                        <div style={{ fontFamily: UI_FONT, fontSize: 12, color: '#6b7280' }}>
                          {timing.reason}
                        </div>
                      </div>
                      <div style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap', marginLeft: 12 }}>
                        {to12h(timing.time)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pandit's note */}
              {result.special_notes?.length > 0 && (
                <div style={{
                  background: '#fffbeb', border: '1px solid #fde68a',
                  borderRadius: 10, padding: '16px 18px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 16 }}>✨</span>
                    <span style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 700, color: '#92400e' }}>Pandit's note</span>
                  </div>
                  <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#78350f', lineHeight: 1.7, margin: 0 }}>
                    {result.special_notes.join(' ')}
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT: Day compatibility */}
            <div style={{
              background: '#fff', border: '1px solid #e5d9c8',
              borderRadius: 10, padding: '18px',
              alignSelf: 'start',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 15 }}>🗓</span>
                <span style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>Day compatibility</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[
                  {
                    label: 'VAAR',
                    value: result.var_today || result.tithi_today?.vaar || new Date().toLocaleDateString('en-US', { weekday: 'long' }),
                    status: result.var_auspicious ?? false,
                  },
                  {
                    label: 'TITHI',
                    value: result.tithi_today?.name || '—',
                    status: result.tithi_today?.is_auspicious_for_this_muhurat ?? true,
                  },
                  {
                    label: 'NAKSHATRA',
                    value: result.nakshatra_today?.name || '—',
                    status: result.nakshatra_today?.is_auspicious_for_this_muhurat ?? true,
                  },
                  {
                    label: 'YOGA',
                    value: result.yoga_today?.name || '—',
                    status: result.yoga_today?.is_auspicious ?? true,
                  },
                  {
                    label: 'CHANDRA BALA',
                    value: result.chandra_bala || 'Favorable',
                    status: true,
                  },
                ].map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '11px 12px',
                    background: item.status === false ? '#fef2f2' : '#fafafa',
                    borderRadius: 6,
                    border: `1px solid ${item.status === false ? '#fecaca' : '#f0e8da'}`,
                    marginBottom: 6,
                  }}>
                    <div>
                      <div style={{ fontFamily: UI_FONT, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9A7150', marginBottom: 2 }}>
                        {item.label}
                      </div>
                      <div style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
                        {item.value}
                      </div>
                    </div>
                    <div>
                      {item.status === false
                        ? <span style={{ fontSize: 18 }}>✕</span>
                        : <span style={{ fontSize: 18, color: '#16a34a' }}>✓</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!loading && !result && (
        <div style={{
          textAlign: 'center', padding: '40px 20px',
          background: '#fdf9f4', borderRadius: 10,
          border: '1px dashed #e5d9c8',
        }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🪔</div>
          <p style={{ fontFamily: UI_FONT, fontSize: 14, color: '#9A7150', lineHeight: 1.6 }}>
            Select an occasion above and click <strong>Find auspicious muhurat</strong>
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── PAGE ROOT ─────────────────────────────────────────────── */
export default function PanchangPage() {
  const { t } = useTranslation();
  const [date, setDate] = useState(TODAY);
  const [city, setCity] = useState('');
  const [rashi, setRashi] = useState('');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(null);

  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyResult, setDailyResult] = useState(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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

  const selectedType = MUHURAT_TYPES.find(m => m.id === selected);

  const findMuhurat = async () => {
    if (!selected) { setError('Please select an occasion first.'); return; }
    setLoading(true); setResult(null); setError(null);
    try {
      const trimmedCity = city.trim();
      const res = await fetch(`${API_BASE}/api/panchang/muhurat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          muhurat_type: selected,
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

  return (
    <>
      <Navbar />
      <div style={{ background: '#fdf9f4', minHeight: '100vh', paddingBottom: 0 }}>

        {/* Hero */}
        <section style={{
          background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
          padding: '50px 20px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div style={{
            width: '100%', maxWidth: 700,
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,213,128,0.3)',
              borderRadius: 50, padding: '5px 16px', marginBottom: 14,
              color: 'rgba(255,213,128,0.85)', fontSize: 11, letterSpacing: '.1em',
              textTransform: 'uppercase', fontWeight: 500,
              fontFamily: UI_FONT,
            }}>
              <Sun size={11} /> {t('panchang.badge', 'Vedic Calendar & Muhurat')}
            </div>
            <h1 style={{
              fontFamily: 'Georgia, serif', fontWeight: 900,
              fontSize: 'clamp(28px, 5vw, 48px)', lineHeight: 1.1,
              marginBottom: 10, marginTop: 0, color: '#fff',
              textShadow: '0 4px 40px rgba(0,0,0,0.3)',
            }}>
              AI Pandit Ji —{' '}
              <span style={{ color: '#FFD580' }}>Panchang &amp; Muhurat</span>
            </h1>
            <p style={{
              color: 'rgba(255,255,255,0.7)', fontSize: 15,
              maxWidth: 520, margin: 0, fontWeight: 300, lineHeight: 1.7,
              fontFamily: UI_FONT,
            }}>
              {t('panchang.subtitle', 'Daily Panchang, Choghadiya & personalized Muhurat recommendations based on Vedic astrology')}
            </p>
          </div>
        </section>

        {/* Today's Panchang */}
        <div style={{ background: '#fff', borderBottom: '1px solid #f0e8da' }}>
          <TodaysPanchang
            dailyResult={dailyResult}
            dailyLoading={dailyLoading}
            date={date}
            city={city}
            setDate={setDate}
            setCity={setCity}
            onFetch={fetchDailyPanchang}
          />
        </div>

        {/* Panchang Calendar */}
        <PanchangCalendar />

        {/* Muhurat Finder */}
        <div style={{ background: '#fff', borderTop: '1px solid #f0e8da' }}>
          <MuhuratFinder
            result={result}
            loading={loading}
            error={error}
            date={date}
            setDate={d => { setDate(d); setResult(null); }}
            city={city}
            setCity={setCity}
            rashi={rashi}
            setRashi={setRashi}
            name={name}
            setName={setName}
            selected={selected}
            setSelected={s => { setSelected(s); setResult(null); }}
            onFind={findMuhurat}
          />
        </div>
      </div>

      <style>{`
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes fadeDown { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }

        @media (max-width: 900px) {
          .muhurat-results-grid { grid-template-columns: 1fr !important; }
          .timing-cards { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 720px) {
          .muhurat-occasion-grid { grid-template-columns: repeat(4, 1fr) !important; }
          .muhurat-form-row { grid-template-columns: 1fr 1fr !important; }
          .panchang-angas { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .muhurat-occasion-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .muhurat-form-row { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Footer />
    </>
  );
}