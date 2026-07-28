import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Landmark, ArrowLeft, Home, Star, Send, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const UI_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Roboto", sans-serif';
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export default function FeedbackPage() {
  const { t } = useTranslation();

  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [rating, setRating]   = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!message.trim()) {
      setError('Please share a few words before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim() || null,
          rating: rating || null,
          message: message.trim(),
          page_url: typeof window !== 'undefined' ? window.location.href : null,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Something went wrong. Please try again.');
      }

      setSubmitted(true);
      setName(''); setEmail(''); setRating(0); setMessage('');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />

      <main style={{ minHeight: '100vh', background: '#f8f4ef' }}>

        {/* ══════════════ HERO — matches SpiritualGuidePage / PanchangPage ══════════════ */}
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
            {/* Back to Home */}
            <Link
              to="/"
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                marginBottom: 18, padding: '6px 4px',
                color: 'rgba(255,213,128,0.85)', fontSize: 13, fontWeight: 500,
                textDecoration: 'none', fontFamily: UI_FONT,
                transition: 'color .15s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,213,128,0.85)'}
            >
              <ArrowLeft size={15} /> Back to Home
            </Link>

            {/* Badge */}
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
              <Landmark size={11} /> We'd love to hear from you
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
              Share Your Feedback
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
              Help us make BharatMandir better for every devotee. Tell us what you loved,
              what didn't work, or what you'd like to see next.
            </p>
          </div>
        </section>

        {/* ══════════════ FORM SECTION ══════════════ */}
        <section style={{ background: '#f8f4ef', paddingTop: 48, paddingBottom: 80 }}>
          <div style={{ maxWidth: 620, margin: '0 auto', padding: '0 20px' }}>

            <div style={{
              background: 'white', borderRadius: 'var(--radius-lg, 18px)',
              border: '1.5px solid var(--cream-dark, #EDE3CE)',
              boxShadow: 'var(--shadow-md, 0 8px 32px rgba(44,21,0,0.14))',
              padding: '32px 28px',
            }}>

              {submitted ? (
                <div style={{ textAlign: 'center', padding: '24px 8px' }}>
                  <div style={{
                    width: 62, height: 62, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #22c55e, #15803d)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 18px', boxShadow: '0 6px 20px rgba(21,128,61,0.28)',
                  }}>
                    <CheckCircle2 size={30} color="white" />
                  </div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontSize: 24,
                    color: 'var(--brown, #2C1500)', margin: '0 0 8px',
                  }}>
                    Thank you! 🙏
                  </h3>
                  <p style={{
                    color: 'var(--text-light, #7A5538)', fontSize: 14,
                    lineHeight: 1.7, margin: '0 0 22px', fontFamily: UI_FONT,
                  }}>
                    Your feedback has been received. We truly appreciate you taking
                    the time to help us improve.
                  </p>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setSubmitted(false)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '11px 22px', borderRadius: 50, border: 'none',
                        background: 'linear-gradient(135deg, var(--saffron-light, #E06B25), var(--saffron-dark, #9A3C05))',
                        color: 'white', fontFamily: 'var(--font-display)', fontSize: 13,
                        letterSpacing: '.04em', fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      Send more feedback
                    </button>
                    <Link
                      to="/"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        padding: '11px 22px', borderRadius: 50,
                        border: '2px solid var(--cream-dark, #EDE3CE)', background: 'white',
                        color: 'var(--text-mid, #4A2C10)', fontFamily: 'var(--font-display)', fontSize: 13,
                        letterSpacing: '.04em', fontWeight: 700, textDecoration: 'none',
                      }}
                    >
                      <Home size={14} /> Back to Home
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ fontFamily: UI_FONT }}>

                  {error && (
                    <div style={{
                      background: '#fef2f2', border: '1.5px solid #fca5a5',
                      borderRadius: 12, padding: '12px 16px', marginBottom: 18,
                      display: 'flex', gap: 8, alignItems: 'center',
                      color: '#b91c1c', fontSize: 13,
                    }}>
                      <AlertTriangle size={16} /> {error}
                    </div>
                  )}

                  {/* Rating */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{
                      display: 'block', fontSize: 13, fontWeight: 600,
                      color: 'var(--text-mid, #4A2C10)', marginBottom: 8,
                    }}>
                      How was your experience?
                    </label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          type="button"
                          key={n}
                          onClick={() => setRating(n)}
                          onMouseEnter={() => setHoverRating(n)}
                          onMouseLeave={() => setHoverRating(0)}
                          aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: 4, lineHeight: 0,
                          }}
                        >
                          <Star
                            size={28}
                            fill={(hoverRating || rating) >= n ? '#E8650A' : 'none'}
                            color={(hoverRating || rating) >= n ? '#E8650A' : '#D8C7AC'}
                            strokeWidth={1.8}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name + Email */}
                  <div style={{
                    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
                    marginBottom: 18,
                  }}>
                    <div>
                      <label style={{
                        display: 'block', fontSize: 13, fontWeight: 600,
                        color: 'var(--text-mid, #4A2C10)', marginBottom: 6,
                      }}>
                        Name <span style={{ fontWeight: 400, color: 'var(--text-light, #7A5538)' }}>(optional)</span>
                      </label>
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Your name"
                        style={inputStyle}
                        onFocus={e => e.target.style.borderColor = 'var(--saffron, #C8520A)'}
                        onBlur={e => e.target.style.borderColor = 'var(--cream-dark, #EDE3CE)'}
                      />
                    </div>
                    <div>
                      <label style={{
                        display: 'block', fontSize: 13, fontWeight: 600,
                        color: 'var(--text-mid, #4A2C10)', marginBottom: 6,
                      }}>
                        Email <span style={{ fontWeight: 400, color: 'var(--text-light, #7A5538)' }}>(optional)</span>
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        style={inputStyle}
                        onFocus={e => e.target.style.borderColor = 'var(--saffron, #C8520A)'}
                        onBlur={e => e.target.style.borderColor = 'var(--cream-dark, #EDE3CE)'}
                      />
                    </div>
                  </div>

                  {/* Message */}
                  <div style={{ marginBottom: 24 }}>
                    <label style={{
                      display: 'block', fontSize: 13, fontWeight: 600,
                      color: 'var(--text-mid, #4A2C10)', marginBottom: 6,
                    }}>
                      Your feedback <span style={{ color: '#C8520A' }}>*</span>
                    </label>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder="Tell us what's on your mind — bugs, ideas, praise, anything!"
                      rows={5}
                      required
                      style={{ ...inputStyle, resize: 'vertical', minHeight: 110 }}
                      onFocus={e => e.target.style.borderColor = 'var(--saffron, #C8520A)'}
                      onBlur={e => e.target.style.borderColor = 'var(--cream-dark, #EDE3CE)'}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      width: '100%', padding: '13px 20px', borderRadius: 50, border: 'none',
                      background: submitting
                        ? 'linear-gradient(135deg, #d8a582, #c98a5c)'
                        : 'linear-gradient(135deg, var(--saffron-light, #E06B25), var(--saffron-dark, #9A3C05))',
                      color: 'white', fontFamily: 'var(--font-display)', fontSize: 15,
                      letterSpacing: '.04em', fontWeight: 700,
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 20px rgba(200,82,10,0.28)',
                      transition: 'all .2s',
                    }}
                  >
                    {submitting
                      ? <><Loader2 size={16} style={{ animation: 'spin .8s linear infinite' }} /> Submitting…</>
                      : <><Send size={16} /> Submit Feedback</>}
                  </button>
                </form>
              )}
            </div>

            {/* Disclaimer */}
            <p style={{
              textAlign: 'center',
              maxWidth: 540,
              margin: '22px auto 0',
              fontSize: 12,
              color: '#9A7150',
              lineHeight: 1.7,
              padding: '0 16px',
              opacity: 0.85,
              fontFamily: UI_FONT,
            }}>
              🙏 Your feedback goes straight to our team and helps shape what we build next.
            </p>
          </div>
        </section>

      </main>

      <Footer />
    </>
  );
}

const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '11px 14px', borderRadius: 'var(--radius, 12px)',
  border: '2px solid var(--cream-dark, #EDE3CE)',
  fontFamily: 'var(--font-body)', fontSize: 14,
  background: '#fff', color: 'var(--text-dark, #1A0D00)',
  outline: 'none', transition: 'border-color .15s',
};