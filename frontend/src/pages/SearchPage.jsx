import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import Navbar from '../components/Navbar';
import TempleCard from '../components/TempleCard';
import Footer from '../components/Footer';
import { templeAPI } from '../services/api';

const SECTS    = ['Shaiva', 'Vaishnav', 'Shakta', 'Smarta', 'Ganapatya'];
const STATES   = ['Madhya Pradesh', 'Uttar Pradesh', 'Maharashtra', 'Tamil Nadu', 'Gujarat', 'Karnataka', 'Rajasthan', 'Bihar', 'Odisha', 'Andhra Pradesh', 'Telangana', 'Kerala', 'West Bengal'];
const TYPES    = ['Jyotirlinga', 'Shaktipeeth', 'Divya Desam', 'Char Dham', 'Regional Famous', 'Heritage', 'Cave Temple', 'Historical Ashram', 'Sacred Ghat', 'Astronomical'];
const SORT_OPTIONS = [
  { value: 'name_asc',    label: 'Name (A → Z)' },
  { value: 'name_desc',   label: 'Name (Z → A)' },
  { value: 'rating_desc', label: 'Highest Rated' },
  { value: 'city_asc',    label: 'City (A → Z)' },
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [query,      setQuery]      = useState(searchParams.get('q') || '');
  const [results,    setResults]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [sort,       setSort]       = useState('name_asc');
  const [showFilter, setShowFilter] = useState(true);

  // Filters
  const [selectedSects,  setSelectedSects]  = useState([]);
  const [selectedStates, setSelectedStates] = useState([]);
  const [selectedTypes,  setSelectedTypes]  = useState([]);
  const [jyotirlinga,    setJyotirlinga]    = useState(false);
  const [shaktipeeth,    setShaktipeeth]    = useState(false);
  const [freeEntry,      setFreeEntry]      = useState(false);

  const PER_PAGE = 12;

  const fetchResults = useCallback(async (resetPage = true) => {
    setLoading(true);
    const currentPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);

    try {
      let temples, count;

      if (query.trim()) {
        // Full text search
        const res = await templeAPI.search(query.trim());
        temples   = res.data || [];
        count     = temples.length;
      } else {
        // Filtered browse
        const params = { per_page: 200 }; // get all then sort client side
        if (selectedStates.length === 1) params.state = selectedStates[0];
        if (selectedSects.length  === 1) params.sect  = selectedSects[0];
        if (jyotirlinga) params.jyotirlinga = true;
        if (shaktipeeth) params.shaktipeeth = true;

        const res = await templeAPI.getAll(params);
        temples   = res.data.temples || [];
        count     = res.data.total   || 0;
      }

      // Client-side additional filtering
      if (selectedSects.length  > 1) temples = temples.filter(t => selectedSects.includes(t.sect));
      if (selectedStates.length > 1) temples = temples.filter(t => selectedStates.includes(t.state));
      if (freeEntry)                 temples = temples.filter(t => t.entry_fee === 0 || t.entry_fee === null);

      // Sort
      temples = [...temples].sort((a, b) => {
        if (sort === 'name_asc')    return (a.name || '').localeCompare(b.name || '');
        if (sort === 'name_desc')   return (b.name || '').localeCompare(a.name || '');
        if (sort === 'rating_desc') return (b.average_rating || 0) - (a.average_rating || 0);
        if (sort === 'city_asc')    return (a.city || '').localeCompare(b.city || '');
        return 0;
      });

      setTotal(temples.length);
      // Paginate
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
        <h1 className="search-hero-title">🔍 Find Your Temple</h1>
        <p className="search-hero-sub">Search by name, deity, city, or use filters to discover sacred temples</p>
        <form className="search-bar" onSubmit={handleSearch}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type temple name, deity, city..."
            autoFocus
          />
          <button type="submit" className="btn-primary">
            <Search size={15} /> Search
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
                Filters
              </span>
              {hasFilters && (
                <button
                  onClick={clearAllFilters}
                  style={{ fontSize: 12, color: 'var(--saffron)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <X size={12} /> Clear All
                </button>
              )}
            </div>

            {/* Special Types */}
            <div className="search-filter-group">
              <span className="search-filter-label">Special Categories</span>
              <label className="search-filter-option">
                <input type="checkbox" checked={jyotirlinga} onChange={e => setJyotirlinga(e.target.checked)} />
                ⚡ Jyotirlinga (12)
              </label>
              <label className="search-filter-option">
                <input type="checkbox" checked={shaktipeeth} onChange={e => setShaktipeeth(e.target.checked)} />
                🌸 Shaktipeeth (51)
              </label>
              <label className="search-filter-option">
                <input type="checkbox" checked={freeEntry} onChange={e => setFreeEntry(e.target.checked)} />
                ✅ Free Entry
              </label>
            </div>

            {/* Sect */}
            <div className="search-filter-group">
              <span className="search-filter-label">Sect / Tradition</span>
              <div className="search-filter-options">
                {SECTS.map(s => (
                  <label key={s} className="search-filter-option">
                    <input
                      type="checkbox"
                      checked={selectedSects.includes(s)}
                      onChange={() => toggleItem(selectedSects, setSelectedSects, s)}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </div>

            {/* State */}
            <div className="search-filter-group">
              <span className="search-filter-label">State</span>
              <div className="search-filter-options" style={{ maxHeight: 200, overflowY: 'auto' }}>
                {STATES.map(s => (
                  <label key={s} className="search-filter-option">
                    <input
                      type="checkbox"
                      checked={selectedStates.includes(s)}
                      onChange={() => toggleItem(selectedStates, setSelectedStates, s)}
                    />
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
                  ? <span style={{ color: 'var(--text-light)', fontSize: 14 }}>Searching...</span>
                  : <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--brown)' }}>
                      {total} temple{total !== 1 ? 's' : ''} found
                    </span>
                }
              </div>
              <select
                className="search-sort"
                value={sort}
                onChange={e => setSort(e.target.value)}
              >
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

            {/* Loading */}
            {loading && (
              <div className="loading-wrap" style={{ minHeight: 200 }}>
                <div className="spinner" />
                <span className="loading-text">Searching temples...</span>
              </div>
            )}

            {/* Empty */}
            {!loading && results.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <div className="empty-title">No temples found</div>
                <p className="empty-msg">Try different keywords or clear some filters</p>
                <button className="btn-primary" style={{ marginTop: 16 }} onClick={clearAllFilters}>Clear Filters</button>
              </div>
            )}

            {/* Grid */}
            {!loading && results.length > 0 && (
              <div className="search-result-grid">
                {results.map((temple, i) => (
                  <TempleCard key={temple.id || i} temple={temple} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 40 }}>
                <button
                  className="btn-outline"
                  style={{ padding: '8px 20px', fontSize: 13 }}
                  disabled={page === 1}
                  onClick={() => { setPage(p => p - 1); fetchResults(false); }}
                >
                  ← Previous
                </button>
                <span style={{ display: 'flex', alignItems: 'center', fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--text-mid)', padding: '0 16px' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn-outline"
                  style={{ padding: '8px 20px', fontSize: 13 }}
                  disabled={page === totalPages}
                  onClick={() => { setPage(p => p + 1); fetchResults(false); }}
                >
                  Next →
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