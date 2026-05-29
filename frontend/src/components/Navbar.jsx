import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Menu, X, Navigation, CalendarDays, Sparkles, BookOpen, User, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../LangContext';
import { useUserAuth } from '../hooks/useUserAuth';

export default function Navbar() {
  const [query, setQuery]         = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const navigate    = useNavigate();
  const location    = useLocation();
  const { t }       = useTranslation();
  const { lang, changeLang } = useLang();
  const sidebarRef  = useRef(null);
  const userMenuRef = useRef(null);
  const { isLoggedIn, user, logout: userLogout } = useUserAuth();

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
      setSidebarOpen(false);
    }
  };

  const isActive = (path) => location.pathname === path;

  useEffect(() => { setSidebarOpen(false); setUserMenuOpen(false); }, [location.pathname]);

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

  const handleUserLogout = () => {
    userLogout();
    setUserMenuOpen(false);
    navigate('/login');
    setSidebarOpen(false);
  };

  const NAV_LINKS = [
    { to: '/search',          label: '🛕 ' + 'Temples',              icon: <Search size={16} /> },
    { to: '/route-planner',   label: t('nav.route'),                 icon: <Navigation size={16} /> },
    { to: '/panchang',        label: t('nav.panchang'),              icon: <CalendarDays size={16} /> },
    { to: '/festivals',       label: t('nav.festivals'),             icon: <Sparkles size={16} /> },
    { to: '/sacred-books',    label: '📚 Library',                   icon: <BookOpen size={16} /> },
    { to: '/spiritual-guide', label: '🕉️ ' + t('nav.ai_guide'),     icon: null },
  ];

  const tickerText = '🔱 OM NAMAH SHIVAYA  ·  JAI SHRI RAM  ·  HAR HAR MAHADEV  ·  JAI MATA DI  ·  JAI GANESH  ·  HARE KRISHNA HARE RAM  ·  ';

  return (
    <>
      {/* ── Ticker ── */}
      <div className="ticker-wrap">
        <div className="ticker-track">
          <span className="ticker-content">{tickerText}{tickerText}</span>
        </div>
      </div>

      {/* ── Navbar ── */}
      <nav className="navbar">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: '11px 28px',
          maxWidth: 1200,
          margin: '0 auto',
          gap: 0,
          // REMOVED: position: 'relative' — no longer needed since links are in-flow
        }}>

          {/* Logo — left, fixed width so centre links truly center */}
          <Link to="/" className="nav-logo" style={{ flexShrink: 0 }}>
            <span className="nav-logo-icon">🛕</span>
            <div>
              <span className="nav-logo-name">BharatMandir</span>
              <span className="nav-logo-sub">{t('nav.logo_sub')}</span>
            </div>
          </Link>

          {/* ── Desktop centre links ── */}
          {/* FIX: was position:absolute which caused overlap + height jump.
              Now flex:1 + justifyContent:center keeps links in-flow so the
              navbar height is stable and nothing overlaps the logo or right controls. */}
          <div className="nav-actions-desktop" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flex: 1,                    // ← fills remaining horizontal space
            justifyContent: 'center',   // ← centers within that space
            // REMOVED: position, left, transform
          }}>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`nav-link${isActive(link.to) ? ' active' : ''}`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* ── Right side: lang + user ── */}
          {/* FIX: removed marginLeft:'auto' — flex:1 on centre div already pushes
              this block to the right. flexShrink:0 prevents it from squishing. */}
          <div className="nav-actions-desktop" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,             // ← never shrink; links shrink first
            // REMOVED: marginLeft: 'auto'
          }}>
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

            {isLoggedIn ? (
              /* ── User pill with dropdown ── */
              <div ref={userMenuRef} style={{ position: 'relative' }}>
                <button
                  onClick={() => setUserMenuOpen(v => !v)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '7px 14px', borderRadius: 50,
                    border: '1.5px solid #EDE3CE',
                    background: userMenuOpen ? '#FAF6EE' : '#fff',
                    color: '#5C3010', fontWeight: 600, fontSize: 13,
                    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#C8520A'; }}
                  onMouseLeave={e => { if (!userMenuOpen) e.currentTarget.style.borderColor = '#EDE3CE'; }}
                >
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#E06B25,#9A3C05)',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>
                    {(user?.name || 'U')[0].toUpperCase()}
                  </span>
                  <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.name?.split(' ')[0] || 'Profile'}
                  </span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ opacity: 0.6, transition: 'transform 0.2s', transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>

                {/* Dropdown */}
                {userMenuOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    background: '#fff', borderRadius: 14, minWidth: 180,
                    border: '1px solid #EDE3CE',
                    boxShadow: '0 8px 32px rgba(44,21,0,0.14)',
                    overflow: 'hidden', zIndex: 500,
                    animation: 'fadeDown 0.16s ease',
                  }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #EDE3CE' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#2C1500' }}>{user?.name}</div>
                      <div style={{ fontSize: 12, color: '#A07050', marginTop: 2 }}>{user?.email}</div>
                    </div>
                    <Link
                      to="/profile"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '11px 16px', color: '#4A2C10', fontSize: 14,
                        fontWeight: 500, textDecoration: 'none',
                        transition: 'background 0.15s',
                        background: isActive('/profile') ? '#FAF6EE' : 'transparent',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FAF6EE'}
                      onMouseLeave={e => e.currentTarget.style.background = isActive('/profile') ? '#FAF6EE' : 'transparent'}
                    >
                      <User size={15} style={{ color: '#C8520A' }} />
                      My Profile
                    </Link>
                    <button
                      onClick={handleUserLogout}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '11px 16px', border: 'none', background: 'transparent',
                        color: '#B91C1C', fontSize: 14, fontWeight: 500,
                        cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                        borderTop: '1px solid #EDE3CE',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FEF2F2'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <LogOut size={15} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                to="/login"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 18px', borderRadius: 50,
                  background: 'linear-gradient(135deg,#E06B25,#9A3C05)',
                  color: '#fff', fontWeight: 600, fontSize: 13,
                  textDecoration: 'none',
                  boxShadow: '0 3px 12px rgba(200,82,10,0.28)',
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Sign In
              </Link>
            )}
          </div>

          {/* Hamburger — mobile only */}
          <button
            className="nav-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            style={{ marginLeft: 12 }}
          >
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {/* ── Sidebar overlay ── */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

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

        <nav className="sidebar-nav">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`sidebar-link${isActive(link.to) ? ' active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="sidebar-link-icon">{link.icon || <span>{link.label.split(' ')[0]}</span>}</span>
              {link.label}
            </Link>
          ))}

          {/* User section in sidebar */}
          {isLoggedIn && (
            <>
              <div style={{ margin: '8px 20px 0', borderTop: '1px solid rgba(255,153,0,0.15)', paddingTop: 8 }} />
              <Link
                to="/profile"
                className={`sidebar-link${isActive('/profile') ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
                style={{ color: '#ffb050', fontWeight: 600 }}
              >
                <span className="sidebar-link-icon"><User size={16} /></span>
                My Profile
              </Link>
              <button
                onClick={handleUserLogout}
                className="sidebar-link"
                style={{
                  background: 'none', border: 'none', width: '100%', textAlign: 'left',
                  cursor: 'pointer', color: '#ef4444', fontFamily: 'inherit',
                  fontWeight: 600, display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 14px', fontSize: 14, borderRadius: 8,
                }}
              >
                <span className="sidebar-link-icon"><LogOut size={16} /></span>
                Sign Out
              </button>
            </>
          )}

          {!isLoggedIn && (
            <Link
              to="/login"
              className="sidebar-link"
              onClick={() => setSidebarOpen(false)}
              style={{ color: '#ffb050', fontWeight: 600 }}
            >
              <span className="sidebar-link-icon"><User size={16} /></span>
              Sign In
            </Link>
          )}
        </nav>

        <div className="sidebar-footer">
          <select
            className="nav-lang-select sidebar-lang"
            value={lang}
            onChange={(e) => changeLang(e.target.value)}
          >
            <option value="en">🌐 English</option>
            <option value="hi">🇮🇳 हिंदी</option>
            <option value="mr">🟠 मराठी</option>
            <option value="ta">🌺 தமிழ்</option>
          </select>
        </div>
      </aside>

      {/* ── Floating AI Guide button ── */}
      <Link
        to="/spiritual-guide"
        style={{
          display: sidebarOpen || isActive('/spiritual-guide') ? 'none' : 'flex',
          position: 'fixed', bottom: 28, right: 28, zIndex: 9999,
          alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 50,
          fontSize: 14, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap',
          border: '2px solid #C8520A',
          background: isActive('/spiritual-guide')
            ? 'linear-gradient(135deg,#E06B25,#9A3C05)'
            : 'linear-gradient(135deg,#fff5e6,#ffe5c0)',
          color: isActive('/spiritual-guide') ? '#fff' : '#C8520A',
          boxShadow: '0 4px 20px rgba(200,82,10,0.32)',
          transition: 'all .2s',
          fontFamily: "'DM Sans', sans-serif",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.07)';
          e.currentTarget.style.boxShadow = '0 6px 28px rgba(200,82,10,0.50)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(200,82,10,0.32)';
        }}
      >
        {t('nav.floating_ai')}
      </Link>
    </>
  );
}