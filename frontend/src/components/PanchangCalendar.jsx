import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from 'lucide-react';
import { panchangAPI } from '../services/api';

const UI_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Roboto", sans-serif';
const DEFAULT_COORDINATES = '28.6139,77.2090';
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatTime(value) {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function firstPeriodObj(items, namePart) {
  const found = (items || []).find((item) => item.name?.toLowerCase().includes(namePart.toLowerCase()));
  return found?.period?.[0] || null;
}

function firstPeriodStr(items, namePart) {
  const p = firstPeriodObj(items, namePart);
  if (!p) return '-';
  return `${formatTime(p.start)} - ${formatTime(p.end)}`;
}

// ─── Festival classification: color + whether it's a "named" festival ──────
// Tithi-linked observances (Ekadashi, Purnima, Amavasya, Chaturthi) get their
// own color so they read as calendar "phases". Everything else (Diwali,
// Ram Navami, Holi, Raksha Bandhan, Ganesh Chaturthi's actual festival entry,
// etc.) is treated as a "named festival" and gets its name printed on the
// cell, not just a dot — that's the part that was missing.
const FESTIVAL_PHASE_MATCHERS = [
  { test: (n) => n.includes('ekadashi'), color: '#e67e22', label: 'Ekadashi' },
  { test: (n) => n.includes('pradosh') || n.includes('purnima'), color: '#9b59b6', label: 'Pradosh / Purnima' },
  { test: (n) => n.includes('amavasya'), color: '#374151', label: 'Amavasya' },
  { test: (n) => n.includes('chaturthi') && !n.includes('ganesh'), color: '#e74c3c', label: 'Chaturthi' },
];

function classifyFestival(f) {
  const name = (f.name || '').toLowerCase();
  for (const matcher of FESTIVAL_PHASE_MATCHERS) {
    if (matcher.test(name)) return { color: matcher.color, isNamedFestival: false };
  }
  // Anything else (Diwali, Ram Navami, Holi, Raksha Bandhan, Janmashtami,
  // Ganesh Chaturthi, Navratri, temple-specific festivals, etc.)
  return { color: '#16a34a', isNamedFestival: true };
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
        setError(err.response?.data?.detail?.message || err.response?.data?.detail || err.message || 'Could not load Panchang data');
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

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result = [];
    for (let i = 0; i < firstDay; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) result.push(new Date(year, month, d));
    return result;
  }, [year, month]);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedKey(toDateKey(today));
  };

  // Split a day's festivals into "named" (Diwali, Ram Navami, ...) vs
  // "tithi phase" (Ekadashi, Purnima, ...) so the cell can show the named
  // ones as text and the phase ones as a small dot.
  function splitDayFestivals(day) {
    const named = [];
    const phaseDots = [];
    (day?.festivals || []).forEach((f) => {
      const { color, isNamedFestival } = classifyFestival(f);
      if (isNamedFestival) named.push({ ...f, color });
      else phaseDots.push(color);
    });
    return { named, phaseDots: phaseDots.slice(0, 3) };
  }

  return (
    <section style={{ background: '#fff', padding: '0 0 60px 0', borderTop: '1px solid #f0e8da' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '40px 20px 0' }}>

        {/* Section header label */}
        <div style={{ fontFamily: UI_FONT, fontSize: 12, fontWeight: 600, color: '#9A7150', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
          Calendar grid — with festival names, tithi phases and a real selected-day panel
        </div>

        {/* Main calendar card */}
        <div style={{
          border: '1px solid #e5d9c8',
          borderRadius: 12,
          background: '#fff',
          boxShadow: '0 1px 8px rgba(61,31,0,0.06)',
          overflow: 'hidden',
          marginBottom: 28,
        }}>
          {/* Month header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #f0e8da',
          }}>
            <button onClick={prevMonth} style={navBtnStyle}><ChevronLeft size={16} /></button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: UI_FONT, fontSize: 18, fontWeight: 700, color: '#1a1a1a' }}>
                {MONTH_NAMES[month]} {year}
              </div>
              <div style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150', marginTop: 2 }}>
                Amanta calendar · Varanasi
              </div>
            </div>
            <button onClick={nextMonth} style={navBtnStyle}><ChevronRight size={16} /></button>
          </div>

          {/* Hindu calendar strip */}
          {monthData?.hindu_calendar_meta && (
            <div style={{
              display: 'flex', gap: 20, padding: '10px 20px',
              borderBottom: '1px solid #f0e8da',
              background: '#fdf9f4',
              fontFamily: UI_FONT, fontSize: 12, color: '#6b7280',
            }}>
              {monthData.hindu_calendar_meta.vikram_samvat && <span><strong style={{ color: '#4b5563' }}>Vikram</strong> {monthData.hindu_calendar_meta.vikram_samvat}</span>}
              {monthData.hindu_calendar_meta.shaka_samvat && <span><strong style={{ color: '#4b5563' }}>Shaka</strong> {monthData.hindu_calendar_meta.shaka_samvat}</span>}
              {monthData.hindu_calendar_meta.maas && <span><strong style={{ color: '#4b5563' }}>Maas</strong> {monthData.hindu_calendar_meta.maas}</span>}
              {monthData.hindu_calendar_meta.ritu && <span><strong style={{ color: '#4b5563' }}>Ritu</strong> {monthData.hindu_calendar_meta.ritu}</span>}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 20px', background: '#fdf9f4', borderBottom: '1px solid #f0e8da' }}>
              <Loader2 size={14} style={{ animation: 'spin .9s linear infinite', color: '#E8650A' }} />
              <span style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150' }}>Loading month…</span>
            </div>
          )}

          {error && (
            <div style={{ margin: 16, padding: 12, borderRadius: 8, background: '#fff4f0', color: '#b42020', border: '1px solid rgba(180,32,32,.18)', fontFamily: UI_FONT, fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Day labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '10px 16px 4px' }}>
            {DAY_LABELS.map((day, index) => (
              <div key={day} style={{
                textAlign: 'center', fontFamily: UI_FONT,
                fontSize: 12, fontWeight: 600,
                color: index === 0 ? '#B42020' : index === 6 ? '#1A6A3A' : '#6b7280',
                paddingBottom: 6,
              }}>{day}</div>
            ))}
          </div>

          {/* Calendar grid */}
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
                  onClick={() => setSelectedKey(key)}
                  title={named.length > 0 ? named.map((f) => f.name).join(', ') : undefined}
                  style={{
                    border: selected ? '2px solid #E8650A' : isToday ? '2px solid rgba(232,101,10,0.35)' : '1px solid #f0e4d2',
                    borderRadius: 8,
                    background: selected ? '#fff7f0' : primaryNamed ? '#f9fdf9' : '#fff',
                    cursor: 'pointer',
                    padding: '8px 4px 7px',
                    textAlign: 'center',
                    transition: 'all .12s',
                    minHeight: 84,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                    position: 'relative',
                  }}
                >
                  {/* Today pill */}
                  {isToday && (
                    <div style={{
                      position: 'absolute', top: 4, left: '50%', transform: 'translateX(-50%)',
                      background: '#E8650A', color: 'white',
                      fontFamily: UI_FONT, fontSize: 9, fontWeight: 700,
                      borderRadius: 50, padding: '1px 6px', letterSpacing: '.04em',
                      textTransform: 'uppercase', whiteSpace: 'nowrap',
                    }}>Today</div>
                  )}
                  <span style={{
                    fontFamily: UI_FONT, fontSize: 15, fontWeight: 700, lineHeight: 1,
                    color: selected ? '#E8650A' : isSunday ? '#B42020' : isSaturday ? '#1A6A3A' : '#1a1a1a',
                    marginTop: isToday ? 14 : 0,
                  }}>{date.getDate()}</span>
                  {tithi && (
                    <span style={{
                      fontFamily: UI_FONT, fontSize: 9, color: '#7a3208',
                      maxWidth: 66, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      lineHeight: 1.2,
                    }}>{tithi}</span>
                  )}
                  {paksha && (
                    <span style={{
                      fontFamily: UI_FONT, fontSize: 9, color: '#9A7150',
                      maxWidth: 66, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{paksha}</span>
                  )}

                  {/* Named festival label — e.g. "Ram Navami", "Diwali" */}
                  {primaryNamed && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, maxWidth: 68, marginTop: 1 }}>
                      <span style={{
                        fontFamily: UI_FONT, fontSize: 8.5, fontWeight: 700,
                        color: '#15803d', background: `${primaryNamed.color}1a`,
                        border: `1px solid ${primaryNamed.color}40`,
                        borderRadius: 4, padding: '1px 4px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: extraNamedCount > 0 ? 50 : 66,
                      }}>{primaryNamed.name}</span>
                      {extraNamedCount > 0 && (
                        <span style={{ fontFamily: UI_FONT, fontSize: 8, fontWeight: 700, color: '#9A7150', flexShrink: 0 }}>
                          +{extraNamedCount}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Tithi-phase dots (Ekadashi / Purnima / Amavasya / Chaturthi) */}
                  {phaseDots.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 2 }}>
                      {phaseDots.map((color, i) => (
                        <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex', gap: 16, padding: '10px 16px 14px',
            borderTop: '1px solid #f0e8da',
            fontFamily: UI_FONT, fontSize: 11, color: '#6b7280',
            flexWrap: 'wrap', alignItems: 'center',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                fontFamily: UI_FONT, fontSize: 9, fontWeight: 700, color: '#15803d',
                background: '#16a34a1a', border: '1px solid #16a34a40', borderRadius: 4, padding: '1px 5px',
              }}>Diwali</span>
              Named festival (shown by name)
            </span>
            {[
              { color: '#e67e22', label: 'Ekadashi' },
              { color: '#9b59b6', label: 'Pradosh / Purnima' },
              { color: '#374151', label: 'Amavasya' },
              { color: '#e74c3c', label: 'Chaturthi' },
            ].map(({ color, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Selected day panel */}
        {selectedKey && (
          <div>
            {/* Selected date header */}
            <div style={{ marginBottom: 4 }}>
              <div style={{ fontFamily: UI_FONT, fontSize: 11, color: '#9A7150', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 4 }}>
                SELECTED DATE
                {selectedDay?.hindu_calendar && (
                  <span style={{ marginLeft: 16, color: '#4b5563', textTransform: 'none', letterSpacing: 0 }}>
                    {[selectedDay.hindu_calendar.month_name, selectedDay.hindu_calendar.paksha, selectedDay.tithi?.name, selectedDay.hindu_calendar.day ? `· Day ${selectedDay.hindu_calendar.day} of Vikram ${selectedDay.hindu_calendar.vikram_samvat || '2083'}` : ''].filter(Boolean).join(' ')}
                  </span>
                )}
              </div>
              <div style={{ fontFamily: UI_FONT, fontSize: 26, fontWeight: 800, color: '#1a1a1a' }}>
                {parseDateKey(selectedKey).toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>

            {!selectedDay && !loading && (
              <div style={{ padding: '20px', textAlign: 'center', color: '#9A7150', fontFamily: UI_FONT, fontSize: 14 }}>
                Select a day to view Panchang details
              </div>
            )}

            {selectedDay && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginTop: 20 }} className="panchang-detail-grid">
                {/* Panchang Vivaran */}
                <div style={detailCardStyle}>
                  <div style={detailCardHeaderStyle}>
                    <span>📋</span> Panchang Vivaran
                  </div>
                  {[
                    ['Tithi', selectedDay.tithi?.name],
                    ['Paksha', selectedDay.tithi?.paksha],
                    ['Nakshatra', selectedDay.nakshatra?.name],
                    ['Yoga', selectedDay.yoga?.name],
                    ['Karana', selectedDay.karana?.name],
                    ['Sunrise', formatTime(selectedDay.sunrise)],
                    ['Sunset', formatTime(selectedDay.sunset)],
                    ['Moonrise', formatTime(selectedDay.moonrise)],
                    ['Moonset', formatTime(selectedDay.moonset)],
                  ].map(([label, value]) => (
                    <div key={label} style={detailRowStyle}>
                      <span style={{ color: '#6b7280' }}>{label}</span>
                      <span style={{ color: '#111827', fontWeight: 600 }}>{value || '-'}</span>
                    </div>
                  ))}
                </div>

                {/* Key Muhurat */}
                <div style={detailCardStyle}>
                  <div style={detailCardHeaderStyle}>
                    <span>🕐</span> Key Muhurat
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Brahma */}
                    <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 600, color: '#16a34a', marginBottom: 3 }}>Brahma</div>
                      <div style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#15803d' }}>
                        {firstPeriodStr(selectedDay.auspicious_period, 'Brahma')}
                      </div>
                    </div>
                    {/* Abhijit */}
                    <div style={{ background: '#eff6ff', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 600, color: '#2563eb', marginBottom: 3 }}>Abhijit</div>
                      <div style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#1d4ed8' }}>
                        {firstPeriodStr(selectedDay.auspicious_period, 'Abhijit')}
                      </div>
                    </div>
                    {/* Rahu Kaal */}
                    <div style={{ background: '#fef2f2', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 600, color: '#dc2626', marginBottom: 3 }}>Rahu Kaal</div>
                      <div style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#b91c1c' }}>
                        {firstPeriodStr(selectedDay.inauspicious_period, 'Rahu')}
                      </div>
                    </div>
                    {/* Yamaganda */}
                    <div style={{ background: '#fef9ee', borderRadius: 8, padding: '10px 12px' }}>
                      <div style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 600, color: '#92400e', marginBottom: 3 }}>Yamaganda</div>
                      <div style={{ fontFamily: UI_FONT, fontSize: 14, fontWeight: 700, color: '#78350f' }}>
                        {firstPeriodStr(selectedDay.inauspicious_period, 'Yamaganda')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Observances */}
                <div style={detailCardStyle}>
                  <div style={detailCardHeaderStyle}>
                    <span>📿</span> Observances
                  </div>
                  {(selectedDay.festivals?.length > 0) ? (
                    <div style={{ background: '#fef9ee', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
                      {selectedDay.festivals.slice(0, 6).map((f, i) => (
                        <div key={i} style={{ fontFamily: UI_FONT, fontSize: 13, color: '#92400e', fontWeight: 600, marginBottom: 4 }}>{f.name}</div>
                      ))}
                      {selectedDay.festivals.length > 6 && (
                        <div style={{ fontFamily: UI_FONT, fontSize: 11, color: '#b45309' }}>+{selectedDay.festivals.length - 6} more</div>
                      )}
                    </div>
                  ) : (
                    <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontFamily: UI_FONT, fontSize: 13, color: '#6b7280' }}>
                      No major vrat today
                    </div>
                  )}
                  {[
                    ['Bhadra', selectedDay.bhadra || 'None'],
                    ['Panchak', selectedDay.panchak || 'None'],
                    ['Mooli', selectedDay.mooli || 'None'],
                    ['Disha Shool', selectedDay.disha_shool || 'North'],
                    ['Chandra Rashi', selectedDay.nakshatra?.rashi || (selectedDay.nakshatra?.lord?.name) || '-'],
                    ['Surya Rashi', selectedDay.surya_rashi || '-'],
                  ].map(([label, value]) => (
                    <div key={label} style={detailRowStyle}>
                      <span style={{ color: '#6b7280' }}>{label}</span>
                      <span style={{ color: '#111827', fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 720px) {
          .panchang-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

const navBtnStyle = {
  width: 32, height: 32, borderRadius: '50%',
  background: '#f9f5f0',
  border: '1px solid #e5d9c8',
  color: '#6b7280',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background .15s',
};

const detailCardStyle = {
  background: '#fff',
  borderRadius: 10,
  border: '1px solid #e5d9c8',
  padding: '16px',
};

const detailCardHeaderStyle = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif',
  fontSize: 13,
  fontWeight: 700,
  color: '#374151',
  marginBottom: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const detailRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 8,
  padding: '7px 0',
  borderBottom: '1px solid #f5ede0',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", sans-serif',
  fontSize: 13,
};