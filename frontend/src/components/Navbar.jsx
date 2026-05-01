import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, PlusCircle, Menu, X, Home, Map, Navigation, CalendarDays } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../LangContext';

export default function Navbar() {
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { lang, changeLang } = useLang();
  const sidebarRef = useRef(null);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
      setSidebarOpen(false);
    }
  };

  const isActive = (path) => location.pathname === path;

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close sidebar on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen]);

  // Prevent body scroll when sidebar open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const NAV_LINKS = [
    { to: '/',              label: t('nav.home'),   icon: <Home size={17} /> },
    { to: '/search',        label: t('nav.search'), icon: <Search size={17} /> },
    { to: '/map',           label: t('nav.map'),    icon: <Map size={17} /> },
    { to: '/route-planner', label: t('nav.route'),  icon: <Navigation size={17} /> },
    { to: '/panchang',      label: '🪔 Panchang',   icon: <CalendarDays size={17} /> },
  ];

  const tickerText = '🔱 OM NAMAH SHIVAYA  ·  JAI SHRI RAM  ·  HAR HAR MAHADEV  ·  JAI MATA DI  ·  JAI GANESH  ·  HARE KRISHNA HARE RAM  ·  ';

  return (
    <>
      <div className="ticker-wrap">
        <div className="ticker-track">
          <span className="ticker-content">{tickerText}{tickerText}</span>
        </div>
      </div>

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <nav className="navbar">
        <div className="navbar-inner">

          <Link to="/" className="nav-logo">
            <span className="nav-logo-icon">🛕</span>
            <div>
              <span className="nav-logo-name">BharatMandir</span>
              <span className="nav-logo-sub">{t('nav.logo_sub')}</span>
            </div>
          </Link>

          {/* Desktop search */}
          <form className="nav-search-form nav-search-desktop" onSubmit={handleSearch}>
            <Search size={16} className="nav-search-icon" />
            <input
              id="nav-search"
              name="nav-search"
              className="nav-search-input"
              type="text"
              placeholder={t('search_placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>

          {/* Desktop nav links */}
          <div className="nav-actions nav-actions-desktop">
            {NAV_LINKS.map((link, index) => (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link nav-link-${index}${isActive(link.to) ? ' active' : ''}`}
              >
                {link.label}
              </Link>
            ))}

            {/* ── AI Spiritual Guide pill ── */}
            <Link
              to="/spiritual-guide"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 14px',
                borderRadius: 50,
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                border: '2px solid #FF6B00',
                background: isActive('/spiritual-guide')
                  ? 'linear-gradient(135deg,#FF6B00,#c84b00)'
                  : 'linear-gradient(135deg,#fff5e6,#ffe5c0)',
                color: isActive('/spiritual-guide') ? 'white' : '#FF6B00',
                boxShadow: '0 2px 8px rgba(255,107,0,0.20)',
                transition: 'all .2s',
              }}
            >
              🕉️ AI Guide
            </Link>

            <div className="nav-divider" />

            <Link to="/admin/add" className="nav-add-btn">
              <PlusCircle size={15} />
              <span>Add Temple</span>
            </Link>

            <div className="nav-divider" />

            <select
              className="nav-lang-select"
              value={lang}
              onChange={(e) => changeLang(e.target.value)}
            >
              <option value="en">🌐 English</option>
              <option value="hi">🇮🇳 हिंदी</option>
              <option value="mr">🟠 मराठी</option>
              <option value="ta">🌺 தமிழ்</option>
            </select>
          </div>

          {/* Mobile: hamburger */}
          <button
            className="nav-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>

        </div>
      </nav>

      {/* ── Sidebar overlay ────────────────────────────────────────────── */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar drawer ─────────────────────────────────────────────── */}
      <aside ref={sidebarRef} className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>

        <div className="sidebar-header">
          <Link to="/" className="nav-logo sidebar-logo" onClick={() => setSidebarOpen(false)}>
            <span className="nav-logo-icon">🛕</span>
            <div>
              <span className="nav-logo-name">BharatMandir</span>
              <span className="nav-logo-sub">{t('nav.logo_sub')}</span>
            </div>
          </Link>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X size={22} />
          </button>
        </div>

        {/* Mobile search inside sidebar */}
        <form className="sidebar-search" onSubmit={handleSearch}>
          <Search size={16} className="nav-search-icon" />
          <input
            className="nav-search-input"
            type="text"
            placeholder={t('search_placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>

        <nav className="sidebar-nav">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`sidebar-link${isActive(link.to) ? ' active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sidebar-link-icon">{link.icon}</span>
              {link.label}
            </Link>
          ))}

          {/* ── AI Guide in sidebar ── */}
          <Link
            to="/spiritual-guide"
            className={`sidebar-link${isActive('/spiritual-guide') ? ' active' : ''}`}
            onClick={() => setSidebarOpen(false)}
            style={{ color: '#FF6B00', fontWeight: 700 }}
          >
            <span className="sidebar-link-icon">🕉️</span>
            AI Spiritual Guide
          </Link>
        </nav>

        <div className="sidebar-footer">
          <Link to="/admin/add" className="nav-add-btn sidebar-add-btn" onClick={() => setSidebarOpen(false)}>
            <PlusCircle size={15} />
            <span>Add Temple</span>
          </Link>

          <select
            className="nav-lang-select sidebar-lang"
            value={lang}
            onChange={(e) => { changeLang(e.target.value); }}
          >
            <option value="en">🌐 English</option>
            <option value="hi">🇮🇳 हिंदी</option>
            <option value="mr">🟠 मराठी</option>
            <option value="ta">🌺 தமிழ்</option>
          </select>
        </div>

      </aside>
    </>
  );
}