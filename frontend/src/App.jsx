import {
  BrowserRouter,
  Route,
  Routes,
} from 'react-router-dom';

import { LangProvider } from './LangContext';

// Common protection
import ProtectedRoute from './components/ProtectedRoute';

// Public and user pages
import HomePage from './pages/HomePage';
import TempleDetailPage from './pages/TempleDetailPage';
import TempleQRPage from './pages/TempleQRPage';
import SearchPage from './pages/SearchPage';
import RoutePlannerPage from './pages/RoutePlannerPage';
import PanchangPage from './pages/PanchangPage';
import SpiritualGuidePage from './pages/SpiritualGuidePage';
import FestivalCalendarPage from './pages/FestivalCalendarPage';
import SacredBooksPage from './pages/SacredBooksPage';
import SacredBookCategoryPage from './pages/SacredBookCategoryPage';
import SacredBookReaderPage from './pages/SacredBookReaderPage';
import BlogPage from './pages/BlogPage';

// User authentication pages
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import UserProfilePage from './pages/UserProfilePage';

// Admin pages
import AdminLoginPage from './pages/AdminLoginPage';
import AdminPanelPage from './pages/AdminPanelPage';
import AdminAddTemplePage from './pages/AdminAddTemplePage';
import AdminAddFestivalPage from './pages/AdminAddFestivalPage';
import AdminAddBlogPage from './pages/AdminAddBlogPage';

// Volunteer protection
import VolunteerProtectedRoute from './components/volunteer/VolunteerProtectedRoute';

// Volunteer pages
import VolunteerLoginPage from './pages/volunteer/VolunteerLoginPage';
import VolunteerSignupPage from './pages/volunteer/VolunteerSignupPage';
import VolunteerDashboardPage from './pages/volunteer/VolunteerDashboardPage';
import VolunteerAddTemplePage from './pages/volunteer/VolunteerAddTemplePage';
import VolunteerSubmissionsPage from './pages/volunteer/VolunteerSubmissionsPage';
import VolunteerProfilePage from './pages/volunteer/VolunteerProfilePage';

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Routes>
          {/* Home page */}
          <Route
            path="/"
            element={<HomePage />}
          />

          {/* Public authentication routes */}
          <Route
            path="/login"
            element={<LoginPage />}
          />

          <Route
            path="/signup"
            element={<SignupPage />}
          />

          <Route
            path="/forgot-password"
            element={<ForgotPasswordPage />}
          />

          {/* Public QR route */}
          <Route
            path="/qr/:slug"
            element={<TempleQRPage />}
          />

          {/* Public BharatMandir pages */}
          <Route
            path="/temple/:slug"
            element={<TempleDetailPage />}
          />

          <Route
            path="/search"
            element={<SearchPage />}
          />

          <Route
            path="/route-planner"
            element={<RoutePlannerPage />}
          />

          <Route
            path="/panchang"
            element={<PanchangPage />}
          />

          <Route
            path="/spiritual-guide"
            element={<SpiritualGuidePage />}
          />

          <Route
            path="/festivals"
            element={<FestivalCalendarPage />}
          />

          <Route
            path="/profile"
            element={<UserProfilePage />}
          />

          {/* Sacred Books routes */}

          <Route
            path="/sacred-books"
            element={<SacredBooksPage />}
          />

          <Route
            path="/sacred-books/:category"
            element={
              <SacredBookCategoryPage />
            }
          />

          <Route
            path="/sacred-books/:category/:slug"
            element={
              <SacredBookReaderPage />
            }
          />

          {/* Public blog route */}
          <Route
            path="/blog"
            element={<BlogPage />}
          />

          {/* Admin public login route */}
          <Route
            path="/admin/login"
            element={<AdminLoginPage />}
          />

          {/* Protected admin routes */}

          <Route
            path="/admin/panel"
            element={
              <ProtectedRoute>
                <AdminPanelPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/add"
            element={
              <ProtectedRoute>
                <AdminAddTemplePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/add-festival"
            element={
              <ProtectedRoute>
                <AdminAddFestivalPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/add-blog"
            element={
              <ProtectedRoute>
                <AdminAddBlogPage />
              </ProtectedRoute>
            }
          />

          {/* Volunteer public authentication routes */}

          <Route
            path="/volunteer/login"
            element={<VolunteerLoginPage />}
          />

          <Route
            path="/volunteer/signup"
            element={<VolunteerSignupPage />}
          />

          {/* Protected volunteer routes */}

          <Route
            path="/volunteer"
            element={
              <VolunteerProtectedRoute>
                <VolunteerDashboardPage />
              </VolunteerProtectedRoute>
            }
          />

          <Route
            path="/volunteer/add-temple"
            element={
              <VolunteerProtectedRoute>
                <VolunteerAddTemplePage />
              </VolunteerProtectedRoute>
            }
          />

          <Route
            path="/volunteer/submissions"
            element={
              <VolunteerProtectedRoute>
                <VolunteerSubmissionsPage />
              </VolunteerProtectedRoute>
            }
          />

          <Route
            path="/volunteer/profile"
            element={
              <VolunteerProtectedRoute>
                <VolunteerProfilePage />
              </VolunteerProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </LangProvider>
  );
}