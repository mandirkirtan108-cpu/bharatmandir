import { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, Navigation, Star, AlertCircle, Loader2, ExternalLink, X, ChevronDown, ChevronUp, Map } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const UI_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Roboto", sans-serif';

const TRAVEL_MODES = [
  { value: 'car',   label: 'Car' },
  { value: 'bike',  label: 'Bike' },
  { value: 'train', label: 'Train' },
  { value: 'bus',   label: 'Bus' },
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
  train: { label: 'Search Trains on ixigo',  provider: 'ixigo trains', color: '#1565C0' },
  bus:   { label: 'Search Buses on redBus',  provider: 'redBus',       color: '#D84315' },
  car:   { label: 'Open in Google Maps',     provider: 'Google Maps',  color: '#E8650A' },
  bike:  { label: 'Open in Google Maps',     provider: 'Google Maps',  color: '#E8650A' },
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── City Autocomplete ────────────────────────────────────────────────────────
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
    if (!query || query.length < 1) { setSuggestions([]); setOpen(false); return; }
    if (abortController.current) abortController.current.abort();
    abortController.current = new AbortController();
    currentQuery.current = query;
    setFetching(true);
    try {
      const res = await fetch(`${API_BASE}/api/route/cities?q=${encodeURIComponent(query)}`, {
        method: 'GET', signal: abortController.current.signal,
      });
      if (currentQuery.current !== query) return;
      if (!res.ok) throw new Error('City search failed');
      const data = await res.json();
      const cities = data.cities || [];
      setSuggestions(cities);
      setOpen(cities.length > 0);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setSuggestions([]); setOpen(false);
    } finally {
      if (currentQuery.current === query) setFetching(false);
    }
  }, []);

  const handleInput = (e) => {
    const val = e.target.value;
    onChange(val);
    clearTimeout(debounceTimer.current);
    if (!val.trim()) { setSuggestions([]); setOpen(false); setFetching(false); return; }
    setFetching(true);
    debounceTimer.current = setTimeout(() => fetchCities(val.trim()), 250);
  };

  const handleSelect = (city) => {
    onChange(city); setOpen(false); setSuggestions([]); setFetching(false);
    clearTimeout(debounceTimer.current); inputRef.current?.blur();
  };

  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const handleKeyDown = (e) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightedIndex(i => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightedIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && highlightedIndex >= 0) { e.preventDefault(); handleSelect(suggestions[highlightedIndex]); }
    else if (e.key === 'Escape') { setOpen(false); setHighlightedIndex(-1); }
  };

  useEffect(() => { setHighlightedIndex(-1); }, [suggestions]);
  useEffect(() => {
    const handler = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  useEffect(() => () => { clearTimeout(debounceTimer.current); abortController.current?.abort(); }, []);

  const isDropdownOpen = open || (fetching && value.length > 0);

  const renderCityName = (city) => {
    const lower = value.toLowerCase();
    const idx   = city.toLowerCase().indexOf(lower);
    if (idx < 0) return <span style={{ fontSize: 14, color: '#3D1F00' }}>{city}</span>;
    return (
      <span style={{ fontSize: 14, color: '#3D1F00' }}>
        {city.slice(0, idx)}
        <strong style={{ color: '#E8650A' }}>{city.slice(idx, idx + value.length)}</strong>
        {city.slice(idx + value.length)}
      </span>
    );
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', zIndex: 10 }}>
      <label style={{ display: 'block', fontFamily: UI_FONT, fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#9A7150', marginBottom: 8 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: `2px solid ${focused ? '#E8650A' : '#EDE0CC'}`, borderRadius: isDropdownOpen ? '12px 12px 0 0' : 12, padding: '13px 16px', background: 'white', transition: 'border-color .2s, border-radius .15s' }}>
        {icon}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInput}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setTimeout(() => setOpen(false), 180); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 15, color: '#1A0A00', fontFamily: UI_FONT }}
        />
        {fetching && <Loader2 size={15} color="#E8650A" style={{ flexShrink: 0, animation: 'spin .8s linear infinite' }} />}
        {value && !fetching && (
          <button
            onMouseDown={(e) => { e.preventDefault(); onChange(''); setSuggestions([]); setOpen(false); setFetching(false); clearTimeout(debounceTimer.current); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#BBA080', fontSize: 16, padding: 0, lineHeight: 1, flexShrink: 0 }}
            aria-label="Clear"
          >×</button>
        )}
      </div>
      {isDropdownOpen && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 999, background: 'white', border: '2px solid #E8650A', borderTop: '1px solid #EDE0CC', borderRadius: '0 0 12px 12px', boxShadow: '0 8px 24px rgba(61,31,0,0.14)', overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
          {fetching && suggestions.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', color: '#9A7150', fontFamily: UI_FONT, fontSize: 13 }}>
              <Loader2 size={14} style={{ animation: 'spin .8s linear infinite', flexShrink: 0 }} /> Searching cities…
            </div>
          )}
          {!fetching && suggestions.length === 0 && value.length >= 2 && (
            <div style={{ padding: '13px 16px', color: '#BBA080', fontFamily: UI_FONT, fontSize: 13, fontStyle: 'italic' }}>No cities found for "{value}"</div>
          )}
          {suggestions.map((city, i) => (
            <div
              key={city + i}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(city); }}
              onMouseEnter={() => setHighlightedIndex(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid #FDF6EC' : 'none', background: highlightedIndex === i ? '#FDF6EC' : 'white', transition: 'background .12s', fontFamily: UI_FONT }}
            >
              <MapPin size={13} color="#E8650A" style={{ flexShrink: 0 }} />
              {renderCityName(city)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Nearby Temples Panel (inline, no overlap) ────────────────────────────────
function NearbyTemplePanel({ temple, onClose }) {
  const [nearby, setNearby]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    const fetchNearby = async () => {
      setLoading(true); setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/route/nearby-temples`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            temple_name: temple.name,
            location:    temple.location,
            radius_km:   15,
          }),
        });
        if (!res.ok) throw new Error('Failed to fetch nearby temples');
        const data = await res.json();
        setNearby(data.nearby_temples || []);
      } catch (e) {
        setError('Could not load nearby temples. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchNearby();
  }, [temple.name, temple.location]);

  return (
    <div style={{
      marginTop: 12,
      background: '#FFFAF5',
      border: '1.5px solid #EDE0CC',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #7a3208 0%, #B84D00 100%)',
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ fontFamily: UI_FONT, fontSize: 10, color: 'rgba(255,255,255,0.70)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 3, fontWeight: 700 }}>
            Temples within 15 km of
          </p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'white', fontWeight: 800, margin: 0 }}>
            {temple.name}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', transition: 'background .15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
        >
          <X size={15} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '6px 0' }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '20px 18px', color: '#9A7150', fontFamily: UI_FONT, fontSize: 13 }}>
            <Loader2 size={16} color="#E8650A" style={{ animation: 'spin .8s linear infinite', flexShrink: 0 }} />
            Finding nearby sacred places…
          </div>
        )}

        {error && !loading && (
          <div style={{ display: 'flex', gap: 10, padding: '14px 18px', alignItems: 'center' }}>
            <AlertCircle size={15} color="#D32F2F" style={{ flexShrink: 0 }} />
            <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#C62828', margin: 0 }}>{error}</p>
          </div>
        )}

        {!loading && !error && nearby.length === 0 && (
          <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#9A7150', padding: '18px', fontStyle: 'italic', margin: 0 }}>
            No significant temples found within 15 km.
          </p>
        )}

        {!loading && !error && nearby.map((t, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start',
              padding: '14px 18px',
              borderBottom: i < nearby.length - 1 ? '1px solid #F0E8DC' : 'none',
              transition: 'background .12s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#FDF6EC'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            {/* Index circle */}
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(232,101,10,0.10)', border: '1.5px solid rgba(232,101,10,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: UI_FONT, fontSize: 12, fontWeight: 700, color: '#E8650A' }}>{i + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#3D1F00', margin: 0 }}>{t.name}</p>
                {t.deity && (
                  <span style={{ background: 'rgba(232,101,10,0.08)', border: '1px solid rgba(232,101,10,0.2)', borderRadius: 20, padding: '1px 8px', fontSize: 10, color: '#B84D00', fontWeight: 600, fontFamily: UI_FONT, whiteSpace: 'nowrap' }}>{t.deity}</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 5 }}>
                <span style={{ fontFamily: UI_FONT, fontSize: 11, color: '#9A7150', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <MapPin size={10} style={{ flexShrink: 0 }} /> {t.distance_km} km away
                </span>
                {t.estimated_visit_time && (
                  <span style={{ fontFamily: UI_FONT, fontSize: 11, color: '#9A7150' }}>{t.estimated_visit_time} min visit</span>
                )}
              </div>
              <p style={{ fontFamily: UI_FONT, fontSize: 12, color: '#5C3D1E', lineHeight: 1.6, margin: 0 }}>{t.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Route Map (OpenStreetMap via Leaflet CDN) ────────────────────────────────
function RouteMap({ temples, start, destination, isVisible }) {
  const mapRef      = useRef(null);
  const mapInstance = useRef(null);
  const leafletRef  = useRef(null);

  useEffect(() => {
    if (!isVisible || !mapRef.current) return;

    const loadLeaflet = async () => {
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id   = 'leaflet-css';
        link.rel  = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
        document.head.appendChild(link);
      }
      if (!window.L) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src  = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
          script.onload  = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }
      leafletRef.current = window.L;
      initMap();
    };

    const initMap = async () => {
      const L = leafletRef.current || window.L;
      if (!L || !mapRef.current) return;
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }

      const geocode = async (query) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ', India')}&format=json&limit=1`,
            { headers: { 'User-Agent': 'BharatMandir/1.0' } }
          );
          const data = await res.json();
          if (data[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        } catch {}
        return null;
      };

      const [startCoords, destCoords] = await Promise.all([geocode(start), geocode(destination)]);
      if (!startCoords || !destCoords) return;

      const templeCoords = await Promise.all(
        temples.map(async (t) => {
          const coords = await geocode(`${t.name}, ${t.location}`);
          return { ...t, coords };
        })
      );

      const allPoints = [startCoords, destCoords, ...templeCoords.filter(t => t.coords).map(t => t.coords)];
      const bounds = L.latLngBounds(allPoints);
      const map = L.map(mapRef.current, { zoomControl: true, scrollWheelZoom: true });
      mapInstance.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      map.fitBounds(bounds, { padding: [40, 40] });

      try {
        const waypoints = [startCoords, ...templeCoords.filter(t => t.coords).map(t => t.coords), destCoords];
        const coordStr  = waypoints.map(p => `${p[1]},${p[0]}`).join(';');
        const routeRes  = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`);
        const routeData = await routeRes.json();
        if (routeData.routes?.[0]) {
          L.geoJSON(routeData.routes[0].geometry, { style: { color: '#E8650A', weight: 4, opacity: 0.8 } }).addTo(map);
        }
      } catch {
        const linePoints = [startCoords, ...templeCoords.filter(t => t.coords).map(t => t.coords), destCoords];
        L.polyline(linePoints, { color: '#E8650A', weight: 3, opacity: 0.6, dashArray: '8, 6' }).addTo(map);
      }

      const startIcon = L.divIcon({ className: '', html: `<div style="background:#16a34a;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:13px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-weight:700;font-family:sans-serif;">A</div>`, iconSize: [32, 32], iconAnchor: [16, 16] });
      L.marker(startCoords, { icon: startIcon }).addTo(map).bindPopup(`<b style="color:#16a34a">Start: ${start}</b>`);

      const destIcon = L.divIcon({ className: '', html: `<div style="background:#7a3208;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-size:13px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);font-weight:700;font-family:sans-serif;">B</div>`, iconSize: [32, 32], iconAnchor: [16, 16] });
      L.marker(destCoords, { icon: destIcon }).addTo(map).bindPopup(`<b style="color:#7a3208">Destination: ${destination}</b>`);

      templeCoords.filter(t => t.coords).forEach((t, i) => {
        const isHigh = t.importance === 'high';
        const icon = L.divIcon({ className: '', html: `<div style="background:${isHigh ? '#E8650A' : '#FF8C2A'};color:white;border-radius:50%;width:${isHigh ? 28 : 24}px;height:${isHigh ? 28 : 24}px;display:flex;align-items:center;justify-content:center;font-size:${isHigh ? 12 : 11}px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);font-family:sans-serif;font-weight:700;">${i + 1}</div>`, iconSize: isHigh ? [28, 28] : [24, 24], iconAnchor: isHigh ? [14, 14] : [12, 12] });
        L.marker(t.coords, { icon }).addTo(map).bindPopup(`<div style="font-family:sans-serif;min-width:180px;"><b style="color:#3D1F00;font-size:13px;">${t.name}</b><br/><span style="color:#9A7150;font-size:11px;">${t.location}</span><br/>${t.deity ? `<span style="color:#E8650A;font-size:11px;">Deity: ${t.deity}</span><br/>` : ''}<span style="color:#5C3D1E;font-size:11px;">${t.estimated_stop_time_minutes} min visit</span></div>`);
      });
    };

    loadLeaflet().catch(console.error);
    return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
  }, [isVisible, temples, start, destination]);

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1.5px solid #EDE0CC', boxShadow: '0 4px 20px rgba(61,31,0,0.08)' }}>
      <div ref={mapRef} style={{ height: 420, width: '100%', background: '#f0e8d8' }} />
      <div style={{ padding: '12px 18px', background: '#FFFAF5', borderTop: '1px solid #EDE0CC', display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        {[
          { color: '#16a34a', label: 'Start' },
          { color: '#7a3208', label: 'Destination' },
          { color: '#E8650A', label: 'Must Visit' },
          { color: '#FF8C2A', label: 'Temple Stop' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
            <span style={{ fontFamily: UI_FONT, fontSize: 11, color: '#5C3D1E' }}>{label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
          <div style={{ width: 18, height: 3, background: '#E8650A', borderRadius: 2 }} />
          <span style={{ fontFamily: UI_FONT, fontSize: 11, color: '#5C3D1E' }}>Route</span>
        </div>
      </div>
    </div>
  );
}

// ── Temple Card ──────────────────────────────────────────────────────────────
// Nearby panel renders INLINE below the card — no overlap possible
function TempleCard({ temple, index }) {
  const [showNearby, setShowNearby] = useState(false);

  return (
    <div>
      {/* Main card */}
      <div style={{
        background: 'white',
        borderRadius: 14,
        border: `1.5px solid ${temple.importance === 'high' ? '#E8650A' : '#EDE0CC'}`,
        padding: '20px 22px',
        boxShadow: temple.importance === 'high'
          ? '0 2px 12px rgba(232,101,10,0.10)'
          : '0 1px 6px rgba(61,31,0,0.05)',
        transition: 'box-shadow .2s',
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
            {/* Number badge */}
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: temple.importance === 'high' ? '#E8650A' : '#F5EDE0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: UI_FONT, fontSize: 12, fontWeight: 700, color: temple.importance === 'high' ? 'white' : '#7a3208', flexShrink: 0 }}>{index + 1}</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: '#3D1F00', margin: 0 }}>{temple.name}</h3>
            {temple.importance === 'high' && (
              <span style={{ background: '#E8650A', color: 'white', fontFamily: UI_FONT, fontSize: 9, fontWeight: 800, letterSpacing: '.08em', padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap', textTransform: 'uppercase', flexShrink: 0 }}>Must Visit</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ background: '#F5EDE0', borderRadius: 20, padding: '4px 11px', fontFamily: UI_FONT, fontSize: 11, color: '#7a3208', fontWeight: 600 }}>{temple.distance_from_route_km} off route</span>
            <span style={{ background: '#F5EDE0', borderRadius: 20, padding: '4px 11px', fontFamily: UI_FONT, fontSize: 11, color: '#7a3208', fontWeight: 600 }}>{temple.estimated_stop_time_minutes} min</span>
          </div>
        </div>

        {/* Location & deity */}
        <p style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
          <MapPin size={11} style={{ flexShrink: 0 }} />
          {temple.location}{temple.deity ? ` · ${temple.deity}` : ''}
        </p>

        {/* Why visit */}
        <p style={{ fontFamily: UI_FONT, fontSize: 13, color: '#5C3D1E', lineHeight: 1.7, marginBottom: 14 }}>{temple.why_visit}</p>

        {/* Nearby toggle */}
        <button
          onClick={() => setShowNearby(prev => !prev)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '8px 16px',
            borderRadius: 8,
            border: `1.5px solid ${showNearby ? '#E8650A' : '#EDE0CC'}`,
            background: showNearby ? 'rgba(232,101,10,0.05)' : 'white',
            color: showNearby ? '#B84D00' : '#7a3208',
            fontFamily: UI_FONT, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', transition: 'all .2s',
          }}
          onMouseEnter={e => { if (!showNearby) { e.currentTarget.style.borderColor = '#E8650A'; e.currentTarget.style.color = '#B84D00'; } }}
          onMouseLeave={e => { if (!showNearby) { e.currentTarget.style.borderColor = '#EDE0CC'; e.currentTarget.style.color = '#7a3208'; } }}
        >
          <MapPin size={12} />
          Temples nearby (15 km)
          {showNearby ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Nearby panel — inline, below card, never overlaps */}
      {showNearby && (
        <NearbyTemplePanel
          temple={temple}
          onClose={() => setShowNearby(false)}
        />
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function RoutePlannerPage() {
  const [form, setForm] = useState({
    start: '', destination: '', travel_mode: 'car',
    time_available: '6', preferences: [],
  });
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const [copied,  setCopied]  = useState(false);
  const [showMap, setShowMap] = useState(false);

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
    setLoading(true); setError(null); setResult(null); setShowMap(false);
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
      `My Spiritual Route: ${result.route_summary.start} to ${result.route_summary.destination}\n` +
      (result.recommended_temples || []).map(t => `- ${t.name} (${t.location})`).join('\n') +
      '\n\nPlanned via BharatMandir';
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  const bookingMeta     = BOOKING_META[form.travel_mode] || BOOKING_META.car;
  const bookingSubtitle = form.start.trim() && form.destination.trim()
    ? `${form.start} to ${form.destination} via ${form.travel_mode}`
    : 'Enter your route above to get a direct booking link.';

  return (
    <>
      <Navbar />

      {/* HERO */}
      <section style={{
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, #3D1200 0%, #7a3208 55%, #A84810 100%)',
        padding: '56px 12px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        width: '100%', boxSizing: 'border-box',
      }}>
        {/* Subtle texture overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,213,128,0.06) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255,140,42,0.08) 0%, transparent 50%)', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 680, padding: '0 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,213,128,0.25)', borderRadius: 20, padding: '5px 16px', marginBottom: 18, color: 'rgba(255,213,128,0.80)', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', fontWeight: 600, fontFamily: UI_FONT }}>
            AI Route Planner
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(28px, 5vw, 50px)', lineHeight: 1.1, marginBottom: 14, marginTop: 0, color: '#ffffff', width: '100%' }}>
            Your Journey,{' '}
            <span style={{ color: '#FFD580' }}>Divine Stopovers</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 15, maxWidth: 480, margin: '0 0 28px 0', fontWeight: 400, lineHeight: 1.75, fontFamily: UI_FONT }}>
            Tell us where you're headed — we'll find every sacred temple along your spiritual path.
          </p>
        </div>
      </section>

      {/* BODY */}
      <section style={{ background: '#F7F2EC', paddingBottom: 80, paddingTop: 48 }}>
        <div style={{ maxWidth: 920, margin: '0 auto', padding: '0 20px' }}>

          {/* PLANNER CARD */}
          <div style={{ background: 'white', borderRadius: 20, boxShadow: '0 4px 32px rgba(61,31,0,0.09)', border: '1px solid #EDE0CC', padding: '36px 36px 32px' }}>

            <div style={{ marginBottom: 30 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: '#7a3208', marginBottom: 4, marginTop: 0 }}>Plan Your Spiritual Route</h2>
              <p style={{ fontFamily: UI_FONT, color: '#9A7150', fontSize: 14, margin: 0 }}>Discover temples and divine stops on your journey.</p>
            </div>

            {/* FROM / TO */}
            <div className="route-form-inner" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 28 }}>
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
              <h3 style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#9A7150', marginBottom: 12, marginTop: 0 }}>Travel Mode</h3>
              <div className="mode-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                {TRAVEL_MODES.map(m => {
                  const active = form.travel_mode === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() => setForm(f => ({ ...f, travel_mode: m.value }))}
                      style={{
                        border: `2px solid ${active ? '#E8650A' : '#EDE0CC'}`,
                        borderRadius: 12,
                        padding: '14px 8px',
                        background: active ? 'linear-gradient(135deg, #B84D00, #E8650A)' : 'white',
                        color: active ? 'white' : '#5C3D1E',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all .2s',
                        boxShadow: active ? '0 3px 12px rgba(232,101,10,0.25)' : 'none',
                        fontFamily: UI_FONT,
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PREFERENCES */}
            <div style={{ marginBottom: 30 }}>
              <h3 style={{ fontFamily: UI_FONT, fontSize: 11, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: '#9A7150', marginBottom: 12, marginTop: 0 }}>
                Temple Preferences{' '}
                <span style={{ fontSize: 11, fontWeight: 400, color: '#BBA080', letterSpacing: 0, textTransform: 'none' }}>(optional)</span>
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {PREF_OPTIONS.map(p => {
                  const active = form.preferences.includes(p);
                  return (
                    <button
                      key={p}
                      onClick={() => togglePref(p)}
                      style={{
                        padding: '7px 16px',
                        borderRadius: 8,
                        fontFamily: UI_FONT,
                        border: `1.5px solid ${active ? '#E8650A' : '#EDE0CC'}`,
                        background: active ? 'linear-gradient(135deg, #B84D00, #E8650A)' : 'white',
                        color: active ? 'white' : '#5C3D1E',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                        transition: 'all .2s',
                        boxShadow: active ? '0 2px 8px rgba(232,101,10,0.20)' : 'none',
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{ width: '100%', padding: '15px', borderRadius: 12, border: 'none', background: loading ? '#C8956A' : 'linear-gradient(135deg, #3D1F00 0%, #B84D00 50%, #E8650A 100%)', color: 'white', fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'var(--font-display)', letterSpacing: '.04em', boxShadow: loading ? 'none' : '0 4px 18px rgba(184,77,0,0.28)', transition: 'all .25s' }}
            >
              {loading
                ? <><Loader2 size={17} style={{ animation: 'spin .8s linear infinite' }} /> Finding Sacred Stops…</>
                : 'Plan My Spiritual Route'
              }
            </button>

            {error && (
              <div style={{ marginTop: 14, background: '#FFF4F4', border: '1px solid #FFCDD2', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertCircle size={16} color="#D32F2F" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontFamily: UI_FONT, color: '#C62828', fontSize: 13, margin: 0 }}>{error}</p>
              </div>
            )}
          </div>

          {/* LOADING */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <Loader2 size={36} color="#E8650A" style={{ animation: 'spin .8s linear infinite', marginBottom: 16 }} />
              <p style={{ fontFamily: 'var(--font-display)', color: '#7a3208', fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Consulting the divine route map…</p>
              <p style={{ fontFamily: UI_FONT, color: '#9A7150', fontSize: 13, margin: 0 }}>Mapping sacred temples along your journey</p>
            </div>
          )}

          {/* RESULTS */}
          {result && !loading && (
            <div style={{ marginTop: 32, animation: 'fadeDown .5s ease both' }}>

              {result.travel_time_warning && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, background: '#FFFBEB', border: '1px solid #FCD34D', borderLeft: '4px solid #F59E0B', borderRadius: 14, padding: '16px 20px', marginBottom: 20 }}>
                  <AlertCircle size={17} color="#92400E" style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <p style={{ fontFamily: UI_FONT, fontWeight: 700, color: '#92400E', fontSize: 13, marginBottom: 4 }}>Travel Time Note</p>
                    <p style={{ fontFamily: UI_FONT, color: '#78350F', fontSize: 13, lineHeight: 1.6, margin: 0 }}>{result.travel_time_warning}</p>
                  </div>
                </div>
              )}

              {/* Route Summary */}
              <div style={{ background: 'linear-gradient(135deg, #3D1F00 0%, #6B3A1F 100%)', borderRadius: 18, padding: '26px 30px', marginBottom: 20, color: 'white', boxShadow: '0 4px 24px rgba(61,31,0,0.16)' }}>
                <div className="route-summary-inner" style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 180 }}>
                    <p style={{ fontFamily: UI_FONT, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)', marginBottom: 10, fontWeight: 700 }}>Your Route</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'white' }}>
                      {result.route_summary.start}
                      <span style={{ color: '#FFD580', fontSize: 16 }}>→</span>
                      {result.route_summary.destination}
                    </div>
                  </div>
                  <div className="route-summary-stats" style={{ display: 'flex', gap: 32 }}>
                    {[
                      { val: result.route_summary.total_distance,        key: 'Distance' },
                      { val: result.route_summary.estimated_travel_time, key: 'Travel Time' },
                      { val: result.recommended_temples?.length || 0,    key: 'Temples' },
                    ].map(s => (
                      <div key={s.key} style={{ textAlign: 'center' }}>
                        <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#FFD580', marginBottom: 2 }}>{s.val}</span>
                        <span style={{ fontFamily: UI_FONT, fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{s.key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* MAP TOGGLE */}
              <div style={{ marginBottom: 20 }}>
                <button
                  onClick={() => setShowMap(v => !v)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '11px 20px', borderRadius: 10,
                    border: `1.5px solid ${showMap ? '#E8650A' : '#EDE0CC'}`,
                    background: showMap ? 'linear-gradient(135deg, #B84D00, #E8650A)' : 'white',
                    color: showMap ? 'white' : '#5C3D1E',
                    fontFamily: UI_FONT, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', transition: 'all .2s',
                    boxShadow: showMap ? '0 3px 12px rgba(232,101,10,0.22)' : '0 1px 6px rgba(61,31,0,0.06)',
                  }}
                >
                  <Map size={16} />
                  {showMap ? 'Hide Route Map' : 'Show Route on Map'}
                  {showMap ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>

              {/* MAP */}
              {showMap && (
                <div style={{ marginBottom: 24, animation: 'fadeDown .35s ease both' }}>
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: '#7a3208', margin: 0 }}>Route Map</h2>
                    <span style={{ fontFamily: UI_FONT, fontSize: 11, color: '#9A7150', background: '#F5EDE0', borderRadius: 20, padding: '3px 10px' }}>OpenStreetMap</span>
                  </div>
                  <RouteMap
                    temples={result.recommended_temples || []}
                    start={result.route_summary.start}
                    destination={result.route_summary.destination}
                    isVisible={showMap}
                  />
                </div>
              )}

              {/* TEMPLES + SIDEBAR */}
              <div className="route-results-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 22, alignItems: 'start' }}>

                {/* Temple cards list */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: '#7a3208', margin: 0 }}>Temples Along Your Route</h2>
                  </div>

                  {/* Hint */}
                  <div style={{ background: '#F5EDE0', border: '1px solid #EDE0CC', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={13} color="#B84D00" style={{ flexShrink: 0 }} />
                    <p style={{ fontFamily: UI_FONT, fontSize: 12, color: '#7a3208', fontWeight: 500, margin: 0 }}>
                      Click <strong>Temples nearby (15 km)</strong> on any card to explore more sacred sites in the area.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(result.recommended_temples || []).map((t, i) => (
                      <TempleCard key={i} temple={t} index={i} />
                    ))}
                  </div>
                </div>

                {/* Sidebar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Itinerary */}
                  <div style={{ background: 'white', borderRadius: 14, border: '1px solid #EDE0CC', padding: '20px', boxShadow: '0 1px 8px rgba(61,31,0,0.05)' }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#3D1F00', marginBottom: 18, marginTop: 0 }}>Optimized Itinerary</h3>
                    {(result.optimized_plan || []).map((stop, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, position: 'relative' }}>
                        {i < result.optimized_plan.length - 1 && (
                          <div style={{ position: 'absolute', left: 13, top: 26, bottom: 0, width: 1.5, background: '#EDE0CC', zIndex: 0 }} />
                        )}
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#E8650A', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: UI_FONT, fontWeight: 700, fontSize: 11, flexShrink: 0, zIndex: 1 }}>{stop.stop_number}</div>
                        <div style={{ paddingBottom: 18 }}>
                          <p style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#3D1F00', marginBottom: 3, marginTop: 2 }}>{stop.temple_name}</p>
                          {stop.arrival_time_hint && (
                            <p style={{ fontFamily: UI_FONT, fontSize: 11, color: '#E8650A', fontWeight: 600, marginBottom: 3 }}>{stop.arrival_time_hint}</p>
                          )}
                          <p style={{ fontFamily: UI_FONT, fontSize: 12, color: '#9A7150', lineHeight: 1.55, margin: 0 }}>{stop.arrival_order_reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tips */}
                  {result.insights?.length > 0 && (
                    <div style={{ background: 'white', borderRadius: 14, border: '1px solid #EDE0CC', padding: '20px', boxShadow: '0 1px 8px rgba(61,31,0,0.05)' }}>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#3D1F00', marginBottom: 14, marginTop: 0 }}>Travel Tips</h3>
                      {result.insights.map((tip, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 10 }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#E8650A', flexShrink: 0, marginTop: 6 }} />
                          <span style={{ fontFamily: UI_FONT, fontSize: 12, color: '#5C3D1E', lineHeight: 1.65 }}>{tip}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Copy */}
                  <button
                    onClick={handleCopy}
                    style={{ width: '100%', padding: '11px', borderRadius: 10, border: `1.5px solid ${copied ? '#16a34a' : '#EDE0CC'}`, background: copied ? '#f0fdf4' : 'white', color: copied ? '#15803d' : '#5C3D1E', fontFamily: UI_FONT, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {copied ? 'Copied!' : 'Copy Route Summary'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BOOKING CARD */}
          <div style={{ marginTop: result ? 32 : 24, background: 'white', borderRadius: 18, border: '1px solid #EDE0CC', boxShadow: '0 2px 16px rgba(61,31,0,0.06)', padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#7a3208', marginBottom: 4, marginTop: 0 }}>Already know your route?</h3>
              <p style={{ fontFamily: UI_FONT, color: '#9A7150', fontSize: 13, margin: 0 }}>{bookingSubtitle}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <button
                onClick={handleBookingClick}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 10, border: `2px solid ${bookingMeta.color}`, color: bookingMeta.color, background: 'transparent', fontFamily: UI_FONT, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = bookingMeta.color; e.currentTarget.style.color = 'white'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = bookingMeta.color; }}
              >
                {bookingMeta.label} <ExternalLink size={14} />
              </button>
              <p style={{ fontFamily: UI_FONT, fontSize: 11, color: '#9A7150', marginTop: 6, marginBottom: 0 }}>
                via <span style={{ fontWeight: 700, color: bookingMeta.color }}>{bookingMeta.provider}</span>
              </p>
            </div>
          </div>

        </div>
      </section>

      <style>{`
        @keyframes spin     { to { transform: rotate(360deg); } }
        @keyframes fadeDown { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @media (max-width: 860px) {
          .route-results-grid { grid-template-columns: 1fr !important; }
        }
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
