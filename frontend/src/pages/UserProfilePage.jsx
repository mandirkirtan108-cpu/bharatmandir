import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserAuth } from '../hooks/useUserAuth';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const S  = '#ff9900';
const S2 = 'rgba(255,153,0,0.15)';
const S4 = 'rgba(255,153,0,0.35)';
const BG = '#0d0500';
const CARD = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,153,0,0.20)';
const W6 = 'rgba(255,255,255,0.60)';
const W9 = 'rgba(255,255,255,0.90)';

const INDIAN_STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Andaman & Nicobar Islands','Chandigarh',
  'Dadra & Nagar Haveli and Daman & Diu','Delhi','Jammu & Kashmir','Ladakh',
  'Lakshadweep','Puducherry',
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'mr', label: 'मराठी (Marathi)' },
  { code: 'ta', label: 'தமிழ் (Tamil)' },
];

function Avatar({ name, avatarUrl, size = 96 }) {
  const initials = (name || 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover',
                 border: `3px solid ${S}` }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${S}, #c26b00)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 800, color: '#fff',
      border: `3px solid ${S4}`, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: W6, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ color: value ? W9 : 'rgba(255,255,255,0.25)', fontSize: 15 }}>
        {value || '—'}
      </div>
    </div>
  );
}

function Input({ label, name, type = 'text', value, onChange, placeholder, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'block', fontSize: 12, color: W6, marginBottom: 6, letterSpacing: 0.5 }}>
        {label}
      </label>
      {children || (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${BORDER}`,
            background: 'rgba(255,255,255,0.05)', color: W9, fontSize: 14, outline: 'none',
            boxSizing: 'border-box', transition: 'border-color 0.2s',
          }}
          onFocus={e => e.target.style.borderColor = S}
          onBlur={e => e.target.style.borderColor = BORDER}
        />
      )}
    </div>
  );
}

export default function UserProfilePage() {
  const { user, isLoggedIn, loading, updateProfile } = useUserAuth();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState('');
  const [err,     setErr]     = useState('');

  const [form, setForm] = useState({
    name:           '',
    phone:          '',
    date_of_birth:  '',
    gender:         '',
    city:           '',
    state:          '',
    pincode:        '',
    preferred_lang: '',
    bio:            '',
    avatar_url:     '',
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
        preferred_lang: user.preferred_lang || 'en',
        bio:            user.bio            || '',
        avatar_url:     user.avatar_url     || '',
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
      setSuccess('Profile updated successfully! 🎉');
      setEditing(false);
    } else {
      setErr(res.error || 'Something went wrong.');
    }
  };

  const handleCancel = () => {
    setEditing(false); setErr(''); setSuccess('');
    if (user) {
      setForm({
        name:           user.name           || '',
        phone:          user.phone          || '',
        date_of_birth:  user.date_of_birth  || '',
        gender:         user.gender         || '',
        city:           user.city           || '',
        state:          user.state          || '',
        pincode:        user.pincode        || '',
        preferred_lang: user.preferred_lang || 'en',
        bio:            user.bio            || '',
        avatar_url:     user.avatar_url     || '',
      });
    }
  };

  if (!user) return null;

  const profileCompletion = (() => {
    const fields = ['phone','date_of_birth','gender','city','state','pincode','bio'];
    const filled = fields.filter(f => user[f]);
    return Math.round(((filled.length + 1) / (fields.length + 1)) * 100); // +1 for name always filled
  })();

  const joinedDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' })
    : '';

  const genderLabel = { male: '♂ Male', female: '♀ Female', other: '⚧ Other' };
  const langLabel   = LANGUAGES.find(l => l.code === user.preferred_lang)?.label || 'English';

  return (
    <div style={{ minHeight: '100vh', background: BG, color: '#fff', fontFamily: 'Inter, sans-serif' }}>
      <Navbar />

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px 80px' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 36 }}>
          <Avatar name={user.name} avatarUrl={user.avatar_url} size={80} />
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: W9 }}>{user.name}</h1>
            <p style={{ margin: '4px 0 0', color: W6, fontSize: 14 }}>{user.email}</p>
            {joinedDate && (
              <p style={{ margin: '2px 0 0', color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
                🛕 Member since {joinedDate}
              </p>
            )}
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              style={{
                padding: '10px 22px', borderRadius: 10, border: `1.5px solid ${S}`,
                background: 'transparent', color: S, fontWeight: 700, fontSize: 14,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                transition: 'background 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = S2}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              ✏️ Edit Profile
            </button>
          )}
        </div>

        {/* ── Profile Completion Bar ── */}
        <div style={{ marginBottom: 32, background: CARD, borderRadius: 12,
                      border: `1px solid ${BORDER}`, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: W6 }}>Profile completion</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: S }}>{profileCompletion}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99 }}>
            <div style={{
              height: '100%', borderRadius: 99, width: `${profileCompletion}%`,
              background: `linear-gradient(90deg, ${S}, #ffcc44)`,
              transition: 'width 0.5s ease',
            }} />
          </div>
          {profileCompletion < 100 && (
            <p style={{ margin: '8px 0 0', fontSize: 12, color: W6 }}>
              Complete your profile to get personalised temple recommendations!
            </p>
          )}
        </div>

        {/* ── Success / Error ── */}
        {success && (
          <div style={{ background: 'rgba(0,200,100,0.12)', border: '1px solid rgba(0,200,100,0.35)',
                        borderRadius: 10, padding: '12px 18px', marginBottom: 20, color: '#4cde9a', fontSize: 14 }}>
            {success}
          </div>
        )}
        {err && (
          <div style={{ background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.35)',
                        borderRadius: 10, padding: '12px 18px', marginBottom: 20, color: '#ff8080', fontSize: 14 }}>
            {err}
          </div>
        )}

        {/* ── VIEW mode ── */}
        {!editing && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Personal */}
            <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 24 }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 14, color: S, textTransform: 'uppercase', letterSpacing: 1 }}>
                👤 Personal Info
              </h3>
              <Field label="Full Name"     value={user.name} />
              <Field label="Phone"         value={user.phone} />
              <Field label="Date of Birth" value={user.date_of_birth} />
              <Field label="Gender"        value={genderLabel[user.gender] || user.gender} />
            </div>

            {/* Location */}
            <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 24 }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 14, color: S, textTransform: 'uppercase', letterSpacing: 1 }}>
                📍 Location
              </h3>
              <Field label="City"    value={user.city} />
              <Field label="State"   value={user.state} />
              <Field label="Pincode" value={user.pincode} />
            </div>

            {/* Preferences */}
            <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 24 }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 14, color: S, textTransform: 'uppercase', letterSpacing: 1 }}>
                🌐 Preferences
              </h3>
              <Field label="Preferred Language" value={langLabel} />
              <Field label="Profile Photo URL"  value={user.avatar_url} />
            </div>

            {/* Bio */}
            <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 24 }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 14, color: S, textTransform: 'uppercase', letterSpacing: 1 }}>
                📝 About Me
              </h3>
              <div style={{ color: user.bio ? W9 : 'rgba(255,255,255,0.25)', fontSize: 15, lineHeight: 1.6 }}>
                {user.bio || 'No bio added yet.'}
              </div>
            </div>
          </div>
        )}

        {/* ── EDIT mode ── */}
        {editing && (
          <form onSubmit={handleSave}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

              {/* Personal */}
              <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 24 }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 14, color: S, textTransform: 'uppercase', letterSpacing: 1 }}>
                  👤 Personal Info
                </h3>

                <Input label="Full Name *" name="name" value={form.name} onChange={handleChange} placeholder="Your name" />
                <Input label="Phone Number" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder="+91 98765 43210" />
                <Input label="Date of Birth" name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} />

                <Input label="Gender" name="gender" value={form.gender} onChange={handleChange}>
                  <select
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${BORDER}`,
                      background: '#1a0a00', color: W9, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    }}
                    onFocus={e => e.target.style.borderColor = S}
                    onBlur={e => e.target.style.borderColor = BORDER}
                  >
                    <option value="">— Select —</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </Input>
              </div>

              {/* Location */}
              <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 24 }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 14, color: S, textTransform: 'uppercase', letterSpacing: 1 }}>
                  📍 Location
                </h3>

                <Input label="City" name="city" value={form.city} onChange={handleChange} placeholder="e.g. Bhopal" />

                <Input label="State" name="state" value={form.state} onChange={handleChange}>
                  <select
                    name="state"
                    value={form.state}
                    onChange={handleChange}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${BORDER}`,
                      background: '#1a0a00', color: W9, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    }}
                    onFocus={e => e.target.style.borderColor = S}
                    onBlur={e => e.target.style.borderColor = BORDER}
                  >
                    <option value="">— Select State —</option>
                    {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Input>

                <Input label="Pincode" name="pincode" value={form.pincode} onChange={handleChange} placeholder="e.g. 462001" />
              </div>

              {/* Preferences */}
              <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 24 }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 14, color: S, textTransform: 'uppercase', letterSpacing: 1 }}>
                  🌐 Preferences
                </h3>

                <Input label="Preferred Language" name="preferred_lang" value={form.preferred_lang} onChange={handleChange}>
                  <select
                    name="preferred_lang"
                    value={form.preferred_lang}
                    onChange={handleChange}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${BORDER}`,
                      background: '#1a0a00', color: W9, fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    }}
                    onFocus={e => e.target.style.borderColor = S}
                    onBlur={e => e.target.style.borderColor = BORDER}
                  >
                    {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </Input>

                <Input
                  label="Profile Photo URL"
                  name="avatar_url"
                  value={form.avatar_url}
                  onChange={handleChange}
                  placeholder="https://example.com/photo.jpg"
                />

                {form.avatar_url && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: W6 }}>Preview:</span>
                    <Avatar name={form.name} avatarUrl={form.avatar_url} size={40} />
                  </div>
                )}
              </div>

              {/* Bio */}
              <div style={{ background: CARD, borderRadius: 14, border: `1px solid ${BORDER}`, padding: 24 }}>
                <h3 style={{ margin: '0 0 20px', fontSize: 14, color: S, textTransform: 'uppercase', letterSpacing: 1 }}>
                  📝 About Me
                </h3>
                <label style={{ display: 'block', fontSize: 12, color: W6, marginBottom: 6 }}>
                  Bio (tell us about your spiritual journey)
                </label>
                <textarea
                  name="bio"
                  value={form.bio}
                  onChange={handleChange}
                  placeholder="e.g. Devotee of Lord Shiva, love visiting temples in Madhya Pradesh..."
                  rows={6}
                  maxLength={300}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10, border: `1px solid ${BORDER}`,
                    background: 'rgba(255,255,255,0.05)', color: W9, fontSize: 14, resize: 'vertical',
                    outline: 'none', boxSizing: 'border-box', lineHeight: 1.6,
                  }}
                  onFocus={e => e.target.style.borderColor = S}
                  onBlur={e => e.target.style.borderColor = BORDER}
                />
                <div style={{ textAlign: 'right', fontSize: 11, color: W6, marginTop: 4 }}>
                  {form.bio.length}/300
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  padding: '12px 28px', borderRadius: 10, border: `1px solid rgba(255,255,255,0.15)`,
                  background: 'transparent', color: W6, fontWeight: 600, fontSize: 15, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || loading}
                style={{
                  padding: '12px 32px', borderRadius: 10, border: 'none',
                  background: saving ? '#c26b00' : S,
                  color: '#1a0a00', fontWeight: 800, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                }}
              >
                {saving ? 'Saving…' : '💾 Save Changes'}
              </button>
            </div>
          </form>
        )}

        {/* ── Account Info (read-only) ── */}
        {!editing && (
          <div style={{
            marginTop: 24, background: CARD, borderRadius: 14,
            border: `1px solid ${BORDER}`, padding: 24,
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, color: S, textTransform: 'uppercase', letterSpacing: 1 }}>
              🔐 Account
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Email"            value={user.email} />
              <Field label="Verified"         value={user.is_verified ? '✅ Verified' : '❌ Not verified'} />
              <Field label="Member Since"     value={joinedDate} />
              <Field label="Last Updated"     value={user.profile_updated_at
                ? new Date(user.profile_updated_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                : '—'} />
            </div>
          </div>
        )}

      </div>

      <Footer />
    </div>
  );
}