import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Menu,
  PenLine,
  RefreshCw,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../LangContext';
import { useAdminAuth } from '../../hooks/useAdminAuth';

const ADMIN_LINKS = [
  {
    to: '/admin/panel',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    to: '/admin/add-festival',
    label: 'Add Festival',
    icon: CalendarDays,
  },
  {
    to: '/admin/add-blog',
    label: 'Add Blog',
    icon: PenLine,
  },
  {
    to: '/admin/library',
    label: 'Library',
    icon: BookOpen,
  },
];

export default function AdminNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { lang, changeLang } = useLang();
  const { admin, logout } = useAdminAuth();

  const isActive = (path) => location.pathname === path;

  useEffect(() => {
    const closeOnOutsideClick = (event) => {
      if (
        menuOpen
        && menuRef.current
        && !menuRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [menuOpen]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    setMenuOpen(false);
    navigate('/admin/login', { replace: true });
  };

  const tickerText =
    '🔱 OM NAMAH SHIVAYA  ·  JAI SHRI RAM  ·  HAR HAR MAHADEV  ·  JAI MATA DI  ·  JAI GANESH  ·  HARE KRISHNA HARE RAM  ·  ';

  return (
    <>
      <div className="ticker-wrap">
        <div className="ticker-track">
          <span className="ticker-content">
            {tickerText}
            {tickerText}
          </span>
        </div>
      </div>

      <nav className="navbar admin-navbar">
        <div className="admin-navbar-inner">
          <Link to="/" className="nav-logo">
            <span className="nav-logo-icon">🛕</span>
            <div>
              <span className="nav-logo-name">BharatMandir</span>
              <span className="nav-logo-sub">{t('nav.logo_sub')}</span>
            </div>
          </Link>

          <div className="admin-navbar-links">
            {ADMIN_LINKS.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`admin-nav-item${isActive(to) ? ' active' : ''}`}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}

            <button
              type="button"
              className="admin-nav-item secondary"
              onClick={() => window.location.reload()}
            >
              <RefreshCw size={16} />
              Refresh
            </button>

            <button
              type="button"
              className="admin-nav-item danger"
              onClick={handleLogout}
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>

          <div className="admin-navbar-account">
            <select
              className="nav-lang-select"
              value={lang}
              onChange={(event) => changeLang(event.target.value)}
              aria-label="Select language"
            >
              <option value="en">🌐 English</option>
              <option value="hi">🇮🇳 हिंदी</option>
              <option value="mr">🟠 मराठी</option>
              <option value="ta">🌺 தமிழ்</option>
            </select>

            <div className="admin-avatar" title={admin?.email || 'Administrator'}>
              {(admin?.name || admin?.email || 'A').charAt(0).toUpperCase()}
            </div>
          </div>

          <button
            type="button"
            className="nav-hamburger admin-hamburger"
            onClick={() => setMenuOpen(true)}
            aria-label="Open admin menu"
          >
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          className="admin-menu-overlay"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        ref={menuRef}
        className={`admin-mobile-menu${menuOpen ? ' open' : ''}`}
      >
        <div className="admin-mobile-head">
          <Link
            to="/"
            className="nav-logo"
            onClick={() => setMenuOpen(false)}
          >
            <span className="nav-logo-icon">🛕</span>
            <div>
              <span className="nav-logo-name">BharatMandir</span>
              <span className="nav-logo-sub">{t('nav.logo_sub')}</span>
            </div>
          </Link>

          <button
            type="button"
            className="admin-mobile-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close admin menu"
          >
            <X size={22} />
          </button>
        </div>

        <div className="admin-mobile-profile">
          <span className="admin-avatar">
            {(admin?.name || admin?.email || 'A').charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>{admin?.name || 'Administrator'}</strong>
            <small>{admin?.email}</small>
          </div>
        </div>

        <nav className="admin-mobile-links">
          {ADMIN_LINKS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`admin-mobile-link${isActive(to) ? ' active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}

          <button
            type="button"
            className="admin-mobile-link"
            onClick={() => window.location.reload()}
          >
            <RefreshCw size={18} />
            Refresh
          </button>

          <button
            type="button"
            className="admin-mobile-link danger"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            Logout
          </button>
        </nav>

        <select
          className="nav-lang-select admin-mobile-language"
          value={lang}
          onChange={(event) => changeLang(event.target.value)}
        >
          <option value="en">🌐 English</option>
          <option value="hi">🇮🇳 हिंदी</option>
          <option value="mr">🟠 मराठी</option>
          <option value="ta">🌺 தமிழ்</option>
        </select>
      </aside>

      <style>{`
        .admin-navbar {
          background: #ffffff;
          border-bottom: 1px solid #f0dfcb;
          box-shadow: 0 3px 16px rgba(70, 30, 4, 0.07);
          position: relative;
          z-index: 1000;
        }

        .admin-navbar-inner {
          max-width: 1280px;
          min-height: 72px;
          margin: 0 auto;
          padding: 9px 24px;
          display: flex;
          align-items: center;
          gap: 18px;
          box-sizing: border-box;
        }

        .admin-navbar .nav-logo {
          flex-shrink: 0;
        }

        .admin-navbar-links {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .admin-nav-item {
          min-height: 40px;
          padding: 0 14px;
          border: 1px solid transparent;
          border-radius: 50px;
          background: transparent;
          color: #5c3010;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          text-decoration: none;
          white-space: nowrap;
          font: 700 13px/1 'DM Sans', sans-serif;
          cursor: pointer;
          transition: 0.18s ease;
        }

        .admin-nav-item:hover {
          color: #b74a08;
          background: #fff5e9;
          border-color: #efd2b4;
          transform: translateY(-1px);
        }

        .admin-nav-item.active {
          color: #ffffff;
          background: linear-gradient(135deg, #df650d, #a93d04);
          box-shadow: 0 4px 13px rgba(190, 70, 5, 0.24);
        }

        .admin-nav-item.secondary {
          background: #ffffff;
          border-color: #e8c8a8;
        }

        .admin-nav-item.danger {
          color: #c42121;
          background: #fff8f8;
          border-color: #f7b8b8;
        }

        .admin-navbar-account {
          display: flex;
          align-items: center;
          gap: 9px;
          flex-shrink: 0;
        }

        .admin-avatar {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ef7a24, #9f3803);
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font: 800 14px/1 'DM Sans', sans-serif;
          flex-shrink: 0;
          box-shadow: 0 3px 10px rgba(177, 65, 7, 0.2);
        }

        .admin-hamburger {
          display: none;
          margin-left: auto;
        }

        .admin-menu-overlay {
          position: fixed;
          inset: 0;
          z-index: 1090;
          background: rgba(24, 9, 0, 0.55);
          backdrop-filter: blur(2px);
        }

        .admin-mobile-menu {
          position: fixed;
          top: 0;
          right: -340px;
          z-index: 1100;
          width: min(330px, 88vw);
          height: 100vh;
          padding: 18px;
          box-sizing: border-box;
          background: #fffaf4;
          box-shadow: -12px 0 40px rgba(40, 15, 0, 0.2);
          transition: right 0.24s ease;
          overflow-y: auto;
        }

        .admin-mobile-menu.open {
          right: 0;
        }

        .admin-mobile-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-bottom: 16px;
          border-bottom: 1px solid #eadbc9;
        }

        .admin-mobile-close {
          width: 38px;
          height: 38px;
          border: 1px solid #e7cfb7;
          border-radius: 10px;
          background: #ffffff;
          color: #6c3511;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .admin-mobile-profile {
          margin: 18px 0;
          padding: 13px;
          border: 1px solid #ecd8c1;
          border-radius: 13px;
          background: #ffffff;
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .admin-mobile-profile strong,
        .admin-mobile-profile small {
          display: block;
        }

        .admin-mobile-profile strong {
          color: #3d1b04;
          font-size: 14px;
        }

        .admin-mobile-profile small {
          max-width: 190px;
          margin-top: 3px;
          color: #936b4d;
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .admin-mobile-links {
          display: grid;
          gap: 7px;
        }

        .admin-mobile-link {
          width: 100%;
          min-height: 46px;
          padding: 0 14px;
          border: 1px solid transparent;
          border-radius: 11px;
          background: transparent;
          color: #5c3010;
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          text-align: left;
          font: 700 14px/1 'DM Sans', sans-serif;
          cursor: pointer;
        }

        .admin-mobile-link:hover,
        .admin-mobile-link.active {
          color: #b54806;
          background: #fff0df;
          border-color: #edcfad;
        }

        .admin-mobile-link.danger {
          color: #c32121;
        }

        .admin-mobile-language {
          width: 100%;
          margin-top: 22px;
        }

        @media (max-width: 1120px) {
          .admin-navbar-links,
          .admin-navbar-account {
            display: none;
          }

          .admin-hamburger {
            display: inline-flex;
          }
        }
      `}</style>
    </>
  );
}
