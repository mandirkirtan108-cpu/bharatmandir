import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import Navbar from '../components/Navbar';
import TempleCard from '../components/TempleCard';
import Footer from '../components/Footer';
import { templeAPI } from '../services/api';

const DEITY_FILTERS = [
  { label: 'All Temples',    value: '' },
  { label: '🔱 Shiva',       value: 'Lord Shiva' },
  { label: '🪷 Vishnu',      value: 'Lord Vishnu' },
  { label: '🏹 Ram',         value: 'Lord Ram' },
  { label: '🎵 Krishna',     value: 'Lord Krishna' },
  { label: '⚔️ Durga/Shakti',value: 'Goddess' },
  { label: '🐘 Ganesha',     value: 'Lord Ganesha' },
  { label: '⭐ Jyotirlinga', value: 'jyotirlinga' },
  { label: '🌸 Shaktipeeth', value: 'shaktipeeth' },
];

const STATES = [
  'All States',
  'Madhya Pradesh',
  'Uttar Pradesh',
  'Maharashtra',
  'Tamil Nadu',
  'Gujarat',
  'Karnataka',
  'Rajasthan',
];

export default function HomePage() {
  const [searchParams]  = useSearchParams();
  const [temples,   setTemples]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [total,     setTotal]     = useState(0);
  const [activeFilter,  setActiveFilter]  = useState('');
  const [activeState,   setActiveState]   = useState('All States');
  const [searchQuery,   setSearchQuery]   = useState(searchParams.get('search') || '');
  const [totalTemples,  setTotalTemples]  = useState(0);

  // Load health stats once
  useEffect(() => {
    templeAPI.health()
      .then(res => setTotalTemples(res.data.total_temples || 0))
      .catch(() => {});
  }, []);

  // Load temples whenever filter/search changes
  useEffect(() => {
    const fetchTemples = async () => {
      setLoading(true);
      setError(null);
      try {
        let temples, count;

        if (searchQuery) {
          const res = await templeAPI.search(searchQuery);
          temples   = res.data;
          count     = res.data.length;
        } else {
          const params = { per_page: 50 };
          if (activeFilter === 'jyotirlinga')  params.jyotirlinga = true;
          else if (activeFilter === 'shaktipeeth') params.shaktipeeth = true;
          else if (activeFilter) params.deity = activeFilter;
          if (activeState !== 'All States') params.state = activeState;

          const res = await templeAPI.getAll(params);
          temples   = res.data.temples;
          count     = res.data.total;
        }

        setTemples(temples || []);
        setTotal(count || 0);
      } catch (err) {
        console.error('Failed to fetch temples:', err);
        setError('Could not connect to backend. Make sure FastAPI is running on port 8000.');
      } finally {
        setLoading(false);
      }
    };

    fetchTemples();
  }, [activeFilter, activeState, searchQuery]);

  const handleFilterClick = (value) => {
    setActiveFilter(value);
    setSearchQuery('');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const q = e.target.elements.search.value.trim();
    setSearchQuery(q);
    setActiveFilter('');
    setActiveState('All States');
  };

  return (
    <div>
      <Navbar />

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-om">OM</div>
        <div className="hero-inner">
          <div className="hero-badge">🔱 Sacred Temples of India</div>
          <h1 className="hero-title">
            Discover the Divine<br />
            <span>Temples of Bharat</span>
          </h1>
          <p className="hero-subtitle">
            A platform to connect every devotee with the sacred temples
            across every corner of India — with history, mantras, and directions.
          </p>
          <div className="hero-actions">
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10 }}>
              <input
                name="search"
                defaultValue={searchQuery}
                placeholder="Search by temple, deity, or city..."
                style={{
                  padding: '12px 20px', borderRadius: '50px', border: 'none',
                  width: 300, fontSize: 15, fontFamily: 'var(--font-body)',
                  outline: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}
              />
              <button type="submit" className="btn-primary">
                <Search size={15} /> Search
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Stats Bar ── */}
      <div className="stats-bar">
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-number">{totalTemples || '10+'}</span>
            <span className="stat-label">Temples Listed</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">28</span>
            <span className="stat-label">States Covered</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">12</span>
            <span className="stat-label">Jyotirlingas</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">51</span>
            <span className="stat-label">Shaktipeeths</span>
          </div>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="filters-bar">
        <div className="container">
          <div className="filters-inner">
            {DEITY_FILTERS.map((f) => (
              <button
                key={f.value}
                className={`filter-chip ${activeFilter === f.value && !searchQuery ? 'active' : ''}`}
                onClick={() => handleFilterClick(f.value)}
              >
                {f.label}
              </button>
            ))}
            <div style={{ width: 1, height: 24, background: 'var(--cream-dark)', margin: '0 4px' }} />
            {STATES.map((s) => (
              <button
                key={s}
                className={`filter-chip ${activeState === s && !searchQuery ? 'active' : ''}`}
                onClick={() => { setActiveState(s); setSearchQuery(''); }}
              >
                {s === 'All States' ? '🗺️ All States' : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Temple Grid ── */}
      <section className="temples-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">
              {searchQuery
                ? `Results for "${searchQuery}"`
                : activeFilter
                  ? `Filtered Temples`
                  : 'All Sacred Temples'}
            </h2>
            {!loading && (
              <span className="section-count">{total} temple{total !== 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="loading-wrap">
              <div className="spinner" />
              <span className="loading-text">Loading temples...</span>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="error-wrap">
              <div className="error-icon">⚠️</div>
              <div className="error-title">Could not load temples</div>
              <div className="error-msg">{error}</div>
              <button
                className="btn-primary"
                style={{ marginTop: 16 }}
                onClick={() => window.location.reload()}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && temples.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <div className="empty-title">No temples found</div>
              <p className="empty-msg">Try a different search or filter</p>
            </div>
          )}

          {/* Grid */}
          {!loading && !error && temples.length > 0 && (
            <div className="temples-grid">
              {temples.map((temple, i) => (
                <TempleCard
                  key={temple.id || i}
                  temple={temple}
                  style={{ animationDelay: `${i * 0.05}s` }}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}