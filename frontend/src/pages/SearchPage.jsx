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

  const [nearbyMode,     setNearbyMode]     = useState(false);
  const [radiusKm,       setRadiusKm]       = useState(10);
  const [userLocation,   setUserLocation]   = useState(null);
  const [locationError,  setLocationError]  = useState('');
  const [locLoading,     setLocLoading]     = useState(false);

  const { translated: displayResults, translating } = useTranslatedTemples(results);

  const SORT_OPTIONS = [
    { value: 'name_asc',     label: t('sort.name_asc') },
    { value: 'name_desc',    label: t('sort.name_desc') },
    { value: 'rating_desc',  label: t('sort.rating_desc') },
    { value: 'city_asc',     label: t('sort.city_asc') },
    { value: 'distance_asc', label: 'Nearest First' },
  ];

  const PER_PAGE = 12;

  const getUserLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Your browser does not support location access.');
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
      () => {
        setLocationError('Location access denied. Please allow location in your browser and try again.');
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

  const fetchResults = useCallback(async (resetPage = true) => {
    setLoading(true);
    const currentPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);
    try {
      let temples, count;

      if (nearbyMode && userLocation) {
        const res = await templeAPI.getNearby(userLocation.lat, userLocation.lng, radiusKm, 100);
        temples = res.data || [];
        if (selectedSects.length  > 0) temples = temples.filter(t => selectedSects.includes(t.sect));
        if (selectedStates.length > 0) temples = temples.filter(t => selectedStates.includes(t.state));
        if (jyotirlinga || shaktipeeth) temples = temples.filter(t =>
          (jyotirlinga && t.is_jyotirlinga) || (shaktipeeth && t.is_shaktipeeth)
        );
        if (freeEntry) temples = temples.filter(t => t.entry_fee === 0 || t.entry_fee === null);
        if (sort === 'name_asc')    temples = [...temples].sort((a, b) => (a.name||'').localeCompare(b.name||''));
        if (sort === 'name_desc')   temples = [...temples].sort((a, b) => (b.name||'').localeCompare(a.name||''));
        if (sort === 'rating_desc') temples = [...temples].sort((a, b) => (b.average_rating||0) - (a.average_rating||0));
        if (sort === 'city_asc')    temples = [...temples].sort((a, b) => (a.city||'').localeCompare(b.city||''));
        count = temples.length;
      } else if (query.trim()) {
        const res = await templeAPI.search(query.trim());
        temples   = res.data || [];
        count     = temples.length;
      } else {
        const fetchAll = async (extraParams = {}) => {
          let all = [], pg = 1;
          while (true) {
            const res = await templeAPI.getAll({ per_page: 100, page: pg, ...extraParams });
            const batch = res.data.temples || [];
            all = [...all, ...batch];
            if (all.length >= (res.data.total || 0) || batch.length < 100) break;
            pg++;
          }
          return all;
        };

        if (jyotirlinga && shaktipeeth) {
          const [t1, t2] = await Promise.all([
            fetchAll({ jyotirlinga: true }),
            fetchAll({ shaktipeeth: true }),
          ]);
          const seen = new Set();
          temples = [...t1, ...t2].filter(t => {
            if (seen.has(t.id)) return false;
            seen.add(t.id); return true;
          });
        } else if (jyotirlinga) {
          temples = await fetchAll({ jyotirlinga: true });
        } else if (shaktipeeth) {
          temples = await fetchAll({ shaktipeeth: true });
        } else {
          temples = await fetchAll();
        }

        if (selectedStates.length > 0) temples = temples.filter(t => selectedStates.includes(t.state));
        if (selectedSects.length  > 0) temples = temples.filter(t => selectedSects.includes(t.sect));
        if (freeEntry) temples = temples.filter(t => t.entry_fee === 0 || t.entry_fee === null);
        count = temples.length;
      }

      if (!nearbyMode) {
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

  const hasFilters = selectedSects.length || selectedStates.length || query || nearbyMode;
  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="search-page">
      <Navbar />

      {/* ══════════════ HERO ══════════════ */}
      <section style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
        padding: '50px 12px',
        textAlign: 'center',
        color: 'white',
      }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto' }}>

          {/* Badge pill — matches Panchang */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,213,128,0.35)',
            borderRadius: 50, padding: '6px 20px', marginBottom: 22,
            color: '#FFD580', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
            fontWeight: 600, fontFamily: 'var(--font-display)',
          }}>
            🛕 {t(' ') || 'Temple Discovery'}
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(34px, 5.5vw, 66px)',
            lineHeight: 1.08,
            marginBottom: 16,
            color: '#FFD580',
          }}>
            Find Your Temple
          </h1>

          <p style={{
            color: 'rgba(255,255,255,0.78)',
            fontSize: 17, maxWidth: 500,
            margin: '0 auto 36px',
            lineHeight: 1.7,
          }}>
            Search by name, deity, city, or use filters to discover sacred temples
          </p>

          {/* Search bar */}
          <form
            onSubmit={handleSearch}
            style={{
              display: 'flex',
              maxWidth: 640,
              margin: '0 auto',
              background: 'rgba(255,255,255,0.97)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,213,128,0.25)',
            }}
          >
            <input
              id="search-input"
              name="search-query"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('search.input_placeholder') || 'Type temple name, deity, city…'}
              autoFocus
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                padding: '18px 20px',
                fontSize: 16,
                fontFamily: 'var(--font-body)',
                color: '#1A0A00',
                background: 'transparent',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '18px 28px',
                background: 'linear-gradient(135deg, #E8650A 0%, #B84D00 100%)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: 15,
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                letterSpacing: '.04em',
                whiteSpace: 'nowrap',
                transition: 'opacity .2s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Search size={16} />
              {t('search_btn') || 'Search'}
            </button>
          </form>

         
          
        </div>
      </section>
      {/* ════════════════════════════════════ */}

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

            {/* ── Nearby / Radius Filter ── */}
            <div style={{
              border: nearbyMode ? '2px solid var(--saffron)' : '2px dashed var(--border)',
              borderRadius: 12,
              padding: 14,
              marginBottom: 20,
              background: nearbyMode ? 'rgba(218,96,0,0.05)' : 'transparent',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: nearbyMode ? 'var(--saffron)' : 'var(--bg-alt, #f5f0e8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'background 0.3s',
                }}>
                  <MapPin size={16} style={{ color: nearbyMode ? 'white' : 'var(--saffron)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--brown)', fontFamily: 'var(--font-display)', lineHeight: 1.2 }}>
                    Search Nearby Temples
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-light)', marginTop: 1 }}>
                    Find temples within a radius
                  </div>
                </div>
              </div>

              {!userLocation && (
                <button
                  onClick={getUserLocation}
                  disabled={locLoading}
                  style={{
                    width: '100%',
                    padding: '10px 0',
                    background: locLoading
                      ? 'var(--border)'
                      : 'linear-gradient(135deg, var(--saffron) 0%, var(--brown) 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'var(--font-display)',
                    cursor: locLoading ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 7,
                    transition: 'opacity 0.2s',
                    letterSpacing: '0.3px',
                  }}
                >
                  <Navigation size={15} />
                  {locLoading ? 'Getting your location…' : 'Use My Location'}
                </button>
              )}

              {locationError && (
                <p style={{ marginTop: 8, fontSize: 12, color: '#c0392b', lineHeight: 1.5, background: '#fdecea', padding: '6px 10px', borderRadius: 6 }}>
                  ⚠️ {locationError}
                </p>
              )}

              {nearbyMode && userLocation && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, padding: '5px 10px', background: '#eafaf1', borderRadius: 20, width: 'fit-content' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#27ae60', display: 'inline-block' }} />
                    <span style={{ fontSize: 11, color: '#27ae60', fontWeight: 600 }}>Location detected</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brown)', fontFamily: 'var(--font-display)' }}>
                      Search Radius
                    </span>
                    <span style={{
                      background: 'var(--saffron)', color: 'white',
                      borderRadius: 20, padding: '3px 12px',
                      fontSize: 13, fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                      minWidth: 58, textAlign: 'center',
                      boxShadow: '0 2px 6px rgba(218,96,0,0.3)',
                    }}>
                      {radiusKm} km
                    </span>
                  </div>

                  <input
                    type="range" min={1} max={100} step={1} value={radiusKm}
                    onChange={e => setRadiusKm(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--saffron)', cursor: 'pointer', height: 4, marginBottom: 10 }}
                  />

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-light)', marginBottom: 10, marginTop: -6 }}>
                    <span>1 km</span><span>50 km</span><span>100 km</span>
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {[5, 10, 25, 50].map(km => (
                      <button key={km} onClick={() => setRadiusKm(km)} style={{
                        padding: '4px 12px', fontSize: 12,
                        fontWeight: radiusKm === km ? 700 : 400,
                        borderRadius: 20,
                        border: `1.5px solid ${radiusKm === km ? 'var(--saffron)' : 'var(--border)'}`,
                        background: radiusKm === km ? 'var(--saffron)' : 'white',
                        color: radiusKm === km ? 'white' : 'var(--text-mid)',
                        cursor: 'pointer', fontFamily: 'var(--font-display)', transition: 'all 0.15s',
                        boxShadow: radiusKm === km ? '0 2px 6px rgba(218,96,0,0.25)' : 'none',
                      }}>
                        {km} km
                      </button>
                    ))}
                  </div>

                  <button onClick={disableNearby} style={{
                    width: '100%', padding: '7px 0', fontSize: 12,
                    color: '#c0392b', background: '#fdecea',
                    border: '1px solid #f5c6c6', borderRadius: 7,
                    cursor: 'pointer', fontFamily: 'var(--font-display)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}>
                    <X size={12} /> Disable Nearby Search
                  </button>
                </div>
              )}
            </div>

            {/* Special Categories section removed */}

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
                        ? <><MapPin size={14} style={{ display: 'inline', marginRight: 4, color: 'var(--saffron)' }} />
                            {total} {total !== 1 ? 'temples' : 'temple'} within {radiusKm} km</>
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

            {(selectedSects.length > 0 || selectedStates.length > 0 || nearbyMode) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                {nearbyMode && (
                  <span style={{ background: '#27ae60', color: 'white', padding: '3px 12px', borderRadius: 50, fontSize: 12, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }} onClick={disableNearby}>
                    📍 Within {radiusKm} km <X size={10} />
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
                <span className="loading-text">
                  {nearbyMode ? 'Searching nearby temples…' : t('search.searching')}
                </span>
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
                    ? `No temples found within ${radiusKm} km`
                    : t('no_temples')
                  }
                </div>
                <p className="empty-msg">
                  {nearbyMode
                    ? 'Try increasing the radius or removing other filters.'
                    : t('search.empty_msg')
                  }
                </p>
                <button className="btn-primary" style={{ marginTop: 16 }}
                  onClick={nearbyMode ? () => setRadiusKm(prev => Math.min(prev + 20, 100)) : clearAllFilters}>
                  {nearbyMode ? 'Increase Radius' : t('search.clear_filters')}
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