import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, Clock, IndianRupee, QrCode, ExternalLink, ChevronRight, Train, Plane } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { templeAPI } from '../services/api';
import { QRCodeSVG } from 'qrcode.react';

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function TempleDetailPage() {
  const { slug }   = useParams();
  const navigate   = useNavigate();

  const [temple,    setTemple]    = useState(null);
  const [mantras,   setMantras]   = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [sevas,     setSevas]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    // Guard: if slug is undefined/null, go home
    if (!slug || slug === 'undefined') {
      navigate('/');
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await templeAPI.getBySlug(slug);
        const t   = res.data;
        setTemple(t);

        // Load related data in parallel — don't fail if one fails
        const [m, f, s] = await Promise.allSettled([
          templeAPI.getMantras(t.id),
          templeAPI.getFestivals(t.id),
          templeAPI.getSevas(t.id),
        ]);
        if (m.status === 'fulfilled') setMantras(m.value.data || []);
        if (f.status === 'fulfilled') setFestivals(f.value.data || []);
        if (s.status === 'fulfilled') setSevas(s.value.data || []);
      } catch (err) {
        if (err.response?.status === 404) {
          setError('Temple not found. It may have been removed or the link is incorrect.');
        } else {
          setError('Failed to load temple data. Make sure the backend is running.');
        }
        console.error('Temple detail error:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
    window.scrollTo(0, 0);
  }, [slug, navigate]);

  /* ── Loading ── */
  if (loading) return (
    <div>
      <Navbar />
      <div className="loading-wrap">
        <div className="spinner" />
        <span className="loading-text">Loading temple details...</span>
      </div>
    </div>
  );

  /* ── Error ── */
  if (error) return (
    <div>
      <Navbar />
      <div className="error-wrap">
        <div className="error-icon">🛕</div>
        <div className="error-title">Temple not found</div>
        <div className="error-msg">{error}</div>
        <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
          Back to All Temples
        </button>
      </div>
    </div>
  );

  if (!temple) return null;

  const qrUrl    = `${window.location.origin}/temple/${slug}`;
  const templeId = `BM-${(temple.state || 'IN').substring(0,2).toUpperCase()}-${String(temple.id).padStart(4,'0')}`;
  const heroBg   = temple.hero_image_url
    ? `linear-gradient(180deg,rgba(61,31,0,.82) 0%,rgba(61,31,0,.45) 100%), url(${temple.hero_image_url}) center/cover no-repeat`
    : `linear-gradient(135deg, #B84D00 0%, #3D1F00 100%)`;

  return (
    <div>
      <Navbar />

      {/* ── Hero Banner ── */}
      <div className="detail-hero" style={{ background: heroBg }}>
        <div className="detail-hero-content">

          {/* Breadcrumb */}
          <div className="breadcrumb">
            <Link to="/">Home</Link>
            <span className="breadcrumb-sep"><ChevronRight size={12} /></span>
            <Link to="/">Temples</Link>
            <span className="breadcrumb-sep"><ChevronRight size={12} /></span>
            <span style={{ color: 'rgba(255,255,255,.9)' }}>{temple.name}</span>
          </div>

          {/* Badges */}
          <div className="detail-badges">
            {temple.is_jyotirlinga   && <span className="detail-badge">⚡ Jyotirlinga</span>}
            {temple.is_shaktipeeth   && <span className="detail-badge">🌸 Shaktipeeth</span>}
            {temple.is_heritage_site && <span className="detail-badge">🏛️ Heritage Site</span>}
            {temple.sect             && <span className="detail-badge">{temple.sect}</span>}
            {temple.verified         && <span className="detail-badge" style={{ background: 'rgba(34,120,60,.85)' }}>✓ Verified</span>}
          </div>

          {/* Title */}
          <h1 className="detail-title">{temple.name}</h1>
          {temple.name_hindi && (
            <div className="detail-title-hindi">{temple.name_hindi}</div>
          )}

          {/* Quick Meta */}
          <div className="detail-quick-meta">
            <span className="detail-meta-item">
              <MapPin size={14} />{temple.city}, {temple.state}
            </span>
            {temple.primary_deity && (
              <span className="detail-meta-item">🙏 {temple.primary_deity}</span>
            )}
            {temple.opening_time && (
              <span className="detail-meta-item">
                <Clock size={14} />{temple.opening_time} – {temple.closing_time}
              </span>
            )}
            {temple.entry_fee !== null && (
              <span className="detail-meta-item">
                {temple.entry_fee === 0 ? '✅ Free Entry' : `₹${temple.entry_fee} Entry`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="container">
        <div className="detail-body">

          {/* ════ MAIN COLUMN ════ */}
          <div className="detail-main">

            {/* History & Significance */}
            <div className="detail-section">
              <div className="detail-sec-title">
                <span className="sec-icon">📜</span>
                History & Significance
              </div>
              {temple.history && (
                <p style={{ fontSize: 17, lineHeight: 1.85, color: 'var(--text-mid)', marginBottom: temple.significance ? 20 : 0 }}>
                  {temple.history}
                </p>
              )}
              {temple.significance && (
                <div style={{
                  background: 'linear-gradient(135deg,#FFF9EE,#FDF3DC)',
                  border: '1px solid #E8D098', borderLeft: '4px solid var(--saffron)',
                  borderRadius: 'var(--radius)', padding: 18, marginTop: 12
                }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.1em', color: 'var(--saffron)', marginBottom: 8, textTransform: 'uppercase' }}>
                    Why Devotees Visit
                  </div>
                  <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--text-mid)' }}>
                    {temple.significance}
                  </p>
                </div>
              )}
              {!temple.history && !temple.significance && (
                <p style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>
                  History information coming soon.
                </p>
              )}
            </div>

            {/* Temple Info Grid */}
            <div className="detail-section">
              <div className="detail-sec-title">
                <span className="sec-icon">ℹ️</span>
                Temple Information
              </div>
              <div className="info-grid">
                {temple.primary_deity        && <InfoItem label="Primary Deity"   value={temple.primary_deity} />}
                {temple.sect                 && <InfoItem label="Sect"            value={temple.sect} />}
                {temple.temple_type          && <InfoItem label="Temple Type"     value={temple.temple_type} />}
                {temple.architecture_style   && <InfoItem label="Architecture"    value={temple.architecture_style} />}
                {temple.estimated_year_built && <InfoItem label="Established"     value={temple.estimated_year_built} />}
                {temple.dress_code           && <InfoItem label="Dress Code"      value={temple.dress_code} />}
                {temple.opening_time         && <InfoItem label="Opens"           value={temple.opening_time} />}
                {temple.closing_time         && <InfoItem label="Closes"          value={temple.closing_time} />}
                {temple.entry_fee !== null   && <InfoItem label="Entry Fee"       value={temple.entry_fee === 0 ? 'Free' : `₹${temple.entry_fee}`} />}
                {temple.best_time_to_visit   && <InfoItem label="Best Time"       value={temple.best_time_to_visit} />}
                {temple.address && (
                  <div className="info-item" style={{ gridColumn: '1/-1' }}>
                    <div className="info-label">Address</div>
                    <div className="info-value">{temple.address}</div>
                  </div>
                )}
                {temple.nearest_railway && (
                  <div className="info-item">
                    <div className="info-label">Nearest Railway</div>
                    <div className="info-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Train size={13} style={{ color: 'var(--saffron)' }} /> {temple.nearest_railway}
                    </div>
                  </div>
                )}
                {temple.nearest_airport && (
                  <div className="info-item">
                    <div className="info-label">Nearest Airport</div>
                    <div className="info-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Plane size={13} style={{ color: 'var(--saffron)' }} /> {temple.nearest_airport}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Mantras */}
            {mantras.length > 0 && (
              <div className="detail-section">
                <div className="detail-sec-title">
                  <span className="sec-icon">🕉️</span>
                  Sacred Mantras
                </div>
                {mantras.map((m) => (
                  <div key={m.id} className="mantra-card">
                    <div className="mantra-title">
                      {m.title}
                      {m.mantra_type && (
                        <span style={{ fontWeight: 400, color: 'var(--text-light)', fontSize: 12, marginLeft: 8 }}>
                          · {m.mantra_type}
                        </span>
                      )}
                    </div>
                    {m.sanskrit        && <div className="mantra-sanskrit">{m.sanskrit}</div>}
                    {m.transliteration && <div className="mantra-roman">{m.transliteration}</div>}
                    {m.meaning         && <div className="mantra-meaning">{m.meaning}</div>}
                  </div>
                ))}
              </div>
            )}

            {/* Festivals */}
            {festivals.length > 0 && (
              <div className="detail-section">
                <div className="detail-sec-title">
                  <span className="sec-icon">🎉</span>
                  Festivals & Events
                </div>
                {festivals.map((f, i) => (
                  <div key={i} className="festival-item">
                    <div className="festival-month">
                      {f.month ? MONTHS[f.month] : '—'}
                    </div>
                    <div>
                      <div className="festival-name">
                        {f.name}
                        {f.is_major && <span className="festival-major">MAJOR</span>}
                      </div>
                      {f.hindu_month && (
                        <div style={{ fontSize: 12, color: 'var(--saffron)', marginBottom: 4, fontFamily: 'var(--font-display)', letterSpacing: '.06em' }}>
                          {f.hindu_month} Month
                        </div>
                      )}
                      {f.description && <div className="festival-desc">{f.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sevas */}
            {sevas.length > 0 && (
              <div className="detail-section">
                <div className="detail-sec-title">
                  <span className="sec-icon">🙏</span>
                  Puja & Seva Services
                </div>
                {sevas.map((s) => (
                  <div key={s.id} className="seva-card">
                    <div className="seva-info">
                      <div className="seva-name">{s.name}</div>
                      {s.timing && <div className="seva-timing">⏰ {s.timing}</div>}
                      {s.advance_booking && (
                        <div style={{ fontSize: 11, color: 'var(--saffron)', marginTop: 3, fontFamily: 'var(--font-display)', letterSpacing: '.06em' }}>
                          ADVANCE BOOKING REQUIRED
                        </div>
                      )}
                    </div>
                    <div className="seva-price">
                      {s.is_free ? 'Free' : s.price ? `₹${s.price}` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>{/* end main */}

          {/* ════ SIDEBAR ════ */}
          <div className="detail-sidebar">

            {/* QR Code */}
            <div className="sidebar-card">
              <div className="sidebar-title">🔳 Temple QR Code</div>
              <div className="qr-container">
                <div className="qr-box">
                  <QRCodeSVG
                    value={qrUrl}
                    size={160}
                    fgColor="#3D1F00"
                    bgColor="#FFFFFF"
                    level="H"
                  />
                </div>
                <div className="qr-id-badge">{templeId}</div>
                <div className="qr-scan-hint">Scan to view this temple</div>
                <button
                  className="btn-outline"
                  style={{ fontSize: 12, padding: '8px 18px', width: '100%', justifyContent: 'center' }}
                  onClick={() => navigate(`/qr/${slug}`)}
                >
                  <QrCode size={13} /> Full QR Page
                </button>
              </div>
            </div>

            {/* Quick Info */}
            <div className="sidebar-card">
              <div className="sidebar-title">Quick Info</div>
              {temple.city          && <QuickRow label="City"    value={temple.city} />}
              {temple.state         && <QuickRow label="State"   value={temple.state} />}
              {temple.primary_deity && <QuickRow label="Deity"   value={temple.primary_deity} />}
              {temple.opening_time  && <QuickRow label="Timing"  value={`${temple.opening_time} – ${temple.closing_time}`} />}
              {temple.entry_fee !== null && <QuickRow label="Entry" value={temple.entry_fee === 0 ? 'Free' : `₹${temple.entry_fee}`} />}
              {temple.pincode       && <QuickRow label="Pincode" value={temple.pincode} />}
            </div>

            {/* Action Buttons */}
            <div className="sidebar-card">
              <div className="sidebar-actions">
                {temple.latitude && temple.longitude && (
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${temple.latitude},${temple.longitude}`}
                    target="_blank" rel="noopener noreferrer"
                    className="sidebar-btn primary"
                  >
                    🗺️ Get Directions
                  </a>
                )}
                {temple.website_url && (
                  <a
                    href={temple.website_url}
                    target="_blank" rel="noopener noreferrer"
                    className="sidebar-btn outline"
                  >
                    <ExternalLink size={13} /> Official Website
                  </a>
                )}
                <button
                  className="sidebar-btn outline"
                  onClick={() => navigate(`/qr/${slug}`)}
                >
                  <QrCode size={13} /> Download QR Code
                </button>
                <Link to="/" className="sidebar-btn outline">
                  ← All Temples
                </Link>
              </div>
            </div>

          </div>{/* end sidebar */}
        </div>
      </div>

      <Footer />
    </div>
  );
}

/* ── Small helper components ── */
function InfoItem({ label, value }) {
  return (
    <div className="info-item">
      <div className="info-label">{label}</div>
      <div className="info-value">{value}</div>
    </div>
  );
}

function QuickRow({ label, value }) {
  return (
    <div className="quick-info-row">
      <span className="quick-label">{label}</span>
      <span className="quick-value">{value}</span>
    </div>
  );
}