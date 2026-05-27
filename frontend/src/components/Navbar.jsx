import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, PlusCircle, Menu, X, Home, Map, Navigation, CalendarDays, LogIn, LogOut, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../LangContext';
import { useAuth } from '../AuthContext';

export default function Navbar() {
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { lang, changeLang } = useLang();
  const { user, isLoggedIn, logout } = useAuth();
  const sidebarRef = useRef(null);
  const userMenuRef = useRef(null);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
      setSidebarOpen(false);
    }
  };

  const isActive = (path) => location.pathname === path;

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setSidebarOpen(false);
      }
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen, userMenuOpen]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const handleLogout = () => {
    logout();
    setUserMenuOpen(false);
    setSidebarOpen(false);
    navigate('/');
  };

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

            {/* ── AI Spiritual Guide — glowing animated pill ── */}
            <Link
              to="/spiritual-guide"
              className="ai-guide-pill"
              data-active={isActive('/spiritual-guide') ? 'true' : 'false'}
            >
              <span className="ai-guide-sparkle">✦</span>
              🕉️ AI Guide
              <span className="ai-guide-badge">AI</span>
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

            <div className="nav-divider" />

            {/* ── Auth button / user menu ── */}
            {isLoggedIn ? (
              <div style={{ position: 'relative' }} ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '7px 14px',
                    borderRadius: 50,
                    border: '2px solid #E8650A',
                    background: 'linear-gradient(135deg,#FFF5E6,#FFE5C0)',
                    color: '#B84D00',
                    fontFamily: "'Cinzel', serif",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    letterSpacing: '.04em',
                  }}
                >
                  <User size={14} />
                  {user?.name?.split(' ')[0] || 'Me'}
                </button>
                {userMenuOpen && (
                  <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    background: 'white',
                    border: '1px solid #F0E6D0',
                    borderRadius: 12,
                    boxShadow: '0 8px 30px rgba(61,31,0,0.15)',
                    minWidth: 180,
                    overflow: 'hidden',
                    zIndex: 500,
                  }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0E6D0', background: '#FDF8F0' }}>
                      <div style={{ fontFamily: "'Cinzel', serif", fontSize: 13, fontWeight: 700, color: '#3D1F00' }}>🙏 {user?.name}</div>
                      <div style={{ fontSize: 11, color: '#8B6040', marginTop: 2 }}>{user?.email}</div>
                    </div>
                    <button
                      onClick={handleLogout}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        width: '100%', padding: '12px 16px',
                        background: 'none', border: 'none',
                        color: '#C0392B', cursor: 'pointer',
                        fontFamily: "'Cinzel', serif", fontSize: 12,
                        fontWeight: 600, letterSpacing: '.04em',
                        transition: 'background .2s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FFF0F0'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/auth"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  borderRadius: 50,
                  border: '2px solid #E8650A',
                  background: 'linear-gradient(135deg,#E8650A,#B84D00)',
                  color: 'white',
                  fontFamily: "'Cinzel', serif",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '.05em',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 3px 12px rgba(232,101,10,.35)',
                  transition: 'all .2s',
                }}
              >
                <LogIn size={13} /> Sign In
              </Link>
            )}
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

      {/* Sidebar overlay */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar drawer */}
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

        {/* User info in sidebar */}
        {isLoggedIn && (
          <div style={{
            margin: '0 16px 8px',
            padding: '12px 14px',
            background: 'linear-gradient(135deg,#FFF5E6,#FFE5C0)',
            borderRadius: 10,
            border: '1px solid #FFD4A0',
          }}>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 13, fontWeight: 700, color: '#3D1F00' }}>🙏 {user?.name}</div>
            <div style={{ fontSize: 11, color: '#8B6040', marginTop: 1 }}>{user?.email}</div>
          </div>
        )}

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

          {/* AI Guide in sidebar */}
          <Link
            to="/spiritual-guide"
            className={`sidebar-link sidebar-ai-guide${isActive('/spiritual-guide') ? ' active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sidebar-link-icon">🕉️</span>
            AI Spiritual Guide
            <span style={{
              marginLeft: 'auto',
              background: 'linear-gradient(135deg,#6A0DAD,#9B59B6)',
              color: 'white',
              fontSize: 9,
              fontWeight: 800,
              padding: '2px 6px',
              borderRadius: 50,
              letterSpacing: '.06em',
            }}>AI</span>
          </Link>
        </nav>

        <div className="sidebar-footer">
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '10px 16px',
                background: '#FFF0F0', border: '2px solid #FFC0C0',
                borderRadius: 50, color: '#C0392B',
                fontFamily: "'Cinzel', serif", fontSize: 12,
                fontWeight: 700, cursor: 'pointer',
                letterSpacing: '.04em',
              }}
            >
              <LogOut size={14} /> Sign Out
            </button>
          ) : (
            <Link
              to="/auth"
              onClick={() => setSidebarOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                width: '100%', padding: '10px 16px',
                background: 'linear-gradient(135deg,#E8650A,#B84D00)',
                border: 'none', borderRadius: 50, color: 'white',
                fontFamily: "'Cinzel', serif", fontSize: 12,
                fontWeight: 700, textDecoration: 'none',
                letterSpacing: '.05em',
              }}
            >
              <LogIn size={14} /> Sign In / Sign Up
            </Link>
          )}

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