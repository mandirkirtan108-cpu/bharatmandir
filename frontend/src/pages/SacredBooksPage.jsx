import { useEffect, useMemo, useState } from 'react';
import { BookOpen, FileText, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { fetchBooks } from '../services/sacredBooksApi';

export default function SacredBooksPage() {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBooks().then(r => setBooks(r.books || [])).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? books.filter(b => `${b.title} ${b.author || ''} ${b.description || ''}`.toLowerCase().includes(q)) : books;
  }, [books, query]);

  return <>
    <Navbar />
    <main className="library">
      <section className="library-hero">
        <div className="library-badge"><BookOpen size={16} /> Digital scripture library</div>
        <h1>Read sacred texts in your language</h1>
        <p>Faithful, page-preserving editions in Sanskrit, Hindi, English, and the original text.</p>
      </section>
      <section className="library-content">
        <label className="library-search"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search books, authors, or subjects" /></label>
        {loading && <div className="library-state">Loading the library…</div>}
        {error && <div className="library-state error">{error}</div>}
        {!loading && !error && visible.length === 0 && <div className="library-state">No books have been published yet.</div>}
        <div className="book-grid">
          {visible.map(book => <article className="book-card" key={book.id} onClick={() => navigate(`/sacred-books/library/${book.slug}`)}>
            <div className="book-cover"><FileText size={38} /><span>{book.page_count} pages</span></div>
            <div className="book-info">
              <h2>{book.title}</h2>
              <p className="book-author">{book.author || 'Traditional text'}</p>
              <p>{book.description || 'Available in three complete translations and the original edition.'}</p>
              <button>Open book <span>→</span></button>
            </div>
          </article>)}
        </div>
<<<<<<< HEAD

        {/* ── Folder Grid ── */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', fontSize: 22 }}>
              {t('books.library')}
            </h2>
            <input
              placeholder={t('books.filter_placeholder')}
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{
                padding: '9px 16px', borderRadius: 99, border: '2px solid var(--cream-dark)',
                background: 'white', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', width: 260,
              }}
            />
          </div>

          {loading ? <Spinner /> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
              {visibleCategories.map(cat => {
                const catBooks = grouped[cat.key];
                if (filter && catBooks.length === 0 &&
                    !cat.label.toLowerCase().includes(filter.toLowerCase())) return null;
                return (
                  <div
                    key={cat.key}
                    onClick={() => navigate(`/library/${cat.key}`)}
                    style={{
                      background: '#fffdf9', border: '1px solid #e8ddd0', borderRadius: 14,
                      overflow: 'hidden', cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                      boxShadow: '0 1px 4px rgba(90,50,20,0.07)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 28px rgba(90,50,20,0.13)';
                      e.currentTarget.style.borderColor = '#c2824a';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 1px 4px rgba(90,50,20,0.07)';
                      e.currentTarget.style.borderColor = '#e8ddd0';
                    }}
                  >
                    <div style={{
                      background: 'linear-gradient(135deg, #5c2208 0%, #8b3a15 100%)',
                      padding: '18px', display: 'flex', alignItems: 'center', gap: 14,
                    }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: 12,
                        background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,213,128,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 26,
                      }}>
                        {cat.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{
                          fontFamily: 'var(--font-display)', color: '#ffffff', fontSize: 17, fontWeight: 700,
                          margin: 0, marginBottom: 2,
                        }}>{t(`books.categories.${cat.key}.label`, { defaultValue: cat.label })}</h3>
                        <div style={{ fontFamily: 'var(--font-hindi)', fontSize: 13, color: 'rgba(255,213,128,0.8)' }}>
                          {cat.sanskrit}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '15px 18px 18px' }}>
                      <p style={{ fontSize: 13, color: '#6b5744', lineHeight: 1.72, marginBottom: 13, marginTop: 0 }}>
                        {t(`books.categories.${cat.key}.description`, { defaultValue: cat.description })}
                      </p>
                      <div style={{ height: 1, background: '#eee5d9', marginBottom: 13 }} />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#8b3a15' }}>
                          {t('books.open_folder')} ›
                        </span>
                        <span style={{
                          fontSize: 10, color: '#a07860', background: '#f4ede4',
                          padding: '2px 8px', borderRadius: 99, border: '1px solid #e2d0be',
                        }}>
                          {loading ? '…' : t('books.count', { count: catBooks.length })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <Footer />
      <SacredBooksGlobalStyle />
    </>
  );
}
=======
      </section>
    </main>
    <Footer />
    <style>{`
      .library{min-height:100vh;background:#fbf7ef;color:#432516}.library-hero{text-align:center;padding:68px 20px;background:radial-gradient(circle at top,#9a4d1d,#542008);color:white}.library-hero h1{font-family:var(--font-display);font-size:clamp(34px,5vw,58px);margin:14px 0 10px}.library-hero p{opacity:.82;font-size:16px}.library-badge{display:inline-flex;gap:8px;align-items:center;padding:7px 14px;border:1px solid #e9b979;border-radius:99px;color:#ffd79e}.library-content{max-width:1120px;margin:auto;padding:36px 20px 70px}.library-search{max-width:540px;margin:0 auto 32px;background:white;border:1px solid #dcc7b4;border-radius:14px;padding:13px 16px;display:flex;gap:10px;align-items:center}.library-search input{border:0;outline:0;width:100%;font-size:15px;background:transparent}.book-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:22px}.book-card{background:white;border:1px solid #eaded1;border-radius:18px;overflow:hidden;cursor:pointer;box-shadow:0 4px 18px #5c270b0d;transition:.2s}.book-card:hover{transform:translateY(-4px);box-shadow:0 14px 30px #5c270b20}.book-cover{height:145px;background:linear-gradient(145deg,#642509,#a34e18);color:#ffe1b5;display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center}.book-cover span{font-size:12px;letter-spacing:.08em;text-transform:uppercase}.book-info{padding:20px}.book-info h2{margin:0 0 5px;font-family:var(--font-display);font-size:22px}.book-info p{color:#775e4c;line-height:1.6;font-size:13px}.book-author{color:#a14a0b!important;font-weight:700}.book-info button{border:0;background:none;color:#8b3a15;font-weight:800;padding:8px 0;cursor:pointer}.library-state{text-align:center;padding:50px;color:#806957}.library-state.error{color:#a11}
    `}</style>
  </>;
}
>>>>>>> a345d8b6159ba7de186164d610ec1652749449eb
