import { Navigate, useLocation } from 'react-router-dom';
import useVolunteerAuth from '../../hooks/useVolunteerAuth';

export default function VolunteerProtectedRoute({ children }) {
  const location = useLocation();

  const {
    isLoggedIn,
    loading,
  } = useVolunteerAuth();

  if (loading) {
    return (
      <main style={styles.loadingPage}>
        <div style={styles.loader} />

        <p style={styles.loadingText}>
          Loading the volunteer portal...
        </p>
      </main>
    );
  }

  if (!isLoggedIn) {
    return (
      <Navigate
        to="/volunteer/login"
        state={{ from: location }}
        replace
      />
    );
  }

  return children;
}

const styles = {
  loadingPage: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    alignContent: 'center',
    gap: 14,
    background:
      'linear-gradient(135deg, #1A0A00, #4B2105)',
  },

  loader: {
    width: 42,
    height: 42,
    border:
      '4px solid rgba(255, 153, 0, 0.2)',
    borderTopColor: '#FF9900',
    borderRadius: '50%',
    animation:
      'volunteer-spin 0.8s linear infinite',
  },

  loadingText: {
    color:
      'rgba(255, 255, 255, 0.72)',
    fontSize: 13,
  },
};
