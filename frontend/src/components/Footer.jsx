import { Link } from 'react-router-dom';

const EXPLORE_LINKS = [
  { to: '/',               label: 'Home' },
  { to: '/search',         label: 'Browse Temples' },
  { to: '/map',            label: 'Temple Map' },
  { to: '/festivals',      label: 'Festival Calendar' },
  { to: '/panchang',       label: 'Panchang & Muhurat' },
];

const TOOLS_LINKS = [
  { to: '/route-planner',  label: 'Pilgrimage Planner' },
  { to: '/sacred-books',   label: 'Sacred Library' },
  { to: '/spiritual-guide',label: 'AI Spiritual Guide' },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer style={{
      background: 'var(--brown)',
      color: 'rgba(255,255,255,0.65)',
      fontFamily: 'var(--font-body)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>

      {/* ── Top divider strip ── */}
      <div style={{
        height: 3,
        background: 'linear-gradient(90deg, var(--saffron-dark), var(--gold), var(--saffron-dark))',
      }} />

      {/* ── Main footer body ── */}
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '52px 28px 40px',
        display: 'grid',
        gridTemplateColumns: '1.8fr 1fr 1fr',
        gap: '40px 32px',
      }}
        className="footer-grid"
      >

        {/* Brand column */}
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          }}>
            <span style={{ fontSize: 28 }}>🛕</span>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22, fontWeight: 700,
                color: 'var(--gold-light)',
                letterSpacing: '0.01em',
              }}>BharatMandir</div>
              <div style={{
                fontFamily: 'var(--font-hindi)',
                fontSize: 12, color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.06em',
              }}>भारत मंदिर</div>
            </div>
          </div>

          <p style={{
            fontSize: 14, lineHeight: 1.85,
            color: 'rgba(255,255,255,0.50)',
            maxWidth: 280, margin: '0 0 22px',
          }}>
            Connecting devotees with the sacred temples of Bharat.
            Discover heritage, plan pilgrimages, and seek divine guidance.
          </p>

         
        </div>

        {/* Explore column */}
        <div>
          <h4 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13, fontWeight: 700,
            color: 'var(--gold-light)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 18,
          }}>Explore</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
            {EXPLORE_LINKS.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} style={{
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: 14, textDecoration: 'none',
                  transition: 'color 0.18s',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--gold-light)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
                >
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'var(--saffron)', flexShrink: 0,
                  }} />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Tools column */}
        <div>
          <h4 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13, fontWeight: 700,
            color: 'var(--gold-light)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 18,
          }}>Spiritual Tools</h4>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
            {TOOLS_LINKS.map(({ to, label }) => (
              <li key={to}>
                <Link to={to} style={{
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: 14, textDecoration: 'none',
                  transition: 'color 0.18s',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--gold-light)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.55)'}
                >
                  <span style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'var(--saffron)', flexShrink: 0,
                  }} />
                  {label}
                </Link>
              </li>
            ))}
          </ul>

          
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '18px 28px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
        maxWidth: 1200, margin: '0 auto',
      }}
        className="footer-bottom"
      >
        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.30)' }}>
          © {year} BharatMandir · Temple Discovery Platform of India
        </p>
        <div style={{ display: 'flex', gap: 20 }}>
          <Link to="/admin/login" style={{
            color: 'rgba(255,255,255,0.20)', fontSize: 11,
            textDecoration: 'none', transition: 'color 0.18s',
          }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.20)'}
          >
            Admin Portal
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 11 }}>
            🙏 Jai Bharat
          </span>
        </div>
      </div>

      {/* ── Responsive styles ── */}
      <style>{`
        @media (max-width: 768px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
          }
          .footer-grid > div:first-child {
            grid-column: 1 / -1;
          }
        }
        @media (max-width: 480px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
            padding: 32px 20px 24px !important;
            gap: 28px !important;
          }
          .footer-bottom {
            padding: 14px 20px !important;
            flex-direction: column !important;
            text-align: center !important;
          }
        }
      `}</style>
    </footer>
  );
}