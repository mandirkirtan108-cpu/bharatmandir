import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUserAuth } from '../hooks/useUserAuth';

const S  = '#ff9900';
const S2 = 'rgba(255,153,0,0.20)';
const S4 = 'rgba(255,153,0,0.40)';
const W6 = 'rgba(255,255,255,0.60)';
const W9 = 'rgba(255,255,255,0.90)';

export default function SignupPage() {
  const { signup, isLoggedIn, loading, error } = useUserAuth();
  const navigate = useNavigate();
  const [form, setForm]         = useState({ name:'', email:'', password:'', confirmPassword:'' });
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [success, setSuccess]   = useState(false);
  const [localErr, setLocalErr] = useState('');

  useEffect(() => { if (isLoggedIn) navigate('/', { replace: true }); }, [isLoggedIn, navigate]);

  const set = (k) => (e) => { setLocalErr(''); setForm(f => ({ ...f, [k]: e.target.value })); };

  const handleSubmit = async (e) => {
    e.preventDefault(); setLocalErr('');
    if (form.password !== form.confirmPassword) {
      setLocalErr('Passwords do not match'); return;
    }
    const res = await signup(form);
    if (res.success) {
      setSuccess(true);
      // ✅ Email verify hone tak redirect nahi — user email check kare
    }
  };

  const displayError = localErr || error;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a0a00 0%, #3d1f00 50%, #1a0a00 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', sans-serif", padding: 20,
    }}>
      {/* Background circles */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {[['10%','20%'],['80%','70%'],['50%','90%']].map(([l,t],i) => (
          <div key={i} style={{
            position: 'absolute', left: l, top: t,
            width: 300, height: 300, borderRadius: '50%',
            background: 'rgba(255,153,0,0.04)',
            transform: 'translate(-50%,-50%)',
          }} />
        ))}
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)',
        border: `1px solid ${S2}`, borderRadius: 20, padding: '48px 40px',
        width: '100%', maxWidth: 440,
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        position: 'relative', zIndex: 1,
      }}>

        {/* Home link */}
        <Link to="/" style={{
          position: 'absolute', top: 16, left: 16,
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', background: 'rgba(255,255,255,0.07)',
          border: `1px solid ${S2}`, borderRadius: 50, color: W6,
          fontSize: 12, fontWeight: 600, textDecoration: 'none',
        }}>← Home</Link>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32, marginTop: 8 }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>🛕</div>
          <h1 style={{ color: W9, fontSize: 24, fontWeight: 700, margin: 0 }}>BharatMandir</h1>
          <p style={{ color: S, fontSize: 13, margin: '4px 0 0', letterSpacing: '.05em' }}>
            Create your account
          </p>
        </div>

        {/* ✅ Success state — email bheja gaya */}
        {success ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>📧</div>
            <h3 style={{ color: '#7fffc4', fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>
              Verification Email Bheja Gaya!
            </h3>
            <p style={{ color: W6, fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
              <strong style={{ color: W9 }}>{form.email}</strong> pe ek verification link bheja gaya hai.
              <br /><br />
              Email open karein aur <strong style={{ color: S }}>"Verify Email"</strong> button click karein.
              Uske baad login kar paoge.
            </p>
            <div style={{
              background: 'rgba(255,153,0,0.08)', border: `1px solid ${S2}`,
              borderRadius: 10, padding: '12px 16px', marginBottom: 20,
              color: 'rgba(255,255,255,0.5)', fontSize: 12,
            }}>
              ⚠️ Spam/Junk folder bhi check karein
            </div>
            <Link to="/login" style={{
              display: 'inline-block',
              background: `linear-gradient(135deg, ${S} 0%, #e68a00 100%)`,
              color: '#1a0a00', padding: '12px 32px', borderRadius: 10,
              textDecoration: 'none', fontWeight: 700, fontSize: 14,
            }}>
              Login Page pe Jao →
            </Link>
          </div>
        ) : (
          <>
            {/* Error */}
            {displayError && (
              <div style={{
                background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.3)',
                borderRadius: 10, padding: '12px 16px', marginBottom: 20,
                color: '#ffaaaa', fontSize: 13,
              }}>{displayError}</div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Name */}
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>👤 Full Name</label>
                <input
                  type="text" placeholder="Your name"
                  value={form.name} onChange={set('name')} required
                  style={inp}
                  onFocus={e => e.target.style.borderColor = S4}
                  onBlur={e  => e.target.style.borderColor = S2}
                />
              </div>

              {/* Email */}
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>✉️ Email</label>
                <input
                  type="email" placeholder="you@example.com"
                  value={form.email} onChange={set('email')} required
                  style={inp}
                  onFocus={e => e.target.style.borderColor = S4}
                  onBlur={e  => e.target.style.borderColor = S2}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>🔒 Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={form.password} onChange={set('password')} required
                    style={{ ...inp, paddingRight: 44 }}
                    onFocus={e => e.target.style.borderColor = S4}
                    onBlur={e  => e.target.style.borderColor = S2}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={eye}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div style={{ marginBottom: 24 }}>
                <label style={lbl}>🔑 Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showConf ? 'text' : 'password'}
                    placeholder="Repeat password"
                    value={form.confirmPassword} onChange={set('confirmPassword')} required
                    style={{ ...inp, paddingRight: 44 }}
                    onFocus={e => e.target.style.borderColor = S4}
                    onBlur={e  => e.target.style.borderColor = S2}
                  />
                  <button type="button" onClick={() => setShowConf(v => !v)} style={eye}>
                    {showConf ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading} style={{
                width: '100%', padding: 14,
                background: loading
                  ? 'rgba(255,153,0,0.4)'
                  : `linear-gradient(135deg, ${S} 0%, #e68a00 100%)`,
                border: 'none', borderRadius: 12,
                color: loading ? W6 : '#1a0a00',
                fontSize: 15, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: loading ? 'none' : `0 4px 20px rgba(255,153,0,0.20)`,
              }}>
                {loading ? 'Account ban raha hai…' : 'Create Account'}
              </button>
            </form>

            {/* Login link */}
            <p style={{ textAlign: 'center', marginTop: 24, color: W6, fontSize: 13 }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: S, fontWeight: 600, textDecoration: 'none' }}>
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const lbl = {
  display: 'block', color: 'rgba(255,255,255,0.55)',
  fontSize: 12, fontWeight: 600, marginBottom: 6,
  letterSpacing: '.05em', textTransform: 'uppercase',
};
const inp = {
  width: '100%', padding: '12px 14px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,153,0,0.20)',
  borderRadius: 10, color: 'rgba(255,255,255,0.9)',
  fontSize: 14, outline: 'none',
  transition: 'border-color .2s', boxSizing: 'border-box',
};
const eye = {
  position: 'absolute', right: 12, top: '50%',
  transform: 'translateY(-50%)',
  background: 'transparent', border: 'none',
  cursor: 'pointer', fontSize: 16, padding: 0,
};