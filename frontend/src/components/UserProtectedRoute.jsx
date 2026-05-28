import { Navigate, useLocation } from 'react-router-dom';
import { userAuthAPI } from '../services/api';

// User-only guard — userAuthAPI se login check karta hai
export default function UserProtectedRoute({ children }) {
  const location = useLocation();
  const user = userAuthAPI.getUser();

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}