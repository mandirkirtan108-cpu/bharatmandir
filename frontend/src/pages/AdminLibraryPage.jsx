import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, FileUp, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const auth = () => ({ Authorization: `Bearer ${sessionStorage.getItem('bm_access_token') || ''}` });

export default function AdminLibraryPage() {
  const [books, setBooks] = useState([]);
  const [form, setForm] = useState({ title: '', author: '', description: '', source_language: 'Hindi' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const res = await fetch(`${API_BASE}/api/admin/books`, { headers: auth() });
    if (res.ok) setBooks((await res.json()).books || []);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!books.some(b => b.status === 'processing')) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [books, load]);

  const submit = async e => {
    e.preventDefault();
    if (!file) return setMessage('Please select a PDF.');
    setBusy(true); setMessage('');
    const data = new FormData();
    Object.entries(form).forEach(([key, value]) => data.append(key, value));
    data.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/api/admin/books`, { method: 'POST', headers: auth(), body: data });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = Array.isArray(body.detail)
          ? body.detail.map(item => item.msg || JSON.stringify(item)).join(', ')
          : body.detail;
        throw new Error(detail || `Upload failed (HTTP ${res.status})`);
      }
      setMessage('PDF uploaded. Full translations are now processing.');
      setForm({ title: '', author: '', description: '', source_language: 'Hindi' });
      setFile(null);
      document.getElementById('book-pdf').value = '';
      load();
    } catch (err) {
      setMessage(
        err instanceof TypeError
          ? 'The backend could not be reached. Check the Railway deployment and CORS configuration.'
          : err.message
      );
    } finally { setBusy(false); }
  };

  const remove = async book => {
    if (!window.confirm(`Remove "${book.title}" from the library?`)) return;
    await fetch(`${API_BASE}/api/admin/books/${book.id}`, { method: 'DELETE', headers: auth() });
    load();
  };

  const retry = async book => {
    setMessage('');
    const res = await fetch(`${API_BASE}/api/admin/books/${book.id}/retry`, {
      method: 'POST', headers: auth(),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return setMessage(body.detail || 'Retry failed');
    setMessage(`Retrying "${book.title}".`);
    load();
  };

  return <>
    <Navbar />
    <main className="admin-library">
      <section className="library-admin-head">
        <div className="library-admin-head-inner">
          <Link to="/admin/panel" className="library-back-link"><ArrowLeft size={15}/> Admin panel</Link>
          <div className="library-admin-badge"><BookOpen size={13}/> Library</div>
          <h1><BookOpen/> Library publishing</h1>
          <p>Upload one text PDF and create complete Sanskrit, Hindi, and English reading editions.</p>
        </div>
      </section>
      <div className="admin-library-grid">
        <form className="upload-card" onSubmit={submit}>
          <h2>Add a book PDF</h2>
          <label>Book title<input required value={form.title} onChange={e => setForm({...form,title:e.target.value})}/></label>
          <label>Author / source<input value={form.author} onChange={e => setForm({...form,author:e.target.value})}/></label>
          <label>Original language<input required value={form.source_language} onChange={e => setForm({...form,source_language:e.target.value})} placeholder="e.g. Hindi, Sanskrit, Bengali"/></label>
          <label>Description<textarea rows="4" value={form.description} onChange={e => setForm({...form,description:e.target.value})}/></label>
          <label className="drop"><FileUp size={30}/><strong>Choose text-based PDF</strong><span>Maximum 200 MB. Scanned PDFs require OCR first.</span><input id="book-pdf" type="file" accept=".pdf,application/pdf" onChange={e => setFile(e.target.files[0])}/>{file && <em>{file.name}</em>}</label>
          <button disabled={busy}>{busy ? <><Loader2 className="spin"/> Uploading…</> : 'Upload and translate'}</button>
          {message && <p className="message">{message}</p>}
        </form>
        <section className="processing-card">
          <h2>Library books</h2>
          {books.length === 0 && <p>No uploaded books.</p>}
          {books.map(book => <div className="admin-book" key={book.id}>
            <div><strong>{book.title}</strong><small>{book.original_filename}</small>
              {book.status === 'processing' && book.page_count > 0 && <small className="progress-copy">
                Translated {book.processed_pages || 0} of {book.page_count} pages
              </small>}
            </div>
            <span className={`status ${book.status}`}>{book.status === 'processing' && <Loader2 className="spin"/>}{book.status}</span>
            {book.status === 'failed' && <button title="Retry translation" onClick={() => retry(book)}><RefreshCw size={17}/></button>}
            <button title="Remove" onClick={() => remove(book)}><Trash2 size={17}/></button>
            {book.processing_error && <p className="failure">{book.processing_error}</p>}
          </div>)}
        </section>
      </div>
    </main>
    <style>{`
      .admin-library{min-height:100vh;background:#faf5ed;padding-bottom:70px}
      .library-admin-head{background:linear-gradient(135deg, #3D1F00 0%, #572207 55%, #7a3208 100%);padding:48px 20px;display:flex;align-items:center;justify-content:center;text-align:center;box-sizing:border-box}
      .library-admin-head-inner{max-width:720px;margin:0 auto;display:flex;flex-direction:column;align-items:center}
      .library-back-link{align-self:flex-start;color:#ffd59d;text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;margin-bottom:18px}
      .library-admin-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,213,128,0.3);border-radius:50px;padding:5px 16px;margin-bottom:14px;color:#FFD580;font-size:11px;letter-spacing:.1em;text-transform:uppercase;font-weight:600}
      .library-admin-head h1{display:flex;gap:10px;align-items:center;justify-content:center;margin:0;font-family:var(--font-display);font-weight:900;font-size:clamp(26px,4.5vw,42px);color:white;line-height:1.15}
      .library-admin-head p{margin:12px auto 0;color:rgba(255,255,255,0.72);font-size:15px;line-height:1.7;max-width:520px}
      .admin-library-grid{max-width:1100px;margin:30px auto;display:grid;grid-template-columns:minmax(320px,440px) 1fr;gap:25px;padding:0 20px}
      .upload-card,.processing-card{background:white;border:1px solid #e6d8c9;border-radius:17px;padding:25px;box-shadow:0 5px 25px #64280a0c}
      .upload-card h2,.processing-card h2{margin-top:0}
      .upload-card label{font-size:13px;font-weight:700;display:block;margin:14px 0}
      .upload-card input,.upload-card textarea{display:block;width:100%;box-sizing:border-box;border:1px solid #d9c7b5;border-radius:9px;padding:10px;margin-top:6px;font:inherit}
      .drop{text-align:center!important;border:2px dashed #cda986;border-radius:12px;padding:20px!important;color:#7e4b2c}
      .drop>*{display:block;margin:4px auto}
      .drop span{font-weight:400;font-size:12px}
      .drop input{border:0}
      .drop em{font-weight:400}
      .upload-card>button{width:100%;display:flex;justify-content:center;gap:8px;border:0;border-radius:10px;padding:12px;background:#9b4515;color:white;font-weight:800;cursor:pointer}
      .admin-book{display:grid;grid-template-columns:1fr auto auto auto;gap:12px;align-items:center;border-bottom:1px solid #eee2d5;padding:15px 0}
      .admin-book small{display:block;color:#947c69;margin-top:5px}
      .admin-book .progress-copy{color:#9b570d;font-weight:700}
      .admin-book button{border:0;background:#fff1ed;color:#a52a1a;padding:8px;border-radius:8px;cursor:pointer}
      .status{display:flex;align-items:center;gap:5px;border-radius:99px;padding:5px 10px;font-size:11px;text-transform:uppercase}
      .status.ready{background:#e9f8ed;color:#176b31}
      .status.processing{background:#fff4d7;color:#8d5a00}
      .status.failed{background:#ffeded;color:#a11}
      .failure{grid-column:1/-1;color:#a11;font-size:12px}
      .message{font-size:13px;color:#80400f}
      .spin{animation:spin 1s linear infinite}
      @keyframes spin{to{transform:rotate(360deg)}}
      @media(max-width:800px){.admin-library-grid{grid-template-columns:1fr}}
    `}</style>
  </>;
}