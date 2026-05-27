import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill all fields.'); return; }
    if (mode === 'signup' && !name) { setError('Please enter your name.'); return; }
    setLoading(true);
    // Simulate auth (replace with real API call)
    await new Promise(r => setTimeout(r, 700));
    const userData = { name: name || email.split('@')[0], email };
    login(userData);
    setLoading(false);
    navigate(from, { replace: true });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #FDF8F0 0%, #F0E6D0 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'Crimson Pro', serif",
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🛕</div>
            <div style={{ fontFamily: "'Cinzel', serif", fontSize: 26, fontWeight: 700, color: '#E8650A', letterSpacing: '.02em' }}>BharatMandir</div>
            <div style={{ fontFamily: "'Noto Sans Devanagari', sans-serif", fontSize: 13, color: '#8B6040', marginTop: 2 }}>भारत के मंदिर – एक स्थान पर</div>
          </a>
        </div>

        {/* Card */}
        <div style={{
          background: 'white',
          borderRadius: 20,
          padding: '36px 40px',
          boxShadow: '0 8px 40px rgba(61,31,0,0.14)',
          border: '1px solid #F0E6D0',
        }}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            background: '#FDF8F0',
            borderRadius: 50,
            padding: 4,
            marginBottom: 28,
          }}>
            {['login', 'signup'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                style={{
                  flex: 1,
                  padding: '9px 0',
                  borderRadius: 50,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: "'Cinzel', serif",
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '.05em',
                  transition: 'all .25s',
                  background: mode === m ? 'linear-gradient(135deg,#E8650A,#B84D00)' : 'transparent',
                  color: mode === m ? 'white' : '#8B6040',
                  boxShadow: mode === m ? '0 3px 12px rgba(232,101,10,.3)' : 'none',
                }}
              >
                {m === 'login' ? '🔐 Sign In' : '✨ Sign Up'}
              </button>
            ))}
          </div>

          <h2 style={{
            fontFamily: "'Cinzel', serif",
            fontSize: 20,
            color: '#3D1F00',
            marginBottom: 6,
            textAlign: 'center',
          }}>
            {mode === 'login' ? 'Welcome Back 🙏' : 'Join BharatMandir'}
          </h2>
          <p style={{ textAlign: 'center', color: '#8B6040', fontSize: 14, marginBottom: 24 }}>
            {mode === 'login' ? 'Sign in to access all features' : 'Create account to explore temples'}
          </p>

          {from !== '/' && (
            <div style={{
              background: '#FFF5E6',
              border: '1px solid #FFD4A0',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 20,
              fontSize: 13,
              color: '#B84D00',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              🔒 Please sign in to access this feature
            </div>
          )}

          {error && (
            <div style={{
              background: '#FFF0F0',
              border: '1px solid #FFC0C0',
              borderRadius: 10,
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: 13,
              color: '#C0392B',
            }}>{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = '#E8650A'}
                  onBlur={e => e.target.style.borderColor = '#F0E6D0'}
                />
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#E8650A'}
                onBlur={e => e.target.style.borderColor = '#F0E6D0'}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#E8650A'}
                onBlur={e => e.target.style.borderColor = '#F0E6D0'}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px',
                background: loading ? '#ccc' : 'linear-gradient(135deg,#E8650A,#B84D00)',
                color: 'white',
                border: 'none',
                borderRadius: 50,
                fontFamily: "'Cinzel', serif",
                fontSize: 14,
                fontWeight: 700,
                letterSpacing: '.06em',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(232,101,10,.35)',
                transition: 'all .2s',
              }}
            >
              {loading ? '⏳ Please wait...' : mode === 'login' ? '🙏 Sign In' : '✨ Create Account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#8B6040' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); }}
              style={{ background: 'none', border: 'none', color: '#E8650A', fontWeight: 700, cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}
            >
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <a href="/" style={{ fontSize: 12, color: '#8B6040', textDecoration: 'underline' }}>
              ← Back to Home
            </a>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#8B6040' }}>
          🕉️ Your spiritual journey awaits
        </p>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontFamily: "'Cinzel', serif",
  fontWeight: 600,
  letterSpacing: '.05em',
  color: '#4A2800',
  marginBottom: 6,
  textTransform: 'uppercase',
};

const inputStyle = {
  width: '100%',
  padding: '11px 16px',
  border: '2px solid #F0E6D0',
  borderRadius: 10,
  fontFamily: "'Crimson Pro', serif",
  fontSize: 15,
  background: '#FDF8F0',
  color: '#1A0A00',
  outline: 'none',
  transition: 'border-color .2s',
  boxSizing: 'border-box',
};