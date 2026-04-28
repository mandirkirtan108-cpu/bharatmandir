import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import TempleCard from '../components/TempleCard';
import Footer from '../components/Footer';
import { templeAPI } from '../services/api';
import { useTranslatedTemples } from '../hooks/useTranslatedData';

const SECTS  = ['Shaiva', 'Vaishnav', 'Shakta', 'Smarta', 'Ganapatya'];
const STATES = ['Madhya Pradesh', 'Uttar Pradesh', 'Maharashtra', 'Tamil Nadu', 'Gujarat', 'Karnataka', 'Rajasthan', 'Bihar', 'Odisha', 'Andhra Pradesh', 'Telangana', 'Kerala', 'West Bengal'];
const TYPES  = ['Jyotirlinga', 'Shaktipeeth', 'Divya Desam', 'Char Dham', 'Regional Famous', 'Heritage', 'Cave Temple', 'Historical Ashram', 'Sacred Ghat', 'Astronomical'];

export default function SearchPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const SORT_OPTIONS = [
    { value: 'name_asc',    label: t('sort.name_asc') },
    { value: 'name_desc',   label: t('sort.name_desc') },
    { value: 'rating_desc', label: t('sort.rating_desc') },
    { value: 'city_asc',    label: t('sort.city_asc') },
  ];

  const [query,      setQuery]      = useState(searchParams.get('q') || '');
  const [results,    setResults]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [sort,       setSort]       = useState('name_asc');
  const [showFilter, setShowFilter] = useState(true);

  const [selectedSects,  setSelectedSects]  = useState([]);
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedTypes,  setSelectedTypes]  = useState([]);
  const [jyotirlinga,    setJyotirlinga]    = useState(false);
  const [shaktipeeth,    setShaktipeeth]    = useState(false);
  const [freeEntry,      setFreeEntry]      = useState(false);

  const { translated: displayResults, translating } = useTranslatedTemples(results);

  const PER_PAGE = 12;

  const fetchResults = useCallback(async (resetPage = true) => {
    setLoading(true);
    const currentPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);
    try {
      let temples, count;
      if (query.trim()) {
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
  }, [query, selectedSects, selectedStates, selectedTypes, jyotirlinga, shaktipeeth, freeEntry, sort, page]);

  useEffect(() => { fetchResults(true); }, [selectedSects, selectedStates, jyotirlinga, shaktipeeth, freeEntry, sort]);

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
    setSelectedTypes([]);
    setJyotirlinga(false);
    setShaktipeeth(false);
    setFreeEntry(false);
    setQuery('');
  };

  const hasFilters = selectedSects.length || selectedStates.length || jyotirlinga || shaktipeeth || freeEntry || query;
  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <div className="search-page">
      <Navbar />

      {/* ── Search Hero ── */}
      <div className="search-hero">
        <h1 className="search-hero-title">{t('search.title')}</h1>
        <p className="search-hero-sub">{t('search.subtitle')}</p>
        <form className="search-bar" onSubmit={handleSearch}>
          <input
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

      {/* ── Body ── */}
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
                <button
                  onClick={clearAllFilters}
                  style={{ fontSize: 12, color: 'var(--saffron)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <X size={12} /> {t('search.clear_all')}
                </button>
              )}
            </div>

            {/* Special Categories */}
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

            {/* Sect */}
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

            {/* State */}
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
                      {total} {total !== 1 ? t('temples_count_plural') : t('temples_count_singular')} {t('search.found')}
                    </span>
                }
              </div>
              <select className="search-sort" value={sort} onChange={e => setSort(e.target.value)}>
                {SORT_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Active filter tags */}
            {(selectedSects.length > 0 || selectedStates.length > 0) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
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
                <span className="loading-text">{t('search.searching')}</span>
              </div>
            )}

            {translating && (
              <div style={{ textAlign: 'center', color: 'var(--saffron)', fontSize: 13, fontFamily: 'var(--font-hindi)', marginBottom: 12 }}>
                अनुवाद हो रहा है...
              </div>
            )}

            {!loading && displayResults.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <div className="empty-title">{t('no_temples')}</div>
                <p className="empty-msg">{t('search.empty_msg')}</p>
                <button className="btn-primary" style={{ marginTop: 16 }} onClick={clearAllFilters}>{t('search.clear_filters')}</button>
              </div>
            )}

            {!loading && displayResults.length > 0 && (
              <div className="search-result-grid">
                {displayResults.map((temple, i) => (
                  <TempleCard key={temple.id || i} temple={temple} />
                ))}
              </div>
            )}

            {/* Pagination */}
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