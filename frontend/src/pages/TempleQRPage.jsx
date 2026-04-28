import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { MapPin, ArrowLeft, Download, ExternalLink } from 'lucide-react';
import { templeAPI } from '../services/api';

export default function TempleQRPage() {
  const { slug }  = useParams();
  const navigate  = useNavigate();
  const qrRef     = useRef(null);

  const [temple,  setTemple]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!slug || slug === 'undefined') { navigate('/'); return; }

    templeAPI.getBySlug(slug)
      .then(res => setTemple(res.data))
      .catch(() => setError('Temple not found.'))
      .finally(() => setLoading(false));

    window.scrollTo(0, 0);
  }, [slug, navigate]);

  const handlePrint = () => window.print();

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const canvas  = document.createElement('canvas');
    const size    = 400;
    canvas.width  = size;
    canvas.height = size;
    const ctx     = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, size, size);
    const svgData = new XMLSerializer().serializeToString(svg);
    const img     = new Image();
    img.onload    = () => {
      ctx.drawImage(img, 0, 0, size, size);
      const link    = document.createElement('a');
      link.download = `${slug}-qr-code.png`;
      link.href     = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const qrUrl    = `${window.location.origin}/temple/${slug}`;
  const templeId = temple
    ? `BM-${(temple.state||'IN').substring(0,2).toUpperCase()}-${String(temple.id).padStart(4,'0')}`
    : '';

  if (loading) return (
    <div className="qr-page">
      <div className="loading-wrap">
        <div className="spinner" />
        <span className="loading-text">Loading QR Code...</span>
      </div>
    </div>
  );

  if (error || !temple) return (
    <div className="qr-page">
      <div className="error-wrap">
        <div className="error-icon">🛕</div>
        <div className="error-title">Temple not found</div>
        <button className="btn-primary" onClick={() => navigate('/')} style={{ marginTop: 16 }}>
          Back to Home
        </button>
      </div>
    </div>
  );

  return (
    <div className="qr-page">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .qr-full-card, .qr-full-card * { visibility: visible; }
          .qr-full-card { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); box-shadow: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="qr-full-card">

        {/* Back button */}
        <div className="no-print" style={{ marginBottom: 20 }}>
          <button
            onClick={() => navigate(`/temple/${slug}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '.04em' }}
          >
            <ArrowLeft size={14} /> Back to Temple
          </button>
        </div>

        {/* Header */}
        <span className="qr-full-om">🛕</span>
        <div className="qr-full-platform">BHARATMANDIR · TEMPLE DISCOVERY PLATFORM</div>

        {/* Temple Name */}
        <h1 className="qr-full-name">{temple.name}</h1>
        {temple.name_hindi && (
          <div className="qr-full-hindi">{temple.name_hindi}</div>
        )}
        <div className="qr-full-loc">
          <MapPin size={13} />
          {temple.city}, {temple.state}
          {temple.primary_deity && ` · ${temple.primary_deity}`}
        </div>

        {/* Special Badges */}
        {(temple.is_jyotirlinga || temple.is_shaktipeeth) && (
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
            {temple.is_jyotirlinga && (
              <span style={{ background: 'linear-gradient(135deg,#B84D00,#C8960C)', color: 'white', padding: '4px 14px', borderRadius: 50, fontSize: 11, fontFamily: 'var(--font-display)', letterSpacing: '.07em' }}>
                ⚡ One of 12 Jyotirlingas
              </span>
            )}
            {temple.is_shaktipeeth && (
              <span style={{ background: 'linear-gradient(135deg,#9B1C1C,#C8960C)', color: 'white', padding: '4px 14px', borderRadius: 50, fontSize: 11, fontFamily: 'var(--font-display)', letterSpacing: '.07em' }}>
                🌸 One of 51 Shaktipeeths
              </span>
            )}
          </div>
        )}

        <hr className="qr-full-divider" />

        {/* QR Code */}
        <div ref={qrRef} className="qr-full-code">
          <QRCodeSVG value={qrUrl} size={200} fgColor="#3D1F00" bgColor="#FFFFFF" level="H" />
        </div>

        {/* Temple ID */}
        <div className="qr-full-id">{templeId}</div>

        {/* Tip */}
        <p className="qr-full-tip">
          Scan with your phone camera to view complete temple details
        </p>

        <hr className="qr-full-divider" />

        {/* Info Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24, textAlign: 'left' }}>
          {temple.opening_time && (
            <InfoBox label="Timings" value={`${temple.opening_time} – ${temple.closing_time}`} />
          )}
          {temple.entry_fee !== null && (
            <InfoBox label="Entry Fee" value={temple.entry_fee === 0 ? 'Free Entry' : `₹${temple.entry_fee}`} />
          )}
          {temple.nearest_railway && (
            <InfoBox label="Nearest Railway" value={temple.nearest_railway} full />
          )}
        </div>

        {/* Action Buttons */}
        <div className="qr-full-actions no-print">
          <button className="btn-primary" onClick={handleDownload}>
            <Download size={14} /> Download QR
          </button>
          <button className="btn-outline" onClick={handlePrint}>
            🖨️ Print
          </button>
          <Link to={`/temple/${slug}`} className="btn-outline">
            <ExternalLink size={13} /> View Temple
          </Link>
        </div>

      </div>
    </div>
  );
}

function InfoBox({ label, value, full }) {
  return (
    <div style={{
      background: 'var(--cream)', borderRadius: 10, padding: '10px 12px',
      border: '1px solid var(--cream-dark)',
      gridColumn: full ? '1/-1' : undefined
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, letterSpacing: '.1em', color: 'var(--text-light)', marginBottom: 3, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--brown)' }}>{value}</div>
    </div>
  );
}