import { Navigate, useLocation } from 'react-router-dom';

/**
 * ProtectedRoute — Admin-only routes guard karta hai.
 * Token nahi → /admin/login pe redirect, current path save hota hai.
 * Login ke baad wapas same page pe aa sakte ho.
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