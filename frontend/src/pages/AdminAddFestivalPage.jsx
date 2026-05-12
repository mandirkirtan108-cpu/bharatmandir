import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const ADMIN_KEY = import.meta.env.VITE_ADMIN_SECRET_KEY || '';

// ── Constants ──────────────────────────────────────────────────────────────────
const GREGORIAN_MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' },   { value: 4, label: 'April' },
  { value: 5, label: 'May' },     { value: 6, label: 'June' },
  { value: 7, label: 'July' },    { value: 8, label: 'August' },
  { value: 9, label: 'September'},{ value: 10, label: 'October' },
  { value: 11, label: 'November'},{ value: 12, label: 'December' },
];

const HINDU_MONTHS = [
  'Chaitra','Vaishakha','Jyeshtha','Ashadha',
  'Shravana','Bhadrapada','Ashwin','Kartika',
  'Margashirsha','Pausha','Magha','Phalguna',
];

const FESTIVAL_TYPES = [
  '','Deity','Cultural','Seasonal','Devi','Solar',
  'Procession','Auspicious','Purnima','Guru','New Year',
  'Scripture','Nature','Victory','Other',
];

const COMMON_DEITIES = [
  'Shiva','Vishnu','Ganesha','Durga','Lakshmi','Saraswati',
  'Krishna','Rama','Hanuman','Surya','Kali','Parvati',
  'Brahma','Jagannath','Murugan','Ayyappa','Other',
];

const FESTIVAL_EMOJIS = [
  '🪔','🔱','🐘','🌸','🎨','🏹','🪈','🪢','🌕','📿',
  '⛰️','💐','📖','🪁','✨','🌺','🛕','🪆','🐍','🌟',
];

function initialForm() {
  return {
    temple_id: '',
    name: '',
    description: '',
    significance: '',
    month: '',
    hindu_month: '',
    duration_days: '1',
    is_major: false,
    deity: '',
    type: '',
    emoji: '🪔',
  };
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=Noto+Sans+Devanagari:wght@400;600&display=swap');

  :root {
    --saffron:#E8650A; --saffron-light:#F5934A; --saffron-dark:#B84D00;
    --gold:#C8960C; --gold-light:#F0C040;
    --cream:#FDF8F0; --cream-dark:#F0E6D0;
    --brown:#3D1F00; --brown-mid:#6B3A10;
    --white:#FFFFFF; --text-dark:#1A0A00; --text-mid:#4A2800; --text-light:#8B6040;
    --shadow:rgba(61,31,0,0.12); --shadow-deep:rgba(61,31,0,0.28);
    --font-display:'Cinzel',serif; --font-body:'Crimson Pro',serif; --font-hindi:'Noto Sans Devanagari',sans-serif;
    --radius:12px; --radius-lg:20px; --transition:0.3s cubic-bezier(0.4,0,0.2,1);
    --green:#16a34a; --red:#dc2626;
  }
  *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:var(--font-body); background:var(--cream); color:var(--text-dark); }
  a { text-decoration:none; color:inherit; }

  /* ── Hero ── */
  .aff-hero {
    position:relative;
    background:linear-gradient(160deg, #1A0A00 0%, #3D1F00 35%, #6B3A10 65%, #B84D00 100%);
    padding:56px 24px 72px; text-align:center; overflow:hidden;
  }
  .aff-hero-bg { position:absolute; inset:0; pointer-events:none; }
  .aff-float {
    position:absolute; font-size:clamp(20px,3.5vw,44px);
    opacity:.12; animation:floatUp 7s ease-in-out infinite;
  }
  .aff-float:nth-child(1){top:12%;left:6%;animation-delay:0s;}
  .aff-float:nth-child(2){top:55%;left:12%;animation-delay:1.4s;}
  .aff-float:nth-child(3){top:18%;right:8%;animation-delay:.7s;}
  .aff-float:nth-child(4){bottom:18%;right:5%;animation-delay:2.1s;}
  .aff-float:nth-child(5){top:70%;right:18%;animation-delay:1.8s;}
  @keyframes floatUp {
    0%,100%{transform:translateY(0) rotate(-4deg);opacity:.12;}
    50%{transform:translateY(-16px) rotate(4deg);opacity:.22;}
  }
  .aff-hero-inner { position:relative; z-index:1; }
  .aff-hero-badge {
    display:inline-flex; align-items:center; gap:8px;
    background:rgba(200,150,12,.18); border:1px solid rgba(240,192,64,.35);
    backdrop-filter:blur(8px); color:var(--gold-light);
    padding:5px 18px; border-radius:50px;
    font-family:var(--font-display); font-size:11px; letter-spacing:.14em;
    margin-bottom:16px;
  }
  .aff-hero-title {
    font-family:var(--font-display); font-weight:900;
    font-size:clamp(28px,5vw,52px); color:white;
    line-height:1.1; margin-bottom:10px;
    text-shadow:0 2px 20px rgba(0,0,0,.4);
  }
  .aff-hero-title span { color:var(--gold-light); }
  .aff-hero-sub {
    font-family:var(--font-hindi); font-size:15px;
    color:rgba(255,255,255,.7);
  }

  /* ── Breadcrumb ── */
  .aff-breadcrumb {
    background:white; border-bottom:1px solid var(--cream-dark);
    padding:12px 24px;
  }
  .aff-breadcrumb-inner {
    max-width:860px; margin:0 auto;
    display:flex; align-items:center; gap:8px;
    font-family:var(--font-display); font-size:12px; letter-spacing:.04em;
    color:var(--text-light);
  }
  .aff-breadcrumb-inner a { color:var(--saffron); }
  .aff-breadcrumb-inner a:hover { text-decoration:underline; }

  /* ── Main layout ── */
  .aff-main { max-width:860px; margin:0 auto; padding:36px 24px 80px; }

  /* ── Card ── */
  .aff-card {
    background:white; border:1.5px solid var(--cream-dark);
    border-radius:var(--radius-lg); padding:28px 32px;
    margin-bottom:20px; position:relative; overflow:hidden;
  }
  .aff-card::before {
    content:''; position:absolute; top:0; left:0; right:0; height:4px;
    background:linear-gradient(90deg, var(--saffron), var(--gold));
  }
  .aff-card-title {
    font-family:var(--font-display); font-size:13px;
    letter-spacing:.1em; text-transform:uppercase;
    color:var(--saffron); margin-bottom:22px;
    display:flex; align-items:center; gap:10px;
  }
  .aff-card-title::after {
    content:''; flex:1; height:1px; background:var(--cream-dark);
  }

  /* ── Grid/Row ── */
  .aff-row { display:grid; grid-template-columns:1fr 1fr; gap:18px; margin-bottom:18px; }
  .aff-row-3 { grid-template-columns:1fr 1fr 1fr; }
  .aff-full { grid-column:1/-1; }

  /* ── Field ── */
  .aff-field { display:flex; flex-direction:column; gap:6px; }
  .aff-label {
    font-family:var(--font-display); font-size:11px;
    letter-spacing:.08em; text-transform:uppercase; color:var(--text-light);
  }
  .aff-label .req { color:var(--saffron); margin-left:2px; }
  .aff-input, .aff-select, .aff-textarea {
    width:100%; padding:10px 14px;
    border:2px solid var(--cream-dark); border-radius:var(--radius);
    font-family:var(--font-body); font-size:15px; color:var(--text-dark);
    background:var(--cream); outline:none; transition:var(--transition);
  }
  .aff-input:focus, .aff-select:focus, .aff-textarea:focus {
    border-color:var(--saffron); background:white;
    box-shadow:0 0 0 3px rgba(232,101,10,.1);
  }
  .aff-input.error, .aff-select.error { border-color:var(--red); }
  .aff-textarea { resize:vertical; min-height:100px; line-height:1.6; }
  .aff-select { appearance:none; cursor:pointer;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B84D00' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat:no-repeat; background-position:right 14px center;
    padding-right:36px;
  }
  .aff-hint { font-size:12px; color:var(--text-light); margin-top:2px; }
  .aff-err-msg { font-size:12px; color:var(--red); margin-top:2px; }

  /* ── Toggle / Checkbox ── */
  .aff-toggle-row {
    display:flex; align-items:center; justify-content:space-between;
    background:var(--cream); border:1.5px solid var(--cream-dark);
    border-radius:var(--radius); padding:12px 16px;
    cursor:pointer; transition:var(--transition);
  }
  .aff-toggle-row:hover { border-color:var(--saffron-light); }
  .aff-toggle-row.checked { border-color:var(--saffron); background:rgba(232,101,10,.06); }
  .aff-toggle-label { font-family:var(--font-body); font-size:15px; color:var(--text-mid); }
  .aff-toggle-label strong { font-family:var(--font-display); font-size:13px; display:block; color:var(--brown); }
  .aff-toggle-switch {
    width:42px; height:24px; border-radius:50px;
    background:var(--cream-dark); position:relative;
    transition:var(--transition); flex-shrink:0;
  }
  .aff-toggle-switch.on { background:var(--saffron); }
  .aff-toggle-switch::after {
    content:''; position:absolute; width:18px; height:18px;
    border-radius:50%; background:white;
    top:3px; left:3px; transition:var(--transition);
    box-shadow:0 1px 4px rgba(0,0,0,.2);
  }
  .aff-toggle-switch.on::after { left:21px; }

  /* ── Emoji picker ── */
  .aff-emoji-grid {
    display:flex; flex-wrap:wrap; gap:8px; margin-top:8px;
  }
  .aff-emoji-btn {
    width:40px; height:40px; border-radius:10px;
    border:2px solid var(--cream-dark);
    background:var(--cream); font-size:20px;
    cursor:pointer; transition:var(--transition);
    display:flex; align-items:center; justify-content:center;
  }
  .aff-emoji-btn:hover { border-color:var(--saffron-light); transform:scale(1.1); }
  .aff-emoji-btn.selected { border-color:var(--saffron); background:rgba(232,101,10,.1); box-shadow:0 0 0 2px rgba(232,101,10,.2); }

  /* ── Preview card ── */
  .aff-preview {
    background:linear-gradient(135deg, #1A0A00, #3D1F00);
    border-radius:var(--radius-lg); padding:24px; color:white;
    margin-bottom:20px; position:relative; overflow:hidden;
  }
  .aff-preview-label {
    font-family:var(--font-display); font-size:10px;
    letter-spacing:.16em; color:rgba(255,255,255,.45);
    margin-bottom:16px;
  }
  .aff-preview-inner { display:flex; align-items:center; gap:16px; }
  .aff-preview-emoji {
    width:64px; height:64px; border-radius:var(--radius);
    background:rgba(255,255,255,.08);
    display:flex; align-items:center; justify-content:center;
    font-size:32px; flex-shrink:0;
    border:1px solid rgba(255,255,255,.12);
  }
  .aff-preview-info { flex:1; min-width:0; }
  .aff-preview-name {
    font-family:var(--font-display); font-size:18px; font-weight:700;
    color:white; margin-bottom:4px;
  }
  .aff-preview-deity { font-family:var(--font-hindi); font-size:13px; color:var(--gold-light); }
  .aff-preview-meta { display:flex; gap:8px; margin-top:8px; flex-wrap:wrap; }
  .aff-preview-badge {
    font-size:11px; padding:2px 10px; border-radius:50px;
    border:1px solid rgba(255,255,255,.2);
    color:rgba(255,255,255,.75);
    font-family:var(--font-display); letter-spacing:.04em;
  }
  .aff-preview-badge.major { border-color:var(--gold); color:var(--gold-light); }

  /* ── Temple search ── */
  .aff-temple-results {
    position:absolute; top:100%; left:0; right:0; z-index:50;
    background:white; border:2px solid var(--cream-dark);
    border-top:none; border-radius:0 0 var(--radius) var(--radius);
    max-height:220px; overflow-y:auto;
    box-shadow:0 8px 24px var(--shadow);
  }
  .aff-temple-option {
    padding:10px 14px; cursor:pointer;
    border-bottom:1px solid var(--cream-dark);
    transition:var(--transition);
  }
  .aff-temple-option:last-child { border-bottom:none; }
  .aff-temple-option:hover { background:var(--cream); }
  .aff-temple-option-name { font-family:var(--font-body); font-size:15px; color:var(--text-dark); }
  .aff-temple-option-city { font-family:var(--font-hindi); font-size:12px; color:var(--text-light); }
  .aff-temple-selected {
    display:flex; align-items:center; justify-content:space-between;
    background:rgba(232,101,10,.08); border:2px solid var(--saffron);
    border-radius:var(--radius); padding:10px 14px;
  }
  .aff-temple-selected-info { font-family:var(--font-body); font-size:15px; color:var(--text-dark); }
  .aff-temple-selected-city { font-family:var(--font-hindi); font-size:12px; color:var(--saffron); }
  .aff-clear-btn {
    background:none; border:none; cursor:pointer;
    color:var(--text-light); font-size:18px; line-height:1;
    padding:2px 6px; border-radius:6px; transition:var(--transition);
  }
  .aff-clear-btn:hover { color:var(--red); background:rgba(220,38,38,.08); }
  .aff-search-wrap { position:relative; }

  /* ── Action bar ── */
  .aff-actions {
    display:flex; align-items:center; justify-content:space-between;
    gap:16px; padding-top:8px;
  }
  .aff-btn-primary {
    display:inline-flex; align-items:center; gap:8px;
    background:linear-gradient(135deg,var(--saffron),var(--saffron-dark));
    color:white; padding:13px 32px; border:none; border-radius:50px;
    font-family:var(--font-display); font-size:13px; letter-spacing:.06em;
    cursor:pointer; transition:var(--transition);
    box-shadow:0 4px 15px rgba(232,101,10,.35);
  }
  .aff-btn-primary:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 25px rgba(232,101,10,.45); }
  .aff-btn-primary:disabled { opacity:.6; cursor:not-allowed; }
  .aff-btn-secondary {
    display:inline-flex; align-items:center; gap:8px;
    background:white; color:var(--text-mid);
    padding:12px 24px; border:2px solid var(--cream-dark); border-radius:50px;
    font-family:var(--font-display); font-size:13px; letter-spacing:.05em;
    cursor:pointer; transition:var(--transition);
  }
  .aff-btn-secondary:hover { border-color:var(--saffron); color:var(--saffron); }
  .aff-spin { display:inline-block; animation:spin .7s linear infinite; }
  @keyframes spin { to{transform:rotate(360deg);} }

  /* ── Result screen ── */
  .aff-result-wrap {
    min-height:60vh; display:flex; align-items:center; justify-content:center;
    padding:60px 24px;
  }
  .aff-result-card {
    background:white; border-radius:var(--radius-lg);
    border:1.5px solid var(--cream-dark);
    padding:48px 40px; text-align:center; max-width:440px;
    box-shadow:0 12px 40px var(--shadow);
  }
  .aff-result-icon { font-size:64px; margin-bottom:12px; }
  .aff-result-card h2 {
    font-family:var(--font-display); font-size:24px; color:var(--brown);
    margin-bottom:10px;
  }
  .aff-result-card p { color:var(--text-light); font-size:16px; margin-bottom:28px; }
  .aff-result-actions { display:flex; gap:12px; justify-content:center; flex-wrap:wrap; }

  /* ── Error banner ── */
  .aff-error-banner {
    background:#fef2f2; border:1.5px solid #fca5a5;
    border-radius:var(--radius); padding:14px 18px;
    color:#dc2626; font-family:var(--font-body); font-size:15px;
    margin-bottom:20px; display:flex; align-items:center; gap:10px;
  }

  @media(max-width:620px) {
    .aff-row { grid-template-columns:1fr; }
    .aff-row-3 { grid-template-columns:1fr 1fr; }
    .aff-card { padding:20px 18px; }
    .aff-actions { flex-direction:column-reverse; }
    .aff-btn-primary, .aff-btn-secondary { width:100%; justify-content:center; }
  }
`;

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminAddFestivalPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm]             = useState(() => {
    const f = initialForm();
    f.temple_id = searchParams.get('temple_id') || '';
    return f;
  });
  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState(null);
  const [apiError, setApiError]     = useState('');

  // Temple search
  const [templeQuery, setTempleQuery]       = useState('');
  const [templeResults, setTempleResults]   = useState([]);
  const [selectedTemple, setSelectedTemple] = useState(null);
  const [searchingTemple, setSearchingTemple] = useState(false);

  // Pre-load temple if temple_id passed in URL
  useEffect(() => {
    const tid = searchParams.get('temple_id');
    if (tid) {
      fetch(`${API_BASE}/api/temples/${tid}`)
        .then(r => r.json())
        .then(d => { if (d.id) setSelectedTemple(d); })
        .catch(() => {});
    }
  }, []);

  // Auto-fill hindu_month when gregorian month changes
  useEffect(() => {
    if (form.month) {
      setForm(f => ({ ...f, hindu_month: HINDU_MONTHS[(Number(f.month)) % 12] || '' }));
    }
  }, [form.month]);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  // ── Temple search ──
  const searchTemples = async (q) => {
    setTempleQuery(q);
    if (q.length < 2) { setTempleResults([]); return; }
    setSearchingTemple(true);
    try {
      const r = await fetch(`${API_BASE}/api/temples/search?q=${encodeURIComponent(q)}&limit=8`);
      const d = await r.json();
      setTempleResults(Array.isArray(d) ? d : d.temples || []);
    } catch { setTempleResults([]); }
    finally { setSearchingTemple(false); }
  };

  const selectTemple = (t) => {
    setSelectedTemple(t);
    setForm(f => ({ ...f, temple_id: String(t.id) }));
    setTempleQuery('');
    setTempleResults([]);
    setErrors(e => { const n = { ...e }; delete n.temple_id; return n; });
  };

  const clearTemple = () => {
    setSelectedTemple(null);
    setForm(f => ({ ...f, temple_id: '' }));
  };

  // ── Validate ──
  const validate = () => {
    const e = {};
    if (!form.temple_id) e.temple_id = 'Please select a temple';
    if (!form.name.trim()) e.name = 'Festival name is required';
    if (!form.month) e.month = 'Month is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ──
  const handleSubmit = async () => {
    setApiError('');
    if (!validate()) return;
    setSubmitting(true);

    try {
      const payload = {
        temple_id:    Number(form.temple_id),
        name:         form.name.trim(),
        description:  form.description.trim(),
        significance: form.significance.trim(),
        month:        Number(form.month),
        hindu_month:  form.hindu_month.trim(),
        duration_days: Number(form.duration_days) || 1,
        is_major:     form.is_major,
        deity:        form.deity.trim(),
        type:         form.type,
        emoji:        form.emoji,
      };

      const res = await fetch(`${API_BASE}/api/admin/festivals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': ADMIN_KEY,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Server error');

      setResult({ success: true, name: form.name, templeSlug: selectedTemple?.slug });
    } catch (err) {
      setApiError(err.message || 'Failed to save festival. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setForm(initialForm());
    setResult(null);
    setErrors({});
    setApiError('');
    setSelectedTemple(null);
  };

  // ── Result screen ──
  if (result?.success) {
    return (
      <>
        <style>{styles}</style>
        <Navbar />
        <div className="aff-result-wrap">
          <div className="aff-result-card">
            <div className="aff-result-icon">{form.emoji || '🪔'}</div>
            <h2>Festival Added!</h2>
            <p><strong>{result.name}</strong> has been successfully added to the temple calendar.</p>
            <div className="aff-result-actions">
              <Link to="/festivals" className="aff-btn-primary" style={{ textDecoration:'none' }}>
                🗓️ View Calendar
              </Link>
              {result.templeSlug && (
                <Link to={`/temple/${result.templeSlug}`} className="aff-btn-secondary" style={{ textDecoration:'none' }}>
                  🛕 View Temple
                </Link>
              )}
              <button className="aff-btn-secondary" onClick={resetForm}>
                ＋ Add Another
              </button>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // ── Main form ──
  return (
    <>
      <style>{styles}</style>
      <Navbar />

      {/* Hero */}
      <div className="aff-hero">
        <div className="aff-hero-bg">
          {['🪔','✨','🌸','🔱','🌺'].map((e, i) => (
            <div key={i} className="aff-float">{e}</div>
          ))}
        </div>
        <div className="aff-hero-inner">
          <div className="aff-hero-badge">⚙️ ADMIN PANEL</div>
          <h1 className="aff-hero-title">Add <span>Festival</span></h1>
          <p className="aff-hero-sub">पर्व और उत्सव — Add a sacred festival to BharatMandir</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="aff-breadcrumb">
        <div className="aff-breadcrumb-inner">
          <Link to="/">Home</Link>
          <span>›</span>
          <Link to="/festivals">Festivals</Link>
          <span>›</span>
          <span>Add Festival</span>
        </div>
      </div>

      <div className="aff-main">

        {/* Live preview */}
        <div className="aff-preview">
          <div className="aff-preview-label">LIVE PREVIEW</div>
          <div className="aff-preview-inner">
            <div className="aff-preview-emoji">{form.emoji}</div>
            <div className="aff-preview-info">
              <div className="aff-preview-name">{form.name || 'Festival Name'}</div>
              <div className="aff-preview-deity">
                🙏 {form.deity || 'Deity'} {selectedTemple ? `· ${selectedTemple.name}` : ''}
              </div>
              <div className="aff-preview-meta">
                {form.is_major && <span className="aff-preview-badge major">⭐ Major Festival</span>}
                {form.type && <span className="aff-preview-badge">{form.type}</span>}
                {form.month && <span className="aff-preview-badge">{GREGORIAN_MONTHS.find(m=>m.value===Number(form.month))?.label || ''}</span>}
                {form.duration_days > 1 && <span className="aff-preview-badge">{form.duration_days} days</span>}
              </div>
            </div>
          </div>
        </div>

        {/* API error */}
        {apiError && (
          <div className="aff-error-banner">
            ⚠️ {apiError}
          </div>
        )}

        {/* ── Card 1: Temple selection ── */}
        <div className="aff-card">
          <div className="aff-card-title">🛕 Select Temple</div>

          <div className="aff-field">
            <label className="aff-label">Temple <span className="req">*</span></label>

            {selectedTemple ? (
              <div className="aff-temple-selected">
                <div>
                  <div className="aff-temple-selected-info">{selectedTemple.name}</div>
                  <div className="aff-temple-selected-city">
                    {selectedTemple.city}, {selectedTemple.state} · ID #{selectedTemple.id}
                  </div>
                </div>
                <button className="aff-clear-btn" onClick={clearTemple} title="Change temple">✕</button>
              </div>
            ) : (
              <div className="aff-search-wrap">
                <input
                  className={`aff-input${errors.temple_id ? ' error' : ''}`}
                  placeholder="Search temple by name…"
                  value={templeQuery}
                  onChange={e => searchTemples(e.target.value)}
                  autoComplete="off"
                />
                {templeResults.length > 0 && (
                  <div className="aff-temple-results">
                    {templeResults.map(t => (
                      <div key={t.id} className="aff-temple-option" onClick={() => selectTemple(t)}>
                        <div className="aff-temple-option-name">{t.name}</div>
                        <div className="aff-temple-option-city">{t.city}, {t.state}</div>
                      </div>
                    ))}
                  </div>
                )}
                {searchingTemple && (
                  <div className="aff-temple-results" style={{ padding:'12px 14px', color:'var(--text-light)', fontSize:14 }}>
                    Searching…
                  </div>
                )}
              </div>
            )}
            {errors.temple_id && <span className="aff-err-msg">⚠ {errors.temple_id}</span>}
            <span className="aff-hint">Or enter Temple ID directly: <input
              style={{ width:90, padding:'4px 8px', border:'1.5px solid var(--cream-dark)', borderRadius:8, fontFamily:'var(--font-body)', fontSize:14, background:'var(--cream)' }}
              placeholder="e.g. 42"
              value={selectedTemple ? '' : form.temple_id}
              onChange={e => { setForm(f=>({...f, temple_id:e.target.value})); setSelectedTemple(null); }}
            /></span>
          </div>
        </div>

        {/* ── Card 2: Basic info ── */}
        <div className="aff-card">
          <div className="aff-card-title">📋 Festival Details</div>

          <div className="aff-row">
            <div className="aff-field">
              <label className="aff-label">Festival Name <span className="req">*</span></label>
              <input
                className={`aff-input${errors.name ? ' error' : ''}`}
                placeholder="e.g. Maha Shivaratri"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
              {errors.name && <span className="aff-err-msg">⚠ {errors.name}</span>}
            </div>
            <div className="aff-field">
              <label className="aff-label">Presiding Deity</label>
              <select className="aff-select" value={form.deity} onChange={e => set('deity', e.target.value)}>
                <option value="">— Select deity —</option>
                {COMMON_DEITIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div className="aff-row">
            <div className="aff-field">
              <label className="aff-label">Festival Type</label>
              <select className="aff-select" value={form.type} onChange={e => set('type', e.target.value)}>
                {FESTIVAL_TYPES.map(t => <option key={t} value={t}>{t || '— Select type —'}</option>)}
              </select>
            </div>
            <div className="aff-field">
              <label className="aff-label">Duration (days)</label>
              <input
                type="number" min="1" max="30"
                className="aff-input"
                value={form.duration_days}
                onChange={e => set('duration_days', e.target.value)}
              />
            </div>
          </div>

          <div className="aff-field" style={{ marginBottom:18 }}>
            <label className="aff-label">Significance / Short Description</label>
            <input
              className="aff-input"
              placeholder="e.g. Night of Lord Shiva, fasting and all-night vigil"
              value={form.significance}
              onChange={e => set('significance', e.target.value)}
            />
            <span className="aff-hint">Shown on the festival card in the calendar</span>
          </div>

          <div className="aff-field">
            <label className="aff-label">Detailed Description</label>
            <textarea
              className="aff-textarea"
              placeholder="Describe the festival, its rituals, customs, and how it is celebrated at this temple…"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
        </div>

        {/* ── Card 3: Timing ── */}
        <div className="aff-card">
          <div className="aff-card-title">📅 Timing</div>

          <div className="aff-row">
            <div className="aff-field">
              <label className="aff-label">Gregorian Month <span className="req">*</span></label>
              <select
                className={`aff-select${errors.month ? ' error' : ''}`}
                value={form.month}
                onChange={e => set('month', e.target.value)}
              >
                <option value="">— Select month —</option>
                {GREGORIAN_MONTHS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              {errors.month && <span className="aff-err-msg">⚠ {errors.month}</span>}
            </div>
            <div className="aff-field">
              <label className="aff-label">Hindu Month</label>
              <select
                className="aff-select"
                value={form.hindu_month}
                onChange={e => set('hindu_month', e.target.value)}
              >
                <option value="">— Select Hindu month —</option>
                {HINDU_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <span className="aff-hint">Auto-filled when you pick the Gregorian month</span>
            </div>
          </div>
        </div>

        {/* ── Card 4: Emoji + flags ── */}
        <div className="aff-card">
          <div className="aff-card-title">🎨 Display & Flags</div>

          <div className="aff-field" style={{ marginBottom:20 }}>
            <label className="aff-label">Festival Emoji</label>
            <div className="aff-emoji-grid">
              {FESTIVAL_EMOJIS.map(e => (
                <button
                  key={e}
                  type="button"
                  className={`aff-emoji-btn${form.emoji === e ? ' selected' : ''}`}
                  onClick={() => set('emoji', e)}
                  title={e}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div
            className={`aff-toggle-row${form.is_major ? ' checked' : ''}`}
            onClick={() => set('is_major', !form.is_major)}
          >
            <div className="aff-toggle-label">
              <strong>⭐ Major Festival</strong>
              Mark this as a major/significant festival (shown with star badge)
            </div>
            <div className={`aff-toggle-switch${form.is_major ? ' on' : ''}`} />
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="aff-actions">
          <button className="aff-btn-secondary" onClick={() => navigate('/festivals')}>
            ← Back to Calendar
          </button>
          <button
            className="aff-btn-primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting
              ? <><span className="aff-spin">⟳</span> Saving…</>
              : '🪔 Save Festival'}
          </button>
        </div>

      </div>

      <Footer />
    </>
  );
}