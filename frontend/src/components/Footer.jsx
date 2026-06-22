import { Link } from 'react-router-dom';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const links = {
    Explore: [
      { label: 'Temples',       to: '/temples' },
      { label: 'Route Planner', to: '/route-planner' },
      { label: 'Panchang',      to: '/panchang' },
      { label: 'Festivals',     to: '/festivals' },
    ],
    Resources: [
      { label: 'Sacred Library', to: '/library' },
      { label: 'AI Guide',       to: '/ai-guide' },
    ],
    Company: [
      { label: 'About Us',      to: '/about' },
      { label: 'Contact',       to: '/contact' },
      { label: 'Privacy Policy',to: '/privacy' },
      { label: 'Terms of Use',  to: '/terms' },
    ],
  };

  return (
    <footer style={{
      background: 'linear-gradient(180deg, #3d1504 0%, #2a0d02 100%)',
      color: '#e8d5b8',
      paddingTop: 28,
      paddingBottom: 0,
      fontFamily: 'var(--font-body, system-ui, sans-serif)',
    }}>

      {/* ── Top section ── */}
      <div style={{
        maxWidth: 780, margin: '0 auto',
        padding: '0 24px 24px',
        display: 'grid',
        gridTemplateColumns: '1.5fr 0.9fr 0.9fr 0.9fr',
        gap: 24,
      }}
        className="footer-grid"
      >

        {/* Brand column */}
        <div>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 26 }}>🛕</span>
            <div>
              <div style={{
                fontFamily: 'var(--font-display, Georgia, serif)',
                fontSize: 20, fontWeight: 800,
                color: '#FFD580', lineHeight: 1.1,
                letterSpacing: '0.01em',
              }}>BharatMandir</div>
              <div style={{ fontSize: 10, color: 'rgba(255,213,128,0.55)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Temple Discovery Platform
              </div>
            </div>
          </div>

          <p style={{
            fontSize: 13, lineHeight: 1.8,
            color: 'rgba(232,213,184,0.72)',
            marginBottom: 22, marginTop: 0, maxWidth: 220,
          }}>
            Connecting devotees with the sacred temples and scriptures of Bharat — preserving our spiritual heritage for generations.
          </p>

          {/* Decorative OM + tagline */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,213,128,0.07)',
            border: '1px solid rgba(255,213,128,0.18)',
            borderRadius: 8, padding: '8px 14px',
          }}>
            <span style={{ fontSize: 18, color: '#FFD580', lineHeight: 1 }}>ॐ</span>
            <span style={{ fontSize: 11, color: 'rgba(255,213,128,0.7)', fontStyle: 'italic' }}>
              सर्वे भवन्तु सुखिनः
            </span>
          </div>
        </div>

        {/* Link columns */}
        {Object.entries(links).map(([section, items]) => (
          <div key={section}>
            <div style={{
              fontSize: 11, fontWeight: 700,
              color: '#FFD580',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginBottom: 16,
              paddingBottom: 10,
              borderBottom: '1px solid rgba(255,213,128,0.15)',
            }}>{section}</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(item => (
                <li key={item.label}>
                  <Link
                    to={item.to}
                    style={{
                      fontSize: 13,
                      color: 'rgba(232,213,184,0.72)',
                      textDecoration: 'none',
                      transition: 'color 0.15s',
                      display: 'inline-block',
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = '#FFD580'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(232,213,184,0.72)'}
                  >{item.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ── Divider ── */}
      <div style={{
        maxWidth: 780, margin: '0 auto',
        borderTop: '1px solid rgba(255,213,128,0.1)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        <p style={{ fontSize: 12, color: 'rgba(232,213,184,0.45)', margin: 0 }}>
          © {currentYear} BharatMandir. All rights reserved. Made with 🙏 in India.
        </p>
        <div style={{ display: 'flex', gap: 20 }}>
          {['Privacy Policy', 'Terms of Use'].map(label => (
            <Link
              key={label}
              to={`/${label.toLowerCase().replace(/ /g, '-')}`}
              style={{
                fontSize: 11, color: 'rgba(232,213,184,0.4)',
                textDecoration: 'none', transition: 'color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,213,128,0.7)'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(232,213,184,0.4)'}
            >{label}</Link>
          ))}
        </div>
      </div>

      {/* ── Responsive styles ── */}
      <style>{`
        @media (max-width: 768px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }
        @media (max-width: 480px) {
          .footer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}