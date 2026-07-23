import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { libraryAdminAPI, libraryAPI } from '../../services/api';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'sa', label: 'Sanskrit' },
];

const emptyForm = {
  title: '', subtitle: '', author: '', original_language: 'en',
  description: '', category_id: '', pdf_file: null, cover_image: null,
};

export default function AdminLibraryManagement() {
  const [books, setBooks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [uploading, setUploading] = useState(false);

  const [translatingId, setTranslatingId] = useState(null);
  const [translateLangs, setTranslateLangs] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: bookList }, { data: cats }] = await Promise.all([
        libraryAdminAPI.listBooks(),
        libraryAPI.getCategories(),
      ]);
      setBooks(bookList);
      setCategories(cats);
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll while any book is still extracting/translating, so status
  // updates without the admin needing to refresh manually.
  useEffect(() => {
    const active = books.some(
      (b) => b.extraction_status === 'pending' || b.extraction_status === 'processing'
    );
    if (!active) return;
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [books, load]);

  const updateField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.title.trim() || !form.pdf_file) {
      setError('Title and PDF file are required.');
      return;
    }

    const formData = new FormData();
    formData.append('title', form.title);
    if (form.subtitle) formData.append('subtitle', form.subtitle);
    if (form.author) formData.append('author', form.author);
    formData.append('original_language', form.original_language);
    if (form.description) formData.append('description', form.description);
    if (form.category_id) formData.append('category_id', form.category_id);
    formData.append('pdf_file', form.pdf_file);
    if (form.cover_image) formData.append('cover_image', form.cover_image);

    setUploading(true);
    try {
      await libraryAdminAPI.createBook(formData);
      setSuccess('Book uploaded — text extraction is running in the background.');
      resetForm();
      load();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    } finally {
      setUploading(false);
    }
  };

  const togglePublish = async (book) => {
    try {
      await libraryAdminAPI.updateBook(book.id, { is_published: !book.is_published });
      load();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const handleDelete = async (book) => {
    if (!window.confirm(`Delete "${book.title}"? This cannot be undone.`)) return;
    try {
      await libraryAdminAPI.deleteBook(book.id);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const openTranslate = (book) => {
    setTranslatingId(book.id);
    setTranslateLangs([]);
  };

  const submitTranslate = async (book) => {
    if (translateLangs.length === 0) return;
    try {
      await libraryAdminAPI.triggerTranslation(book.id, translateLangs);
      setSuccess(`Translation queued for ${translateLangs.join(', ')}.`);
      setTranslatingId(null);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
    }
  };

  const inputStyle = {
    width: '100%', padding: '10px 14px', border: '2px solid var(--cream-dark)',
    borderRadius: 10, fontFamily: 'var(--font-body)', fontSize: 14,
    background: 'white', color: 'var(--text-dark)', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle = { fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '.04em', color: 'var(--text-light)', marginBottom: 6, display: 'block' };

  return (
    <div>
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '10px 16px', borderRadius: 10, marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', padding: '10px 16px', borderRadius: 10, marginBottom: 16, fontSize: 14 }}>
          {success}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, margin: 0 }}>Sacred Books</h3>
        <button
          onClick={() => setShowForm((s) => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 50, border: 'none',
            background: 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))',
            color: 'white', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <UploadCloud size={16} /> {showForm ? 'Cancel' : 'Add Book'}
        </button>
      </div>

      {/* ── Add Book form ── */}
      {showForm && (
        <form
          onSubmit={handleUpload}
          style={{
            background: 'white', border: '1.5px solid var(--cream-dark)', borderRadius: 16,
            padding: 24, marginBottom: 28, display: 'grid', gap: 16,
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          <div>
            <label style={labelStyle}>Title *</label>
            <input style={inputStyle} value={form.title} onChange={(e) => updateField('title', e.target.value)} required />
          </div>
          <div>
            <label style={labelStyle}>Subtitle</label>
            <input style={inputStyle} value={form.subtitle} onChange={(e) => updateField('subtitle', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Author</label>
            <input style={inputStyle} value={form.author} onChange={(e) => updateField('author', e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Original Language</label>
            <select style={inputStyle} value={form.original_language} onChange={(e) => updateField('original_language', e.target.value)}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Category</label>
            <select style={inputStyle} value={form.category_id} onChange={(e) => updateField('category_id', e.target.value)}>
              <option value="">— None —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{ ...inputStyle, minHeight: 70, resize: 'vertical' }}
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>PDF File *</label>
            <input
              style={inputStyle} type="file" accept="application/pdf" required
              onChange={(e) => updateField('pdf_file', e.target.files[0])}
            />
          </div>
          <div>
            <label style={labelStyle}>Cover Image</label>
            <input
              style={inputStyle} type="file" accept="image/*"
              onChange={(e) => updateField('cover_image', e.target.files[0])}
            />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <button
              type="submit"
              disabled={uploading}
              style={{
                padding: '12px 28px', borderRadius: 50, border: 'none',
                background: uploading ? 'var(--cream-dark)' : 'linear-gradient(135deg, var(--saffron), var(--saffron-dark))',
                color: uploading ? 'var(--text-light)' : 'white',
                fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
                cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {uploading ? <Loader2 size={16} className="spin" /> : <UploadCloud size={16} />}
              {uploading ? 'Uploading...' : 'Upload Book'}
            </button>
          </div>
        </form>
      )}

      {/* ── Book list ── */}
      {loading ? (
        <p style={{ color: 'var(--text-light)' }}>Loading books...</p>
      ) : books.length === 0 ? (
        <p style={{ color: 'var(--text-light)' }}>No books uploaded yet.</p>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {books.map((book) => (
            <div
              key={book.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                background: 'white', border: '1.5px solid var(--cream-dark)',
                borderRadius: 14, padding: '14px 18px', flexWrap: 'wrap',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(160deg, #8b5a2b, #5c3a1e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                {book.cover_image_url
                  ? <img src={book.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <BookOpen size={18} color="#f5e9d8" />}
              </div>

              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{book.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
                  {book.author || 'Unknown author'} · {book.category_name || 'Uncategorized'}
                </div>
              </div>

              <StatusPill status={book.extraction_status} pageCount={book.page_count} />

              <button
                onClick={() => togglePublish(book)}
                disabled={book.extraction_status !== 'completed'}
                style={{
                  padding: '6px 14px', borderRadius: 50, fontSize: 12, fontWeight: 700,
                  border: '1.5px solid ' + (book.is_published ? '#16a34a' : 'var(--cream-dark)'),
                  background: book.is_published ? '#f0fdf4' : 'white',
                  color: book.is_published ? '#166534' : 'var(--text-light)',
                  cursor: book.extraction_status !== 'completed' ? 'not-allowed' : 'pointer',
                  opacity: book.extraction_status !== 'completed' ? 0.5 : 1,
                }}
              >
                {book.is_published ? 'Published' : 'Draft'}
              </button>

              {translatingId === book.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {LANGUAGES.filter((l) => l.code !== book.original_language).map((l) => (
                    <label key={l.code} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input
                        type="checkbox"
                        checked={translateLangs.includes(l.code)}
                        onChange={(e) => setTranslateLangs((cur) =>
                          e.target.checked ? [...cur, l.code] : cur.filter((c) => c !== l.code)
                        )}
                      />
                      {l.label}
                    </label>
                  ))}
                  <button onClick={() => submitTranslate(book)} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, border: 'none', background: 'var(--saffron)', color: 'white', cursor: 'pointer' }}>
                    Go
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => openTranslate(book)}
                  disabled={book.extraction_status !== 'completed'}
                  style={{
                    padding: '6px 14px', borderRadius: 50, fontSize: 12, fontWeight: 700,
                    border: '1.5px solid var(--cream-dark)', background: 'white', color: 'var(--text-dark)',
                    cursor: book.extraction_status !== 'completed' ? 'not-allowed' : 'pointer',
                    opacity: book.extraction_status !== 'completed' ? 0.5 : 1,
                  }}
                >
                  Translate
                </button>
              )}

              <button onClick={() => handleDelete(book)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#dc2626' }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status, pageCount }) {
  const colors = {
    pending: { bg: '#fef9c3', text: '#854d0e' },
    processing: { bg: '#dbeafe', text: '#1e40af' },
    completed: { bg: '#f0fdf4', text: '#166534' },
    failed: { bg: '#fef2f2', text: '#b91c1c' },
  };
  const c = colors[status] || colors.pending;
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 50 }}>
      {status === 'processing' && <Loader2 size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: '-2px' }} className="spin" />}
      {status.toUpperCase()}{status === 'completed' && pageCount ? ` · ${pageCount}p` : ''}
    </span>
  );
}