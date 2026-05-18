import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const API_BASE   = import.meta.env.VITE_API_URL  || 'http://localhost:8000';
const ADMIN_KEY  = import.meta.env.VITE_ADMIN_SECRET_KEY || '';

// ── Constants (schema-aligned) ─────────────────────────────────────────────────
// data_source enum from schema
const DATA_SOURCES = [
  { value: 'manual',        label: '✍️  Manual entry' },
  { value: 'ai_enriched',   label: '✨ AI-enriched' },
  { value: 'wikipedia',     label: '📖 Wikipedia' },
  { value: 'wikidata',      label: '🔗 Wikidata' },
  { value: 'google_places', label: '📍 Google Places' },
  { value: 'openstreetmap', label: '🗺️  OpenStreetMap' },
  { value: 'government',    label: '🏛️  Government' },
  { value: 'partnership',   label: '🤝 Partnership' },
  { value: 'csv_import',    label: '📁 CSV Import' },
];

const GREGORIAN_MONTHS = [
  { value: 1,  label: 'January' },  { value: 2,  label: 'February' },
  { value: 3,  label: 'March' },    { value: 4,  label: 'April' },
  { value: 5,  label: 'May' },      { value: 6,  label: 'June' },
  { value: 7,  label: 'July' },     { value: 8,  label: 'August' },
  { value: 9,  label: 'September' },{ value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const HINDU_MONTHS = [
  'Chaitra','Vaishakha','Jyeshtha','Ashadha',
  'Shravana','Bhadrapada','Ashwin','Kartika',
  'Margashirsha','Pausha','Magha','Phalguna',
];

function emptyForm() {
  return {
    temple_id:    '',
    name:         '',
    description:  '',
    significance: '',
    month:        '',
    hindu_month:  '',
    typical_date: '',
    duration_days:'1',
    is_major:     false,
    source:       'manual',
    ai_generated: false,
  };
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,400&family=Noto+Sans+Devanagari:wght@400;600&display=swap');

  :root {
    --s:#E8650A; --sl:#F5934A; --sd:#B84D00;
    --gold:#C8960C; --gold-l:#F0C040;
    --cream:#FDF8F0; --cream-d:#F0E6D0;
    --brown:#3D1F00; --brown-m:#6B3A10;
    --green:#16a34a; --red:#dc2626;
    --text:#1A0A00; --text-m:#4A2800; --text-l:#8B6040;
    --sh:rgba(61,31,0,.12); --sh-d:rgba(61,31,0,.28);
    --fd:'Cinzel',serif; --fb:'Crimson Pro',serif; --fh:'Noto Sans Devanagari',sans-serif;
    --r:12px; --rl:20px; --tr:.3s cubic-bezier(.4,0,.2,1);
  }
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:var(--fb);background:var(--cream);color:var(--text);}
  a{text-decoration:none;color:inherit;}

  /* hero */
  .hero{position:relative;background:linear-gradient(160deg,#1A0A00 0%,#3D1F00 35%,#6B3A10 65%,#B84D00 100%);padding:52px 24px 64px;text-align:center;overflow:hidden;}
  .hero-bg{position:absolute;inset:0;pointer-events:none;}
  .fl{position:absolute;font-size:clamp(18px,3vw,40px);opacity:.1;animation:floatUp 7s ease-in-out infinite;}
  .fl:nth-child(1){top:12%;left:6%;animation-delay:0s;}
  .fl:nth-child(2){top:55%;left:12%;animation-delay:1.4s;}
  .fl:nth-child(3){top:18%;right:8%;animation-delay:.7s;}
  .fl:nth-child(4){bottom:18%;right:5%;animation-delay:2.1s;}
  @keyframes floatUp{0%,100%{transform:translateY(0) rotate(-4deg);opacity:.1;}50%{transform:translateY(-14px) rotate(4deg);opacity:.2;}}
  .hero-inner{position:relative;z-index:1;}
  .badge{display:inline-flex;align-items:center;gap:8px;background:rgba(200,150,12,.18);border:1px solid rgba(240,192,64,.35);backdrop-filter:blur(8px);color:var(--gold-l);padding:5px 18px;border-radius:50px;font-family:var(--fd);font-size:11px;letter-spacing:.14em;margin-bottom:14px;}
  .hero-title{font-family:var(--fd);font-weight:900;font-size:clamp(26px,5vw,48px);color:#fff;line-height:1.1;margin-bottom:8px;text-shadow:0 2px 20px rgba(0,0,0,.4);}
  .hero-title span{color:var(--gold-l);}
  .hero-sub{font-family:var(--fh);font-size:14px;color:rgba(255,255,255,.65);}

  /* breadcrumb */
  .bc{background:#fff;border-bottom:1px solid var(--cream-d);padding:12px 24px;}
  .bc-inner{max-width:860px;margin:0 auto;display:flex;align-items:center;gap:8px;font-family:var(--fd);font-size:12px;letter-spacing:.04em;color:var(--text-l);}
  .bc-inner a{color:var(--s);}
  .bc-inner a:hover{text-decoration:underline;}

  /* main */
  .main{max-width:860px;margin:0 auto;padding:32px 24px 80px;}

  /* card */
  .card{background:#fff;border:1.5px solid var(--cream-d);border-radius:var(--rl);padding:26px 30px;margin-bottom:18px;position:relative;overflow:hidden;}
  .card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--s),var(--gold));}
  .card-title{font-family:var(--fd);font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--s);margin-bottom:20px;display:flex;align-items:center;gap:10px;}
  .card-title::after{content:'';flex:1;height:1px;background:var(--cream-d);}

  /* grid */
  .row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;}
  .full{grid-column:1/-1;}

  /* field */
  .field{display:flex;flex-direction:column;gap:6px;}
  .lbl{font-family:var(--fd);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-l);}
  .lbl .req{color:var(--s);margin-left:2px;}
  .inp,.sel,.ta{width:100%;padding:10px 14px;border:2px solid var(--cream-d);border-radius:var(--r);font-family:var(--fb);font-size:15px;color:var(--text);background:var(--cream);outline:none;transition:var(--tr);}
  .inp:focus,.sel:focus,.ta:focus{border-color:var(--s);background:#fff;box-shadow:0 0 0 3px rgba(232,101,10,.1);}
  .inp.err,.sel.err{border-color:var(--red);}
  .ta{resize:vertical;min-height:90px;line-height:1.6;}
  .sel{appearance:none;cursor:pointer;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23B84D00' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center;padding-right:36px;}
  .hint{font-size:12px;color:var(--text-l);margin-top:2px;}
  .err-msg{font-size:12px;color:var(--red);margin-top:2px;}

  /* toggle */
  .toggle{display:flex;align-items:center;justify-content:space-between;background:var(--cream);border:1.5px solid var(--cream-d);border-radius:var(--r);padding:12px 16px;cursor:pointer;transition:var(--tr);}
  .toggle:hover{border-color:var(--sl);}
  .toggle.on{border-color:var(--s);background:rgba(232,101,10,.05);}
  .toggle-lbl{font-family:var(--fb);font-size:14px;color:var(--text-m);}
  .toggle-lbl strong{font-family:var(--fd);font-size:12px;display:block;color:var(--brown);}
  .sw{width:40px;height:22px;border-radius:50px;background:var(--cream-d);position:relative;transition:var(--tr);flex-shrink:0;}
  .sw.on{background:var(--s);}
  .sw::after{content:'';position:absolute;width:16px;height:16px;border-radius:50%;background:#fff;top:3px;left:3px;transition:var(--tr);box-shadow:0 1px 4px rgba(0,0,0,.2);}
  .sw.on::after{left:21px;}

  /* temple search */
  .t-wrap{position:relative;}
  .t-results{position:absolute;top:100%;left:0;right:0;z-index:50;background:#fff;border:2px solid var(--cream-d);border-top:none;border-radius:0 0 var(--r) var(--r);max-height:210px;overflow-y:auto;box-shadow:0 8px 24px var(--sh);}
  .t-opt{padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--cream-d);transition:var(--tr);}
  .t-opt:last-child{border-bottom:none;}
  .t-opt:hover{background:var(--cream);}
  .t-opt-name{font-family:var(--fb);font-size:14px;color:var(--text);}
  .t-opt-city{font-family:var(--fh);font-size:12px;color:var(--text-l);}
  .t-sel{display:flex;align-items:center;justify-content:space-between;background:rgba(232,101,10,.07);border:2px solid var(--s);border-radius:var(--r);padding:10px 14px;}
  .t-sel-name{font-family:var(--fb);font-size:15px;color:var(--text);}
  .t-sel-city{font-family:var(--fh);font-size:12px;color:var(--s);}
  .t-clr{background:none;border:none;cursor:pointer;color:var(--text-l);font-size:18px;padding:2px 6px;border-radius:6px;transition:var(--tr);}
  .t-clr:hover{color:var(--red);background:rgba(220,38,38,.07);}

  /* preview */
  .preview{background:linear-gradient(135deg,#1A0A00,#3D1F00);border-radius:var(--rl);padding:22px;color:#fff;margin-bottom:18px;position:relative;overflow:hidden;}
  .preview-lbl{font-family:var(--fd);font-size:10px;letter-spacing:.16em;color:rgba(255,255,255,.4);margin-bottom:14px;}
  .preview-inner{display:flex;align-items:center;gap:14px;}
  .preview-icon{width:60px;height:60px;border-radius:var(--r);background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;border:1px solid rgba(255,255,255,.12);}
  .preview-info{flex:1;min-width:0;}
  .preview-name{font-family:var(--fd);font-size:17px;font-weight:700;color:#fff;margin-bottom:4px;}
  .preview-meta{display:flex;gap:7px;margin-top:7px;flex-wrap:wrap;}
  .pbadge{font-size:11px;padding:2px 10px;border-radius:50px;border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.7);font-family:var(--fd);letter-spacing:.04em;}
  .pbadge.major{border-color:var(--gold);color:var(--gold-l);}

  /* seed card */
  .seed-card{background:linear-gradient(135deg,rgba(124,58,237,.08),rgba(232,101,10,.06));border:1.5px solid rgba(124,58,237,.2);border-radius:var(--rl);padding:22px 26px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
  .seed-info h3{font-family:var(--fd);font-size:14px;color:#5B21B6;margin-bottom:4px;}
  .seed-info p{font-family:var(--fb);font-size:14px;color:var(--text-l);}
  .seed-status{font-size:13px;color:var(--green);font-family:var(--fb);margin-top:6px;}
  .seed-status.error{color:var(--red);}

  /* actions */
  .actions{display:flex;align-items:center;justify-content:space-between;gap:14px;padding-top:6px;}
  .btn-p{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,var(--s),var(--sd));color:#fff;padding:12px 30px;border:none;border-radius:50px;font-family:var(--fd);font-size:13px;letter-spacing:.06em;cursor:pointer;transition:var(--tr);box-shadow:0 4px 15px rgba(232,101,10,.35);}
  .btn-p:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 8px 25px rgba(232,101,10,.45);}
  .btn-p:disabled{opacity:.6;cursor:not-allowed;}
  .btn-s{display:inline-flex;align-items:center;gap:8px;background:#fff;color:var(--text-m);padding:11px 22px;border:2px solid var(--cream-d);border-radius:50px;font-family:var(--fd);font-size:13px;letter-spacing:.05em;cursor:pointer;transition:var(--tr);}
  .btn-s:hover{border-color:var(--s);color:var(--s);}
  .btn-purple{background:linear-gradient(135deg,#7C3AED,#5B21B6);color:#fff;padding:11px 22px;border:none;border-radius:50px;font-family:var(--fd);font-size:12px;letter-spacing:.05em;cursor:pointer;transition:var(--tr);display:inline-flex;align-items:center;gap:7px;}
  .btn-purple:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 20px rgba(124,58,237,.4);}
  .btn-purple:disabled{opacity:.6;cursor:not-allowed;}
  .spin{display:inline-block;animation:spin .7s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}

  /* error banner */
  .err-banner{background:#fef2f2;border:1.5px solid #fca5a5;border-radius:var(--r);padding:13px 17px;color:var(--red);font-family:var(--fb);font-size:14px;margin-bottom:18px;display:flex;align-items:center;gap:10px;}

  /* result */
  .result-wrap{min-height:60vh;display:flex;align-items:center;justify-content:center;padding:60px 24px;}
  .result-card{background:#fff;border-radius:var(--rl);border:1.5px solid var(--cream-d);padding:46px 38px;text-align:center;max-width:420px;box-shadow:0 12px 40px var(--sh);}
  .result-icon{font-size:60px;margin-bottom:10px;}
  .result-card h2{font-family:var(--fd);font-size:22px;color:var(--brown);margin-bottom:8px;}
  .result-card p{color:var(--text-l);font-size:15px;margin-bottom:26px;}
  .result-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}

  @media(max-width:620px){
    .row{grid-template-columns:1fr;}
    .card{padding:18px 16px;}
    .actions{flex-direction:column-reverse;}
    .btn-p,.btn-s{width:100%;justify-content:center;}
  }
`;

// ── Component ──────────────────────────────────────────────────────────────────
export default function AdminAddFestivalPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm]             = useState(() => {
    const f = emptyForm();
    f.temple_id = searchParams.get('temple_id') || '';
    return f;
  });
  const [errors, setErrors]         = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState(null);
  const [apiError, setApiError]     = useState('');

  // temple search
  const [tQuery, setTQuery]       = useState('');
  const [tResults, setTResults]   = useState([]);
  const [tSeleted, setTSelected]  = useState(null);
  const [tSearching, setTSearching] = useState(false);

  // seed state
  const [seeding, setSeeding]         = useState(false);
  const [seedMsg, setSeedMsg]         = useState('');
  const [seedError, setSeedError]     = useState('');

  // pre-load temple if passed in URL
  useEffect(() => {
    const tid = searchParams.get('temple_id');
    if (tid) {
      fetch(`${API_BASE}/api/temples/${tid}`)
        .then(r => r.json())
        .then(d => { if (d.id) setTSelected(d); })
        .catch(() => {});
    }
  }, []);

  // auto-fill hindu_month
  useEffect(() => {
    if (form.month) {
      const idx = Number(form.month) % 12;
      set('hindu_month', HINDU_MONTHS[idx] || '');
    }
  }, [form.month]);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  };

  // ── temple search ──
  const searchTemples = async (q) => {
    setTQuery(q);
    if (q.length < 2) { setTResults([]); return; }
    setTSearching(true);
    try {
      const r = await fetch(`${API_BASE}/api/temples/search?q=${encodeURIComponent(q)}&limit=8`);
      const d = await r.json();
      setTResults(Array.isArray(d) ? d : d.temples || []);
    } catch { setTResults([]); }
    finally { setTSearching(false); }
  };

  const pickTemple = (t) => {
    setTSelected(t);
    setForm(f => ({ ...f, temple_id: String(t.id) }));
    setTQuery(''); setTResults([]);
    setErrors(e => { const n = { ...e }; delete n.temple_id; return n; });
  };

  const clearTemple = () => {
    setTSelected(null);
    setForm(f => ({ ...f, temple_id: '' }));
  };

  // ── validate ──
  const validate = () => {
    const e = {};
    if (!form.temple_id)      e.temple_id = 'Please select a temple';
    if (!form.name.trim())    e.name      = 'Festival name is required';
    if (!form.month)          e.month     = 'Month is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── submit manual add ──
  const handleSubmit = async () => {
    setApiError('');
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload = {
        temple_id:    Number(form.temple_id),
        name:         form.name.trim(),
        description:  form.description.trim() || null,
        significance: form.significance.trim() || null,
        month:        Number(form.month),
        hindu_month:  form.hindu_month.trim() || null,
        typical_date: form.typical_date.trim() || null,
        duration_days: Number(form.duration_days) || 1,
        is_major:     form.is_major,
        source:       form.source || 'manual',
        ai_generated: form.ai_generated,
      };

      const res = await fetch(`${API_BASE}/api/admin/festivals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Server error');

      setResult({ name: form.name, templeSlug: tSeleted?.slug });
    } catch (err) {
      setApiError(err.message || 'Failed to save. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── seed via Claude (server-side, waits for result) ──
  const handleSeed = async () => {
    if (!form.temple_id) { setErrors({ temple_id: 'Select a temple first' }); return; }
    setSeeding(true); setSeedMsg(''); setSeedError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/festivals/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Key': ADMIN_KEY },
        body: JSON.stringify({ temple_id: Number(form.temple_id), force: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Seed error');

      if (data.status === 'error') {
        setSeedError(`Claude error: ${data.error}`);
      } else if (data.status === 'skipped') {
        setSeedMsg(data.message);
      } else {
        // success
        const names = (data.inserted_names || []).slice(0, 5).join(', ');
        const more  = (data.inserted_names || []).length > 5
          ? ` …and ${data.inserted_names.length - 5} more` : '';
        setSeedMsg(
          `✅ ${data.inserted_count} festivals saved to DB!` +
          (names ? ` (${names}${more})` : '') +
          ` Skipped duplicates: ${data.skipped}`
        );
      }
    } catch (err) {
      setSeedError(err.message || 'Seed failed — check backend terminal for details');
    } finally {
      setSeeding(false);
    }
  };

  const resetForm = () => {
    setForm(emptyForm()); setResult(null); setErrors({});
    setApiError(''); setTSelected(null); setSeedMsg(''); setSeedError('');
  };

  // ── Result screen ──
  if (result) {
    return (
      <>
        <style>{CSS}</style>
        <Navbar />
        <div className="result-wrap">
          <div className="result-card">
            <div className="result-icon">🪔</div>
            <h2>Festival Added!</h2>
            <p><strong>{result.name}</strong> has been saved to the temple calendar.</p>
            <div className="result-btns">
              <Link to="/festivals" className="btn-p" style={{ textDecoration:'none' }}>🗓️ View Calendar</Link>
              {result.templeSlug && (
                <Link to={`/temple/${result.templeSlug}`} className="btn-s" style={{ textDecoration:'none' }}>🛕 View Temple</Link>
              )}
              <button className="btn-s" onClick={resetForm}>＋ Add Another</button>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // ── Month for preview label ──
  const monthLabel = GREGORIAN_MONTHS.find(m => m.value === Number(form.month))?.label || '';

  return (
    <>
      <style>{CSS}</style>
      <Navbar />

      {/* Hero */}
      <div className="hero">
        <div className="hero-bg">
          {['🪔','✨','🌸','🔱'].map((e, i) => <div key={i} className="fl">{e}</div>)}
        </div>
        <div className="hero-inner">
          <div className="badge">⚙️ ADMIN PANEL</div>
          <h1 className="hero-title">Add <span>Festival</span></h1>
          <p className="hero-sub">पर्व और उत्सव — Add a sacred festival to BharatMandir</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bc">
        <div className="bc-inner">
          <Link to="/">Home</Link><span>›</span>
          <Link to="/festivals">Festivals</Link><span>›</span>
          <span>Add Festival</span>
        </div>
      </div>

      <div className="main">

        {/* ── Live Preview ── */}
        <div className="preview">
          <div className="preview-lbl">LIVE PREVIEW</div>
          <div className="preview-inner">
            <div className="preview-icon">🪔</div>
            <div className="preview-info">
              <div className="preview-name">{form.name || 'Festival Name'}</div>
              <div style={{ fontFamily:'var(--fh)', fontSize:13, color:'rgba(255,255,255,.6)', marginBottom:2 }}>
                {tSeleted ? `🛕 ${tSeleted.name}` : '🛕 Temple'}
                {tSeleted?.primary_deity ? ` · ${tSeleted.primary_deity}` : ''}
              </div>
              <div className="preview-meta">
                {form.is_major && <span className="pbadge major">⭐ Major Festival</span>}
                {monthLabel && <span className="pbadge">{monthLabel}</span>}
                {form.hindu_month && <span className="pbadge">{form.hindu_month}</span>}
                {Number(form.duration_days) > 1 && <span className="pbadge">{form.duration_days} days</span>}
                {form.typical_date && <span className="pbadge">📅 {form.typical_date}</span>}
                <span className="pbadge" style={{ borderColor:'rgba(124,58,237,.5)', color:'#C4B5FD' }}>
                  {DATA_SOURCES.find(s => s.value === form.source)?.label || 'manual'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── AI Seed Card ── */}
        <div className="seed-card">
          <div className="seed-info">
            <h3>✨ Auto-generate with Claude AI</h3>
            <p>Let Claude generate festivals for the selected temple and save them directly to the database.</p>
            {seedMsg && <div className="seed-status">✅ {seedMsg}</div>}
            {seedError && <div className="seed-status error">⚠️ {seedError}</div>}
          </div>
          <button className="btn-purple" onClick={handleSeed} disabled={seeding || !form.temple_id}>
            {seeding ? <><span className="spin">⟳</span> Seeding…</> : '✨ Seed Festivals'}
          </button>
        </div>

        {apiError && <div className="err-banner">⚠️ {apiError}</div>}

        {/* ── Card 1: Temple ── */}
        <div className="card">
          <div className="card-title">🛕 Select Temple</div>
          <div className="field">
            <label className="lbl">Temple <span className="req">*</span></label>
            {tSeleted ? (
              <div className="t-sel">
                <div>
                  <div className="t-sel-name">{tSeleted.name}</div>
                  <div className="t-sel-city">{tSeleted.city}, {tSeleted.state} · ID #{tSeleted.id}</div>
                </div>
                <button className="t-clr" onClick={clearTemple}>✕</button>
              </div>
            ) : (
              <div className="t-wrap">
                <input
                  className={`inp${errors.temple_id ? ' err' : ''}`}
                  placeholder="Search temple by name…"
                  value={tQuery}
                  onChange={e => searchTemples(e.target.value)}
                  autoComplete="off"
                />
                {tSearching && (
                  <div className="t-results" style={{ padding:'12px 14px', color:'var(--text-l)', fontSize:13 }}>Searching…</div>
                )}
                {tResults.length > 0 && (
                  <div className="t-results">
                    {tResults.map(t => (
                      <div key={t.id} className="t-opt" onClick={() => pickTemple(t)}>
                        <div className="t-opt-name">{t.name}</div>
                        <div className="t-opt-city">{t.city}, {t.state}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {errors.temple_id && <span className="err-msg">⚠ {errors.temple_id}</span>}
            <span className="hint">
              Or enter ID directly:{' '}
              <input
                style={{ width:80, padding:'3px 8px', border:'1.5px solid var(--cream-d)', borderRadius:8, fontFamily:'var(--fb)', fontSize:13, background:'var(--cream)' }}
                placeholder="e.g. 42"
                value={tSeleted ? '' : form.temple_id}
                onChange={e => { setForm(f => ({...f, temple_id: e.target.value})); setTSelected(null); }}
              />
            </span>
          </div>
        </div>

        {/* ── Card 2: Basic Info ── */}
        <div className="card">
          <div className="card-title">📋 Festival Details</div>

          <div className="row">
            <div className="field">
              <label className="lbl">Festival Name <span className="req">*</span></label>
              <input
                className={`inp${errors.name ? ' err' : ''}`}
                placeholder="e.g. Maha Shivaratri"
                value={form.name}
                onChange={e => set('name', e.target.value)}
              />
              {errors.name && <span className="err-msg">⚠ {errors.name}</span>}
            </div>
            <div className="field">
              <label className="lbl">Duration (days)</label>
              <input
                type="number" min="1" max="30"
                className="inp"
                value={form.duration_days}
                onChange={e => set('duration_days', e.target.value)}
              />
            </div>
          </div>

          <div className="row full" style={{ marginBottom:16 }}>
            <div className="field full">
              <label className="lbl">Significance</label>
              <input
                className="inp"
                placeholder="e.g. Night of Lord Shiva, fasting and all-night vigil"
                value={form.significance}
                onChange={e => set('significance', e.target.value)}
              />
              <span className="hint">Short line shown on festival card</span>
            </div>
          </div>

          <div className="field" style={{ marginBottom:0 }}>
            <label className="lbl">Detailed Description</label>
            <textarea
              className="ta"
              placeholder="Describe the festival, its rituals, customs, and how it is celebrated at this temple…"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
        </div>

        {/* ── Card 3: Timing ── */}
        <div className="card">
          <div className="card-title">📅 Timing</div>
          <div className="row">
            <div className="field">
              <label className="lbl">Gregorian Month <span className="req">*</span></label>
              <select
                className={`sel${errors.month ? ' err' : ''}`}
                value={form.month}
                onChange={e => set('month', e.target.value)}
              >
                <option value="">— Select month —</option>
                {GREGORIAN_MONTHS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              {errors.month && <span className="err-msg">⚠ {errors.month}</span>}
            </div>
            <div className="field">
              <label className="lbl">Hindu Month</label>
              <select className="sel" value={form.hindu_month} onChange={e => set('hindu_month', e.target.value)}>
                <option value="">— Select Hindu month —</option>
                {HINDU_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <span className="hint">Auto-filled from Gregorian month</span>
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label className="lbl">Typical Date</label>
              <input
                className="inp"
                placeholder="e.g. 14 January or Late February"
                value={form.typical_date}
                onChange={e => set('typical_date', e.target.value)}
              />
              <span className="hint">Stored as text — use for display</span>
            </div>
          </div>
        </div>

        {/* ── Card 4: Source & Flags ── */}
        <div className="card">
          <div className="card-title">⚙️ Source & Flags</div>

          <div className="row" style={{ marginBottom:16 }}>
            <div className="field">
              <label className="lbl">Data Source</label>
              <select className="sel" value={form.source} onChange={e => set('source', e.target.value)}>
                {DATA_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <span className="hint">Matches DB data_source enum</span>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div
              className={`toggle${form.is_major ? ' on' : ''}`}
              onClick={() => set('is_major', !form.is_major)}
            >
              <div className="toggle-lbl">
                <strong>⭐ Major Festival</strong>
                Mark as nationally celebrated (shows star badge)
              </div>
              <div className={`sw${form.is_major ? ' on' : ''}`} />
            </div>

            <div
              className={`toggle${form.ai_generated ? ' on' : ''}`}
              onClick={() => set('ai_generated', !form.ai_generated)}
            >
              <div className="toggle-lbl">
                <strong>✨ AI Generated</strong>
                Flag that this entry was produced by an AI model
              </div>
              <div className={`sw${form.ai_generated ? ' on' : ''}`} />
            </div>
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="actions">
          <button className="btn-s" onClick={() => navigate('/festivals')}>← Back to Calendar</button>
          <button className="btn-p" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <><span className="spin">⟳</span> Saving…</> : '🪔 Save Festival'}
          </button>
        </div>

      </div>
      <Footer />
    </>
  );
}