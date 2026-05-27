import { useAuth } from '../AuthContext';
import { useLocation, Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }
  return children;
}