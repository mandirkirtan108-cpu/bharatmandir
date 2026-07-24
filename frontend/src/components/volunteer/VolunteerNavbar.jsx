import { useState } from 'react';

import {
  Link,
  NavLink,
  useNavigate,
} from 'react-router-dom';

import {
  FileText,
  Home,
  Landmark,
  LogOut,
  Menu,
  Plus,
  UserRound,
  X,
} from 'lucide-react';

import useVolunteerAuth from '../../hooks/useVolunteerAuth';

const navigationItems = [
  {
    path: '/volunteer',
    label: 'Dashboard',
    icon: Home,
    end: true,
  },
  {
    path: '/volunteer/add-temple',
    label: 'Add Temple',
    icon: Plus,
  },
  {
    path: '/volunteer/submissions',
    label: 'My Submissions',
    icon: FileText,
  },
  {
    path: '/volunteer/profile',
    label: 'Profile',
    icon: UserRound,
  },
];

export default function VolunteerNavbar() {
  const [menuOpen, setMenuOpen] =
    useState(false);

  const {
    volunteer,
    logout,
  } = useVolunteerAuth();

  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();

    setMenuOpen(false);
    navigate('/volunteer/login', {
      replace: true,
    });
  };

  return (
    <header style={styles.header}>
      <div style={styles.container}>
        <Link
          to="/volunteer"
          style={styles.brand}
          onClick={() => setMenuOpen(false)}
        >
          <div style={styles.logoBox}>
            <Landmark size={23} />
          </div>

          <div>
            <strong style={styles.brandName}>
              BharatMandir
            </strong>

            <span style={styles.brandSubtitle}>
              VOLUNTEER PORTAL
            </span>
          </div>
        </Link>

        <button
          type="button"
          onClick={() =>
            setMenuOpen((current) => !current)
          }
          aria-label="Toggle navigation menu"
          style={styles.mobileMenuButton}
          className="volunteer-menu-button"
        >
          {menuOpen ? (
            <X size={22} />
          ) : (
            <Menu size={22} />
          )}
        </button>

        <div
          className={`volunteer-nav-content ${
            menuOpen ? 'volunteer-nav-open' : ''
          }`}
          style={styles.navigationContent}
        >
          <nav style={styles.navigation}>
            {navigationItems.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  onClick={() =>
                    setMenuOpen(false)
                  }
                  style={({ isActive }) => ({
                    ...styles.navLink,
                    ...(isActive
                      ? styles.activeNavLink
                      : {}),
                  })}
                >
                  <Icon size={15} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div style={styles.accountArea}>
            <div style={styles.avatar}>
              {(volunteer?.name || 'V')
                .charAt(0)
                .toUpperCase()}
            </div>

            <div style={styles.accountDetails}>
              <span style={styles.volunteerName}>
                {volunteer?.name || 'Volunteer'}
              </span>

              <span style={styles.accountRole}>
                Temple Volunteer
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              style={styles.logoutButton}
              title="Logout"
            >
              <LogOut size={16} />
              <span className="volunteer-logout-text">
                Logout
              </span>
            </button>
          </div>
        </div>
      </div>

      <style>
        {`
          .volunteer-menu-button {
            display: none !important;
          }

          @media (max-width: 900px) {
            .volunteer-menu-button {
              display: grid !important;
            }

            .volunteer-nav-content {
              display: none !important;
              width: 100% !important;
              padding-top: 14px !important;
              border-top: 1px solid #f0e2d1 !important;
            }

            .volunteer-nav-open {
              display: grid !important;
              gap: 14px !important;
            }

            .volunteer-nav-open nav {
              width: 100% !important;
              display: grid !important;
              grid-template-columns:
                repeat(2, minmax(0, 1fr)) !important;
            }

            .volunteer-nav-open > div {
              width: 100% !important;
              padding-top: 13px !important;
              border-top:
                1px solid #f0e2d1 !important;
            }
          }

          @media (max-width: 480px) {
            .volunteer-nav-open nav {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </header>
  );
}

const styles = {
  header: {
    position: 'relative',
    zIndex: 50,
    background: '#FFFFFF',
    borderTop: '4px solid #743006',
    borderBottom: '1px solid #EADDCF',
    boxShadow:
      '0 3px 12px rgba(60, 24, 4, 0.05)',
  },

  container: {
    maxWidth: 1180,
    minHeight: 72,
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 20,
    margin: '0 auto',
    padding: '0 22px',
  },

  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#9A3C05',
    textDecoration: 'none',
  },

  logoBox: {
    width: 42,
    height: 42,
    display: 'grid',
    placeItems: 'center',
    background:
      'linear-gradient(145deg, #F37A10, #A43B05)',
    borderRadius: 11,
    color: '#FFFFFF',
    boxShadow:
      '0 5px 14px rgba(180, 63, 5, 0.22)',
  },

  brandName: {
    display: 'block',
    fontFamily: 'Georgia, serif',
    fontSize: 21,
    lineHeight: 1,
  },

  brandSubtitle: {
    display: 'block',
    marginTop: 4,
    color: '#A87A5D',
    fontSize: 9,
    fontWeight: 800,
    letterSpacing: '0.12em',
  },

  mobileMenuButton: {
    width: 40,
    height: 40,
    placeItems: 'center',
    marginLeft: 'auto',
    background: '#FFF4E9',
    border: '1px solid #ECD4BB',
    borderRadius: 10,
    color: '#A94208',
    cursor: 'pointer',
  },

  navigationContent: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    gap: 20,
  },

  navigation: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    marginLeft: 'auto',
  },

  navLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 11px',
    borderRadius: 9,
    color: '#68432A',
    fontSize: 12,
    fontWeight: 700,
    textDecoration: 'none',
  },

  activeNavLink: {
    background: '#C8520A',
    color: '#FFFFFF',
    boxShadow:
      '0 4px 12px rgba(200, 82, 10, 0.2)',
  },

  accountArea: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
  },

  avatar: {
    width: 34,
    height: 34,
    display: 'grid',
    placeItems: 'center',
    flexShrink: 0,
    background: '#FFF0E5',
    border: '1px solid #EBCBAD',
    borderRadius: '50%',
    color: '#B74507',
    fontSize: 13,
    fontWeight: 800,
  },

  accountDetails: {
    display: 'grid',
  },

  volunteerName: {
    maxWidth: 110,
    overflow: 'hidden',
    color: '#48220C',
    fontSize: 12,
    fontWeight: 700,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  accountRole: {
    color: '#A07A60',
    fontSize: 9,
  },

  logoutButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '8px 10px',
    background: '#FFF4E9',
    border: '1px solid #ECD4BB',
    borderRadius: 8,
    color: '#A94208',
    fontSize: 11,
    fontWeight: 700,
    cursor: 'pointer',
  },
};
 