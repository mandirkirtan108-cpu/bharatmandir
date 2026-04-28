import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Navigation, MapPin, Layers, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import { templeAPI } from '../services/api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const makeIcon = (color, size = 32) => L.divIcon({
  className: '',
  html: `<div style="width:${size}px;height:${size}px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><div style="transform:rotate(45deg);font-size:${size*0.42}px;line-height:1;">🛕</div></div>`,
  iconSize: [size, size], iconAnchor: [size/2, size], popupAnchor: [0, -size],
});

const ICONS = {
  jyotirlinga: makeIcon('#C8960C', 36),
  shaktipeeth: makeIcon('#9B1C1C', 34),
  normal:      makeIcon('#E8650A', 30),
  user: L.divIcon({
    className: '',
    html: `<div style="width:20px;height:20px;background:#2563EB;border-radius:50%;border:3px solid white;box-shadow:0 0 0 4px rgba(37,99,235,0.25);"></div>`,
    iconSize: [20,20], iconAnchor: [10,10],
  }),
};

function FlyTo({ center, zoom }) {
  const map = useMap();
  useEffect(() => { if (center) map.flyTo(center, zoom, { duration: 1.4 }); }, [center, zoom, map]);
  return null;
}

function UserMarker({ position }) {
  const map = useMap();
  const circleRef = useRef(null);
  useEffect(() => {
    if (!position) return;
    if (circleRef.current) circleRef.current.remove();
    circleRef.current = L.circle(position, { radius: 500, color: '#2563EB', fillColor: '#2563EB', fillOpacity: 0.1, weight: 2 }).addTo(map);
    return () => circleRef.current?.remove();
  }, [position, map]);
  return position ? (
    <Marker position={position} icon={ICONS.user}>
      <Popup><div style={{ padding: 8, fontFamily: 'var(--font-display)', fontSize: 13, color: '#2563EB', fontWeight: 700 }}>📍 You are here</div></Popup>
    </Marker>
  ) : null;
}

export default function MapPage() {
  const navigate = useNavigate();
  const { t }    = useTranslation();

  const [temples,    setTemples]    = useState([]);
  const [nearby,     setNearby]     = useState([]);
  const [userPos,    setUserPos]    = useState(null);
  const [flyTo,      setFlyTo]      = useState({ center: [22.5, 80.0], zoom: 5 });
  const [loading,    setLoading]    = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsActive,  setGpsActive]  = useState(false);
  const [nearbyLoad, setNearbyLoad] = useState(false);
  const [showLegend, setShowLegend] = useState(true);
  const [tileLayer,  setTileLayer]  = useState('streets');

  const TILES = {
    streets:   { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',  attr: '© OpenStreetMap contributors', label: t('map.streets') },
    satellite: { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attr: 'Tiles © Esri', label: t('map.satellite') },
  };

  useEffect(() => {
    templeAPI.getAll({ per_page: 200 })
      .then(res => setTemples(res.data.temples || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleNearMe = () => {
    if (!navigator.geolocation) { alert(t('map.geo_unsupported')); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setUserPos([lat, lng]);
        setFlyTo({ center: [lat, lng], zoom: 11 });
        setGpsActive(true);
        setGpsLoading(false);
        setNearbyLoad(true);
        try {
          const res = await templeAPI.getNearby(lat, lng, 50);
          setNearby(res.data || []);
        } catch { setNearby([]); }
        finally { setNearbyLoad(false); }
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === 1) alert(t('map.geo_denied'));
        else                alert(t('map.geo_error'));
      },
      { timeout: 10000, maximumAge: 60000 }
    );
  };

  const clearNearby = () => { setGpsActive(false); setUserPos(null); setNearby([]); setFlyTo({ center: [22.5, 80.0], zoom: 5 }); };
  const getIcon = (t) => { if (t.is_jyotirlinga) return ICONS.jyotirlinga; if (t.is_shaktipeeth) return ICONS.shaktipeeth; return ICONS.normal; };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Navbar />

      <div className="map-topbar">
        <span className="map-topbar-title">🗺️ {t('map.title')}</span>
        <button className={`gps-btn ${gpsLoading ? 'loading' : ''} ${gpsActive ? 'active' : ''}`} onClick={gpsActive ? clearNearby : handleNearMe} disabled={gpsLoading}>
          <Navigation size={14} />
          {gpsLoading ? t('map.getting_location') : gpsActive ? t('map.clear_nearby') : t('map.near_me')}
        </button>
        <button className="gps-btn" onClick={() => setTileLayer(t => t === 'streets' ? 'satellite' : 'streets')}>
          <Layers size={14} />
          {tileLayer === 'streets' ? t('map.satellite_view') : t('map.street_view')}
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-light)' }}>
          {loading ? t('loading') : t('map.temples_on_map', { count: temples.length })}
          {gpsActive && nearby.length > 0 && ` · ${nearby.length} ${t('map.nearby')}`}
        </span>
      </div>

      <div className="map-container">
        <MapContainer center={[22.5, 80.0]} zoom={5} style={{ height: '100%', width: '100%' }} zoomControl>
          <TileLayer key={tileLayer} url={TILES[tileLayer].url} attribution={TILES[tileLayer].attr} maxZoom={19} />
          <FlyTo center={flyTo.center} zoom={flyTo.zoom} />
          {userPos && <UserMarker position={userPos} />}
          {temples.map((temple) => {
            if (!temple.latitude || !temple.longitude) return null;
            return (
              <Marker key={temple.id} position={[temple.latitude, temple.longitude]} icon={getIcon(temple)}>
                <Popup maxWidth={260}>
                  <div className="map-popup">
                    <div className="map-popup-image">
                      {temple.hero_image_url
                        ? <img src={temple.hero_image_url} alt={temple.name} onError={e => { e.target.style.display='none'; }} />
                        : <span>🛕</span>}
                    </div>
                    <div className="map-popup-body">
                      {temple.primary_deity && <div className="map-popup-deity">🙏 {temple.primary_deity}</div>}
                      <div className="map-popup-name">{temple.name}</div>
                      <div className="map-popup-loc"><MapPin size={10} /> {temple.city}, {temple.state}</div>
                      {(temple.category_tags || []).length > 0 && (
                        <div className="map-popup-tags">
                          {(temple.category_tags || []).slice(0,3).map(tag => <span key={tag} className="map-popup-tag">{tag}</span>)}
                        </div>
                      )}
                      {temple.slug && (
                        <Link to={`/temple/${temple.slug}`} className="map-popup-btn">
                          {t('map.view_details')} →
                        </Link>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

        {gpsActive && (
          <div className="nearby-panel">
            <div className="nearby-card">
              <div className="nearby-header">
                <span className="nearby-header-title">📍 {t('map.nearby_title')}</span>
                <button onClick={clearNearby} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={16} /></button>
              </div>
              {nearbyLoad && (
                <div className="nearby-loading">
                  <div className="spinner" style={{ width: 24, height: 24, borderWidth: 3, margin: '0 auto 8px' }} />
                  {t('map.finding_nearby')}
                </div>
              )}
              {!nearbyLoad && nearby.length === 0 && <div className="nearby-loading">{t('map.no_nearby')}</div>}
              {!nearbyLoad && nearby.length > 0 && (
                <div className="nearby-list">
                  {nearby.map((t) => (
                    <Link key={t.id} to={`/temple/${t.slug}`} className="nearby-item">
                      <div className="nearby-icon">🛕</div>
                      <div className="nearby-info">
                        <div className="nearby-name">{t.name}</div>
                        <div className="nearby-dist">📍 {t.distance_km} km away · {t.city}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {showLegend && (
          <div className="map-legend">
            <div className="legend-title">{t('map.legend')}</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#C8960C' }} />{t('badge.jyotirlinga')}</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#9B1C1C' }} />{t('badge.shaktipeeth')}</div>
            <div className="legend-item"><div className="legend-dot" style={{ background: '#E8650A' }} />{t('card.temple')}</div>
            {userPos && <div className="legend-item"><div className="legend-dot" style={{ background: '#2563EB' }} />{t('map.your_location')}</div>}
            <button onClick={() => setShowLegend(false)} style={{ marginTop: 8, fontSize: 11, color: 'var(--text-light)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-display)' }}>
              {t('map.hide')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}