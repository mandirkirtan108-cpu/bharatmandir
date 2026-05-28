import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LangProvider }          from './LangContext';
import ProtectedRoute            from './components/ProtectedRoute';
import UserProtectedRoute        from './components/UserProtectedRoute';
import HomePage                  from './pages/HomePage';
import TempleDetailPage          from './pages/TempleDetailPage';
import TempleQRPage              from './pages/TempleQRPage';
import SearchPage                from './pages/SearchPage';
import RoutePlannerPage          from './pages/RoutePlannerPage';
import AdminAddTemplePage        from './pages/AdminAddTemplePage';
import PanchangPage              from './pages/PanchangPage';
import SpiritualGuidePage        from './pages/SpiritualGuidePage';
import FestivalCalendarPage      from './pages/FestivalCalendarPage';
import AdminAddFestivalPage      from './pages/AdminAddFestivalPage';
import AdminPanelPage            from './pages/AdminPanelPage';
import AdminLoginPage            from './pages/AdminLoginPage';
import SacredBooksPage           from './pages/SacredBooksPage';
import LoginPage                 from './pages/LoginPage';
import SignupPage                from './pages/SignupPage';
import UserProfilePage           from './pages/UserProfilePage';
import ForgotPasswordPage        from './pages/ForgotPasswordPage';

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Routes>

          {/* ── Root — seedha HomePage ──────────────────────── */}
          <Route path="/"                element={<HomePage />} />

          {/* ── Fully Public Routes ─────────────────────────── */}
          <Route path="/qr/:slug"        element={<TempleQRPage />} />
          <Route path="/login"           element={<LoginPage />} />
          <Route path="/signup"          element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* ── Admin Login — public ────────────────────────── */}
          <Route path="/admin/login"     element={<AdminLoginPage />} />

          {/* ── Protected User Routes ───────────────────────── */}
          <Route path="/temple/:slug"    element={<UserProtectedRoute><TempleDetailPage /></UserProtectedRoute>} />
          <Route path="/search"          element={<UserProtectedRoute><SearchPage /></UserProtectedRoute>} />
          <Route path="/route-planner"   element={<UserProtectedRoute><RoutePlannerPage /></UserProtectedRoute>} />
          <Route path="/panchang"        element={<UserProtectedRoute><PanchangPage /></UserProtectedRoute>} />
          <Route path="/spiritual-guide" element={<UserProtectedRoute><SpiritualGuidePage /></UserProtectedRoute>} />
          <Route path="/festivals"       element={<UserProtectedRoute><FestivalCalendarPage /></UserProtectedRoute>} />
          <Route path="/sacred-books"    element={<UserProtectedRoute><SacredBooksPage /></UserProtectedRoute>} />
          <Route path="/profile"         element={<UserProtectedRoute><UserProfilePage /></UserProtectedRoute>} />

          {/* ── Protected Admin Routes ──────────────────────── */}
          <Route path="/admin/add" element={
            <ProtectedRoute><AdminAddTemplePage /></ProtectedRoute>
          } />
          <Route path="/admin/add-festival" element={
            <ProtectedRoute><AdminAddFestivalPage /></ProtectedRoute>
          } />
          <Route path="/admin/panel" element={
            <ProtectedRoute><AdminPanelPage /></ProtectedRoute>
          } />

        </Routes>
      </BrowserRouter>
    </LangProvider>
  );
}