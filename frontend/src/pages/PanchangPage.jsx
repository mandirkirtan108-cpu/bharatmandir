import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  MapPin,
  Moon,
  Navigation,
  Sparkles,
  Star,
  Sun,
  X,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import PanchangCalendar from '../components/PanchangCalendar';
import CityAutocomplete from '../components/CityAutocomplete';

const MUHURAT_TYPES = [
  { id: 'vivah', label: 'Vivah', hindi: 'Vivah', desc: 'Marriage ceremony' },
  { id: 'griha', label: 'Griha Pravesh', hindi: 'Griha Pravesh', desc: 'New home entry' },
  { id: 'naamkaran', label: 'Naamkaran', hindi: 'Naamkaran', desc: 'Baby naming' },
  { id: 'vyapar', label: 'Vyapar Aarambh', hindi: 'Vyapar Aarambh', desc: 'Business launch' },
  { id: 'yatra', label: 'Yatra', hindi: 'Yatra', desc: 'Journey or travel' },
  { id: 'vastu', label: 'Vastu / Bhoomi', hindi: 'Vastu / Bhoomi', desc: 'Construction' },
  { id: 'vidyarambh', label: 'Vidyarambh', hindi: 'Vidyarambh', desc: 'Starting education' },
  { id: 'vahan', label: 'Vahan Puja', hindi: 'Vahan Puja', desc: 'New vehicle' },
  { id: 'mundan', label: 'Mundan', hindi: 'Mundan', desc: 'First haircut' },
  { id: 'investment', label: 'Nivesh', hindi: 'Nivesh', desc: 'Investment or gold' },
  { id: 'chikitsa', label: 'Chikitsa', hindi: 'Chikitsa', desc: 'Medical procedure' },
  { id: 'naukri', label: 'Naukri / Job', hindi: 'Naukri', desc: 'Job interview' },
];

const RASHI_LIST = [
  'Mesha (Aries)', 'Vrishabha (Taurus)', 'Mithuna (Gemini)', 'Karka (Cancer)',
  'Simha (Leo)', 'Kanya (Virgo)', 'Tula (Libra)', 'Vrischika (Scorpio)',
  'Dhanu (Sagittarius)', 'Makara (Capricorn)', 'Kumbha (Aquarius)', 'Meena (Pisces)',
];

const TODAY = new Date().toISOString().split('T')[0];
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const UI_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Roboto", sans-serif';

const VERDICT_COLOR = { excellent: '#16a34a', good: '#2563eb', average: '#d97706', avoid: '#dc2626' };
const VERDICT_BG = { excellent: '#f0fdf4', good: '#eff6ff', average: '#fffbeb', avoid: '#fef2f2' };

/* ------------------------------------------------------------------ */
/*  Field curation — turns raw DivineAPI keys into a clean, human      */
/*  readable Panchang instead of a raw key dump.                       */
/* ------------------------------------------------------------------ */

const HIDDEN_KEYS = new Set(['id', 'raw', 'paksha_randhra_start_time', 'vriddhi', 'kshaya']);

const LABEL_MAP = {
  tithi: 'Tithi', paksha: 'Paksha', number: 'Number', deity: 'Deity', type: 'Nature',
  start_time: 'Starts', end_time: 'Ends', start: 'Starts', end: 'Ends',
  nak_name: 'Nakshatra', nakshatra_name: 'Nakshatra', lord: 'Lord', pada: 'Pada',
  yoga_number: 'Yoga No.', yoga_name: 'Yoga',
  karana_name: 'Karana', mobility: 'Mobility', rulling_planet: 'Ruling Planet',
  ruling_planet: 'Ruling Planet', devata: 'Deity', nature: 'Nature', sign: 'Sign',
  sunrise: 'Sunrise', sunset: 'Sunset', moonrise: 'Moonrise', moonset: 'Moonset',
  brahma_muhurat: 'Brahma Muhurat', abhijit_muhurat: 'Abhijit Muhurat', rahu_kaal: 'Rahu Kaal',
};

const FIELD_PRIORITY = [
  'tithi', 'nak_name', 'nakshatra_name', 'yoga_name', 'karana_name',
  'paksha', 'pada', 'mobility', 'deity', 'devata', 'ruling_planet', 'rulling_planet', 'lord',
  'nature', 'type', 'number', 'yoga_number', 'sign', 'start_time', 'start', 'end_time', 'end',
];

const AUSPICIOUS_MEANINGS = {
  brahma_muhurta: { label: 'Brahma Muhurat', icon: '🕉️', note: 'Best for meditation, prayer and spiritual practice.' },
  abhijit_muhurta: { label: 'Abhijit Muhurat', icon: '✳️', note: 'The most auspicious window of the day for important beginnings.' },
  abhijit: { label: 'Abhijit Muhurat', icon: '✳️', note: 'The most auspicious window of the day for important beginnings.' },
  godhuli_muhurta: { label: 'Godhuli Muhurat', icon: '🌇', note: 'Dusk period, favourable for weddings and ceremonies.' },
  pratah_sandhya: { label: 'Pratah Sandhya', icon: '🌅', note: 'Morning twilight — good for prayer and daily rituals.' },
  sayahana_sandhya: { label: 'Sayahana Sandhya', icon: '🌆', note: 'Evening twilight — good for prayer and daily rituals.' },
  nishita_muhurta: { label: 'Nishita Muhurat', icon: '🌌', note: 'Midnight period, sacred for select poojas (e.g. Janmashtami).' },
  vijay_muhurta: { label: 'Vijay Muhurat', icon: '🏆', note: 'Favourable for ventures where victory or success matters.' },
  sarvartha_siddhi_yoga: { label: 'Sarvartha Siddhi Yoga', icon: '✨', note: 'A highly favourable yoga for success in any undertaking.' },
  amrit_kaal: { label: 'Amrit Kaal', icon: '💧', note: 'Nectar period — favourable for most activities.' },
};

const INAUSPICIOUS_MEANINGS = {
  rahu_kaal: { label: 'Rahu Kaal', icon: '⊘', note: 'Avoid starting new or auspicious work.' },
  gulkai_kaal: { label: 'Gulikai Kaal', icon: '⊘', note: 'Avoid important beginnings during this window.' },
  gulika_kaal: { label: 'Gulika Kaal', icon: '⊘', note: 'Avoid important beginnings during this window.' },
  yamaganda: { label: 'Yamaganda', icon: '⊘', note: 'Ruled by Yama — avoid launching new ventures.' },
  yamaghanta: { label: 'Yamaghanta', icon: '⊘', note: 'Avoid launching new ventures during this window.' },
  baana: { label: 'Baana', icon: '⚠️', note: 'Inauspicious influence tied to the day\u2019s ruling sign.' },
  panchaka: { label: 'Panchak', icon: '⚠️', note: 'Avoid construction, roofing and funeral rites during this period.' },
  varjyam: { label: 'Varjyam', icon: '⊘', note: 'Best avoided for important tasks.' },
  dur_muhurtam: { label: 'Dur Muhurat', icon: '⊘', note: 'An inauspicious muhurat, unfit for new beginnings.' },
  kantaka: { label: 'Kantaka / Mrityu', icon: '⊘', note: 'Considered harmful — avoid new beginnings.' },
  kaalvela: { label: 'Kaalvela / Ardhayaam', icon: '⊘', note: 'Best avoided for auspicious starts.' },
  kulika_kaal: { label: 'Kulika Kaal', icon: '⊘', note: 'Avoid important beginnings during this window.' },
  hutashana_yoga: { label: 'Hutashana Yoga', icon: '🔥', note: 'Inauspicious yoga — exercise caution.' },
  visha_yoga: { label: 'Visha Yoga', icon: '⚠️', note: '"Poison yoga" — considered inauspicious.' },
  yamaghata_yoga: { label: 'Yamaghata Yoga', icon: '⚠️', note: 'Associated with obstacles — best avoided.' },
  dagdha_yoga: { label: 'Dagdha Yoga', icon: '🔥', note: '"Burnt yoga" — avoid auspicious starts.' },
  samvartaka_yoga: { label: 'Samvartaka Yoga', icon: '⚠️', note: 'Inauspicious yoga, best avoided for new work.' },
  kakracha_yoga: { label: 'Kakracha Yoga', icon: '⚠️', note: 'Avoid important decisions during this period.' },
  mrityu_yoga: { label: 'Mrityu Yoga', icon: '⚠️', note: 'Linked to danger — exercise extra caution.' },
  vidaal_yoga: { label: 'Vidaal Yoga', icon: '⚠️', note: 'Inauspicious yoga, avoid new beginnings.' },
  aadal_yoga: { label: 'Aadal Yoga', icon: '⚠️', note: 'Inauspicious yoga, avoid new beginnings.' },
};

function cleanValue(value) {
  if (value === null || value === undefined || value === '') return 'Not available';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(cleanValue).join(', ');
  return Object.entries(value)
    .filter(([, nested]) => nested !== null && nested !== undefined && nested !== '')
    .map(([key, nested]) => `${titleize(key)}: ${cleanValue(nested)}`)
    .join(' | ');
}

function simplifyValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === 'name') return value.name;
  }
  return value;
}

function titleize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function to12h(timeStr) {
  if (!timeStr) return '';
  if (/am|pm/i.test(timeStr)) return timeStr;
  return String(timeStr).replace(/(\d{1,2}):(\d{2})(?::\d{2})?/g, (_, h, m) => {
    const hour = parseInt(h, 10);
    if (Number.isNaN(hour)) return `${h}:${m}`;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${suffix}`;
  });
}

// Converts a bare "minutes since midnight" number (e.g. 369) into a
// 12-hour clock string ("6:09 AM"). This is the safety-net for whenever
// the backend sends raw integer minutes instead of a formatted time —
// whatever shape arrives, this guarantees a correct on-screen time.
function minutesToClock(totalMinutesRaw) {
  const total = Math.round(Number(totalMinutesRaw));
  if (Number.isNaN(total)) return '';
  const normalized = ((total % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

// Extracts just the HH:MM portion of a full "2026-07-08 10:38:00" style
// string and formats it — used everywhere we want a clean time without
// the date prefix cluttering the row. This is the ONLY function that
// should be used to render a single time value; to12h() alone is not
// enough because it leaves any leading date text untouched.
//
// FIX: now also detects a bare numeric value (e.g. "369" or 369) and
// treats it as minutes-since-midnight, converting it directly — this is
// what fixes the raw "369 - 468" style labels regardless of whether the
// backend has actually started sending formatted times yet.
function formatTimeOnly(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  const text = String(raw).trim();
  if (/^\d+(\.\d+)?$/.test(text)) {
    return minutesToClock(text);
  }
  const match = text.match(/(\d{1,2}):(\d{2})/);
  return match ? to12h(match[0]) : to12h(text);
}

// Cleans a "start - end" style range where start/end may themselves be
// full "YYYY-MM-DD HH:MM:SS" strings (as DivineAPI returns for muhurat
// windows). Strips the date on both sides so only "4:23 AM - 5:05 AM"
// is ever shown, never "2026-07-10 4:23 AM - 2026-07-10 5:05 AM".
function formatTimeRangeClean(value) {
  if (!value) return '';
  const parts = String(value).split(' - ');
  if (parts.length === 2) {
    return `${formatTimeOnly(parts[0])} - ${formatTimeOnly(parts[1])}`;
  }
  return formatTimeOnly(value);
}

function firstTimePart(value) {
  if (!value) return '';
  return String(value).split(' - ')[0].trim();
}

// Compact single time, date-prefix stripped, no spaces (used in tight
// timeline labels like the Choghadiya strip).
function shortTime(value) {
  return formatTimeOnly(firstTimePart(value)).replace(/\s/g, '');
}

// FIX: now also handles a bare numeric value (e.g. "369") by treating it
// directly as minutes-since-midnight, instead of only parsing "HH:MM"
// style strings. This is what makes the Choghadiya timeline's "Now"
// marker, active-period highlight, and "Next" calculation correct even
// when the backend sends raw minute numbers for start/end.
function parseTimeToMinutes(value) {
  if (value === null || value === undefined || value === '') return null;
  const text = String(value).trim();

  if (/^\d+(\.\d+)?$/.test(text)) {
    return Math.round(Number(text)) % 1440;
  }

  const iso = text.match(/T?(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (!iso) return null;

  let hour = parseInt(iso[1], 10);
  const minute = parseInt(iso[2], 10);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  if (/pm/i.test(text) && hour !== 12) hour += 12;
  if (/am/i.test(text) && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function normalizeEndMinutes(startMinutes, endMinutes) {
  if (startMinutes === null || endMinutes === null) return endMinutes;
  return endMinutes <= startMinutes ? endMinutes + 24 * 60 : endMinutes;
}

function periodStart(item) {
  return item?.start || item?.start_time || firstTimePart(item?.time);
}

function periodEnd(item) {
  if (item?.end || item?.end_time) return item.end || item.end_time;
  const parts = String(item?.time || '').split(' - ');
  return parts[1]?.trim() || '';
}

// Pulls a clean list of {start, end, sign} windows out of a raw
// auspicious/inauspicious timing value, whether it's a single object
// (Rahu Kaal) or an array of windows (some yogas fire more than once
// in a day). Used by MuhuratList to print each window as its own row.
function extractPeriods(value) {
  const list = Array.isArray(value) ? value : [value];
  return list
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const start = item.start_time || item.start;
      const end = item.end_time || item.end;
      if (!start || !end) return null;
      return { start, end, sign: item.sign };
    })
    .filter(Boolean);
}

function choghadiyaColor(name) {
  const key = String(name || '').toLowerCase();
  if (key.includes('rog') || key.includes('kaal') || key.includes('udveg')) {
    return { bg: '#f4b7b7', text: '#6f1d1b' };
  }
  if (key.includes('shubh')) return { bg: '#b8d991', text: '#184312' };
  if (key.includes('char') || key.includes('labh') || key.includes('amrit')) {
    return { bg: '#b8d991', text: '#184312' };
  }
  return { bg: '#ffc86f', text: '#6c3a00' };
}

function cardStyle(extra = {}) {
  return {
    background: 'white',
    borderRadius: 'var(--radius-lg)',
    padding: '24px 26px',
    border: '1px solid var(--cream-dark)',
    boxShadow: '0 2px 16px var(--shadow)',
    marginBottom: 20,
    ...extra,
  };
}

function Card({ children, style }) {
  return <div style={cardStyle(style)}>{children}</div>;
}

function LoadingState({ message = 'Consulting the stars...' }) {
  return (
    <div style={{ textAlign: 'center', padding: '54px 20px' }}>
      <Loader2 size={38} color="var(--saffron)" style={{ animation: 'spin .8s linear infinite', marginBottom: 14 }} />
      <p style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', fontSize: 17 }}>{message}</p>
      <p style={{ color: 'var(--text-light)', fontSize: 13, marginTop: 6 }}>
        Fetching Panchang, Choghadiya and timings from Divine API
      </p>
    </div>
  );
}

function SectionTitle({ icon, children, sub }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 16,
        color: 'var(--brown)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: 'linear-gradient(135deg,var(--saffron),var(--saffron-dark))',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
        }}>
          {icon}
        </span>
        {children}
      </h3>
      {sub && <p style={{ fontFamily: UI_FONT, color: 'var(--text-light)', fontSize: 13, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

// FIX: timing value used to be rendered with a raw to12h() call, which
// only converts the HH:MM portion and leaves any leading "YYYY-MM-DD "
// text untouched — producing an oversized, wrapping, hard-to-read line
// like "2026-07-10 4:23 AM - 2026-07-10 5:05 AM". Switched to
// formatTimeRangeClean() (date-stripped) and trimmed the font down so
// the card stays compact and legible.
function TimingCard({ title, value, note, tone }) {
  const tones = {
    green: ['#f0fdf4', '#22c55e', '#16a34a', '↟'],
    blue: ['#eff6ff', '#3b82f6', '#2563eb', '✳'],
    red: ['#fef2f2', '#ef4444', '#dc2626', '⊘'],
  };
  const [bg, label, text, mark] = tones[tone] || tones.blue;
  return (
    <div style={{ background: bg, border: 'none', borderRadius: 12, padding: '15px 16px 13px', minHeight: 88, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <p style={{ fontFamily: UI_FONT, fontSize: 12, color: label, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>
        <span style={{ marginRight: 7 }}>{mark}</span>{title}
      </p>
      <p style={{ fontFamily: UI_FONT, fontSize: 14.5, color: text, fontWeight: 800, marginTop: 8, lineHeight: 1.4 }}>
        {formatTimeRangeClean(value) || 'Not available'}
      </p>
      <p style={{ fontFamily: UI_FONT, fontSize: 12, color: label, fontWeight: 700, marginTop: 4, lineHeight: 1.25 }}>
        {note}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Astrotalk-style "Today Panchang" building blocks                   */
/*  — sun/moon icon strip, clean key-value facts table, samvat panel,  */
/*  planetary positions, and a muhurat list — all restyled to the      */
/*  existing saffron/gold/brown BharatMandir theme.                    */
/* ------------------------------------------------------------------ */

// FIX: was `to12h(cleanValue(value))`, which — same issue as TimingCard
// above — left the date prefix in place for any full "YYYY-MM-DD HH:MM:SS"
// value. formatTimeOnly() strips it, so every row shows a clean "4:23 AM"
// instead of "2026-07-10 4:23 AM".
function detailTime(value) {
  return formatTimeOnly(cleanValue(value));
}

// Horizontal Sunrise / Sunset / Moonrise / Moonset strip, mirroring the
// icon-over-label-over-value layout Astrotalk uses right under the
// location/date line on their Today Panchang page.
function SunMoonStrip({ sunrise, sunset, moonrise, moonset }) {
  const items = [
    { emoji: '☀️', label: 'Sunrise', value: sunrise },
    { emoji: '🌇', label: 'Sunset', value: sunset },
    { emoji: '🌕', label: 'Moonrise', value: moonrise },
    { emoji: '🌑', label: 'Moonset', value: moonset },
  ];
  return (
    <div className="sunmoon-strip" style={{
      display: 'flex', flexWrap: 'wrap', gap: 10,
      background: 'linear-gradient(135deg,#fff8ee,#fdf0da)',
      border: '1px solid #f3e2c4', borderRadius: 16, padding: '18px 16px',
    }}>
      {items.map((item) => (
        <div key={item.label} style={{
          flex: '1 1 130px', minWidth: 120, display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 6, padding: '4px 6px',
        }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>{item.emoji}</span>
          <span style={{ fontFamily: UI_FONT, fontSize: 10.5, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9a6738' }}>
            {item.label}
          </span>
          <span style={{ fontFamily: UI_FONT, fontSize: 16.5, fontWeight: 900, color: '#2b1608' }}>
            {detailTime(item.value) || '--:--'}
          </span>
        </div>
      ))}
    </div>
  );
}

// Clean two-column key/value table for the core five Panchang limbs
// (Tithi, Nakshatra, Yoga, Karana) plus Paksha and Weekday — matching
// the plain, scannable table Astrotalk shows ("Nakshatra | Vishakha
// upto 12:15") instead of a grid of separate cards.
function KeyFactsTable({ dailyResult }) {
  const rows = [
    { label: 'Tithi', value: dailyResult.tithi?.name, end: dailyResult.tithi?.end_time },
    { label: 'Nakshatra', value: dailyResult.nakshatra?.name, end: dailyResult.nakshatra?.end_time },
    { label: 'Yoga', value: dailyResult.yoga?.name, end: dailyResult.yoga?.end_time },
    { label: 'Karana', value: dailyResult.karana?.name, end: dailyResult.karana?.end_time },
    { label: 'Paksha', value: dailyResult.tithi?.paksha },
    { label: 'Weekday', value: dailyResult.var?.day },
  ].filter((row) => row.value);

  if (!rows.length) return <EmptyState text="Panchang details are not available for this date." />;

  return (
    <div style={{ border: '1px solid #eee2d2', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
      {rows.map((row, index) => (
        <div
          key={row.label}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            padding: '13px 18px', background: index % 2 === 0 ? '#fffaf3' : '#fff',
            borderBottom: index < rows.length - 1 ? '1px solid #f2e9da' : 'none',
          }}
        >
          <span style={{ fontFamily: UI_FONT, fontSize: 12.5, fontWeight: 900, color: '#9a6738', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {row.label}
          </span>
          <span style={{ fontFamily: UI_FONT, fontSize: 14.5, fontWeight: 800, color: '#251505', textAlign: 'right' }}>
            {row.value}{row.end ? ` upto ${shortTime(row.end)}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}

// Optional Shaka Samvat / Vikram Samvat rows — only rendered when the
// backend actually sends this data, same two-column table style as
// KeyFactsTable so the two panels read as one family.
function SamvatTable({ dailyResult }) {
  const rows = [];
  if (dailyResult.shaka_samvat) rows.push({ label: 'Shaka Samvat', value: cleanValue(dailyResult.shaka_samvat) });
  if (dailyResult.vikram_samvat) rows.push({ label: 'Vikram Samvat', value: cleanValue(dailyResult.vikram_samvat) });
  if (!rows.length) return null;

  return (
    <div style={{ border: '1px solid #eee2d2', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
      {rows.map((row, index) => (
        <div
          key={row.label}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            padding: '13px 18px', background: index % 2 === 0 ? '#fffaf3' : '#fff',
            borderBottom: index < rows.length - 1 ? '1px solid #f2e9da' : 'none',
          }}
        >
          <span style={{ fontFamily: UI_FONT, fontSize: 12.5, fontWeight: 900, color: '#9a6738', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {row.label}
          </span>
          <span style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 800, color: '#251505', textAlign: 'right' }}>
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// Optional Planetary Positions table (Ascendant + grahas with Rashi /
// Longitude / Nakshatra / Pada) — only rendered when the backend sends
// this data, using the same generic PanchangTable used elsewhere.
function PlanetaryPositionsPanel({ positions }) {
  if (!positions?.length) return null;
  const rows = positions.map((p, index) => ({
    id: `${p.planet || p.name || 'planet'}-${index}`,
    planet: p.planet || p.name,
    rashi: p.rashi || p.sign,
    longitude: p.longitude,
    nakshatra: p.nakshatra,
    pada: p.pada,
  }));
  return (
    <Panel icon={<Star size={16} />} title="Planetary Positions" accent="#7c3aed">
      <PanchangTable
        rows={rows}
        emptyText="Planetary position data is not available for this date."
        columns={[
          { key: 'planet', label: 'Planet', width: '22%', render: (row) => <strong>{row.planet || 'Not available'}</strong> },
          { key: 'rashi', label: 'Rashi', width: '20%' },
          { key: 'longitude', label: 'Longitude', width: '20%' },
          { key: 'nakshatra', label: 'Nakshatra', width: '26%' },
          { key: 'pada', label: 'Pada', align: 'center' },
        ]}
      />
    </Panel>
  );
}

// Auspicious / Inauspicious Timings — restyled to match the same clean,
// two-column "Panchang Details" row-table look (KeyFactsTable /
// SamvatTable) instead of the previous boxed-card list: label on the
// left (uppercase, small, brown), the "From ... To ..." time range on
// the right (bold, tone-colored), alternating row background, and an
// optional one-line note underneath when the meaning dictionary has one.
function MuhuratList({ data, tone, meanings, emptyText }) {
  const isRed = tone === 'red';
  const valueColor = isRed ? '#dc2626' : '#15803d';
  const noteColor = isRed ? '#b45309' : '#8a7256';

  const rows = [];
  Object.entries(data || {}).forEach(([key, value]) => {
    if (key.toLowerCase().endsWith('_detailed')) return;
    const meta = meanings?.[key.toLowerCase()] || { label: titleize(key), note: '' };
    const periods = extractPeriods(value);
    periods.forEach((period, index) => {
      rows.push({
        id: `${key}-${index}`,
        name: meta.label,
        from: formatTimeOnly(period.start),
        to: formatTimeOnly(period.end),
        sign: period.sign,
        note: index === 0 ? meta.note : '',
      });
    });
  });

  if (!rows.length) return <EmptyState text={emptyText} />;

  return (
    <div style={{ border: '1px solid #eee2d2', borderRadius: 14, overflow: 'hidden', background: '#fff' }}>
      {rows.map((row, index) => (
        <div
          key={row.id}
          style={{
            padding: '13px 18px',
            background: index % 2 === 0 ? '#fffaf3' : '#fff',
            borderBottom: index < rows.length - 1 ? '1px solid #f2e9da' : 'none',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: UI_FONT, fontSize: 12.5, fontWeight: 900, color: '#9a6738', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              {row.name}{row.sign ? <span style={{ opacity: 0.75 }}>{` (${row.sign})`}</span> : null}
            </span>
            <span style={{ fontFamily: UI_FONT, fontSize: 14.5, fontWeight: 800, color: valueColor, textAlign: 'right', whiteSpace: 'nowrap' }}>
              From {row.from || '—'} · To {row.to || '—'}
            </span>
          </div>
          {row.note && (
            <p style={{ fontFamily: UI_FONT, fontSize: 12, color: noteColor, marginTop: 5, lineHeight: 1.5 }}>
              {row.note}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Premium building blocks for the "Full Panchang Details" panel      */
/* ------------------------------------------------------------------ */

function Panel({ icon, title, accent = '#c47a14', right, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #ececec', borderRadius: 16, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: `${accent}18`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </span>
          <h4 style={{ fontFamily: UI_FONT, fontSize: 15, fontWeight: 900, color: '#1f1f1f', margin: 0 }}>{title}</h4>
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Badge({ children }) {
  return (
    <span style={{
      fontFamily: UI_FONT, fontSize: 10, fontWeight: 900, color: '#9a5d12',
      background: '#fff1d9', borderRadius: 50, padding: '2px 9px',
      letterSpacing: '.04em', textTransform: 'uppercase',
    }}>
      {children}
    </span>
  );
}

function EmptyState({ text }) {
  return (
    <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#a3a3a3', fontStyle: 'italic', padding: '10px 0', textAlign: 'center', margin: 0 }}>
      {text}
    </p>
  );
}

function PanchangTable({ columns, rows, emptyText = 'No information available.' }) {
  if (!rows?.length) return <EmptyState text={emptyText} />;

  return (
    <div className="panchang-table-shell">
      <div className="panchang-table-scroll">
        <table className="panchang-data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} style={{ width: column.width, textAlign: column.align || 'left' }}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={row.id ?? rowIndex} style={{ animationDelay: `${rowIndex * 55}ms` }}>
                {columns.map((column) => (
                  <td key={column.key} data-label={column.label} style={{ textAlign: column.align || 'left' }}>
                    {column.render ? column.render(row, rowIndex) : row[column.key] || '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableName({ icon, name, badges = [], accent = '#d45508' }) {
  return (
    <div className="table-name-cell">
      <span className="table-name-icon" style={{ color: accent, background: `${accent}14`, borderColor: `${accent}35` }}>
        {icon}
      </span>
      <div>
        <strong>{name || 'Not available'}</strong>
        {!!badges.length && (
          <div className="table-badge-row">
            {badges.map((badge) => <Badge key={badge}>{badge}</Badge>)}
          </div>
        )}
      </div>
    </div>
  );
}

function TableChips({ chips = [], accent = '#d45508' }) {
  if (!chips.length) return <span className="table-empty-value">No additional details</span>;
  return (
    <div className="table-chip-list">
      {chips.map((chip) => (
        <span
          key={`${chip.key}-${chip.value}`}
          className="table-detail-chip"
          style={{ color: accent, background: `${accent}10`, borderColor: `${accent}28` }}
        >
          <strong>{chip.label}:</strong> {chip.value}
        </span>
      ))}
    </div>
  );
}

const NAME_KEYS = ['tithi', 'nak_name', 'nakshatra_name', 'yoga_name', 'karana_name'];
const TIME_KEYS = new Set(['start_time', 'start', 'end_time', 'end']);

// One raw anga record (tithi/nakshatra/yoga/karana) → { name, startRaw,
// endRaw, badges, chips }. This is the layer that decides what's worth
// showing and what it should be called, instead of dumping every key.
function buildAngaCard(record) {
  if (!record || typeof record !== 'object') return null;
  const nameKey = NAME_KEYS.find((key) => record[key]);
  const name = (nameKey ? record[nameKey] : record.name) || '';
  if (!name) return null;

  const startRaw = record.start_time || record.start;
  const endRaw = record.end_time || record.end;

  const badges = [];
  if (record.vriddhi === true || record.vriddhi === 'true') badges.push('Vriddhi');
  if (record.kshaya === true || record.kshaya === 'true') badges.push('Kshaya');

  const chips = Object.entries(record)
    .filter(([key]) => !HIDDEN_KEYS.has(key) && !TIME_KEYS.has(key) && key !== nameKey && key !== 'name')
    .map(([key, value]) => ({ key, label: LABEL_MAP[key] || titleize(key), value: cleanValue(simplifyValue(value)) }))
    .filter((chip) => chip.value && chip.value !== 'Not available');

  chips.sort((a, b) => {
    const ai = FIELD_PRIORITY.indexOf(a.key);
    const bi = FIELD_PRIORITY.indexOf(b.key);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return { name, startRaw, endRaw, badges, chips };
}

// Replaces the old raw key-dump list. One clean row per Tithi/Nakshatra/
// Yoga/Karana: icon, name (+ Vriddhi/Kshaya badge if applicable), a
// readable time range, and secondary attributes as small chips.
// Builds a readable time range for each row, working around a real gap in
// DivineAPI's own data: entries in these lists (nakshatra pada, sun
// nakshatras, etc.) generally only carry an END boundary per record, not a
// start — the convention is that one segment's start is the previous
// segment's end. This chains endRaw -> next row's startRaw so "Moola" (end
// only) reads as "Until 10:28 AM" and the following row reads
// "10:28 AM – <its end>" instead of concatenating a "Start unavailable"
// placeholder straight onto the end time with no separator.
function AngaSection({ title, icon, accent, records }) {
  const cards = (Array.isArray(records) ? records : []).map(buildAngaCard).filter(Boolean);

  let previousEnd = null;
  const rows = cards.map((row, index) => {
    const startRaw = row.startRaw || previousEnd;
    const endRaw = row.endRaw;
    const startLabel = formatTimeOnly(startRaw);
    const endLabel = formatTimeOnly(endRaw);

    let time;
    if (startLabel && endLabel) {
      time = `${startLabel} – ${endLabel}`;
    } else if (endLabel) {
      time = `Until ${endLabel}`;
    } else if (startLabel) {
      time = `From ${startLabel}`;
    } else {
      time = 'Not available';
    }

    if (endRaw) previousEnd = endRaw;

    return { ...row, id: `${row.name}-${index}`, time };
  });
  return (
    <Panel
      icon={icon}
      title={title}
      accent={accent}
      right={<span className="record-count" style={{ color: accent, background: `${accent}12`, borderColor: `${accent}30` }}>{rows.length} {rows.length === 1 ? 'record' : 'records'}</span>}
    >
      <PanchangTable
        rows={rows}
        emptyText="No records available for this date."
        columns={[
          {
            key: 'name', label: 'Name', width: '25%',
            render: (row) => <TableName icon={icon} name={row.name} badges={row.badges} accent={accent} />,
          },
          {
            key: 'time', label: 'Active Period', width: '25%',
            render: (row) => <span className="table-time-pill" style={{ color: accent, background: `${accent}10`, borderColor: `${accent}30` }}><Clock size={14} />{row.time}</span>,
          },
          {
            key: 'details', label: 'Panchang Details',
            render: (row) => <TableChips chips={row.chips} accent={accent} />,
          },
        ]}
      />
    </Panel>
  );
}

// FIX: item.time subtitle used raw to12h() — switched to formatTimeOnly()
// so a full datetime string doesn't leak the date into the chip.
function ChoghadiyaChips({ rows }) {
  const tableRows = rows.map((item, index) => ({
    id: `${item.name}-${index}`,
    name: item.name || 'Choghadiya',
    nature: item.nature || 'neutral',
    time: formatTimeRangeClean(item.time),
    colors: choghadiyaColor(item.name),
  }));
  return (
    <PanchangTable
      rows={tableRows}
      emptyText="No Choghadiya information available."
      columns={[
        {
          key: 'name', label: 'Choghadiya', width: '35%',
          render: (row) => <TableName icon={<Moon size={15} />} name={row.name} accent={row.colors.text} />,
        },
        {
          key: 'nature', label: 'Nature', width: '25%',
          render: (row) => <span className="nature-badge" style={{ color: row.colors.text, background: row.colors.bg }}>{titleize(row.nature)}</span>,
        },
        {
          key: 'time', label: 'Timing',
          render: (row) => <span className="table-time-pill"><Clock size={14} />{row.time || 'Not available'}</span>,
        },
      ]}
    />
  );
}

function PanchangDetails({ dailyResult }) {
  const angaGroups = [
    { key: 'tithis', title: 'All Tithis', icon: <Moon size={16} />, accent: '#c47a14', records: dailyResult.all_panchang?.tithis },
    { key: 'nakshatras', title: 'All Nakshatras', icon: <Star size={16} />, accent: '#2563eb', records: dailyResult.all_panchang?.nakshatras },
    { key: 'yogas', title: 'All Yogas', icon: <span style={{ fontSize: 16 }}>∞</span>, accent: '#7c3aed', records: dailyResult.all_panchang?.yogas },
    { key: 'karnas', title: 'All Karanas', icon: <span style={{ fontSize: 14 }}>□</span>, accent: '#0f766e', records: dailyResult.all_panchang?.karnas },
    { key: 'sun_nakshatras', title: 'Sun Nakshatras', icon: <Sun size={16} />, accent: '#d97706', records: dailyResult.all_panchang?.sun_nakshatras },
  ];

  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <h3 style={{ fontFamily: UI_FONT, fontSize: 18, color: '#1f1f1f', fontWeight: 900, margin: 0 }}>
          Full Panchang Details
        </h3>
        <span style={{ fontFamily: UI_FONT, fontSize: 12, color: '#8b8b8b', fontWeight: 800 }}>
          Complete Panchang records for this date
        </span>
      </div>

      <div style={{ display: 'grid', gap: 14 }}>
        {angaGroups.map((group) => (
          <AngaSection key={group.key} title={group.title} icon={group.icon} accent={group.accent} records={group.records} />
        ))}
      </div>
    </div>
  );
}

function PanchangDailyResult({ dailyResult }) {
  const dayChoghadiya = (dailyResult.choghadiya || []).filter((item) => item.period !== 'night');
  const nightChoghadiya = (dailyResult.choghadiya || []).filter((item) => item.period === 'night');
  const hasSamvat = Boolean(dailyResult.shaka_samvat || dailyResult.vikram_samvat);

  return (
    <div style={{ animation: 'fadeDown .5s ease both' }}>
      <div style={{ background: '#fff1d9', border: '1px solid #f8dfb9', borderLeft: '4px solid #c47a14', borderRadius: 7, padding: '14px 17px', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8 }}>
          <Sparkles size={14} color="#9a5d12" />
          <span style={{ fontFamily: UI_FONT, fontSize: 12, color: '#8b5a24', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Today At A Glance
          </span>
        </div>
        <p style={{ fontFamily: UI_FONT, fontSize: 14, color: '#6f421c', lineHeight: 1.55, margin: 0, fontWeight: 700 }}>
          {dailyResult.today_at_glance || `${dailyResult.var?.day}: ${dailyResult.tithi?.name}, ${dailyResult.nakshatra?.name}. Sunrise ${dailyResult.sunrise}, sunset ${dailyResult.sunset}.`}
        </p>
      </div>

      {/* Sunrise / Sunset / Moonrise / Moonset — Astrotalk-style icon strip */}
      <div style={{ marginBottom: 20 }}>
        <SunMoonStrip
          sunrise={dailyResult.sunrise}
          sunset={dailyResult.sunset}
          moonrise={dailyResult.moonrise}
          moonset={dailyResult.moonset}
        />
      </div>

      {/* Tithi / Nakshatra / Yoga / Karana / Paksha / Weekday — clean table,
          plus Samvat alongside it when the backend provides that data. */}
      <div className="panchang-key-grid" style={{ display: 'grid', gridTemplateColumns: hasSamvat ? '1.4fr 1fr' : '1fr', gap: 16, marginBottom: 20 }}>
        <div>
          <SectionTitle icon={<Moon size={14} />}>Panchang Details</SectionTitle>
          <KeyFactsTable dailyResult={dailyResult} />
        </div>
        {hasSamvat && (
          <div>
            <SectionTitle icon={<Star size={14} />}>Samvat</SectionTitle>
            <SamvatTable dailyResult={dailyResult} />
          </div>
        )}
      </div>

      {!!dayChoghadiya.length && (
        <ChoghadiyaTimeline
          title="Day Choghadiya"
          rows={dayChoghadiya}
          sunrise={dailyResult.sunrise}
          sunset={dailyResult.sunset}
        />
      )}

      {!!nightChoghadiya.length && (
        <ChoghadiyaTimeline
          title="Night Choghadiya"
          rows={nightChoghadiya}
          sunrise={dailyResult.sunset}
          sunset={dailyResult.sunrise}
        />
      )}

      <div className="panchang-timings" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        <TimingCard title="Brahma" value={dailyResult.brahma_muhurat?.time} note={dailyResult.brahma_muhurat?.benefit || 'Spiritual practice'} tone="green" />
        <TimingCard title="Abhijit" value={dailyResult.abhijit_muhurat?.time} note={dailyResult.abhijit_muhurat?.benefit || 'Auspicious work'} tone="blue" />
        <TimingCard title="Rahu Kaal" value={dailyResult.rahu_kaal?.time} note={dailyResult.rahu_kaal?.benefit || 'Avoid new beginnings'} tone="red" />
      </div>

      {/* Inauspicious Timings — clean Panchang-Details-style row table. */}
      <div style={{ marginBottom: 22 }}>
        <SectionTitle icon={<AlertCircle size={14} />}>Inauspicious Timings (Ashubh Muhurat)</SectionTitle>
        <MuhuratList
          data={dailyResult.inauspicious_timings}
          tone="red"
          meanings={INAUSPICIOUS_MEANINGS}
          emptyText="No inauspicious timings available for this date."
        />
      </div>

      {/* Auspicious Timings — same row-table format, in green. */}
      <div style={{ marginBottom: 22 }}>
        <SectionTitle icon={<Sparkles size={14} />}>Auspicious Timings (Shubh Muhurat)</SectionTitle>
        <MuhuratList
          data={dailyResult.auspicious_timings}
          tone="green"
          meanings={AUSPICIOUS_MEANINGS}
          emptyText="No auspicious timings available for this date."
        />
      </div>

      {!!dailyResult.planetary_positions?.length && (
        <div style={{ marginBottom: 22 }}>
          <PlanetaryPositionsPanel positions={dailyResult.planetary_positions} />
        </div>
      )}

      <PanchangDetails dailyResult={dailyResult} />
    </div>
  );
}

function ChoghadiyaTimeline({ title, rows, sunrise, sunset }) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const segments = rows.map((item, index) => {
    const start = parseTimeToMinutes(periodStart(item));
    const end = normalizeEndMinutes(start, parseTimeToMinutes(periodEnd(item)));
    return { ...item, index, start, end };
  });
  const active = segments.find((item) => {
    if (item.start === null || item.end === null) return false;
    const adjustedNow = nowMinutes < item.start && item.end > 24 * 60 ? nowMinutes + 24 * 60 : nowMinutes;
    return adjustedNow >= item.start && adjustedNow <= item.end;
  });
  let activePosition = null;
  if (active && active.end > active.start) {
    const adjustedNow = nowMinutes < active.start && active.end > 24 * 60
      ? nowMinutes + 24 * 60
      : nowMinutes;
    const fraction = Math.max(0, Math.min(1, (adjustedNow - active.start) / (active.end - active.start)));
    activePosition = ((active.index + fraction) / Math.max(segments.length, 1)) * 100;
  }
  const next = segments.find((item) => {
    if (item.start === null) return false;
    const adjustedStart = item.start < nowMinutes ? item.start + 24 * 60 : item.start;
    return adjustedStart > nowMinutes;
  }) || segments[0];
  const current = active || segments[0];
  const minutesToNext = next?.start !== null && next?.start !== undefined
    ? Math.max(0, Math.round(((next.start < nowMinutes ? next.start + 24 * 60 : next.start) - nowMinutes)))
    : null;

  return (
    <div style={{ background: '#fff', border: '1px solid #e6e6e6', borderRadius: 11, padding: '12px 14px 11px', margin: '10px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={14} color="#4b5563" />
          <span style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 800, color: '#1a1a1a' }}>{title}</span>
        </div>
        <span style={{ fontFamily: UI_FONT, fontSize: 10.5, color: '#8b8b8b', fontWeight: 800 }}>{shortTime(sunrise)} → {shortTime(sunset)}</span>
      </div>

      <div style={{ position: 'relative', paddingTop: 13 }}>
        {activePosition !== null && (
          <div style={{ position: 'absolute', left: `${activePosition}%`, top: -13, transform: 'translateX(-50%)', zIndex: 3 }}>
            <div style={{ background: '#0f355d', color: 'white', borderRadius: 10, padding: '3px 7px', fontFamily: UI_FONT, fontSize: 9, fontWeight: 900, whiteSpace: 'nowrap', boxShadow: '0 3px 8px rgba(0,0,0,.14)' }}>
              Now · {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </div>
            <div style={{ width: 2, height: 42, background: '#0f355d', margin: '-1px auto 0' }} />
          </div>
        )}

        <div style={{ display: 'flex', overflow: 'hidden', borderRadius: 6 }}>
          {segments.map((item, index) => {
            const colors = choghadiyaColor(item.name);
            return (
              <div key={`${item.name}-${index}`} style={{ flex: '1 0 68px', background: colors.bg, borderRight: index < segments.length - 1 ? '1px solid rgba(255,255,255,.55)' : 'none', minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: UI_FONT, color: colors.text, fontSize: 10.5, fontWeight: 800 }}>{item.name || '—'}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', marginTop: 5 }}>
          {segments.map((item, index) => (
            <div key={`${item.name}-time-${index}`} style={{ flex: '1 0 68px', fontFamily: UI_FONT, color: '#8a8a8a', fontSize: 8.5, fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'left' }}>
              {shortTime(periodStart(item))}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, borderTop: '1px solid #eeeeee', marginTop: 10, paddingTop: 9 }}>
        <div style={{ background: '#eef7e3', borderRadius: 7, padding: '7px 9px' }}>
          <p style={{ fontFamily: UI_FONT, fontSize: 8.5, color: '#6b8d4d', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', margin: 0 }}>Currently In</p>
          <p style={{ fontFamily: UI_FONT, fontSize: 11.5, color: '#285c1f', fontWeight: 900, margin: '2px 0 0' }}>
            {current?.name || 'Not available'} {current ? `· ${shortTime(periodStart(current))}-${shortTime(periodEnd(current))}` : ''}
          </p>
        </div>
        <div style={{ background: '#fafafa', borderRadius: 7, padding: '7px 9px' }}>
          <p style={{ fontFamily: UI_FONT, fontSize: 8.5, color: '#8b8b8b', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', margin: 0 }}>Next</p>
          <p style={{ fontFamily: UI_FONT, fontSize: 11.5, color: '#292929', fontWeight: 900, margin: '2px 0 0' }}>
            {next?.name || 'Not available'}{minutesToNext !== null ? ` · in ${minutesToNext} min` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function PanchangPage() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(null);
  const [date, setDate] = useState(TODAY);
  const [rashi, setRashi] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [dailyResult, setDailyResult] = useState(null);
  const [dailyError, setDailyError] = useState(null);
  const [muhuratError, setMuhuratError] = useState(null);

  // ── Location auto-fill (same navigator.geolocation logic as the
  // Temple Search page's "Search Nearby" feature). Coordinates are
  // captured directly and, where the backend supports it (the /daily
  // Panchang endpoint accepts latitude/longitude), sent straight through
  // — the city text is only used for display and for the Muhurat
  // endpoint, which is city-text only.
  const [locLoading, setLocLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [usingLocation, setUsingLocation] = useState(false);
  const [userCoords, setUserCoords] = useState(null);

  const selectedType = MUHURAT_TYPES.find((m) => m.id === selected);

  // Reverse-geocodes lat/lng into a human-readable "City, State" label
  // using OpenStreetMap's free Nominatim API (no key required), so the
  // City field autofills with an actual place name instead of raw
  // coordinates. If it fails for any reason, we fall back to showing the
  // coordinates themselves so the field is never left blank.
  const reverseGeocodeCity = async (latitude, longitude) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`
      );
      const data = await res.json();
      const addr = data.address || {};
      const cityName = addr.city || addr.town || addr.village || addr.municipality || addr.county || addr.state_district || '';
      const stateName = addr.state || '';
      const resolved = cityName
        ? (stateName && stateName !== cityName ? `${cityName}, ${stateName}` : cityName)
        : `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
      setCity(resolved);
    } catch (err) {
      setCity(`${latitude.toFixed(3)}, ${longitude.toFixed(3)}`);
    } finally {
      setLocLoading(false);
    }
  };

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Your browser does not support location access.');
      return;
    }
    setLocLoading(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserCoords({ lat: latitude, lng: longitude });
        setUsingLocation(true);
        setDailyError(null);
        reverseGeocodeCity(latitude, longitude);
      },
      () => {
        setLocationError('Location access denied. Please allow location in your browser and try again.');
        setLocLoading(false);
      },
      { timeout: 10000 }
    );
  };

  // Lets the person drop back into manual typing at any time — clears
  // the detected coordinates and the auto-filled text so CityAutocomplete
  // behaves exactly as it did before (free typing + its own suggestions).
  const clearLocation = () => {
    setUsingLocation(false);
    setUserCoords(null);
    setLocationError('');
    setCity('');
  };

  // Typing (or picking a suggestion) in either City field should stop
  // treating the request as location-based, so a manually-typed city
  // isn't silently overridden by stale coordinates.
  const handleCityChange = (val) => {
    setCity(val);
    setDailyError(null);
    setUsingLocation(false);
  };

  const fetchDailyPanchang = async () => {
    if (!city.trim() || dailyLoading) return;
    setDailyLoading(true);
    setDailyResult(null);
    setDailyError(null);
    try {
      const res = await fetch(`${API_BASE}/api/panchang/daily`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          city: city || 'India',
          // When the request came from "Use My Location", send the raw
          // coordinates too — the backend's normalize_city() prefers
          // explicit latitude/longitude over free-text city geocoding,
          // so this is more accurate than re-geocoding the label text.
          ...(usingLocation && userCoords ? { latitude: userCoords.lat, longitude: userCoords.lng } : {}),
        }),
      });
      const data = await res.json();
      // FIX: backend now returns a 422 with a clear message when the typed
      // city text isn't recognized (see routers/panchang.py normalize_city),
      // instead of silently generating Panchang for a wrong fallback city.
      // `!res.ok` already surfaces that message here — no change needed on
      // this side beyond making sure city text isn't trusted blindly.
      if (!res.ok) throw new Error(data.detail || 'Failed to load Panchang');
      setDailyResult(data);
    } catch (e) {
      setDailyError(e.message || 'Could not load Panchang');
    } finally {
      setDailyLoading(false);
    }
  };

  const findMuhurat = async () => {
    if (!selected) {
      setMuhuratError('Please select an occasion first.');
      return;
    }
    if (loading) return;
    setLoading(true);
    setResult(null);
    setMuhuratError(null);
    try {
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
          city: city || 'India',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to get Muhurat');
      setResult(data);
    } catch (e) {
      setMuhuratError(`Could not get Muhurat: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '11px 14px',
    border: '2px solid var(--cream-dark)',
    borderRadius: 'var(--radius)',
    fontFamily: UI_FONT,
    fontSize: 14,
    outline: 'none',
    transition: 'var(--transition)',
    color: 'var(--text-dark)',
    background: 'white',
  };
  const labelStyle = {
    fontFamily: UI_FONT,
    fontWeight: 700,
    fontSize: 11,
    letterSpacing: '.07em',
    textTransform: 'uppercase',
    color: 'var(--text-light)',
    display: 'block',
    marginBottom: 6,
  };
  const inlineErrorStyle = {
    background: '#FFF4F4',
    border: '1px solid #FFCDD2',
    borderRadius: 10,
    padding: '12px 14px',
    margin: '-2px 0 16px',
    display: 'flex',
    gap: 10,
    alignItems: 'flex-start',
    maxWidth: 640,
  };
  const locButtonStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    borderRadius: 20,
    border: '1.5px solid var(--saffron)',
    background: locLoading ? 'var(--cream-dark)' : 'rgba(232,101,10,0.06)',
    color: 'var(--saffron-dark)',
    fontFamily: UI_FONT,
    fontSize: 11,
    fontWeight: 800,
    cursor: locLoading ? 'wait' : 'pointer',
    whiteSpace: 'nowrap',
  };

  return (
    <>
      <Navbar />
      <div style={{ background: 'var(--cream)', minHeight: '100vh', paddingBottom: 80 }}>
        <section style={{
          position: 'relative',
          overflow: 'hidden',
          color: 'white',
          background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
          padding: '34px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 700, padding: '0 24px', boxSizing: 'border-box', textAlign: 'center' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,213,128,0.3)',
              borderRadius: 50,
              padding: '5px 16px',
              marginBottom: 10,
              color: 'rgba(255,213,128,0.85)',
              fontSize: 11,
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              fontWeight: 600,
              fontFamily: UI_FONT,
            }}>
              <Sun size={11} /> {t('panchang.badge')}
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 'clamp(28px, 5vw, 52px)',
              lineHeight: 1.1,
              marginBottom: 10,
              marginTop: 0,
              textShadow: '0 4px 40px rgba(0,0,0,0.3)',
              color: '#ffffff',
            }}>
              AI Pandit Ji - <span style={{ color: '#FFD580' }}>Panchang &amp; Muhurat</span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.74)', fontSize: 14, maxWidth: 540, margin: '0 auto', fontWeight: 300, lineHeight: 1.7, fontFamily: UI_FONT }}>
              {t('panchang.subtitle')}
            </p>
          </div>
        </section>

        <div className="container" style={{ maxWidth: 1050, paddingTop: 36 }}>
          <Card style={{ background: 'transparent', border: 'none', boxShadow: 'none', padding: 0, marginBottom: 28 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                <h2 style={{ fontFamily: UI_FONT, fontSize: 22, color: '#1f1f1f', fontWeight: 900, margin: 0 }}>
                  Today's Panchang
                </h2>
                <span style={{ fontFamily: UI_FONT, fontSize: 14, color: '#9a9a9a', fontWeight: 800 }}>
                  आज का पंचांग
                </span>
              </div>
              <p style={{ fontFamily: UI_FONT, fontSize: 14, color: '#6f6f6f', fontWeight: 800, margin: '5px 0 0' }}>
                {dailyResult
                  ? `${dailyResult.var?.day || ''}, ${dailyResult.display_date || date} · ${city || dailyResult.location?.name || 'India'} · ${[dailyResult.tithi?.paksha, dailyResult.tithi?.name].filter(Boolean).join(' ')}`
                  : 'Select date and city to view daily Panchang'}
              </p>
            </div>

            {/* Enter key anywhere in this block submits the Daily Panchang query */}
            <div
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !dailyLoading && city.trim()) {
                  e.preventDefault();
                  fetchDailyPanchang();
                }
              }}
            >
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 8 }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => { setDate(e.target.value); setResult(null); setDailyResult(null); }}
                    style={{ ...inputStyle, width: 192, height: 44, background: '#fff', border: '1px solid #e7d8c6', borderRadius: 9 }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>City *</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CityAutocomplete
                      value={city}
                      onChange={handleCityChange}
                      placeholder="e.g. Ujjain, Mumbai"
                      style={{ ...inputStyle, width: 240, height: 44, background: '#fff', border: `1px solid ${dailyError ? '#ef4444' : '#e7d8c6'}`, borderRadius: 9 }}
                    />
                    {usingLocation ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 44 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#eafaf1', color: '#27ae60', borderRadius: 20, padding: '3px 10px', fontFamily: UI_FONT, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
                          <MapPin size={11} /> Location detected
                        </span>
                        <button
                          type="button"
                          onClick={clearLocation}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-light)', fontFamily: UI_FONT, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '3px 4px', whiteSpace: 'nowrap' }}
                        >
                          <X size={11} /> Type manually
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={getUserLocation} disabled={locLoading} style={{ ...locButtonStyle, height: 44, padding: '0 14px' }}>
                        <Navigation size={11} />
                        {locLoading ? 'Locating…' : 'Use My Location'}
                      </button>
                    )}
                  </div>
                </div>
                <button className="btn-primary" onClick={fetchDailyPanchang} disabled={dailyLoading || !city.trim()} style={{ padding: '0 22px', height: 44, borderRadius: 9, background: '#EA580C', border: 'none', fontFamily: UI_FONT, fontWeight: 800 }}>
                  {dailyLoading ? (
                    <>
                      <Loader2 size={15} style={{ animation: 'spin .8s linear infinite' }} /> Loading...
                    </>
                  ) : (
                    <>
                      Get Panchang
                    </>
                  )}
                </button>
              </div>

              {locationError && (
                <p style={{ marginTop: 4, marginBottom: 12, fontSize: 12, color: '#c0392b', lineHeight: 1.5, background: '#fdecea', padding: '6px 10px', borderRadius: 6, maxWidth: 420 }}>
                  ⚠️ {locationError}
                </p>
              )}
            </div>

            {dailyError && (
              <div style={inlineErrorStyle}>
                <AlertCircle size={17} color="#D32F2F" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <p style={{ fontFamily: UI_FONT, color: '#C62828', fontSize: 14, fontWeight: 800, margin: 0 }}>
                    City not found
                  </p>
                  <p style={{ fontFamily: UI_FONT, color: '#9f1239', fontSize: 13, margin: '3px 0 0', lineHeight: 1.45 }}>
                    {dailyError}
                  </p>
                </div>
              </div>
            )}

            {dailyLoading && <LoadingState message="Loading Panchang..." />}
            {dailyResult && !dailyLoading && <PanchangDailyResult dailyResult={dailyResult} />}
          </Card>

          <PanchangCalendar />

          <Card>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--brown)', marginBottom: 4 }}>
              Muhurat Finder
            </h2>
            <p style={{ fontFamily: UI_FONT, fontSize: 14, color: 'var(--text-light)', marginBottom: 24 }}>
              Find the most auspicious time for your important occasion.
            </p>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Select Occasion</label>
              <div className="muhurat-occasion-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
                {MUHURAT_TYPES.map((m) => (
                  <button key={m.id} onClick={() => setSelected(m.id)} style={{
                    padding: '14px 8px',
                    borderRadius: 'var(--radius)',
                    border: `2px solid ${selected === m.id ? 'var(--saffron)' : 'var(--cream-dark)'}`,
                    background: selected === m.id ? 'rgba(232,101,10,0.07)' : 'white',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'var(--transition)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <Sparkles size={22} color={selected === m.id ? 'var(--saffron)' : 'var(--text-light)'} />
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: selected === m.id ? 'var(--saffron-dark)' : 'var(--brown)', fontWeight: 800, lineHeight: 1.2 }}>{m.label}</span>
                    <span style={{ fontFamily: UI_FONT, fontSize: 10, color: 'var(--text-light)' }}>{m.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Enter key anywhere in this block submits the Muhurat search */}
            <div
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) {
                  e.preventDefault();
                  findMuhurat();
                }
              }}
            >
              <div className="muhurat-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 22 }}>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, background: 'var(--cream)' }} />
                </div>
                <div>
                  <label style={labelStyle}>Your Name (optional)</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul Sharma" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Rashi (Moon Sign)</label>
                  <select value={rashi} onChange={(e) => setRashi(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">Select your Rashi...</option>
                    {RASHI_LIST.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>City</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CityAutocomplete
                      value={city}
                      onChange={handleCityChange}
                      placeholder="e.g. Varanasi"
                      style={{ ...inputStyle, flex: 1, minWidth: 0 }}
                    />
                    {usingLocation ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#eafaf1', color: '#27ae60', borderRadius: 20, padding: '3px 10px', fontFamily: UI_FONT, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
                          <MapPin size={11} /> Location detected
                        </span>
                        <button
                          type="button"
                          onClick={clearLocation}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-light)', fontFamily: UI_FONT, fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '3px 4px', whiteSpace: 'nowrap' }}
                        >
                          <X size={11} /> Type manually
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={getUserLocation} disabled={locLoading} style={{ ...locButtonStyle, padding: '3px 8px', fontSize: 10, flexShrink: 0 }}>
                        <Navigation size={10} />
                        {locLoading ? 'Locating…' : 'My Location'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <button className="btn-primary" onClick={findMuhurat} disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '15px', fontSize: 15, borderRadius: 50, gap: 10 }}>
                {loading ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'spin .8s linear infinite' }} /> Finding Muhurat...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} /> Find Auspicious Muhurat
                  </>
                )}
              </button>
            </div>

            {!loading && !result && (
              <div style={{ marginTop: 28, textAlign: 'center', padding: '28px 24px', background: 'var(--cream)', borderRadius: 'var(--radius)', border: '1px dashed var(--cream-dark)' }}>
                <Sparkles size={34} color="var(--saffron)" style={{ marginBottom: 10 }} />
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-light)', lineHeight: 1.6 }}>
                  Select an occasion above and click <strong>Find Auspicious Muhurat</strong> to see Vedic timing recommendations.
                </p>
              </div>
            )}
          </Card>

          {muhuratError && (
            <div style={{ background: '#FFF4F4', border: '1px solid #FFCDD2', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 10 }}>
              <AlertCircle size={18} color="#D32F2F" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontFamily: UI_FONT, color: '#C62828', fontSize: 14 }}>{muhuratError}</p>
            </div>
          )}

          {loading && <LoadingState message="Finding Muhurat..." />}
          {result && !loading && (
            <MuhuratResult result={result} selectedType={selectedType} />
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeDown { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes panchangTabEnter {
          from { opacity:0; transform:translateY(18px) scale(.985); filter:blur(5px); }
          to { opacity:1; transform:translateY(0) scale(1); filter:blur(0); }
        }
        @keyframes tableRowEnter {
          from { opacity:0; transform:translateX(-14px); }
          to { opacity:1; transform:translateX(0); }
        }
        @keyframes tabGlow {
          0%,100% { box-shadow:0 8px 24px rgba(234,88,12,.2); }
          50% { box-shadow:0 10px 34px rgba(234,88,12,.38); }
        }

        .panchang-tab-content {
          animation:panchangTabEnter .48s cubic-bezier(.2,.8,.2,1) both;
        }
        .panchang-tabs {
          display:flex; gap:7px; margin-bottom:18px; padding:7px; overflow-x:auto;
          border:1px solid #eadbc8; border-radius:16px;
          background:radial-gradient(circle at top left,rgba(255,255,255,.9),transparent 45%),linear-gradient(135deg,#f8f1e7,#f2e5d4);
          scrollbar-width:none;
        }
        .panchang-tabs::-webkit-scrollbar { display:none; }
        .panchang-tab {
          display:inline-flex; flex:0 0 auto; align-items:center; justify-content:center; gap:7px;
          min-height:42px; padding:9px 17px; border:1px solid transparent; border-radius:11px;
          background:transparent; color:#806a4d; cursor:pointer; font-family:${UI_FONT};
          font-size:13px; font-weight:800; transition:transform .25s ease,color .25s ease,background .25s ease,box-shadow .25s ease;
        }
        .panchang-tab:hover { color:#c2410c; background:rgba(255,255,255,.72); transform:translateY(-2px); }
        .panchang-tab.active {
          color:white; background:linear-gradient(135deg,#f97316,#c2410c);
          animation:tabGlow 2.8s ease-in-out infinite;
        }
        .panchang-tab-icon { display:inline-flex; transition:transform .25s ease; }
        .panchang-tab:hover .panchang-tab-icon,.panchang-tab.active .panchang-tab-icon { transform:rotate(-8deg) scale(1.12); }

        .panchang-table-shell { overflow:hidden; border:1px solid #eee2d2; border-radius:14px; background:white; }
        .panchang-table-scroll { width:100%; overflow-x:auto; }
        .panchang-data-table { width:100%; min-width:720px; border-collapse:separate; border-spacing:0; }
        .panchang-data-table thead { background:linear-gradient(135deg,rgba(255,248,237,.98),rgba(247,237,222,.98)); }
        .panchang-data-table th {
          padding:13px 16px; border-bottom:1px solid #eadcc8; color:#7c4a22; font-family:${UI_FONT};
          font-size:10px; font-weight:900; letter-spacing:.09em; text-transform:uppercase;
        }
        .panchang-data-table tbody tr {
          animation:tableRowEnter .42s ease both;
          transition:background .2s ease,transform .2s ease,box-shadow .2s ease;
        }
        .panchang-data-table tbody tr:nth-child(even) { background:#fdfbf8; }
        .panchang-data-table tbody tr:hover {
          position:relative; z-index:2; background:#fff8ef; transform:translateY(-2px);
          box-shadow:0 8px 24px rgba(94,49,13,.09);
        }
        .panchang-data-table td {
          padding:14px 16px; border-bottom:1px solid #f1ebe3; color:#322416;
          font-family:${UI_FONT}; font-size:13px; vertical-align:middle;
        }
        .panchang-data-table tbody tr:last-child td { border-bottom:none; }
        .table-name-cell { display:flex; align-items:center; gap:11px; }
        .table-name-cell strong { display:block; color:#27170a; font-size:13.5px; }
        .table-name-icon {
          display:inline-flex; width:38px; height:38px; flex:0 0 38px; align-items:center; justify-content:center;
          border:1px solid; border-radius:11px; transition:transform .25s ease;
        }
        .panchang-data-table tr:hover .table-name-icon { transform:rotate(-7deg) scale(1.08); }
        .table-badge-row,.table-chip-list { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
        .table-detail-chip { display:inline-flex; gap:4px; padding:4px 9px; border:1px solid; border-radius:999px; font-size:10.5px; line-height:1.3; }
        .table-time-pill {
          display:inline-flex; align-items:center; gap:7px; padding:7px 10px; border:1px solid #eadcc8;
          border-radius:10px; background:#fffaf3; color:#8a4b16; font-weight:800; white-space:nowrap;
        }
        .table-guidance { display:block; max-width:540px; color:#786858; line-height:1.55; }
        .table-empty-value { color:#aaa097; font-style:italic; }
        .nature-badge,.record-count {
          display:inline-flex; align-items:center; padding:5px 10px; border:1px solid; border-radius:999px;
          font-family:${UI_FONT}; font-size:10px; font-weight:900; text-transform:uppercase; letter-spacing:.05em;
        }

        @media (max-width: 900px) {
          .muhurat-results-grid { grid-template-columns: 1fr !important; }
          .panchang-timings { grid-template-columns: 1fr !important; }
          .panchang-key-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 720px) {
          .muhurat-occasion-grid { grid-template-columns: repeat(3,1fr) !important; }
          .muhurat-form-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 600px) {
          .sunmoon-strip { justify-content: space-between !important; }
        }
        @media (max-width: 480px) {
          .muhurat-occasion-grid { grid-template-columns: repeat(2,1fr) !important; }
          .muhurat-form-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width:700px) {
          .panchang-tabs { flex-wrap:nowrap; }
          .panchang-tab { padding:9px 13px; }
          .panchang-data-table { min-width:0; }
          .panchang-data-table thead { display:none; }
          .panchang-data-table,.panchang-data-table tbody,.panchang-data-table tr,.panchang-data-table td { display:block; width:100%; }
          .panchang-data-table tbody { display:grid; gap:12px; padding:12px; }
          .panchang-data-table tbody tr { overflow:hidden; border:1px solid #eadcc8; border-radius:13px; background:white; }
          .panchang-data-table td { display:grid; grid-template-columns:minmax(100px,.4fr) 1fr; gap:12px; padding:11px 13px; text-align:left !important; }
          .panchang-data-table td::before {
            content:attr(data-label); color:#9a6738; font-size:9px; font-weight:900;
            letter-spacing:.08em; text-transform:uppercase;
          }
          .table-name-cell { align-items:flex-start; }
          .table-time-pill { width:fit-content; white-space:normal; }
        }
        @media (prefers-reduced-motion:reduce) {
          .panchang-tab-content,.panchang-data-table tbody tr,.panchang-tab.active { animation:none; }
          .panchang-tab,.panchang-data-table tbody tr,.table-name-icon { transition:none; }
        }
      `}</style>

      <Footer />
    </>
  );
}

function MuhuratResult({ result, selectedType }) {
  const verdict = result.verdict || 'average';
  const color = VERDICT_COLOR[verdict] || '#d97706';
  const bg = VERDICT_BG[verdict] || '#fffbeb';

  return (
    <div style={{ animation: 'fadeDown .6s ease both' }}>
      <div style={{ background: bg, border: `2px solid ${color}40`, borderRadius: 'var(--radius-lg)', padding: '24px 28px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 18 }}>
        <Sparkles size={44} color={color} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: UI_FONT, fontSize: 11, letterSpacing: '.09em', textTransform: 'uppercase', fontWeight: 800, color: 'white', background: color, padding: '3px 14px', borderRadius: 50 }}>
              {verdict}
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--brown)', fontWeight: 800 }}>
              {selectedType?.label || 'Selected'} Muhurat
            </span>
          </div>
          <p style={{ fontFamily: UI_FONT, fontSize: 15, color, marginBottom: 10, fontWeight: 700 }}>
            {result.verdict_reason}
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--text-mid)', lineHeight: 1.75, fontStyle: 'italic' }}>
            "{result.pandit_message}"
          </p>
        </div>
      </div>

      <div className="muhurat-results-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 22, alignItems: 'start' }}>
        <div>
          <Card style={{ borderColor: 'rgba(34,197,94,0.3)' }}>
            <SectionTitle icon={<Clock size={14} />}>Shubh Muhurat Timings</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(result.auspicious_timings || []).map((timing, i) => (
                <div key={i} style={{ borderRadius: 'var(--radius)', border: '1px solid #86efac', overflow: 'hidden', background: '#f0fdf4' }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid #86efac' }}>
                    <div style={{ flex: 1, padding: '12px 16px', borderRight: '1px solid #86efac' }}>
                      <p style={{ fontFamily: UI_FONT, fontSize: 15, fontWeight: 800, color: '#15803d', whiteSpace: 'nowrap', marginBottom: 2 }}>{formatTimeRangeClean(timing.time)}</p>
                      <p style={{ fontFamily: UI_FONT, fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: '#16a34a' }}>Shubh Timing</p>
                    </div>
                    <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#dcfce7' }}>
                      <p style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 800, color: '#15803d', textAlign: 'center' }}>{timing.quality}</p>
                    </div>
                  </div>
                  <div style={{ padding: '10px 16px' }}>
                    <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#16a34a', lineHeight: 1.5 }}>{timing.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {!!result.timings_to_avoid?.length && (
            <Card style={{ borderColor: 'rgba(220,38,38,0.25)' }}>
              <SectionTitle icon={<AlertCircle size={14} />}>Timings to Avoid</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {result.timings_to_avoid.map((timing, i) => (
                  <div key={i} style={{ borderRadius: 'var(--radius)', border: '1px solid #fca5a5', overflow: 'hidden', background: '#fef2f2' }}>
                    <div style={{ display: 'flex' }}>
                      <div style={{ padding: '10px 16px', borderRight: '1px solid #fca5a5' }}>
                        <p style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 800, color: '#b91c1c', whiteSpace: 'nowrap', marginBottom: 2 }}>{formatTimeRangeClean(timing.time)}</p>
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

          {!!result.rituals_recommended?.length && (
            <Card>
              <SectionTitle icon={<Star size={14} />}>Recommended Rituals</SectionTitle>
              {result.rituals_recommended.map((ritual, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                  <CheckCircle size={16} color="var(--saffron)" style={{ marginTop: 3, flexShrink: 0 }} />
                  <span style={{ fontFamily: UI_FONT, fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.6 }}>{ritual}</span>
                </div>
              ))}
            </Card>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--cream-dark)', padding: 20, boxShadow: '0 2px 12px var(--shadow)' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--brown)', marginBottom: 14 }}>Planetary Check</h3>
            {[
              { label: 'Tithi', data: result.tithi_today },
              { label: 'Nakshatra', data: result.nakshatra_today },
            ].map((item) => item.data && (
              <div key={item.label} style={{ background: item.data.is_auspicious_for_this_muhurat ? '#f0fdf4' : '#fef2f2', borderRadius: 10, padding: '12px 14px', marginBottom: 10, border: `1px solid ${item.data.is_auspicious_for_this_muhurat ? '#86efac' : '#fca5a5'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                  <span style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 800, color: 'var(--text-light)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{item.label}</span>
                  <span style={{ fontFamily: UI_FONT, fontSize: 11, color: item.data.is_auspicious_for_this_muhurat ? '#16a34a' : '#dc2626' }}>
                    {item.data.is_auspicious_for_this_muhurat ? 'Auspicious' : 'Caution'}
                  </span>
                </div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--brown)', fontWeight: 800 }}>{item.data.name}</p>
                <p style={{ fontFamily: UI_FONT, fontSize: 12, color: 'var(--text-light)', marginTop: 4, lineHeight: 1.5 }}>{item.data.reason}</p>
              </div>
            ))}
          </div>

          {!!result.alternative_dates?.length && (
            <div style={{ background: 'white', borderRadius: 'var(--radius-lg)', border: '1px solid var(--cream-dark)', padding: 20, boxShadow: '0 2px 12px var(--shadow)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--brown)', marginBottom: 14 }}>Alternative Dates</h3>
              {result.alternative_dates.map((d, i) => (
                <div key={i} style={{ padding: '10px 12px', borderRadius: 10, marginBottom: 8, background: 'var(--cream)', border: '1px solid var(--cream-dark)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                    <span style={{ fontFamily: UI_FONT, fontSize: 13, color: 'var(--brown)', fontWeight: 800 }}>{d.date}</span>
                    <span style={{ fontFamily: UI_FONT, fontSize: 10, background: 'var(--saffron)', color: 'white', borderRadius: 50, padding: '2px 8px', fontWeight: 800 }}>{d.quality}</span>
                  </div>
                  <p style={{ fontFamily: UI_FONT, fontSize: 12, color: 'var(--text-light)' }}>{d.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}