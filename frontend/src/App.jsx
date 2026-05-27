import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LangProvider } from './LangContext';
import { AuthProvider } from './AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import HomePage           from './pages/HomePage';
import TempleDetailPage   from './pages/TempleDetailPage';
import TempleQRPage       from './pages/TempleQRPage';
import MapPage            from './pages/MapPage';
import SearchPage         from './pages/SearchPage';
import RoutePlannerPage   from './pages/RoutePlannerPage';
import AdminAddTemplePage from './pages/Adminaddtemplepage';
import PanchangPage       from './pages/PanchangPage';
import SpiritualGuidePage from './pages/SpiritualGuidePage';
import AuthPage           from './pages/AuthPage';

export default function App() {
  return (
    <AuthProvider>
      <LangProvider>
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/"             element={<HomePage />} />
            <Route path="/auth"         element={<AuthPage />} />
            <Route path="/search"       element={<SearchPage />} />
            <Route path="/temple/:slug" element={<TempleDetailPage />} />
            <Route path="/qr/:slug"     element={<TempleQRPage />} />

            {/* Protected routes — require sign-in */}
            <Route path="/map"             element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
            <Route path="/route-planner"   element={<ProtectedRoute><RoutePlannerPage /></ProtectedRoute>} />
            <Route path="/panchang"        element={<ProtectedRoute><PanchangPage /></ProtectedRoute>} />
            <Route path="/spiritual-guide" element={<ProtectedRoute><SpiritualGuidePage /></ProtectedRoute>} />
            <Route path="/admin/add"       element={<ProtectedRoute><AdminAddTemplePage /></ProtectedRoute>} />
          </Routes>
        </BrowserRouter>
      </LangProvider>
    </AuthProvider>
  );
}