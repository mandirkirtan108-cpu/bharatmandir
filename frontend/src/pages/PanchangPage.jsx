import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  Moon,
  Sparkles,
  Star,
  Sun,
} from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

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
/*  readable Panchang. This is the layer that used to be missing:      */
/*  before, every key from the API (vriddhi, kshaya, paksha_randhra_   */
/*  start_time, raw slugs, duplicated "_detailed" entries...) was      */
/*  dumped straight into the UI. Everything below decides what's       */
/*  worth showing, what it should be called, and what it means.        */
/* ------------------------------------------------------------------ */

// Keys that are internal/API bookkeeping and should never reach the UI.
const HIDDEN_KEYS = new Set(['id', 'raw', 'paksha_randhra_start_time', 'vriddhi', 'kshaya']);

// Friendly labels for known API field names (falls back to titleize()).
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

// Preferred display order — the "name" of a thing first, timing last.
const FIELD_PRIORITY = [
  'tithi', 'nak_name', 'nakshatra_name', 'yoga_name', 'karana_name',
  'paksha', 'pada', 'mobility', 'deity', 'devata', 'ruling_planet', 'rulling_planet', 'lord',
  'nature', 'type', 'number', 'yoga_number', 'sign', 'start_time', 'start', 'end_time', 'end',
];

// What each auspicious muhurat actually means — replaces a bare titleized slug.
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

// What each inauspicious window means and why it should be avoided.
const INAUSPICIOUS_MEANINGS = {
  rahu_kaal: { label: 'Rahu Kaal', icon: '⊘', note: 'Avoid starting new or auspicious work.' },
  gulkai_kaal: { label: 'Gulikai Kaal', icon: '⊘', note: 'Avoid important beginnings during this window.' },
  yamaganda: { label: 'Yamaganda', icon: '⊘', note: 'Ruled by Yama — avoid launching new ventures.' },
  baana: { label: 'Baana', icon: '⚠️', note: 'Inauspicious influence tied to the day\u2019s ruling sign.' },
  panchaka: { label: 'Panchak', icon: '⚠️', note: 'Avoid construction, roofing and funeral rites during this period.' },
  varjyam: { label: 'Varjyam', icon: '⊘', note: 'Best avoided for important tasks.' },
  dur_muhurtam: { label: 'Dur Muhurat', icon: '⊘', note: 'An inauspicious muhurat, unfit for new beginnings.' },
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

// A nested object like { name: 'Chandra' } (the shape "lord" comes back as)
// should just read as "Chandra", not "Name: Chandra".
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

function show(value, fallback = 'Not available') {
  const text = String(value ?? '').trim();
  return text && text !== '-' && text !== '—' ? text : fallback;
}

function firstTimePart(value) {
  if (!value) return '';
  return String(value).split(' - ')[0].trim();
}

function timeLabel(value) {
  return to12h(firstTimePart(value));
}

function shortTime(value) {
  return timeLabel(value).replace(/\s/g, '');
}

function parseTimeToMinutes(value) {
  if (!value) return null;
  const text = String(value).trim();
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

function AngaCard({ label, value, sub, icon }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 8,
      padding: '16px 12px 14px',
      textAlign: 'center',
      border: '1px solid #e6e6e6',
      minHeight: 118,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{ color: '#c47a14', marginBottom: 12, minHeight: 22, display: 'flex', alignItems: 'center' }}>{icon}</div>
      <p style={{
        fontFamily: UI_FONT,
        fontSize: 11,
        fontWeight: 800,
        color: '#707070',
        letterSpacing: '.09em',
        textTransform: 'uppercase',
      }}>
        {label}
      </p>
      <p style={{ fontFamily: UI_FONT, fontSize: 16, color: '#202020', fontWeight: 800, marginTop: 7, lineHeight: 1.2 }}>
        {value || 'Not available'}
      </p>
      <p style={{ fontFamily: UI_FONT, fontSize: 12, color: '#8d8d8d', marginTop: 4, lineHeight: 1.2 }}>
        {sub || 'Not available'}
      </p>
    </div>
  );
}

function TimingCard({ title, value, note, tone }) {
  const tones = {
    green: ['#f0fdf4', '#22c55e', '#16a34a', '↟'],
    blue: ['#eff6ff', '#3b82f6', '#2563eb', '✳'],
    red: ['#fef2f2', '#ef4444', '#dc2626', '⊘'],
  };
  const [bg, label, text, mark] = tones[tone] || tones.blue;
  return (
    <div style={{ background: bg, border: 'none', borderRadius: 8, padding: '15px 16px 13px', minHeight: 88 }}>
      <p style={{ fontFamily: UI_FONT, fontSize: 12, color: label, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.08em' }}>
        <span style={{ marginRight: 7 }}>{mark}</span>{title}
      </p>
      <p style={{ fontFamily: UI_FONT, fontSize: 18, color: text, fontWeight: 900, marginTop: 8, lineHeight: 1.25 }}>
        {to12h(value) || 'Not available'}
      </p>
      <p style={{ fontFamily: UI_FONT, fontSize: 12, color: label, fontWeight: 700, marginTop: 4, lineHeight: 1.25 }}>
        {note}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Curated record rendering (Tithi / Nakshatra / Yoga / Karana lists) */
/* ------------------------------------------------------------------ */

// Turns one raw anga record (a tithi, nakshatra, yoga or karana object)
// into an ordered list of { key, label, value } plus any status badges
// (Vriddhi/Kshaya), dropping internal fields entirely.
function curateRecord(record) {
  if (!record || typeof record !== 'object') return { fields: [], badges: [] };

  const badges = [];
  if (record.vriddhi === true || record.vriddhi === 'true') badges.push('Vriddhi Tithi');
  if (record.kshaya === true || record.kshaya === 'true') badges.push('Kshaya Tithi');

  const fields = Object.entries(record)
    .filter(([key]) => !HIDDEN_KEYS.has(key))
    .map(([key, value]) => ({
      key,
      label: LABEL_MAP[key] || titleize(key),
      value: to12h(cleanValue(simplifyValue(value))),
    }))
    .filter((field) => field.value && field.value !== 'Not available');

  fields.sort((a, b) => {
    const ai = FIELD_PRIORITY.indexOf(a.key);
    const bi = FIELD_PRIORITY.indexOf(b.key);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return { fields, badges };
}

function flattenDetails(data, prefix = '') {
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data).flatMap(([key, value]) => {
    if (HIDDEN_KEYS.has(key)) return [];
    const labelKey = LABEL_MAP[key] || titleize(key);
    const label = prefix ? `${prefix} ${labelKey}` : labelKey;
    if (value === null || value === undefined || value === '') return [];
    if (Array.isArray(value)) {
      if (!value.length) return [];
      if (value.every((item) => typeof item !== 'object')) {
        return [{ label, value: value.join(', ') }];
      }
      return [];
    }
    if (typeof value === 'object') {
      return flattenDetails(value, label);
    }
    return [{ label, value }];
  });
}

function detailTime(value) {
  return to12h(cleanValue(value));
}

function DetailCard({ title, data, accent = '#c47a14' }) {
  const items = flattenDetails(data);
  if (!items.length) return null;

  return (
    <div style={{ background: '#fff', border: '1px solid #e6e6e6', borderRadius: 10, padding: '15px 16px' }}>
      <p style={{ fontFamily: UI_FONT, fontSize: 12, color: accent, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        {title}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
        {items.map((item) => (
          <div key={`${title}-${item.label}`} style={{ background: '#fafafa', borderRadius: 8, padding: '10px 11px' }}>
            <p style={{ fontFamily: UI_FONT, fontSize: 10, color: '#8b8b8b', fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' }}>
              {item.label}
            </p>
            <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#252525', fontWeight: 800, lineHeight: 1.35, marginTop: 5 }}>
              {detailTime(item.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Replaces the old "PanchangRecordTable" key-dump. Shows only meaningful,
// labeled fields per record (Tithi/Nakshatra/Yoga/Karana), with a status
// badge row for Vriddhi/Kshaya instead of a raw "false" line.
function AngaRecordList({ title, records }) {
  const rows = Array.isArray(records) ? records.filter((item) => item && typeof item === 'object') : [];
  if (!rows.length) return null;

  return (
    <div style={{ background: '#fff', border: '1px solid #e6e6e6', borderRadius: 10, padding: '15px 16px' }}>
      <p style={{ fontFamily: UI_FONT, fontSize: 12, color: '#8b5a24', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        {title}
      </p>
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((record, index) => {
          const { fields, badges } = curateRecord(record);
          if (!fields.length) return null;
          return (
            <div key={`${title}-${index}`} style={{ background: '#fafafa', borderRadius: 8, padding: '11px 12px' }}>
              {!!badges.length && (
                <div style={{ display: 'flex', gap: 6, marginBottom: 9 }}>
                  {badges.map((badge) => (
                    <span key={badge} style={{
                      fontFamily: UI_FONT, fontSize: 10, fontWeight: 900, color: '#9a5d12',
                      background: '#fff1d9', borderRadius: 50, padding: '3px 10px',
                      letterSpacing: '.04em', textTransform: 'uppercase',
                    }}>
                      {badge}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: 8 }}>
                {fields.slice(0, 10).map((item) => (
                  <div key={`${title}-${index}-${item.key}`}>
                    <p style={{ fontFamily: UI_FONT, fontSize: 10, color: '#8b8b8b', fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      {item.label}
                    </p>
                    <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#252525', fontWeight: 800, marginTop: 3 }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Auspicious / Inauspicious timings — named, explained, correctly    */
/*  formatted even when a muhurat has more than one window in a day.   */
/* ------------------------------------------------------------------ */

function formatPeriod(item) {
  if (!item || typeof item !== 'object') return '';
  const start = item.start_time || item.start;
  const end = item.end_time || item.end;
  if (!start || !end) return '';
  const range = `${to12h(start)} - ${to12h(end)}`;
  return item.sign ? `${range} (Sign: ${item.sign})` : range;
}

// A timing value may be a single {start,end} object OR a list of them
// (e.g. Dur Muhurtam happens twice a day). Format every window cleanly
// and join them, instead of the old behaviour of concatenating raw
// "Start Time: ... End Time: ..." strings into one unreadable line.
function formatTimingValue(value) {
  if (Array.isArray(value)) {
    return value.map(formatPeriod).filter(Boolean).join('  •  ');
  }
  return formatPeriod(value);
}

function MuhuratTimingsGrid({ title, data, tone = 'green', meanings }) {
  const color = tone === 'red' ? '#dc2626' : '#16a34a';
  const bg = tone === 'red' ? '#fff5f5' : '#f5fff7';
  const border = tone === 'red' ? '#fecaca' : '#bbf7d0';

  const entries = Object.entries(data || {})
    // "_detailed" variants duplicate the base entry with identical times.
    .filter(([key]) => !key.toLowerCase().endsWith('_detailed'))
    .map(([key, value]) => ({ key, text: formatTimingValue(value) }))
    .filter((item) => item.text);

  if (!entries.length) return null;

  return (
    <div style={{ background: '#fff', border: '1px solid #e6e6e6', borderRadius: 10, padding: '15px 16px' }}>
      <p style={{ fontFamily: UI_FONT, fontSize: 12, color, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        {title}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
        {entries.map(({ key, text }) => {
          const meta = (meanings && meanings[key.toLowerCase()]) || {
            label: titleize(key),
            icon: tone === 'red' ? '⊘' : '✦',
            note: '',
          };
          return (
            <div key={key} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '11px 12px' }}>
              <p style={{ fontFamily: UI_FONT, fontSize: 12, color, fontWeight: 900 }}>
                <span style={{ marginRight: 6 }}>{meta.icon}</span>{meta.label}
              </p>
              <p style={{ fontFamily: UI_FONT, fontSize: 13, color: tone === 'red' ? '#991b1b' : '#166534', fontWeight: 800, marginTop: 6, lineHeight: 1.4 }}>
                {text}
              </p>
              {!!meta.note && (
                <p style={{ fontFamily: UI_FONT, fontSize: 11, color: tone === 'red' ? '#b45454' : '#4d7a45', marginTop: 4, lineHeight: 1.4 }}>
                  {meta.note}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PanchangDetails({ dailyResult }) {
  const nightChoghadiya = (dailyResult.choghadiya || []).filter((item) => item.period === 'night');
  const mainTimings = {
    sunrise: dailyResult.sunrise,
    sunset: dailyResult.sunset,
    moonrise: dailyResult.moonrise,
    moonset: dailyResult.moonset,
    brahma_muhurat: dailyResult.brahma_muhurat?.time,
    abhijit_muhurat: dailyResult.abhijit_muhurat?.time,
    rahu_kaal: dailyResult.rahu_kaal?.time,
  };

  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <h3 style={{ fontFamily: UI_FONT, fontSize: 18, color: '#1f1f1f', fontWeight: 900, margin: 0 }}>
          Full Panchang Details
        </h3>
        <span style={{ fontFamily: UI_FONT, fontSize: 12, color: '#8b8b8b', fontWeight: 800 }}>
          Sunrise, moon timings, calendar, periods and Panchang records
        </span>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        <DetailCard title="Daily Timings" data={mainTimings} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
          <DetailCard title="Sun Details" data={dailyResult.sun} accent="#d97706" />
          <DetailCard title="Moon Details" data={dailyResult.moon} accent="#2563eb" />
          <DetailCard title="Hindu Calendar" data={dailyResult.hindu_calendar} accent="#7c3aed" />
        </div>
        <MuhuratTimingsGrid title="Auspicious Timings" data={dailyResult.auspicious_timings} tone="green" meanings={AUSPICIOUS_MEANINGS} />
        <MuhuratTimingsGrid title="Inauspicious Timings" data={dailyResult.inauspicious_timings} tone="red" meanings={INAUSPICIOUS_MEANINGS} />
        {!!nightChoghadiya.length && <ChoghadiyaBlock title="Night Choghadiya" rows={nightChoghadiya} />}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
          <AngaRecordList title="All Tithis" records={dailyResult.all_panchang?.tithis} />
          <AngaRecordList title="All Nakshatras" records={dailyResult.all_panchang?.nakshatras} />
          <AngaRecordList title="All Yogas" records={dailyResult.all_panchang?.yogas} />
          <AngaRecordList title="All Karanas" records={dailyResult.all_panchang?.karnas} />
          <AngaRecordList title="Sun Nakshatras" records={dailyResult.all_panchang?.sun_nakshatras} />
        </div>
      </div>
    </div>
  );
}

function PanchangDailyResult({ dailyResult }) {
  const dayChoghadiya = (dailyResult.choghadiya || []).filter((item) => item.period !== 'night');

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

      <div style={{ overflowX: 'auto', marginBottom: 18, WebkitOverflowScrolling: 'touch' }}>
        <div className="panchang-angas" style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, minWidth: 760 }}>
          <AngaCard label="Tithi" icon={<Moon size={24} />} value={dailyResult.tithi?.name} sub={joinTiny([dailyResult.tithi?.paksha || dailyResult.tithi?.nature, dailyResult.tithi?.end_time && shortTime(dailyResult.tithi.end_time)])} />
          <AngaCard label="Nakshatra" icon={<Star size={24} />} value={dailyResult.nakshatra?.name} sub={dailyResult.nakshatra?.end_time ? `until ${shortTime(dailyResult.nakshatra.end_time)}` : dailyResult.nakshatra?.lord} />
          <AngaCard label="Yoga" icon={<span style={{ fontSize: 26, lineHeight: 1 }}>∞</span>} value={dailyResult.yoga?.name} sub={dailyResult.yoga?.end_time ? `until ${shortTime(dailyResult.yoga.end_time)}` : dailyResult.yoga?.time} />
          <AngaCard label="Karana" icon={<span style={{ fontSize: 20, lineHeight: 1 }}>□</span>} value={dailyResult.karana?.name} sub={dailyResult.karana?.end_time ? `until ${shortTime(dailyResult.karana.end_time)}` : dailyResult.karana?.time} />
          <AngaCard label="Vaar" icon={<Sun size={24} />} value={dailyResult.var?.day} sub={`Lord: ${dailyResult.var?.lord || 'Not available'}`} />
        </div>
      </div>

      {!!dayChoghadiya.length && (
        <ChoghadiyaTimeline
          title="Day Choghadiya"
          rows={dayChoghadiya}
          sunrise={dailyResult.sunrise}
          sunset={dailyResult.sunset}
        />
      )}

      <div className="panchang-timings" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
        <TimingCard title="Brahma" value={dailyResult.brahma_muhurat?.time} note={dailyResult.brahma_muhurat?.benefit || 'Spiritual practice'} tone="green" />
        <TimingCard title="Abhijit" value={dailyResult.abhijit_muhurat?.time} note={dailyResult.abhijit_muhurat?.benefit || 'Auspicious work'} tone="blue" />
        <TimingCard title="Rahu Kaal" value={dailyResult.rahu_kaal?.time} note={dailyResult.rahu_kaal?.benefit || 'Avoid new beginnings'} tone="red" />
      </div>

      <PanchangDetails dailyResult={dailyResult} />
    </div>
  );
}

function joinTiny(parts) {
  return parts.map((part) => String(part || '').trim()).filter(Boolean).join(' · ');
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
    <div style={{ background: '#fff', border: '1px solid #e6e6e6', borderRadius: 12, padding: '18px 18px 16px', margin: '18px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={17} color="#4b5563" />
          <span style={{ fontFamily: UI_FONT, fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>{title}</span>
        </div>
        <span style={{ fontFamily: UI_FONT, fontSize: 13, color: '#8b8b8b', fontWeight: 800 }}>{shortTime(sunrise)} → {shortTime(sunset)}</span>
      </div>

      <div style={{ position: 'relative', paddingTop: 18 }}>
        {activePosition !== null && (
          <div style={{ position: 'absolute', left: `${activePosition}%`, top: -18, transform: 'translateX(-50%)', zIndex: 3 }}>
            <div style={{ background: '#0f355d', color: 'white', borderRadius: 12, padding: '4px 9px', fontFamily: UI_FONT, fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap', boxShadow: '0 4px 10px rgba(0,0,0,.16)' }}>
              Now · {now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </div>
            <div style={{ width: 3, height: 58, background: '#0f355d', margin: '-1px auto 0' }} />
          </div>
        )}

        <div style={{ display: 'flex', overflow: 'hidden', borderRadius: 6 }}>
          {segments.map((item, index) => {
            const colors = choghadiyaColor(item.name);
            return (
              <div key={`${item.name}-${index}`} style={{ flex: '1 0 84px', background: colors.bg, borderRight: index < segments.length - 1 ? '1px solid rgba(255,255,255,.55)' : 'none', minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: UI_FONT, color: colors.text, fontSize: 13, fontWeight: 800 }}>{item.name || '—'}</span>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', marginTop: 8 }}>
          {segments.map((item, index) => (
            <div key={`${item.name}-time-${index}`} style={{ flex: '1 0 84px', fontFamily: UI_FONT, color: '#8a8a8a', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', textAlign: 'left' }}>
              {shortTime(periodStart(item))}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, borderTop: '1px solid #eeeeee', marginTop: 18, paddingTop: 14 }}>
        <div style={{ background: '#eef7e3', borderRadius: 7, padding: '10px 12px' }}>
          <p style={{ fontFamily: UI_FONT, fontSize: 11, color: '#6b8d4d', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', margin: 0 }}>Currently In</p>
          <p style={{ fontFamily: UI_FONT, fontSize: 15, color: '#285c1f', fontWeight: 900, margin: '4px 0 0' }}>
            {current?.name || 'Not available'} {current ? `· ${shortTime(periodStart(current))}-${shortTime(periodEnd(current))}` : ''}
          </p>
        </div>
        <div style={{ background: '#fafafa', borderRadius: 7, padding: '10px 12px' }}>
          <p style={{ fontFamily: UI_FONT, fontSize: 11, color: '#8b8b8b', fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase', margin: 0 }}>Next</p>
          <p style={{ fontFamily: UI_FONT, fontSize: 15, color: '#292929', fontWeight: 900, margin: '4px 0 0' }}>
            {next?.name || 'Not available'}{minutesToNext !== null ? ` · in ${minutesToNext} min` : ''}
          </p>
        </div>
      </div>
    </div>
  );
}

function ChoghadiyaBlock({ title, rows }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--brown)', marginBottom: 10 }}>
        {title}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8 }}>
        {rows.map((item, index) => {
          const color = item.nature === 'good' ? '#16a34a' : item.nature === 'bad' ? '#dc2626' : '#64748b';
          return (
            <div key={`${title}-${index}`} style={{ padding: '10px 12px', borderRadius: 8, background: 'white', border: '1px solid var(--cream-dark)', borderLeft: `4px solid ${color}` }}>
              <p style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 800, color }}>{item.name || 'Choghadiya'}</p>
              <p style={{ fontFamily: UI_FONT, fontSize: 11, color: 'var(--text-light)', whiteSpace: 'nowrap', marginTop: 4 }}>{to12h(item.time)}</p>
            </div>
          );
        })}
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
  const [error, setError] = useState(null);

  const selectedType = MUHURAT_TYPES.find((m) => m.id === selected);

  const fetchDailyPanchang = async () => {
    setDailyLoading(true);
    setDailyResult(null);
    setError(null);
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
      setError(`Could not load Panchang: ${e.message}`);
    } finally {
      setDailyLoading(false);
    }
  };

  const findMuhurat = async () => {
    if (!selected) {
      setError('Please select an occasion first.');
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);
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
      setError(`Could not get Muhurat: ${e.message}`);
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

  return (
    <>
      <Navbar />
      <div style={{ background: 'var(--cream)', minHeight: '100vh', paddingBottom: 80 }}>
        <section style={{
          position: 'relative',
          overflow: 'hidden',
          color: 'white',
          background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
          padding: '50px 12px',
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
              marginBottom: 14,
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
                  ? `${dailyResult.var?.day || ''}, ${dailyResult.display_date || date} · ${city || dailyResult.location?.name || 'India'} · ${joinTiny([dailyResult.tithi?.paksha, dailyResult.tithi?.name])}`
                  : 'Select date and city to view daily Panchang'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
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
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Ujjain, Mumbai"
                  style={{ ...inputStyle, width: 240, height: 44, background: '#fff', border: '1px solid #e7d8c6', borderRadius: 9 }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--saffron)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--cream-dark)'; }}
                />
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

            {dailyLoading && <LoadingState message="Loading Panchang..." />}
            {dailyResult && !dailyLoading && <PanchangDailyResult dailyResult={dailyResult} />}
          </Card>

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
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Varanasi" style={inputStyle} />
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

            {!loading && !result && (
              <div style={{ marginTop: 28, textAlign: 'center', padding: '28px 24px', background: 'var(--cream)', borderRadius: 'var(--radius)', border: '1px dashed var(--cream-dark)' }}>
                <Sparkles size={34} color="var(--saffron)" style={{ marginBottom: 10 }} />
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--text-light)', lineHeight: 1.6 }}>
                  Select an occasion above and click <strong>Find Auspicious Muhurat</strong> to see Vedic timing recommendations.
                </p>
              </div>
            )}
          </Card>

          {error && (
            <div style={{ background: '#FFF4F4', border: '1px solid #FFCDD2', borderRadius: 'var(--radius)', padding: '14px 18px', marginBottom: 24, display: 'flex', gap: 10 }}>
              <AlertCircle size={18} color="#D32F2F" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontFamily: UI_FONT, color: '#C62828', fontSize: 14 }}>{error}</p>
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

        @media (max-width: 900px) {
          .muhurat-results-grid { grid-template-columns: 1fr !important; }
          .panchang-timings { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 720px) {
          .muhurat-occasion-grid { grid-template-columns: repeat(3,1fr) !important; }
          .muhurat-form-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 480px) {
          .muhurat-occasion-grid { grid-template-columns: repeat(2,1fr) !important; }
          .muhurat-form-grid { grid-template-columns: 1fr !important; }
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
                      <p style={{ fontFamily: UI_FONT, fontSize: 17, fontWeight: 800, color: '#15803d', whiteSpace: 'nowrap', marginBottom: 2 }}>{to12h(timing.time)}</p>
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
                        <p style={{ fontFamily: UI_FONT, fontSize: 16, fontWeight: 800, color: '#b91c1c', whiteSpace: 'nowrap', marginBottom: 2 }}>{to12h(timing.time)}</p>
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