import { useState, useEffect } from 'react';
import { useSearchParams, Link, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import TempleCard from '../components/TempleCard';
import Footer from '../components/Footer';
import { templeAPI } from '../services/api';
import { useTranslatedTemples } from '../hooks/useTranslatedData';

const DEITY_FILTERS = [
  { labelKey: 'filter.all',        value: '' },
  { label: '🔱 Shiva',             value: 'Lord Shiva' },
  { label: '🪷 Vishnu',            value: 'Lord Vishnu' },
  { label: '🏹 Ram',               value: 'Lord Ram' },
  { label: '🎵 Krishna',           value: 'Lord Krishna' },
  { label: '⚔️ Durga/Shakti',      value: 'Goddess' },
  { label: '🐘 Ganesha',           value: 'Lord Ganesha' },
  { labelKey: 'filter.jyotirlinga', emoji: '⭐', value: 'jyotirlinga' },
  { labelKey: 'filter.shaktipeeth', emoji: '🌸', value: 'shaktipeeth' },
];

const STATES = [
  'All States',
  'Madhya Pradesh', 'Uttar Pradesh', 'Maharashtra',
  'Tamil Nadu', 'Gujarat', 'Karnataka', 'Rajasthan',
];

const PAGE_SIZE = 12;

export default function HomePage() {
  const [searchParams]                    = useSearchParams();
  const location                          = useLocation();
  const { t }                             = useTranslation();
  const [temples,       setTemples]       = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [total,         setTotal]         = useState(0);
  const [activeFilter,  setActiveFilter]  = useState('');
  const [activeState,   setActiveState]   = useState('All States');
  const [searchQuery,   setSearchQuery]   = useState(searchParams.get('search') || '');
  const [totalTemples,  setTotalTemples]  = useState(0);
  const [visibleCount,  setVisibleCount]  = useState(PAGE_SIZE);

  const { translated: displayTemples, translating } = useTranslatedTemples(temples);
  const visibleTemples = displayTemples.slice(0, visibleCount);

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    templeAPI.health()
      .then(res => setTotalTemples(res.data.total_temples || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const fetchTemples = async () => {
      setLoading(true);
      setError(null);
      setVisibleCount(PAGE_SIZE); // reset pagination on filter change
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
          if (activeState !== 'All States')        params.state = activeState;

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
    setActiveState('All States');
  };

  const getFilterLabel = (f) => {
    if (f.labelKey) return (f.emoji ? f.emoji + ' ' : '') + t(f.labelKey);
    return f.label;
  };

  return (
    <div>
      <Navbar />

      {/* ── Hero ── */}
      <section style={{
        position: 'relative', overflow: 'hidden', color: '#FFD580',
        background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
        /* FIX: reduced vertical padding so temple cards are visible above the fold */
        padding: '56px 24px 72px',
        textAlign: 'center',
      }}>
        {/* Om watermark */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 320, color: 'rgba(255,255,255,0.028)', fontFamily: 'var(--font-hindi)',
          pointerEvents: 'none', userSelect: 'none', lineHeight: 1,
        }}>ॐ</div>

        {/* Radial glow */}
        <div style={{
          position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 300,
          background: 'radial-gradient(ellipse, rgba(232,101,10,0.28) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,213,128,0.3)',
            borderRadius: 50, padding: '6px 20px', marginBottom: 16,
            color: '#FFD580', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
            fontWeight: 500, backdropFilter: 'blur(8px)',
          }}>
            🕉 {t('hero_badge')}
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 'clamp(32px,5vw,62px)', lineHeight: 1.05, marginBottom: 14,
            textShadow: '0 4px 40px rgba(0,0,0,0.3)',
            color: '#FFD580',
          }}>
            {t('hero_title')}<br />
            <span style={{ color: '#FFD580' }}>{t('hero_subtitle')}</span>
          </h1>

          <p style={{
            color: '#FFD580', opacity: 0.82, fontSize: 17,
            maxWidth: 540, margin: '0 auto 28px', fontWeight: 300, lineHeight: 1.7,
          }}>
            {t('hero_desc')}
          </p>

          {/* FIX: Search with visible label for accessibility */}
          <div className="hero-actions">
            <label
              htmlFor="hero-search"
              style={{
                display: 'block', marginBottom: 8,
                fontSize: 13, color: 'rgba(255,213,128,0.75)',
                letterSpacing: '.05em',
              }}
            >
              {t('') || ''}
            </label>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <input
                id="hero-search"
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

      {/* ── Filters ── FIX: Split into two rows — deity row + state row */}
      <div className="filters-bar">
        <div className="container">
          {/* Row 1: Deity filters */}
          <div className="filters-inner" style={{ marginBottom: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: 'var(--color-muted, #888)',
              textTransform: 'uppercase', letterSpacing: '.08em',
              alignSelf: 'center', marginRight: 4, whiteSpace: 'nowrap',
            }}>
              {t('filter.by_deity') || 'Deity'}
            </span>
            {DEITY_FILTERS.map((f) => (
              <button
                key={f.value}
                className={`filter-chip ${activeFilter === f.value && !searchQuery ? 'active' : ''}`}
                onClick={() => handleFilterClick(f.value)}
              >
                {getFilterLabel(f)}
              </button>
            ))}
          </div>

          {/* Row 2: State filters */}
          <div className="filters-inner">
            <span style={{
              fontSize: 11, fontWeight: 600, color: 'var(--color-muted, #888)',
              textTransform: 'uppercase', letterSpacing: '.08em',
              alignSelf: 'center', marginRight: 4, whiteSpace: 'nowrap',
            }}>
              {t('filter.by_state') || 'State'}
            </span>
            {STATES.map((s) => (
              <button
                key={s}
                className={`filter-chip ${activeState === s && !searchQuery ? 'active' : ''}`}
                onClick={() => { setActiveState(s); setSearchQuery(''); }}
              >
                {s === 'All States' ? t('filter.all_states') : s}
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
              {t('loading')}
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

          {!loading && !error && visibleTemples.length > 0 && (
            <>
              <div className="temples-grid">
                {visibleTemples.map((temple, i) => (
                  <TempleCard
                    key={temple.id || i}
                    temple={temple}
                    style={{ animationDelay: `${i * 0.05}s` }}
                  />
                ))}
              </div>

              {/* FIX: Load More button — replaces loading 50 at once */}
              {visibleCount < displayTemples.length && (
                <div style={{ textAlign: 'center', marginTop: 36, marginBottom: 16 }}>
                  <button
                    className="btn-primary"
                    style={{ padding: '12px 36px', fontSize: 15 }}
                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                  >
                    {t('load more') || 'Load More Temples'} ✦
                  </button>
                  <p style={{ marginTop: 10, fontSize: 13, color: 'var(--color-muted, #888)' }}>
                    {t('showing') || 'Showing'} {Math.min(visibleCount, displayTemples.length)} {t('of') || 'of'} {displayTemples.length}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />

      {/* ── Floating AI Guide Button ──
          FIX: raised bottom on mobile to avoid covering content,
          smaller on mobile screens */}
      <Link
        to="/spiritual-guide"
        style={{
          position: 'fixed',
          bottom: 'clamp(16px, 4vw, 28px)',
          right: 'clamp(16px, 4vw, 28px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 'clamp(10px, 2vw, 12px) clamp(14px, 3vw, 20px)',
          borderRadius: 50,
          fontSize: 'clamp(12px, 2vw, 14px)',
          fontWeight: 700,
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          border: '2px solid #FF6B00',
          background: isActive('/spiritual-guide')
            ? 'linear-gradient(135deg,#FF6B00,#c84b00)'
            : 'linear-gradient(135deg,#fff5e6,#ffe5c0)',
          color: isActive('/spiritual-guide') ? 'white' : '#FF6B00',
          boxShadow: '0 4px 20px rgba(255,107,0,0.35)',
          transition: 'all .2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.07)';
          e.currentTarget.style.boxShadow = '0 6px 28px rgba(255,107,0,0.50)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(255,107,0,0.35)';
        }}
      >
        🕉️ AI Guide
      </Link>
    </div>
  );
}