import { Navigate, useLocation } from 'react-router-dom';

/**
 * Protects administrator-only routes.
 * Redirects unauthenticated administrators to /admin/login while preserving
 * the current location so they can return after signing in.
 */
export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const token = sessionStorage.getItem('bm_access_token');

  if (!token) {
    return (
      <Navigate
        to="/admin/login"
        state={{ from: location }}
        replace
      />
    );
  }

  return children;
}
