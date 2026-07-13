import { useState, useRef, useEffect } from 'react';
import { MapPin, Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Debounced, click-outside-aware city suggestion dropdown. Backed by
// GET /api/panchang/city-suggestions (ORS /geocode/autocomplete under the
// hood, restricted to India). Selecting a suggestion just fills the input
// with its full label text — the existing /daily and /muhurat submit flows
// already re-resolve that text through geocode_city() (ORS /geocode/search)
// on the backend, so no extra wiring is needed here beyond the text itself.
export default function CityAutocomplete({ value, onChange, placeholder, style }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debounceRef = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  const runSearch = (text) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/panchang/city-suggestions?query=${encodeURIComponent(text)}`);
        const data = await res.json();
        setSuggestions(data.suggestions || []);
        setActiveIndex(-1);
        setOpen(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const handleInput = (text) => {
    onChange(text);
    runSearch(text);
  };

  const handleSelect = (suggestion) => {
    onChange(suggestion.description);
    setOpen(false);
    setSuggestions([]);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: style?.width || '100%' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        style={style}
      />
      {loading && (
        <Loader2
          size={14}
          color="#c47a14"
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', animation: 'spin .8s linear infinite' }}
        />
      )}
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
            background: '#fff', border: '1px solid #e7d8c6', borderRadius: 9,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, maxHeight: 260, overflowY: 'auto',
          }}
        >
          {suggestions.map((s, index) => (
            <div
              key={s.place_id || `${s.description}-${index}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(s)}
              onMouseEnter={() => setActiveIndex(index)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                cursor: 'pointer', fontSize: 13.5, color: '#3a3a3a',
                borderBottom: '1px solid #f5f5f5',
                background: index === activeIndex ? '#fff8ee' : 'transparent',
              }}
            >
              <MapPin size={13} color="#c47a14" style={{ flexShrink: 0 }} />
              <span>{s.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}