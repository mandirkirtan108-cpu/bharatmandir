/**
 * AdminAddBlogPage.jsx — BharatMandir Admin: Create Blog Posts
 * FIXED: Hero banner height matched to Admin Panel header (padding: 36px 24px 28px)
 * Fields: title, submitted_by, description
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

  /*
   * Hero — matches AdminPanelPage header exactly:
   *   background gradient, padding 36px 24px 28px, no floating icons, no big title.
   *   We keep a subtle sub-label + title but at the same visual weight.
   */
  .hero{
    background:linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%);
    padding:36px 24px 28px;
  }
  .hero-inner{
    max-width:860px;
    margin:0 auto;
  }
  .hero-eyebrow{
    display:inline-flex;align-items:center;gap:8px;
    background:rgba(255,255,255,.08);border:1px solid rgba(255,213,128,.25);
    color:rgba(255,213,128,.8);padding:3px 14px;border-radius:50px;
    font-family:var(--fd);font-size:10px;letter-spacing:.14em;
    margin-bottom:10px;text-transform:uppercase;
  }
  .hero-title{
    font-family:var(--fd);font-weight:700;font-size:24px;
    color:#fff;line-height:1.15;margin-bottom:4px;
    letter-spacing:.02em;
  }
  .hero-title span{color:#FFD580;}
  .hero-sub{
    font-family:var(--fh);font-size:13px;
    color:rgba(255,255,255,.6);margin:0;
  }

  .bc{background:#fff;border-bottom:1px solid var(--cream-d);padding:11px 24px;}
  .bc-inner{max-width:860px;margin:0 auto;display:flex;align-items:center;gap:8px;font-family:var(--fd);font-size:11px;letter-spacing:.04em;color:var(--text-l);}
  .bc-inner a{color:var(--s);}
  .bc-inner a:hover{text-decoration:underline;}

  .main{max-width:860px;margin:0 auto;padding:28px 24px 80px;}

  .card{background:#fff;border:1.5px solid var(--cream-d);border-radius:var(--rl);padding:24px 28px;margin-bottom:16px;position:relative;overflow:hidden;}
  .card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--s),var(--gold));}
  .card-title{font-family:var(--fd);font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--s);margin-bottom:18px;display:flex;align-items:center;gap:10px;}
  .card-title::after{content:'';flex:1;height:1px;background:var(--cream-d);}

  .field{display:flex;flex-direction:column;gap:5px;margin-bottom:14px;}
  .lbl{font-family:var(--fd);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-l);}
  .lbl .req{color:var(--s);margin-left:2px;}
  .inp,.ta{width:100%;padding:10px 14px;border:2px solid var(--cream-d);border-radius:var(--r);font-family:var(--fb);font-size:15px;color:var(--text);background:var(--cream);outline:none;transition:var(--tr);}
  .inp:focus,.ta:focus{border-color:var(--s);background:#fff;box-shadow:0 0 0 3px rgba(232,101,10,.1);}
  .inp.err,.ta.err{border-color:var(--red);}
  .ta{resize:vertical;min-height:180px;line-height:1.7;}
  .hint{font-size:12px;color:var(--text-l);margin-top:2px;}
  .err-msg{font-size:12px;color:var(--red);margin-top:2px;}
  .char-count{font-size:11px;color:var(--text-l);text-align:right;margin-top:3px;}

  .btn-row{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px;}

  .btn-submit{
    display:inline-flex;align-items:center;gap:8px;
    padding:11px 28px;border:none;border-radius:50px;
    background:linear-gradient(135deg,var(--s),var(--sd));
    color:#fff;font-family:var(--fd);font-size:11px;letter-spacing:.1em;
    font-weight:700;cursor:pointer;text-transform:uppercase;
    box-shadow:0 3px 14px rgba(232,101,10,.3);transition:var(--tr);
  }
  .btn-submit:hover{transform:translateY(-1px);box-shadow:0 6px 22px rgba(232,101,10,.45);}
  .btn-submit:disabled{opacity:.55;cursor:not-allowed;transform:none;}

  .btn-secondary{
    display:inline-flex;align-items:center;gap:8px;
    padding:11px 20px;border:2px solid var(--cream-d);border-radius:50px;
    background:#fff;color:var(--text-m);font-family:var(--fd);font-size:11px;
    letter-spacing:.08em;font-weight:600;cursor:pointer;text-transform:uppercase;transition:var(--tr);
  }
  .btn-secondary:hover{border-color:var(--s);color:var(--s);}

  .toast{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:50px;font-family:var(--fd);font-size:11px;letter-spacing:.08em;font-weight:700;z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,.22);animation:slideUp .35s ease;text-transform:uppercase;}
  .toast-ok{background:var(--green);color:#fff;}
  .toast-err{background:var(--red);color:#fff;}
  @keyframes slideUp{from{opacity:0;transform:translate(-50%,20px);}to{opacity:1;transform:translate(-50%,0);}}

  .preview-box{background:var(--cream);border:1.5px dashed var(--cream-d);border-radius:var(--r);padding:18px 20px;white-space:pre-wrap;font-family:var(--fb);font-size:15px;line-height:1.75;color:var(--text-m);min-height:72px;}
  .preview-label{font-family:var(--fd);font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-l);margin-bottom:8px;}

  .spin-icon{display:inline-block;width:13px;height:13px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg);}}

  .preview-toggle{
    background:none;border:1.5px solid var(--cream-d);border-radius:8px;
    padding:6px 14px;cursor:pointer;font-family:var(--fd);
    font-size:10px;letter-spacing:.07em;color:var(--text-l);
    text-transform:uppercase;transition:border-color .2s;
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

      {/* ── Hero — compact, same visual weight as Admin Panel header ── */}
      <div className="hero">
        <div className="hero-inner">
          <div className="hero-eyebrow">Admin · Blog Management</div>
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
              style={{ minHeight: 240 }}
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
            style={{ marginBottom: showPreview ? 12 : 0 }}
          >
            {showPreview ? '▲ Hide Preview' : '▼ Show Preview'}
          </button>

          {showPreview && (
            <div style={{ marginTop: 12 }}>
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