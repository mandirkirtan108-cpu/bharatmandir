import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../LangContext';

export default function Navbar() {
  const [query,    setQuery]   = useState('');
  const navigate   = useNavigate();
  const location   = useLocation();
  const { t }                  = useTranslation();
  const { lang, changeLang }   = useLang();

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  };

  const isActive = (path) => location.pathname === path;

  const NAV_LINKS = [
    { to: '/',              label: t('nav.home') },
    { to: '/search',        label: t('nav.search') },
    { to: '/map',           label: t('nav.map') },
    { to: '/route-planner', label: t('nav.route') },
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

          <form className="nav-search-form" onSubmit={handleSearch}>
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

          {/* nav-actions: NO inline style gap/flex — CSS handles it */}
          <div className="nav-actions">
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

        </div>
      </nav>
    </>
  );
}