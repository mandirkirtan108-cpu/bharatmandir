import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Search, Map } from 'lucide-react';

export default function Navbar() {
  const [query,    setQuery]    = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate  = useNavigate();
  const location  = useLocation();

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  };

  const isActive = (path) => location.pathname === path;

  const NAV_LINKS = [
    { to: '/',              label: 'Home' },
    { to: '/search',        label: '🔍 Search' },
    { to: '/map',           label: '🗺️ Map View' },
    { to: '/route-planner', label: '🛣️ Route Planner' },
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
              <span className="nav-logo-sub">Temple Discovery Platform</span>
            </div>
          </Link>

          {/* Search */}
          <form className="nav-search-form" onSubmit={handleSearch}>
            <Search size={16} className="nav-search-icon" />
            <input
              className="nav-search-input"
              type="text"
              placeholder="Search temples, deities, cities..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>

          {/* Nav Links */}
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
          </div>

        </div>
      </nav>
    </>
  );
}