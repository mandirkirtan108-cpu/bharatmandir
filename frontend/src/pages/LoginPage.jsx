import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUserAuth } from '../hooks/useUserAuth';

const S  = '#ff9900';
const S2 = 'rgba(255,153,0,0.20)';
const S4 = 'rgba(255,153,0,0.50)';
const W6 = 'rgba(255,255,255,0.60)';
const W9 = 'rgba(255,255,255,0.90)';

/* ── SVG Eye icons ─────────────────────────────────────────────── */
function EyeOpen() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

export default function LoginPage() {
  const { login, isLoggedIn, loading, error } = useUserAuth();
  const navigate = useNavigate();
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [emailErr,   setEmailErr]   = useState('');
  const [passErr,    setPassErr]    = useState('');

  useEffect(() => { if (isLoggedIn) navigate('/', { replace: true }); }, [isLoggedIn, navigate]);

  const validateEmail = (val) => {
    if (!val) return setEmailErr('Email is required');
    if (!/\S+@\S+\.\S+/.test(val)) return setEmailErr('Enter a valid email address');
    setEmailErr('');
  };
  const validatePassword = (val) => {
    if (!val) return setPassErr('Password is required');
    if (val.length < 6) return setPassErr('Password must be at least 6 characters');
    setPassErr('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    validateEmail(email);
    validatePassword(password);
    if (emailErr || passErr || !email || !password) return;
    const res = await login(email, password);
    if (res.success) navigate('/', { replace: true });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a0a00 0%, #3d1f00 50%, #1a0a00 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', sans-serif", padding: 20,
    }}>
      {/* Subtle bg circles */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {[['10%','20%'],['80%','70%'],['50%','90%']].map(([l,t],i) => (
          <div key={i} style={{
            position:'absolute', left:l, top:t, width:300, height:300,
            borderRadius:'50%', background:'rgba(255,153,0,0.04)', transform:'translate(-50%,-50%)',
          }} />
        ))}
      </div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, marginBottom: 12 }}>
        <Link to="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '6px 14px', background: 'rgba(255,255,255,0.07)',
          border: `1px solid ${S2}`, borderRadius: 50, color: W6,
          fontSize: 12, fontWeight: 600, textDecoration: 'none',
          transition: 'background .2s',
        }}>← Back to Home</Link>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)',
        border: `1px solid ${S2}`, borderRadius: 20, padding: '40px 36px',
        width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        position: 'relative', zIndex: 1, boxSizing: 'border-box',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🛕</div>
          <h1 style={{ color: W9, fontSize: 22, fontWeight: 700, margin: 0 }}>BharatMandir</h1>
          <p style={{ color: S, fontSize: 13, margin: '4px 0 0', letterSpacing: '.05em' }}>
            Sign in to your account
          </p>
        </div>

        {/* Server error */}
        {error && (
          <div style={{
            background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.3)',
            borderRadius: 10, padding: '12px 16px', marginBottom: 20,
            color: '#ffaaaa', fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="login-email" style={lbl}>Email address</label>
            <input
              id="login-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => { setEmail(e.target.value); if (emailErr) validateEmail(e.target.value); }}
              onBlur={e => validateEmail(e.target.value)}
              required
              autoComplete="email"
              style={{ ...inp, borderColor: emailErr ? 'rgba(255,80,80,0.6)' : S2 }}
              onFocus={e => e.target.style.borderColor = emailErr ? 'rgba(255,80,80,0.8)' : S4}
            />
            {emailErr && <p style={errMsg}>{emailErr}</p>}
          </div>

          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label htmlFor="login-password" style={{ ...lbl, marginBottom: 0 }}>Password</label>
              <Link to="/forgot-password" style={{
                fontSize: 12, color: S, textDecoration: 'none', fontWeight: 500,
              }}>
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                placeholder="Your password"
                value={password}
                onChange={e => { setPassword(e.target.value); if (passErr) validatePassword(e.target.value); }}
                onBlur={e => validatePassword(e.target.value)}
                required
                autoComplete="current-password"
                style={{ ...inp, paddingRight: 48, borderColor: passErr ? 'rgba(255,80,80,0.6)' : S2 }}
                onFocus={e => e.target.style.borderColor = passErr ? 'rgba(255,80,80,0.8)' : S4}
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? 'Hide password' : 'Show password'}
                style={eye}
              >
                {showPass ? <EyeOff /> : <EyeOpen />}
              </button>
            </div>
            {passErr && <p style={errMsg}>{passErr}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: 14, marginTop: 20,
              background: loading ? '#c47700' : `linear-gradient(135deg, ${S} 0%, #e68a00 100%)`,
              border: 'none', borderRadius: 12,
              color: '#1a0a00',
              fontSize: 15, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(255,153,0,0.25)',
              transition: 'all .2s',
              opacity: loading ? 0.85 : 1,
            }}
          >
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 22, color: W6, fontSize: 13 }}>
          Don&apos;t have an account?{' '}
          <Link to="/signup" style={{ color: S, fontWeight: 600, textDecoration: 'none' }}>
            Create one
          </Link>
        </p>

        <div style={{
          marginTop: 22, paddingTop: 18,
          borderTop: '1px solid rgba(255,153,0,0.10)',
          textAlign: 'center',
        }}>
          <Link to="/admin/login" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, textDecoration: 'none' }}>
            Admin Portal →
          </Link>
        </div>
      </div>
    </div>
  );
}

const lbl = {
  display: 'block', color: 'rgba(255,255,255,0.65)', fontSize: 12,
  fontWeight: 600, marginBottom: 6, letterSpacing: '.04em',
};
const inp = {
  width: '100%', padding: '12px 14px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,153,0,0.20)',
  borderRadius: 10, color: 'rgba(255,255,255,0.9)',
  fontSize: 14, outline: 'none', transition: 'border-color .2s',
  boxSizing: 'border-box',
};
const eye = {
  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
  background: 'transparent', border: 'none', cursor: 'pointer', padding: 4,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const errMsg = {
  margin: '5px 0 0', fontSize: 12, color: '#ff8888', lineHeight: 1.4,
};