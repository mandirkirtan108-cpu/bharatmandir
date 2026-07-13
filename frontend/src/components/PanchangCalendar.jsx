import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { panchangAPI } from '../services/api';

const UI_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Roboto", sans-serif';
const DEFAULT_COORDINATES = '25.3176,82.9739';
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const FESTIVAL_PHASE_MATCHERS = [
  { test: (n) => n.includes('ekadashi'), color: '#e67e22', label: 'Ekadashi' },
  { test: (n) => n.includes('pradosh') || n.includes('purnima'), color: '#9b59b6', label: 'Pradosh / Purnima' },
  { test: (n) => n.includes('amavasya'), color: '#374151', label: 'Amavasya' },
  { test: (n) => n.includes('chaturthi') && !n.includes('ganesh'), color: '#e74c3c', label: 'Chaturthi' },
];

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
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
  const phaseDots = [];
  (day?.festivals || []).forEach((festival) => {
    const meta = classifyFestival(festival);
    if (meta.isNamedFestival) named.push({ ...festival, color: meta.color });
    else phaseDots.push(meta.color);
  });
  return { named, phaseDots: phaseDots.slice(0, 3) };
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
        const selectedDate = parseDateKey(selectedKey);
        if (selectedDate.getFullYear() !== year || selectedDate.getMonth() !== month) {
          setSelectedKey(`${year}-${String(month + 1).padStart(2, '0')}-01`);
        }
      } catch (err) {
        if (!active) return;
        setError(err.response?.data?.detail?.message || err.response?.data?.detail || err.message || 'Could not load calendar data');
        setMonthData(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadMonth();
    return () => { active = false; };
  }, [year, month]);

  const daysByKey = useMemo(() => {
    const map = new Map();
    (monthData?.days || []).forEach((day) => map.set(day.date, day));
    return map;
  }, [monthData]);

  const selectedDay = daysByKey.get(selectedKey);
  const selectedFestivals = selectedDay?.festivals || [];

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result = [];
    for (let i = 0; i < firstDay; i += 1) result.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) result.push(new Date(year, month, d));
    return result;
  }, [year, month]);

  const monthFestivalDays = useMemo(() => (
    (monthData?.days || []).filter((day) => (day.festivals || []).length > 0)
  ), [monthData]);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <section style={{ background: '#fff', padding: '0 0 60px 0', borderTop: '1px solid #f0e8da' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px 0' }}>
        <div style={{ fontFamily: UI_FONT, fontSize: 12, fontWeight: 600, color: '#9A7150', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          Calendar grid - with festival names and observance highlights
        </div>

        <div style={calendarCardStyle}>
          <div style={monthHeaderStyle}>
            <button type="button" onClick={prevMonth} style={navBtnStyle} aria-label="Previous month"><ChevronLeft size={16} /></button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: UI_FONT, fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>
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
              <span>Loading month...</span>
            </div>
          )}

          {error && <div style={errorStyle}>{error}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '10px 16px 4px' }}>
            {DAY_LABELS.map((day, index) => (
              <div key={day} style={{
                textAlign: 'center', fontFamily: UI_FONT, fontSize: 12, fontWeight: 600,
                color: index === 0 ? '#B42020' : index === 6 ? '#1A6A3A' : '#6b7280', paddingBottom: 6,
              }}>{day}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '0 12px 16px', gap: 3 }}>
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
              const { named, phaseDots } = splitDayFestivals(day);
              const primaryNamed = named[0];
              const extraNamedCount = named.length - 1;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  title={(day?.festivals || []).map((festival) => festival.name).join(', ') || undefined}
                  style={{
                    border: selected ? '2px solid #E8650A' : isToday ? '2px solid rgba(232,101,10,0.35)' : '1px solid #f0e4d2',
                    borderRadius: 8,
                    background: selected ? '#fff7f0' : primaryNamed ? '#f9fdf9' : '#fff',
                    cursor: 'pointer',
                    padding: '8px 4px 8px',
                    textAlign: 'center',
                    minHeight: primaryNamed ? 106 : 84,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    position: 'relative',
                  }}
                >
                  {isToday && <div style={todayPillStyle}>Today</div>}
                  <span style={{
                    fontFamily: UI_FONT, fontSize: 15, fontWeight: 700, lineHeight: 1,
                    color: selected ? '#E8650A' : isSunday ? '#B42020' : isSaturday ? '#1A6A3A' : '#1a1a1a',
                    marginTop: isToday ? 14 : 0,
                  }}>{date.getDate()}</span>
                  {tithi && <span style={smallCellTextStyle}>{tithi}</span>}
                  {paksha && <span style={{ ...smallCellTextStyle, color: '#9A7150' }}>{paksha}</span>}

                  {primaryNamed && (
                    <div style={{ width: '100%', marginTop: 2, padding: '0 2px' }}>
                      <div style={{
                        fontFamily: UI_FONT, fontSize: 8.5, fontWeight: 700, lineHeight: 1.2,
                        color: '#15803d', background: `${primaryNamed.color}1a`, border: `1px solid ${primaryNamed.color}40`,
                        borderRadius: 4, padding: '2px 4px', whiteSpace: 'normal', wordBreak: 'break-word', textAlign: 'center',
                      }}>{primaryNamed.name}</div>
                      {extraNamedCount > 0 && <div style={{ fontFamily: UI_FONT, fontSize: 8, fontWeight: 700, color: '#9A7150', textAlign: 'center', marginTop: 2 }}>+{extraNamedCount} more</div>}
                    </div>
                  )}

                  {phaseDots.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 2 }}>
                      {phaseDots.map((color, i) => <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />)}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div style={legendStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={namedLegendStyle}>Diwali</span>
              Named festival
            </span>
            {FESTIVAL_PHASE_MATCHERS.map(({ color, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {selectedKey && (
          <div style={selectedPanelStyle}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: UI_FONT, fontSize: 11, color: '#9A7150', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>
                  Selected date
                </div>
                <div style={{ fontFamily: UI_FONT, fontSize: 25, fontWeight: 800, color: '#1a1a1a' }}>
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
          <div style={monthListStyle}>
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

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 720px) {
          .festival-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
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
