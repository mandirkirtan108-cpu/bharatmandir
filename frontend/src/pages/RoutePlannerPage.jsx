import { useState } from 'react';
import { MapPin, Navigation, Clock, Route, Sparkles, ChevronRight, Star, AlertCircle, Loader2 } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const TRAVEL_MODES = [
  { value: 'car',   label: '🚗 Car',   desc: 'Fastest route' },
  { value: 'bike',  label: '🏍️ Bike',  desc: 'Explore freely' },
  { value: 'train', label: '🚂 Train', desc: 'Rail + walk' },
];

const TIME_OPTIONS = [
  { value: '2',  label: '2 hrs' },
  { value: '4',  label: '4 hrs' },
  { value: '6',  label: '6 hrs' },
  { value: '8',  label: 'Full Day' },
  { value: '12', label: '12 hrs' },
];

const PREF_OPTIONS = [
  '🔱 Shiv Temples',
  '⭐ Jyotirlinga',
  '🌸 Shaktipeeth',
  '🪷 Vishnu Temples',
  '🐘 Ganesha Temples',
  '🏔️ Famous & Historic',
  '🌿 Peaceful & Serene',
];

const PRESET_ROUTES = [
  { from: 'Indore', to: 'Ujjain',     icon: '🔱', label: 'Indore → Ujjain' },
  { from: 'Varanasi', to: 'Prayagraj', icon: '🪔', label: 'Varanasi → Prayagraj' },
  { from: 'Mumbai', to: 'Shirdi',     icon: '🙏', label: 'Mumbai → Shirdi' },
  { from: 'Delhi', to: 'Mathura',     icon: '🎵', label: 'Delhi → Mathura' },
];

export default function RoutePlannerPage() {
  const [form, setForm] = useState({
    start: '', destination: '', travel_mode: 'car',
    time_available: '6', preferences: [],
  });
  const [loading, setLoading]   = useState(false);
  const [result,  setResult]    = useState(null);
  const [error,   setError]     = useState(null);
  const [apiKey,  setApiKey]    = useState(() => localStorage.getItem('bm_openai_key') || '');
  const [showKey, setShowKey]   = useState(false);

  const togglePref = (p) => {
    setForm(f => ({
      ...f,
      preferences: f.preferences.includes(p)
        ? f.preferences.filter(x => x !== p)
        : [...f.preferences, p],
    }));
  };

  const saveKey = () => {
    localStorage.setItem('bm_openai_key', apiKey);
    setShowKey(false);
  };

  const handlePreset = (preset) => {
    setForm(f => ({ ...f, start: preset.from, destination: preset.to }));
  };

  const handleSubmit = async () => {
    if (!form.start.trim() || !form.destination.trim()) {
      setError('Please enter both start and destination.');
      return;
    }
    if (!apiKey.trim()) {
      setError('Please enter your OpenAI API key first.');
      setShowKey(true);
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    const systemPrompt = `You are an advanced AI travel and spiritual guide for BharatMandir — India's temple discovery platform. 
Your task: Suggest temples that naturally fall along the user's travel route.

RULES:
- Only suggest REAL, well-known temples that actually exist along the given route.
- Temples must be within 5-10 km of the main road/highway.
- Be practical — respect the user's time limit.
- Return ONLY valid JSON, no extra text, no markdown fences.

OUTPUT FORMAT (strict JSON):
{
  "route_summary": {
    "start": "",
    "destination": "",
    "total_distance": "",
    "estimated_travel_time": ""
  },
  "recommended_temples": [
    {
      "name": "",
      "location": "",
      "distance_from_route_km": "3 km",
      "estimated_stop_time_minutes": 30,
      "importance": "high",
      "deity": "",
      "why_visit": ""
    }
  ],
  "optimized_plan": [
    {
      "stop_number": 1,
      "temple_name": "",
      "arrival_time_hint": "9:00 AM",
      "arrival_order_reason": ""
    }
  ],
  "insights": [
    "Best time to start journey",
    "Crowd tips",
    "Special festival alerts or local tips"
  ]
}`;

    const userPrompt = `Plan a spiritual route:
- From: ${form.start}
- To: ${form.destination}
- Travel mode: ${form.travel_mode}
- Time available: ${form.time_available} hours
- Preferences: ${form.preferences.length ? form.preferences.join(', ') : 'Any temples'}

Suggest temples along this actual road route, create an optimized visiting plan.`;

    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: 2000,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'OpenAI API error');
      }

      const data = await res.json();
      let raw = data.choices?.[0]?.message?.content || '';
      raw = raw.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(raw);
      setResult(parsed);
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Navbar />
      <div style={{ background: 'var(--cream)', minHeight: '100vh', paddingBottom: 80 }}>

        {/* Hero Banner */}
        <div style={{
          background: 'linear-gradient(135deg, var(--brown) 0%, var(--brown-mid) 60%, var(--saffron-dark) 100%)',
          padding: '56px 24px 48px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 300, color: 'rgba(255,255,255,0.03)', fontFamily: 'var(--font-hindi)', pointerEvents: 'none',
          }}>ॐ</div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 50, padding: '6px 20px', marginBottom: 16,
              color: '#FFD580', fontFamily: 'var(--font-hindi)', fontSize: 13, letterSpacing: '.1em',
            }}>
              <Route size={14} /> AI Route Planner
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900, color: 'white',
              fontSize: 'clamp(28px,5vw,54px)', marginBottom: 12,
            }}>
              Your Journey, <span style={{ color: 'var(--gold-light)' }}>Divine Stopovers</span>
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 17, maxWidth: 540, margin: '0 auto' }}>
              Tell us where you're headed — we'll find every sacred temple along your path.
            </p>
          </div>
        </div>

        <div className="container" style={{ maxWidth: 900, paddingTop: 48 }}>

          {/* API Key Banner */}
          <div style={{
            background: 'white', borderRadius: 'var(--radius-lg)', padding: '16px 20px',
            border: '1px solid var(--cream-dark)', marginBottom: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sparkles size={18} color="var(--gold)" />
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--text-mid)' }}>
                {apiKey ? '✅ OpenAI Key saved (browser only)' : '⚠️ No API key — add your OpenAI key to enable AI planning'}
              </span>
            </div>
            <button className="btn-outline" style={{ fontSize: 12, padding: '6px 16px' }} onClick={() => setShowKey(v => !v)}>
              {showKey ? 'Hide' : apiKey ? 'Change Key' : 'Add Key'}
            </button>
          </div>

          {showKey && (
            <div style={{
              background: 'white', borderRadius: 'var(--radius)', padding: 20,
              border: '2px solid var(--saffron)', marginBottom: 24, boxShadow: '0 4px 20px rgba(232,101,10,0.15)',
            }}>
              <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 10 }}>
                Your key is stored only in your browser (localStorage). Never sent to our servers.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: 8,
                    border: '2px solid var(--cream-dark)', fontFamily: 'var(--font-body)', fontSize: 14,
                    outline: 'none',
                  }}
                />
                <button className="btn-primary" style={{ padding: '10px 20px' }} onClick={saveKey}>Save</button>
              </div>
            </div>
          )}

          {/* Quick Presets */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-light)', letterSpacing: '.08em', marginBottom: 10 }}>
              POPULAR PILGRIM ROUTES
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {PRESET_ROUTES.map(p => (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p)}
                  style={{
                    padding: '8px 18px', borderRadius: 50, border: '2px solid var(--cream-dark)',
                    background: (form.start === p.from && form.destination === p.to) ? 'var(--saffron)' : 'white',
                    color: (form.start === p.from && form.destination === p.to) ? 'white' : 'var(--text-mid)',
                    cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14,
                    transition: 'var(--transition)',
                  }}
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main Form */}
          <div style={{
            background: 'white', borderRadius: 'var(--radius-lg)', padding: '32px',
            border: '1px solid var(--cream-dark)', boxShadow: '0 4px 24px var(--shadow)',
            marginBottom: 32,
          }}>
            {/* Start + Destination */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'center', marginBottom: 24 }}>
              <div>
                <label style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.08em', color: 'var(--text-light)', display: 'block', marginBottom: 6 }}>
                  FROM
                </label>
                <div style={{ position: 'relative' }}>
                  <MapPin size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--saffron)' }} />
                  <input
                    value={form.start}
                    onChange={e => setForm(f => ({ ...f, start: e.target.value }))}
                    placeholder="e.g. Indore"
                    style={{
                      width: '100%', padding: '12px 14px 12px 38px',
                      border: '2px solid var(--cream-dark)', borderRadius: 'var(--radius)',
                      fontFamily: 'var(--font-body)', fontSize: 16, outline: 'none',
                      transition: 'var(--transition)',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--saffron)'}
                    onBlur={e => e.target.style.borderColor = 'var(--cream-dark)'}
                  />
                </div>
              </div>

              <div style={{
                width: 40, height: 40, borderRadius: '50%', background: 'var(--cream)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid var(--cream-dark)', flexShrink: 0,
              }}>
                <ChevronRight size={18} color="var(--saffron)" />
              </div>

              <div>
                <label style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.08em', color: 'var(--text-light)', display: 'block', marginBottom: 6 }}>
                  TO
                </label>
                <div style={{ position: 'relative' }}>
                  <Navigation size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--brown-mid)' }} />
                  <input
                    value={form.destination}
                    onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                    placeholder="e.g. Ujjain"
                    style={{
                      width: '100%', padding: '12px 14px 12px 38px',
                      border: '2px solid var(--cream-dark)', borderRadius: 'var(--radius)',
                      fontFamily: 'var(--font-body)', fontSize: 16, outline: 'none',
                      transition: 'var(--transition)',
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--saffron)'}
                    onBlur={e => e.target.style.borderColor = 'var(--cream-dark)'}
                  />
                </div>
              </div>
            </div>

            {/* Travel Mode + Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              <div>
                <label style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.08em', color: 'var(--text-light)', display: 'block', marginBottom: 8 }}>
                  TRAVEL MODE
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {TRAVEL_MODES.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setForm(f => ({ ...f, travel_mode: m.value }))}
                      style={{
                        flex: 1, padding: '10px 8px', borderRadius: 'var(--radius)',
                        border: `2px solid ${form.travel_mode === m.value ? 'var(--saffron)' : 'var(--cream-dark)'}`,
                        background: form.travel_mode === m.value ? 'rgba(232,101,10,0.08)' : 'white',
                        cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13,
                        color: form.travel_mode === m.value ? 'var(--saffron-dark)' : 'var(--text-mid)',
                        transition: 'var(--transition)', fontWeight: form.travel_mode === m.value ? 600 : 400,
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.08em', color: 'var(--text-light)', display: 'block', marginBottom: 8 }}>
                  <Clock size={11} style={{ display: 'inline', marginRight: 4 }} />
                  TIME AVAILABLE
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {TIME_OPTIONS.map(t => (
                    <button
                      key={t.value}
                      onClick={() => setForm(f => ({ ...f, time_available: t.value }))}
                      style={{
                        flex: 1, padding: '10px 4px', borderRadius: 'var(--radius)',
                        border: `2px solid ${form.time_available === t.value ? 'var(--saffron)' : 'var(--cream-dark)'}`,
                        background: form.time_available === t.value ? 'var(--saffron)' : 'white',
                        color: form.time_available === t.value ? 'white' : 'var(--text-mid)',
                        cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12,
                        transition: 'var(--transition)',
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preferences */}
            <div style={{ marginBottom: 28 }}>
              <label style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.08em', color: 'var(--text-light)', display: 'block', marginBottom: 8 }}>
                TEMPLE PREFERENCES (optional)
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PREF_OPTIONS.map(p => (
                  <button
                    key={p}
                    onClick={() => togglePref(p)}
                    className={form.preferences.includes(p) ? 'filter-chip active' : 'filter-chip'}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '16px', fontSize: 15, borderRadius: 'var(--radius)' }}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading
                ? <><Loader2 size={18} style={{ animation: 'spin .8s linear infinite' }} /> Finding Sacred Stops…</>
                : <><Route size={18} /> Plan My Spiritual Route</>
              }
            </button>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#FFF4F4', border: '1px solid #FFCDD2', borderRadius: 'var(--radius)',
              padding: '14px 18px', marginBottom: 24, display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <AlertCircle size={18} color="#D32F2F" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ color: '#C62828', fontSize: 14 }}>{error}</p>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 56, marginBottom: 16, animation: 'pulse-om 2s ease-in-out infinite' }}>🛕</div>
              <p style={{ fontFamily: 'var(--font-hindi)', color: 'var(--text-light)', fontSize: 16 }}>
                Consulting the divine route map…
              </p>
              <p style={{ color: 'var(--text-light)', fontSize: 13, marginTop: 6 }}>
                AI is mapping sacred temples along your journey
              </p>
            </div>
          )}

          {/* Results */}
          {result && !loading && (
            <div style={{ animation: 'fadeDown .6s ease both' }}>

              {/* Route Summary Card */}
              <div style={{
                background: 'linear-gradient(135deg, var(--brown) 0%, var(--brown-mid) 100%)',
                borderRadius: 'var(--radius-lg)', padding: '28px 32px', marginBottom: 28,
                color: 'white', display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center',
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.1em', color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                    YOUR ROUTE
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
                      {result.route_summary.start}
                    </span>
                    <span style={{ color: 'var(--gold-light)', fontSize: 20 }}>→</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700 }}>
                      {result.route_summary.destination}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 28 }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--gold-light)', fontWeight: 700 }}>
                      {result.route_summary.total_distance}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Distance</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--gold-light)', fontWeight: 700 }}>
                      {result.route_summary.estimated_travel_time}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Travel Time</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--gold-light)', fontWeight: 700 }}>
                      {result.recommended_temples?.length || 0}
                    </span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Temples</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

                {/* Temple Cards */}
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--brown)', marginBottom: 16 }}>
                    🛕 Temples Along Your Route
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {(result.recommended_temples || []).map((t, i) => (
                      <div key={i} style={{
                        background: 'white', borderRadius: 'var(--radius-lg)',
                        border: `2px solid ${t.importance === 'high' ? 'var(--saffron)' : 'var(--cream-dark)'}`,
                        padding: '20px 22px', boxShadow: '0 2px 12px var(--shadow)',
                        transition: 'var(--transition)',
                        position: 'relative', overflow: 'hidden',
                      }}>
                        {t.importance === 'high' && (
                          <div style={{
                            position: 'absolute', top: 0, right: 0,
                            background: 'var(--saffron)', color: 'white',
                            fontSize: 10, fontFamily: 'var(--font-display)', letterSpacing: '.06em',
                            padding: '3px 12px', borderBottomLeftRadius: 10,
                          }}>
                            ⭐ MUST VISIT
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--brown)', fontWeight: 700 }}>
                            {t.name}
                          </h3>
                          <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 12 }}>
                            <span style={{
                              background: 'var(--cream)', borderRadius: 50, padding: '3px 10px',
                              fontSize: 12, color: 'var(--text-mid)', fontFamily: 'var(--font-display)',
                            }}>
                              📍 {t.distance_from_route_km}
                            </span>
                            <span style={{
                              background: 'var(--cream)', borderRadius: 50, padding: '3px 10px',
                              fontSize: 12, color: 'var(--text-mid)', fontFamily: 'var(--font-display)',
                            }}>
                              ⏱ {t.estimated_stop_time_minutes} min
                            </span>
                          </div>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 4 }}>
                          📌 {t.location} {t.deity && `· ${t.deity}`}
                        </p>
                        <p style={{ fontSize: 15, color: 'var(--text-mid)', lineHeight: 1.6 }}>
                          {t.why_visit}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sidebar: Plan + Insights */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                  {/* Optimized Plan */}
                  <div style={{
                    background: 'white', borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--cream-dark)', padding: '22px',
                    boxShadow: '0 2px 12px var(--shadow)',
                  }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--brown)', marginBottom: 16 }}>
                      🗺️ Optimized Itinerary
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                      {(result.optimized_plan || []).map((stop, i) => (
                        <div key={i} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                          {/* Timeline line */}
                          {i < result.optimized_plan.length - 1 && (
                            <div style={{
                              position: 'absolute', left: 15, top: 30, bottom: 0,
                              width: 2, background: 'var(--cream-dark)', zIndex: 0,
                            }} />
                          )}
                          <div style={{
                            width: 30, height: 30, borderRadius: '50%',
                            background: 'var(--saffron)', color: 'white',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
                            flexShrink: 0, zIndex: 1,
                          }}>
                            {stop.stop_number}
                          </div>
                          <div style={{ paddingBottom: 20 }}>
                            <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--brown)', fontWeight: 600 }}>
                              {stop.temple_name}
                            </p>
                            {stop.arrival_time_hint && (
                              <p style={{ fontSize: 12, color: 'var(--saffron)', fontFamily: 'var(--font-display)' }}>
                                🕐 {stop.arrival_time_hint}
                              </p>
                            )}
                            <p style={{ fontSize: 13, color: 'var(--text-light)', lineHeight: 1.5, marginTop: 2 }}>
                              {stop.arrival_order_reason}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Insights */}
                  {result.insights?.length > 0 && (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(200,150,12,0.1), rgba(232,101,10,0.06))',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid rgba(200,150,12,0.25)',
                      padding: '22px',
                    }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--brown)', marginBottom: 14 }}>
                        💡 Pandit's Tips
                      </h3>
                      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {result.insights.map((tip, i) => (
                          <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <Star size={13} color="var(--gold)" style={{ marginTop: 3, flexShrink: 0 }} />
                            <span style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.55 }}>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Share CTA */}
                  <button
                    className="btn-outline"
                    style={{ width: '100%', justifyContent: 'center', fontSize: 13 }}
                    onClick={() => {
                      const text = `🛕 My Spiritual Route: ${result.route_summary.start} → ${result.route_summary.destination}\n` +
                        (result.recommended_temples || []).map(t => `• ${t.name} (${t.location})`).join('\n') +
                        '\n\nPlanned via BharatMandir 🙏';
                      navigator.clipboard.writeText(text).then(() => alert('Route copied to clipboard!'));
                    }}
                  >
                    📋 Copy Route Summary
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}