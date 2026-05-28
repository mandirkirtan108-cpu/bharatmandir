import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SpiritualChat from '../components/SpiritualChat';
import { Sun } from 'lucide-react';

const UI_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Roboto", sans-serif';

export default function SpiritualGuidePage() {
  return (
    <>
      <Navbar />

      <main style={{ minHeight: '100vh', background: '#f8f4ef' }}>

        {/* ══════════════ HERO — matches PanchangPage exactly ══════════════ */}
        <section style={{
          position: 'relative',
          overflow: 'hidden',
          color: 'white',
          background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
          padding: '50px 12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {/* Radial glow */}
          <div style={{
            position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
            width: 500, height: 200,
            background: 'radial-gradient(ellipse, rgba(232,101,10,0.25) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{
            position: 'relative', zIndex: 1,
            width: '100%', maxWidth: 700,
            padding: '0 24px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}>
            {/* Badge — matches PanchangPage badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,213,128,0.3)',
              borderRadius: 50, padding: '5px 16px', marginBottom: 14,
              color: 'rgba(255,213,128,0.85)', fontSize: 11, letterSpacing: '.1em',
              textTransform: 'uppercase', fontWeight: 500,
              backdropFilter: 'blur(8px)',
              whiteSpace: 'nowrap',
              fontFamily: UI_FONT,
            }}>
              <Sun size={11} /> AI Spiritual Guide
            </div>

            {/* Title */}
            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1,
              marginBottom: 10, marginTop: 0,
              textShadow: '0 4px 40px rgba(0,0,0,0.3)',
              color: '#ffffff',
              width: '100%',
            }}>
              Your Troubles —{' '}
              <span style={{ color: '#FFD580' }}>Divine Guidance</span>
            </h1>

            {/* Subtitle */}
            <p style={{
              color: 'rgba(255,255,255,0.7)', fontSize: 14,
              width: '100%', maxWidth: 520,
              margin: '0 0 0 0',
              fontWeight: 300, lineHeight: 1.7,
              textAlign: 'center',
              fontFamily: UI_FONT,
            }}>
              Share your concerns and receive compassionate wisdom —
              mantras, rituals, deity recommendations, in{' '}
              <strong style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
                Hindi, English, or Hinglish
              </strong>.
            </p>
          </div>
        </section>

        {/* ══════════════ CHAT SECTION ══════════════ */}
        <section style={{ background: '#f8f4ef', paddingTop: 56, paddingBottom: 80 }}>
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 20px' }}>
            <SpiritualChat />
          </div>

          {/* Disclaimer */}
          <p style={{
            textAlign: 'center',
            maxWidth: 540,
            margin: '26px auto 0',
            fontSize: 12,
            color: '#9A7150',
            lineHeight: 1.7,
            padding: '0 16px',
            opacity: 0.85,
            fontFamily: UI_FONT,
          }}>
            🙏 This guide is for spiritual inspiration only. Please consult qualified professionals
            for medical, legal, or financial decisions.
          </p>
        </section>

      </main>

      <Footer />
    </>
  );
}