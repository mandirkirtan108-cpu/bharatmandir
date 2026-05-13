import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SpiritualChat from '../components/SpiritualChat';


export default function SpiritualGuidePage() {
  return (
    <>
      <Navbar />

      <main style={{ minHeight: '100vh', background: '#f8f4ef' }}>

        {/* ══════════════ HERO — matches Route Planner exactly ══════════════ */}
        <section style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
          padding: '88px 24px 96px',
          textAlign: 'center',
          color: '#FFD580',
        }}>
          {/* OM watermark */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 360, color: 'rgba(255,255,255,0.028)',
            fontFamily: 'var(--font-hindi)',
            pointerEvents: 'none', userSelect: 'none', lineHeight: 1,
          }}>ॐ</div>

          {/* Radial glow */}
          <div style={{
            position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
            width: 600, height: 300,
            background: 'radial-gradient(ellipse, rgba(232,101,10,0.28) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto' }}>
            {/* Badge — same style as Route Planner */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,213,128,0.3)',
              borderRadius: 50, padding: '6px 20px', marginBottom: 20,
              color: '#FFD580', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
              fontWeight: 500, backdropFilter: 'blur(8px)',
            }}>
              ✨ AI Spiritual Guide
            </div>

            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(38px,6vw,72px)', lineHeight: 1.05, marginBottom: 18,
              textShadow: '0 4px 40px rgba(0,0,0,0.3)',
              color: '#FFD580',
            }}>
              Your Troubles,{' '}
              <span style={{ color: '#FFD580' }}>Divine Guidance</span>
            </h1>

            <p style={{
              color: '#FFD580', opacity: 0.82, fontSize: 18,
              maxWidth: 540, margin: '0 auto 0',
              fontWeight: 300, lineHeight: 1.7,
            }}>
              Share your concerns and receive compassionate wisdom —
              mantras, rituals, deity recommendations, in <strong style={{ fontWeight: 600 }}>Hindi, English, or Hinglish</strong>.
            </p>
          </div>
        </section>

        {/* ══════════════ CHAT SECTION — no overlap, same bg as Route Planner body ══════════════ */}
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