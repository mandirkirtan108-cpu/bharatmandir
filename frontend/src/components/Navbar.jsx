import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, PlusCircle, Menu, X, Navigation, CalendarDays, Sparkles } from 'lucide-react';
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

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const NAV_LINKS = [
    { to: '/route-planner', label: t('nav.route'),  icon: <Navigation size={17} /> },
    { to: '/panchang',      label: '🪔 Panchang',   icon: <CalendarDays size={17} /> },
    { to: '/festivals',     label: '🌸 Festivals',  icon: <Sparkles size={17} /> },
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

          {/* Desktop search — only one search bar kept */}
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

            <div className="nav-divider" />

            <Link to="/admin/add" className="nav-add-btn">
              <PlusCircle size={15} />
              <span>Add Temple</span>
            </Link>

            {/* ── Add Festival — fixed styling ── */}
            <Link
              to="/admin/add-festival"
              className="nav-add-btn nav-add-festival-btn"
            >
              <Sparkles size={15} />
              <span>Festival</span>
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

        {/* ── Sidebar search removed ── */}

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

          <Link
            to="/spiritual-guide"
            className={`sidebar-link${isActive('/spiritual-guide') ? ' active' : ''}`}
            onClick={() => setSidebarOpen(false)}
            style={{ color: '#FF6B00', fontWeight: 700 }}
          >
            <span className="sidebar-link-icon">🕉️</span>
            AI Spiritual Guide
          </Link>

          <Link
            to="/admin/add-festival"
            className={`sidebar-link${isActive('/admin/add-festival') ? ' active' : ''}`}
            onClick={() => setSidebarOpen(false)}
            style={{ color: '#C8960C', fontWeight: 700 }}
          >
            <span className="sidebar-link-icon">🌸</span>
            Add Festival
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