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
      </section>
    </main>
    <Footer />
    <style>{`
      .library{min-height:100vh;background:#fbf7ef;color:#432516}.library-hero{text-align:center;padding:68px 20px;background:radial-gradient(circle at top,#9a4d1d,#542008);color:white}.library-hero h1{font-family:var(--font-display);font-size:clamp(34px,5vw,58px);margin:14px 0 10px}.library-hero p{opacity:.82;font-size:16px}.library-badge{display:inline-flex;gap:8px;align-items:center;padding:7px 14px;border:1px solid #e9b979;border-radius:99px;color:#ffd79e}.library-content{max-width:1120px;margin:auto;padding:36px 20px 70px}.library-search{max-width:540px;margin:0 auto 32px;background:white;border:1px solid #dcc7b4;border-radius:14px;padding:13px 16px;display:flex;gap:10px;align-items:center}.library-search input{border:0;outline:0;width:100%;font-size:15px;background:transparent}.book-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:22px}.book-card{background:white;border:1px solid #eaded1;border-radius:18px;overflow:hidden;cursor:pointer;box-shadow:0 4px 18px #5c270b0d;transition:.2s}.book-card:hover{transform:translateY(-4px);box-shadow:0 14px 30px #5c270b20}.book-cover{height:145px;background:linear-gradient(145deg,#642509,#a34e18);color:#ffe1b5;display:flex;flex-direction:column;gap:10px;align-items:center;justify-content:center}.book-cover span{font-size:12px;letter-spacing:.08em;text-transform:uppercase}.book-info{padding:20px}.book-info h2{margin:0 0 5px;font-family:var(--font-display);font-size:22px}.book-info p{color:#775e4c;line-height:1.6;font-size:13px}.book-author{color:#a14a0b!important;font-weight:700}.book-info button{border:0;background:none;color:#8b3a15;font-weight:800;padding:8px 0;cursor:pointer}.library-state{text-align:center;padding:50px;color:#806957}.library-state.error{color:#a11}
    `}</style>
  </>;
}