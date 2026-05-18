// pages/AdminLoginPage.jsx
// JWT-based login — replaces the old env-key login

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import { useAdminAuth } from '../hooks/useAdminAuth';

export default function AdminLoginPage() {
  const { login, isLoggedIn, loading, error } = useAdminAuth();
  const navigate = useNavigate();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    if (isLoggedIn) navigate('/admin/panel', { replace: true });
  }, [isLoggedIn, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await login(email, password);
    if (res.success) navigate('/admin/panel', { replace: true });
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a0a00 0%, #3d1f00 50%, #1a0a00 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      {/* Decorative background circles */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {['10%,20%', '80%,70%', '50%,90%'].map((pos, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: pos.split(',')[0], top: pos.split(',')[1],
            width: 300, height: 300,
            borderRadius: '50%',
            background: 'rgba(255,153,0,0.04)',
            transform: 'translate(-50%,-50%)',
          }} />
        ))}
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,153,0,0.2)',
        borderRadius: 20,
        padding: '48px 40px',
        width: '100%', maxWidth: 420,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        position: 'relative', zIndex: 1,
      }}>

        {/* ── Home button — upper-left corner of card ── */}
        <Link
          to="/"
          style={{
            position: 'absolute', top: 16, left: 16,
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '6px 12px',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,153,0,0.25)',
            borderRadius: 50,
            color: 'rgba(255,255,255,0.55)',
            fontSize: 12, fontWeight: 600,
            textDecoration: 'none',
            letterSpacing: '.03em',
            transition: 'all .2s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255,153,0,0.12)';
            e.currentTarget.style.borderColor = 'rgba(255,153,0,0.5)';
            e.currentTarget.style.color = '#ff9900';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
            e.currentTarget.style.borderColor = 'rgba(255,153,0,0.25)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
          }}
        >
          ← Home
        </Link>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛕</div>
          <h1 style={{
            fontFamily: "'Cinzel', serif",
            color: '#ff9900',
            fontSize: 22, margin: 0, letterSpacing: 1,
          }}>BharatMandir</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '8px 0 0' }}>
            Admin Portal
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Email */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)',
              fontSize: 13, marginBottom: 8, fontWeight: 500 }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="admin@bharatmandir.in"
              style={{
                width: '100%', padding: '12px 16px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,153,0,0.3)',
                borderRadius: 10, color: '#fff',
                fontSize: 15, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)',
              fontSize: 13, marginBottom: 8, fontWeight: 500 }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%', padding: '12px 44px 12px 16px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,153,0,0.3)',
                  borderRadius: 10, color: '#fff',
                  fontSize: 15, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <button type="button" onClick={() => setShowPass(p => !p)} style={{
                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer', fontSize: 18,
              }}>
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(220,38,38,0.15)',
              border: '1px solid rgba(220,38,38,0.4)',
              borderRadius: 8, padding: '10px 14px',
              color: '#fca5a5', fontSize: 13, marginBottom: 18,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px',
              background: loading
                ? 'rgba(255,153,0,0.4)'
                : 'linear-gradient(135deg, #ff9900, #e67e00)',
              border: 'none', borderRadius: 10,
              color: '#fff', fontSize: 16, fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: 0.5,
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Signing in...' : '🔐 Sign In'}
          </button>
        </form>

        <p style={{
          textAlign: 'center', color: 'rgba(255,255,255,0.25)',
          fontSize: 12, marginTop: 28,
        }}>
          BharatMandir Admin Portal · Restricted Access
        </p>
      </div>
    </div>
  );
}