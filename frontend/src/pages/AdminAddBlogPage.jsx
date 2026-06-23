/**
 * AdminAddBlogPage.jsx — BharatMandir Admin: Create / Edit Blog Posts
 * Fields: title, submitted_by, description (rich text)
 * POST  /api/admin/blogs
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar  from '../components/Navbar';
import Footer  from '../components/Footer';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function getAuthHeaders() {
  const token = sessionStorage.getItem('bm_access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function emptyForm() {
  return { title: '', submitted_by: '', description: '' };
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

  /* Hero — compact, matching library page height */
  .hero{
    position:relative;
    background:linear-gradient(135deg,#4b1d04 0%,#7a3208 55%,#a14a0b 100%);
    padding:50px 12px;
    text-align:center;overflow:hidden;
  }
  .hero-bg{position:absolute;inset:0;pointer-events:none;}
  .fl{position:absolute;font-size:clamp(18px,3vw,40px);opacity:.08;animation:floatUp 7s ease-in-out infinite;}
  .fl:nth-child(1){top:12%;left:6%;animation-delay:0s;}
  .fl:nth-child(2){top:55%;left:12%;animation-delay:1.4s;}
  .fl:nth-child(3){top:18%;right:8%;animation-delay:.7s;}
  .fl:nth-child(4){bottom:18%;right:5%;animation-delay:2.1s;}
  @keyframes floatUp{0%,100%{transform:translateY(0) rotate(-4deg);opacity:.08;}50%{transform:translateY(-14px) rotate(4deg);opacity:.16;}}
  .hero-inner{position:relative;z-index:1;}
  .badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.08);border:1px solid rgba(255,213,128,.3);backdrop-filter:blur(8px);color:rgba(255,213,128,.85);padding:5px 18px;border-radius:50px;font-family:var(--fd);font-size:11px;letter-spacing:.14em;margin-bottom:14px;text-transform:uppercase;font-weight:500;}
  .hero-title{font-family:var(--fd);font-weight:900;font-size:clamp(26px,5vw,48px);color:#fff;line-height:1.1;margin-bottom:8px;text-shadow:0 2px 20px rgba(0,0,0,.4);}
  .hero-title span{color:#FFD580;}
  .hero-sub{font-family:var(--fh);font-size:14px;color:rgba(255,255,255,.65);}

  .bc{background:#fff;border-bottom:1px solid var(--cream-d);padding:12px 24px;}
  .bc-inner{max-width:860px;margin:0 auto;display:flex;align-items:center;gap:8px;font-family:var(--fd);font-size:12px;letter-spacing:.04em;color:var(--text-l);}
  .bc-inner a{color:var(--s);}
  .bc-inner a:hover{text-decoration:underline;}

  .main{max-width:860px;margin:0 auto;padding:32px 24px 80px;}

  .card{background:#fff;border:1.5px solid var(--cream-d);border-radius:var(--rl);padding:26px 30px;margin-bottom:18px;position:relative;overflow:hidden;}
  .card::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--s),var(--gold));}
  .card-title{font-family:var(--fd);font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--s);margin-bottom:20px;display:flex;align-items:center;gap:10px;}
  .card-title::after{content:'';flex:1;height:1px;background:var(--cream-d);}

  .field{display:flex;flex-direction:column;gap:6px;margin-bottom:16px;}
  .lbl{font-family:var(--fd);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-l);}
  .lbl .req{color:var(--s);margin-left:2px;}
  .inp,.ta{width:100%;padding:10px 14px;border:2px solid var(--cream-d);border-radius:var(--r);font-family:var(--fb);font-size:15px;color:var(--text);background:var(--cream);outline:none;transition:var(--tr);}
  .inp:focus,.ta:focus{border-color:var(--s);background:#fff;box-shadow:0 0 0 3px rgba(232,101,10,.1);}
  .inp.err,.ta.err{border-color:var(--red);}
  .ta{resize:vertical;min-height:200px;line-height:1.7;}
  .hint{font-size:12px;color:var(--text-l);margin-top:2px;}
  .err-msg{font-size:12px;color:var(--red);margin-top:2px;}

  .char-count{font-size:11px;color:var(--text-l);text-align:right;margin-top:3px;}

  .btn-row{display:flex;gap:12px;flex-wrap:wrap;margin-top:24px;}

  /* Primary CTA — professional, no emoji */
  .btn-submit{
    display:inline-flex;align-items:center;gap:8px;
    padding:12px 32px;border:none;border-radius:50px;
    background:linear-gradient(135deg,var(--s),var(--sd));
    color:#fff;font-family:var(--fd);font-size:12px;letter-spacing:.1em;
    font-weight:700;cursor:pointer;text-transform:uppercase;
    box-shadow:0 3px 14px rgba(232,101,10,.35);transition:var(--tr);
  }
  .btn-submit:hover{transform:translateY(-1px);box-shadow:0 6px 22px rgba(232,101,10,.50);}
  .btn-submit:disabled{opacity:.55;cursor:not-allowed;transform:none;}

  .btn-secondary{
    display:inline-flex;align-items:center;gap:8px;
    padding:12px 22px;border:2px solid var(--cream-d);border-radius:50px;
    background:#fff;color:var(--text-m);font-family:var(--fd);font-size:12px;
    letter-spacing:.08em;font-weight:600;cursor:pointer;text-transform:uppercase;transition:var(--tr);
  }
  .btn-secondary:hover{border-color:var(--s);color:var(--s);}

  .toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:13px 26px;border-radius:50px;font-family:var(--fd);font-size:12px;letter-spacing:.08em;font-weight:700;z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,.22);animation:slideUp .35s ease;text-transform:uppercase;}
  .toast-ok{background:var(--green);color:#fff;}
  .toast-err{background:var(--red);color:#fff;}
  @keyframes slideUp{from{opacity:0;transform:translate(-50%,20px);}to{opacity:1;transform:translate(-50%,0);}}

  .preview-box{background:var(--cream);border:1.5px dashed var(--cream-d);border-radius:var(--r);padding:20px 22px;white-space:pre-wrap;font-family:var(--fb);font-size:15px;line-height:1.75;color:var(--text-m);min-height:80px;}
  .preview-label{font-family:var(--fd);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-l);margin-bottom:10px;}

  /* Spinner icon for saving state */
  .spin-icon{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}

  /* Preview toggle */
  .preview-toggle{
    background:none;border:1.5px solid var(--cream-d);border-radius:8px;
    padding:7px 16px;cursor:pointer;font-family:var(--fd);
    font-size:11px;letter-spacing:.07em;color:var(--text-l);
    text-transform:uppercase;margin-bottom:0;transition:border-color .2s;
  }
  .preview-toggle:hover{border-color:var(--s);color:var(--s);}
`;

export default function AdminAddBlogPage() {
  const navigate = useNavigate();
  const [form, setForm]       = useState(emptyForm());
  const [errors, setErrors]   = useState({});
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState(null);
  const [showPreview, setShowPreview] = useState(false);

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const set = (k) => (e) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors(er => ({ ...er, [k]: '' }));
  };

  function validate() {
    const e = {};
    if (!form.title.trim())        e.title        = 'Blog title is required.';
    if (!form.submitted_by.trim()) e.submitted_by = 'Author name is required.';
    if (!form.description.trim())  e.description  = 'Blog content is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/blogs`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title:        form.title.trim(),
          submitted_by: form.submitted_by.trim(),
          description:  form.description.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      showToast('Blog published successfully');
      setTimeout(() => navigate('/admin/panel'), 1600);
    } catch (err) {
      showToast(err.message, 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{CSS}</style>
      <Navbar />

      {/* ── Hero — compact, same height as Sacred Books hero ── */}
      <div className="hero">
        <div className="hero-bg">
          <span className="fl" style={{ fontSize: 32 }}>✍</span>
          <span className="fl" style={{ fontSize: 28 }}>📖</span>
          <span className="fl" style={{ fontSize: 24 }}>॥</span>
          <span className="fl" style={{ fontSize: 30 }}>ॐ</span>
        </div>
        <div className="hero-inner">
          <div className="badge">Admin · Blog Management</div>
          <h1 className="hero-title">Create <span>Blog Post</span></h1>
          <p className="hero-sub">Share spiritual wisdom, temple stories &amp; divine knowledge</p>
        </div>
      </div>

      {/* ── Breadcrumb ── */}
      <div className="bc">
        <div className="bc-inner">
          <Link to="/admin/panel">← Admin Panel</Link>
          <span style={{ opacity: .4 }}>›</span>
          <span>Add Blog</span>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="main">

        {/* Blog Info Card */}
        <div className="card">
          <div className="card-title">Blog Details</div>

          {/* Title */}
          <div className="field">
            <label className="lbl">Blog Title <span className="req">*</span></label>
            <input
              className={`inp${errors.title ? ' err' : ''}`}
              placeholder="e.g. The Significance of Maha Shivaratri"
              value={form.title}
              onChange={set('title')}
              maxLength={200}
            />
            <div className="char-count">{form.title.length}/200</div>
            {errors.title && <span className="err-msg">{errors.title}</span>}
          </div>

          {/* Submitted By */}
          <div className="field">
            <label className="lbl">Author Name <span className="req">*</span></label>
            <input
              className={`inp${errors.submitted_by ? ' err' : ''}`}
              placeholder="e.g. Pandit Rameswar Sharma"
              value={form.submitted_by}
              onChange={set('submitted_by')}
              maxLength={120}
            />
            {errors.submitted_by && <span className="err-msg">{errors.submitted_by}</span>}
            <span className="hint">Name that will appear on the published blog post.</span>
          </div>
        </div>

        {/* Description Card */}
        <div className="card">
          <div className="card-title">Blog Content</div>

          <div className="field">
            <label className="lbl">Description / Content <span className="req">*</span></label>
            <textarea
              className={`ta${errors.description ? ' err' : ''}`}
              placeholder="Write your blog content here… Share knowledge about temples, scriptures, festivals, spiritual practices, or divine stories."
              value={form.description}
              onChange={set('description')}
              rows={12}
              style={{ minHeight: 260 }}
            />
            <div className="char-count">{form.description.length} characters</div>
            {errors.description && <span className="err-msg">{errors.description}</span>}
            <span className="hint">Plain text. Line breaks will be preserved in the published post.</span>
          </div>

          {/* Preview toggle */}
          <button
            type="button"
            className="preview-toggle"
            onClick={() => setShowPreview(v => !v)}
            style={{ marginBottom: showPreview ? 14 : 0 }}
          >
            {showPreview ? '▲ Hide Preview' : '▼ Show Preview'}
          </button>

          {showPreview && (
            <div style={{ marginTop: 14 }}>
              <div className="preview-label">Preview</div>
              <div className="preview-box">
                {form.description || <span style={{ opacity: .4 }}>Nothing to preview yet…</span>}
              </div>
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="btn-row">
          <button
            className="btn-submit"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving
              ? <><span className="spin-icon" /> Publishing…</>
              : 'Publish Blog Post'}
          </button>

          <button
            className="btn-secondary"
            onClick={() => { setForm(emptyForm()); setErrors({}); setShowPreview(false); }}
            disabled={saving}
          >
            Clear Form
          </button>

          <Link
            to="/admin/panel"
            className="btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            Back to Panel
          </Link>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}

      <Footer />
    </>
  );
}