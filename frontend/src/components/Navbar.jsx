import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, PlusCircle, Menu, X, Navigation, CalendarDays, Sparkles, LayoutDashboard, LogOut, BookOpen, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../LangContext';
import { useAdminAuth } from '../hooks/useAdminAuth';
import { useUserAuth } from '../hooks/useUserAuth';

export default function Navbar() {
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { lang, changeLang } = useLang();
  const sidebarRef = useRef(null);
  const { isAdmin, logout: adminLogout } = useAdminAuth();
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
    { to: '/search',        label: '🛕 Temples',           icon: <Search size={17} /> },
    { to: '/route-planner', label: t('nav.route'),         icon: <Navigation size={17} /> },
    { to: '/panchang',      label: t('nav.panchang'),      icon: <CalendarDays size={17} /> },
    { to: '/festivals',     label: t('nav.festivals'),     icon: <Sparkles size={17} /> },
    { to: '/sacred-books',  label: '📚 Library',           icon: <BookOpen size={17} /> },
  ];

  const tickerText = '🔱 OM NAMAH SHIVAYA  ·  JAI SHRI RAM  ·  HAR HAR MAHADEV  ·  JAI MATA DI  ·  JAI GANESH  ·  HARE KRISHNA HARE RAM  ·  ';

  const handleAdminLogout = () => {
    adminLogout();
    navigate('/');
    setSidebarOpen(false);
  };

  const handleUserLogout = () => {
    userLogout();
    navigate('/login');
    setSidebarOpen(false);
  };

  return (
    <>
      <div className="ticker-wrap">
        <div className="ticker-track">
          <span className="ticker-content">{tickerText}{tickerText}</span>
        </div>
      </div>

      <nav className="navbar">
        <div className="navbar-inner">

          <Link to="/" className="nav-logo" style={{ marginRight: '60px' }}>
            <span className="nav-logo-icon">🛕</span>
            <div>
              <span className="nav-logo-name">BharatMandir</span>
              <span className="nav-logo-sub">{t('nav.logo_sub')}</span>
            </div>
          </Link>

          <div style={{ flex: 1 }} />

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

            <Link
              to="/spiritual-guide"
              className={`nav-add-btn${isActive('/spiritual-guide') ? ' active' : ''}`}
              style={{
                background: isActive('/spiritual-guide')
                  ? 'linear-gradient(135deg,#FF6B00,#c84b00)'
                  : 'linear-gradient(135deg,#fff5e6,#ffe5c0)',
                color: isActive('/spiritual-guide') ? 'white' : '#FF6B00',
                borderColor: '#FF6B00',
                fontWeight: 700,
              }}
            >
              <span>🕉️</span>
              <span>{t('nav.ai_guide')}</span>
            </Link>

            {isAdmin && (
              <>
                <Link
                  to="/admin/add"
                  className="nav-add-btn"
                  style={{
                    background: 'linear-gradient(135deg,#fff5e6,#ffe5c0)',
                    color: 'var(--brown-mid)',
                    borderColor: 'var(--brown-mid)',
                    fontWeight: 700,
                  }}
                >
                  <PlusCircle size={15} />
                  <span>{t('nav.add_temple')}</span>
                </Link>

                <Link
                  to="/admin/add-festival"
                  className="nav-add-btn nav-add-festival-btn"
                >
                  <Sparkles size={15} />
                  <span>{t('nav.add_festival')}</span>
                </Link>
              </>
            )}

            <div className="nav-divider" />

            {isAdmin ? (
              <>
                <Link
                  to="/admin/panel"
                  className={`nav-add-btn${isActive('/admin/panel') ? ' active' : ''}`}
                  style={{
                    background: isActive('/admin/panel')
                      ? 'linear-gradient(135deg, var(--brown-mid), var(--brown))'
                      : 'transparent',
                    color: isActive('/admin/panel') ? 'white' : 'var(--brown-mid)',
                    borderColor: 'var(--brown-mid)',
                  }}
                  title={t('nav.admin_panel')}
                >
                  <LayoutDashboard size={15} />
                  <span>{t('nav.admin_panel')}</span>
                </Link>

                <button
                  onClick={handleAdminLogout}
                  title={t('nav.admin_logout')}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '8px 12px', borderRadius: 50,
                    border: '2px solid var(--cream-dark)', background: 'transparent',
                    color: 'var(--text-light)', cursor: 'pointer',
                    fontFamily: 'var(--font-display)', fontSize: 12,
                    letterSpacing: '.04em', transition: 'all .2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--cream-dark)'; e.currentTarget.style.color = 'var(--text-light)'; }}
                >
                  <LogOut size={14} />
                </button>
              </>
            ) : (
              <Link
                to="/admin/login"
                className="nav-add-btn"
                style={{
                  color: 'var(--text-light)',
                  borderColor: 'var(--cream-dark)',
                }}
                title={t('nav.admin_login')}
              >
                <LayoutDashboard size={15} />
                <span>{t('nav.admin')}</span>
              </Link>
            )}

            <div className="nav-divider" />

            {/* ── User avatar + profile link + logout ── */}
            {isLoggedIn && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Link
                  to="/profile"
                  title="My Profile"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 50,
                    background: isActive('/profile') ? 'rgba(255,153,0,0.20)' : 'rgba(255,153,0,0.10)',
                    border: `1px solid ${isActive('/profile') ? 'rgba(255,153,0,0.60)' : 'rgba(255,153,0,0.25)'}`,
                    color: '#ff9900', fontSize: 12, fontWeight: 600,
                    textDecoration: 'none', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,153,0,0.22)'}
                  onMouseLeave={e => e.currentTarget.style.background = isActive('/profile') ? 'rgba(255,153,0,0.20)' : 'rgba(255,153,0,0.10)'}
                >
                  <User size={13} />
                  <span style={{
                    maxWidth: 90, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {user?.name?.split(' ')[0] || 'Profile'}
                  </span>
                </Link>
                <button
                  onClick={handleUserLogout}
                  title="Sign out"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '8px 12px', borderRadius: 50,
                    border: '2px solid var(--cream-dark)', background: 'transparent',
                    color: 'var(--text-light)', cursor: 'pointer',
                    fontFamily: 'var(--font-display)', fontSize: 12,
                    letterSpacing: '.04em', transition: 'all .2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--cream-dark)'; e.currentTarget.style.color = 'var(--text-light)'; }}
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}

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

          <button
            className="nav-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>

        </div>
      </nav>

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
              style={link.to === '/search' ? { color: 'var(--saffron)', fontWeight: 700 } : {}}
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
            {t('nav.ai_spiritual')}
          </Link>

          {isAdmin ? (
            <>
              <Link
                to="/admin/add"
                className={`sidebar-link${isActive('/admin/add') ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
                style={{ color: 'var(--brown-mid)', fontWeight: 700 }}
              >
                <span className="sidebar-link-icon"><PlusCircle size={17} /></span>
                {t('nav.add_temple')}
              </Link>

              <Link
                to="/admin/add-festival"
                className={`sidebar-link${isActive('/admin/add-festival') ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
                style={{ color: '#C8960C', fontWeight: 700 }}
              >
                <span className="sidebar-link-icon">🌸</span>
                {t('nav.add_festival')}
              </Link>

              <Link
                to="/admin/panel"
                className={`sidebar-link${isActive('/admin/panel') ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
                style={{ color: 'var(--brown-mid)', fontWeight: 700 }}
              >
                <span className="sidebar-link-icon"><LayoutDashboard size={17} /></span>
                {t('nav.admin_panel')}
              </Link>

              <button
                onClick={handleAdminLogout}
                className="sidebar-link"
                style={{
                  background: 'none', border: 'none', width: '100%',
                  textAlign: 'left', cursor: 'pointer', color: '#ef4444',
                  fontFamily: 'var(--font-display)', fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '12px 20px', fontSize: 14,
                }}
              >
                <span className="sidebar-link-icon"><LogOut size={17} /></span>
                {t('nav.admin_logout')}
              </button>
            </>
          ) : (
            <Link
              to="/admin/login"
              className={`sidebar-link${isActive('/admin/login') ? ' active' : ''}`}
              onClick={() => setSidebarOpen(false)}
              style={{ color: 'var(--text-light)' }}
            >
              <span className="sidebar-link-icon"><LayoutDashboard size={17} /></span>
              {t('nav.admin_login')}
            </Link>
          )}

          {/* ── User profile + logout in sidebar ── */}
          {isLoggedIn && (
            <>
              <div style={{
                margin: '8px 20px 0',
                borderTop: '1px solid rgba(255,153,0,0.15)',
                paddingTop: 8,
              }} />

              <Link
                to="/profile"
                className={`sidebar-link${isActive('/profile') ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
                style={{ color: '#ff9900', fontWeight: 700 }}
              >
                <span className="sidebar-link-icon"><User size={17} /></span>
                My Profile
              </Link>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 20px',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  color: 'rgba(255,255,255,0.5)', fontSize: 13,
                }}>
                  <span>{user?.name || 'User'}</span>
                </div>
                <button
                  onClick={handleUserLogout}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 50,
                    border: '1.5px solid #ef4444', background: 'rgba(239,68,68,0.08)',
                    color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  }}
                >
                  <LogOut size={13} />
                  Sign Out
                </button>
              </div>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
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

      <Link
        to="/spiritual-guide"
        style={{
          display: sidebarOpen ? 'none' : 'flex',
          position: 'fixed',
          bottom: 28,
          right: 28,
          zIndex: 9999,
          alignItems: 'center',
          gap: 8,
          padding: '12px 20px',
          borderRadius: 50,
          fontSize: 14,
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
        {t('nav.floating_ai')}
      </Link>
    </>
  );
}