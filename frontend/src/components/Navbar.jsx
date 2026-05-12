import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { PlusCircle, Menu, X, Navigation, CalendarDays, Sparkles, LayoutDashboard, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../LangContext';
import { useAdminAuth } from '../hooks/useAdminAuth';

export default function Navbar() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { lang, changeLang } = useLang();
  const sidebarRef = useRef(null);
  const { isAdmin, logout } = useAdminAuth();

  const isActive = (path) => location.pathname === path;

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target))
        setSidebarOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // ── Public nav links (shown when NOT admin) ──
  const PUBLIC_NAV_LINKS = [
    { to: '/route-planner', label: t('nav.route'),  icon: <Navigation size={17} /> },
    { to: '/panchang',      label: '🪔 Panchang',   icon: <CalendarDays size={17} /> },
    { to: '/festivals',     label: '🌸 Festivals',  icon: <Sparkles size={17} /> },
  ];

  // ── Admin nav links (shown when IS admin) ──
  const ADMIN_NAV_LINKS = [
    { to: '/admin/add',         label: 'Add Temple',   icon: <PlusCircle size={17} />,    color: 'var(--brown-mid)' },
    { to: '/admin/add-festival', label: 'Add Festival', icon: <Sparkles size={17} />,      color: '#C8960C' },
    { to: '/admin/panel',       label: 'Admin Panel',  icon: <LayoutDashboard size={17} />, color: 'var(--brown-mid)' },
  ];

  const tickerText = '🔱 OM NAMAH SHIVAYA  ·  JAI SHRI RAM  ·  HAR HAR MAHADEV  ·  JAI MATA DI  ·  JAI GANESH  ·  HARE KRISHNA HARE RAM  ·  ';

  const handleLogout = () => {
    logout();
    navigate('/');
    setSidebarOpen(false);
  };

  return (
    <>
      <div className="ticker-wrap">
        <div className="ticker-track">
          <span className="ticker-content">{tickerText}{tickerText}</span>
        </div>
      </div>

      {/* ── Navbar ── */}
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

          {/* ── Desktop nav ── */}
          <div className="nav-actions nav-actions-desktop">

            {isAdmin ? (
              /* ══ ADMIN MODE: Add Temple, Add Festival, Panel, Logout ══ */
              <>
                <Link
                  to="/admin/add"
                  className={`nav-add-btn${isActive('/admin/add') ? ' active' : ''}`}
                  style={{
                    background: isActive('/admin/add')
                      ? 'linear-gradient(135deg, var(--brown-mid), var(--brown))'
                      : 'linear-gradient(135deg,#fff5e6,#ffe5c0)',
                    color: isActive('/admin/add') ? 'white' : 'var(--brown-mid)',
                    borderColor: 'var(--brown-mid)', fontWeight: 700,
                  }}
                >
                  <PlusCircle size={15} />
                  <span>Add Temple</span>
                </Link>

                <Link
                  to="/admin/add-festival"
                  className={`nav-add-btn${isActive('/admin/add-festival') ? ' active' : ''}`}
                  style={{
                    background: isActive('/admin/add-festival')
                      ? 'linear-gradient(135deg,#C8960C,#a07008)'
                      : 'linear-gradient(135deg,#fffbea,#fff3c0)',
                    color: isActive('/admin/add-festival') ? 'white' : '#C8960C',
                    borderColor: '#C8960C', fontWeight: 700,
                  }}
                >
                  <Sparkles size={15} />
                  <span>Add Festival</span>
                </Link>

                <div className="nav-divider" />

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
                  title="Admin Panel"
                >
                  <LayoutDashboard size={15} />
                  <span>Panel</span>
                </Link>

                <button
                  onClick={handleLogout}
                  title="Logout from admin"
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
              /* ══ PUBLIC MODE: Route Planner, Panchang, Festivals, AI Guide, Admin Login ══ */
              <>
                {PUBLIC_NAV_LINKS.map((link, index) => (
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
                    borderColor: '#FF6B00', fontWeight: 700,
                  }}
                >
                  <span>🕉️</span>
                  <span>AI Guide</span>
                </Link>

                <div className="nav-divider" />

                <Link
                  to="/admin/login"
                  className="nav-add-btn"
                  style={{ color: 'var(--text-light)', borderColor: 'var(--cream-dark)' }}
                  title="Admin Login"
                >
                  <LayoutDashboard size={15} />
                  <span>Admin</span>
                </Link>
              </>
            )}

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

      {/* ── Sidebar overlay ── */}
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* ── Sidebar drawer ── */}
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
          {isAdmin ? (
            /* ══ ADMIN SIDEBAR ══ */
            <>
              {ADMIN_NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`sidebar-link${isActive(link.to) ? ' active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                  style={{ color: link.color, fontWeight: 700 }}
                >
                  <span className="sidebar-link-icon">{link.icon}</span>
                  {link.label}
                </Link>
              ))}

              <button
                onClick={handleLogout}
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
                Logout
              </button>
            </>
          ) : (
            /* ══ PUBLIC SIDEBAR ══ */
            <>
              {PUBLIC_NAV_LINKS.map((link) => (
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
                to="/admin/login"
                className={`sidebar-link${isActive('/admin/login') ? ' active' : ''}`}
                onClick={() => setSidebarOpen(false)}
                style={{ color: 'var(--text-light)' }}
              >
                <span className="sidebar-link-icon"><LayoutDashboard size={17} /></span>
                Admin Login
              </Link>
            </>
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

      {/* ── Floating AI Guide button — only for public users, hidden when sidebar open ── */}
      {!isAdmin && (
        <Link
          to="/spiritual-guide"
          style={{
            display: sidebarOpen ? 'none' : 'flex',
            position: 'fixed',
            bottom: 28, right: 28, zIndex: 9999,
            alignItems: 'center', gap: 8,
            padding: '12px 20px', borderRadius: 50,
            fontSize: 14, fontWeight: 700,
            textDecoration: 'none', whiteSpace: 'nowrap',
            border: '2px solid #FF6B00',
            background: isActive('/spiritual-guide')
              ? 'linear-gradient(135deg,#FF6B00,#c84b00)'
              : 'linear-gradient(135deg,#fff5e6,#ffe5c0)',
            color: isActive('/spiritual-guide') ? 'white' : '#FF6B00',
            boxShadow: '0 4px 20px rgba(255,107,0,0.35)',
            transition: 'all .2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.07)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(255,107,0,0.50)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(255,107,0,0.35)'; }}
        >
          🕉️ AI Guide
        </Link>
      )}
    </>
  );
}