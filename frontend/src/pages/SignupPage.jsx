import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUserAuth } from '../hooks/useUserAuth';
import { userAuthAPI } from '../services/api';

export default function SignupPage() {
  const { signup, isLoggedIn, loading, error } = useUserAuth();
  const navigate = useNavigate();

  const [form, setForm]             = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPass, setShowPass]     = useState(false);
  const [showConf, setShowConf]     = useState(false);
  const [localErr, setLocalErr]     = useState('');
  const [pwStrength, setPwStrength] = useState(0); // 0–3

  // OTP step
  const [step, setStep]               = useState('signup'); // 'signup' | 'otp'
  const [otp, setOtp]                 = useState('');
  const [otpLoading, setOtpLoading]   = useState(false);
  const [otpError, setOtpError]       = useState('');
  const [otpSuccess, setOtpSuccess]   = useState('');
  const [resendTimer, setResendTimer] = useState(0);

  useEffect(() => {
    if (isLoggedIn) navigate('/', { replace: true });
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const t = setTimeout(() => setResendTimer(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [resendTimer]);

  const set = (k) => (e) => {
    setLocalErr('');
    const val = e.target.value;
    setForm(f => ({ ...f, [k]: val }));
    if (k === 'password') {
      let s = 0;
      if (val.length >= 6)  s++;
      if (val.length >= 10) s++;
      if (/[^a-zA-Z0-9]/.test(val) || /\d/.test(val)) s++;
      setPwStrength(s);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLocalErr('');
    if (form.password !== form.confirmPassword) {
      setLocalErr('Passwords do not match'); return;
    }
    if (form.password.length < 6) {
      setLocalErr('Password must be at least 6 characters'); return;
    }
    const res = await signup(form);
    if (res.success) {
      setStep('otp');
      setResendTimer(30);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setOtpError(''); setOtpSuccess('');
    if (otp.length !== 6) { setOtpError('Please enter the 6-digit OTP.'); return; }
    setOtpLoading(true);
    try {
      const res = await userAuthAPI.verifyOTP(form.email, otp);
      userAuthAPI.saveTokens(res.data);
      setOtpSuccess('Email verified! 🎉 Redirecting…');
      setTimeout(() => navigate('/', { replace: true }), 2000);
    } catch (err) {
      setOtpError(err.response?.data?.detail || 'Invalid OTP. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResend = async () => {
    setOtpError(''); setOtpSuccess('');
    try {
      await userAuthAPI.resendOTP(form.email);
      setOtpSuccess('A new OTP has been sent!');
      setResendTimer(30);
    } catch (err) {
      setOtpError(err.response?.data?.detail || 'Resend failed. Please try again.');
    }
  };

  const displayError = localErr || error;

  const strengthColors = ['var(--cream-dark)', '#EF4444', '#F59E0B', '#10B981'];
  const strengthLabels = ['', 'Weak', 'Fair', 'Strong'];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      fontFamily: 'var(--font-body)',
      display: 'flex', flexDirection: 'column',
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
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <span style={{ fontSize: 24 }}>🛕</span>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18, fontWeight: 700,
            color: 'var(--gold-light)',
          }}>BharatMandir</div>
        </Link>
        <Link to="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '7px 16px',
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,213,128,0.2)',
          borderRadius: 50,
          color: 'rgba(255,255,255,0.65)',
          fontSize: 12, fontWeight: 600,
          textDecoration: 'none', transition: 'all 0.18s',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
        >← Back to Home</Link>
      </div>

      {/* ── Body ── */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 20px',
        position: 'relative', overflow: 'hidden',
      }}>

        {/* Om watermark */}
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
          width: '100%', maxWidth: 440,
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--cream-dark)',
          position: 'relative', zIndex: 1,
        }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 64, height: 64,
              background: 'linear-gradient(135deg, var(--saffron-light), var(--saffron-dark))',
              borderRadius: 18, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 28,
              margin: '0 auto 16px',
              boxShadow: '0 6px 20px rgba(200,82,10,0.30)',
            }}>
              {step === 'otp' ? '📧' : '🙏'}
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 26, fontWeight: 700,
              color: 'var(--brown)', margin: '0 0 6px',
            }}>
              {step === 'signup' ? 'Join BharatMandir' : 'Verify Your Email'}
            </h1>
            <p style={{
              color: 'var(--text-muted)', fontSize: 14, margin: 0,
              fontFamily: 'var(--font-hindi)',
            }}>
              {step === 'signup' ? 'देवभूमि से जुड़ें' : 'ईमेल सत्यापित करें'}
            </p>
          </div>

          {/* ── STEP 1: Signup Form ── */}
          {step === 'signup' && (
            <>
              {displayError && (
                <div style={errBox}><span>⚠️</span> {displayError}</div>
              )}

              <form onSubmit={handleSignup}>
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Full Name</label>
                  <input type="text" placeholder="Your name"
                    value={form.name} onChange={set('name')} required style={inp}
                    onFocus={focusStyle} onBlur={blurStyle}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Email Address</label>
                  <input type="email" placeholder="you@example.com"
                    value={form.email} onChange={set('email')} required style={inp}
                    onFocus={focusStyle} onBlur={blurStyle}
                  />
                </div>

                <div style={{ marginBottom: 8 }}>
                  <label style={lbl}>Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPass ? 'text' : 'password'} placeholder="Min 6 characters"
                      value={form.password} onChange={set('password')} required
                      style={{ ...inp, paddingRight: 46 }}
                      onFocus={focusStyle} onBlur={blurStyle}
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)} style={eyeBtn}>
                      {showPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                {/* Password strength bar */}
                {form.password.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                      {[1, 2, 3].map(i => (
                        <div key={i} style={{
                          flex: 1, height: 3, borderRadius: 99,
                          background: i <= pwStrength ? strengthColors[pwStrength] : 'var(--cream-dark)',
                          transition: 'background 0.3s',
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 11, color: strengthColors[pwStrength], fontWeight: 600 }}>
                      {strengthLabels[pwStrength]}
                    </span>
                  </div>
                )}

                <div style={{ marginBottom: 24 }}>
                  <label style={lbl}>Confirm Password</label>
                  <div style={{ position: 'relative' }}>
                    <input type={showConf ? 'text' : 'password'} placeholder="Repeat password"
                      value={form.confirmPassword} onChange={set('confirmPassword')} required
                      style={{ ...inp, paddingRight: 46 }}
                      onFocus={focusStyle} onBlur={blurStyle}
                    />
                    <button type="button" onClick={() => setShowConf(v => !v)} style={eyeBtn}>
                      {showConf ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <button type="submit" disabled={loading} style={submitBtn(loading)}
                  onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(200,82,10,0.42)'; }}}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : '0 4px 18px rgba(200,82,10,0.32)'; }}
                >
                  {loading ? '🔄 Creating account…' : '🙏 Create Account'}
                </button>
              </form>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0',
              }}>
                <div style={{ flex: 1, height: 1, background: 'var(--cream-dark)' }} />
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Already have an account?</span>
                <div style={{ flex: 1, height: 1, background: 'var(--cream-dark)' }} />
              </div>

              <Link to="/login" style={{
                display: 'block', textAlign: 'center',
                padding: '13px',
                background: 'var(--parchment)',
                border: '1.5px solid var(--cream-dark)',
                borderRadius: 12,
                color: 'var(--saffron)', fontSize: 14, fontWeight: 700,
                textDecoration: 'none', transition: 'all 0.18s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--saffron)'; e.currentTarget.style.background = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--cream-dark)'; e.currentTarget.style.background = 'var(--parchment)'; }}
              >
                Sign in instead →
              </Link>
            </>
          )}

          {/* ── STEP 2: OTP Verification ── */}
          {step === 'otp' && (
            <div>
              {/* Email confirmation banner */}
              <div style={{
                background: 'var(--parchment)',
                border: '1px solid var(--cream-dark)',
                borderRadius: 12, padding: '14px 16px',
                marginBottom: 20, textAlign: 'center',
              }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.6 }}>
                  A 6-digit OTP was sent to{' '}
                  <strong style={{ color: 'var(--saffron)' }}>{form.email}</strong>
                </p>
              </div>

              {otpError   && <div style={errBox}><span>⚠️</span> {otpError}</div>}
              {otpSuccess && <div style={successBox}><span>✅</span> {otpSuccess}</div>}

              <form onSubmit={handleVerifyOTP}>
                <div style={{ marginBottom: 24 }}>
                  <label style={lbl}>Enter 6-Digit OTP</label>
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
                      letterSpacing: 12, textAlign: 'center',
                    }}
                    onFocus={focusStyle}
                    onBlur={blurStyle}
                  />
                  {/* OTP dots indicator */}
                  <div style={{
                    display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10,
                  }}>
                    {[0,1,2,3,4,5].map(i => (
                      <div key={i} style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: i < otp.length ? 'var(--saffron)' : 'var(--cream-dark)',
                        transition: 'background 0.2s',
                      }} />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={otpLoading || otp.length !== 6}
                  style={submitBtn(otpLoading || otp.length !== 6)}
                  onMouseEnter={e => { if (otp.length === 6 && !otpLoading) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(200,82,10,0.42)'; }}}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 18px rgba(200,82,10,0.32)'; }}
                >
                  {otpLoading ? '🔄 Verifying…' : '✅ Verify & Continue'}
                </button>
              </form>

              {/* Resend */}
              <div style={{ textAlign: 'center', marginTop: 18 }}>
                {resendTimer > 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                    Resend OTP in{' '}
                    <span style={{ color: 'var(--saffron)', fontWeight: 700 }}>{resendTimer}s</span>
                  </p>
                ) : (
                  <button onClick={handleResend} style={{
                    background: 'transparent', border: 'none',
                    color: 'var(--saffron)', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', textDecoration: 'underline',
                    fontFamily: 'var(--font-body)',
                  }}>🔄 Resend OTP</button>
                )}
              </div>

              <div style={{
                background: 'var(--parchment)', border: '1px solid var(--cream-dark)',
                borderRadius: 10, padding: '10px 14px', marginTop: 16,
                color: 'var(--text-muted)', fontSize: 12, textAlign: 'center',
                lineHeight: 1.6,
              }}>
                ⚠️ Check your Spam/Junk folder · OTP expires in 10 minutes
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom strip ── */}
      <div style={{ background: 'var(--brown)', padding: '14px 28px', textAlign: 'center' }}>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.30)', fontSize: 12 }}>
          🙏 Jai Bharat · BharatMandir Temple Discovery Platform
        </p>
      </div>
    </div>
  );
}

/* ── Shared style helpers ── */
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
  fontSize: 14, outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  boxSizing: 'border-box',
  fontFamily: 'var(--font-body)',
};

const focusStyle = (e) => {
  e.target.style.borderColor = 'var(--saffron)';
  e.target.style.boxShadow = '0 0 0 3px rgba(200,82,10,0.10)';
};
const blurStyle = (e) => {
  e.target.style.borderColor = 'var(--cream-dark)';
  e.target.style.boxShadow = 'none';
};

const eyeBtn = {
  position: 'absolute', right: 12, top: '50%',
  transform: 'translateY(-50%)',
  background: 'transparent', border: 'none',
  cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1,
};

const submitBtn = (disabled) => ({
  width: '100%', padding: '14px',
  background: disabled
    ? 'var(--cream-dark)'
    : 'linear-gradient(135deg, var(--saffron-light), var(--saffron-dark))',
  border: 'none', borderRadius: 12,
  color: disabled ? 'var(--text-muted)' : '#fff',
  fontSize: 15, fontWeight: 700,
  fontFamily: 'var(--font-body)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  boxShadow: disabled ? 'none' : '0 4px 18px rgba(200,82,10,0.32)',
  transition: 'all 0.22s',
  letterSpacing: '0.02em',
});

const errBox = {
  background: '#FEF2F2', border: '1px solid #FECACA',
  borderRadius: 10, padding: '12px 16px',
  marginBottom: 20, color: '#B91C1C',
  fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
};

const successBox = {
  background: '#F0FDF4', border: '1px solid #BBF7D0',
  borderRadius: 10, padding: '12px 16px',
  marginBottom: 20, color: '#15803D',
  fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
};