import { useState, useRef, Fragment } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

// ── Field config ──────────────────────────────────────────────────────────────
const SECTS     = ['', 'Shaiva', 'Vaishnava', 'Shakta', 'Smartha', 'Jain', 'Buddhist', 'Sikh', 'Other'];
const TYPES     = ['', 'Temple', 'Mandir', 'Devasthan', 'Peeth', 'Mutt', 'Shrine', 'Other'];
const STATES_IN = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab',
  'Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh',
  'Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh',
];

function initialForm() {
  return {
    name: '', name_hindi: '', name_local: '',
    city: '', state: '', address: '', district: '', pincode: '',
    latitude: '', longitude: '',
    primary_deity: '', secondary_deities: '', sect: '', temple_type: '',
    is_jyotirlinga: false, is_shaktipeeth: false,
    is_heritage_site: false, is_asi_protected: false,
    history: '', significance: '', architecture_style: '', estimated_year_built: '',
    opening_time: '', closing_time: '', entry_fee: '', dress_code: '',
    best_time_to_visit: '', nearest_railway: '', nearest_airport: '',
    website_url: '', phone: '', category_tags: '',
  };
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=Noto+Sans+Devanagari:wght@400;600&display=swap');

  :root {
    --saffron: #E8650A;
    --saffron-light: #F5934A;
    --saffron-dark: #B84D00;
    --gold: #C8960C;
    --gold-light: #F0C040;
    --cream: #FDF8F0;
    --cream-dark: #F0E6D0;
    --brown: #3D1F00;
    --brown-mid: #6B3A10;
    --white: #FFFFFF;
    --text-dark: #1A0A00;
    --text-mid: #4A2800;
    --text-light: #8B6040;
    --shadow: rgba(61,31,0,0.12);
    --shadow-deep: rgba(61,31,0,0.28);
    --font-display: 'Cinzel', serif;
    --font-body: 'Crimson Pro', serif;
    --font-hindi: 'Noto Sans Devanagari', sans-serif;
    --radius: 12px;
    --radius-lg: 20px;
    --transition: 0.3s cubic-bezier(0.4,0,0.2,1);
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--font-body); background: var(--cream); color: var(--text-dark); }

  .atp-page { min-height: 100vh; background: var(--cream); }

  /* ── Hero Header ── */
  .atp-hero { position: relative; background: linear-gradient(180deg, rgba(61,31,0,.92) 0%, rgba(184,77,0,.7) 60%, rgba(253,248,240,1) 100%), url('https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Mahakaleshwar_Temple_Ujjain.jpg/1280px-Mahakaleshwar_Temple_Ujjain.jpg') center/cover no-repeat; padding: 60px 24px 80px; text-align: center; overflow: hidden; }
  .atp-hero-om { position: absolute; font-size: 300px; color: rgba(255,255,255,.04); font-family: var(--font-hindi); top: 50%; left: 50%; transform: translate(-50%,-50%); pointer-events: none; line-height: 1; animation: pulse-om 8s ease-in-out infinite; }
  @keyframes pulse-om { 0%,100%{opacity:.04;transform:translate(-50%,-50%) scale(1);} 50%{opacity:.08;transform:translate(-50%,-50%) scale(1.03);} }
  .atp-hero-inner { position: relative; z-index: 1; }
  .atp-hero-badge { display: inline-flex; align-items: center; gap: 8px; background: rgba(200,150,12,.2); border: 1px solid rgba(240,192,64,.4); backdrop-filter: blur(8px); color: var(--gold-light); padding: 6px 20px; border-radius: 50px; font-family: var(--font-display); font-size: 12px; letter-spacing: .12em; margin-bottom: 18px; animation: fadeDown .7s ease both; }
  .atp-hero-title { font-family: var(--font-display); font-weight: 900; color: white; font-size: clamp(32px,5vw,56px); line-height: 1.1; margin-bottom: 12px; text-shadow: 0 2px 20px rgba(0,0,0,.4); animation: fadeDown .7s .1s ease both; }
  .atp-hero-title span { color: var(--gold-light); }
  .atp-hero-sub { font-family: var(--font-body); font-size: 17px; color: rgba(255,255,255,.75); animation: fadeDown .7s .2s ease both; }
  @keyframes fadeDown { from{opacity:0;transform:translateY(-14px);} to{opacity:1;transform:translateY(0);} }

  /* ── Step Tabs ── */
  .atp-steps-wrap { background: white; border-bottom: 2px solid var(--cream-dark); position: sticky; top: 73px; z-index: 100; box-shadow: 0 2px 8px var(--shadow); }
  .atp-steps { display: flex; align-items: center; justify-content: center; gap: 0; max-width: 600px; margin: 0 auto; padding: 0; }
  .atp-step-btn { flex: 1; padding: 16px 20px; border: none; background: transparent; font-family: var(--font-display); font-size: 13px; letter-spacing: .05em; color: var(--text-light); cursor: pointer; transition: var(--transition); position: relative; border-bottom: 3px solid transparent; }
  .atp-step-btn:hover { color: var(--saffron); }
  .atp-step-btn.active { color: var(--saffron); border-bottom-color: var(--saffron); background: rgba(232,101,10,.04); }
  .atp-step-btn.done { color: var(--brown-mid); border-bottom-color: var(--gold); }
  .atp-step-num { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: var(--cream-dark); color: var(--text-light); font-size: 11px; margin-right: 8px; font-weight: 600; transition: var(--transition); }
  .atp-step-btn.active .atp-step-num { background: var(--saffron); color: white; }
  .atp-step-btn.done .atp-step-num { background: var(--gold); color: white; }
  .atp-step-divider { width: 1px; height: 20px; background: var(--cream-dark); }

  /* ── Form Body ── */
  .atp-form-wrap { max-width: 880px; margin: 0 auto; padding: 40px 24px 80px; }

  /* ── Section title ── */
  .atp-section-label { font-family: var(--font-display); font-size: 11px; letter-spacing: .14em; text-transform: uppercase; color: var(--saffron); margin-bottom: 20px; margin-top: 36px; display: flex; align-items: center; gap: 10px; }
  .atp-section-label::after { content: ''; flex: 1; height: 1px; background: var(--cream-dark); }
  .atp-section-label:first-child { margin-top: 0; }

  /* ── Row / Field ── */
  .atp-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .atp-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 0; }
  .atp-field.full { grid-column: 1 / -1; }
  .atp-label { font-family: var(--font-display); font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--text-light); }
  .atp-label.err { color: #c0392b; }

  /* ── Input / Select / Textarea ── */
  .atp-input { width: 100%; padding: 12px 16px; border: 2px solid var(--cream-dark); border-radius: var(--radius); font-family: var(--font-body); font-size: 16px; color: var(--text-dark); background: white; outline: none; transition: var(--transition); appearance: none; }
  .atp-input:focus { border-color: var(--saffron); box-shadow: 0 0 0 3px rgba(232,101,10,.1); }
  .atp-input.err { border-color: #e74c3c; }
  .atp-input::placeholder { color: var(--text-light); opacity: .65; }
  .atp-textarea { resize: vertical; min-height: 120px; line-height: 1.65; }
  .atp-textarea-sm { min-height: 80px; }
  .atp-field-err { font-size: 12px; color: #c0392b; font-family: var(--font-body); }

  /* ── Flags ── */
  .atp-flags { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 24px; margin-top: 8px; }
  .atp-flag { padding: 9px 18px; border-radius: 50px; border: 2px solid var(--cream-dark); background: white; font-family: var(--font-body); font-size: 14px; color: var(--text-mid); cursor: pointer; transition: var(--transition); }
  .atp-flag:hover { border-color: var(--saffron-light); }
  .atp-flag.on { border-color: var(--saffron); background: rgba(232,101,10,.08); color: var(--saffron-dark); font-weight: 600; }

  /* ── Hero Image Upload ── */
  .atp-hero-zone { border: 2px dashed var(--cream-dark); border-radius: var(--radius-lg); min-height: 160px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: var(--transition); overflow: hidden; position: relative; background: white; margin-bottom: 24px; }
  .atp-hero-zone:hover { border-color: var(--saffron); background: rgba(232,101,10,.03); }
  .atp-hero-zone__ph { text-align: center; color: var(--text-light); }
  .atp-hero-zone__icon { font-size: 40px; margin-bottom: 10px; }
  .atp-hero-zone__text { font-family: var(--font-display); font-size: 14px; letter-spacing: .05em; margin-bottom: 4px; color: var(--text-mid); }
  .atp-hero-zone__hint { font-size: 13px; }
  .atp-hero-preview { width: 100%; height: 200px; object-fit: cover; }
  .atp-hero-overlay { position: absolute; inset: 0; background: rgba(61,31,0,.5); display: flex; align-items: center; justify-content: center; opacity: 0; transition: var(--transition); }
  .atp-hero-zone:hover .atp-hero-overlay { opacity: 1; }
  .atp-hero-overlay span { font-family: var(--font-display); font-size: 13px; letter-spacing: .08em; color: white; }

  /* ── Media Grid ── */
  .atp-media-zone { border: 2px dashed var(--cream-dark); border-radius: var(--radius-lg); padding: 36px 24px; display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: var(--transition); background: white; margin-bottom: 28px; text-align: center; }
  .atp-media-zone:hover { border-color: var(--saffron); background: rgba(232,101,10,.03); }
  .atp-media-zone-title { font-family: var(--font-display); font-size: 15px; letter-spacing: .05em; color: var(--text-mid); margin: 12px 0 4px; }
  .atp-media-zone-hint { font-size: 13px; color: var(--text-light); }
  .atp-media-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .atp-media-card { background: white; border-radius: var(--radius); border: 1px solid var(--cream-dark); overflow: hidden; }
  .atp-media-thumb { position: relative; height: 130px; background: var(--cream-dark); overflow: hidden; }
  .atp-media-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .atp-media-thumb-video { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--saffron-dark), var(--brown)); }
  .atp-media-remove { position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,.6); border: none; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; font-size: 14px; transition: var(--transition); }
  .atp-media-remove:hover { background: #e74c3c; }
  .atp-media-type { position: absolute; bottom: 6px; left: 6px; background: rgba(0,0,0,.55); color: white; font-size: 9px; font-family: var(--font-display); letter-spacing: .08em; padding: 2px 7px; border-radius: 50px; }
  .atp-media-caption { padding: 10px; }
  .atp-input-sm { padding: 8px 12px; font-size: 14px; }

  /* ── Review Box ── */
  .atp-review { background: linear-gradient(135deg, rgba(61,31,0,.96), rgba(107,58,16,.96)); border-radius: var(--radius-lg); padding: 28px 32px; margin-bottom: 28px; color: white; }
  .atp-review-title { font-family: var(--font-display); font-size: 16px; letter-spacing: .06em; margin-bottom: 20px; color: var(--gold-light); display: flex; align-items: center; gap: 10px; }
  .atp-review-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .atp-review-item { background: rgba(255,255,255,.06); border-radius: var(--radius); padding: 12px 16px; border: 1px solid rgba(255,255,255,.1); }
  .atp-review-lbl { font-family: var(--font-display); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: rgba(255,255,255,.5); margin-bottom: 4px; }
  .atp-review-val { font-family: var(--font-body); font-size: 15px; font-weight: 600; color: white; }

  /* ── Footer Actions ── */
  .atp-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 8px; }
  .atp-footer.end { justify-content: flex-end; }

  /* ── Buttons ── */
  .btn-primary { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, var(--saffron), var(--saffron-dark)); color: white; padding: 13px 32px; border: none; border-radius: 50px; font-family: var(--font-display); font-size: 13px; letter-spacing: .07em; cursor: pointer; transition: var(--transition); box-shadow: 0 4px 15px rgba(232,101,10,.35); }
  .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(232,101,10,.45); }
  .btn-primary:disabled { opacity: .6; cursor: not-allowed; }
  .btn-primary.wide { padding: 15px 48px; font-size: 15px; }
  .btn-secondary { display: inline-flex; align-items: center; gap: 8px; background: transparent; color: var(--text-mid); padding: 13px 28px; border: 2px solid var(--cream-dark); border-radius: 50px; font-family: var(--font-display); font-size: 13px; letter-spacing: .06em; cursor: pointer; transition: var(--transition); }
  .btn-secondary:hover { border-color: var(--saffron-light); color: var(--saffron); }

  /* ── Result Screen ── */
  .atp-result-wrap { min-height: 60vh; display: flex; align-items: center; justify-content: center; padding: 60px 24px; }
  .atp-result-card { background: white; border-radius: var(--radius-lg); padding: 52px 44px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 12px 60px var(--shadow-deep); border: 1px solid var(--cream-dark); }
  .atp-result-card h2 { font-family: var(--font-display); font-size: 28px; color: var(--brown); margin: 8px 0 12px; }
  .atp-result-card p { color: var(--text-light); font-size: 16px; line-height: 1.65; margin-bottom: 28px; }
  .atp-result-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
  .atp-spin { animation: spin .7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── Responsive ── */
  @media (max-width: 640px) {
    .atp-row { grid-template-columns: 1fr; }
    .atp-review-grid { grid-template-columns: 1fr; }
    .atp-steps { gap: 0; }
    .atp-step-btn { padding: 12px 8px; font-size: 11px; }
    .atp-footer { flex-direction: column-reverse; gap: 10px; align-items: stretch; }
    .atp-footer > button { width: 100%; justify-content: center; }
    .atp-hero { padding: 44px 16px 60px; }
  }
`;

export default function AdminAddTemplePage() {
  const heroInputRef  = useRef(null);
  const mediaInputRef = useRef(null);

  const [form,        setForm]       = useState(initialForm());
  const [heroImage,   setHeroImage]  = useState(null);
  const [heroPreview, setHeroPreview]= useState(null);
  const [mediaFiles,  setMediaFiles] = useState([]);
  const [step,        setStep]       = useState(1);
  const [submitting,  setSubmitting] = useState(false);
  const [result,      setResult]     = useState(null);
  const [errors,      setErrors]     = useState({});

  const set    = (field, val) => { setForm(prev => ({ ...prev, [field]: val })); if (errors[field]) setErrors(p => ({ ...p, [field]: null })); };
  const toggle = field => setForm(prev => ({ ...prev, [field]: !prev[field] }));

  const handleHeroChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setHeroImage(file);
    setHeroPreview(URL.createObjectURL(file));
  };

  const handleMediaAdd = e => {
    const items = Array.from(e.target.files || []).map(f => ({
      file: f, preview: f.type.startsWith('video') ? null : URL.createObjectURL(f),
      isVideo: f.type.startsWith('video'), caption: '', id: Math.random().toString(36).slice(2),
    }));
    setMediaFiles(prev => [...prev, ...items]);
    e.target.value = '';
  };

  const removeMedia   = id => setMediaFiles(prev => prev.filter(m => m.id !== id));
  const updateCaption = (id, caption) => setMediaFiles(prev => prev.map(m => m.id === id ? { ...m, caption } : m));

  const validate = () => {
    const e = {};
    if (!form.name.trim())  e.name  = 'Temple name is required';
    if (!form.city.trim())  e.city  = 'City is required';
    if (!form.state.trim()) e.state = 'State is required';
    if (form.latitude  && isNaN(parseFloat(form.latitude)))  e.latitude  = 'Invalid latitude';
    if (form.longitude && isNaN(parseFloat(form.longitude))) e.longitude = 'Invalid longitude';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) { setStep(1); return; }
    setSubmitting(true);

    try {
      const fd = new FormData();

      // Required fields
      fd.append('name',  form.name.trim());
      fd.append('city',  form.city.trim());
      fd.append('state', form.state.trim());

      // Optional text fields
      const optionalFields = [
        'name_hindi','name_local','address','district','pincode',
        'primary_deity','secondary_deities','sect','temple_type',
        'history','significance','architecture_style','estimated_year_built',
        'opening_time','closing_time','entry_fee','dress_code',
        'best_time_to_visit','nearest_railway','nearest_airport',
        'website_url','phone','category_tags',
      ];
      optionalFields.forEach(key => {
        if (form[key] !== '' && form[key] !== null && form[key] !== undefined) {
          fd.append(key, form[key]);
        }
      });

      // Coordinates
      if (form.latitude)  fd.append('latitude',  parseFloat(form.latitude));
      if (form.longitude) fd.append('longitude', parseFloat(form.longitude));

      // Boolean flags
      fd.append('is_jyotirlinga',   form.is_jyotirlinga);
      fd.append('is_shaktipeeth',   form.is_shaktipeeth);
      fd.append('is_heritage_site', form.is_heritage_site);
      fd.append('is_asi_protected', form.is_asi_protected);

      // Hero image
      if (heroImage) fd.append('hero_image', heroImage);

      // Step 1: create the temple
      const { adminAPI } = await import('../services/api');
      const res = await adminAPI.createTemple(fd);

      const { temple_id, slug } = res.data;

      // Step 2: upload additional media if any
      for (const m of mediaFiles) {
        const mfd = new FormData();
        mfd.append('file', m.file);
        if (m.caption) mfd.append('caption', m.caption);
        await adminAPI.uploadMedia(temple_id, mfd);
      }

      setResult({ success: true, message: 'Temple has been successfully added to BharatMandir.', slug, templeId: temple_id });
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Something went wrong';
      setResult({ success: false, message: detail });
    } finally {
      setSubmitting(false);
    }
  };

  const stepClass = n => `atp-step-btn${step === n ? ' active' : step > n ? ' done' : ''}`;
  const goToStep  = n => { if (n < step) setStep(n); else if (n === 2 && step === 1 && validate()) setStep(2); else if (n === 3 && step < 3) { if (validate()) setStep(n); } };

  if (result) {
    return (
      <>
        <style>{styles}</style>
        <div className="atp-page">
          <Navbar />
          <div className="atp-result-wrap">
            <div className="atp-result-card">
              <div style={{ fontSize: 64, marginBottom: 8 }}>{result.success ? '🕉️' : '⚠️'}</div>
              <h2>{result.success ? 'Temple Added!' : 'Oops!'}</h2>
              <p>{result.message}</p>
              <div className="atp-result-actions">
                {result.success && <button className="btn-primary" onClick={() => {}}>View Temple →</button>}
                <button className="btn-secondary" onClick={() => { setResult(null); setStep(1); setForm(initialForm()); setMediaFiles([]); setHeroImage(null); setHeroPreview(null); }}>Add Another</button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className="atp-page">
        <Navbar />

        {/* Hero */}
        <div className="atp-hero">
          <div className="atp-hero-om">OM</div>
          <div className="atp-hero-inner">
            <div className="atp-hero-badge">ADMIN PANEL</div>
            <h1 className="atp-hero-title">Add New <span>Temple</span></h1>
            <p className="atp-hero-sub">Fill in the details to add a sacred temple to BharatMandir</p>
          </div>
        </div>

        {/* Step Tabs */}
        <div className="atp-steps-wrap">
          <div className="atp-steps">
            {[
              { n: 1, label: 'Basic Info' },
              { n: 2, label: 'Details & Timings' },
              { n: 3, label: 'Photos & Videos' },
            ].map(({ n, label }, i) => (
              <Fragment key={n}>
                {i > 0 && <div className="atp-step-divider" />}
                <button className={stepClass(n)} onClick={() => goToStep(n)}>
                  <span className="atp-step-num">{step > n ? '✓' : n}</span>
                  {label}
                </button>
              </Fragment>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="atp-form-wrap">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div>
              <div className="atp-section-label">Temple Identity</div>
              <div className="atp-row">
                <div className="atp-field">
                  <label className={`atp-label${errors.name ? ' err' : ''}`}>Temple Name *</label>
                  <input className={`atp-input${errors.name ? ' err' : ''}`} placeholder="e.g. Mahakaleshwar Mandir" value={form.name} onChange={e => set('name', e.target.value)} />
                  {errors.name && <span className="atp-field-err">{errors.name}</span>}
                </div>
                <div className="atp-field">
                  <label className="atp-label">Name in Hindi</label>
                  <input className="atp-input" placeholder="e.g. महाकालेश्वर मंदिर" value={form.name_hindi} onChange={e => set('name_hindi', e.target.value)} />
                </div>
              </div>
              <div className="atp-row">
                <div className="atp-field">
                  <label className="atp-label">Local Language Name</label>
                  <input className="atp-input" placeholder="Name in regional language" value={form.name_local} onChange={e => set('name_local', e.target.value)} />
                </div>
                <div className="atp-field">
                  <label className="atp-label">Phone</label>
                  <input className="atp-input" placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={e => set('phone', e.target.value)} />
                </div>
              </div>

              <div className="atp-section-label">Location</div>
              <div className="atp-row">
                <div className="atp-field full">
                  <label className="atp-label">Address</label>
                  <input className="atp-input" placeholder="Street address, landmark" value={form.address} onChange={e => set('address', e.target.value)} />
                </div>
              </div>
              <div className="atp-row">
                <div className="atp-field">
                  <label className={`atp-label${errors.city ? ' err' : ''}`}>City *</label>
                  <input className={`atp-input${errors.city ? ' err' : ''}`} placeholder="e.g. Ujjain" value={form.city} onChange={e => set('city', e.target.value)} />
                  {errors.city && <span className="atp-field-err">{errors.city}</span>}
                </div>
                <div className="atp-field">
                  <label className="atp-label">District</label>
                  <input className="atp-input" placeholder="e.g. Ujjain" value={form.district} onChange={e => set('district', e.target.value)} />
                </div>
              </div>
              <div className="atp-row">
                <div className="atp-field">
                  <label className={`atp-label${errors.state ? ' err' : ''}`}>State *</label>
                  <select className={`atp-input${errors.state ? ' err' : ''}`} value={form.state} onChange={e => set('state', e.target.value)}>
                    <option value="">Select State</option>
                    {STATES_IN.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {errors.state && <span className="atp-field-err">{errors.state}</span>}
                </div>
                <div className="atp-field">
                  <label className="atp-label">Pincode</label>
                  <input className="atp-input" placeholder="e.g. 456010" maxLength={6} value={form.pincode} onChange={e => set('pincode', e.target.value)} />
                </div>
              </div>
              <div className="atp-row">
                <div className="atp-field">
                  <label className={`atp-label${errors.latitude ? ' err' : ''}`}>Latitude</label>
                  <input className={`atp-input${errors.latitude ? ' err' : ''}`} placeholder="e.g. 23.1828" type="number" step="any" value={form.latitude} onChange={e => set('latitude', e.target.value)} />
                  {errors.latitude && <span className="atp-field-err">{errors.latitude}</span>}
                </div>
                <div className="atp-field">
                  <label className={`atp-label${errors.longitude ? ' err' : ''}`}>Longitude</label>
                  <input className={`atp-input${errors.longitude ? ' err' : ''}`} placeholder="e.g. 75.7682" type="number" step="any" value={form.longitude} onChange={e => set('longitude', e.target.value)} />
                  {errors.longitude && <span className="atp-field-err">{errors.longitude}</span>}
                </div>
              </div>

              <div className="atp-section-label">Deity & Type</div>
              <div className="atp-row">
                <div className="atp-field">
                  <label className="atp-label">Primary Deity</label>
                  <input className="atp-input" placeholder="e.g. Lord Shiva" value={form.primary_deity} onChange={e => set('primary_deity', e.target.value)} />
                </div>
                <div className="atp-field">
                  <label className="atp-label">Secondary Deities (comma separated)</label>
                  <input className="atp-input" placeholder="e.g. Parvati, Ganesha" value={form.secondary_deities} onChange={e => set('secondary_deities', e.target.value)} />
                </div>
              </div>
              <div className="atp-row">
                <div className="atp-field">
                  <label className="atp-label">Sect / Tradition</label>
                  <select className="atp-input" value={form.sect} onChange={e => set('sect', e.target.value)}>
                    {SECTS.map(s => <option key={s} value={s}>{s || 'Select Sect'}</option>)}
                  </select>
                </div>
                <div className="atp-field">
                  <label className="atp-label">Temple Type</label>
                  <select className="atp-input" value={form.temple_type} onChange={e => set('temple_type', e.target.value)}>
                    {TYPES.map(t => <option key={t} value={t}>{t || 'Select Type'}</option>)}
                  </select>
                </div>
              </div>

              <div className="atp-section-label">Special Designations</div>
              <div className="atp-flags">
                {[
                  { key: 'is_jyotirlinga',   label: '⚡ Jyotirlinga' },
                  { key: 'is_shaktipeeth',   label: '🌸 Shaktipeeth' },
                  { key: 'is_heritage_site', label: '🏛️ Heritage Site' },
                  { key: 'is_asi_protected', label: '🔒 ASI Protected' },
                ].map(({ key, label }) => (
                  <button key={key} type="button" className={`atp-flag${form[key] ? ' on' : ''}`} onClick={() => toggle(key)}>
                    {form[key] ? '✓ ' : ''}{label}
                  </button>
                ))}
              </div>

              <div className="atp-section-label">Hero Image</div>
              <div className="atp-hero-zone" onClick={() => heroInputRef.current?.click()}>
                {heroPreview ? (
                  <>
                    <img src={heroPreview} alt="hero preview" className="atp-hero-preview" />
                    <div className="atp-hero-overlay"><span>Click to change</span></div>
                  </>
                ) : (
                  <div className="atp-hero-zone__ph">
                    <div className="atp-hero-zone__icon">🖼️</div>
                    <p className="atp-hero-zone__text">Click to upload hero image</p>
                    <p className="atp-hero-zone__hint">JPEG · PNG · WebP · max 10 MB</p>
                  </div>
                )}
              </div>
              <input ref={heroInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleHeroChange} />

              <div className="atp-row" style={{ marginTop: 8 }}>
                <div className="atp-field full">
                  <label className="atp-label">Category Tags (comma separated)</label>
                  <input className="atp-input" placeholder="e.g. ancient, riverside, pilgrimage" value={form.category_tags} onChange={e => set('category_tags', e.target.value)} />
                </div>
              </div>

              <div className="atp-footer end" style={{ marginTop: 32 }}>
                <button className="btn-primary" onClick={() => { if (validate()) setStep(2); }}>Next: Details →</button>
              </div>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div>
              <div className="atp-section-label">History & Significance</div>
              <div className="atp-row">
                <div className="atp-field full">
                  <label className="atp-label">History</label>
                  <textarea className={`atp-input atp-textarea`} placeholder="Brief history of the temple..." value={form.history} onChange={e => set('history', e.target.value)} />
                </div>
              </div>
              <div className="atp-row">
                <div className="atp-field full">
                  <label className="atp-label">Significance</label>
                  <textarea className={`atp-input atp-textarea atp-textarea-sm`} placeholder="Why is this temple significant?" value={form.significance} onChange={e => set('significance', e.target.value)} />
                </div>
              </div>
              <div className="atp-row">
                <div className="atp-field">
                  <label className="atp-label">Architecture Style</label>
                  <input className="atp-input" placeholder="e.g. Nagara, Dravidian" value={form.architecture_style} onChange={e => set('architecture_style', e.target.value)} />
                </div>
                <div className="atp-field">
                  <label className="atp-label">Estimated Year Built</label>
                  <input className="atp-input" placeholder="e.g. 7th century, 1234 AD" value={form.estimated_year_built} onChange={e => set('estimated_year_built', e.target.value)} />
                </div>
              </div>

              <div className="atp-section-label">Timing & Visitor Info</div>
              <div className="atp-row">
                <div className="atp-field">
                  <label className="atp-label">Opening Time</label>
                  <input className="atp-input" type="time" value={form.opening_time} onChange={e => set('opening_time', e.target.value)} />
                </div>
                <div className="atp-field">
                  <label className="atp-label">Closing Time</label>
                  <input className="atp-input" type="time" value={form.closing_time} onChange={e => set('closing_time', e.target.value)} />
                </div>
              </div>
              <div className="atp-row">
                <div className="atp-field">
                  <label className="atp-label">Entry Fee (₹, 0 = free)</label>
                  <input className="atp-input" type="number" min="0" placeholder="0" value={form.entry_fee} onChange={e => set('entry_fee', e.target.value)} />
                </div>
                <div className="atp-field">
                  <label className="atp-label">Dress Code</label>
                  <input className="atp-input" placeholder="e.g. Traditional attire required" value={form.dress_code} onChange={e => set('dress_code', e.target.value)} />
                </div>
              </div>
              <div className="atp-row">
                <div className="atp-field full">
                  <label className="atp-label">Best Time to Visit</label>
                  <input className="atp-input" placeholder="e.g. October to March, during Mahashivratri" value={form.best_time_to_visit} onChange={e => set('best_time_to_visit', e.target.value)} />
                </div>
              </div>

              <div className="atp-section-label">Transport & Links</div>
              <div className="atp-row">
                <div className="atp-field">
                  <label className="atp-label">Nearest Railway Station</label>
                  <input className="atp-input" placeholder="e.g. Ujjain Junction (2 km)" value={form.nearest_railway} onChange={e => set('nearest_railway', e.target.value)} />
                </div>
                <div className="atp-field">
                  <label className="atp-label">Nearest Airport</label>
                  <input className="atp-input" placeholder="e.g. Indore Airport (55 km)" value={form.nearest_airport} onChange={e => set('nearest_airport', e.target.value)} />
                </div>
              </div>
              <div className="atp-row">
                <div className="atp-field full">
                  <label className="atp-label">Official Website</label>
                  <input className="atp-input" type="url" placeholder="https://..." value={form.website_url} onChange={e => set('website_url', e.target.value)} />
                </div>
              </div>

              <div className="atp-footer" style={{ marginTop: 32 }}>
                <button className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
                <button className="btn-primary" onClick={() => setStep(3)}>Next: Media →</button>
              </div>
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div>
              <div className="atp-section-label">Photos & Videos</div>
              <p style={{ color: 'var(--text-light)', fontSize: 15, marginBottom: 24, fontFamily: 'var(--font-body)' }}>
                Add images and videos that will appear in the temple's gallery.
              </p>

              <div className="atp-media-zone" onClick={() => mediaInputRef.current?.click()}>
                <div style={{ fontSize: 40, color: 'var(--saffron)' }}>📷</div>
                <p className="atp-media-zone-title">Click to add images or videos</p>
                <p className="atp-media-zone-hint">JPEG · PNG · WebP (max 10MB) &nbsp;|&nbsp; MP4 · WebM (max 200MB)</p>
              </div>
              <input ref={mediaInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" style={{ display: 'none' }} onChange={handleMediaAdd} />

              {mediaFiles.length > 0 && (
                <div className="atp-media-grid">
                  {mediaFiles.map(m => (
                    <div key={m.id} className="atp-media-card">
                      <div className="atp-media-thumb">
                        {m.isVideo
                          ? <div className="atp-media-thumb-video"><span style={{ fontSize: 40 }}>🎬</span></div>
                          : <img src={m.preview} alt="" />
                        }
                        <button className="atp-media-remove" onClick={() => removeMedia(m.id)}>✕</button>
                        <div className="atp-media-type">{m.isVideo ? 'VIDEO' : 'IMAGE'}</div>
                      </div>
                      <div className="atp-media-caption">
                        <input className={`atp-input atp-input-sm`} placeholder="Caption (optional)" value={m.caption} onChange={e => updateCaption(m.id, e.target.value)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Review */}
              <div className="atp-review">
                <div className="atp-review-title">🕉️ Review Befor Submitting</div>
                <div className="atp-review-grid">
                  {[
                    ['Temple Name',      form.name || '—'],
                    ['City, State',      form.city && form.state ? `${form.city}, ${form.state}` : '—'],
                    ['Primary Deity',    form.primary_deity || '—'],
                    ['Hero Image',       heroImage ? heroImage.name : 'Not set'],
                    ['Additional Media', `${mediaFiles.length} file(s)`],
                    ['Coordinates',      form.latitude ? `${form.latitude}, ${form.longitude}` : 'Not set'],
                  ].map(([k, v]) => (
                    <div key={k} className="atp-review-item">
                      <div className="atp-review-lbl">{k}</div>
                      <div className="atp-review-val">{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="atp-footer" style={{ marginTop: 8 }}>
                <button className="btn-secondary" onClick={() => setStep(2)}>← Back</button>
                <button className="btn-primary wide" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? <><span className="atp-spin" style={{ display: 'inline-block' }}>⟳</span> Saving…</> : '🕉️ Save Temple'}
                </button>
              </div>
            </div>
          )}
        </div>

        <Footer />
      </div>
    </>
  );
}