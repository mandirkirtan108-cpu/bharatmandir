import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function Navbar() {
  const [query,    setQuery]    = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();
  const { t, i18n } = useTranslation();

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  };

  const isActive = (path) => location.pathname === path;

  const NAV_LINKS = [
    { to: '/',       label: t('nav.home') },
    { to: '/search', label: t('nav.search') },
    { to: '/map',    label: t('nav.map') },
  ];

  const LANGUAGES = [
    { code: 'en', label: 'EN' },
    { code: 'hi', label: 'हि' },
    { code: 'mr', label: 'म' },
    { code: 'ta', label: 'த' },
  ];

  const tickerText = '🔱 OM NAMAH SHIVAYA  ·  JAI SHRI RAM  ·  HAR HAR MAHADEV  ·  JAI MATA DI  ·  JAI GANESH  ·  HARE KRISHNA HARE RAM  ·  ';

  return (
    <>
      {/* Scrolling Ticker */}
      <div className="ticker-wrap">
        <div className="ticker-track">
          <span className="ticker-content">{tickerText}{tickerText}</span>
        </div>
      </div>

      <nav className="navbar">
        <div className="navbar-inner">

          {/* Logo */}
          <Link to="/" className="nav-logo">
            <span className="nav-logo-icon">🛕</span>
            <div>
              <span className="nav-logo-name">BharatMandir</span>
              <span className="nav-logo-sub">{t('nav.logo_sub')}</span>
            </div>
          </Link>

          {/* Search */}
          <form className="nav-search-form" onSubmit={handleSearch}>
            <Search size={16} className="nav-search-icon" />
            <input
              className="nav-search-input"
              type="text"
              placeholder={t('search_placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>

          {/* Nav Links + Language Switcher */}
          <div className="nav-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {NAV_LINKS.map(link => (
              <Link
                key={link.to}
                to={link.to}
                style={{
                  padding: '8px 16px',
                  borderRadius: 50,
                  fontFamily: 'var(--font-display)',
                  fontSize: 12,
                  letterSpacing: '.05em',
                  textDecoration: 'none',
                  transition: 'var(--transition)',
                  background: isActive(link.to) ? 'var(--saffron)' : 'transparent',
                  color: isActive(link.to) ? 'white' : 'var(--text-mid)',
                  border: `2px solid ${isActive(link.to) ? 'var(--saffron)' : 'var(--cream-dark)'}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {link.label}
              </Link>
            ))}

            {/* Language Switcher */}
            <div style={{ display: 'flex', gap: 4, borderLeft: '1px solid var(--cream-dark)', paddingLeft: 8 }}>
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => i18n.changeLanguage(lang.code)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 50,
                    fontSize: 11,
                    fontWeight: i18n.language === lang.code ? 700 : 400,
                    background: i18n.language === lang.code ? 'var(--saffron)' : 'transparent',
                    color: i18n.language === lang.code ? 'white' : 'var(--text-mid)',
                    border: `1px solid ${i18n.language === lang.code ? 'var(--saffron)' : 'var(--cream-dark)'}`,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </div>

        </div>
      </nav>
    </>
  );
}