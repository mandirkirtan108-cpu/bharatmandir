import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserAuth } from '../hooks/useUserAuth';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const SAFFRON       = '#C8520A';
const SAFFRON_LIGHT = '#E06B25';
const SAFFRON_DARK  = '#9A3C05';
const BROWN         = '#2C1500';
const BROWN_MID     = '#5C3010';
const CREAM         = '#FAF6EE';
const CREAM_DARK    = '#EDE3CE';
const CREAM_MID     = '#F3EBD8';
const TEXT_DARK     = '#1A0D00';
const TEXT_MID      = '#4A2C10';
const TEXT_LIGHT    = '#7A5538';
const TEXT_MUTED    = '#A07050';

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Andaman & Nicobar Islands','Chandigarh',
  'Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh',
  'Lakshadweep','Puducherry',
];

/* ── tiny Avatar ── */
function Avatar({ name, avatarUrl, size = 80 }) {
  const initials = (name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover',
                 border: `3px solid ${CREAM_DARK}`, flexShrink: 0 }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${SAFFRON_LIGHT}, ${SAFFRON_DARK})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 700,
      color: '#fff', border: `3px solid ${CREAM_DARK}`,
      fontFamily: "'Cormorant Garamond', Georgia, serif",
    }}>
      {initials}
    </div>
  );
}

/* ── read-only field ── */
function InfoField({ label, value }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: TEXT_MUTED,
        fontFamily: "'DM Sans', sans-serif", marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 15, color: value ? TEXT_DARK : TEXT_MUTED,
        fontFamily: "'DM Sans', sans-serif", fontWeight: value ? 500 : 400,
      }}>
        {value || '—'}
      </div>
    </div>
  );
}

/* ── card wrapper ── */
function Card({ title, emoji, children }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      border: `1px solid ${CREAM_DARK}`,
      padding: '24px 28px',
      boxShadow: '0 2px 12px rgba(44,21,0,0.06)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 20,
        paddingBottom: 14,
        borderBottom: `1px solid ${CREAM_MID}`,
      }}>
        <span style={{ fontSize: 16 }}>{emoji}</span>
        <h3 style={{
          margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em',
          textTransform: 'uppercase', color: SAFFRON,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

/* ── styled input ── */
function EditInput({ label, name, type = 'text', value, onChange, placeholder, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 600,
        color: TEXT_LIGHT, marginBottom: 6, letterSpacing: '0.06em',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {label}
      </label>
      {children || (
        <input
          type={type} name={name} value={value} onChange={onChange} placeholder={placeholder}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            border: `1.5px solid ${CREAM_DARK}`,
            background: CREAM, color: TEXT_DARK, fontSize: 14,
            outline: 'none', boxSizing: 'border-box',
            fontFamily: "'DM Sans', sans-serif",
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onFocus={e => {
            e.target.style.borderColor = SAFFRON;
            e.target.style.boxShadow = '0 0 0 3px rgba(200,82,10,0.1)';
          }}
          onBlur={e => {
            e.target.style.borderColor = CREAM_DARK;
            e.target.style.boxShadow = 'none';
          }}
        />
      )}
    </div>
  );
}

const selectStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: `1.5px solid ${CREAM_DARK}`,
  background: CREAM, color: TEXT_DARK, fontSize: 14, outline: 'none',
  boxSizing: 'border-box', fontFamily: "'DM Sans', sans-serif",
  appearance: 'none', cursor: 'pointer',
};

export default function UserProfilePage() {
  const { user, isLoggedIn, loading, updateProfile } = useUserAuth();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState('');
  const [err,     setErr]     = useState('');

  const [form, setForm] = useState({
    name: '', phone: '', date_of_birth: '',
    gender: '', city: '', state: '', pincode: '',
  });

  useEffect(() => {
    if (!isLoggedIn) navigate('/login', { replace: true });
  }, [isLoggedIn, navigate]);

  useEffect(() => {
    if (user) {
      setForm({
        name:           user.name           || '',
        phone:          user.phone          || '',
        date_of_birth:  user.date_of_birth  || '',
        gender:         user.gender         || '',
        city:           user.city           || '',
        state:          user.state          || '',
        pincode:        user.pincode        || '',
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setErr(''); setSuccess('');
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true); setErr(''); setSuccess('');
    const payload = {};
    Object.entries(form).forEach(([k, v]) => { if (v !== '') payload[k] = v; });
    const res = await updateProfile(payload);
    setSaving(false);
    if (res.success) {
      setSuccess('Profile updated successfully!');
      setEditing(false);
    } else {
      setErr(res.error || 'Something went wrong.');
    }
  };

  const handleCancel = () => {
    setEditing(false); setErr(''); setSuccess('');
    if (user) {
      setForm({
        name: user.name || '', phone: user.phone || '',
        date_of_birth: user.date_of_birth || '', gender: user.gender || '',
        city: user.city || '', state: user.state || '', pincode: user.pincode || '',
      });
    }
  };

  if (!user) return null;

  /* profile completion — only the fields we show */
  const profileFields = ['phone', 'date_of_birth', 'gender', 'city', 'state', 'pincode'];
  const filled = profileFields.filter(f => user[f]);
  const completion = Math.round(((filled.length + 1) / (profileFields.length + 1)) * 100);

  const joinedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
    : '';

  const lastUpdated = user.profile_updated_at
    ? new Date(user.profile_updated_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })
    : '—';

  const genderLabel = { male: '♂ Male', female: '♀ Female', other: '⚧ Other' };

  return (
    <div style={{
      minHeight: '100vh',
      background: CREAM,
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <Navbar />

      {/* ── Page header band ── */}
      <div style={{
        background: `linear-gradient(135deg, ${BROWN} 0%, ${BROWN_MID} 100%)`,
        padding: '40px 28px 52px',
      }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 20,
            flexWrap: 'wrap',
          }}>
            <Avatar name={user.name} avatarUrl={user.avatar_url} size={80} />
            <div style={{ flex: 1, minWidth: 200 }}>
              <h1 style={{
                margin: 0, fontSize: 28, fontWeight: 700, color: '#fff',
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                lineHeight: 1.2,
              }}>
                {user.name}
              </h1>
              <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.65)', fontSize: 14 }}>
                {user.email}
              </p>
              {joinedDate && (
                <p style={{ margin: '3px 0 0', color: 'rgba(255,220,140,0.75)', fontSize: 13 }}>
                  🛕 Member since {joinedDate}
                </p>
              )}
            </div>

            {!editing && (
              <button
                onClick={() => setEditing(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '10px 22px', borderRadius: 50,
                  border: '1.5px solid rgba(255,255,255,0.35)',
                  background: 'rgba(255,255,255,0.10)',
                  color: '#fff', fontWeight: 600, fontSize: 14,
                  cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
                  backdropFilter: 'blur(6px)',
                  transition: 'background 0.2s, border-color 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.18)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.10)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)';
                }}
              >
                ✏️ Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ maxWidth: 860, margin: '-24px auto 0', padding: '0 28px 72px', position: 'relative', zIndex: 1 }}>

        {/* ── Profile completion ── */}
        <div style={{
          background: '#fff', borderRadius: 14, border: `1px solid ${CREAM_DARK}`,
          padding: '16px 22px', marginBottom: 24,
          boxShadow: '0 2px 12px rgba(44,21,0,0.07)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: TEXT_MID }}>Profile completion</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: SAFFRON }}>{completion}%</span>
          </div>
          <div style={{ height: 6, background: CREAM_DARK, borderRadius: 99 }}>
            <div style={{
              height: '100%', borderRadius: 99, width: `${completion}%`,
              background: `linear-gradient(90deg, ${SAFFRON_LIGHT}, ${SAFFRON_DARK})`,
              transition: 'width 0.5s ease',
            }} />
          </div>
          {completion < 100 && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: TEXT_MUTED }}>
              Complete your profile to get personalised temple recommendations!
            </p>
          )}
        </div>

        {/* ── Alerts ── */}
        {success && (
          <div style={{
            background: '#EBF7F0', border: '1px solid #A3D9BB',
            borderRadius: 10, padding: '12px 18px', marginBottom: 20,
            color: '#1A6B3A', fontSize: 14, fontWeight: 500,
          }}>
            ✅ {success}
          </div>
        )}
        {err && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA',
            borderRadius: 10, padding: '12px 18px', marginBottom: 20,
            color: '#B91C1C', fontSize: 14, fontWeight: 500,
          }}>
            ⚠️ {err}
          </div>
        )}

        {/* ══ VIEW MODE ══ */}
        {!editing && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <Card title="Personal Info" emoji="👤">
                <InfoField label="Full Name"     value={user.name} />
                <InfoField label="Phone"         value={user.phone} />
                <InfoField label="Date of Birth" value={user.date_of_birth} />
                <InfoField label="Gender"        value={genderLabel[user.gender] || user.gender} />
              </Card>

              <Card title="Location" emoji="📍">
                <InfoField label="City"    value={user.city} />
                <InfoField label="State"   value={user.state} />
                <InfoField label="Pincode" value={user.pincode} />
              </Card>
            </div>

            <Card title="Account" emoji="🔐">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
                <InfoField label="Email"        value={user.email} />
                <InfoField label="Verified"     value={user.is_verified ? '✅ Verified' : '❌ Not verified'} />
                <InfoField label="Member Since" value={joinedDate} />
                <InfoField label="Last Updated" value={lastUpdated} />
              </div>
            </Card>
          </>
        )}

        {/* ══ EDIT MODE ══ */}
        {editing && (
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

              {/* Personal */}
              <div style={{
                background: '#fff', borderRadius: 16, border: `1px solid ${CREAM_DARK}`,
                padding: '24px 28px', boxShadow: '0 2px 12px rgba(44,21,0,0.06)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
                  paddingBottom: 14, borderBottom: `1px solid ${CREAM_MID}`,
                }}>
                  <span style={{ fontSize: 16 }}>👤</span>
                  <h3 style={{
                    margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em',
                    textTransform: 'uppercase', color: SAFFRON,
                    fontFamily: "'DM Sans', sans-serif",
                  }}>Personal Info</h3>
                </div>

                <EditInput label="Full Name *" name="name" value={form.name} onChange={handleChange} placeholder="Your name" />
                <EditInput label="Phone Number" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />
                <EditInput label="Date of Birth" name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} />

                <EditInput label="Gender" name="gender" value={form.gender} onChange={handleChange}>
                  <select name="gender" value={form.gender} onChange={handleChange}
                    style={selectStyle}
                    onFocus={e => { e.target.style.borderColor = SAFFRON; e.target.style.boxShadow = '0 0 0 3px rgba(200,82,10,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = CREAM_DARK; e.target.style.boxShadow = 'none'; }}
                  >
                    <option value="">— Select —</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </EditInput>
              </div>

              {/* Location */}
              <div style={{
                background: '#fff', borderRadius: 16, border: `1px solid ${CREAM_DARK}`,
                padding: '24px 28px', boxShadow: '0 2px 12px rgba(44,21,0,0.06)',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
                  paddingBottom: 14, borderBottom: `1px solid ${CREAM_MID}`,
                }}>
                  <span style={{ fontSize: 16 }}>📍</span>
                  <h3 style={{
                    margin: 0, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em',
                    textTransform: 'uppercase', color: SAFFRON,
                    fontFamily: "'DM Sans', sans-serif",
                  }}>Location</h3>
                </div>

                <EditInput label="City" name="city" value={form.city} onChange={handleChange} placeholder="e.g. Bhopal" />

                <EditInput label="State" name="state" value={form.state} onChange={handleChange}>
                  <select name="state" value={form.state} onChange={handleChange}
                    style={selectStyle}
                    onFocus={e => { e.target.style.borderColor = SAFFRON; e.target.style.boxShadow = '0 0 0 3px rgba(200,82,10,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = CREAM_DARK; e.target.style.boxShadow = 'none'; }}
                  >
                    <option value="">— Select State —</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </EditInput>

                <EditInput label="Pincode" name="pincode" value={form.pincode} onChange={handleChange} placeholder="e.g. 462001" />
              </div>
            </div>

            {/* ── Save / Cancel ── */}
            <div style={{
              display: 'flex', gap: 12, justifyContent: 'flex-end',
              background: '#fff', borderRadius: 14, padding: '18px 24px',
              border: `1px solid ${CREAM_DARK}`,
              boxShadow: '0 2px 12px rgba(44,21,0,0.06)',
            }}>
              <button
                type="button" onClick={handleCancel}
                style={{
                  padding: '10px 26px', borderRadius: 50,
                  border: `1.5px solid ${CREAM_DARK}`,
                  background: 'transparent', color: TEXT_LIGHT,
                  fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = BROWN_MID}
                onMouseLeave={e => e.currentTarget.style.borderColor = CREAM_DARK}
              >
                Cancel
              </button>
              <button
                type="submit" disabled={saving || loading}
                style={{
                  padding: '10px 30px', borderRadius: 50, border: 'none',
                  background: saving
                    ? CREAM_DARK
                    : `linear-gradient(135deg, ${SAFFRON_LIGHT}, ${SAFFRON_DARK})`,
                  color: saving ? TEXT_MUTED : '#fff',
                  fontWeight: 700, fontSize: 14,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: saving ? 'none' : '0 3px 14px rgba(200,82,10,0.32)',
                  transition: 'all 0.2s',
                }}
              >
                {saving ? 'Saving…' : '💾 Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>

      <Footer />
    </div>
  );
}