import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Star, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const UI_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Roboto", sans-serif';

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

function toHyphen(city) {
  return city.trim().toLowerCase().replace(/\s+/g, '-');
}

function buildBookingUrl(travelMode, from, to) {
  const fH = toHyphen(from);
  const tH = toHyphen(to);
  switch (travelMode) {
    case 'train': return `https://www.ixigo.com/by-train-rail/${fH}-to-${tH}-by-train`;
    case 'bus':   return `https://www.redbus.in/bus-tickets/${fH}-to-${tH}`;
    default:      return `https://www.google.com/maps/dir/${encodeURIComponent(from.trim())}/${encodeURIComponent(to.trim())}`;
  }
}

const BOOKING_META = {
  train: { icon: '🚆', label: 'Search Trains on ixigo',  provider: 'ixigo trains', color: '#1565C0' },
  bus:   { icon: '🚌', label: 'Search Buses on redBus',  provider: 'redBus',       color: '#D84315' },
  car:   { icon: '🗺️', label: 'Open in Google Maps',     provider: 'Google Maps',  color: '#E8650A' },
  bike:  { icon: '🗺️', label: 'Open in Google Maps',     provider: 'Google Maps',  color: '#E8650A' },
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── City Autocomplete (Local list + Nominatim, no Google API needed) ────────
function CityAutocomplete({ value, onChange, placeholder, icon, label }) {
  const [open, setOpen]               = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [focused, setFocused]         = useState(false);
  const [fetching, setFetching]       = useState(false);
  const containerRef                  = useRef(null);
  const inputRef                      = useRef(null);
  const debounceTimer                 = useRef(null);
  const currentQuery                  = useRef('');
  const abortController              = useRef(null);

  const fetchCities = useCallback(async (query) => {
    if (!query || query.length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    // Cancel any in-flight request
    if (abortController.current) {
      abortController.current.abort();
    }
    abortController.current = new AbortController();

    currentQuery.current = query;
    setFetching(true);

    try {
      const res = await fetch(
        `${API_BASE}/api/route/cities?q=${encodeURIComponent(query)}`,
        {
          method: 'GET',
          signal: abortController.current.signal,
        }
      );

      if (currentQuery.current !== query) return;
      if (!res.ok) throw new Error('City search failed');

      const data = await res.json();
      const cities = data.cities || [];

      setSuggestions(cities);
      setOpen(cities.length > 0);
    } catch (err) {
      if (err.name === 'AbortError') return;
      if (currentQuery.current !== query) return;
      setSuggestions([]);
      setOpen(false);
    } finally {
      if (currentQuery.current === query) setFetching(false);
    }
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    onChange(val);
    clearTimeout(debounceTimer.current);

    if (!val.trim()) {
      setSuggestions([]);
      setOpen(false);
      setFetching(false);
      return;
    }

    setFetching(true);
    // 250ms debounce — fast enough for local list, safe for Nominatim 1req/s
    debounceTimer.current = setTimeout(() => fetchCities(val.trim()), 250);
  };

  const handleSelect = (city) => {
    onChange(city);
    setOpen(false);
    setSuggestions([]);
    setFetching(false);
    clearTimeout(debounceTimer.current);
    inputRef.current?.blur();
  };

  const handleFocus = () => {
    setFocused(true);
    if (value && suggestions.length > 0) setOpen(true);
  };

  const handleBlur = () => {
    setFocused(false);
    setTimeout(() => setOpen(false), 180);
  };

  // Handle keyboard navigation
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightedIndex >= 0) {
      e.preventDefault();
      handleSelect(suggestions[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setHighlightedIndex(-1);
    }
  };

  // Reset highlight when suggestions change
  useEffect(() => { setHighlightedIndex(-1); }, [suggestions]);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => () => {
    clearTimeout(debounceTimer.current);
    abortController.current?.abort();
  }, []);

  const isDropdownOpen = open || (fetching && value.length > 0);

  // Highlight the matching portion of text
  const renderCityName = (city) => {
    const lower = value.toLowerCase();
    const idx   = city.toLowerCase().indexOf(lower);
    if (idx < 0) return <span style={{ fontSize: 14, color: '#3D1F00' }}>{city}</span>;
    const before = city.slice(0, idx);
    const match  = city.slice(idx, idx + value.length);
    const after  = city.slice(idx + value.length);
    return (
      <span style={{ fontSize: 14, color: '#3D1F00' }}>
        {before}
        <strong style={{ color: '#E8650A' }}>{match}</strong>
        {after}
      </span>
    );
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <label style={{
        display: 'block', fontFamily: UI_FONT, fontSize: 11, fontWeight: 700,
        letterSpacing: '.09em', textTransform: 'uppercase', color: '#9A7150', marginBottom: 8,
      }}>{label}</label>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        border: `2px solid ${focused ? '#E8650A' : '#EDE0CC'}`,
        borderRadius: isDropdownOpen ? '14px 14px 0 0' : 14,
        padding: '13px 16px',
        background: 'white',
        transition: 'border-color .2s, border-radius .15s',
      }}>
        {icon}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          style={{
            width: '100%', border: 'none', outline: 'none',
            background: 'transparent', fontSize: 15,
            color: '#1A0A00', fontFamily: UI_FONT,
          }}
        />

        {fetching && (
          <Loader2
            size={15}
            color="#E8650A"
            style={{ flexShrink: 0, animation: 'spin .8s linear infinite' }}
          />
        )}

        {value && !fetching && (
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onChange('');
              setSuggestions([]);
              setOpen(false);
              setFetching(false);
              clearTimeout(debounceTimer.current);
            }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#BBA080', fontSize: 16, padding: 0, lineHeight: 1, flexShrink: 0,
            }}
            aria-label="Clear"
          >×</button>
        )}
      </div>

      {/* Dropdown */}
      {isDropdownOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999,
          background: 'white',
          border: '2px solid #E8650A',
          borderTop: '1px solid #EDE0CC',
          borderRadius: '0 0 14px 14px',
          boxShadow: '0 8px 24px rgba(61,31,0,0.14)',
          overflow: 'hidden',
          maxHeight: 280,
          overflowY: 'auto',
        }}>
          {/* Loading state */}
          {fetching && suggestions.length === 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '13px 16px', color: '#9A7150', fontFamily: UI_FONT, fontSize: 13,
            }}>
              <Loader2 size={14} style={{ animation: 'spin .8s linear infinite', flexShrink: 0 }} />
              Searching cities…
            </div>
          )}

          {/* No results */}
          {!fetching && suggestions.length === 0 && value.length >= 2 && (
            <div style={{
              padding: '13px 16px', color: '#BBA080',
              fontFamily: UI_FONT, fontSize: 13, fontStyle: 'italic',
            }}>
              No cities found for "{value}"
            </div>
          )}

          {/* Suggestions */}
          {suggestions.map((city, i) => (
            <div
              key={city + i}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(city); }}
              onMouseEnter={() => setHighlightedIndex(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 16px',
                cursor: 'pointer',
                borderBottom: i < suggestions.length - 1 ? '1px solid #FDF6EC' : 'none',
                background: highlightedIndex === i ? '#FDF6EC' : 'white',
                transition: 'background .12s',
                fontFamily: UI_FONT,
              }}
            >
              {/* Map pin icon */}
              <svg width="13" height="16" viewBox="0 0 13 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M6.5 0C2.91 0 0 2.91 0 6.5c0 4.5 6.5 9.5 6.5 9.5S13 11 13 6.5C13 2.91 10.09 0 6.5 0zm0 8.75A2.25 2.25 0 1 1 6.5 4.25a2.25 2.25 0 0 1 0 4.5z" fill="#E8650A"/>
              </svg>
              {renderCityName(city)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function RoutePlannerPage() {
  const [form, setForm] = useState({
    start: '', destination: '', travel_mode: 'car',
    time_available: '6', preferences: [],
  });
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState(null);
  const [error,     setError]     = useState(null);
  const [copied,    setCopied]    = useState(false);

  const togglePref = (p) =>
    setForm(f => ({
      ...f,
      preferences: f.preferences.includes(p)
        ? f.preferences.filter(x => x !== p)
        : [...f.preferences, p],
    }));

  const handleSubmit = async () => {
    if (!form.start.trim() || !form.destination.trim()) {
      setError('Please enter both start and destination.'); return;
    }
    setLoading(true); setError(null); setResult(null);
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

  const handleBookingClick = () => {
    if (!form.start.trim() || !form.destination.trim()) {
      setError('Please enter both source and destination first.'); return;
    }
    window.open(buildBookingUrl(form.travel_mode, form.start, form.destination), '_blank', 'noopener,noreferrer');
  };

  const handleCopy = () => {
    if (!result) return;
    const text =
      `🛕 My Spiritual Route: ${result.route_summary.start} → ${result.route_summary.destination}\n` +
      (result.recommended_temples || []).map(t => `• ${t.name} (${t.location})`).join('\n') +
      '\n\nPlanned via BharatMandir 🙏';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const bookingMeta     = BOOKING_META[form.travel_mode] || BOOKING_META.car;
  const bookingSubtitle = form.start.trim() && form.destination.trim()
    ? `${form.start} → ${form.destination} via ${form.travel_mode}`
    : 'Enter your route above to get a direct booking link.';

  return (
    <>
      <Navbar />

      {/* ── HERO ── */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
        padding: '50px 12px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        width: '100%', boxSizing: 'border-box',
      }}>
        <div style={{
          position: 'relative', zIndex: 1, width: '100%', maxWidth: 700,
          padding: '0 24px', boxSizing: 'border-box',
          display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,213,128,0.3)',
            borderRadius: 50, padding: '5px 16px', marginBottom: 14,
            color: 'rgba(255,213,128,0.85)', fontSize: 11, letterSpacing: '.1em',
            textTransform: 'uppercase', fontWeight: 500, backdropFilter: 'blur(8px)', whiteSpace: 'nowrap',
          }}>✨ AI Route Planner</div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1,
            marginBottom: 10, marginTop: 0, textShadow: '0 4px 40px rgba(0,0,0,0.3)',
            color: '#ffffff', width: '100%',
          }}>
            Your Journey,{' '}
            <span style={{ color: '#FFD580' }}>Divine Stopovers</span>
          </h1>

          <p style={{
            color: 'rgba(255,255,255,0.7)', fontSize: 14, width: '100%', maxWidth: 520,
            margin: '0 0 22px 0', fontWeight: 300, lineHeight: 1.7, textAlign: 'center',
          }}>
            Tell us where you're headed — we'll find every sacred temple along your spiritual path.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', width: '100%' }}>
            {[
              { label: '📍 Plan Route',    action: () => {} },
              { label: '📋 My Routes',     action: () => {} },
              { label: '🛕 Saved Temples', action: () => {} },
            ].map((tab, i) => (
              <button key={i} onClick={tab.action} style={{
                padding: '8px 20px', borderRadius: 50, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: i === 0 ? '#FFD580' : 'rgba(255,255,255,0.1)',
                color: i === 0 ? '#7a3208' : '#FFD580',
                backdropFilter: 'blur(8px)', border: '1px solid rgba(255,213,128,0.2)',
                transition: 'all 0.18s', whiteSpace: 'nowrap',
              }}>{tab.label}</button>
            ))}
          </div>
        </div>
      </section>

      {/* ── BODY ── */}
      <section style={{ background: '#f8f4ef', paddingBottom: 80, paddingTop: 48 }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 20px' }}>

          {/* PLANNER CARD */}
          <div style={{
            background: 'white', borderRadius: 24,
            boxShadow: '0 8px 40px rgba(61,31,0,0.13)',
            border: '1px solid rgba(232,101,10,0.12)',
            padding: '36px 36px 32px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, background: 'rgba(232,101,10,0.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
              }}>📍</div>
              <div>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: '#7a3208', marginBottom: 2 }}>
                  Plan Your Spiritual Route
                </h2>
                <p style={{ fontFamily: UI_FONT, color: '#9A7150', fontSize: 14 }}>
                  Discover temples and divine stops on your journey.
                </p>
              </div>
            </div>

            {/* FROM / TO */}
            <div className="route-form-inner" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 26 }}>
              <CityAutocomplete
                label="From"
                placeholder="e.g. Indore"
                value={form.start}
                onChange={val => setForm(prev => ({ ...prev, start: val }))}
                icon={<MapPin size={16} color="#E8650A" style={{ flexShrink: 0 }} />}
              />
              <CityAutocomplete
                label="To"
                placeholder="e.g. Ujjain"
                value={form.destination}
                onChange={val => setForm(prev => ({ ...prev, destination: val }))}
                icon={<Navigation size={16} color="#6B3A1F" style={{ flexShrink: 0 }} />}
              />
            </div>

            {/* TRAVEL MODE */}
            <div style={{ marginBottom: 26 }}>
              <h3 style={{ fontFamily: UI_FONT, fontSize: 12, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#9A7150', marginBottom: 12 }}>
                Travel Mode
              </h3>
              <div className="mode-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                {TRAVEL_MODES.map(m => {
                  const active = form.travel_mode === m.value;
                  return (
                    <button key={m.value} onClick={() => setForm(f => ({ ...f, travel_mode: m.value }))} style={{
                      border: `2px solid ${active ? '#E8650A' : '#EDE0CC'}`,
                      borderRadius: 14, padding: '13px 8px',
                      background: active ? 'linear-gradient(135deg, #E8650A, #FF8C2A)' : 'white',
                      color: active ? 'white' : '#5C3D1E',
                      cursor: 'pointer', textAlign: 'center', transition: 'all .2s',
                      boxShadow: active ? '0 4px 16px rgba(232,101,10,0.28)' : 'none',
                      fontFamily: UI_FONT,
                    }}>
                      <div style={{ fontSize: 22, marginBottom: 5 }}>{m.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{m.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PREFERENCES */}
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontFamily: UI_FONT, fontSize: 12, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#9A7150', marginBottom: 12 }}>
                Temple Preferences{' '}
                <span style={{ fontSize: 11, fontWeight: 400, color: '#BBA080', letterSpacing: 0, textTransform: 'none' }}>(optional)</span>
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PREF_OPTIONS.map(p => {
                  const active = form.preferences.includes(p);
                  return (
                    <button key={p} onClick={() => togglePref(p)} style={{
                      padding: '8px 16px', borderRadius: 50, fontFamily: UI_FONT,
                      border: `2px solid ${active ? '#E8650A' : '#EDE0CC'}`,
                      background: active ? 'linear-gradient(135deg, #E8650A, #FF8C2A)' : '#FDF6EC',
                      color: active ? 'white' : '#5C3D1E',
                      cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all .2s',
                      boxShadow: active ? '0 3px 10px rgba(232,101,10,0.28)' : 'none',
                    }}>{p}</button>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <button onClick={handleSubmit} disabled={loading} style={{
              width: '100%', padding: '16px', borderRadius: 50, border: 'none',
              background: 'linear-gradient(135deg, #3D1F00 0%, #B84D00 50%, #E8650A 100%)',
              color: 'white', fontSize: 16, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              fontFamily: 'var(--font-display)', letterSpacing: '.04em',
              boxShadow: '0 6px 22px rgba(184,77,0,0.32)',
              transition: 'all .25s', opacity: loading ? 0.75 : 1,
            }}>
              {loading
                ? <><Loader2 size={18} style={{ animation: 'spin .8s linear infinite' }} /> Finding Sacred Stops…</>
                : <>✨ Plan My Spiritual Route</>}
            </button>

            {error && (
              <div style={{
                marginTop: 14, background: '#FFF4F4', border: '1px solid #FFCDD2',
                borderRadius: 12, padding: '12px 16px',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <AlertCircle size={17} color="#D32F2F" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ fontFamily: UI_FONT, color: '#C62828', fontSize: 13 }}>{error}</p>
              </div>
            )}
          </div>

          {/* LOADING */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 52, marginBottom: 16, animation: 'float 2.5s ease-in-out infinite' }}>🛕</div>
              <p style={{ fontFamily: 'var(--font-display)', color: '#9A7150', fontSize: 18, fontWeight: 600 }}>
                Consulting the divine route map…
              </p>
              <p style={{ fontFamily: UI_FONT, color: '#9A7150', fontSize: 13, marginTop: 6 }}>
                AI is mapping sacred temples along your journey
              </p>
            </div>
          )}

          {/* RESULTS */}
          {result && !loading && (
            <div style={{ marginTop: 32, animation: 'fadeDown .6s ease both' }}>

              {result.travel_time_warning && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  background: '#FFFBEB', border: '1px solid #FCD34D',
                  borderLeft: '4px solid #F59E0B',
                  borderRadius: 16, padding: '16px 20px', marginBottom: 20,
                }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>⏱️</span>
                  <div>
                    <p style={{ fontFamily: UI_FONT, fontWeight: 700, color: '#92400E', fontSize: 14, marginBottom: 4 }}>Travel Time Heads-up</p>
                    <p style={{ fontFamily: UI_FONT, color: '#78350F', fontSize: 13, lineHeight: 1.6 }}>{result.travel_time_warning}</p>
                  </div>
                </div>
              )}

              <div style={{
                background: 'linear-gradient(135deg, #3D1F00 0%, #6B3A1F 100%)',
                borderRadius: 24, padding: '26px 30px', marginBottom: 26,
                color: 'white', boxShadow: '0 6px 28px rgba(61,31,0,0.18)',
              }}>
                <div className="route-summary-inner" style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: UI_FONT, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)', marginBottom: 8, fontWeight: 700 }}>Your Route</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'white' }}>
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
                        <span style={{ fontFamily: UI_FONT, fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{s.key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="route-results-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 22, alignItems: 'start' }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800, color: '#7a3208', marginBottom: 14 }}>
                    🛕 Temples Along Your Route
                  </h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(result.recommended_temples || []).map((t, i) => (
                      <div key={i} style={{
                        background: 'white', borderRadius: 16,
                        border: `2px solid ${t.importance === 'high' ? '#E8650A' : '#EDE0CC'}`,
                        padding: '18px 20px', boxShadow: '0 2px 10px rgba(61,31,0,0.06)', transition: 'all .2s',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#3D1F00' }}>{t.name}</h3>
                            {t.importance === 'high' && (
                              <span style={{
                                background: '#E8650A', color: 'white', fontFamily: UI_FONT,
                                fontSize: 9, fontWeight: 700, letterSpacing: '.07em',
                                padding: '3px 9px', borderRadius: 50, whiteSpace: 'nowrap', flexShrink: 0,
                              }}>⭐ MUST VISIT</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                            <span style={{ background: '#FDF6EC', borderRadius: 50, padding: '3px 10px', fontFamily: UI_FONT, fontSize: 11, color: '#5C3D1E', fontWeight: 500 }}>
                              📍 {t.distance_from_route_km}
                            </span>
                            <span style={{ background: '#FDF6EC', borderRadius: 50, padding: '3px 10px', fontFamily: UI_FONT, fontSize: 11, color: '#5C3D1E', fontWeight: 500 }}>
                              ⏱ {t.estimated_stop_time_minutes} min
                            </span>
                          </div>
                        </div>
                        <p style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150', marginBottom: 6 }}>
                          📌 {t.location}{t.deity && ` · ${t.deity}`}
                        </p>
                        <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#5C3D1E', lineHeight: 1.65 }}>{t.why_visit}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: 'white', borderRadius: 16, border: '1px solid #EDE0CC', padding: '20px', boxShadow: '0 2px 10px rgba(61,31,0,0.06)' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#3D1F00', marginBottom: 16 }}>🗺️ Optimized Itinerary</h3>
                    {(result.optimized_plan || []).map((stop, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                        {i < result.optimized_plan.length - 1 && (
                          <div style={{ position: 'absolute', left: 14, top: 28, bottom: 0, width: 2, background: '#EDE0CC', zIndex: 0 }} />
                        )}
                        <div style={{
                          width: 28, height: 28, borderRadius: '50%', background: '#E8650A', color: 'white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: UI_FONT, fontWeight: 700, fontSize: 12, flexShrink: 0, zIndex: 1,
                        }}>{stop.stop_number}</div>
                        <div style={{ paddingBottom: 18 }}>
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#3D1F00' }}>{stop.temple_name}</p>
                          {stop.arrival_time_hint && (
                            <p style={{ fontFamily: UI_FONT, fontSize: 12, color: '#E8650A', fontWeight: 600, marginTop: 2 }}>🕐 {stop.arrival_time_hint}</p>
                          )}
                          <p style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150', lineHeight: 1.5, marginTop: 3 }}>{stop.arrival_order_reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {result.insights?.length > 0 && (
                    <div style={{ background: 'rgba(200,150,12,0.06)', borderRadius: 16, border: '1px solid rgba(200,150,12,0.2)', padding: '20px' }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#3D1F00', marginBottom: 12 }}>💡 Pandit's Tips</h3>
                      {result.insights.map((tip, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                          <Star size={12} color="#C8960C" style={{ marginTop: 4, flexShrink: 0 }} />
                          <span style={{ fontFamily: UI_FONT, fontSize: 13, color: '#5C3D1E', lineHeight: 1.6 }}>{tip}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button onClick={handleCopy} style={{
                    width: '100%', padding: '12px', borderRadius: 50,
                    border: `2px solid ${copied ? '#16a34a' : '#EDE0CC'}`,
                    background: copied ? '#f0fdf4' : '#FDF6EC',
                    color: copied ? '#15803d' : '#5C3D1E',
                    fontFamily: UI_FONT, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', transition: 'all .2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    {copied ? '✅ Copied!' : '📋 Copy Route Summary'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BOOKING CARD */}
          <div style={{
            marginTop: result ? 32 : 24, background: 'white', borderRadius: 24,
            border: '1px solid rgba(232,101,10,0.14)', boxShadow: '0 4px 20px rgba(61,31,0,0.08)',
            padding: '24px 28px', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', gap: 20, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, background: `${bookingMeta.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0,
              }}>{bookingMeta.icon}</div>
              <div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#7a3208', marginBottom: 4 }}>
                  Already know your route?
                </h3>
                <p style={{ fontFamily: UI_FONT, color: '#9A7150', fontSize: 13 }}>{bookingSubtitle}</p>
              </div>
            </div>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <button
                onClick={handleBookingClick}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 24px', borderRadius: 50,
                  border: `2px solid ${bookingMeta.color}`,
                  color: bookingMeta.color, background: 'transparent',
                  fontFamily: UI_FONT, fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', transition: 'all .2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = bookingMeta.color; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = bookingMeta.color; }}
              >
                {bookingMeta.label} <ExternalLink size={15} />
              </button>
              <p style={{ fontFamily: UI_FONT, fontSize: 11, color: '#9A7150', marginTop: 6 }}>
                Powered by <span style={{ fontWeight: 700, color: bookingMeta.color }}>{bookingMeta.provider}</span>
              </p>
            </div>
          </div>

        </div>
      </section>

      <style>{`
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes float    { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes fadeDown { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 860px) { .route-results-grid  { grid-template-columns: 1fr !important; } }
        @media (max-width: 720px) {
          .route-form-inner    { grid-template-columns: 1fr !important; }
          .mode-grid           { grid-template-columns: repeat(2,1fr) !important; }
          .route-summary-inner { flex-direction: column !important; }
          .route-summary-stats { width: 100%; justify-content: space-around; display: flex; }
        }
      `}</style>

      <Footer />
    </>
  );
}