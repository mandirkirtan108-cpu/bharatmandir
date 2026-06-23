import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LangProvider }          from './LangContext';
import ProtectedRoute            from './components/ProtectedRoute';
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
import BlogPage                  from './pages/BlogPage';
import AdminAddBlogPage          from './pages/AdminAddBlogPage';

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Routes>

          {/* ── Root ────────────────────────────────────────── */}
          <Route path="/"                element={<HomePage />} />

          {/* ── Fully Public Routes ─────────────────────────── */}
          <Route path="/qr/:slug"        element={<TempleQRPage />} />
          <Route path="/login"           element={<LoginPage />} />
          <Route path="/signup"          element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* ── Admin Login — public ────────────────────────── */}
          <Route path="/admin/login"     element={<AdminLoginPage />} />

          {/* ── User Routes — public (no login required) ────── */}
          <Route path="/temple/:slug"    element={<TempleDetailPage />} />
          <Route path="/search"          element={<SearchPage />} />
          <Route path="/route-planner"   element={<RoutePlannerPage />} />
          <Route path="/panchang"        element={<PanchangPage />} />
          <Route path="/spiritual-guide" element={<SpiritualGuidePage />} />
          <Route path="/festivals"       element={<FestivalCalendarPage />} />
          <Route path="/sacred-books"    element={<SacredBooksPage />} />
          <Route path="/profile"         element={<UserProfilePage />} />

          {/* ── Blog (public) ───────────────────────────────── */}
          <Route path="/blog"            element={<BlogPage />} />

          {/* ── Protected Admin Routes ──────────────────────── */}
          <Route path="/admin/add" element={
            <ProtectedRoute><AdminAddTemplePage /></ProtectedRoute>
          } />
          <Route path="/admin/add-festival" element={
            <ProtectedRoute><AdminAddFestivalPage /></ProtectedRoute>
          } />
          <Route path="/admin/add-blog" element={
            <ProtectedRoute><AdminAddBlogPage /></ProtectedRoute>
          } />
          <Route path="/admin/panel" element={
            <ProtectedRoute><AdminPanelPage /></ProtectedRoute>
          } />

        </Routes>
      </BrowserRouter>
    </LangProvider>
  );
}