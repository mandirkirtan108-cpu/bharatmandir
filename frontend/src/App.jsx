import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LangProvider } from './LangContext';
import HomePage              from './pages/HomePage';
import TempleDetailPage      from './pages/TempleDetailPage';
import TempleQRPage          from './pages/TempleQRPage';
import MapPage               from './pages/MapPage';
import SearchPage            from './pages/SearchPage';
import RoutePlannerPage      from './pages/RoutePlannerPage';
import AdminAddTemplePage    from './pages/AdminAddTemplePage';
import PanchangPage          from './pages/PanchangPage';
import SpiritualGuidePage    from './pages/SpiritualGuidePage';
import FestivalCalendarPage  from './pages/FestivalCalendarPage';
import AdminAddFestivalPage  from './pages/AdminAddFestivalPage';

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"                   element={<HomePage />} />
          <Route path="/temple/:slug"       element={<TempleDetailPage />} />
          <Route path="/qr/:slug"           element={<TempleQRPage />} />
          <Route path="/map"                element={<MapPage />} />
          <Route path="/search"             element={<SearchPage />} />
          <Route path="/route-planner"      element={<RoutePlannerPage />} />
          <Route path="/admin/add"          element={<AdminAddTemplePage />} />
          <Route path="/panchang"           element={<PanchangPage />} />
          <Route path="/spiritual-guide"    element={<SpiritualGuidePage />} />
          <Route path="/festivals"          element={<FestivalCalendarPage />} />
          <Route path="/admin/add-festival" element={<AdminAddFestivalPage />} />
        </Routes>
      </BrowserRouter>
    </LangProvider>
  );
}