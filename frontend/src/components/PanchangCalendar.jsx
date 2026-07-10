import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { panchangAPI } from '../services/api';

const UI_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Roboto", sans-serif';
const DEFAULT_COORDINATES = '25.3176,82.9739';
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const PHASE_MATCHERS = [
  { test: (name) => name.includes('ekadashi'), color: '#e67e22', label: 'Ekadashi' },
  { test: (name) => name.includes('purnima') || name.includes('pradosh'), color: '#8b5cf6', label: 'Purnima / Pradosh' },
  { test: (name) => name.includes('amavasya'), color: '#374151', label: 'Amavasya' },
  { test: (name) => name.includes('chaturthi') && !name.includes('ganesh'), color: '#dc2626', label: 'Chaturthi' },
];

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function prettyDate(dateKey) {
  return parseDateKey(dateKey).toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function classifyFestival(festival) {
  const name = (festival.name || '').toLowerCase();
  const phase = PHASE_MATCHERS.find((matcher) => matcher.test(name));
  if (phase) return { ...phase, isNamedFestival: false };
  return { color: '#16a34a', label: 'Festival', isNamedFestival: true };
}

function splitFestivals(day) {
  const named = [];
  const phaseDots = [];
  (day?.festivals || []).forEach((festival) => {
    const meta = classifyFestival(festival);
    if (meta.isNamedFestival) named.push({ ...festival, color: meta.color });
    else phaseDots.push({ ...festival, color: meta.color, phaseLabel: meta.label });
  });
  return { named, phaseDots };
}

function paranaText(parana) {
  if (!parana || typeof parana !== 'object') return '';
  const values = Object.values(parana).filter(Boolean);
  return values.length ? values.join(' - ') : '';
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
        setMonthData(null);
        setError(err.response?.data?.detail?.message || err.response?.data?.detail || err.message || 'Could not load calendar data');
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

  const monthFestivalDays = useMemo(() => (
    (monthData?.days || [])
      .filter((day) => (day.festivals || []).length > 0)
      .map((day) => ({ date: day.date, festivals: day.festivals }))
  ), [monthData]);

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result = [];
    for (let index = 0; index < firstDay; index += 1) result.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) result.push(new Date(year, month, day));
    return result;
  }, [year, month]);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <section style={{ background: '#fff', padding: '0 0 56px 0', borderTop: '1px solid #f0e8da' }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: '36px 20px 0' }}>
        <div style={{ fontFamily: UI_FONT, fontSize: 12, fontWeight: 700, color: '#9A7150', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          Hindu festival calendar
        </div>

        <div style={calendarCardStyle}>
          <div style={monthHeaderStyle}>
            <button type="button" onClick={prevMonth} style={navBtnStyle} aria-label="Previous month"><ChevronLeft size={16} /></button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: UI_FONT, fontSize: 22, fontWeight: 800, color: '#111827' }}>
                {MONTH_NAMES[month]} {year}
              </div>
              <div style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150', marginTop: 3 }}>
                Festival dates and observances
              </div>
            </div>
            <button type="button" onClick={nextMonth} style={navBtnStyle} aria-label="Next month"><ChevronRight size={16} /></button>
          </div>

          {loading && (
            <div style={loadingStyle}>
              <Loader2 size={14} style={{ animation: 'spin .9s linear infinite', color: '#E8650A' }} />
              <span>Loading calendar...</span>
            </div>
          )}

          {error && (
            <div style={errorStyle}>{error}</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '16px 16px 6px' }}>
            {DAY_LABELS.map((day, index) => (
              <div key={day} style={{
                textAlign: 'center',
                fontFamily: UI_FONT,
                fontSize: 12,
                fontWeight: 700,
                color: index === 0 ? '#B42020' : index === 6 ? '#1A6A3A' : '#6b7280',
                paddingBottom: 8,
              }}>
                {day}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', padding: '0 16px 16px', gap: 5 }}>
            {cells.map((date, index) => {
              if (!date) return <div key={`empty-${index}`} />;
              const key = toDateKey(date);
              const day = daysByKey.get(key);
              const isSelected = key === selectedKey;
              const isToday = key === toDateKey(today);
              const isSunday = date.getDay() === 0;
              const isSaturday = date.getDay() === 6;
              const { named, phaseDots } = splitFestivals(day);
              const primaryFestival = named[0] || phaseDots[0];
              const extraCount = Math.max(0, named.length + phaseDots.length - 1);

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedKey(key)}
                  title={(day?.festivals || []).map((festival) => festival.name).join(', ') || undefined}
                  style={{
                    border: isSelected ? '2px solid #E8650A' : isToday ? '2px solid rgba(232,101,10,.35)' : '1px solid #f0e4d2',
                    borderRadius: 8,
                    background: primaryFestival ? '#fbfdf9' : '#fff',
                    cursor: 'pointer',
                    padding: '8px 6px',
                    minHeight: 96,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-start',
                    gap: 5,
                    position: 'relative',
                    textAlign: 'center',
                  }}
                >
                  {isToday && <span style={todayPillStyle}>Today</span>}
                  <span style={{
                    fontFamily: UI_FONT,
                    fontSize: 17,
                    fontWeight: 800,
                    color: isSelected ? '#E8650A' : isSunday ? '#B42020' : isSaturday ? '#1A6A3A' : '#111827',
                    marginTop: isToday ? 14 : 0,
                  }}>
                    {date.getDate()}
                  </span>

                  {primaryFestival && (
                    <span style={{
                      width: '100%',
                      fontFamily: UI_FONT,
                      fontSize: 10,
                      fontWeight: 800,
                      lineHeight: 1.2,
                      color: primaryFestival.color === '#16a34a' ? '#15803d' : primaryFestival.color,
                      background: `${primaryFestival.color}18`,
                      border: `1px solid ${primaryFestival.color}35`,
                      borderRadius: 5,
                      padding: '3px 5px',
                      whiteSpace: 'normal',
                      wordBreak: 'break-word',
                    }}>
                      {primaryFestival.name}
                    </span>
                  )}

                  {extraCount > 0 && (
                    <span style={{ fontFamily: UI_FONT, fontSize: 10, fontWeight: 700, color: '#9A7150' }}>
                      +{extraCount} more
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={legendStyle}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={namedLegendStyle}>Festival</span>
              Major festival
            </span>
            {PHASE_MATCHERS.map(({ color, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: color, display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div style={selectedPanelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 800, color: '#9A7150', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 5 }}>
                Selected date
              </div>
              <div style={{ fontFamily: UI_FONT, fontSize: 24, fontWeight: 850, color: '#111827' }}>
                {prettyDate(selectedKey)}
              </div>
            </div>
            <div style={countBadgeStyle}>
              <CalendarDays size={15} />
              {selectedFestivals.length || 0} observance{selectedFestivals.length === 1 ? '' : 's'}
            </div>
          </div>

          {selectedFestivals.length > 0 ? (
            <div style={festivalGridStyle} className="festival-grid">
              {selectedFestivals.map((festival, index) => {
                const meta = classifyFestival(festival);
                const parana = paranaText(festival.parana);
                return (
                  <article key={`${festival.slug || festival.name}-${index}`} style={{
                    border: `1px solid ${meta.color}35`,
                    background: `${meta.color}10`,
                    borderRadius: 8,
                    padding: 14,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        background: meta.color,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Sparkles size={14} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: UI_FONT, fontSize: 15, fontWeight: 850, color: '#111827', lineHeight: 1.25 }}>
                          {festival.name}
                        </div>
                        <div style={{ fontFamily: UI_FONT, fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                          {festival.tradition || meta.label}
                        </div>
                      </div>
                    </div>
                    {parana && (
                      <div style={{ fontFamily: UI_FONT, fontSize: 12, color: '#7a3208', marginTop: 10 }}>
                        Parana: {parana}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div style={emptyStateStyle}>
              No major Hindu festival is listed for this date.
            </div>
          )}
        </div>

        {monthFestivalDays.length > 0 && (
          <div style={monthListStyle}>
            <div style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 850, color: '#111827', marginBottom: 12 }}>
              Festivals This Month
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {monthFestivalDays.map((item) => (
                <button
                  key={item.date}
                  type="button"
                  onClick={() => setSelectedKey(item.date)}
                  style={monthListButtonStyle}
                >
                  <span style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 800, color: '#E8650A', minWidth: 58 }}>
                    {parseDateKey(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                  <span style={{ fontFamily: UI_FONT, fontSize: 13, color: '#374151', textAlign: 'left' }}>
                    {item.festivals.map((festival) => festival.name).join(', ')}
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
          .festival-grid { grid-template-columns: 1fr !important; }
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
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '18px 22px',
  borderBottom: '1px solid #f0e8da',
};

const navBtnStyle = {
  width: 34,
  height: 34,
  borderRadius: '50%',
  background: '#f9f5f0',
  border: '1px solid #e5d9c8',
  color: '#6b7280',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const loadingStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '12px 20px',
  background: '#fdf9f4',
  borderBottom: '1px solid #f0e8da',
  fontFamily: UI_FONT,
  fontSize: 12,
  color: '#9A7150',
};

const errorStyle = {
  margin: 16,
  padding: 12,
  borderRadius: 8,
  background: '#fff4f0',
  color: '#b42020',
  border: '1px solid rgba(180,32,32,.18)',
  fontFamily: UI_FONT,
  fontSize: 13,
};

const todayPillStyle = {
  position: 'absolute',
  top: 5,
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#E8650A',
  color: 'white',
  fontFamily: UI_FONT,
  fontSize: 9,
  fontWeight: 800,
  borderRadius: 50,
  padding: '1px 7px',
  letterSpacing: '.04em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const legendStyle = {
  display: 'flex',
  gap: 16,
  padding: '11px 16px 14px',
  borderTop: '1px solid #f0e8da',
  fontFamily: UI_FONT,
  fontSize: 11,
  color: '#6b7280',
  flexWrap: 'wrap',
  alignItems: 'center',
};

const namedLegendStyle = {
  fontFamily: UI_FONT,
  fontSize: 9,
  fontWeight: 800,
  color: '#15803d',
  background: '#16a34a1a',
  border: '1px solid #16a34a40',
  borderRadius: 4,
  padding: '1px 5px',
};

const selectedPanelStyle = {
  border: '1px solid #e5d9c8',
  borderRadius: 10,
  background: '#fff',
  padding: 18,
  marginBottom: 18,
};

const countBadgeStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  fontFamily: UI_FONT,
  fontSize: 12,
  fontWeight: 800,
  color: '#9A7150',
  background: '#fdf9f4',
  border: '1px solid #f0e8da',
  borderRadius: 999,
  padding: '8px 12px',
};

const festivalGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
  marginTop: 16,
};

const emptyStateStyle = {
  marginTop: 16,
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
