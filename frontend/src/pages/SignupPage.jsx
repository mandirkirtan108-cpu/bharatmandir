import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUserAuth } from '../hooks/useUserAuth';
import { userAuthAPI } from '../services/api';

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
  const [localErr, setLocalErr] = useState('');

  // OTP step
  const [step, setStep]           = useState('signup'); // 'signup' | 'otp'
  const [otp, setOtp]             = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError]   = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => { if (isLoggedIn) navigate('/', { replace: true }); }, [isLoggedIn, navigate]);

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const set = (k) => (e) => { setLocalErr(''); setForm(f => ({ ...f, [k]: e.target.value })); };

  // Step 1: Signup
  const handleSignup = async (e) => {
    e.preventDefault(); setLocalErr('');
    if (form.password !== form.confirmPassword) {
      setLocalErr('Passwords do not match'); return;
    }
    const res = await signup(form);
    if (res.success) {
      setStep('otp');
      setResendTimer(30);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setOtpError(''); setOtpSuccess('');
    if (otp.length !== 6) { setOtpError('6-digit OTP daalo.'); return; }
    setOtpLoading(true);
    try {
      const res = await userAuthAPI.verifyOTP(form.email, otp);
      userAuthAPI.saveTokens(res.data);
      setOtpSuccess('Email verified! 🎉 Home page pe ja rahe hain…');
      setTimeout(() => navigate('/', { replace: true }), 2000);
    } catch (err) {
      setOtpError(err.response?.data?.detail || 'OTP galat hai. Dobara try karein.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    setOtpError(''); setOtpSuccess('');
    try {
      await userAuthAPI.resendOTP(form.email);
      setOtpSuccess('Naya OTP bheja gaya! Email check karein.');
      setResendTimer(30);
    } catch (err) {
      setOtpError(err.response?.data?.detail || 'Resend failed.');
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
            {step === 'signup' ? 'Create your account' : 'Verify your email'}
          </p>
        </div>

        {/* ── STEP 1: Signup Form ── */}
        {step === 'signup' && (
          <>
            {displayError && (
              <div style={errBox}>{displayError}</div>
            )}
            <form onSubmit={handleSignup}>
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>👤 Full Name</label>
                <input type="text" placeholder="Your name"
                  value={form.name} onChange={set('name')} required style={inp}
                  onFocus={e => e.target.style.borderColor = S4}
                  onBlur={e  => e.target.style.borderColor = S2} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>✉️ Email</label>
                <input type="email" placeholder="you@example.com"
                  value={form.email} onChange={set('email')} required style={inp}
                  onFocus={e => e.target.style.borderColor = S4}
                  onBlur={e  => e.target.style.borderColor = S2} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>🔒 Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPass ? 'text' : 'password'} placeholder="Min 6 characters"
                    value={form.password} onChange={set('password')} required
                    style={{ ...inp, paddingRight: 44 }}
                    onFocus={e => e.target.style.borderColor = S4}
                    onBlur={e  => e.target.style.borderColor = S2} />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={eye}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={lbl}>🔑 Confirm Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showConf ? 'text' : 'password'} placeholder="Repeat password"
                    value={form.confirmPassword} onChange={set('confirmPassword')} required
                    style={{ ...inp, paddingRight: 44 }}
                    onFocus={e => e.target.style.borderColor = S4}
                    onBlur={e  => e.target.style.borderColor = S2} />
                  <button type="button" onClick={() => setShowConf(v => !v)} style={eye}>
                    {showConf ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} style={submitBtn(loading)}>
                {loading ? 'Account ban raha hai…' : 'Create Account'}
              </button>
            </form>
            <p style={{ textAlign: 'center', marginTop: 24, color: W6, fontSize: 13 }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: S, fontWeight: 600, textDecoration: 'none' }}>
                Sign in
              </Link>
            </p>
          </>
        )}

        {/* ── STEP 2: OTP Verification ── */}
        {step === 'otp' && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
              <p style={{ color: W6, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                <strong style={{ color: W9 }}>{form.email}</strong> pe 6-digit OTP bheja gaya hai.
                <br />OTP daalo aur account verify karo.
              </p>
            </div>

            {otpError   && <div style={errBox}>{otpError}</div>}
            {otpSuccess  && <div style={successBox}>{otpSuccess}</div>}

            <form onSubmit={handleVerifyOTP}>
              <div style={{ marginBottom: 24 }}>
                <label style={lbl}>🔢 Enter OTP</label>
                <input
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={e => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(v); setOtpError('');
                  }}
                  maxLength={6}
                  style={{
                    ...inp,
                    fontSize: 28, fontWeight: 700,
                    letterSpacing: 10, textAlign: 'center',
                  }}
                  onFocus={e => e.target.style.borderColor = S4}
                  onBlur={e  => e.target.style.borderColor = S2}
                />
              </div>
              <button type="submit" disabled={otpLoading || otp.length !== 6} style={submitBtn(otpLoading || otp.length !== 6)}>
                {otpLoading ? 'Verify ho raha hai…' : '✅ Verify OTP'}
              </button>
            </form>

            {/* Resend */}
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              {resendTimer > 0 ? (
                <p style={{ color: W6, fontSize: 13 }}>
                  OTP nahi mila? <span style={{ color: S }}>{resendTimer}s</span> baad resend karein
                </p>
              ) : (
                <button onClick={handleResend} style={{
                  background: 'transparent', border: 'none',
                  color: S, fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', textDecoration: 'underline',
                }}>
                  🔄 OTP Resend Karo
                </button>
              )}
            </div>

            <div style={{
              background: 'rgba(255,153,0,0.08)', border: `1px solid ${S2}`,
              borderRadius: 10, padding: '10px 14px', marginTop: 16,
              color: 'rgba(255,255,255,0.45)', fontSize: 12, textAlign: 'center',
            }}>
              ⚠️ Spam/Junk folder bhi check karein · OTP 10 minute mein expire hoga
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const submitBtn = (disabled) => ({
  width: '100%', padding: 14,
  background: disabled ? 'rgba(255,153,0,0.4)' : 'linear-gradient(135deg, #ff9900 0%, #e68a00 100%)',
  border: 'none', borderRadius: 12,
  color: disabled ? 'rgba(255,255,255,0.60)' : '#1a0a00',
  fontSize: 15, fontWeight: 700,
  cursor: disabled ? 'not-allowed' : 'pointer',
  boxShadow: disabled ? 'none' : '0 4px 20px rgba(255,153,0,0.20)',
});

const errBox = {
  background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.3)',
  borderRadius: 10, padding: '12px 16px', marginBottom: 20,
  color: '#ffaaaa', fontSize: 13,
};

const successBox = {
  background: 'rgba(100,255,180,0.10)', border: '1px solid rgba(100,255,180,0.3)',
  borderRadius: 10, padding: '12px 16px', marginBottom: 20,
  color: '#7fffc4', fontSize: 13,
};

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