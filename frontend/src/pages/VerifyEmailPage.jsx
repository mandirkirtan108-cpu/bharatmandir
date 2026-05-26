import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { userAuthAPI } from '../services/api';

const S  = '#ff9900';
const S2 = 'rgba(255,153,0,0.20)';
const W9 = 'rgba(255,255,255,0.90)';
const W6 = 'rgba(255,255,255,0.60)';

export default function VerifyEmailPage() {
  const [searchParams]        = useSearchParams();
  const navigate              = useNavigate();
  const [status, setStatus]   = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { setStatus('error'); setMessage('Token nahi mila.'); return; }

    userAuthAPI.verifyEmail(token)
      .then(res => {
        // Token save karo aur login kar do
        userAuthAPI.saveTokens(res.data);
        setStatus('success');
        setTimeout(() => navigate('/', { replace: true }), 2500);
      })
      .catch(err => {
        setStatus('error');
        setMessage(err.response?.data?.detail || 'Verification failed');
      });
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a0a00 0%, #3d1f00 50%, #1a0a00 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)',
        border: `1px solid ${S2}`, borderRadius: 20, padding: '48px 40px',
        width: '100%', maxWidth: 420, textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>
          {status === 'verifying' && '⏳'}
          {status === 'success'   && '✅'}
          {status === 'error'     && '❌'}
        </div>

        <h2 style={{ color: W9, fontSize: 22, fontWeight: 700, margin: '0 0 12px' }}>
          {status === 'verifying' && 'Email verify ho raha hai…'}
          {status === 'success'   && 'Email Verified! 🎉'}
          {status === 'error'     && 'Verification Failed'}
        </h2>

        <p style={{ color: W6, fontSize: 14, margin: '0 0 24px' }}>
          {status === 'verifying' && 'Thoda ruko…'}
          {status === 'success'   && 'Account activate ho gaya! Home page pe redirect ho rahe hain…'}
          {status === 'error'     && message}
        </p>

        {status === 'error' && (
          <Link to="/signup" style={{
            background: `linear-gradient(135deg, ${S} 0%, #e68a00 100%)`,
            color: '#1a0a00', padding: '12px 28px', borderRadius: 10,
            textDecoration: 'none', fontWeight: 700, fontSize: 14,
          }}>
            Dobara Signup Karo
          </Link>
        )}
      </div>
    </div>
  );
}