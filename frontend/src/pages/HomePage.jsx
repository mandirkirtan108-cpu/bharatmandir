import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import TempleCard from '../components/TempleCard';
import Footer from '../components/Footer';
import { templeAPI } from '../services/api';
import { useTranslatedTemples } from '../hooks/useTranslatedData';

export default function HomePage() {
  const { t } = useTranslation();
  const [searchParams]  = useSearchParams();
  const [temples,       setTemples]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [total,         setTotal]         = useState(0);
  const [activeFilter,  setActiveFilter]  = useState('');
  const [activeState,   setActiveState]   = useState('All States');
  const [searchQuery,   setSearchQuery]   = useState(searchParams.get('search') || '');
  const [totalTemples,  setTotalTemples]  = useState(0);
  const { translated: displayTemples, translating } = useTranslatedTemples(temples);

  const DEITY_FILTERS = [
    { label: t('filter.all'),          value: '' },
    { label: '🔱 Shiva',               value: 'Lord Shiva' },
    { label: '🪷 Vishnu',              value: 'Lord Vishnu' },
    { label: '🏹 Ram',                 value: 'Lord Ram' },
    { label: '🎵 Krishna',             value: 'Lord Krishna' },
    { label: '⚔️ Durga/Shakti',        value: 'Goddess' },
    { label: '🐘 Ganesha',             value: 'Lord Ganesha' },
    { label: '⭐ ' + t('filter.jyotirlinga'), value: 'jyotirlinga' },
    { label: '🌸 ' + t('filter.shaktipeeth'), value: 'shaktipeeth' },
  ];

  const STATES = [
    t('filter.all_states_raw'),
    'Madhya Pradesh', 'Uttar Pradesh', 'Maharashtra',
    'Tamil Nadu', 'Gujarat', 'Karnataka', 'Rajasthan',
  ];

  useEffect(() => {
    templeAPI.health()
      .then(res => setTotalTemples(res.data.total_temples || 0))
      .catch(() => {});
  }, []);

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
          if (activeFilter === 'jyotirlinga')      params.jyotirlinga = true;
          else if (activeFilter === 'shaktipeeth') params.shaktipeeth = true;
          else if (activeFilter)                   params.deity = activeFilter;
          if (activeState !== t('filter.all_states_raw')) params.state = activeState;

          const res = await templeAPI.getAll(params);
          temples   = res.data.temples;
          count     = res.data.total;
        }
        setTemples(temples || []);
        setTotal(count || 0);
      } catch (err) {
        console.error('Failed to fetch temples:', err);
        setError(t('error.backend'));
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
    setActiveState(t('filter.all_states_raw'));
  };

  return (
    <div>
      <Navbar />

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-om">OM</div>
        <div className="hero-inner">
          <div className="hero-badge">{t('hero_badge')}</div>
          <h1 className="hero-title">
            {t('hero_title')}<br />
            <span>{t('hero_subtitle')}</span>
          </h1>
          <p className="hero-subtitle">{t('hero_desc')}</p>
          <div className="hero-actions">
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10 }}>
              <input
                name="search"
                defaultValue={searchQuery}
                placeholder={t('hero_search_placeholder')}
                style={{
                  padding: '12px 20px', borderRadius: '50px', border: 'none',
                  width: 300, fontSize: 15, fontFamily: 'var(--font-body)',
                  outline: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                }}
              />
              <button type="submit" className="btn-primary">
                <Search size={15} /> {t('search_btn')}
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
            <span className="stat-label">{t('stats.temples')}</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">28</span>
            <span className="stat-label">{t('stats.states')}</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">12</span>
            <span className="stat-label">{t('stats.jyotirlinga')}</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">51</span>
            <span className="stat-label">{t('stats.shaktipeeth')}</span>
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
                {s === t('filter.all_states_raw') ? t('filter.all_states') : s}
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
                ? `${t('results_for')} "${searchQuery}"`
                : activeFilter
                  ? t('filtered')
                  : t('all_sacred')}
            </h2>
            {!loading && (
              <span className="section-count">
                {total} {total !== 1 ? t('temples_count_plural') : t('temples_count_singular')}
              </span>
            )}
          </div>

          {loading && (
            <div className="loading-wrap">
              <div className="spinner" />
              <span className="loading-text">{t('loading')}</span>
            </div>
          )}

          {translating && (
            <div style={{ textAlign: 'center', color: 'var(--saffron)', fontSize: 13, fontFamily: 'var(--font-hindi)', marginBottom: 12 }}>
              अनुवाद हो रहा है...
            </div>
          )}

          {error && !loading && (
            <div className="error-wrap">
              <div className="error-icon">⚠️</div>
              <div className="error-title">{t('error.title')}</div>
              <div className="error-msg">{error}</div>
              <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => window.location.reload()}>
                {t('try_again')}
              </button>
            </div>
          )}

          {!loading && !error && displayTemples.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">🔍</div>
              <div className="empty-title">{t('no_temples')}</div>
              <p className="empty-msg">{t('try_different')}</p>
            </div>
          )}

          {!loading && !error && displayTemples.length > 0 && (
            <div className="temples-grid">
              {displayTemples.map((temple, i) => (
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