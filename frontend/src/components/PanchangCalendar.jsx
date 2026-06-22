import { useState, useEffect } from 'react';

const UI_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Roboto", sans-serif';

// ── Tithi & Nakshatra data (sample — replace with your API) ─────────────────
const TITHI_LIST = [
  'Pratipada','Dwitiya','Tritiya','Chaturthi','Panchami',
  'Shashthi','Saptami','Ashtami','Navami','Dashami',
  'Ekadashi','Dwadashi','Trayodashi','Chaturdashi','Purnima/Amavasya',
];

const NAKSHATRA_LIST = [
  'Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra',
  'Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni',
  'Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha',
  'Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishtha',
  'Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati',
];

const PAKSHA = ['Shukla Paksha ☀️', 'Krishna Paksha 🌑'];

const VARA_LIST = ['Ravivara','Somvara','Mangalavara','Budhavara','Guruvara','Shukravara','Shanivara'];
const VARA_COLORS = ['#E8650A','#9A7150','#B42020','#1A6A3A','#F7A900','#C06090','#222244'];

const FESTIVALS = {
  '2026-06-22': 'Ganga Dussehra',
  '2026-06-29': 'Nirjala Ekadashi',
  '2026-07-03': 'Purnima',
  '2026-07-10': 'Guru Purnima',
  '2026-07-18': 'Amavasya',
  '2026-07-21': 'Hariyali Teej',
  '2026-07-25': 'Nag Panchami',
};

const RAHU_KAAL = {
  0: '4:30–6:00',  // Sunday
  1: '7:30–9:00',  // Monday
  2: '3:00–4:30',  // Tuesday
  3: '12:00–1:30', // Wednesday
  4: '1:30–3:00',  // Thursday
  5: '10:30–12:00',// Friday
  6: '9:00–10:30', // Saturday
};

// ── helper to deterministically generate Panchang data for any date ──────────
function getPanchangForDate(date) {
  const seed   = date.getFullYear() * 10000 + (date.getMonth()+1) * 100 + date.getDate();
  const tithi  = TITHI_LIST[seed % 15];
  const naks   = NAKSHATRA_LIST[seed % 27];
  const paksha = seed % 2 === 0 ? PAKSHA[0] : PAKSHA[1];
  const vara   = VARA_LIST[date.getDay()];
  const rahu   = RAHU_KAAL[date.getDay()];

  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const hindiMonths = ['Chaitra','Vaishakha','Jyeshtha','Ashadha','Shravana','Bhadrapada','Ashwina','Kartika','Margashirsha','Pausha','Magha','Phalguna'];
  const vikramSamvat = 2082;
  const hindiMonth = hindiMonths[date.getMonth()];

  const sunriseHr   = 6 + (seed % 20) / 60;
  const sunsetHr    = 18 + (seed % 40) / 60;
  const fmt = (hr) => {
    const h = Math.floor(hr);
    const m = Math.round((hr - h) * 60).toString().padStart(2, '0');
    return `${h}:${m} AM`.replace(/^18|^19|^20/, h => `${h-12}`).replace(' AM', h > 12 ? ' PM' : ' AM');
  };

  return { tithi, nakshatra: naks, paksha, vara, rahu, sunriseHr, sunsetHr, hindiMonth, vikramSamvat };
}

function toDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const HINDI_MONTH_NAMES = ['Chaitra','Vaishakha','Jyeshtha','Ashadha','Shravana','Bhadrapada','Ashwina','Kartika','Margashirsha','Pausha','Magha','Phalguna'];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function PanchangCalendar() {
  const today     = new Date();
  const [viewDate, setViewDate]       = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected]       = useState(today);
  const [panchang, setPanchang]       = useState(getPanchangForDate(today));

  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay   = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  const handleDayClick = (date) => {
    if (!date) return;
    setSelected(date);
    setPanchang(getPanchangForDate(date));
  };

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const goToday   = () => { setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); handleDayClick(today); };

  const isToday  = (d) => d && toDateKey(d) === toDateKey(today);
  const isSel    = (d) => d && toDateKey(d) === toDateKey(selected);
  const hasFest  = (d) => d && FESTIVALS[toDateKey(d)];

  return (
    <section style={{ background: '#f8f4ef', padding: '0 0 60px 0' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px' }}>

        {/* Section Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, paddingTop: 48 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'rgba(232,101,10,0.10)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, flexShrink: 0,
          }}>📅</div>
          <div>
            <h2 style={{ fontFamily: 'var(--font-display,serif)', fontSize: 24, fontWeight: 800, color: '#7a3208', margin: 0 }}>
              Panchang Calendar
            </h2>
            <p style={{ fontFamily: UI_FONT, color: '#9A7150', fontSize: 14, margin: '4px 0 0' }}>
              Tithi, Nakshatra, festivals & auspicious timings — every day of the month
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 22, alignItems: 'start' }} className="panchang-grid">

          {/* ── CALENDAR ── */}
          <div style={{
            background: 'white', borderRadius: 24,
            boxShadow: '0 8px 40px rgba(61,31,0,0.10)',
            border: '1px solid rgba(232,101,10,0.12)',
            overflow: 'hidden',
          }}>
            {/* Month Nav */}
            <div style={{
              background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
              padding: '20px 24px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <button onClick={prevMonth} style={navBtnStyle}>‹</button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-display,serif)', fontSize: 22, fontWeight: 800, color: '#fff' }}>
                  {MONTH_NAMES[month]} {year}
                </div>
                <div style={{ fontFamily: UI_FONT, fontSize: 12, color: 'rgba(255,213,128,0.8)', marginTop: 2 }}>
                  {HINDI_MONTH_NAMES[month]} · Vikram Samvat 2082
                </div>
              </div>
              <button onClick={nextMonth} style={navBtnStyle}>›</button>
            </div>

            {/* Today Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px 4px' }}>
              <button onClick={goToday} style={{
                fontFamily: UI_FONT, fontSize: 12, fontWeight: 600,
                color: '#E8650A', background: 'rgba(232,101,10,0.08)',
                border: '1px solid rgba(232,101,10,0.2)', borderRadius: 50,
                padding: '4px 14px', cursor: 'pointer',
              }}>Today</button>
            </div>

            {/* Day Labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '8px 16px 4px' }}>
              {DAY_LABELS.map((d, i) => (
                <div key={d} style={{
                  textAlign: 'center', fontFamily: UI_FONT,
                  fontSize: 11, fontWeight: 700, letterSpacing: '.07em',
                  color: i === 0 ? '#B42020' : i === 6 ? '#1A6A3A' : '#9A7150',
                  paddingBottom: 6,
                }}>{d}</div>
              ))}
            </div>

            {/* Date Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '0 12px 16px', gap: 4 }}>
              {cells.map((date, idx) => {
                if (!date) return <div key={idx} />;
                const key     = toDateKey(date);
                const fest    = FESTIVALS[key];
                const today_  = isToday(date);
                const sel     = isSel(date);
                const pg      = getPanchangForDate(date);
                const isSun   = date.getDay() === 0;
                const isSat   = date.getDay() === 6;

                return (
                  <button
                    key={key}
                    onClick={() => handleDayClick(date)}
                    style={{
                      border: sel
                        ? '2px solid #E8650A'
                        : today_ ? '2px solid rgba(232,101,10,0.4)' : '1px solid transparent',
                      borderRadius: 12,
                      background: sel
                        ? 'linear-gradient(135deg,#E8650A,#FF8C2A)'
                        : today_ ? 'rgba(232,101,10,0.07)' : 'transparent',
                      cursor: 'pointer',
                      padding: '6px 4px 8px',
                      textAlign: 'center',
                      transition: 'all .15s',
                      position: 'relative',
                      minHeight: 60,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    }}
                    onMouseEnter={e => { if (!sel) e.currentTarget.style.background = 'rgba(232,101,10,0.07)'; }}
                    onMouseLeave={e => { if (!sel && !today_) e.currentTarget.style.background = 'transparent'; if (!sel && today_) e.currentTarget.style.background = 'rgba(232,101,10,0.07)'; }}
                  >
                    {/* Date number */}
                    <span style={{
                      fontFamily: 'var(--font-display,serif)', fontSize: 16, fontWeight: 700, lineHeight: 1,
                      color: sel ? '#fff' : isSun ? '#B42020' : isSat ? '#1A6A3A' : '#3D1F00',
                    }}>{date.getDate()}</span>
                    {/* Tithi */}
                    <span style={{
                      fontFamily: UI_FONT, fontSize: 9, lineHeight: 1.2,
                      color: sel ? 'rgba(255,255,255,0.85)' : '#9A7150',
                      maxWidth: 54, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{pg.tithi}</span>
                    {/* Festival dot */}
                    {fest && (
                      <div style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: sel ? '#fff' : '#E8650A',
                        flexShrink: 0,
                      }} title={fest} />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Festival Legend row */}
            {Object.entries(FESTIVALS)
              .filter(([k]) => k.startsWith(`${year}-${String(month+1).padStart(2,'0')}`))
              .length > 0 && (
              <div style={{ padding: '0 16px 18px' }}>
                <div style={{ borderTop: '1px solid #EDE0CC', paddingTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontFamily: UI_FONT, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9A7150', alignSelf: 'center' }}>Festivals</span>
                  {Object.entries(FESTIVALS)
                    .filter(([k]) => k.startsWith(`${year}-${String(month+1).padStart(2,'0')}`))
                    .map(([k, v]) => {
                      const d = parseInt(k.split('-')[2]);
                      return (
                        <span key={k} style={{
                          fontFamily: UI_FONT, fontSize: 11,
                          background: '#FDF6EC', border: '1px solid #EDE0CC',
                          borderRadius: 50, padding: '3px 10px', color: '#5C3D1E',
                        }}>
                          <span style={{ color: '#E8650A', fontWeight: 700 }}>{d}</span> · {v}
                        </span>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* ── DETAIL PANEL ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Selected date header */}
            <div style={{
              background: 'linear-gradient(135deg, #3D1F00 0%, #6B3A1F 100%)',
              borderRadius: 18, padding: '20px 22px', color: 'white',
            }}>
              <div style={{ fontFamily: UI_FONT, fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(255,213,128,0.7)', marginBottom: 4 }}>
                Selected Date
              </div>
              <div style={{ fontFamily: 'var(--font-display,serif)', fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>
                {selected.getDate()} {MONTH_NAMES[selected.getMonth()]} {selected.getFullYear()}
              </div>
              <div style={{ fontFamily: UI_FONT, fontSize: 13, color: 'rgba(255,213,128,0.8)', marginTop: 4 }}>
                {VARA_LIST[selected.getDay()]} · {panchang.paksha}
              </div>
            </div>

            {/* Panchang Details */}
            <div style={{
              background: 'white', borderRadius: 18,
              border: '1px solid #EDE0CC',
              boxShadow: '0 2px 12px rgba(61,31,0,0.07)',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '16px 18px', borderBottom: '1px solid #F5EDE0' }}>
                <h3 style={{ fontFamily: 'var(--font-display,serif)', fontSize: 15, fontWeight: 800, color: '#3D1F00', margin: 0 }}>
                  🕉 Panchang Vivaran
                </h3>
              </div>
              <div style={{ padding: '6px 0' }}>
                {[
                  { icon: '🌙', label: 'Tithi',     value: panchang.tithi },
                  { icon: '⭐', label: 'Nakshatra', value: panchang.nakshatra },
                  { icon: '☀️', label: 'Vara',      value: panchang.vara, color: VARA_COLORS[selected.getDay()] },
                  { icon: '🔵', label: 'Paksha',    value: panchang.paksha },
                  { icon: '🌅', label: 'Sunrise',   value: '6:08 AM' },
                  { icon: '🌇', label: 'Sunset',    value: '7:24 PM' },
                ].map(row => (
                  <div key={row.label} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 18px', borderBottom: '1px solid #FDF6EC',
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{row.icon}</span>
                    <span style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150', fontWeight: 600, flexShrink: 0, width: 80 }}>{row.label}</span>
                    <span style={{ fontFamily: UI_FONT, fontSize: 13, color: row.color || '#3D1F00', fontWeight: 600 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rahu Kaal */}
            <div style={{
              background: '#FFF4F0',
              borderRadius: 14, border: '1px solid rgba(180,32,32,0.15)',
              padding: '14px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{ fontFamily: UI_FONT, fontSize: 12, fontWeight: 700, color: '#B42020', letterSpacing: '.06em', textTransform: 'uppercase' }}>Rahu Kaal</span>
              </div>
              <div style={{ fontFamily: 'var(--font-display,serif)', fontSize: 18, fontWeight: 800, color: '#B42020' }}>
                {panchang.rahu}
              </div>
              <div style={{ fontFamily: UI_FONT, fontSize: 11, color: '#9A7150', marginTop: 3 }}>
                Avoid auspicious work during this period
              </div>
            </div>

            {/* Festival if any */}
            {FESTIVALS[toDateKey(selected)] && (
              <div style={{
                background: 'rgba(232,101,10,0.07)',
                borderRadius: 14, border: '1px solid rgba(232,101,10,0.2)',
                padding: '14px 18px',
                display: 'flex', alignItems: 'flex-start', gap: 12,
              }}>
                <span style={{ fontSize: 22, flexShrink: 0 }}>🎉</span>
                <div>
                  <div style={{ fontFamily: UI_FONT, fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#E8650A', marginBottom: 3 }}>
                    Festival Today
                  </div>
                  <div style={{ fontFamily: 'var(--font-display,serif)', fontSize: 16, fontWeight: 800, color: '#3D1F00' }}>
                    {FESTIVALS[toDateKey(selected)]}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .panchang-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

const navBtnStyle = {
  width: 36, height: 36, borderRadius: '50%',
  background: 'rgba(255,255,255,0.1)',
  border: '1px solid rgba(255,213,128,0.2)',
  color: '#FFD580', fontSize: 20, fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', lineHeight: 1,
  transition: 'background .2s',
};