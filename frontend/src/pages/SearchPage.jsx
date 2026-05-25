import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X, MapPin, Navigation } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import TempleCard from '../components/TempleCard';
import Footer from '../components/Footer';
import { templeAPI } from '../services/api';
import { useTranslatedTemples } from '../hooks/useTranslatedData';

const SECTS  = ['Shaiva', 'Vaishnav', 'Shakta', 'Smarta', 'Ganapatya'];
const STATES = ['Madhya Pradesh', 'Uttar Pradesh', 'Maharashtra', 'Tamil Nadu', 'Gujarat', 'Karnataka', 'Rajasthan', 'Bihar', 'Odisha', 'Andhra Pradesh', 'Telangana', 'Kerala', 'West Bengal'];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t }                           = useTranslation();

  const [query,      setQuery]      = useState(searchParams.get('q') || '');
  const [results,    setResults]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [sort,       setSort]       = useState('name_asc');

  const [selectedSects,  setSelectedSects]  = useState([]);
  const [selectedStates, setSelectedStates] = useState([]);
  const [jyotirlinga,    setJyotirlinga]    = useState(false);
  const [shaktipeeth,    setShaktipeeth]    = useState(false);
  const [freeEntry,      setFreeEntry]      = useState(false);

  // ── Radius / Nearby state ──────────────────────────────────────────
  const [nearbyMode,     setNearbyMode]     = useState(false);
  const [radiusKm,       setRadiusKm]       = useState(10);
  const [userLocation,   setUserLocation]   = useState(null);   // { lat, lng }
  const [locationError,  setLocationError]  = useState('');
  const [locLoading,     setLocLoading]     = useState(false);

  const { translated: displayResults, translating } = useTranslatedTemples(results);

  const SORT_OPTIONS = [
    { value: 'name_asc',    label: t('sort.name_asc') },
    { value: 'name_desc',   label: t('sort.name_desc') },
    { value: 'rating_desc', label: t('sort.rating_desc') },
    { value: 'city_asc',    label: t('sort.city_asc') },
    { value: 'distance_asc', label: 'दूरी (नज़दीक पहले)' },
  ];

  const PER_PAGE = 12;

  // ── Get user location ──────────────────────────────────────────────
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('आपका browser location support नहीं करता।');
      return;
    }
    setLocLoading(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearbyMode(true);
        setLocLoading(false);
      },
      (err) => {
        setLocationError('Location access नहीं मिली। कृपया browser में location allow करें।');
        setLocLoading(false);
      },
      { timeout: 10000 }
    );
  };

  const disableNearby = () => {
    setNearbyMode(false);
    setUserLocation(null);
    setLocationError('');
  };

  // ── Fetch results ──────────────────────────────────────────────────
  const fetchResults = useCallback(async (resetPage = true) => {
    setLoading(true);
    const currentPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);
    try {
      let temples, count;

      if (nearbyMode && userLocation) {
        // ── Nearby / Radius search ──
        const res = await templeAPI.getNearby(
          userLocation.lat,
          userLocation.lng,
          radiusKm,
          100                    // limit — ज़्यादा लाओ, फिर client-side filter
        );
        temples = res.data || [];
        // Apply extra filters on top
        if (selectedSects.length  > 0) temples = temples.filter(t => selectedSects.includes(t.sect));
        if (selectedStates.length > 0) temples = temples.filter(t => selectedStates.includes(t.state));
        if (jyotirlinga)               temples = temples.filter(t => t.is_jyotirlinga);
        if (shaktipeeth)               temples = temples.filter(t => t.is_shaktipeeth);
        if (freeEntry)                 temples = temples.filter(t => t.entry_fee === 0 || t.entry_fee === null);
        // Sort — default nearby keeps distance_asc (already sorted by backend)
        if (sort === 'name_asc')    temples = [...temples].sort((a, b) => (a.name||'').localeCompare(b.name||''));
        if (sort === 'name_desc')   temples = [...temples].sort((a, b) => (b.name||'').localeCompare(a.name||''));
        if (sort === 'rating_desc') temples = [...temples].sort((a, b) => (b.average_rating||0) - (a.average_rating||0));
        if (sort === 'city_asc')    temples = [...temples].sort((a, b) => (a.city||'').localeCompare(b.city||''));
        // distance_asc → already in backend order, keep as-is
        count = temples.length;

      } else if (query.trim()) {
        const res = await templeAPI.search(query.trim());
        temples   = res.data || [];
        count     = temples.length;
      } else {
        const params = { per_page: 200 };
        if (selectedStates.length === 1) params.state = selectedStates[0];
        if (selectedSects.length  === 1) params.sect  = selectedSects[0];
        if (jyotirlinga) params.jyotirlinga = true;
        if (shaktipeeth) params.shaktipeeth = true;
        const res = await templeAPI.getAll(params);
        temples   = res.data.temples || [];
        count     = res.data.total   || 0;
      }

      if (!nearbyMode) {
        if (selectedSects.length  > 1) temples = temples.filter(t => selectedSects.includes(t.sect));
        if (selectedStates.length > 1) temples = temples.filter(t => selectedStates.includes(t.state));
        if (freeEntry)                 temples = temples.filter(t => t.entry_fee === 0 || t.entry_fee === null);
        temples = [...temples].sort((a, b) => {
          if (sort === 'name_asc')    return (a.name || '').localeCompare(b.name || '');
          if (sort === 'name_desc')   return (b.name || '').localeCompare(a.name || '');
          if (sort === 'rating_desc') return (b.average_rating || 0) - (a.average_rating || 0);
          if (sort === 'city_asc')    return (a.city || '').localeCompare(b.city || '');
          return 0;
        });
      }

      setTotal(temples.length);
      const start = (currentPage - 1) * PER_PAGE;
      setResults(temples.slice(start, start + PER_PAGE));
    } catch (err) {
      console.error(err);
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [query, selectedSects, selectedStates, jyotirlinga, shaktipeeth, freeEntry, sort, page, nearbyMode, userLocation, radiusKm]);

  useEffect(() => { fetchResults(true); }, [selectedSects, selectedStates, jyotirlinga, shaktipeeth, freeEntry, sort]);
  // Re-fetch when nearby params change
  useEffect(() => {
    if (nearbyMode && userLocation) fetchResults(true);
  }, [nearbyMode, userLocation, radiusKm]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchParams(query ? { q: query } : {});
    fetchResults(true);
  };

  const toggleItem = (list, setList, value) => {
    setList(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  const clearAllFilters = () => {
    setSelectedSects([]);
    setSelectedStates([]);
    setJyotirlinga(false);
    setShaktipeeth(false);
    setFreeEntry(false);
    setQuery('');
    setNearbyMode(false);
    setUserLocation(null);
    setRadiusKm(10);
    setLocationError('');
  };

  const hasFilters = selectedSects.length || selectedStates.length || jyotirlinga || shaktipeeth || freeEntry || query || nearbyMode;
  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="search-page">
      <Navbar />

      <div className="search-hero">
        <h1 className="search-hero-title">{t('search.title')}</h1>
        <p className="search-hero-sub">{t('search.subtitle')}</p>
        <form className="search-bar" onSubmit={handleSearch}>
          <input
            id="search-input"
            name="search-query"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('search.input_placeholder')}
            autoFocus
          />
          <button type="submit" className="btn-primary">
            <Search size={15} /> {t('search_btn')}
          </button>
        </form>
      </div>

      <div className="container">
        <div className="search-body">

          {/* ── Filters Sidebar ── */}
          <div className="search-filters">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span className="search-filter-title">
                <SlidersHorizontal size={16} style={{ display: 'inline', marginRight: 6, color: 'var(--saffron)' }} />
                {t('search.filters')}
              </span>
              {hasFilters && (
                <button onClick={clearAllFilters} style={{ fontSize: 12, color: 'var(--saffron)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <X size={12} /> {t('search.clear_all')}
                </button>
              )}
            </div>

            {/* ── NEARBY / RADIUS FILTER ── */}
            <div className="search-filter-group" style={{ background: nearbyMode ? 'rgba(var(--saffron-rgb, 218,96,0), 0.06)' : 'transparent', borderRadius: 10, padding: nearbyMode ? '12px' : '0', transition: 'all 0.3s ease', marginBottom: 4 }}>
              <span className="search-filter-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={14} style={{ color: 'var(--saffron)' }} />
                आस-पास के मंदिर खोजें
              </span>

              {!nearbyMode && !userLocation && (
                <button
                  onClick={getUserLocation}
                  disabled={locLoading}
                  style={{
                    marginTop: 10,
                    width: '100%',
                    padding: '9px 0',
                    background: 'linear-gradient(135deg, var(--saffron) 0%, var(--brown) 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontFamily: 'var(--font-display)',
                    cursor: locLoading ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    opacity: locLoading ? 0.7 : 1,
                    transition: 'opacity 0.2s',
                  }}
                >
                  <Navigation size={14} />
                  {locLoading ? 'Location ले रहे हैं…' : 'मेरी Location उपयोग करें'}
                </button>
              )}

              {locationError && (
                <p style={{ marginTop: 8, fontSize: 12, color: '#c0392b', lineHeight: 1.4 }}>
                  ⚠️ {locationError}
                </p>
              )}

              {nearbyMode && userLocation && (
                <div style={{ marginTop: 10 }}>
                  {/* Radius Slider */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-mid)', fontFamily: 'var(--font-display)' }}>
                      खोज दायरा (Radius)
                    </span>
                    <span style={{
                      background: 'var(--saffron)',
                      color: 'white',
                      borderRadius: 20,
                      padding: '2px 10px',
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      minWidth: 52,
                      textAlign: 'center',
                    }}>
                      {radiusKm} km
                    </span>
                  </div>

                  <input
                    type="range"
                    min={1}
                    max={100}
                    step={1}
                    value={radiusKm}
                    onChange={e => setRadiusKm(Number(e.target.value))}
                    style={{
                      width: '100%',
                      accentColor: 'var(--saffron)',
                      cursor: 'pointer',
                      height: 4,
                    }}
                  />

                  {/* Quick preset buttons */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {[5, 10, 25, 50].map(km => (
                      <button
                        key={km}
                        onClick={() => setRadiusKm(km)}
                        style={{
                          padding: '3px 10px',
                          fontSize: 11,
                          borderRadius: 20,
                          border: `1.5px solid ${radiusKm === km ? 'var(--saffron)' : 'var(--border)'}`,
                          background: radiusKm === km ? 'var(--saffron)' : 'transparent',
                          color: radiusKm === km ? 'white' : 'var(--text-mid)',
                          cursor: 'pointer',
                          fontFamily: 'var(--font-display)',
                          transition: 'all 0.15s',
                        }}
                      >
                        {km} km
                      </button>
                    ))}
                  </div>

                  <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ color: '#27ae60' }}>✓</span>
                    Location मिली — {radiusKm} km के अंदर खोज रहे हैं
                  </div>

                  <button
                    onClick={disableNearby}
                    style={{ marginTop: 8, fontSize: 11, color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                  >
                    × Nearby mode बंद करें
                  </button>
                </div>
              )}
            </div>
            {/* ── END NEARBY FILTER ── */}

            <div className="search-filter-group">
              <span className="search-filter-label">{t('search.special_categories')}</span>
              <label className="search-filter-option">
                <input type="checkbox" checked={jyotirlinga} onChange={e => setJyotirlinga(e.target.checked)} />
                ⚡ {t('search.jyotirlinga_filter')}
              </label>
              <label className="search-filter-option">
                <input type="checkbox" checked={shaktipeeth} onChange={e => setShaktipeeth(e.target.checked)} />
                🌸 {t('search.shaktipeeth_filter')}
              </label>
              <label className="search-filter-option">
                <input type="checkbox" checked={freeEntry} onChange={e => setFreeEntry(e.target.checked)} />
                ✅ {t('search.free_entry')}
              </label>
            </div>

            <div className="search-filter-group">
              <span className="search-filter-label">{t('search.sect')}</span>
              <div className="search-filter-options">
                {SECTS.map(s => (
                  <label key={s} className="search-filter-option">
                    <input type="checkbox" checked={selectedSects.includes(s)} onChange={() => toggleItem(selectedSects, setSelectedSects, s)} />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            <div className="search-filter-group">
              <span className="search-filter-label">{t('search.state')}</span>
              <div className="search-filter-options" style={{ maxHeight: 200, overflowY: 'auto' }}>
                {STATES.map(s => (
                  <label key={s} className="search-filter-option">
                    <input type="checkbox" checked={selectedStates.includes(s)} onChange={() => toggleItem(selectedStates, setSelectedStates, s)} />
                    {s}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* ── Results ── */}
          <div className="search-results">
            <div className="search-results-header">
              <div>
                {loading
                  ? <span style={{ color: 'var(--text-light)', fontSize: 14 }}>{t('search.searching')}</span>
                  : <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--brown)' }}>
                      {nearbyMode && userLocation
                        ? <><MapPin size={14} style={{ display: 'inline', marginRight: 4, color: 'var(--saffron)' }} />{total} मंदिर {radiusKm} km के अंदर</>
                        : <>{total} {total !== 1 ? t('temples_count_plural') : t('temples_count_singular')} {t('search.found')}</>
                      }
                    </span>
                }
              </div>
              <select className="search-sort" value={sort} onChange={e => setSort(e.target.value)}>
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Active filter chips */}
            {(selectedSects.length > 0 || selectedStates.length > 0 || nearbyMode) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {nearbyMode && (
                  <span style={{ background: '#27ae60', color: 'white', padding: '3px 12px', borderRadius: 50, fontSize: 12, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={disableNearby}>
                    📍 {radiusKm} km <X size={10} />
                  </span>
                )}
                {selectedSects.map(s => (
                  <span key={s} style={{ background: 'var(--saffron)', color: 'white', padding: '3px 12px', borderRadius: 50, fontSize: 12, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => toggleItem(selectedSects, setSelectedSects, s)}>
                    {s} <X size={10} />
                  </span>
                ))}
                {selectedStates.map(s => (
                  <span key={s} style={{ background: 'var(--brown)', color: 'white', padding: '3px 12px', borderRadius: 50, fontSize: 12, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={() => toggleItem(selectedStates, setSelectedStates, s)}>
                    {s} <X size={10} />
                  </span>
                ))}
              </div>
            )}

            {loading && (
              <div className="loading-wrap" style={{ minHeight: 200 }}>
                <div className="spinner" />
                <span className="loading-text">{nearbyMode ? 'आस-पास के मंदिर खोज रहे हैं…' : t('search.searching')}</span>
              </div>
            )}

            {translating && (
              <div style={{ textAlign: 'center', color: 'var(--saffron)', fontSize: 13, fontFamily: 'var(--font-hindi)', marginBottom: 12 }}>
                {t('loading')}
              </div>
            )}

            {!loading && displayResults.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">{nearbyMode ? '📍' : '🔍'}</div>
                <div className="empty-title">
                  {nearbyMode
                    ? `${radiusKm} km के अंदर कोई मंदिर नहीं मिला`
                    : t('no_temples')
                  }
                </div>
                <p className="empty-msg">
                  {nearbyMode
                    ? 'Radius बढ़ाएं या दूसरे फ़िल्टर हटाएं।'
                    : t('search.empty_msg')
                  }
                </p>
                <button className="btn-primary" style={{ marginTop: 16 }} onClick={nearbyMode ? () => setRadiusKm(prev => Math.min(prev + 20, 100)) : clearAllFilters}>
                  {nearbyMode ? 'Radius बढ़ाएं' : t('search.clear_filters')}
                </button>
              </div>
            )}

            {!loading && displayResults.length > 0 && (
              <div className="search-result-grid">
                {displayResults.map((temple, i) => (
                  <TempleCard key={temple.id || i} temple={temple} />
                ))}
              </div>
            )}

            {!loading && totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 40 }}>
                <button className="btn-outline" style={{ padding: '8px 20px', fontSize: 13 }} disabled={page === 1} onClick={() => { setPage(p => p - 1); fetchResults(false); }}>
                  {t('pagination.prev')}
                </button>
                <span style={{ display: 'flex', alignItems: 'center', fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--text-mid)', padding: '0 16px' }}>
                  {t('pagination.page_of', { page, total: totalPages })}
                </span>
                <button className="btn-outline" style={{ padding: '8px 20px', fontSize: 13 }} disabled={page === totalPages} onClick={() => { setPage(p => p + 1); fetchResults(false); }}>
                  {t('pagination.next')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}