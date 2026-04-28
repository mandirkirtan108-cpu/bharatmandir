import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage          from './pages/HomePage';
import TempleDetailPage  from './pages/TempleDetailPage';
import TempleQRPage      from './pages/TempleQRPage';
import MapPage           from './pages/MapPage';
import SearchPage        from './pages/SearchPage';
import RoutePlannerPage  from './pages/RoutePlannerPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"             element={<HomePage />} />
        <Route path="/temple/:slug" element={<TempleDetailPage />} />
        <Route path="/qr/:slug"     element={<TempleQRPage />} />
        <Route path="/map"          element={<MapPage />} />
        <Route path="/search"       element={<SearchPage />} />
        <Route path="/route-planner" element={<RoutePlannerPage />} />
      </Routes>
    </BrowserRouter>
  );
}