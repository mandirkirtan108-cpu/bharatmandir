import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, MapPin, X } from 'lucide-react';
import axios from 'axios';
import { panchangAPI } from '../services/api';
import { friendlyError } from '../utils/uiMessages';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const UI_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Roboto", sans-serif';
const DEFAULT_COORDINATES = '25.3176,82.9739';
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// Colors kept distinct from the "named festival" green (#16a34a) and the
// brand orange (#E8650A) used for Today / Selected, so tithi highlights read
// clearly as their own category.
const FESTIVAL_PHASE_MATCHERS = [
  { test: (n) => n.includes('ekadashi'), color: '#2563eb', label: 'Ekadashi' },
  { test: (n) => n.includes('pradosh') || n.includes('purnima'), color: '#9b59b6', label: 'Pradosh / Purnima' },
  { test: (n) => n.includes('amavasya'), color: '#0f766e', label: 'Amavasya' },
  { test: (n) => n.includes('chaturthi') && !n.includes('ganesh'), color: '#e11d48', label: 'Chaturthi' },
];

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function festivalDateKey(festival, fallbackYear) {
  const raw = festival.exact_date || festival.display_date || festival.typical_date;
  if (!raw) return null;
  const iso = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const monthDay = String(raw).match(/^(\d{1,2})[-/](\d{1,2})(?:[-/]\d{2,4})?$/);
  if (monthDay) {
    const first = Number(monthDay[1]);
    const second = Number(monthDay[2]);
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    return `${fallbackYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${fallbackYear}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
}

function mergeFestivals(...groups) {
  const seen = new Set();
  return groups.flat().filter((festival) => {
    const key = (festival.name || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function classifyFestival(festival) {
  const name = (festival.name || '').toLowerCase();
  for (const matcher of FESTIVAL_PHASE_MATCHERS) {
    if (matcher.test(name)) return { color: matcher.color, label: matcher.label, isNamedFestival: false };
  }
  return { color: '#16a34a', label: 'Festival', isNamedFestival: true };
}

function splitDayFestivals(day) {
  const named = [];
  const phaseBadgesMap = new Map();
  (day?.festivals || []).forEach((festival) => {
    const meta = classifyFestival(festival);
    if (meta.isNamedFestival) {
      named.push({ ...festival, color: meta.color });
    } else if (!phaseBadgesMap.has(meta.label)) {
      phaseBadgesMap.set(meta.label, { label: meta.label, color: meta.color });
    }
  });
  return { named, phaseBadges: Array.from(phaseBadgesMap.values()).slice(0, 2) };
}

function paranaText(parana) {
  if (!parana || typeof parana !== 'object') return '';
  return Object.values(parana).filter(Boolean).join(' - ');
}

export default function PanchangCalendar() {
  const today = new Date();
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedKey, setSelectedKey] = useState(toDateKey(today));
  const [monthData, setMonthData] = useState(null);
  const [allFestivals, setAllFestivals] = useState([]);
  const [openFestival, setOpenFestival] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  useEffect(() => {
    let active = true;
    async function loadMonth() {
      setLoading(true);
      setError('');
      try {
        const { data } = await panchangAPI.getMonth(year, month + 1, {
          coordinates: DEFAULT_COORDINATES,
          calendar: 'amanta',
          language: 'en',
        });
        if (!active) return;
        setMonthData(data);
        setSelectedKey((currentKey) => {
          const selectedDate = parseDateKey(currentKey);
          return selectedDate.getFullYear() !== year || selectedDate.getMonth() !== month
            ? `${year}-${String(month + 1).padStart(2, '0')}-01`
            : currentKey;
        });
      } catch (err) {
        if (!active) return;
        setError(friendlyError(err, "We couldn't prepare the sacred calendar right now. Please try again in a few moments."));
        setMonthData(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadMonth();
    return () => { active = false; };
  }, [year, month]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      axios.get(`${API_BASE}/api/festivals?limit=500`),
      axios.get(`${API_BASE}/api/festivals/ai-cache`),
    ]).then((results) => {
      if (!active) return;
      const regular = results[0].status === 'fulfilled' && Array.isArray(results[0].value.data)
        ? results[0].value.data : [];
      const aiPayload = results[1].status === 'fulfilled' ? results[1].value.data : null;
      const ai = Array.isArray(aiPayload?.festivals) ? aiPayload.festivals : Array.isArray(aiPayload) ? aiPayload : [];
      setAllFestivals([...regular, ...ai]);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!openFestival) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpenFestival(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [openFestival]);

  const additionalFestivalsByKey = useMemo(() => {
    const map = new Map();
    allFestivals.forEach((festival) => {
      const key = festivalDateKey(festival, year);
      if (!key || !key.startsWith(`${year}-${String(month + 1).padStart(2, '0')}-`)) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push({ ...festival, tradition: festival.tradition || 'Hindu Festival' });
    });
    return map;
  }, [allFestivals, year, month]);

  const daysByKey = useMemo(() => {
    const map = new Map();
    (monthData?.days || []).forEach((day) => map.set(day.date, day));
    return map;
  }, [monthData]);

  const selectedDay = daysByKey.get(selectedKey);
  const selectedFestivals = mergeFestivals(selectedDay?.festivals || [], additionalFestivalsByKey.get(selectedKey) || []);

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result = [];
    for (let i = 0; i < firstDay; i += 1) result.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) result.push(new Date(year, month, d));
    return result;
  }, [year, month]);

  const monthFestivalDays = useMemo(() => {
    const keys = new Set([
      ...(monthData?.days || []).filter((day) => (day.festivals || []).length > 0).map((day) => day.date),
      ...additionalFestivalsByKey.keys(),
    ]);
    return Array.from(keys).sort().map((date) => ({
      date,
      festivals: mergeFestivals(daysByKey.get(date)?.festivals || [], additionalFestivalsByKey.get(date) || []),
    }));
  }, [monthData, daysByKey, additionalFestivalsByKey]);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <section className="panchang-calendar-section" style={{ background: '#fff', padding: '0 0 60px 0', borderTop: '1px solid #f0e8da' }}>
      <div className="panchang-calendar-container" style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px 0' }}>
        <div style={{ fontFamily: UI_FONT, fontSize: 12, fontWeight: 600, color: '#9A7150', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          Calendar grid - with festival names and observance highlights
        </div>

        <div className="panchang-calendar-card" style={calendarCardStyle}>
          <div className="panchang-month-header" style={monthHeaderStyle}>
            <button type="button" onClick={prevMonth} style={navBtnStyle} aria-label="Previous month"><ChevronLeft size={16} /></button>
            <div style={{ textAlign: 'center' }}>
              <div className="panchang-month-title" style={{ fontFamily: UI_FONT, fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>
                {MONTH_NAMES[month]} {year}
              </div>
              <div style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150', marginTop: 2 }}>
                Amanta calendar
              </div>
            </div>
            <button type="button" onClick={nextMonth} style={navBtnStyle} aria-label="Next month"><ChevronRight size={16} /></button>
          </div>

          {loading && (
            <div style={loadingStyle}>
              <Loader2 size={14} style={{ animation: 'spin .9s linear infinite', color: '#E8650A' }} />
              <span>Preparing the sacred calendar...</span>
            </div>
          )}

          {error && <div style={errorStyle}>{error}</div>}

          <div className="panchang-weekdays" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '10px 16px 4px' }}>
            {DAY_LABELS.map((day, index) => (
              <div className="panchang-weekday" key={day} style={{
                textAlign: 'center', fontFamily: UI_FONT, fontSize: 12, fontWeight: 600,
                color: index === 0 ? '#B42020' : index === 6 ? '#1A6A3A' : '#6b7280', paddingBottom: 6,
              }}>{day}</div>
            ))}
          </div>

          <div className="panchang-calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '0 12px 16px', gap: 3 }}>
            {cells.map((date, index) => {
              if (!date) return <div key={`empty-${index}`} />;
              const key = toDateKey(date);
              const day = daysByKey.get(key);
              const selected = key === selectedKey;
              const isToday = key === toDateKey(today);
              const isSunday = date.getDay() === 0;
              const isSaturday = date.getDay() === 6;
              const tithi = day?.tithi?.name || '';
              const paksha = day?.tithi?.paksha?.substring(0, 6) || '';
              const mergedDay = { ...day, festivals: mergeFestivals(day?.festivals || [], additionalFestivalsByKey.get(key) || []) };
              const { named, phaseBadges } = splitDayFestivals(mergedDay);
              const primaryNamed = named[0];
              const hasHighlight = Boolean(primaryNamed) || phaseBadges.length > 0;

              return (
                <div
                  className="panchang-day-cell"
                  key={key}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedKey(key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedKey(key);
                    }
                  }}
                  title={mergedDay.festivals.map((festival) => festival.name).join(', ') || undefined}
                  style={{
                    border: selected ? '2px solid #E8650A' : isToday ? '2px solid rgba(232,101,10,0.35)' : '1px solid #f0e4d2',
                    borderRadius: 8,
                    background: selected ? '#fff7f0' : primaryNamed ? '#f9fdf9' : '#fff',
                    cursor: 'pointer',
                    padding: '8px 4px 8px',
                    textAlign: 'center',
                    minHeight: hasHighlight ? 106 + (phaseBadges.length * 16) : 84,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    position: 'relative',
                  }}
                >
                  {isToday && <div style={todayPillStyle}>Today</div>}
                  <span className="panchang-day-number" style={{
                    fontFamily: UI_FONT, fontSize: 15, fontWeight: 700, lineHeight: 1,
                    color: selected ? '#E8650A' : isSunday ? '#B42020' : isSaturday ? '#1A6A3A' : '#1a1a1a',
                    marginTop: isToday ? 14 : 0,
                  }}>{date.getDate()}</span>
                  {tithi && <span className="panchang-day-tithi" style={smallCellTextStyle}>{tithi}</span>}
                  {paksha && <span className="panchang-day-paksha" style={{ ...smallCellTextStyle, color: '#9A7150' }}>{paksha}</span>}

                  {named.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%', marginTop: 2, padding: '0 2px' }}>
                      {named.map((festival, festivalIndex) => (
                        <button type="button" key={`${festival.slug || festival.id || festival.name}-${festivalIndex}`} className="panchang-festival-badge" onClick={(event) => {
                          event.stopPropagation();
                          setSelectedKey(key);
                          setOpenFestival({ ...festival, date: key, tithi, paksha });
                        }} style={{
                          fontFamily: UI_FONT, fontSize: 8.5, fontWeight: 700, lineHeight: 1.2,
                          color: '#15803d', background: `${festival.color}1a`, border: `1px solid ${festival.color}40`,
                          borderRadius: 4, padding: '2px 4px', whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center',
                          width: '100%', cursor: 'pointer',
                        }} aria-label={`Open details for ${festival.name}`}>{festival.name}</button>
                      ))}
                    </div>
                  )}

                  {phaseBadges.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', marginTop: 2, padding: '0 2px' }}>
                      {phaseBadges.map((badge) => (
                        <div key={badge.label} style={{
                          fontFamily: UI_FONT, fontSize: 8.5, fontWeight: 700, lineHeight: 1.2,
                          color: badge.color, background: `${badge.color}1a`, border: `1px solid ${badge.color}55`,
                          borderRadius: 4, padding: '2px 4px', whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center',
                        }}>{badge.label}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="panchang-calendar-legend" style={legendStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={namedLegendStyle}>Diwali</span>
              Named festival
            </span>
            {FESTIVAL_PHASE_MATCHERS.map(({ color, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  fontFamily: UI_FONT, fontSize: 9, fontWeight: 700, color,
                  background: `${color}1a`, border: `1px solid ${color}55`, borderRadius: 4, padding: '1px 5px',
                }}>{label}</span>
              </span>
            ))}
          </div>
        </div>

        {selectedKey && (
          <div className="panchang-selected-panel" style={selectedPanelStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: UI_FONT, fontSize: 11, color: '#9A7150', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>
                  Selected date
                </div>
                <div className="panchang-selected-date" style={{ fontFamily: UI_FONT, fontSize: 25, fontWeight: 800, color: '#1a1a1a' }}>
                  {parseDateKey(selectedKey).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div style={countBadgeStyle}>
                <CalendarDays size={14} />
                {selectedFestivals.length} festival{selectedFestivals.length === 1 ? '' : 's'}
              </div>
            </div>

            {selectedFestivals.length > 0 ? (
              <div style={festivalDetailGridStyle} className="festival-detail-grid">
                {selectedFestivals.map((festival, index) => {
                  const meta = classifyFestival(festival);
                  const parana = paranaText(festival.parana);
                  return (
                    <div key={`${festival.slug || festival.name}-${index}`} style={{
                      background: `${meta.color}12`,
                      border: `1px solid ${meta.color}35`,
                      borderRadius: 10,
                      padding: 16,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                        <div>
                          <div style={{ fontFamily: UI_FONT, fontSize: 16, fontWeight: 800, color: '#111827', lineHeight: 1.25 }}>
                            {festival.name}
                          </div>
                          <div style={{ fontFamily: UI_FONT, fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                            {festival.tradition || (meta.isNamedFestival ? 'Hindu Festival' : 'Vrat / Tithi observance')}
                          </div>
                        </div>
                        <span style={{
                          fontFamily: UI_FONT,
                          fontSize: 10,
                          fontWeight: 800,
                          color: meta.isNamedFestival ? '#15803d' : meta.color,
                          background: '#fff',
                          border: `1px solid ${meta.color}40`,
                          borderRadius: 999,
                          padding: '4px 8px',
                          whiteSpace: 'nowrap',
                        }}>
                          {meta.isNamedFestival ? 'Festival' : 'Observance'}
                        </span>
                      </div>
                      {festival.slug && <div style={festivalMetaStyle}>Slug: {festival.slug}</div>}
                      {parana && <div style={festivalMetaStyle}>Parana: {parana}</div>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={emptyStateStyle}>No Hindu festival or vrat detail is listed for this date.</div>
            )}
          </div>
        )}

        {monthFestivalDays.length > 0 && (
          <div className="panchang-month-list" style={monthListStyle}>
            <div style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 800, color: '#1a1a1a', marginBottom: 10 }}>
              Festivals this month
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {monthFestivalDays.map((day) => (
                <button key={day.date} type="button" onClick={() => setSelectedKey(day.date)} style={monthListButtonStyle}>
                  <span style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 800, color: '#E8650A', minWidth: 56 }}>
                    {parseDateKey(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span style={{ fontFamily: UI_FONT, fontSize: 13, color: '#374151', textAlign: 'left' }}>
                    {day.festivals.map((festival) => festival.name).join(', ')}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {openFestival && (
        <FestivalDetailsModal festival={openFestival} onClose={() => setOpenFestival(null)} />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .panchang-calendar-section,
        .panchang-calendar-container,
        .panchang-calendar-card { min-width: 0; box-sizing: border-box; }
        .panchang-calendar-section * { box-sizing: border-box; }
        .panchang-day-cell:focus-visible { outline: 3px solid rgba(232,101,10,.35); outline-offset: 1px; }
        .panchang-festival-badge:hover { filter: brightness(.96); transform: translateY(-1px); }
        .panchang-festival-badge:focus-visible { outline: 2px solid #16a34a; outline-offset: 1px; }
        .panchang-festival-overlay { position:fixed; inset:0; z-index:10000; padding:24px; overflow-y:auto; background:rgba(30,20,8,.62); backdrop-filter:blur(5px); display:flex; align-items:flex-start; justify-content:center; }
        .panchang-festival-modal { width:min(680px,100%); margin:auto; overflow:hidden; border-radius:22px; background:#fffaf2; box-shadow:0 35px 100px rgba(0,0,0,.45); animation:panchangFestivalIn .25s ease; }
        @keyframes panchangFestivalIn { from { opacity:0; transform:translateY(20px) scale(.98); } to { opacity:1; transform:none; } }
        .panchang-festival-modal-hero { position:relative; display:flex; align-items:center; gap:18px; padding:30px 58px 26px 28px; color:#fff; }
        .panchang-festival-modal-hero h2 { margin:3px 0 8px; font-family:var(--font-display,${UI_FONT}); font-size:clamp(25px,4vw,36px); line-height:1.1; }
        .panchang-festival-kicker { font-family:${UI_FONT}; font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; opacity:.8; }
        .panchang-festival-date { font-family:${UI_FONT}; font-size:13px; font-weight:600; opacity:.9; }
        .panchang-festival-icon { width:68px; height:68px; flex:0 0 68px; border-radius:20px; background:rgba(255,255,255,.18); display:flex; align-items:center; justify-content:center; font-size:34px; }
        .panchang-festival-close { position:absolute; top:15px; right:15px; width:38px; height:38px; border:0; border-radius:50%; background:rgba(255,255,255,.2); color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; }
        .panchang-festival-close:hover { background:rgba(255,255,255,.32); }
        .panchang-festival-modal-body { padding:25px 28px 30px; }
        .panchang-festival-facts { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-bottom:22px; }
        .panchang-festival-facts div { padding:12px 14px; border:1px solid #eadbc7; border-radius:11px; background:#fff; }
        .panchang-festival-facts span,.panchang-festival-temple span { display:block; margin-bottom:4px; font-family:${UI_FONT}; font-size:10px; font-weight:800; color:#9A7150; letter-spacing:.08em; text-transform:uppercase; }
        .panchang-festival-facts strong,.panchang-festival-temple strong { font-family:${UI_FONT}; font-size:14px; color:#2f1c0d; }
        .panchang-festival-copy { margin:0 0 20px; }
        .panchang-festival-copy h3 { margin:0 0 7px; font-family:var(--font-display,${UI_FONT}); font-size:19px; color:#4b1d04; }
        .panchang-festival-copy p,.panchang-festival-copy li { font-family:${UI_FONT}; font-size:14px; line-height:1.75; color:#5f4632; }
        .panchang-festival-copy p { margin:0; white-space:pre-line; }
        .panchang-festival-temple { display:flex; align-items:center; gap:10px; padding:13px 15px; border:1px solid rgba(22,163,74,.25); border-radius:12px; background:rgba(22,163,74,.07); color:#15803d; }
        .panchang-festival-parana,.panchang-festival-empty { margin:14px 0 0; font-family:${UI_FONT}; font-size:13px; color:#6b4c35; }
        .panchang-festival-back { width:100%; margin-top:24px; padding:12px 18px; border:1.5px solid #d9c4a9; border-radius:999px; background:#fff; color:#6f3510; font-family:${UI_FONT}; font-size:13px; font-weight:800; cursor:pointer; transition:background .15s,border-color .15s,transform .15s; }
        .panchang-festival-back:hover { background:#fff3e5; border-color:#E8650A; transform:translateY(-1px); }
        .panchang-festival-back:focus-visible { outline:3px solid rgba(232,101,10,.3); outline-offset:2px; }
        @media (max-width: 720px) {
          .festival-detail-grid { grid-template-columns: 1fr !important; }
          .panchang-calendar-section { padding-bottom: 36px !important; }
          .panchang-calendar-container { padding: 26px 12px 0 !important; }
          .panchang-calendar-card { border-radius: 10px !important; }
          .panchang-month-header { padding: 12px 10px !important; }
          .panchang-month-title { font-size: 16px !important; }
          .panchang-weekdays { padding: 8px 5px 3px !important; }
          .panchang-weekday { padding-bottom: 4px !important; font-size: 10px !important; }
          .panchang-calendar-grid { padding: 0 5px 8px !important; gap: 2px !important; }
          .panchang-day-cell {
            min-width: 0 !important;
            min-height: 78px !important;
            padding: 6px 2px !important;
            border-radius: 6px !important;
            gap: 1px !important;
          }
          .panchang-day-number { font-size: 13px !important; }
          .panchang-day-tithi,
          .panchang-day-paksha {
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 8px !important;
          }
          .panchang-calendar-legend { padding: 10px !important; gap: 8px !important; font-size: 10px !important; }
          .panchang-selected-panel,
          .panchang-month-list { padding: 16px 13px !important; border-radius: 10px !important; }
          .panchang-selected-date { font-size: 20px !important; line-height: 1.25; }
          .panchang-festival-overlay { padding:12px; }
          .panchang-festival-modal-hero { padding:25px 50px 22px 20px; gap:12px; }
          .panchang-festival-icon { width:52px; height:52px; flex-basis:52px; font-size:27px; border-radius:15px; }
          .panchang-festival-modal-body { padding:20px 18px 24px; }
          .panchang-festival-facts { grid-template-columns:1fr; }
        }
        @media (max-width: 480px) {
          .panchang-calendar-container { padding-left: 8px !important; padding-right: 8px !important; }
          .panchang-weekday { font-size: 8px !important; }
          .panchang-day-cell { min-height: 62px !important; padding: 5px 1px !important; }
          .panchang-day-number { font-size: 12px !important; }
          .panchang-day-paksha { display: none !important; }
          .panchang-calendar-legend { align-items: flex-start !important; }
        }
      `}</style>
    </section>
  );
}

function FestivalDetailsModal({ festival, onClose }) {
  const meta = classifyFestival(festival);
  const parana = paranaText(festival.parana);
  const displayDate = festival.date
    ? parseDateKey(festival.date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : festival.display_date || festival.exact_date || festival.typical_date;
  const duration = Number(festival.duration_days || 1);

  return (
    <div className="panchang-festival-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <article className="panchang-festival-modal" role="dialog" aria-modal="true" aria-labelledby="panchang-festival-title">
        <div className="panchang-festival-modal-hero" style={{ background: `linear-gradient(135deg, ${meta.color}, #3f220f)` }}>
          <button type="button" className="panchang-festival-close" onClick={onClose} aria-label="Close festival details">
            <X size={20} />
          </button>
          <div className="panchang-festival-icon" aria-hidden="true">{festival.emoji || '🌿'}</div>
          <div>
            <div className="panchang-festival-kicker">Hindu Festival</div>
            <h2 id="panchang-festival-title">{festival.name}</h2>
            {displayDate && <div className="panchang-festival-date">📅 {displayDate}</div>}
          </div>
        </div>

        <div className="panchang-festival-modal-body">
          <div className="panchang-festival-facts">
            {(festival.hindu_tithi || festival.tithi) && <div><span>Tithi</span><strong>{festival.hindu_tithi || festival.tithi}</strong></div>}
            {festival.hindu_month && <div><span>Hindu month</span><strong>{festival.hindu_month}</strong></div>}
            {festival.deity && festival.deity !== 'Other' && <div><span>Dedicated to</span><strong>{festival.deity}</strong></div>}
            <div><span>Duration</span><strong>{duration} day{duration === 1 ? '' : 's'}</strong></div>
          </div>

          {festival.significance && (
            <section className="panchang-festival-copy">
              <h3>Significance</h3>
              <p>{festival.significance}</p>
            </section>
          )}
          {festival.description && festival.description !== festival.significance && (
            <section className="panchang-festival-copy">
              <h3>About the festival</h3>
              <p>{festival.description}</p>
            </section>
          )}
          {Array.isArray(festival.rituals) && festival.rituals.length > 0 && (
            <section className="panchang-festival-copy">
              <h3>Rituals and traditions</h3>
              <ul>{festival.rituals.map((ritual, index) => <li key={index}>{typeof ritual === 'string' ? ritual : ritual?.title || ritual?.name}</li>)}</ul>
            </section>
          )}
          {festival.temple_name && (
            <div className="panchang-festival-temple">
              <MapPin size={17} />
              <div><span>Celebrated at</span><strong>{festival.temple_name}{festival.temple_city ? `, ${festival.temple_city}` : ''}</strong></div>
            </div>
          )}
          {parana && <div className="panchang-festival-parana"><strong>Parana:</strong> {parana}</div>}
          {!festival.significance && !festival.description && (
            <p className="panchang-festival-empty">Detailed information for this observance is not available yet.</p>
          )}
          <button type="button" className="panchang-festival-back" onClick={onClose}>
            ← Back to Panchang Calendar
          </button>
        </div>
      </article>
    </div>
  );
}

const calendarCardStyle = {
  border: '1px solid #e5d9c8',
  borderRadius: 12,
  background: '#fff',
  boxShadow: '0 1px 8px rgba(61,31,0,0.06)',
  overflow: 'hidden',
  marginBottom: 22,
};

const monthHeaderStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 20px',
  borderBottom: '1px solid #f0e8da',
};

const navBtnStyle = {
  width: 32, height: 32, borderRadius: '50%',
  background: '#f9f5f0',
  border: '1px solid #e5d9c8',
  color: '#6b7280',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const loadingStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  padding: '12px 20px', background: '#fdf9f4', borderBottom: '1px solid #f0e8da',
  fontFamily: UI_FONT, fontSize: 12, color: '#9A7150',
};

const errorStyle = {
  margin: 16, padding: 12, borderRadius: 8, background: '#fff4f0', color: '#b42020',
  border: '1px solid rgba(180,32,32,.18)', fontFamily: UI_FONT, fontSize: 13,
};

const todayPillStyle = {
  position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
  background: '#E8650A', color: 'white', fontFamily: UI_FONT, fontSize: 9,
  fontWeight: 700, borderRadius: 50, padding: '1px 6px', letterSpacing: '.04em',
  textTransform: 'uppercase', whiteSpace: 'nowrap',
};

const smallCellTextStyle = {
  fontFamily: UI_FONT,
  fontSize: 9,
  color: '#7a3208',
  maxWidth: 66,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  lineHeight: 1.2,
};

const legendStyle = {
  display: 'flex', gap: 16, padding: '10px 16px 14px', borderTop: '1px solid #f0e8da',
  fontFamily: UI_FONT, fontSize: 11, color: '#6b7280', flexWrap: 'wrap', alignItems: 'center',
};

const namedLegendStyle = {
  fontFamily: UI_FONT, fontSize: 9, fontWeight: 700, color: '#15803d',
  background: '#16a34a1a', border: '1px solid #16a34a40', borderRadius: 4, padding: '1px 5px',
};

const selectedPanelStyle = {
  border: '1px solid #e5d9c8',
  borderRadius: 10,
  background: '#fff',
  padding: 18,
  marginBottom: 18,
};

const countBadgeStyle = {
  display: 'flex', alignItems: 'center', gap: 6,
  fontFamily: UI_FONT, fontSize: 12, fontWeight: 800, color: '#9A7150',
  background: '#fdf9f4', border: '1px solid #f0e8da', borderRadius: 999, padding: '7px 11px',
};

const festivalDetailGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 14,
};

const festivalMetaStyle = {
  fontFamily: UI_FONT,
  fontSize: 12,
  color: '#92400e',
  marginTop: 8,
};

const emptyStateStyle = {
  background: '#f9fafb',
  border: '1px solid #edf0f2',
  borderRadius: 8,
  padding: 14,
  fontFamily: UI_FONT,
  fontSize: 13,
  color: '#6b7280',
};

const monthListStyle = {
  border: '1px solid #e5d9c8',
  borderRadius: 10,
  background: '#fff',
  padding: 16,
};

const monthListButtonStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  border: '1px solid #f0e8da',
  borderRadius: 8,
  background: '#fffdf9',
  cursor: 'pointer',
};
