import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Loader2, Music2, RefreshCw, Trash2, UploadCloud } from 'lucide-react';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const CATEGORIES = ['bhajan', 'kirtan', 'chalisa', 'mantra', 'aarti', 'other'];

function adminHeaders() {
  const token = sessionStorage.getItem('bm_access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, { ...options, headers: { ...adminHeaders(), ...(options.headers || {}) } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "We couldn't complete this request right now. Please try again in a few moments.");
  }
  return response.json();
}

const inputStyle = { width: '100%', boxSizing: 'border-box', padding: '11px 13px', border: '1px solid #dfc9a8', borderRadius: 9, background: '#fffdf8', color: '#40210f', fontSize: 14 };
const labelStyle = { display: 'block', marginBottom: 6, color: '#6f4729', fontWeight: 700, fontSize: 13 };

export default function AdminLibraryPage() {
  const [tab, setTab] = useState('books');
  const [books, setBooks] = useState([]);
  const [audio, setAudio] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [bookForm, setBookForm] = useState({ title: '', author: '', description: '', source_language: 'Hindi', file: null });
  const [audioForm, setAudioForm] = useState({ title: '', artist: '', description: '', category: 'bhajan', language: 'Hindi', audio_file: null });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bookData, audioData] = await Promise.all([api('/api/admin/books'), api('/api/admin/library-audio')]);
      setBooks(bookData.books || []);
      setAudio(audioData.audio || []);
      setError('');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const uploadBook = async (event) => {
    event.preventDefault();
    if (!bookForm.file) return setError('Please choose a PDF before uploading.');
    setBusy(true); setError(''); setMessage('');
    const form = new FormData();
    Object.entries(bookForm).forEach(([key, value]) => value && form.append(key, value));
    try {
      await api('/api/admin/books', { method: 'POST', body: form });
      setBookForm({ title: '', author: '', description: '', source_language: 'Hindi', file: null });
      setMessage('The book has been accepted and its sacred pages are now being prepared.');
      load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const uploadAudio = async (event) => {
    event.preventDefault();
    if (!audioForm.audio_file) return setError('Please choose an audio file before uploading.');
    setBusy(true); setError(''); setMessage('');
    const form = new FormData();
    Object.entries(audioForm).forEach(([key, value]) => value && form.append(key, value));
    try {
      await api('/api/admin/library-audio', { method: 'POST', body: form });
      setAudioForm({ title: '', artist: '', description: '', category: 'bhajan', language: 'Hindi', audio_file: null });
      setMessage('The devotional audio has been safely added to the library.');
      load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const toggleAudio = async (item) => {
    try { await api(`/api/admin/library-audio/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_published: !item.is_published }) }); load(); }
    catch (err) { setError(err.message); }
  };
  const removeAudio = async (item) => {
    if (!window.confirm(`Remove “${item.title}” from the audio library?`)) return;
    try { await api(`/api/admin/library-audio/${item.id}`, { method: 'DELETE' }); setMessage('The audio recording has been removed from the library.'); load(); }
    catch (err) { setError(err.message); }
  };
  const removeBook = async (item) => {
    if (!window.confirm(`Remove “${item.title}” from the book library?`)) return;
    try { await api(`/api/admin/books/${item.id}`, { method: 'DELETE' }); load(); }
    catch (err) { setError(err.message); }
  };

  const update = (setForm, key) => (event) => setForm(form => ({ ...form, [key]: event.target.type === 'file' ? event.target.files?.[0] || null : event.target.value }));
  const isBooks = tab === 'books';

  return <main style={{ maxWidth: 1120, margin: '0 auto', padding: '34px 20px 70px', color: '#40210f' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 26 }}>
      <div><p style={{ color: '#a05a21', fontWeight: 700, margin: 0 }}>ADMIN LIBRARY</p><h1 style={{ margin: '5px 0 0', fontFamily: 'var(--font-display)', fontSize: 32 }}>Sacred library publishing</h1></div>
      <button onClick={load} disabled={loading} style={{ border: '1px solid #dfc9a8', background: '#fffaf0', borderRadius: 99, padding: '10px 16px', display: 'inline-flex', gap: 7, alignItems: 'center', cursor: 'pointer', color: '#704324' }}><RefreshCw size={16} /> Refresh</button>
    </div>
    <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #e5d4b9', marginBottom: 24 }}>
      <button onClick={() => setTab('books')} style={tabStyle(isBooks)}><BookOpen size={17} /> Books</button>
      <button onClick={() => setTab('audio')} style={tabStyle(!isBooks)}><Music2 size={17} /> Bhajans & kirtans</button>
    </div>
    {error && <Notice color="#9e2d18">{error}</Notice>}
    {message && <Notice color="#2b6e3b">{message}</Notice>}
    {isBooks ? <>
      <UploadPanel title="Add a book PDF" onSubmit={uploadBook} busy={busy} submit="Upload and translate">
        <Field label="Book title *"><input required value={bookForm.title} onChange={update(setBookForm, 'title')} style={inputStyle} /></Field>
        <Field label="Author / source"><input value={bookForm.author} onChange={update(setBookForm, 'author')} style={inputStyle} /></Field>
        <Field label="Original language"><select value={bookForm.source_language} onChange={update(setBookForm, 'source_language')} style={inputStyle}><option>Hindi</option><option>Sanskrit</option><option>English</option></select></Field>
        <Field label="PDF file *"><input required type="file" accept="application/pdf,.pdf" onChange={update(setBookForm, 'file')} style={inputStyle} /></Field>
        <Field label="Description" full><textarea value={bookForm.description} onChange={update(setBookForm, 'description')} style={{ ...inputStyle, minHeight: 75 }} /></Field>
      </UploadPanel>
      <BookList books={books} loading={loading} onRemove={removeBook} />
    </> : <>
      <UploadPanel title="Add devotional audio" onSubmit={uploadAudio} busy={busy} submit="Add audio to library">
        <Field label="Title *"><input required value={audioForm.title} onChange={update(setAudioForm, 'title')} style={inputStyle} placeholder="e.g. Hanuman Chalisa" /></Field>
        <Field label="Singer / artist"><input value={audioForm.artist} onChange={update(setAudioForm, 'artist')} style={inputStyle} /></Field>
        <Field label="Type"><select value={audioForm.category} onChange={update(setAudioForm, 'category')} style={inputStyle}>{CATEGORIES.map(category => <option key={category} value={category}>{category[0].toUpperCase() + category.slice(1)}</option>)}</select></Field>
        <Field label="Language"><input value={audioForm.language} onChange={update(setAudioForm, 'language')} style={inputStyle} placeholder="Hindi, Sanskrit..." /></Field>
        <Field label="Audio file *"><input required type="file" accept="audio/*,.m4a,.aac,.ogg,.flac,.webm" onChange={update(setAudioForm, 'audio_file')} style={inputStyle} /></Field>
        <Field label="Description" full><textarea value={audioForm.description} onChange={update(setAudioForm, 'description')} style={{ ...inputStyle, minHeight: 75 }} /></Field>
      </UploadPanel>
      <AudioList audio={audio} loading={loading} onToggle={toggleAudio} onRemove={removeAudio} />
    </>}
  </main>;
}

function tabStyle(active) { return { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 16px', border: 0, borderBottom: active ? '3px solid #d66213' : '3px solid transparent', background: 'transparent', color: active ? '#8d3d12' : '#806450', fontWeight: 700, cursor: 'pointer' }; }
function Notice({ color, children }) { return <div style={{ padding: '12px 15px', borderRadius: 10, color, background: `${color}12`, border: `1px solid ${color}40`, marginBottom: 18 }}>{children}</div>; }
function Field({ label, children, full }) { return <label style={{ gridColumn: full ? '1 / -1' : undefined, display: 'block' }}><span style={labelStyle}>{label}</span>{children}</label>; }
function UploadPanel({ title, onSubmit, busy, submit, children }) { return <form onSubmit={onSubmit} style={{ background: '#fff', border: '1px solid #e5d4b9', borderRadius: 16, padding: 22, marginBottom: 30, boxShadow: '0 8px 24px #5c270b0c' }}><h2 style={{ fontFamily: 'var(--font-display)', margin: '0 0 18px', fontSize: 22 }}>{title}</h2><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>{children}</div><button disabled={busy} style={{ marginTop: 20, border: 0, borderRadius: 99, background: busy ? '#c8b9a1' : 'linear-gradient(135deg,#e87513,#ae4508)', color: '#fff', padding: '12px 20px', cursor: busy ? 'wait' : 'pointer', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>{busy ? <Loader2 className="spin" size={17} /> : <UploadCloud size={17} />}{busy ? 'Preparing your upload…' : submit}</button></form>; }
function BookList({ books, loading, onRemove }) { return <section><h2 style={{ fontFamily: 'var(--font-display)' }}>Library books</h2>{loading ? <p>Arranging the library…</p> : books.length === 0 ? <p>No books have been uploaded yet.</p> : <div style={{ display: 'grid', gap: 10 }}>{books.map(book => <div key={book.id} style={rowStyle}><BookOpen color="#9b511d" /><div style={{ flex: 1 }}><b>{book.title}</b><div style={small}>{book.author || 'Sacred text'} · {book.status} · {book.processed_pages || 0}/{book.page_count || 0} pages</div></div><button onClick={() => onRemove(book)} style={deleteStyle}><Trash2 size={16} /></button></div>)}</div>}</section>; }
function AudioList({ audio, loading, onToggle, onRemove }) { return <section><h2 style={{ fontFamily: 'var(--font-display)' }}>Devotional audio</h2>{loading ? <p>Arranging the devotional recordings…</p> : audio.length === 0 ? <p>No audio has been uploaded yet.</p> : <div style={{ display: 'grid', gap: 12 }}>{audio.map(item => <div key={item.id} style={rowStyle}><Music2 color="#9b511d" /><div style={{ flex: 1, minWidth: 180 }}><b>{item.title}</b><div style={small}>{item.artist || 'Devotional recording'} · {item.category} · stored on {item.storage_provider}</div><audio controls preload="metadata" src={item.audio_url} style={{ width: '100%', marginTop: 8 }} /></div><button onClick={() => onToggle(item)} style={publishStyle(item.is_published)}>{item.is_published ? 'Published' : 'Hidden'}</button><button onClick={() => onRemove(item)} style={deleteStyle}><Trash2 size={16} /></button></div>)}</div>}</section>; }
const rowStyle = { display: 'flex', alignItems: 'flex-start', gap: 13, padding: 15, background: '#fffdf8', border: '1px solid #e5d4b9', borderRadius: 12, flexWrap: 'wrap' };
const small = { fontSize: 12, color: '#806450', marginTop: 4 };
const deleteStyle = { border: 0, background: 'transparent', color: '#b72e18', cursor: 'pointer', padding: 7 };
const publishStyle = (published) => ({ border: `1px solid ${published ? '#6aaa70' : '#dfc9a8'}`, background: published ? '#edfaef' : '#fff', color: published ? '#25723a' : '#806450', borderRadius: 99, padding: '7px 10px', fontWeight: 700, cursor: 'pointer' });
