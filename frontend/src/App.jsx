import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LangProvider }          from './LangContext';
import ProtectedRoute            from './components/ProtectedRoute';
import HomePage                  from './pages/HomePage';
import TempleDetailPage          from './pages/TempleDetailPage';
import TempleQRPage               from './pages/TempleQRPage';
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
import SacredBookCategoryPage    from './pages/SacredBookCategoryPage';
import SacredBookReaderPage      from './pages/SacredBookReaderPage';
import LoginPage                 from './pages/LoginPage';
import SignupPage                from './pages/SignupPage';
import UserProfilePage           from './pages/UserProfilePage';
import ForgotPasswordPage        from './pages/ForgotPasswordPage';
import BlogPage                  from './pages/BlogPage';
import AdminAddBlogPage          from './pages/AdminAddBlogPage';
import VolunteerProtectedRoute   from './components/volunteer/VolunteerProtectedRoute';
import VolunteerLoginPage        from './pages/volunteer/VolunteerLoginPage';
import VolunteerSignupPage       from './pages/volunteer/VolunteerSignupPage';
import VolunteerDashboardPage    from './pages/volunteer/VolunteerDashboardPage';
import VolunteerAddTemplePage    from './pages/volunteer/VolunteerAddTemplePage';
import VolunteerSubmissionsPage  from './pages/volunteer/VolunteerSubmissionsPage';
import VolunteerProfilePage      from './pages/volunteer/VolunteerProfilePage';

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
          <Route path="/profile"         element={<UserProfilePage />} />

          {/* ── Sacred Books Library — 3-level nested routes ──
              /sacred-books                     → category folders (Purana, Chalisa, Ved, Upanishad...)
              /sacred-books/:category           → all books inside that folder
              /sacred-books/:category/:slug     → verse-by-verse reader for one book
          ─────────────────────────────────────────────────── */}
          <Route path="/sacred-books"                element={<SacredBooksPage />} />
          <Route path="/sacred-books/:category"       element={<SacredBookCategoryPage />} />
          <Route path="/sacred-books/:category/:slug" element={<SacredBookReaderPage />} />

          {/* ── Blog (public) ───────────────────────────────── */}
          <Route path="/blog"            element={<BlogPage />} />

          <Route path="/volunteer/login" element={<VolunteerLoginPage />} />
          <Route path="/volunteer/signup" element={<VolunteerSignupPage />} />
          <Route path="/volunteer" element={<VolunteerProtectedRoute><VolunteerDashboardPage /></VolunteerProtectedRoute>} />
          <Route path="/volunteer/add-temple" element={<VolunteerProtectedRoute><VolunteerAddTemplePage /></VolunteerProtectedRoute>} />
          <Route path="/volunteer/submissions" element={<VolunteerProtectedRoute><VolunteerSubmissionsPage /></VolunteerProtectedRoute>} />
          <Route path="/volunteer/profile" element={<VolunteerProtectedRoute><VolunteerProfilePage /></VolunteerProtectedRoute>} />

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
