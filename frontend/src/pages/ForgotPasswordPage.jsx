import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

/* ── Theme tokens (matches LoginPage) ─────────────────────────── */
const S  = '#ff9900';
const S2 = 'rgba(255,153,0,0.20)';
const S4 = 'rgba(255,153,0,0.50)';
const W6 = 'rgba(255,255,255,0.60)';
const W9 = 'rgba(255,255,255,0.90)';

const API = import.meta.env.VITE_API_URL ?? '';

/* ── Shared style atoms ────────────────────────────────────────── */
const lbl = {
  display: 'block', color: 'rgba(255,255,255,0.65)', fontSize: 12,
  fontWeight: 600, marginBottom: 6, letterSpacing: '.04em',
};
const inp = {
  width: '100%', padding: '12px 14px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,153,0,0.20)',
  borderRadius: 10, color: W9,
  fontSize: 14, outline: 'none', transition: 'border-color .2s',
  boxSizing: 'border-box',
};
const errMsg = { margin: '5px 0 0', fontSize: 12, color: '#ff8888', lineHeight: 1.4 };
const btn = (disabled) => ({
  width: '100%', padding: 14, marginTop: 20,
  background: disabled ? '#c47700' : `linear-gradient(135deg, ${S} 0%, #e68a00 100%)`,
  border: 'none', borderRadius: 12,
  color: '#1a0a00', fontSize: 15, fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  boxShadow: disabled ? 'none' : '0 4px 20px rgba(255,153,0,0.25)',
  transition: 'all .2s', opacity: disabled ? 0.85 : 1,
});

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

/* ── Step indicator ────────────────────────────────────────────── */
function StepDots({ step }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
      {[1, 2, 3].map(n => (
        <div key={n} style={{
          width: n === step ? 24 : 8, height: 8, borderRadius: 4,
          background: n === step ? S : n < step ? '#e68a00' : 'rgba(255,153,0,0.20)',
          transition: 'all .3s',
        }} />
      ))}
    </div>
  );
}

/* ── Error banner ──────────────────────────────────────────────── */
function ErrBanner({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.3)',
      borderRadius: 10, padding: '12px 16px', marginBottom: 20,
      color: '#ffaaaa', fontSize: 13,
    }}>{msg}</div>
  );
}

/* ── Success banner ────────────────────────────────────────────── */
function OkBanner({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      background: 'rgba(0,200,100,0.10)', border: '1px solid rgba(0,200,100,0.25)',
      borderRadius: 10, padding: '12px 16px', marginBottom: 20,
      color: '#88ffbb', fontSize: 13,
    }}>{msg}</div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STEP 1 — Enter email
══════════════════════════════════════════════════════════════════ */
function StepEmail({ onNext }) {
  const [email, setEmail]   = useState('');
  const [err, setErr]       = useState('');
  const [loading, setLoad]  = useState(false);
  const [apiErr, setApiErr] = useState('');

  const validate = (v) => {
    if (!v) { setErr('Email is required'); return false; }
    if (!/\S+@\S+\.\S+/.test(v)) { setErr('Enter a valid email address'); return false; }
    setErr(''); return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate(email)) return;
    setLoad(true); setApiErr('');
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Something went wrong');
      onNext(email.toLowerCase());
    } catch (e) {
      setApiErr(e.message);
    } finally {
      setLoad(false);
    }
  };

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>🔑</div>
        <h2 style={{ color: W9, fontSize: 20, fontWeight: 700, margin: 0 }}>Forgot Password</h2>
        <p style={{ color: W6, fontSize: 13, margin: '6px 0 0' }}>
          Enter your registered email and we'll send a reset code.
        </p>
      </div>

      <StepDots step={1} />
      <ErrBanner msg={apiErr} />

      <form onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Email address</label>
          <input
            type="email" placeholder="you@example.com"
            value={email}
            onChange={e => { setEmail(e.target.value); if (err) validate(e.target.value); }}
            onBlur={e => validate(e.target.value)}
            autoComplete="email"
            style={{ ...inp, borderColor: err ? 'rgba(255,80,80,0.6)' : S2 }}
          />
          {err && <p style={errMsg}>{err}</p>}
        </div>

        <button type="submit" disabled={loading} style={btn(loading)}>
          {loading ? 'Sending code…' : 'Send Reset Code →'}
        </button>
      </form>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STEP 2 — Enter OTP
══════════════════════════════════════════════════════════════════ */
function StepOTP({ email, onNext }) {
  const [otp, setOtp]         = useState('');
  const [err, setErr]         = useState('');
  const [loading, setLoad]    = useState(false);
  const [apiErr, setApiErr]   = useState('');
  const [resendOk, setResend] = useState('');
  const [resending, setRe]    = useState(false);

  const validate = (v) => {
    if (!v) { setErr('Code is required'); return false; }
    if (!/^\d{6}$/.test(v)) { setErr('Enter the 6-digit code'); return false; }
    setErr(''); return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate(otp)) return;
    setLoad(true); setApiErr('');
    try {
      const res = await fetch(`${API}/api/auth/verify-reset-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Invalid or expired code');
      onNext(otp);
    } catch (e) {
      setApiErr(e.message);
    } finally {
      setLoad(false);
    }
  };

  const handleResend = async () => {
    setRe(true); setApiErr(''); setResend('');
    try {
      const res = await fetch(`${API}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to resend');
      setResend('A new code has been sent to your email.');
    } catch (e) {
      setApiErr(e.message);
    } finally {
      setRe(false);
    }
  };

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>📩</div>
        <h2 style={{ color: W9, fontSize: 20, fontWeight: 700, margin: 0 }}>Check Your Email</h2>
        <p style={{ color: W6, fontSize: 13, margin: '6px 0 0' }}>
          We sent a 6-digit code to<br />
          <span style={{ color: S, fontWeight: 600 }}>{email}</span>
        </p>
      </div>

      <StepDots step={2} />
      <ErrBanner msg={apiErr} />
      <OkBanner msg={resendOk} />

      <form onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>6-Digit Code</label>
          <input
            type="text" inputMode="numeric" maxLength={6}
            placeholder="_ _ _ _ _ _"
            value={otp}
            onChange={e => { const v = e.target.value.replace(/\D/g,''); setOtp(v); if (err) validate(v); }}
            onBlur={e => validate(e.target.value)}
            autoComplete="one-time-code"
            style={{
              ...inp,
              letterSpacing: '0.4em', fontSize: 22, textAlign: 'center', fontWeight: 700,
              borderColor: err ? 'rgba(255,80,80,0.6)' : S2,
            }}
          />
          {err && <p style={errMsg}>{err}</p>}
        </div>

        <button type="submit" disabled={loading} style={btn(loading)}>
          {loading ? 'Verifying…' : 'Verify Code →'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: 18, color: W6, fontSize: 13 }}>
        Didn't receive it?{' '}
        <button
          onClick={handleResend}
          disabled={resending}
          style={{
            background: 'none', border: 'none', color: S,
            fontWeight: 600, cursor: resending ? 'not-allowed' : 'pointer',
            fontSize: 13, padding: 0,
          }}
        >
          {resending ? 'Sending…' : 'Resend code'}
        </button>
      </p>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STEP 3 — New password
══════════════════════════════════════════════════════════════════ */
function StepNewPassword({ email, otp, onDone }) {
  const [password,  setPass]   = useState('');
  const [confirm,   setConf]   = useState('');
  const [showP,     setShowP]  = useState(false);
  const [showC,     setShowC]  = useState(false);
  const [errP,      setErrP]   = useState('');
  const [errC,      setErrC]   = useState('');
  const [loading,   setLoad]   = useState(false);
  const [apiErr,    setApiErr] = useState('');

  const validateP = (v) => {
    if (!v) { setErrP('Password is required'); return false; }
    if (v.length < 6) { setErrP('Minimum 6 characters'); return false; }
    setErrP(''); return true;
  };
  const validateC = (v) => {
    if (!v) { setErrC('Please confirm your password'); return false; }
    if (v !== password) { setErrC('Passwords do not match'); return false; }
    setErrC(''); return true;
  };

  const strength = () => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  };
  const strengthColors = ['#ff4444','#ff8800','#ffcc00','#44cc66'];
  const strengthLabels = ['Weak','Fair','Good','Strong'];
  const s = strength();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = validateP(password) & validateC(confirm);
    if (!ok) return;
    setLoad(true); setApiErr('');
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, new_password: password, confirm_password: confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Reset failed');
      onDone();
    } catch (e) {
      setApiErr(e.message);
    } finally {
      setLoad(false);
    }
  };

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 36, marginBottom: 6 }}>🔒</div>
        <h2 style={{ color: W9, fontSize: 20, fontWeight: 700, margin: 0 }}>New Password</h2>
        <p style={{ color: W6, fontSize: 13, margin: '6px 0 0' }}>
          Choose a strong password for your account.
        </p>
      </div>

      <StepDots step={3} />
      <ErrBanner msg={apiErr} />

      <form onSubmit={handleSubmit} noValidate>
        {/* New password */}
        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>New Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showP ? 'text' : 'password'}
              placeholder="New password"
              value={password}
              onChange={e => { setPass(e.target.value); if (errP) validateP(e.target.value); }}
              onBlur={e => validateP(e.target.value)}
              autoComplete="new-password"
              style={{ ...inp, paddingRight: 48, borderColor: errP ? 'rgba(255,80,80,0.6)' : S2 }}
            />
            <button type="button" onClick={() => setShowP(v => !v)}
              style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
                       background:'transparent',border:'none',cursor:'pointer',fontSize:16,padding:4 }}>
              {showP ? <EyeOff /> : <EyeOpen />}
            </button>
          </div>
          {errP && <p style={errMsg}>{errP}</p>}

          {/* Strength bar */}
          {password.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display:'flex', gap: 4, marginBottom: 4 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: i < s ? strengthColors[s-1] : 'rgba(255,255,255,0.1)',
                    transition: 'background .3s',
                  }} />
                ))}
              </div>
              <p style={{ margin: 0, fontSize: 11, color: s > 0 ? strengthColors[s-1] : W6 }}>
                {s > 0 ? strengthLabels[s-1] : ''}
              </p>
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div style={{ marginBottom: 8 }}>
          <label style={lbl}>Confirm Password</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showC ? 'text' : 'password'}
              placeholder="Repeat password"
              value={confirm}
              onChange={e => { setConf(e.target.value); if (errC) validateC(e.target.value); }}
              onBlur={e => validateC(e.target.value)}
              autoComplete="new-password"
              style={{ ...inp, paddingRight: 48, borderColor: errC ? 'rgba(255,80,80,0.6)' : S2 }}
            />
            <button type="button" onClick={() => setShowC(v => !v)}
              style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',
                       background:'transparent',border:'none',cursor:'pointer',fontSize:16,padding:4 }}>
              {showC ? <EyeOff /> : <EyeOpen />}
            </button>
          </div>
          {errC && <p style={errMsg}>{errC}</p>}
        </div>

        <button type="submit" disabled={loading} style={btn(loading)}>
          {loading ? 'Resetting…' : 'Reset Password →'}
        </button>
      </form>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   STEP 4 — Success screen
══════════════════════════════════════════════════════════════════ */
function StepSuccess() {
  const navigate = useNavigate();
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
      <h2 style={{ color: W9, fontSize: 22, fontWeight: 700, margin: '0 0 10px' }}>
        Password Reset!
      </h2>
      <p style={{ color: W6, fontSize: 14, margin: '0 0 28px', lineHeight: 1.6 }}>
        Your password has been changed successfully.<br />
        You can now sign in with your new password.
      </p>
      <button
        onClick={() => navigate('/login', { replace: true })}
        style={{ ...btn(false), marginTop: 0 }}
      >
        Go to Sign In →
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ROOT COMPONENT
══════════════════════════════════════════════════════════════════ */
export default function ForgotPasswordPage() {
  const [step,  setStep]  = useState(1);   // 1 | 2 | 3 | 4
  const [email, setEmail] = useState('');
  const [otp,   setOtp]   = useState('');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a0a00 0%, #3d1f00 50%, #1a0a00 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', sans-serif", padding: 20,
    }}>
      {/* Decorative circles */}
      <div style={{ position:'absolute', inset:0, overflow:'hidden', pointerEvents:'none' }}>
        {[['10%','20%'],['80%','70%'],['50%','90%']].map(([l,t],i) => (
          <div key={i} style={{
            position:'absolute', left:l, top:t, width:300, height:300,
            borderRadius:'50%', background:'rgba(255,153,0,0.04)',
            transform:'translate(-50%,-50%)',
          }} />
        ))}
      </div>

      {/* Back link — hidden on success step */}
      {step < 4 && (
        <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:420, marginBottom:12 }}>
          <Link to="/login" style={{
            display:'inline-flex', alignItems:'center', gap:5,
            padding:'6px 14px', background:'rgba(255,255,255,0.07)',
            border:`1px solid ${S2}`, borderRadius:50, color:W6,
            fontSize:12, fontWeight:600, textDecoration:'none',
          }}>← Back to Login</Link>
        </div>
      )}

      {/* Card */}
      <div style={{
        background:'rgba(255,255,255,0.04)', backdropFilter:'blur(20px)',
        border:`1px solid ${S2}`, borderRadius:20, padding:'40px 36px',
        width:'100%', maxWidth:420, boxShadow:'0 20px 60px rgba(0,0,0,0.5)',
        position:'relative', zIndex:1, boxSizing:'border-box',
      }}>
        {/* BharatMandir branding */}
        {step < 4 && (
          <div style={{ textAlign:'center', marginBottom:24 }}>
            <span style={{ fontSize:28 }}>🛕</span>
            <span style={{ color:S, fontSize:13, fontWeight:600,
                           letterSpacing:'.05em', display:'block', marginTop:2 }}>
              BharatMandir
            </span>
          </div>
        )}

        {step === 1 && (
          <StepEmail onNext={(e) => { setEmail(e); setStep(2); }} />
        )}
        {step === 2 && (
          <StepOTP email={email} onNext={(o) => { setOtp(o); setStep(3); }} />
        )}
        {step === 3 && (
          <StepNewPassword email={email} otp={otp} onDone={() => setStep(4)} />
        )}
        {step === 4 && <StepSuccess />}
      </div>
    </div>
  );
}