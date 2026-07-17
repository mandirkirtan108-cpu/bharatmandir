import { useEffect, useState } from 'react';
import VolunteerNavbar from '../../components/volunteer/VolunteerNavbar';
import { volunteerApi } from '../../services/volunteerApi';

const initialForm = { name: '', email: '', phone: '', city: '', state: '' };

export default function VolunteerProfilePage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    volunteerApi
      .me()
      .then((response) => setForm({ ...initialForm, ...response.data }))
      .catch(() => setError('Profile load nahi ho paayi. Kripya dobara try karein.'))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      await volunteerApi.updateProfile({
        name: form.name,
        phone: form.phone,
        city: form.city,
        state: form.state,
      });
      setMessage('Profile successfully update ho gayi.');
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Profile update nahi ho paayi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.page}>
      <VolunteerNavbar />

      <section style={styles.hero}>
        <div style={styles.heroInner}>
          <span style={styles.eyebrow}>🙏 VOLUNTEER ACCOUNT</span>
          <h1 style={styles.heroTitle}>Your Seva Profile</h1>
          <p style={styles.heroText}>
            Apni details updated rakhein, taaki BharatMandir team aapse aasani se sampark kar sake.
          </p>
        </div>
      </section>

      <main style={styles.content}>
        <section style={styles.profileCard}>
          <div style={styles.profileHeader}>
            <div style={styles.avatar}>{(form.name || 'V').charAt(0).toUpperCase()}</div>
            <div>
              <h2 style={styles.cardTitle}>{form.name || 'Volunteer'}</h2>
              <p style={styles.muted}>{form.email || 'BharatMandir Volunteer'}</p>
            </div>
            <span style={styles.activeBadge}>● Active Volunteer</span>
          </div>

          {loading ? (
            <p style={styles.loading}>Profile load ho rahi hai...</p>
          ) : (
            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.formGrid}>
                <label style={styles.label}>
                  Full Name
                  <input
                    style={styles.input}
                    name="name"
                    value={form.name || ''}
                    onChange={updateField}
                    placeholder="Apna poora naam"
                    required
                  />
                </label>

                <label style={styles.label}>
                  Email Address
                  <input
                    style={{ ...styles.input, ...styles.readOnlyInput }}
                    value={form.email || ''}
                    placeholder="Email address"
                    readOnly
                  />
                  <span style={styles.hint}>Email login account se linked hai.</span>
                </label>

                <label style={styles.label}>
                  Phone Number
                  <input
                    style={styles.input}
                    name="phone"
                    value={form.phone || ''}
                    onChange={updateField}
                    placeholder="Mobile number"
                  />
                </label>

                <label style={styles.label}>
                  City
                  <input
                    style={styles.input}
                    name="city"
                    value={form.city || ''}
                    onChange={updateField}
                    placeholder="Aapka shehar"
                  />
                </label>

                <label style={styles.label}>
                  State
                  <input
                    style={styles.input}
                    name="state"
                    value={form.state || ''}
                    onChange={updateField}
                    placeholder="Aapka rajya"
                  />
                </label>
              </div>

              {message && <div style={styles.success}>✓ {message}</div>}
              {error && <div style={styles.error}>⚠ {error}</div>}

              <div style={styles.actions}>
                <button type="submit" disabled={saving} style={styles.saveButton}>
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}
        </section>

        <aside style={styles.sideCard}>
          <span style={styles.sideIcon}>🪔</span>
          <h3 style={styles.sideTitle}>Your Seva Matters</h3>
          <p style={styles.sideText}>
            Aapke dwara submit ki gayi verified temple information hazaaron devotees ko sahi mandir tak
            pahunchne mein madad karegi.
          </p>
          <div style={styles.divider} />
          <p style={styles.sideLabel}>PROFILE TIPS</p>
          <ul style={styles.tips}>
            <li>Apna real name use karein</li>
            <li>Active phone number add karein</li>
            <li>City aur state updated rakhein</li>
          </ul>
        </aside>
      </main>
    </div>
  );
}

const styles = {
  page: { minHeight: '100vh', background: '#fbf7f0', color: '#3b1b0d' },
  hero: {
    background: 'linear-gradient(115deg, #672200 0%, #a33b05 100%)',
    padding: '68px 20px 74px',
    textAlign: 'center',
    color: '#fff',
  },
  heroInner: { maxWidth: 820, margin: '0 auto' },
  eyebrow: {
    display: 'inline-block', padding: '9px 18px', border: '1px solid rgba(255,214,148,.38)',
    borderRadius: 999, color: '#ffd58d', fontSize: 12, fontWeight: 800, letterSpacing: 1.2,
  },
  heroTitle: { margin: '18px 0 8px', fontFamily: 'Georgia, serif', fontSize: 'clamp(38px,5vw,58px)' },
  heroText: { margin: '0 auto', maxWidth: 690, color: '#f8ddc7', lineHeight: 1.7, fontSize: 16 },
  content: {
    maxWidth: 1120, margin: '-34px auto 70px', padding: '0 22px', display: 'flex',
    alignItems: 'flex-start', gap: 24, flexWrap: 'wrap', position: 'relative',
  },
  profileCard: {
    flex: '1 1 680px', background: '#fff', border: '1px solid #ead8c1', borderRadius: 20,
    boxShadow: '0 18px 45px rgba(79,31,7,.10)', overflow: 'hidden',
  },
  profileHeader: {
    display: 'flex', alignItems: 'center', gap: 15, padding: '25px 28px',
    background: '#fffaf3', borderBottom: '1px solid #efdfcc', flexWrap: 'wrap',
  },
  avatar: {
    width: 58, height: 58, display: 'grid', placeItems: 'center', borderRadius: '50%',
    color: '#fff', background: 'linear-gradient(145deg,#e76809,#9c3503)', fontSize: 24,
    fontWeight: 800, boxShadow: '0 7px 18px rgba(198,73,5,.22)',
  },
  cardTitle: { margin: '0 0 4px', fontFamily: 'Georgia, serif', fontSize: 25 },
  muted: { margin: 0, color: '#8b6a58', fontSize: 14 },
  activeBadge: {
    marginLeft: 'auto', padding: '8px 12px', borderRadius: 999, color: '#26743b',
    background: '#eef8ef', border: '1px solid #cde8d2', fontSize: 12, fontWeight: 700,
  },
  form: { padding: '30px 28px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 20 },
  label: { display: 'grid', gap: 8, color: '#6f2c0b', fontSize: 13, fontWeight: 800 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '13px 14px', border: '1px solid #dfc7aa',
    borderRadius: 10, background: '#fff', color: '#321509', outlineColor: '#d65308', fontSize: 14,
  },
  readOnlyInput: { background: '#f5f0e9', color: '#8a7467', cursor: 'not-allowed' },
  hint: { color: '#9b8373', fontSize: 11, fontWeight: 500 },
  actions: { display: 'flex', justifyContent: 'flex-end', marginTop: 24 },
  saveButton: {
    minWidth: 160, padding: '13px 24px', border: 0, borderRadius: 10, background: '#d35408',
    color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', boxShadow: '0 8px 18px rgba(211,84,8,.22)',
  },
  success: { marginTop: 20, padding: 12, borderRadius: 9, color: '#276d37', background: '#edf8ef' },
  error: { marginTop: 20, padding: 12, borderRadius: 9, color: '#a42b1d', background: '#fff0ed' },
  loading: { padding: 35, color: '#8b6a58' },
  sideCard: {
    flex: '1 1 260px', maxWidth: 330, boxSizing: 'border-box', padding: 28, background: '#4d1a05',
    color: '#fff', borderRadius: 20, boxShadow: '0 18px 45px rgba(79,31,7,.13)',
  },
  sideIcon: { fontSize: 36 },
  sideTitle: { margin: '13px 0 10px', color: '#ffd58d', fontFamily: 'Georgia, serif', fontSize: 23 },
  sideText: { margin: 0, color: '#edd4c3', lineHeight: 1.65, fontSize: 14 },
  divider: { height: 1, margin: '22px 0', background: 'rgba(255,255,255,.16)' },
  sideLabel: { margin: '0 0 10px', color: '#efad65', fontSize: 11, fontWeight: 800, letterSpacing: 1.2 },
  tips: { margin: 0, paddingLeft: 19, color: '#f5e5d9', lineHeight: 1.9, fontSize: 13 },
};
