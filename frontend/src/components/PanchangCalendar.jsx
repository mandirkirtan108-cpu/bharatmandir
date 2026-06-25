import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, RefreshCw } from 'lucide-react';
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

function firstPeriod(items, namePart) {
  const found = (items || []).find((item) => item.name?.toLowerCase().includes(namePart.toLowerCase()));
  const period = found?.period?.[0];
  if (!period) return '-';
  return `${formatTime(period.start)} - ${formatTime(period.end)}`;
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
    for (let i = 0; i < firstDay; i += 1) result.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) result.push(new Date(year, month, day));
    return result;
  }, [year, month]);

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday = () => {
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedKey(toDateKey(today));
  };

  return (
    <section style={{ background: '#f8f4ef', padding: '0 0 60px 0' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, paddingTop: 48 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'rgba(232,101,10,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#E8650A',
          }}>
            <CalendarDays size={25} />
          </div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display,serif)', fontSize: 24, fontWeight: 800, color: '#7a3208', margin: 0 }}>
              Panchang Calendar
            </h2>
            <p style={{ fontFamily: UI_FONT, color: '#9A7150', fontSize: 14, margin: '4px 0 0' }}>
              Accurate Prokerala tithi, nakshatra, Hindu calendar and daily timings from backend cache
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 22, alignItems: 'start' }} className="panchang-grid">
          <div style={{
            background: 'white', borderRadius: 24,
            boxShadow: '0 8px 40px rgba(61,31,0,0.10)',
            border: '1px solid rgba(232,101,10,0.12)',
            overflow: 'hidden',
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
              padding: '20px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <button onClick={prevMonth} style={navBtnStyle} aria-label="Previous month"><ChevronLeft size={18} /></button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display,serif)', fontSize: 22, fontWeight: 800, color: '#fff' }}>
                  {MONTH_NAMES[month]} {year}
                </div>
                <div style={{ fontFamily: UI_FONT, fontSize: 12, color: 'rgba(255,213,128,0.8)', marginTop: 2 }}>
                  Amanta calendar - cached from Prokerala
                </div>
              </div>
              <button onClick={nextMonth} style={navBtnStyle} aria-label="Next month"><ChevronRight size={18} /></button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px 4px' }}>
              <button onClick={goToday} style={todayBtnStyle}>Today</button>
              {loading && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#9A7150', fontSize: 12 }}><Loader2 size={14} className="spin-icon" /> Loading month</span>}
            </div>

            {error && (
              <div style={{ margin: 16, padding: 14, borderRadius: 12, background: '#fff4f0', color: '#b42020', border: '1px solid rgba(180,32,32,.18)' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '8px 16px 4px' }}>
              {DAY_LABELS.map((day, index) => (
                <div key={day} style={{
                  textAlign: 'center', fontFamily: UI_FONT,
                  fontSize: 11, fontWeight: 700, letterSpacing: '.07em',
                  color: index === 0 ? '#B42020' : index === 6 ? '#1A6A3A' : '#9A7150',
                  paddingBottom: 6,
                }}>{day}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '0 12px 16px', gap: 5 }}>
              {cells.map((date, index) => {
                if (!date) return <div key={`empty-${index}`} />;
                const key = toDateKey(date);
                const day = daysByKey.get(key);
                const selected = key === selectedKey;
                const isToday = key === toDateKey(today);
                const isSunday = date.getDay() === 0;
                const isSaturday = date.getDay() === 6;
                const tithi = day?.tithi?.name || '-';
                const hinduDay = day?.hindu_calendar?.day;
                const hinduMonth = day?.hindu_calendar?.month_name;

                return (
                  <button
                    key={key}
                    onClick={() => setSelectedKey(key)}
                    style={{
                      border: selected ? '2px solid #E8650A' : isToday ? '2px solid rgba(232,101,10,0.4)' : '1px solid #f0e4d2',
                      borderRadius: 12,
                      background: selected ? 'linear-gradient(135deg,#E8650A,#FF8C2A)' : isToday ? 'rgba(232,101,10,0.07)' : '#fff',
                      cursor: 'pointer',
                      padding: '7px 4px 8px',
                      textAlign: 'center',
                      transition: 'all .15s',
                      minHeight: 82,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 3,
                    }}
                  >
                    <span style={{
                      fontFamily: 'var(--font-display,serif)', fontSize: 16, fontWeight: 800, lineHeight: 1,
                      color: selected ? '#fff' : isSunday ? '#B42020' : isSaturday ? '#1A6A3A' : '#3D1F00',
                    }}>{date.getDate()}</span>
                    <span style={{
                      fontFamily: UI_FONT, fontSize: 9, color: selected ? 'rgba(255,255,255,.92)' : '#7a3208',
                      maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{tithi}</span>
                    <span style={{
                      fontFamily: UI_FONT, fontSize: 9, color: selected ? 'rgba(255,255,255,.82)' : '#9A7150',
                      maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{hinduMonth && hinduDay ? `${hinduMonth} ${hinduDay}` : 'Loading'}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <DayDetailPanel selectedKey={selectedKey} day={selectedDay} loading={loading} />
        </div>
      </div>

      <style>{`
        @media (max-width: 840px) {
          .panchang-grid { grid-template-columns: 1fr !important; }
        }
        .spin-icon { animation: spin .9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </section>
  );
}

function DayDetailPanel({ selectedKey, day, loading }) {
  if (!day && loading) {
    return (
      <div style={panelStyle}>
        <Loader2 size={22} className="spin-icon" />
        <p style={{ marginTop: 10, color: '#9A7150' }}>Loading selected day...</p>
      </div>
    );
  }

  if (!day) {
    return (
      <div style={panelStyle}>
        <RefreshCw size={20} color="#E8650A" />
        <p style={{ marginTop: 10, color: '#9A7150' }}>Select a loaded day to view Panchang details.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{
        background: 'linear-gradient(135deg, #3D1F00 0%, #6B3A1F 100%)',
        borderRadius: 18, padding: '20px 22px', color: 'white',
      }}>
        <div style={{ fontFamily: UI_FONT, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,213,128,0.7)', marginBottom: 4 }}>
          Selected Date
        </div>
        <div style={{ fontFamily: 'var(--font-display,serif)', fontSize: 25, fontWeight: 800, lineHeight: 1.1 }}>
          {selectedKey}
        </div>
        <div style={{ fontFamily: UI_FONT, fontSize: 13, color: 'rgba(255,213,128,0.8)', marginTop: 5 }}>
          {day.vaara || '-'} - {day.hindu_calendar?.month_name || '-'} {day.hindu_calendar?.day || ''}
        </div>
      </div>

      <div style={panelStyle}>
        <h3 style={{ fontFamily: 'var(--font-display,serif)', fontSize: 15, fontWeight: 800, color: '#3D1F00', margin: '0 0 12px' }}>
          Panchang Vivaran
        </h3>
        {[
          ['Tithi', day.tithi?.name],
          ['Paksha', day.tithi?.paksha],
          ['Nakshatra', day.nakshatra?.name],
          ['Yoga', day.yoga?.name],
          ['Karana', day.karana?.name],
          ['Sunrise', formatTime(day.sunrise)],
          ['Sunset', formatTime(day.sunset)],
          ['Moonrise', formatTime(day.moonrise)],
          ['Moonset', formatTime(day.moonset)],
        ].map(([label, value]) => (
          <div key={label} style={detailRowStyle}>
            <span style={{ color: '#9A7150', fontWeight: 700 }}>{label}</span>
            <span style={{ color: '#3D1F00', fontWeight: 700, textAlign: 'right' }}>{value || '-'}</span>
          </div>
        ))}
      </div>

      <div style={{ ...panelStyle, background: '#fffaf2' }}>
        <h3 style={{ fontFamily: 'var(--font-display,serif)', fontSize: 15, fontWeight: 800, color: '#3D1F00', margin: '0 0 12px' }}>
          Key Muhurat
        </h3>
        {[
          ['Abhijit', firstPeriod(day.auspicious_period, 'Abhijit')],
          ['Brahma', firstPeriod(day.auspicious_period, 'Brahma')],
          ['Rahu Kaal', firstPeriod(day.inauspicious_period, 'Rahu')],
          ['Yamaganda', firstPeriod(day.inauspicious_period, 'Yamaganda')],
        ].map(([label, value]) => (
          <div key={label} style={detailRowStyle}>
            <span style={{ color: '#9A7150', fontWeight: 700 }}>{label}</span>
            <span style={{ color: '#3D1F00', fontWeight: 700, textAlign: 'right' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const navBtnStyle = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,213,128,0.2)',
  color: '#FFD580',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background .2s',
};

const todayBtnStyle = {
  fontFamily: UI_FONT,
  fontSize: 12,
  fontWeight: 600,
  color: '#E8650A',
  background: 'rgba(232,101,10,0.08)',
  border: '1px solid rgba(232,101,10,0.2)',
  borderRadius: 50,
  padding: '5px 14px',
  cursor: 'pointer',
};

const panelStyle = {
  background: 'white',
  borderRadius: 18,
  border: '1px solid #EDE0CC',
  boxShadow: '0 2px 12px rgba(61,31,0,0.07)',
  padding: 18,
};

const detailRowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  padding: '9px 0',
  borderBottom: '1px solid #F5EDE0',
  fontFamily: UI_FONT,
  fontSize: 13,
};
