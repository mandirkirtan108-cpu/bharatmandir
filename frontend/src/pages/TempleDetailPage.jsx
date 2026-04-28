import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { MapPin, Clock, IndianRupee, QrCode, ExternalLink, ChevronRight, Train, Plane } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { templeAPI } from '../services/api';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslatedTemple } from '../hooks/useTranslatedData';

const MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function TempleDetailPage() {
  const { slug }  = useParams();
  const navigate  = useNavigate();
  const { t }     = useTranslation();

  const [temple,    setTemple]    = useState(null);
  const [mantras,   setMantras]   = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [sevas,     setSevas]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);

  const { translated: displayTemple, translating } = useTranslatedTemple(temple);

  useEffect(() => {
    if (!slug || slug === 'undefined') { navigate('/'); return; }
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await templeAPI.getBySlug(slug);
        const t   = res.data;
        setTemple(t);
        const [m, f, s] = await Promise.allSettled([
          templeAPI.getMantras(t.id),
          templeAPI.getFestivals(t.id),
          templeAPI.getSevas(t.id),
        ]);
        if (m.status === 'fulfilled') setMantras(m.value.data || []);
        if (f.status === 'fulfilled') setFestivals(f.value.data || []);
        if (s.status === 'fulfilled') setSevas(s.value.data || []);
      } catch (err) {
        if (err.response?.status === 404) setError(t('detail.not_found_msg'));
        else                              setError(t('detail.load_error'));
        console.error('Temple detail error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
    window.scrollTo(0, 0);
  }, [slug, navigate]);

  if (loading) return (
    <div>
      <Navbar />
      <div className="loading-wrap">
        <div className="spinner" />
        <span className="loading-text">{t('detail.loading')}</span>
      </div>
    </div>
  );

  if (error) return (
    <div>
      <Navbar />
      <div className="error-wrap">
        <div className="error-icon">🛕</div>
        <div className="error-title">{t('detail.not_found')}</div>
        <div className="error-msg">{error}</div>
        <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => navigate('/')}>
          {t('detail.back_to_all')}
        </button>
      </div>
    </div>
  );

  if (!temple || !displayTemple) return null;

  const qrUrl    = `${window.location.origin}/temple/${slug}`;
  const templeId = `BM-${(displayTemple.state || 'IN').substring(0,2).toUpperCase()}-${String(displayTemple.id).padStart(4,'0')}`;
  const heroBg   = displayTemple.hero_image_url
    ? `linear-gradient(180deg,rgba(61,31,0,.82) 0%,rgba(61,31,0,.45) 100%), url(${displayTemple.hero_image_url}) center/cover no-repeat`
    : `linear-gradient(135deg, #B84D00 0%, #3D1F00 100%)`;

  return (
    <div>
      <Navbar />

      {/* ── Hero Banner ── */}
      <div className="detail-hero" style={{ background: heroBg }}>
        <div className="detail-hero-content">
          <div className="breadcrumb">
            <Link to="/">{t('breadcrumb.home')}</Link>
            <span className="breadcrumb-sep"><ChevronRight size={12} /></span>
            <Link to="/">{t('breadcrumb.temples')}</Link>
            <span className="breadcrumb-sep"><ChevronRight size={12} /></span>
            <span style={{ color: 'rgba(255,255,255,.9)' }}>{displayTemple.name}</span>
          </div>

          {translating && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(232,101,10,0.15)', border: '1px solid var(--saffron)', color: 'var(--saffron)', padding: '4px 14px', borderRadius: 50, fontSize: 12, fontFamily: 'var(--font-hindi)', marginBottom: 12 }}>
              ⏳ अनुवाद हो रहा है...
            </div>
          )}

          <div className="detail-badges">
            {displayTemple.is_jyotirlinga   && <span className="detail-badge">⚡ {t('badge.jyotirlinga')}</span>}
            {displayTemple.is_shaktipeeth   && <span className="detail-badge">🌸 {t('badge.shaktipeeth')}</span>}
            {displayTemple.is_heritage_site && <span className="detail-badge">🏛️ {t('badge.heritage')}</span>}
            {displayTemple.sect             && <span className="detail-badge">{displayTemple.sect}</span>}
            {displayTemple.verified         && <span className="detail-badge" style={{ background: 'rgba(34,120,60,.85)' }}>✓ {t('badge.verified')}</span>}
          </div>

          <h1 className="detail-title">{displayTemple.name}</h1>
          {displayTemple.name_hindi && <div className="detail-title-hindi">{displayTemple.name_hindi}</div>}

          <div className="detail-quick-meta">
            <span className="detail-meta-item"><MapPin size={14} />{displayTemple.city}, {displayTemple.state}</span>
            {displayTemple.primary_deity && <span className="detail-meta-item">🙏 {displayTemple.primary_deity}</span>}
            {displayTemple.opening_time  && <span className="detail-meta-item"><Clock size={14} />{displayTemple.opening_time} – {displayTemple.closing_time}</span>}
            {displayTemple.entry_fee !== null && (
              <span className="detail-meta-item">
                {displayTemple.entry_fee === 0 ? `✅ ${t('detail.free_entry')}` : `₹${displayTemple.entry_fee} ${t('detail.entry')}`}
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

            {/* History */}
            <div className="detail-section">
              <div className="detail-sec-title">
                <span className="sec-icon">📜</span>
                {t('detail.history_title')}
              </div>
              {displayTemple.history && (
                <p style={{ fontSize: 17, lineHeight: 1.85, color: 'var(--text-mid)', marginBottom: displayTemple.significance ? 20 : 0 }}>
                  {displayTemple.history}
                </p>
              )}
              {displayTemple.significance && (
                <div style={{ background: 'linear-gradient(135deg,#FFF9EE,#FDF3DC)', border: '1px solid #E8D098', borderLeft: '4px solid var(--saffron)', borderRadius: 'var(--radius)', padding: 18, marginTop: 12 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: '.1em', color: 'var(--saffron)', marginBottom: 8, textTransform: 'uppercase' }}>
                    {t('detail.why_visit')}
                  </div>
                  <p style={{ fontSize: 16, lineHeight: 1.75, color: 'var(--text-mid)' }}>{displayTemple.significance}</p>
                </div>
              )}
              {!displayTemple.history && !displayTemple.significance && (
                <p style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>{t('detail.history_soon')}</p>
              )}
            </div>

            {/* Temple Info */}
            <div className="detail-section">
              <div className="detail-sec-title">
                <span className="sec-icon">ℹ️</span>
                {t('detail.info_title')}
              </div>
              <div className="info-grid">
                {displayTemple.primary_deity        && <InfoItem label={t('detail.primary_deity')}   value={displayTemple.primary_deity} />}
                {displayTemple.sect                 && <InfoItem label={t('detail.sect')}             value={displayTemple.sect} />}
                {displayTemple.temple_type          && <InfoItem label={t('detail.temple_type')}      value={displayTemple.temple_type} />}
                {displayTemple.architecture_style   && <InfoItem label={t('detail.architecture')}     value={displayTemple.architecture_style} />}
                {displayTemple.estimated_year_built && <InfoItem label={t('detail.established')}      value={displayTemple.estimated_year_built} />}
                {displayTemple.dress_code           && <InfoItem label={t('detail.dress_code')}       value={displayTemple.dress_code} />}
                {displayTemple.opening_time         && <InfoItem label={t('detail.opens')}            value={displayTemple.opening_time} />}
                {displayTemple.closing_time         && <InfoItem label={t('detail.closes')}           value={displayTemple.closing_time} />}
                {displayTemple.entry_fee !== null   && <InfoItem label={t('detail.entry_fee')}        value={displayTemple.entry_fee === 0 ? t('detail.free') : `₹${displayTemple.entry_fee}`} />}
                {displayTemple.best_time_to_visit   && <InfoItem label={t('detail.best_time')}        value={displayTemple.best_time_to_visit} />}
                {displayTemple.address && (
                  <div className="info-item" style={{ gridColumn: '1/-1' }}>
                    <div className="info-label">{t('detail.address')}</div>
                    <div className="info-value">{displayTemple.address}</div>
                  </div>
                )}
                {displayTemple.nearest_railway && (
                  <div className="info-item">
                    <div className="info-label">{t('detail.nearest_railway')}</div>
                    <div className="info-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Train size={13} style={{ color: 'var(--saffron)' }} /> {displayTemple.nearest_railway}
                    </div>
                  </div>
                )}
                {displayTemple.nearest_airport && (
                  <div className="info-item">
                    <div className="info-label">{t('detail.nearest_airport')}</div>
                    <div className="info-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Plane size={13} style={{ color: 'var(--saffron)' }} /> {displayTemple.nearest_airport}
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
                  {t('detail.mantras_title')}
                </div>
                {mantras.map((m) => (
                  <div key={m.id} className="mantra-card">
                    <div className="mantra-title">
                      {m.title}
                      {m.mantra_type && <span style={{ fontWeight: 400, color: 'var(--text-light)', fontSize: 12, marginLeft: 8 }}>· {m.mantra_type}</span>}
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
                  {t('detail.festivals_title')}
                </div>
                {festivals.map((f, i) => (
                  <div key={i} className="festival-item">
                    <div className="festival-month">{f.month ? MONTHS[f.month] : '—'}</div>
                    <div>
                      <div className="festival-name">
                        {f.name}
                        {f.is_major && <span className="festival-major">{t('detail.major')}</span>}
                      </div>
                      {f.hindu_month && (
                        <div style={{ fontSize: 12, color: 'var(--saffron)', marginBottom: 4, fontFamily: 'var(--font-display)', letterSpacing: '.06em' }}>
                          {f.hindu_month} {t('detail.month')}
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
                  {t('detail.sevas_title')}
                </div>
                {sevas.map((s) => (
                  <div key={s.id} className="seva-card">
                    <div className="seva-info">
                      <div className="seva-name">{s.name}</div>
                      {s.timing && <div className="seva-timing">⏰ {s.timing}</div>}
                      {s.advance_booking && (
                        <div style={{ fontSize: 11, color: 'var(--saffron)', marginTop: 3, fontFamily: 'var(--font-display)', letterSpacing: '.06em' }}>
                          {t('detail.advance_booking')}
                        </div>
                      )}
                    </div>
                    <div className="seva-price">
                      {s.is_free ? t('detail.free') : s.price ? `₹${s.price}` : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ════ SIDEBAR ════ */}
          <div className="detail-sidebar">

            <div className="sidebar-card">
              <div className="sidebar-title">🔳 {t('detail.qr_title')}</div>
              <div className="qr-container">
                <div className="qr-box">
                  <QRCodeSVG value={qrUrl} size={160} fgColor="#3D1F00" bgColor="#FFFFFF" level="H" />
                </div>
                <div className="qr-id-badge">{templeId}</div>
                <div className="qr-scan-hint">{t('detail.qr_hint')}</div>
                <button className="btn-outline" style={{ fontSize: 12, padding: '8px 18px', width: '100%', justifyContent: 'center' }} onClick={() => navigate(`/qr/${slug}`)}>
                  <QrCode size={13} /> {t('detail.full_qr_page')}
                </button>
              </div>
            </div>

            <div className="sidebar-card">
              <div className="sidebar-title">{t('detail.quick_info')}</div>
              {displayTemple.city          && <QuickRow label={t('detail.city')}    value={displayTemple.city} />}
              {displayTemple.state         && <QuickRow label={t('detail.state')}   value={displayTemple.state} />}
              {displayTemple.primary_deity && <QuickRow label={t('detail.deity')}   value={displayTemple.primary_deity} />}
              {displayTemple.opening_time  && <QuickRow label={t('detail.timing')}  value={`${displayTemple.opening_time} – ${displayTemple.closing_time}`} />}
              {displayTemple.entry_fee !== null && <QuickRow label={t('detail.entry')} value={displayTemple.entry_fee === 0 ? t('detail.free') : `₹${displayTemple.entry_fee}`} />}
              {displayTemple.pincode       && <QuickRow label={t('detail.pincode')} value={displayTemple.pincode} />}
            </div>

            <div className="sidebar-card">
              <div className="sidebar-actions">
                {displayTemple.latitude && displayTemple.longitude && (
                  <a href={`https://www.google.com/maps/search/?api=1&query=${displayTemple.latitude},${displayTemple.longitude}`} target="_blank" rel="noopener noreferrer" className="sidebar-btn primary">
                    🗺️ {t('detail.get_directions')}
                  </a>
                )}
                {displayTemple.website_url && (
                  <a href={displayTemple.website_url} target="_blank" rel="noopener noreferrer" className="sidebar-btn outline">
                    <ExternalLink size={13} /> {t('detail.official_website')}
                  </a>
                )}
                <button className="sidebar-btn outline" onClick={() => navigate(`/qr/${slug}`)}>
                  <QrCode size={13} /> {t('detail.download_qr')}
                </button>
                <Link to="/" className="sidebar-btn outline">← {t('detail.all_temples')}</Link>
              </div>
            </div>

          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}

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