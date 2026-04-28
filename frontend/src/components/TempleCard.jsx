import { Link, useNavigate } from 'react-router-dom';
import { MapPin, QrCode } from 'lucide-react';

export default function TempleCard({ temple, style }) {
  const navigate = useNavigate();

  // Safety guard — if no slug, don't render a broken link
  if (!temple || !temple.slug) {
    console.warn('TempleCard: missing slug for temple:', temple);
    return null;
  }

  const handleQR = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigate(`/qr/${temple.slug}`);
  };

  const tags = (temple.category_tags || []).slice(0, 3);

  return (
    <Link to={`/temple/${temple.slug}`} className="temple-card" style={style}>

      {/* ── Image / Placeholder ── */}
      <div className="card-image">
        {temple.hero_image_url ? (
          <img
            src={temple.hero_image_url}
            alt={temple.name}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling.style.display = 'flex';
            }}
          />
        ) : null}
        <div
          className="card-image-placeholder"
          style={{ display: temple.hero_image_url ? 'none' : 'flex' }}
        >
          <span className="placeholder-om">OM</span>
          <span className="placeholder-name">{temple.city?.toUpperCase()}</span>
        </div>

        {/* Badge — Jyotirlinga or Shaktipeeth */}
        {(temple.is_jyotirlinga || temple.is_shaktipeeth) && (
          <span className="card-top-badge">
            {temple.is_jyotirlinga ? '⚡ Jyotirlinga' : '🌸 Shaktipeeth'}
          </span>
        )}

        {/* QR Button */}
        <button className="card-qr-btn" onClick={handleQR} title="View QR Code">
          <QrCode size={13} /> QR
        </button>
      </div>

      {/* ── Card Body ── */}
      <div className="card-body">
        {temple.primary_deity && (
          <div className="card-deity">🙏 {temple.primary_deity}</div>
        )}
        <div className="card-name">{temple.name}</div>
        {temple.name_hindi && (
          <div className="card-name-hindi">{temple.name_hindi}</div>
        )}
        <div className="card-location">
          <MapPin size={12} />
          {temple.city}, {temple.state}
        </div>
        {tags.length > 0 && (
          <div className="card-tags">
            {tags.map((tag) => (
              <span key={tag} className="card-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>

      {/* ── Card Footer ── */}
      <div className="card-footer">
        <span className="card-sect">
          {temple.sect || temple.temple_type || 'Temple'}
        </span>
        {temple.is_jyotirlinga && (
          <span className="card-special">12 Jyotirlingas</span>
        )}
        {temple.is_shaktipeeth && !temple.is_jyotirlinga && (
          <span className="card-special">51 Shaktipeeths</span>
        )}
      </div>

    </Link>
  );
}