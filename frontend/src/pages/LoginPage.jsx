import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUserAuth } from '../hooks/useUserAuth';

export default function LoginPage() {
  const { login, isLoggedIn, loading, error } = useUserAuth();
  const navigate = useNavigate();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (isLoggedIn) navigate('/', { replace: true });
  }, [isLoggedIn, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await login(email, password);
    if (res.success) navigate('/', { replace: true });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      fontFamily: 'var(--font-body)',
      display: 'flex',
      flexDirection: 'column',
    }}>

      {/* ── Top brand bar ── */}
      <div style={{
        height: 3,
        background: 'linear-gradient(90deg, var(--saffron-dark), var(--gold), var(--saffron-dark))',
      }} />
      <div style={{
        background: 'var(--brown)',
        padding: '14px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link to="/" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          textDecoration: 'none',
        }}>
          <span style={{ fontSize: 24 }}>🛕</span>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18, fontWeight: 700,
              color: 'var(--gold-light)',
            }}>BharatMandir</div>
          </div>
        </Link>
        <Link to="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 16px',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,213,128,0.2)',
          borderRadius: 50,
          color: 'rgba(255,255,255,0.65)',
          fontSize: 12, fontWeight: 600,
          textDecoration: 'none',
          transition: 'all 0.18s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
        >← Back to Home</Link>
      </div>

      {/* ── Page body ── */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 20px',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Background Om watermark */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 480, color: 'rgba(200,82,10,0.04)',
          fontFamily: 'var(--font-hindi)',
          pointerEvents: 'none', userSelect: 'none', lineHeight: 1,
        }}>ॐ</div>

        {/* Card */}
        <div style={{
          background: '#fff',
          borderRadius: 20,
          padding: '44px 40px',
          width: '100%', maxWidth: 420,
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--cream-dark)',
          position: 'relative', zIndex: 1,
        }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{
              width: 64, height: 64,
              background: 'linear-gradient(135deg, var(--saffron-light), var(--saffron-dark))',
              borderRadius: 18, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 28,
              margin: '0 auto 16px',
              boxShadow: '0 6px 20px rgba(200,82,10,0.30)',
            }}>🛕</div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26, fontWeight: 700,
              color: 'var(--brown)', margin: '0 0 6px',
            }}>Welcome Back</h1>
            <p style={{
              color: 'var(--text-muted)', fontSize: 14, margin: 0,
              fontFamily: 'var(--font-hindi)',
            }}>अपने खाते में प्रवेश करें</p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: 10, padding: '12px 16px',
              marginBottom: 20, color: '#B91C1C', fontSize: 13,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Email Address</label>
              <input
                type="email" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required autoComplete="email"
                style={inp}
                onFocus={e => { e.target.style.borderColor = 'var(--saffron)'; e.target.style.boxShadow = '0 0 0 3px rgba(200,82,10,0.10)'; }}
                onBlur={e  => { e.target.style.borderColor = 'var(--cream-dark)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Your password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  required autoComplete="current-password"
                  style={{ ...inp, paddingRight: 46 }}
                  onFocus={e => { e.target.style.borderColor = 'var(--saffron)'; e.target.style.boxShadow = '0 0 0 3px rgba(200,82,10,0.10)'; }}
                  onBlur={e  => { e.target.style.borderColor = 'var(--cream-dark)'; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShowPass(v => !v)} style={eyeBtn}>
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {/* Forgot password */}
            <div style={{ textAlign: 'right', marginBottom: 24 }}>
              <span style={{
                color: 'var(--saffron)', fontSize: 12,
                fontWeight: 600, cursor: 'pointer',
              }}
                onClick={() => alert('Password reset coming soon!')}
              >Forgot password?</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '14px',
                background: loading
                  ? 'var(--cream-dark)'
                  : 'linear-gradient(135deg, var(--saffron-light), var(--saffron-dark))',
                border: 'none', borderRadius: 12,
                color: loading ? 'var(--text-muted)' : '#fff',
                fontSize: 15, fontWeight: 700,
                fontFamily: 'var(--font-body)',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 18px rgba(200,82,10,0.32)',
                transition: 'all 0.22s',
                letterSpacing: '0.02em',
              }}
              onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(200,82,10,0.42)'; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 18px rgba(200,82,10,0.32)'; }}
            >
              {loading ? '🔄 Signing in…' : '🙏 Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            margin: '24px 0',
          }}>
            <div style={{ flex: 1, height: 1, background: 'var(--cream-dark)' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>New to BharatMandir?</span>
            <div style={{ flex: 1, height: 1, background: 'var(--cream-dark)' }} />
          </div>

          <Link to="/signup" style={{
            display: 'block', textAlign: 'center',
            padding: '13px',
            background: 'var(--parchment)',
            border: '1.5px solid var(--cream-dark)',
            borderRadius: 12,
            color: 'var(--saffron)', fontSize: 14, fontWeight: 700,
            textDecoration: 'none',
            transition: 'all 0.18s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--saffron)'; e.currentTarget.style.background = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--cream-dark)'; e.currentTarget.style.background = 'var(--parchment)'; }}
          >
            Create a free account →
          </Link>

          {/* Admin link */}
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <Link to="/admin/login" style={{
              color: 'var(--text-muted)', fontSize: 11,
              textDecoration: 'none', opacity: 0.6,
            }}>
              Admin Portal →
            </Link>
          </div>
        </div>
      </div>

      {/* ── Bottom strip ── */}
      <div style={{
        background: 'var(--brown)',
        padding: '14px 28px',
        textAlign: 'center',
      }}>
        <p style={{
          margin: 0, color: 'rgba(255,255,255,0.30)',
          fontSize: 12, fontFamily: 'var(--font-body)',
        }}>
          🙏 Jai Bharat · BharatMandir Temple Discovery Platform
        </p>
      </div>
    </div>
  );
}

const lbl = {
  display: 'block',
  color: 'var(--text-mid)',
  fontSize: 12, fontWeight: 700,
  marginBottom: 7,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  fontFamily: 'var(--font-body)',
};

const inp = {
  width: '100%', padding: '12px 14px',
  background: 'var(--cream)',
  border: '1.5px solid var(--cream-dark)',
  borderRadius: 10,
  color: 'var(--text-dark)',
  fontSize: 14,
  outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  boxSizing: 'border-box',
  fontFamily: 'var(--font-body)',
};

const eyeBtn = {
  position: 'absolute', right: 12, top: '50%',
  transform: 'translateY(-50%)',
  background: 'transparent', border: 'none',
  cursor: 'pointer', fontSize: 16, padding: 0,
  lineHeight: 1,
};