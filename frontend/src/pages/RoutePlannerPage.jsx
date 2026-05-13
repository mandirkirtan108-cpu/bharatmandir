import { useState } from 'react';
import { MapPin, Navigation, Route, Star, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const TRAVEL_MODES = [
  { value: 'car',   icon: '🚗', label: 'Car' },
  { value: 'bike',  icon: '🏍️', label: 'Bike' },
  { value: 'train', icon: '🚆', label: 'Train' },
  { value: 'bus',   icon: '🚌', label: 'Bus' },
];

const PREF_OPTIONS = [
  '🕉 Shiv Temples',
  '⭐ Jyotirlinga',
  '🌸 Shaktipeeth',
  '🪷 Vishnu Temples',
  '🐘 Ganesh Temples',
  '🏛 Famous & Historic',
  '🌿 Peaceful & Serene',
];

const PRESET_ROUTES = [
  { from: 'Indore',   to: 'Ujjain',      icon: '🔱', label: 'Indore → Ujjain',      km: '~55 km',  desc: 'Mahakaleshwar Jyotirlinga' },
  { from: 'Varanasi', to: 'Prayagraj',   icon: '🪔', label: 'Varanasi → Prayagraj', km: '~125 km', desc: 'Kashi Vishwanath + Triveni Sangam' },
  { from: 'Mumbai',   to: 'Shirdi',      icon: '🙏', label: 'Mumbai → Shirdi',      km: '~240 km', desc: 'Sai Baba Mandir' },
  { from: 'Delhi',    to: 'Mathura',     icon: '🎵', label: 'Delhi → Mathura',      km: '~160 km', desc: 'Krishna Janmabhoomi' },
];

export default function RoutePlannerPage() {
  const [form, setForm] = useState({
    start: '', destination: '', travel_mode: 'car',
    time_available: '6', preferences: [],
  });
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);

  const togglePref = (p) =>
    setForm(f => ({
      ...f,
      preferences: f.preferences.includes(p)
        ? f.preferences.filter(x => x !== p)
        : [...f.preferences, p],
    }));

  const handlePreset = (preset) =>
    setForm(f => ({ ...f, start: preset.from, destination: preset.to }));

  const handleSubmit = async () => {
    if (!form.start.trim() || !form.destination.trim()) {
      setError('Please enter both start and destination.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    try {
      const res = await fetch(`${API_BASE}/api/route/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start:          form.start,
          destination:    form.destination,
          travel_mode:    form.travel_mode,
          time_available: parseInt(form.time_available),
          preferences:    form.preferences,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to plan route');
      setResult(data);
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />

      {/* ══════════════ HERO ══════════════ */}
      <section style={{
        position: 'relative', overflow: 'hidden', color: '#FFD580',
       background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
padding: '88px 24px 96px', textAlign: 'center',
      }}>
        {/* Om watermark */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 360, color: 'rgba(255,255,255,0.028)', fontFamily: 'var(--font-hindi)',
          pointerEvents: 'none', userSelect: 'none', lineHeight: 1,
        }}>ॐ</div>
        {/* radial glow */}
        <div style={{
          position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 300,
          background: 'radial-gradient(ellipse, rgba(232,101,10,0.28) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto' }}>
          {/* badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,213,128,0.3)',
            borderRadius: 50, padding: '6px 20px', marginBottom: 20,
            color: '#FFD580', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
            fontWeight: 500, backdropFilter: 'blur(8px)',
          }}>
            ✨ AI Route Planner
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 'clamp(38px,6vw,72px)', lineHeight: 1.05, marginBottom: 18,
            textShadow: '0 4px 40px rgba(0,0,0,0.3)',
            color: '#FFD580',
          }}>
            Your Journey,{' '}
            <span style={{ color: '#FFD580' }}>Divine Stopovers</span>
          </h1>

          <p style={{ color: '#FFD580', opacity: 0.82, fontSize: 18, maxWidth: 540, margin: '0 auto', fontWeight: 300, lineHeight: 1.7 }}>
            Tell us where you're headed — we'll find every sacred temple along your spiritual path.
          </p>
        </div>
      </section>

      {/* ══════════════ BODY ══════════════ */}
      <section style={{ background: '#f8f4ef', paddingBottom: 80, paddingTop: 56 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px' }}>

          {/* ── PLANNER CARD ── */}
          <div style={{
            background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
            borderRadius: 28, boxShadow: '0 20px 60px rgba(61,31,0,0.15)',
            border: '1px solid rgba(232,101,10,0.12)', padding: '40px 40px 36px',
            position: 'relative', zIndex: 10,
          }}>

            {/* Card title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
              <div style={{
                width: 50, height: 50, borderRadius: 16,
                background: 'rgba(232,101,10,0.1)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 24, flexShrink: 0,
              }}>📍</div>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: '#7a3208', marginBottom: 3 }}>
                  Plan Your Spiritual Route
                </h2>
                <p style={{ color: '#9A7150', fontSize: 14, fontWeight: 400 }}>
                  Discover temples and divine stops on your journey.
                </p>
              </div>
            </div>

            {/* FROM / TO */}
            <div className="route-form-inner" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
              {[
                { label: 'From', icon: <MapPin size={16} color="#E8650A" style={{ flexShrink: 0 }} />, key: 'start', ph: 'e.g. Indore' },
                { label: 'To',   icon: <Navigation size={16} color="#6B3A1F" style={{ flexShrink: 0 }} />, key: 'destination', ph: 'e.g. Ujjain' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9A7150', marginBottom: 8 }}>
                    {f.label}
                  </label>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    border: '2px solid #EDE0CC', borderRadius: 16, padding: '14px 16px',
                    background: 'white', transition: 'border-color .2s',
                  }}>
                    {f.icon}
                    <input
                      type="text"
                      value={form[f.key]}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.ph}
                      style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: '#1A0A00', fontFamily: 'var(--font-body)' }}
                      onFocus={e => e.target.closest('div').style.borderColor = '#E8650A'}
                      onBlur={e  => e.target.closest('div').style.borderColor = '#EDE0CC'}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* TRAVEL MODE */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#7a3208', marginBottom: 12 }}>
                Travel Mode
              </h3>
              <div className="mode-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {TRAVEL_MODES.map(m => (
                  <button
                    key={m.value}
                    onClick={() => setForm(f => ({ ...f, travel_mode: m.value }))}
                    style={{
                      border: `2px solid ${form.travel_mode === m.value ? '#E8650A' : '#EDE0CC'}`,
                      borderRadius: 16, padding: '14px 8px',
                      background: form.travel_mode === m.value
                        ? 'linear-gradient(135deg, #E8650A, #FF8C2A)'
                        : 'white',
                      color: form.travel_mode === m.value ? 'white' : '#5C3D1E',
                      cursor: 'pointer', textAlign: 'center', transition: 'all .22s',
                      boxShadow: form.travel_mode === m.value
                        ? '0 6px 20px rgba(232,101,10,0.3)'
                        : '0 2px 6px rgba(61,31,0,0.06)',
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{m.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* TEMPLE PREFERENCES */}
            <div style={{ marginBottom: 32 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#7a3208', marginBottom: 12 }}>
                Temple Preferences{' '}
                <span style={{ fontSize: 12, fontWeight: 400, color: '#9A7150' }}>(Optional)</span>
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {PREF_OPTIONS.map(p => (
                  <button
                    key={p}
                    onClick={() => togglePref(p)}
                    style={{
                      padding: '9px 18px', borderRadius: 50,
                      border: `2px solid ${form.preferences.includes(p) ? '#E8650A' : '#EDE0CC'}`,
                      background: form.preferences.includes(p)
                        ? 'linear-gradient(135deg, #E8650A, #FF8C2A)'
                        : '#FDF6EC',
                      color: form.preferences.includes(p) ? 'white' : '#5C3D1E',
                      cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all .22s',
                      boxShadow: form.preferences.includes(p) ? '0 4px 14px rgba(232,101,10,0.3)' : 'none',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%', padding: '18px', borderRadius: 16, border: 'none',
                background: 'linear-gradient(135deg, #3D1F00 0%, #B84D00 50%, #E8650A 100%)',
                color: 'white', fontSize: 17, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                fontFamily: 'var(--font-display)', letterSpacing: '.04em',
                boxShadow: '0 8px 28px rgba(184,77,0,0.35)',
                transition: 'all .25s', opacity: loading ? 0.75 : 1,
              }}
            >
              {loading
                ? <><Loader2 size={20} style={{ animation: 'spin .8s linear infinite' }} /> Finding Sacred Stops…</>
                : <>✨ Plan My Spiritual Route</>}
            </button>

            {/* Error */}
            {error && (
              <div style={{
                marginTop: 16, background: '#FFF4F4', border: '1px solid #FFCDD2',
                borderRadius: 12, padding: '14px 18px',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <AlertCircle size={18} color="#D32F2F" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ color: '#C62828', fontSize: 14 }}>{error}</p>
              </div>
            )}
          </div>

        

          {/* ── IXIGO TICKET SECTION ── */}
          <div style={{
            marginTop: 32, background: 'white', borderRadius: 28,
            border: '1px solid rgba(232,101,10,0.15)',
            boxShadow: '0 8px 32px rgba(61,31,0,0.1)',
            padding: '32px 36px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 24, flexWrap: 'wrap', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', right: -24, top: '50%', transform: 'translateY(-50%)', fontSize: 140, opacity: 0.05, pointerEvents: 'none' }}>🎫</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18 }}>
              <div style={{
                width: 60, height: 60, borderRadius: 18, background: 'rgba(232,101,10,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, flexShrink: 0,
              }}>🎫</div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: '#7a3208', marginBottom: 6 }}>
                  Already know your route?
                </h3>
                <p style={{ color: '#9A7150', fontSize: 14 }}>
                  Book your tickets easily with our trusted travel partner.
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <a
                href="https://www.ixigo.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '14px 28px', borderRadius: 16,
                  border: '2px solid #E8650A', color: '#E8650A',
                  fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700,
                  textDecoration: 'none', transition: 'all .22s',
                  boxShadow: '0 4px 16px rgba(232,101,10,0.15)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#E8650A'; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#E8650A'; }}
              >
                Book Your Ticket – Click Here <ExternalLink size={16} />
              </a>
              <p style={{ fontSize: 12, color: '#9A7150', marginTop: 8 }}>
                Powered by <span style={{ fontWeight: 700, color: '#E8650A' }}>ixigo</span>
              </p>
            </div>
          </div>

          {/* ── LOADING ── */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 56, marginBottom: 16, animation: 'float 2.5s ease-in-out infinite' }}>🛕</div>
              <p style={{ fontFamily: 'var(--font-display)', color: '#9A7150', fontSize: 18, fontWeight: 600 }}>
                Consulting the divine route map…
              </p>
              <p style={{ color: '#9A7150', fontSize: 13, marginTop: 6, fontWeight: 300 }}>
                AI is mapping sacred temples along your journey
              </p>
            </div>
          )}

          {/* ── RESULTS ── */}
          {result && !loading && (
            <div style={{ marginTop: 40, animation: 'fadeDown .6s ease both' }}>

              {/* Route Summary Banner */}
              <div style={{
                background: 'linear-gradient(135deg, #3D1F00 0%, #6B3A1F 100%)',
                borderRadius: 24, padding: '28px 32px', marginBottom: 28,
                color: 'white', boxShadow: '0 8px 32px rgba(61,31,0,0.2)',
              }}>
                <div className="route-summary-inner" style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: 6, fontWeight: 600 }}>
                      Your Route
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700 }}>
                      {result.route_summary.start}
                      <span style={{ color: '#FFD580' }}>→</span>
                      {result.route_summary.destination}
                    </div>
                  </div>
                  <div className="route-summary-stats" style={{ display: 'flex', gap: 28 }}>
                    {[
                      { val: result.route_summary.total_distance,        key: 'Distance' },
                      { val: result.route_summary.estimated_travel_time, key: 'Travel Time' },
                      { val: result.recommended_temples?.length || 0,    key: 'Temples' },
                    ].map(s => (
                      <div key={s.key} style={{ textAlign: 'center' }}>
                        <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#FFD580' }}>{s.val}</span>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>{s.key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Temple Cards + Sidebar */}
              <div className="route-results-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>

                {/* Temple Cards */}
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: '#7a3208', marginBottom: 16 }}>
                    🛕 Temples Along Your Route
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {(result.recommended_temples || []).map((t, i) => (
                      <div key={i} style={{
                        background: 'white', borderRadius: 20,
                        border: `2px solid ${t.importance === 'high' ? '#E8650A' : '#EDE0CC'}`,
                        padding: '20px 22px', boxShadow: '0 2px 12px rgba(61,31,0,0.07)',
                        position: 'relative', overflow: 'hidden', transition: 'all .22s',
                      }}>
                        {t.importance === 'high' && (
                          <div style={{
                            position: 'absolute', top: 0, right: 0, background: '#E8650A', color: 'white',
                            fontSize: 9, fontWeight: 700, letterSpacing: '.08em',
                            padding: '4px 12px', borderBottomLeftRadius: 12,
                          }}>⭐ MUST VISIT</div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#3D1F00' }}>
                            {t.name}
                          </h3>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 10, flexWrap: 'wrap' }}>
                            <span style={{ background: '#FDF6EC', borderRadius: 50, padding: '3px 10px', fontSize: 11, color: '#5C3D1E', fontWeight: 500 }}>
                              📍 {t.distance_from_route_km}
                            </span>
                            <span style={{ background: '#FDF6EC', borderRadius: 50, padding: '3px 10px', fontSize: 11, color: '#5C3D1E', fontWeight: 500 }}>
                              ⏱ {t.estimated_stop_time_minutes} min
                            </span>
                          </div>
                        </div>
                        <p style={{ fontSize: 13, color: '#9A7150', marginBottom: 6 }}>
                          📌 {t.location}{t.deity && ` · ${t.deity}`}
                        </p>
                        <p style={{ fontSize: 14, color: '#5C3D1E', lineHeight: 1.65 }}>{t.why_visit}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                  {/* Optimized Itinerary */}
                  <div style={{ background: 'white', borderRadius: 20, border: '1px solid #EDE0CC', padding: '22px', boxShadow: '0 2px 12px rgba(61,31,0,0.07)' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#3D1F00', marginBottom: 16 }}>
                      🗺️ Optimized Itinerary
                    </h3>
                    {(result.optimized_plan || []).map((stop, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                        {i < result.optimized_plan.length - 1 && (
                          <div style={{ position: 'absolute', left: 15, top: 30, bottom: 0, width: 2, background: '#EDE0CC', zIndex: 0 }} />
                        )}
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%', background: '#E8650A', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 12, flexShrink: 0, zIndex: 1, fontFamily: 'var(--font-display)',
                        }}>
                          {stop.stop_number}
                        </div>
                        <div style={{ paddingBottom: 20 }}>
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#3D1F00' }}>{stop.temple_name}</p>
                          {stop.arrival_time_hint && (
                            <p style={{ fontSize: 12, color: '#E8650A', fontWeight: 500, marginTop: 2 }}>🕐 {stop.arrival_time_hint}</p>
                          )}
                          <p style={{ fontSize: 12, color: '#9A7150', lineHeight: 1.5, marginTop: 3 }}>{stop.arrival_order_reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pandit Tips */}
                  {result.insights?.length > 0 && (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(200,150,12,0.09), rgba(232,101,10,0.05))',
                      borderRadius: 20, border: '1px solid rgba(200,150,12,0.2)', padding: '22px',
                    }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#3D1F00', marginBottom: 14 }}>
                        💡 Pandit's Tips
                      </h3>
                      {result.insights.map((tip, i) => (
                        <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', marginBottom: 10 }}>
                          <Star size={13} color="#C8960C" style={{ marginTop: 3, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, color: '#5C3D1E', lineHeight: 1.6 }}>{tip}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Copy */}
                  <button
                    onClick={() => {
                      const text =
                        `🛕 My Spiritual Route: ${result.route_summary.start} → ${result.route_summary.destination}\n` +
                        (result.recommended_temples || []).map(t => `• ${t.name} (${t.location})`).join('\n') +
                        '\n\nPlanned via BharatMandir 🙏';
                      navigator.clipboard.writeText(text).then(() => alert('Route copied to clipboard!'));
                    }}
                    style={{
                      width: '100%', padding: '13px', borderRadius: 14,
                      border: '2px solid #EDE0CC', background: '#FDF6EC', color: '#5C3D1E',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .2s',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      fontFamily: 'var(--font-body)',
                    }}
                  >
                    📋 Copy Route Summary
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Global keyframes */}
      <style>{`
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes float    { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes fadeDown { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @media (max-width: 720px) {
          .route-form-inner       { grid-template-columns: 1fr !important; }
          .mode-grid              { grid-template-columns: repeat(2,1fr) !important; }
          .route-results-grid     { grid-template-columns: 1fr !important; }
          .route-summary-inner    { flex-direction: column !important; }
          .route-summary-stats    { width: 100%; justify-content: space-around; }
        }
      `}</style>

      <Footer />
    </>
  );
}