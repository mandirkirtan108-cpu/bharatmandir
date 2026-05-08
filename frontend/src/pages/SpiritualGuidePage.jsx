import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SpiritualChat from '../components/SpiritualChat';

const FEATURES = [
  { icon: '🕉️', title: 'Mantra Guidance',      desc: 'Personalized mantras for your situation' },
  { icon: '🛕', title: 'Temple Suggestions',    desc: 'Which deity & temple to visit' },
  { icon: '🪔', title: 'Ritual Practices',      desc: 'Prayers and pujas to bring relief' },
  { icon: '🌿', title: 'Hindi, English & More', desc: 'Responds in Hindi, English, Hinglish & more' },
  { icon: '💬', title: 'Follow-up Questions',   desc: 'Suggested questions to deepen your guidance' },
  { icon: '🔮', title: 'AI-Powered Wisdom',     desc: 'Powered by Claude, attuned to your intent' },
];

export default function SpiritualGuidePage() {
  return (
    <>
      <Navbar />

      <main style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: 60 }}>

        {/* ── Hero Banner ── */}
        <div style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #FF6B00 0%, #8B1A1A 100%)',
          padding: '52px 24px 48px',
          textAlign: 'center',
          color: 'white',
          overflow: 'hidden',
        }}>
          {/* Radial glow behind OM */}
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 480, height: 480,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,210,60,0.13) 0%, transparent 68%)',
            pointerEvents: 'none',
          }} />

          {/* Corner diyas */}
          <div style={{ position: 'absolute', top: 18, left: 22, fontSize: 22, opacity: 0.35 }}>🪔</div>
          <div style={{ position: 'absolute', top: 18, right: 22, fontSize: 22, opacity: 0.35 }}>🪔</div>
          <div style={{ position: 'absolute', bottom: 18, left: 22, fontSize: 16, opacity: 0.2 }}>🌸</div>
          <div style={{ position: 'absolute', bottom: 18, right: 22, fontSize: 16, opacity: 0.2 }}>🌸</div>

          {/* OM */}
          <div style={{ fontSize: 56, marginBottom: 14, lineHeight: 1, position: 'relative' }}>🕉️</div>

          {/* Title */}
          <h1 style={{
            fontSize: 'clamp(26px, 4vw, 40px)',
            fontFamily: 'var(--font-display)',
            margin: '0 0 8px',
            fontWeight: 800,
            letterSpacing: '-0.01em',
            position: 'relative',
          }}>
            Adhyatmik Margdarshak
          </h1>

          {/* Subtitle tag */}
          <p style={{
            fontSize: 11.5,
            opacity: 0.72,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 18,
            fontWeight: 500,
            position: 'relative',
          }}>
            AI Spiritual Guide · BharatMandir
          </p>

          {/* Description */}
          <p style={{
            fontSize: 16,
            opacity: 0.92,
            maxWidth: 540,
            margin: '0 auto 28px',
            lineHeight: 1.72,
            position: 'relative',
          }}>
            Share your troubles and receive compassionate guidance —
            mantras, rituals, deity recommendations, and follow-up wisdom,
            in <strong>Hindi, English, or Hinglish</strong>.
          </p>

          {/* Feature chips */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 9,
            justifyContent: 'center',
            position: 'relative',
          }}>
            {FEATURES.map(f => (
              <div
                key={f.title}
                title={f.desc}
                style={{
                  background: 'rgba(255,255,255,0.13)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: 24,
                  padding: '6px 15px',
                  fontSize: 12.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  border: '1px solid rgba(255,255,255,0.22)',
                  cursor: 'default',
                  fontWeight: 600,
                  letterSpacing: '0.01em',
                }}
              >
                <span style={{ fontSize: 14 }}>{f.icon}</span>
                <span>{f.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Chat Card — overlaps hero bottom edge ── */}
        <div style={{
          maxWidth: 800,
          margin: '-26px auto 0',
          padding: '0 16px',
          position: 'relative',
          zIndex: 10,
        }}>
          <SpiritualChat />
        </div>

        {/* ── Disclaimer ── */}
        <p style={{
          textAlign: 'center',
          maxWidth: 540,
          margin: '26px auto 0',
          fontSize: 12,
          color: '#a07040',
          lineHeight: 1.7,
          padding: '0 16px',
          opacity: 0.78,
        }}>
          🙏 This guide is for spiritual inspiration only. Please consult qualified professionals
          for medical, legal, or financial decisions.
        </p>
      </main>

      <Footer />
    </>
  );
}