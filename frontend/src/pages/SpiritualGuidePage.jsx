import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SpiritualChat from '../components/SpiritualChat';

export default function SpiritualGuidePage() {
  return (
    <>
      <Navbar />

      <main style={{ minHeight: '100vh', background: '#f8f4ef' }}>

        {/* ══════════════ HERO ══════════════ */}
        <section style={{
          position: 'relative',
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
          padding: '52px 24px 60px',   /* reduced from 88px/96px so chat is above fold */
          textAlign: 'center',
          color: '#FFD580',
        }}>
          {/* OM watermark */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 320, color: 'rgba(255,255,255,0.028)',
            fontFamily: 'var(--font-hindi)',
            pointerEvents: 'none', userSelect: 'none', lineHeight: 1,
          }}>ॐ</div>

          {/* Radial glow */}
          <div style={{
            position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
            width: 600, height: 260,
            background: 'radial-gradient(ellipse, rgba(232,101,10,0.25) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto' }}>
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,213,128,0.12)', border: '1px solid rgba(255,213,128,0.35)',
              borderRadius: 50, padding: '6px 20px', marginBottom: 20,
              color: '#FFD580', fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase',
              fontWeight: 500,
            }}>
              ✨ AI Spiritual Guide
            </div>

            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(32px, 5vw, 58px)',   /* capped at 58px, was 72px */
              lineHeight: 1.05, marginBottom: 16,
              textShadow: '0 4px 40px rgba(0,0,0,0.3)',
              color: '#FFD580',
            }}>
              Your Troubles,{' '}
              <span style={{ color: '#ffb347' }}>Divine Guidance</span>
            </h1>

            <p style={{
              color: 'rgba(255,213,128,0.82)', fontSize: 17,
              maxWidth: 520, margin: '0 auto 24px',
              fontWeight: 300, lineHeight: 1.7,
            }}>
              Share your concerns and receive compassionate wisdom —
              mantras, rituals, and deity recommendations.
            </p>

            {/* Language pills — replaces inline bold text */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {['🇮🇳 Hindi', '🇬🇧 English', 'Hinglish'].map(lang => (
                <span key={lang} style={{
                  background: 'rgba(255,213,128,0.1)',
                  border: '1px solid rgba(255,213,128,0.28)',
                  borderRadius: 50, padding: '4px 16px',
                  fontSize: 13, color: '#FFD580', fontWeight: 400,
                }}>{lang}</span>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════ WAVE DIVIDER ══════════════ */}
        <div style={{ background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)', marginBottom: -2 }}>
          <svg viewBox="0 0 1440 40" xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: 40 }}>
            <path
              d="M0,40 L0,20 Q180,0 360,20 Q540,40 720,20 Q900,0 1080,20 Q1260,40 1440,20 L1440,40 Z"
              fill="#fff8ee"
            />
          </svg>
        </div>

        {/* ══════════════ TRUST BAR ══════════════ */}
        <div style={{
          background: '#fff8ee',
          borderBottom: '0.5px solid rgba(161,74,11,0.12)',
          padding: '13px 24px',
        }}>
          <div style={{
            maxWidth: 800, margin: '0 auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 32, flexWrap: 'wrap',
          }}>
            {[
              { icon: '🛡️', text: 'Private & secure' },
              { icon: '🕐', text: 'Available 24/7' },
              { icon: '💬', text: 'Hindi · English · Hinglish' },
              { icon: '🔥', text: 'Vedic wisdom' },
            ].map(item => (
              <div key={item.text} style={{
                display: 'flex', alignItems: 'center', gap: 7,
                fontSize: 13, color: '#7a3208', fontWeight: 500,
              }}>
                <span style={{ fontSize: 15 }}>{item.icon}</span>
                {item.text}
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════ CHAT SECTION ══════════════ */}
        <section style={{ background: '#f8f4ef', paddingTop: 48, paddingBottom: 72 }}>
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 20px' }}>

            {/* Section label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: '0.5px', background: 'rgba(161,74,11,0.2)' }} />
              <span style={{
                fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase',
                color: '#9a5c2a', fontWeight: 500,
              }}>Begin your conversation</span>
              <div style={{ flex: 1, height: '0.5px', background: 'rgba(161,74,11,0.2)' }} />
            </div>

            <SpiritualChat />
          </div>

          {/* ══════════════ FEATURE CARDS ══════════════ */}
          <div style={{ maxWidth: 800, margin: '36px auto 0', padding: '0 20px' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
              gap: 12,
            }}>
              {[
                { icon: '🕉️', title: 'Mantra recommendations', desc: 'Personalised mantras with pronunciation and chanting instructions.' },
                { icon: '🪔', title: 'Ritual guidance', desc: 'Step-by-step pooja rituals tailored to your situation and deity.' },
                { icon: '🐘', title: 'Deity suggestions', desc: 'Find which god or goddess to pray to for your specific concern.' },
                { icon: '🌙', title: 'Muhurta timing', desc: 'Auspicious times and days for rituals and spiritual practices.' },
              ].map(card => (
                <div key={card.title} style={{
                  background: '#fff', borderRadius: 12,
                  border: '0.5px solid rgba(161,74,11,0.14)',
                  padding: '18px 16px',
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: '#fff4e6',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, marginBottom: 12,
                  }}>{card.icon}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#3a1a00', marginBottom: 5 }}>{card.title}</div>
                  <div style={{ fontSize: 12.5, color: '#8a6040', lineHeight: 1.6 }}>{card.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <p style={{
            textAlign: 'center',
            maxWidth: 500,
            margin: '28px auto 0',
            fontSize: 12,
            color: '#9A7150',
            lineHeight: 1.8,
            padding: '14px 20px',
            background: 'rgba(255,213,128,0.07)',
            borderRadius: 10,
            border: '0.5px dashed rgba(161,74,11,0.2)',
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