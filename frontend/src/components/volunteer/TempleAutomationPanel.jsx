import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Bot, Camera, Check, Link2, LocateFixed, MapPin, Search, ShieldAlert, Sparkles } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

import { volunteerApi } from '../../services/volunteerApi';

const DEFAULT_CENTER = [22.9734, 78.6569];
const PREFERENCE_KEY = 'bm_volunteer_temple_preferences_v1';

function MapInteraction({ position, onPick }) {
  const map = useMap();
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });
  useEffect(() => {
    if (position) map.flyTo(position, 16, { duration: 0.8 });
  }, [map, position]);
  return position ? <CircleMarker center={position} radius={9} pathOptions={{ color: '#fff', fillColor: '#d45508', fillOpacity: 1, weight: 3 }} /> : null;
}

export default function TempleAutomationPanel({ form, onApply, onSuggestion, onPhoto }) {
  const [query, setQuery] = useState('');
  const [mapsLink, setMapsLink] = useState(form.google_maps_link || '');
  const [places, setPlaces] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState(null);
  const position = useMemo(() => {
    const lat = Number.parseFloat(form.latitude);
    const lon = Number.parseFloat(form.longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
  }, [form.latitude, form.longitude]);

  async function getNearbyTransportFields(latitude, longitude) {
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return {};
    }
    try {
      const { data } = await volunteerApi.findNearbyTransport(latitude, longitude);
      return {
        ...(data.nearest_railway ? { nearest_railway: data.nearest_railway } : {}),
        ...(data.nearest_airport ? { nearest_airport: data.nearest_airport } : {}),
        ...(data.nearest_bus_stand ? { nearest_bus_stand: data.nearest_bus_stand } : {}),
      };
    } catch {
      // Address auto-fill must still succeed when transport data is unavailable.
      return {};
    }
  }

  async function reverseAndApply(latitude, longitude, prefix = 'Location') {
    setBusy('location');
    setMessage('Detecting address and nearby transport...');
    try {
      const [{ data }, transportFields] = await Promise.all([
        volunteerApi.reverseGeocode(latitude, longitude),
        getNearbyTransportFields(latitude, longitude),
      ]);
      onApply({
        latitude: String(latitude.toFixed(7)),
        longitude: String(longitude.toFixed(7)),
        address: data.address || form.address,
        city: data.city || form.city,
        district: data.district || form.district,
        state: data.state || form.state,
        pincode: data.pincode || form.pincode,
        osm_id: data.osm_id || form.osm_id,
        google_maps_link: `https://www.google.com/maps?q=${latitude},${longitude}`,
        source: data.source || form.source,
        ...transportFields,
      });
      localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ state: data.state, district: data.district }));
      const transportCount = Object.keys(transportFields).length;
      setMessage(
        `${prefix}, address${transportCount ? ` and ${transportCount} nearby transport locations` : ''} applied. Review the fields before continuing.`
      );
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Address detection failed. Coordinates were still applied.');
      onApply({ latitude: String(latitude), longitude: String(longitude) });
    } finally {
      setBusy('');
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessage('GPS is not supported by this browser.');
      return;
    }
    setBusy('gps');
    setMessage('Waiting for GPS permission...');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => reverseAndApply(coords.latitude, coords.longitude, 'Current location'),
      (error) => {
        setBusy('');
        setMessage(error.message || 'Unable to access the current location.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }

  async function searchPlaces(event) {
    event?.preventDefault();
    if (query.trim().length < 3) return;
    setBusy('search');
    setMessage('Searching trusted place sources...');
    try {
      const { data } = await volunteerApi.searchPlaces(query.trim());
      setPlaces(data || []);
      setMessage(data?.length ? 'Select a result to fill the form.' : 'No matching place was found. Try a city or district in the search.');
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Place search failed.');
    } finally {
      setBusy('');
    }
  }

  async function applyMapsLink(event) {
    event?.preventDefault();
    if (!mapsLink.trim()) return;
    setBusy('maps-link');
    setMessage('Reading the Google Maps link, address and nearby transport...');
    try {
      const { data } = await volunteerApi.autofillFromMapsLink(mapsLink.trim());
      const transportFields = await getNearbyTransportFields(
        Number(data.latitude),
        Number(data.longitude),
      );
      onApply({
        name: data.name || form.name,
        address: data.address || data.display_name || form.address,
        city: data.city || form.city,
        district: data.district || form.district,
        state: data.state || form.state,
        pincode: data.pincode || form.pincode,
        latitude: String(data.latitude),
        longitude: String(data.longitude),
        google_maps_link: data.google_maps_link || mapsLink.trim(),
        source: data.source || form.source,
        ...transportFields,
      });
      localStorage.setItem(PREFERENCE_KEY, JSON.stringify({ state: data.state, district: data.district }));
      const transportCount = Object.keys(transportFields).length;
      setMessage(
        `Location details${transportCount ? ` and ${transportCount} nearby transport locations` : ''} filled successfully. Please review them before continuing.`
      );
    } catch (error) {
      setMessage(error.response?.data?.detail || 'This Google Maps link could not be read. Copy the link using Google Maps Share.');
    } finally {
      setBusy('');
    }
  }

  async function applyPlace(place) {
    let enriched = place;
    if (place.google_place_id) {
      try {
        const { data } = await volunteerApi.getPlaceDetails(place.google_place_id);
        enriched = { ...place, ...data };
        if (data.photo_reference && onPhoto) {
          const photoResponse = await volunteerApi.getPlacePhoto(data.photo_reference);
          onPhoto(new File([photoResponse.data], `${place.name || 'temple'}-google-place.jpg`, { type: photoResponse.data.type || 'image/jpeg' }));
        }
      } catch {
        setMessage('Basic place information was applied; full Google details were unavailable.');
      }
    }
    onApply({
      name: enriched.name || form.name,
      address: enriched.address || enriched.display_name || form.address,
      latitude: enriched.latitude != null ? String(enriched.latitude) : form.latitude,
      longitude: enriched.longitude != null ? String(enriched.longitude) : form.longitude,
      google_place_id: place.google_place_id || form.google_place_id,
      osm_id: place.osm_id || form.osm_id,
      source: place.source || form.source,
      phone: enriched.phone || form.phone,
      website_url: enriched.website_url || form.website_url,
      opening_time: enriched.opening_time || form.opening_time,
      closing_time: enriched.closing_time || form.closing_time,
    });
    setPlaces([]);
    if (enriched.latitude != null && enriched.longitude != null) {
      await reverseAndApply(Number(enriched.latitude), Number(enriched.longitude), enriched.name || 'Place');
    }
  }

  async function checkDuplicates() {
    if (!form.name?.trim()) {
      setMessage('Enter the temple name before checking for duplicates.');
      return;
    }
    setBusy('duplicates');
    try {
      const { data } = await volunteerApi.findDuplicates({
        name: form.name,
        latitude: form.latitude,
        longitude: form.longitude,
        address: form.address,
      });
      setDuplicates(data || []);
      setMessage(data?.length ? 'Possible matches found. Review them before creating a new record.' : 'No likely duplicate was found.');
    } catch (error) {
      setMessage(error.response?.data?.detail || 'Duplicate check failed.');
    } finally {
      setBusy('');
    }
  }

  async function requestSuggestions() {
    if (!form.name?.trim()) {
      setMessage('Enter a temple name first.');
      return;
    }
    setBusy('ai');
    try {
      const { data } = await volunteerApi.getTempleSuggestions({ temple_name: form.name, city: form.city || null, state: form.state || null });
      setAiSuggestions(data);
      setMessage('AI suggestions are ready. Confirm each suggestion before applying it.');
    } catch (error) {
      setMessage(error.response?.data?.detail || 'AI suggestions are not configured. You can continue manually.');
    } finally {
      setBusy('');
    }
  }

  async function scanSignboard(event) {
    const image = event.target.files?.[0];
    if (!image) return;
    setBusy('ocr');
    try {
      const { data } = await volunteerApi.extractSignboard(image);
      onApply({
        name: data.temple_name || form.name,
        address: data.address || form.address,
        trust_name: data.trust_name || form.trust_name,
        phone: data.contact_phone || form.phone,
      });
      setMessage(`Signboard scanned. Extracted text: ${data.extracted_text || 'No readable text'}`);
    } catch (error) {
      setMessage(error.response?.data?.detail || 'The signboard could not be read.');
    } finally {
      setBusy('');
      event.target.value = '';
    }
  }

  function applyAiSuggestions() {
    if (!aiSuggestions) return;
    onSuggestion(aiSuggestions);
    setMessage('Selected AI suggestions were applied. Please verify them before submission.');
  }

  return (
    <>
    <style>{automationCss}</style>
    <section className="automation-panel">
      <div className="automation-heading">
        <div><span className="automation-kicker"><Sparkles size={13} /> QUICK START</span><h2>Fill the essentials in minutes</h2><p>Search an existing listing, use GPS, or tap the map. All filled values remain editable.</p></div>
        <span className="time-pill">Saves approximately 8–12 min</span>
      </div>

      <div className="automation-grid">
        <div className="automation-card">
          <h3><Search size={17} /> Find this temple</h3>
          <form className="place-search" onSubmit={applyMapsLink}>
            <input type="url" value={mapsLink} onChange={(event) => setMapsLink(event.target.value)} placeholder="Paste Google Maps link" />
            <button disabled={busy === 'maps-link'}><Link2 size={15} /> {busy === 'maps-link' ? 'Filling...' : 'Auto-fill'}</button>
          </form>
          <small>Use Google Maps → Share → Copy link. Name, address, state, district, city, PIN code and coordinates will be filled when available.</small>
          <form className="place-search" onSubmit={searchPlaces}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Temple name, area, or Google Maps address" />
            <button disabled={busy === 'search'}>{busy === 'search' ? 'Searching...' : 'Search'}</button>
          </form>
          {places.length > 0 && <div className="place-results">{places.map((place, index) => <button type="button" key={`${place.google_place_id || place.osm_id || index}`} onClick={() => applyPlace(place)}><MapPin size={15} /><span><strong>{place.name}</strong><small>{place.display_name || place.address}</small></span></button>)}</div>}
          <div className="automation-actions">
            <button type="button" onClick={useCurrentLocation} disabled={busy === 'gps' || busy === 'location'}><LocateFixed size={15} /> {busy === 'gps' || busy === 'location' ? 'Locating...' : 'Use My GPS'}</button>
            <label className="automation-file"><Camera size={15} /> {busy === 'ocr' ? 'Scanning...' : 'Scan Signboard'}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={scanSignboard} hidden /></label>
          </div>
        </div>

        <div className="automation-card map-card">
          <h3><MapPin size={17} /> Confirm on map</h3>
          <MapContainer center={position || DEFAULT_CENTER} zoom={position ? 16 : 5} scrollWheelZoom className="automation-map">
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MapInteraction position={position} onPick={(lat, lon) => reverseAndApply(lat, lon, 'Map location')} />
          </MapContainer>
          <small>Tap the exact temple entrance to fill coordinates and address.</small>
        </div>
      </div>

      <div className="automation-review-row">
        <button type="button" onClick={checkDuplicates} disabled={busy === 'duplicates'}><ShieldAlert size={16} /> {busy === 'duplicates' ? 'Checking...' : 'Check Duplicates'}</button>
        <button type="button" onClick={requestSuggestions} disabled={busy === 'ai'}><Bot size={16} /> {busy === 'ai' ? 'Generating...' : 'Suggest Temple Details'}</button>
        {message && <p>{message}</p>}
      </div>

      {duplicates.length > 0 && <div className="duplicate-box"><strong><ShieldAlert size={16} /> Possible duplicates</strong>{duplicates.map((item) => <a key={item.id} href={`/temple/${item.slug}`} target="_blank" rel="noreferrer"><span>{item.name}</span><small>{[item.city, item.district, item.state].filter(Boolean).join(', ')}{item.distance_km != null ? ` · ${item.distance_km} km away` : ''}</small></a>)}</div>}

      {aiSuggestions && <div className="ai-suggestion-box"><div><strong><Bot size={16} /> Review AI suggestions</strong><p>Deity: {aiSuggestions.primary_deity || '—'} · Category: {aiSuggestions.temple_type || '—'} · Architecture: {aiSuggestions.architecture_style || '—'}</p></div><button type="button" onClick={applyAiSuggestions}><Check size={15} /> Apply suggestions</button></div>}
    </section>
    </>
  );
}

const automationCss = `
.automation-panel{margin:0 0 24px;padding:24px;background:#fff;border:1px solid #ead8c5;border-radius:16px;box-shadow:0 8px 28px rgba(77,31,3,.08);color:#3b1b08}
.automation-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:20px}.automation-heading h2{margin:6px 0;font-family:Georgia,serif;font-size:27px;color:#542304}.automation-heading p{margin:0;color:#84634c;font-size:13px;line-height:1.55}
.automation-kicker{display:inline-flex;align-items:center;gap:6px;color:#c8520a;font-size:10px;font-weight:800;letter-spacing:.12em}.time-pill{padding:7px 11px;border-radius:99px;background:#fff3df;color:#a44206;font-size:11px;font-weight:800;white-space:nowrap}
.automation-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.automation-card{padding:18px;border:1px solid #eedcca;border-radius:13px;background:#fffaf4}.automation-card h3{display:flex;align-items:center;gap:8px;margin:0 0 13px;font-size:15px;color:#672b06}.automation-card>small{display:block;margin:8px 0 13px;color:#8b6a52;line-height:1.45}
.place-search{display:flex;gap:8px;margin-bottom:10px}.place-search input{min-width:0;flex:1;padding:11px 12px;border:1px solid #dec5aa;border-radius:9px;background:#fff;color:#321707;outline:none}.place-search input:focus{border-color:#d45508;box-shadow:0 0 0 3px rgba(212,85,8,.1)}
.place-search button,.automation-actions button,.automation-file,.automation-review-row button,.ai-suggestion-box button{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 13px;border:0;border-radius:9px;background:#cf5608;color:#fff;font-weight:800;cursor:pointer;white-space:nowrap}.place-search button:disabled,.automation-review-row button:disabled{opacity:.6;cursor:wait}
.automation-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.automation-actions button,.automation-file{background:#fff;border:1px solid #d9b998;color:#8c3b08}.place-results{display:grid;gap:7px;max-height:210px;overflow:auto;margin:8px 0}.place-results>button{display:flex;gap:8px;text-align:left;padding:10px;border:1px solid #ead8c5;border-radius:9px;background:#fff;cursor:pointer;color:#572606}.place-results span{display:grid;gap:2px}.place-results small{color:#8a6a53}
.automation-map{height:230px;border-radius:10px;border:1px solid #ddc6ae;overflow:hidden}.map-card>small{margin-bottom:0}.automation-review-row{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:16px;padding-top:16px;border-top:1px solid #efdfcf}.automation-review-row button{background:#6f2c05}.automation-review-row p{margin:0;flex:1;min-width:230px;color:#755238;font-size:12px}
.duplicate-box,.ai-suggestion-box{margin-top:14px;padding:14px;border-radius:11px;border:1px solid #e5c693;background:#fff8e7}.duplicate-box>strong,.ai-suggestion-box strong{display:flex;align-items:center;gap:7px;color:#8a3c08}.duplicate-box a{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #f0dec2;color:#5b2808;text-decoration:none}.duplicate-box a:last-child{border-bottom:0}.duplicate-box small{color:#8a684f}.ai-suggestion-box{display:flex;align-items:center;justify-content:space-between;gap:12px}.ai-suggestion-box p{margin:5px 0 0;color:#76533a;font-size:12px}
@media(max-width:760px){.automation-panel{padding:16px}.automation-heading{display:block}.time-pill{display:inline-block;margin-top:10px}.automation-grid{grid-template-columns:1fr}.place-search{flex-direction:column}.place-search button{width:100%}.automation-map{height:210px}.ai-suggestion-box{align-items:flex-start;flex-direction:column}}
`;
