import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Star, AlertCircle, Loader2, ExternalLink, Map } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const UI_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Roboto", sans-serif';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const TRAVEL_MODES = [
  { value: 'car', label: 'Car' },
  { value: 'bike', label: 'Bike' },
  { value: 'train', label: 'Train' },
  { value: 'bus', label: 'Bus' },
];

const PREF_OPTIONS = [
  'Shiv Temples',
  'Jyotirlinga',
  'Shaktipeeth',
  'Vishnu Temples',
  'Ganesh Temples',
  'Famous & Historic',
  'Peaceful & Serene',
];

const BOOKING_META = {
  train: { label: 'Search Trains on ixigo', provider: 'ixigo trains', color: '#1565C0' },
  bus: { label: 'Search Buses on redBus', provider: 'redBus', color: '#D84315' },
  car: { label: 'Open in Google Maps', provider: 'Google Maps', color: '#E8650A' },
  bike: { label: 'Open in Google Maps', provider: 'Google Maps', color: '#E8650A' },
};

function toHyphen(city) {
  return city.trim().toLowerCase().replace(/\s+/g, '-');
}

function buildBookingUrl(travelMode, from, to) {
  const fH = toHyphen(from);
  const tH = toHyphen(to);
  switch (travelMode) {
    case 'train':
      return `https://www.ixigo.com/by-train-rail/${fH}-to-${tH}-by-train`;
    case 'bus':
      return `https://www.redbus.in/bus-tickets/${fH}-to-${tH}`;
    default:
      return `https://www.google.com/maps/dir/${encodeURIComponent(from.trim())}/${encodeURIComponent(to.trim())}`;
  }
}

function CityAutocomplete({ value, onChange, placeholder, icon, label }) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [focused, setFocused] = useState(false);
  const [fetching, setFetching] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceTimer = useRef(null);
  const currentQuery = useRef('');
  const abortController = useRef(null);

  const fetchCities = useCallback(async (query) => {
    if (!query) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    if (abortController.current) abortController.current.abort();
    abortController.current = new AbortController();
    currentQuery.current = query;
    setFetching(true);
    try {
      const res = await fetch(`${API_BASE}/api/route/cities?q=${encodeURIComponent(query)}`, {
        method: 'GET',
        signal: abortController.current.signal,
      });
      if (currentQuery.current !== query) return;
      if (!res.ok) throw new Error('City search failed');
      const data = await res.json();
      const cities = data.cities || [];
      setSuggestions(cities);
      setOpen(cities.length > 0);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setSuggestions([]);
        setOpen(false);
      }
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

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => () => {
    clearTimeout(debounceTimer.current);
    abortController.current?.abort();
  }, []);

  const isDropdownOpen = open || (fetching && value.length > 0);

  return (
    <div ref={containerRef} style={{ position: 'relative', zIndex: 20 }}>
      <label style={labelStyle}>{label}</label>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        border: `2px solid ${focused ? '#E8650A' : '#EDE0CC'}`,
        borderRadius: isDropdownOpen ? '12px 12px 0 0' : 12,
        padding: '13px 16px',
        background: 'white',
      }}>
        {icon}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInput}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            setTimeout(() => setOpen(false), 180);
          }}
          placeholder={placeholder}
          autoComplete="off"
          style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: '#1A0A00', fontFamily: UI_FONT }}
        />
        {fetching && <Loader2 size={15} color="#E8650A" style={{ animation: 'spin .8s linear infinite', flexShrink: 0 }} />}
      </div>

      {isDropdownOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 999,
          background: 'white',
          border: '2px solid #E8650A',
          borderTop: '1px solid #EDE0CC',
          borderRadius: '0 0 12px 12px',
          boxShadow: '0 8px 24px rgba(61,31,0,0.14)',
          overflow: 'hidden',
          maxHeight: 280,
          overflowY: 'auto',
        }}>
          {fetching && suggestions.length === 0 && (
            <div style={dropdownInfoStyle}>
              <Loader2 size={14} style={{ animation: 'spin .8s linear infinite', flexShrink: 0 }} /> Searching cities...
            </div>
          )}
          {!fetching && suggestions.length === 0 && value.length >= 2 && (
            <div style={dropdownInfoStyle}>No cities found for "{value}"</div>
          )}
          {suggestions.map((city) => (
            <button
              key={city}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(city);
              }}
              style={suggestionButtonStyle}
            >
              <MapPin size={13} color="#E8650A" style={{ flexShrink: 0 }} />
              {city}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RouteMap({ result }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (!result?.route_geometry?.coordinates?.length || !mapRef.current) return;

    const loadLeaflet = async () => {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        document.head.appendChild(link);
      }
      if (!window.L) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const L = window.L;
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }

      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true });
      mapInstance.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'OpenStreetMap',
        maxZoom: 18,
      }).addTo(map);

      const routeLatLngs = result.route_geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      const routeLine = L.polyline(routeLatLngs, { color: '#E8650A', weight: 5, opacity: 0.85 }).addTo(map);
      map.fitBounds(routeLine.getBounds(), { padding: [35, 35] });

      const start = result.start_coordinates;
      const end = result.destination_coordinates;
      if (start?.length === 2) {
        L.marker([start[1], start[0]]).addTo(map).bindPopup(`<b>Start: ${result.route_summary.start}</b>`);
      }
      if (end?.length === 2) {
        L.marker([end[1], end[0]]).addTo(map).bindPopup(`<b>Destination: ${result.route_summary.destination}</b>`);
      }
      (result.recommended_temples || []).forEach((temple) => {
        if (temple.lat && temple.lng) {
          L.marker([temple.lat, temple.lng]).addTo(map).bindPopup(`<b>${temple.name}</b><br>${temple.location}`);
        }
      });
    };

    loadLeaflet();

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [result]);

  return <div ref={mapRef} style={{ width: '100%', height: 420, borderRadius: 16, overflow: 'hidden', border: '1px solid #EDE0CC' }} />;
}

export default function RoutePlannerPage() {
  const [form, setForm] = useState({ start: '', destination: '', travel_mode: 'car', time_available: '6', preferences: [] });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [nearbyTempleData, setNearbyTempleData] = useState({});
  const [nearbyLoading, setNearbyLoading] = useState(null);

  const togglePref = (p) => {
    setForm((f) => ({
      ...f,
      preferences: f.preferences.includes(p) ? f.preferences.filter((x) => x !== p) : [...f.preferences, p],
    }));
  };

  const handleSubmit = async () => {
    if (!form.start.trim() || !form.destination.trim()) {
      setError('Please enter both start and destination.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setNearbyTempleData({});
    try {
      const res = await fetch(`${API_BASE}/api/route/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: form.start,
          destination: form.destination,
          travel_mode: form.travel_mode,
          time_available: parseInt(form.time_available, 10),
          preferences: form.preferences,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = typeof data.detail === 'string' ? data.detail : data.detail?.message;
        throw new Error(detail || 'Failed to plan route');
      }
      setResult(data);
      setShowMap(true);
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBookingClick = () => {
    if (!form.start.trim() || !form.destination.trim()) {
      setError('Please enter both source and destination first.');
      return;
    }
    window.open(buildBookingUrl(form.travel_mode, form.start, form.destination), '_blank', 'noopener,noreferrer');
  };

  const handleNearbyTemples = async (temple) => {
    const key = temple.name;
    if (nearbyTempleData[key]) {
      setNearbyTempleData((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    setNearbyLoading(key);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/route/nearby-temples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          temple_name: temple.name,
          location: temple.location,
          radius_km: 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = typeof data.detail === 'string' ? data.detail : data.detail?.message;
        throw new Error(detail || 'Failed to load nearby temples');
      }
      setNearbyTempleData((prev) => ({ ...prev, [key]: data.nearby_temples || [] }));
    } catch (e) {
      setError(e.message || 'Unable to load nearby temples.');
    } finally {
      setNearbyLoading(null);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text = `My route: ${result.route_summary.start} -> ${result.route_summary.destination}\n`
      + `Distance: ${result.route_summary.total_distance}\n`
      + `Travel time: ${result.route_summary.estimated_travel_time}\n`
      + (result.recommended_temples || []).map((t) => `- ${t.name} (${t.location})`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const bookingMeta = BOOKING_META[form.travel_mode] || BOOKING_META.car;
  const bookingSubtitle = form.start.trim() && form.destination.trim()
    ? `${form.start} -> ${form.destination} via ${form.travel_mode}`
    : 'Enter your route above to get a direct booking link.';

  return (
    <>
      <Navbar />

      <section style={{ background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)', padding: '100px 12px', minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'white', boxSizing: 'border-box' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,213,128,0.3)', borderRadius: 50, padding: '5px 16px', marginBottom: 14, color: '#FFD580', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 600 }}>
            <Map size={13} /> Route Planner
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1, margin: 0 }}>
            <span style={{ color: '#ffffff' }}>Your Journey,</span> <span style={{ color: '#FFD580' }}>Verified Path</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 15, maxWidth: 560, margin: '12px auto 0', lineHeight: 1.7, fontFamily: UI_FONT }}>
            Plan a real road route and discover curated sacred stops on known pilgrimage corridors.
          </p>
        </div>
      </section>

      <section style={{ background: '#F7F2EC', padding: '48px 20px 80px' }}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>
          <div style={{ background: 'white', borderRadius: 20, boxShadow: '0 4px 32px rgba(61,31,0,0.09)', border: '1px solid #EDE0CC', padding: '34px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: '#7a3208', margin: '0 0 4px' }}>Plan Your Spiritual Route</h2>
            <p style={{ fontFamily: UI_FONT, color: '#9A7150', fontSize: 14, margin: '0 0 28px' }}>Distance, duration, and route line are calculated by OpenRouteService.</p>

            <div className="route-form-inner" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 24 }}>
              <CityAutocomplete label="From" placeholder="e.g. Indore" value={form.start} onChange={(val) => setForm((prev) => ({ ...prev, start: val }))} icon={<MapPin size={16} color="#E8650A" />} />
              <CityAutocomplete label="To" placeholder="e.g. Ujjain" value={form.destination} onChange={(val) => setForm((prev) => ({ ...prev, destination: val }))} icon={<Navigation size={16} color="#6B3A1F" />} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <h3 style={sectionLabelStyle}>Travel Mode</h3>
              <div className="mode-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                {TRAVEL_MODES.map((m) => {
                  const active = form.travel_mode === m.value;
                  return (
                    <button key={m.value} onClick={() => setForm((f) => ({ ...f, travel_mode: m.value }))} style={{
                      border: `2px solid ${active ? '#E8650A' : '#EDE0CC'}`,
                      borderRadius: 12,
                      padding: '14px 8px',
                      background: active ? 'linear-gradient(135deg, #B84D00, #E8650A)' : 'white',
                      color: active ? 'white' : '#5C3D1E',
                      cursor: 'pointer',
                      fontFamily: UI_FONT,
                      fontSize: 13,
                      fontWeight: 700,
                    }}>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 28 }}>
              <h3 style={sectionLabelStyle}>Temple Preferences</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PREF_OPTIONS.map((p) => {
                  const active = form.preferences.includes(p);
                  return (
                    <button key={p} onClick={() => togglePref(p)} style={{
                      padding: '8px 15px',
                      borderRadius: 8,
                      border: `1.5px solid ${active ? '#E8650A' : '#EDE0CC'}`,
                      background: active ? 'linear-gradient(135deg, #B84D00, #E8650A)' : 'white',
                      color: active ? 'white' : '#5C3D1E',
                      cursor: 'pointer',
                      fontFamily: UI_FONT,
                      fontSize: 13,
                      fontWeight: 500,
                    }}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', justifyContent: 'center', padding: '15px', borderRadius: 12, border: 'none', background: loading ? '#C8956A' : 'linear-gradient(135deg, #3D1F00 0%, #B84D00 50%, #E8650A 100%)', color: 'white', fontSize: 15, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-display)' }}>
              {loading ? <><Loader2 size={18} style={{ animation: 'spin .8s linear infinite' }} /> Calculating route...</> : 'Plan My Spiritual Route'}
            </button>

            {error && (
              <div style={{ marginTop: 14, background: '#FFF4F4', border: '1px solid #FFCDD2', borderRadius: 10, padding: '12px 16px', display: 'flex', gap: 10 }}>
                <AlertCircle size={16} color="#D32F2F" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontFamily: UI_FONT, color: '#C62828', fontSize: 13, margin: 0 }}>{error}</p>
              </div>
            )}
          </div>

          {result && !loading && (
            <div style={{ marginTop: 30 }}>
              {result.travel_time_warning && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, background: '#FFFBEB', border: '1px solid #FCD34D', borderLeft: '4px solid #F59E0B', borderRadius: 14, padding: '14px 18px', marginBottom: 20 }}>
                  <AlertCircle size={17} color="#92400E" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontFamily: UI_FONT, color: '#78350F', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{result.travel_time_warning}</p>
                </div>
              )}

              <div style={{ background: 'linear-gradient(135deg, #3D1F00 0%, #6B3A1F 100%)', borderRadius: 18, padding: '26px 30px', marginBottom: 20, color: 'white', boxShadow: '0 4px 24px rgba(61,31,0,0.16)' }}>
                <div className="route-summary-inner" style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <p style={{ fontFamily: UI_FONT, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', margin: '0 0 10px', fontWeight: 700 }}>Verified Route</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800 }}>
                      {result.route_summary.start}
                      <span style={{ color: '#FFD580', fontSize: 16 }}>-&gt;</span>
                      {result.route_summary.destination}
                    </div>
                  </div>
                  <div className="route-summary-stats" style={{ display: 'flex', gap: 32 }}>
                    {[
                      { val: result.route_summary.total_distance, key: 'Distance' },
                      { val: result.route_summary.estimated_travel_time, key: 'Travel Time' },
                      { val: result.recommended_temples?.length || 0, key: 'Temples' },
                    ].map((s) => (
                      <div key={s.key} style={{ textAlign: 'center' }}>
                        <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: '#FFD580', marginBottom: 2 }}>{s.val}</span>
                        <span style={{ fontFamily: UI_FONT, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{s.key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={() => setShowMap((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 10, border: '1.5px solid #E8650A', background: showMap ? 'linear-gradient(135deg, #B84D00, #E8650A)' : 'white', color: showMap ? 'white' : '#5C3D1E', fontFamily: UI_FONT, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 16 }}>
                <Map size={16} /> {showMap ? 'Hide Route Map' : 'Show Route Map'}
              </button>

              {showMap && <RouteMap result={result} />}

              <div className="route-results-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 22, alignItems: 'start', marginTop: 24 }}>
                <div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: '#7a3208', margin: '0 0 12px' }}>Temples Along Your Route</h2>
                  {(!result.recommended_temples || result.recommended_temples.length === 0) && (
                    <div style={{ background: 'white', border: '1px dashed #EDE0CC', borderRadius: 14, padding: 18, color: '#9A7150', fontFamily: UI_FONT, fontSize: 13 }}>
                      No curated temple stops are available for this route yet. Add temple coordinates in backend to improve suggestions.
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {(result.recommended_temples || []).map((t, i) => (
                      <div key={`${t.name}-${i}`} style={{ background: 'white', borderRadius: 14, border: `1.5px solid ${t.importance === 'high' ? '#E8650A' : '#EDE0CC'}`, padding: '18px 20px', boxShadow: '0 2px 10px rgba(61,31,0,0.06)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 6 }}>
                          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: '#3D1F00', margin: 0 }}>{t.name}</h3>
                          <span style={{ background: '#FDF6EC', borderRadius: 50, padding: '3px 10px', fontFamily: UI_FONT, fontSize: 11, color: '#5C3D1E', fontWeight: 700 }}>{t.distance_from_route_km}</span>
                        </div>
                        <p style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150', margin: '0 0 8px' }}>{t.location}{t.deity ? ` · ${t.deity}` : ''}</p>
                        <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#5C3D1E', lineHeight: 1.65, margin: 0 }}>{t.why_visit}</p>
                        <button
                          onClick={() => handleNearbyTemples(t)}
                          disabled={nearbyLoading === t.name}
                          style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: '1px solid #EDE0CC', background: '#FFF9F0', color: '#7a3208', fontFamily: UI_FONT, fontSize: 12, fontWeight: 800, cursor: nearbyLoading === t.name ? 'wait' : 'pointer' }}
                        >
                          {nearbyLoading === t.name ? <Loader2 size={13} style={{ animation: 'spin .8s linear infinite' }} /> : <MapPin size={13} />}
                          {nearbyTempleData[t.name] ? 'Hide nearby mandir' : 'Nearby mandir within 10 km'}
                        </button>

                        {nearbyTempleData[t.name] && (
                          <div style={{ marginTop: 12, borderTop: '1px solid #F2E3CF', paddingTop: 12 }}>
                            {nearbyTempleData[t.name].length === 0 ? (
                              <p style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150', margin: 0 }}>No popular nearby mandir found within 10 km.</p>
                            ) : (
                              nearbyTempleData[t.name].map((nearby) => (
                                <div key={`${t.name}-${nearby.name}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: '1px solid #F8EFE3' }}>
                                  <div>
                                    <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800, color: '#3D1F00', margin: 0 }}>{nearby.name}</p>
                                    <p style={{ fontFamily: UI_FONT, fontSize: 11, color: '#9A7150', margin: '3px 0 0' }}>{nearby.deity || 'Temple'} - {nearby.description}</p>
                                  </div>
                                  <span style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 800, color: '#B84D00', whiteSpace: 'nowrap' }}>{nearby.distance_km} km</span>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: 'white', borderRadius: 14, border: '1px solid #EDE0CC', padding: 20, boxShadow: '0 1px 8px rgba(61,31,0,0.05)' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: '#3D1F00', margin: '0 0 16px' }}>Optimized Itinerary</h3>
                    {(result.optimized_plan || []).map((stop) => (
                      <div key={stop.stop_number} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#E8650A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: UI_FONT, fontWeight: 800, fontSize: 11, flexShrink: 0 }}>{stop.stop_number}</div>
                        <div>
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800, color: '#3D1F00', margin: '2px 0 3px' }}>{stop.temple_name}</p>
                          <p style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150', lineHeight: 1.55, margin: 0 }}>{stop.arrival_order_reason}</p>
                        </div>
                      </div>
                    ))}
                    {(!result.optimized_plan || result.optimized_plan.length === 0) && (
                      <p style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150', margin: 0 }}>No temple itinerary available for this route yet.</p>
                    )}
                  </div>

                  {result.insights?.length > 0 && (
                    <div style={{ background: 'white', borderRadius: 14, border: '1px solid #EDE0CC', padding: 20, boxShadow: '0 1px 8px rgba(61,31,0,0.05)' }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: '#3D1F00', margin: '0 0 14px' }}>Travel Tips</h3>
                      {result.insights.map((tip, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                          <Star size={12} color="#C8960C" style={{ marginTop: 4, flexShrink: 0 }} />
                          <span style={{ fontFamily: UI_FONT, fontSize: 12, color: '#5C3D1E', lineHeight: 1.65 }}>{tip}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <button onClick={handleCopy} style={{ width: '100%', padding: 11, borderRadius: 10, border: `1.5px solid ${copied ? '#16a34a' : '#EDE0CC'}`, background: copied ? '#f0fdf4' : 'white', color: copied ? '#15803d' : '#5C3D1E', fontFamily: UI_FONT, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                    {copied ? 'Copied!' : 'Copy Route Summary'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div style={{ marginTop: result ? 32 : 24, background: 'white', borderRadius: 18, border: '1px solid #EDE0CC', boxShadow: '0 2px 16px rgba(61,31,0,0.06)', padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: '#7a3208', margin: '0 0 4px' }}>Already know your route?</h3>
              <p style={{ fontFamily: UI_FONT, color: '#9A7150', fontSize: 13, margin: 0 }}>{bookingSubtitle}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <button onClick={handleBookingClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 10, border: `2px solid ${bookingMeta.color}`, color: bookingMeta.color, background: 'transparent', fontFamily: UI_FONT, fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                {bookingMeta.label} <ExternalLink size={14} />
              </button>
              <p style={{ fontFamily: UI_FONT, fontSize: 11, color: '#9A7150', margin: '6px 0 0' }}>
                via <span style={{ fontWeight: 800, color: bookingMeta.color }}>{bookingMeta.provider}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 860px) {
          .route-results-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 720px) {
          .route-form-inner { grid-template-columns: 1fr !important; }
          .mode-grid { grid-template-columns: repeat(2,1fr) !important; }
          .route-summary-inner { flex-direction: column !important; }
          .route-summary-stats { width: 100%; justify-content: space-around; display: flex; }
        }
      `}</style>

      <Footer />
    </>
  );
}

const labelStyle = {
  display: 'block',
  fontFamily: UI_FONT,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.09em',
  textTransform: 'uppercase',
  color: '#9A7150',
  marginBottom: 8,
};

const sectionLabelStyle = {
  fontFamily: UI_FONT,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '.09em',
  textTransform: 'uppercase',
  color: '#9A7150',
  margin: '0 0 12px',
};

const dropdownInfoStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '13px 16px',
  color: '#9A7150',
  fontFamily: UI_FONT,
  fontSize: 13,
};

const suggestionButtonStyle = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '11px 16px',
  cursor: 'pointer',
  border: 'none',
  borderBottom: '1px solid #FDF6EC',
  background: 'white',
  fontFamily: UI_FONT,
  fontSize: 14,
  color: '#3D1F00',
  textAlign: 'left',
};