import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, AlertCircle, Loader2, Sun } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PanchangCalendar from '../components/PanchangCalendar';

const MUHURAT_TYPES = [
  { id: 'vivah',      icon: '🏛️', label: 'Vivah',          hindi: 'विवाह' },
  { id: 'griha',      icon: '🏠', label: 'Griha Pravesh',  hindi: 'गृह प्रवेश' },
  { id: 'naamkaran',  icon: '👶', label: 'Naamkaran',      hindi: 'नामकरण' },
  { id: 'vyapar',     icon: '🏪', label: 'Vyapar Aarambh', hindi: 'व्यापार आरंभ' },
  { id: 'yatra',      icon: '✈️', label: 'Yatra',          hindi: 'यात्रा' },
  { id: 'vastu',      icon: '🧱', label: 'Vastu',          hindi: 'वास्तु/भूमि' },
  { id: 'vidyarambh', icon: '📖', label: 'Vidyarambh',     hindi: 'विद्यारंभ' },
  { id: 'vahan',      icon: '🚗', label: 'Vahan Puja',     hindi: 'वाहन पूजा' },
  { id: 'mundan',     icon: '✂️', label: 'Mundan',         hindi: 'मुंडन' },
  { id: 'investment', icon: '💰', label: 'Nivesh',         hindi: 'निवेश' },
  { id: 'chikitsa',   icon: '🏥', label: 'Chikitsa',       hindi: 'चिकित्सा' },
  { id: 'naukri',     icon: '💼', label: 'Naukri / Job',   hindi: 'नौकरी' },
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

/* ─── PASTEL CHOGHADIYA COLOR MAP (matches Image 1) ────────── */
const PASTEL_CHOG_COLORS = {
  udveg: { bg: '#f8a5a5', text: '#7f1d1d' },   // soft pink-red
  char:  { bg: '#86efac', text: '#14532d' },   // mint green
  labh:  { bg: '#86efac', text: '#14532d' },   // mint green
  amrit: { bg: '#86efac', text: '#14532d' },   // mint green
  kaal:  { bg: '#fca5a5', text: '#7f1d1d' },   // light pink-red
  shubh: { bg: '#bbf7d0', text: '#14532d' },   // pale green
  rog:   { bg: '#fca5a5', text: '#7f1d1d' },   // light pink-red
};

function getPastelChogColor(name) {
  const key = (name || '').toLowerCase();
  for (const [k, v] of Object.entries(PASTEL_CHOG_COLORS)) {
    if (key.includes(k)) return v;
  }
  return { bg: '#fde68a', text: '#78350f' }; // golden fallback
}

/* ─── Parse "HH:MM" or "H:MM AM/PM" to total minutes ───────── */
function parseTimeToMinutes(t) {
  if (!t) return null;
  const isPM = /PM/i.test(t);
  const isAM = /AM/i.test(t);
  const clean = t.replace(/\s*(AM|PM)/i, '').trim();
  const parts = clean.split(':');
  let h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);
  if (isPM && h !== 12) h += 12;
  if (isAM && h === 12) h = 0;
  return h * 60 + m;
}

/* ─── SVG ICON MAP ──────────────────────────────────────────── */
const OCCASION_ICONS = {
  vivah: (
    <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 6 C14 6 8 10 8 15 a6 6 0 0 0 12 0 C20 10 14 6 14 6z"/>
      <path d="M10 20 L7 25 M18 20 L21 25"/>
      <circle cx="14" cy="4" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  griha: (
    <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14 L14 5 L24 14"/>
      <path d="M7 12 L7 23 L21 23 L21 12"/>
      <rect x="11" y="17" width="6" height="6" rx="0.5"/>
      <path d="M14 5 L14 3"/>
    </svg>
  ),
  naamkaran: (
    <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="14" cy="10" r="5"/>
      <path d="M7 24 C7 19.5 10.5 17 14 17 C17.5 17 21 19.5 21 24"/>
      <path d="M18 7 Q22 5 21 10"/>
    </svg>
  ),
  vyapar: (
    <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="12" width="20" height="12" rx="1"/>
      <path d="M9 12 L9 9 Q9 6 12 6 L16 6 Q19 6 19 9 L19 12"/>
      <path d="M4 17 L24 17"/>
    </svg>
  ),
  yatra: (
    <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 20 L23 20"/>
      <path d="M7 20 L7 13 L14 8 L21 13 L21 20"/>
      <path d="M10 20 L10 15 L14 13 L18 15 L18 20"/>
      <path d="M14 8 L14 5 L17 6"/>
    </svg>
  ),
  vastu: (
    <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="20" height="14" rx="1"/>
      <path d="M4 14 L24 14"/>
      <path d="M14 10 L14 24"/>
      <path d="M8 6 L20 6 L22 10 L6 10 Z"/>
    </svg>
  ),
  vidyarambh: (
    <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="4" width="13" height="17" rx="1"/>
      <path d="M9 4 L9 21"/>
      <path d="M12 8 L16 8 M12 12 L16 12 M12 16 L16 16"/>
      <path d="M19 8 L22 8 L22 24 L9 24"/>
    </svg>
  ),
  vahan: (
    <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="13" width="22" height="9" rx="2"/>
      <path d="M6 13 L9 7 L19 7 L22 13"/>
      <circle cx="8" cy="22" r="2.5"/>
      <circle cx="20" cy="22" r="2.5"/>
      <path d="M11 10 L17 10"/>
    </svg>
  ),
  mundan: (
    <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="14" cy="11" r="6"/>
      <path d="M8 11 Q8 5 14 5 Q20 5 20 11"/>
      <path d="M20 15 L24 19 M22 15 L24 17"/>
      <path d="M8 18 L8 24 L20 24 L20 18"/>
    </svg>
  ),
  investment: (
    <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="14" cy="14" r="10"/>
      <path d="M14 8 L14 10 M14 18 L14 20"/>
      <path d="M11 11 Q11 9 14 9 Q17 9 17 11.5 Q17 14 14 14 Q17 14 17 16.5 Q17 19 14 19 Q11 19 11 17"/>
    </svg>
  ),
  chikitsa: (
    <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="8" width="20" height="16" rx="2"/>
      <path d="M10 16 L18 16 M14 12 L14 20"/>
      <path d="M9 8 L9 6 Q9 4 11 4 L17 4 Q19 4 19 6 L19 8"/>
    </svg>
  ),
  naukri: (
    <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="22" height="14" rx="1.5"/>
      <path d="M9 11 L9 8 Q9 5 12 5 L16 5 Q19 5 19 8 L19 11"/>
      <path d="M3 18 L25 18"/>
      <path d="M12 18 L12 22 M16 18 L16 22"/>
    </svg>
  ),
};

/* ─── TODAY'S PANCHANG SECTION ──────────────────────────────── */
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
              { label: 'TITHI',     icon: '🌙', val: dailyResult.tithi?.name,     sub: `${dailyResult.tithi?.nature || dailyResult.tithi?.paksha || ''} · ${dailyResult.tithi?.end_time || ''}` },
              { label: 'NAKSHATRA', icon: '⭐', val: dailyResult.nakshatra?.name,  sub: `until ${dailyResult.nakshatra?.end_time || ''}` },
              { label: 'YOGA',      icon: '∞',  val: dailyResult.yoga?.name,       sub: `until ${dailyResult.yoga?.end_time || ''}` },
              { label: 'KARANA',    icon: '⏹',  val: dailyResult.karana?.name,     sub: `until ${dailyResult.karana?.end_time || ''}` },
              { label: 'VAAR',      icon: '☀️', val: dailyResult.var?.day,         sub: `Lord: ${dailyResult.var?.lord || ''}` },
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

          {/* ── Day Choghadiya timeline ── */}
          {dailyResult.choghadiya?.length > 0 && (
            <div style={{
              background: '#fff', border: '1px solid #e5d9c8',
              borderRadius: 12, padding: '16px 18px', marginBottom: 22,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>⏱</span>
                  <span style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>Day Choghadiya</span>
                </div>
                <span style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150' }}>
                  {to12h(dailyResult.sunrise)} → {to12h(dailyResult.sunset)}
                </span>
              </div>

              {/* Timeline with proportional Now pin */}
              {(() => {
                const now = new Date();
                const nowMins = now.getHours() * 60 + now.getMinutes();
                const sunriseMins = parseTimeToMinutes(dailyResult.sunrise);
                const sunsetMins  = parseTimeToMinutes(dailyResult.sunset);
                const totalMins   = (sunriseMins !== null && sunsetMins !== null) ? sunsetMins - sunriseMins : null;
                const nowPct = (totalMins && sunriseMins !== null)
                  ? Math.max(2, Math.min(98, ((nowMins - sunriseMins) / totalMins) * 100))
                  : 50;

                const nowStr = now.toLocaleTimeString('en-IN', {
                  hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
                });

                return (
                  <div style={{ position: 'relative', marginBottom: 8 }}>
                    {/* Now pill */}
                    <div style={{
                      position: 'absolute',
                      left: `${nowPct}%`,
                      top: -28,
                      transform: 'translateX(-50%)',
                      background: '#1a1a1a',
                      color: '#fff',
                      fontFamily: UI_FONT,
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '4px 11px',
                      borderRadius: 50,
                      whiteSpace: 'nowrap',
                      zIndex: 3,
                      pointerEvents: 'none',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                    }}>
                      Now · {nowStr}
                    </div>

                    {/* Vertical now-line */}
                    <div style={{
                      position: 'absolute',
                      left: `${nowPct}%`,
                      top: 0,
                      width: 2,
                      height: 44,
                      background: '#1a1a1a',
                      zIndex: 2,
                      transform: 'translateX(-50%)',
                      borderRadius: 1,
                    }} />

                    {/* Segments bar */}
                    <div style={{
                      display: 'flex',
                      borderRadius: 8,
                      overflow: 'hidden',
                      height: 44,
                      border: '1px solid #e5d9c8',
                    }}>
                      {dailyResult.choghadiya.map((c, i) => {
                        const col = getPastelChogColor(c.name);
                        return (
                          <div key={i} style={{
                            flex: 1,
                            background: col.bg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRight: i < dailyResult.choghadiya.length - 1
                              ? '1px solid rgba(255,255,255,0.55)'
                              : 'none',
                          }}>
                            <span style={{
                              fontFamily: UI_FONT,
                              fontSize: 11,
                              fontWeight: 700,
                              color: col.text,
                            }}>
                              {c.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Time labels below each segment */}
                    <div style={{ display: 'flex', marginTop: 5 }}>
                      {dailyResult.choghadiya.map((c, i) => (
                        <div key={i} style={{ flex: 1 }}>
                          <span style={{
                            fontFamily: UI_FONT,
                            fontSize: 10,
                            color: '#9A7150',
                            display: 'block',
                            paddingLeft: 2,
                          }}>
                            {to12h(c.start_time || c.time?.split(' - ')[0] || '')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Currently in / Next */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
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
                      {dailyResult.next_choghadiya.name}
                      {dailyResult.next_choghadiya.in_minutes
                        ? ` · in ${dailyResult.next_choghadiya.in_minutes} min`
                        : ''}
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

/* ─── MUHURAT FINDER SECTION ────────────────────────────────── */
function MuhuratFinder({ result, loading, error, date, setDate, city, setCity, rashi, setRashi, name, setName, selected, setSelected, onFind }) {
  const selectedType = MUHURAT_TYPES.find(m => m.id === selected);

  const labelStyle = {
    fontFamily: UI_FONT, fontWeight: 600, fontSize: 11,
    letterSpacing: '.07em', textTransform: 'uppercase',
    color: '#6b7280', display: 'block', marginBottom: 5,
  };
  const inputStyle = {
    padding: '10px 12px',
    border: '1px solid #d1c4b0', borderRadius: 6,
    fontFamily: UI_FONT, fontSize: 14, outline: 'none',
    color: '#1a1a1a', background: '#fff', width: '100%',
    boxSizing: 'border-box',
  };

  const compatItems = result ? [
    {
      label: 'VAAR',
      value: result.var_today || result.tithi_today?.vaar || new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
      status: result.var_auspicious ?? false,
    },
    {
      label: 'TITHI',
      value: result.tithi_today?.name || '—',
      status: result.tithi_today?.is_auspicious_for_this_muhurat ?? null,
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
  ] : [];

  function CompatIcon({ status }) {
    if (status === false) return (
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: '#fee2e2', border: '1px solid #fca5a5',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 2L8 8M8 2L2 8" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/></svg>
      </span>
    );
    if (status === null) return (
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: '#fef9ee', border: '1px solid #fde68a',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#92400e', lineHeight: 1,
      }}>−</span>
    );
    return (
      <span style={{
        width: 22, height: 22, borderRadius: '50%',
        background: '#dcfce7', border: '1px solid #86efac',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5L4 7.5L8.5 2.5" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </span>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px 60px' }}>
      {/* Eyebrow */}
      <div style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 600, color: '#b45309', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>
        MUHURAT FINDER — PROPER ICONS + A REAL PANDIT RULE ENGINE
      </div>
      <h2 style={{ fontFamily: UI_FONT, fontSize: 24, fontWeight: 800, color: '#1a1a1a', margin: '0 0 4px' }}>
        Muhurat Finder
      </h2>
      <p style={{ fontFamily: UI_FONT, fontSize: 14, color: '#6b7280', margin: '0 0 24px' }}>
        Find the most auspicious time for your important occasion
      </p>

      {/* SELECT OCCASION label */}
      <div style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 10 }}>
        SELECT OCCASION
      </div>

      {/* Occasion grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 22 }} className="muhurat-occasion-grid">
        {MUHURAT_TYPES.map(m => {
          const isSelected = selected === m.id;
          return (
            <button key={m.id} onClick={() => setSelected(m.id)} style={{
              padding: '14px 8px 12px',
              borderRadius: 8,
              border: `2px solid ${isSelected ? '#c9651a' : '#e2d5c3'}`,
              background: isSelected ? '#fff7f0' : '#fff',
              cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              transition: 'border-color .12s, background .12s',
              boxSizing: 'border-box',
            }}>
              <span style={{ color: isSelected ? '#c9651a' : '#5a3e28', lineHeight: 1 }}>
                {OCCASION_ICONS[m.id]}
              </span>
              <span style={{
                fontFamily: UI_FONT, fontSize: 11, fontWeight: 700,
                color: isSelected ? '#c9651a' : '#1a1a1a',
                lineHeight: 1.3, textAlign: 'center',
              }}>{m.label}</span>
              <span style={{
                fontFamily: 'serif', fontSize: 10,
                color: isSelected ? '#c9651a' : '#9A7150',
                lineHeight: 1,
              }}>{m.hindi}</span>
            </button>
          );
        })}
      </div>

      {/* Form row */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 130 }}>
          <label style={labelStyle}>DATE</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            style={{ ...inputStyle, width: 140 }} />
        </div>
        <div style={{ minWidth: 130 }}>
          <label style={labelStyle}>CITY</label>
          <input type="text" value={city} onChange={e => setCity(e.target.value)}
            placeholder="e.g. Varanasi"
            style={{ ...inputStyle, width: 140 }} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={labelStyle}>RASHI</label>
          <select value={rashi} onChange={e => setRashi(e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer', appearance: 'auto' }}>
            <option value="">Select Rashi…</option>
            {RASHI_LIST.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <button onClick={onFind} disabled={loading} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 22px', borderRadius: 6,
          background: loading ? '#c9651a99' : '#c9651a',
          color: '#fff', border: 'none',
          fontFamily: UI_FONT, fontSize: 14, fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap', letterSpacing: '.01em', flexShrink: 0,
        }}>
          {loading
            ? <><Loader2 size={15} style={{ animation: 'spin .8s linear infinite' }} /> Finding…</>
            : <><Sparkles size={15} /> Find auspicious muhurat</>}
        </button>
      </div>

      {/* Error */}
      {error && !result && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, padding: '12px 16px', marginBottom: 20,
          display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <AlertCircle size={16} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontFamily: UI_FONT, color: '#b91c1c', fontSize: 14, margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div style={{ animation: 'fadeDown .4s ease both' }}>

          {/* NOT RECOMMENDED banner */}
          {result.verdict === 'avoid' && (
            <div style={{
              background: '#fff8f7', border: '1px solid #fecaca',
              borderRadius: 10, padding: '16px 18px', marginBottom: 22,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3L18 17H2L10 3Z" stroke="#dc2626" strokeWidth="1.6" strokeLinejoin="round" fill="#fee2e2"/>
                  <path d="M10 9V13" stroke="#dc2626" strokeWidth="1.6" strokeLinecap="round"/>
                  <circle cx="10" cy="15.5" r="0.8" fill="#dc2626"/>
                </svg>
                <span style={{
                  background: '#dc2626', color: '#fff',
                  fontFamily: UI_FONT, fontSize: 10, fontWeight: 800,
                  letterSpacing: '.1em', textTransform: 'uppercase',
                  padding: '3px 10px', borderRadius: 4, flexShrink: 0,
                }}>NOT RECOMMENDED</span>
                <span style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#7f1d1d' }}>
                  {selectedType?.label} on {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })} is generally avoided
                </span>
              </div>
              <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#991b1b', lineHeight: 1.65, margin: '0 0 10px' }}>
                {result.verdict_reason}
              </p>
              {result.next_favorable_date && (
                <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#7f1d1d', margin: 0 }}>
                  <strong>Next favorable date:</strong>{' '}
                  {result.next_favorable_date.date} — {result.next_favorable_date.reason}{' '}
                  <a href="#" onClick={e => e.preventDefault()} style={{ color: '#c9651a', textDecoration: 'none', fontWeight: 600 }}>
                    Show details →
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Good verdict banner */}
          {result.verdict !== 'avoid' && result.pandit_message && (
            <div style={{
              background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: 8, padding: '12px 16px', marginBottom: 20,
              fontFamily: UI_FONT, fontSize: 13, color: '#92400e', lineHeight: 1.6,
            }}>
              {result.pandit_message}
            </div>
          )}

          {/* Two-column layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }} className="muhurat-results-grid">

            {/* LEFT — Shubh windows */}
            <div>
              <div style={{
                background: '#fff', border: '1px solid #e2d5c3',
                borderRadius: 10, padding: '18px 20px', marginBottom: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round">
                      <circle cx="8" cy="8" r="6.5"/>
                      <path d="M8 4.5V8L10.5 10"/>
                    </svg>
                    <span style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
                      Today's shubh windows
                    </span>
                  </div>
                  {result.verdict === 'avoid' && (
                    <span style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150', fontStyle: 'italic' }}>
                      (If proceeding anyway)
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(result.auspicious_timings || []).map((timing, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '11px 14px', borderRadius: 7,
                      background: '#f6fdf8', border: '1px solid #d1fae5',
                    }}>
                      <div>
                        <div style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 700, color: '#14532d', marginBottom: 2 }}>
                          {timing.quality || timing.name || 'Auspicious'}
                        </div>
                        <div style={{ fontFamily: UI_FONT, fontSize: 12, color: '#6b7280' }}>
                          {timing.reason || ''}
                        </div>
                      </div>
                      <div style={{
                        fontFamily: UI_FONT, fontSize: 13, fontWeight: 700,
                        color: '#15803d', whiteSpace: 'nowrap', marginLeft: 16,
                      }}>
                        {to12h(timing.time)}
                      </div>
                    </div>
                  ))}
                  {(!result.auspicious_timings || result.auspicious_timings.length === 0) && (
                    <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#9A7150', textAlign: 'center', padding: '16px 0' }}>
                      No auspicious windows found for this date
                    </p>
                  )}
                </div>
              </div>

              {/* Pandit's note */}
              {result.special_notes?.length > 0 && (
                <div style={{
                  background: '#fffdf5', border: '1px solid #fde68a',
                  borderRadius: 10, padding: '16px 18px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="6.5" stroke="#f59e0b" strokeWidth="1.4"/>
                      <path d="M8 4.5V9" stroke="#f59e0b" strokeWidth="1.6" strokeLinecap="round"/>
                      <circle cx="8" cy="11.5" r="0.8" fill="#f59e0b"/>
                    </svg>
                    <span style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 700, color: '#92400e' }}>
                      Pandit's note
                    </span>
                  </div>
                  <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#78350f', lineHeight: 1.7, margin: 0 }}>
                    {result.special_notes.join(' ')}
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT — Day compatibility */}
            <div style={{
              background: '#fff', border: '1px solid #e2d5c3',
              borderRadius: 10, padding: '18px 16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1.5" y="3" width="13" height="12" rx="1.5"/>
                  <path d="M5 1.5V4.5 M11 1.5V4.5 M1.5 7H14.5"/>
                </svg>
                <span style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
                  Day compatibility
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {compatItems.map((item, i) => {
                  const rowBg     = item.status === false ? '#fff5f5' : '#fafaf8';
                  const rowBorder = item.status === false ? '#fecaca' : '#ede8e0';
                  return (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 12px', borderRadius: 7,
                      background: rowBg, border: `1px solid ${rowBorder}`,
                    }}>
                      <div>
                        <div style={{
                          fontFamily: UI_FONT, fontSize: 10, fontWeight: 700,
                          letterSpacing: '.08em', textTransform: 'uppercase',
                          color: '#9A7150', marginBottom: 3,
                        }}>{item.label}</div>
                        <div style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
                          {item.value}
                        </div>
                      </div>
                      <CompatIcon status={item.status} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && (
        <div style={{
          textAlign: 'center', padding: '48px 20px',
          background: '#fdf9f4', borderRadius: 10,
          border: '1px dashed #e2d5c3',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🪔</div>
          <p style={{ fontFamily: UI_FONT, fontSize: 14, color: '#9A7150', lineHeight: 1.6, margin: 0 }}>
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
  const [date, setDate]       = useState(TODAY);
  const [city, setCity]       = useState('');
  const [rashi, setRashi]     = useState('');
  const [name, setName]       = useState('');
  const [selected, setSelected] = useState(null);

  const [dailyLoading, setDailyLoading] = useState(false);
  const [dailyResult, setDailyResult]   = useState(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);

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
              textTransform: 'uppercase', fontWeight: 500, fontFamily: UI_FONT,
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
          .timing-cards         { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 720px) {
          .muhurat-occasion-grid { grid-template-columns: repeat(4, 1fr) !important; }
          .panchang-angas        { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 480px) {
          .muhurat-occasion-grid { grid-template-columns: repeat(3, 1fr) !important; }
        }
      `}</style>

      <Footer />
    </>
  );
}