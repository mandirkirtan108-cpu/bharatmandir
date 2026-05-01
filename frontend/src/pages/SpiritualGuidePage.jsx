import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SpiritualChat from '../components/SpiritualChat';

const FEATURES = [
  { icon: '🕉️', title: 'Mantra Guidance', desc: 'Personalized mantras for your situation' },
  { icon: '🛕', title: 'Temple Suggestions', desc: 'Which deity & temple to visit' },
  { icon: '🪔', title: 'Ritual Practices', desc: 'Prayers and pujas to bring relief' },
  { icon: '🌿', title: 'Hindi & English', desc: 'Respond in your preferred language' },
];

export default function SpiritualGuidePage() {
  return (
    <>
      <Navbar />

      <main style={{ minHeight: '100vh', background: 'var(--cream)', paddingBottom: 60 }}>

        {/* Hero Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #FF6B00 0%, #8B1A1A 100%)',
          padding: '48px 24px 36px',
          textAlign: 'center',
          color: 'white',
        }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🕉️</div>
          <h1 style={{
            fontSize: 'clamp(24px, 4vw, 38px)',
            fontFamily: 'var(--font-display)',
            margin: '0 0 10px',
            fontWeight: 800,
            letterSpacing: '-.01em',
          }}>
            Adhyatmik Margdarshak
          </h1>
          <p style={{ fontSize: 16, opacity: 0.9, maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
            Your AI-powered Hindu Spiritual Guide — share your troubles and receive
            compassionate guidance with mantras, rituals, and temple recommendations.
          </p>

          {/* Feature chips */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 10,
            justifyContent: 'center', marginTop: 24,
          }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                background: 'rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)',
                borderRadius: 12,
                padding: '8px 16px',
                fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 6,
                border: '1px solid rgba(255,255,255,0.25)',
              }}>
                <span>{f.icon}</span>
                <span style={{ fontWeight: 600 }}>{f.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div style={{
          maxWidth: 780,
          margin: '-24px auto 0',
          padding: '0 16px',
        }}>
          <SpiritualChat />
        </div>

        {/* Disclaimer */}
        <p style={{
          textAlign: 'center', maxWidth: 540, margin: '24px auto 0',
          fontSize: 12, color: '#999', lineHeight: 1.6, padding: '0 16px',
        }}>
          🙏 This guide is for spiritual inspiration only. Please consult qualified professionals
          for medical, legal, or financial decisions.
        </p>
      </main>

      <Footer />
    </>
  );
}