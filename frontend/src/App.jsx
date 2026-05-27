import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LangProvider }           from './LangContext';
import ProtectedRoute             from './components/ProtectedRoute';
import HomePage                   from './pages/HomePage';
import TempleDetailPage           from './pages/TempleDetailPage';
import TempleQRPage               from './pages/TempleQRPage';
import MapPage                    from './pages/MapPage';
import SearchPage                 from './pages/SearchPage';
import RoutePlannerPage           from './pages/RoutePlannerPage';
import AdminAddTemplePage         from './pages/AdminAddTemplePage';
import PanchangPage               from './pages/PanchangPage';
import SpiritualGuidePage         from './pages/SpiritualGuidePage';
import FestivalCalendarPage       from './pages/FestivalCalendarPage';
import AdminAddFestivalPage       from './pages/AdminAddFestivalPage';
import AdminPanelPage             from './pages/AdminPanelPage';
import AdminLoginPage             from './pages/AdminLoginPage';
import SacredBooksPage            from './pages/SacredBooksPage';
import LoginPage                  from './pages/LoginPage';
import SignupPage                 from './pages/SignupPage';

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Routes>

          {/* ── Public Routes (no login required) ─────────────── */}
          <Route path="/"                element={<HomePage />} />
          <Route path="/temple/:slug"    element={<TempleDetailPage />} />
          <Route path="/qr/:slug"        element={<TempleQRPage />} />
          <Route path="/map"             element={<MapPage />} />
          <Route path="/search"          element={<SearchPage />} />
          <Route path="/route-planner"   element={<RoutePlannerPage />} />
          <Route path="/panchang"        element={<PanchangPage />} />
          <Route path="/spiritual-guide" element={<SpiritualGuidePage />} />
          <Route path="/festivals"       element={<FestivalCalendarPage />} />
          <Route path="/sacred-books"    element={<SacredBooksPage />} />

          {/* ── User Auth ──────────────────────────────────────── */}
          <Route path="/login"           element={<LoginPage />} />
          <Route path="/signup"          element={<SignupPage />} />

          {/* ── Admin Login — public ───────────────────────────── */}
          <Route path="/admin/login"     element={<AdminLoginPage />} />

          {/* ── Protected Admin Routes ─────────────────────────── */}
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