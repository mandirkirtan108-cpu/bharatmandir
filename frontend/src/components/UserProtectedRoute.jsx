import { Navigate, useLocation } from 'react-router-dom';
import { userAuthAPI } from '../services/api';

// Protect user-only routes by checking the current user session.
export default function UserProtectedRoute({ children }) {
  const location = useLocation();
  const user = userAuthAPI.getUser();

  if (!user) {
    return (
      <Navigate
        to="/login"
        state={{ from: location }}
        replace
      />
    );
  }

  return children;
}
