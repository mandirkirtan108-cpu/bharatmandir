import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { fetchBooks } from '../services/sacredBooksApi';

// A handful of cover tones so the shelf doesn't look uniform — cycled by index.
const COVERS = [
  ['#4a1d0c', '#7a3208'],
  ['#1f3a2e', '#3c6650'],
  ['#3a2a12', '#6b4c1f'],
  ['#2c1a3a', '#5a3a72'],
  ['#5c1414', '#8f2a1f'],
];

function OmMark() {
  return (
    <svg viewBox="0 0 100 100" className="cover-mark" aria-hidden="true">
      <text x="50" y="66" textAnchor="middle" fontSize="60" fill="currentColor" fontFamily="var(--font-hindi), 'Noto Serif Devanagari', serif">ॐ</text>
    </svg>
  );
}

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
      <div className="library-glow" aria-hidden="true" />
      <section className="library-hero">
        <div className="library-badge"><BookOpen size={15} /> Digital scripture library</div>
        <h1>A quiet place to read the scriptures</h1>
        <p>Every page kept exactly as it was written — Sanskrit, Hindi, English, and the original, side by side. Open a book, not a webpage.</p>
        <div className="library-blessing">सुस्वागतम् — welcome, devotee</div>
      </section>

      <section className="library-content">
        <label className="library-search"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search books, authors, or subjects" /></label>

        {loading && <div className="library-state">Bringing the volumes to the table…</div>}
        {error && <div className="library-state error">{error}</div>}
        {!loading && !error && visible.length === 0 && <div className="library-state">No books have been published yet.</div>}

        <div className="shelf">
          {visible.map((book, i) => {
            const [dark, light] = COVERS[i % COVERS.length];
            return (
              <article
                className="book-card"
                key={book.id}
                style={{ '--cover-dark': dark, '--cover-light': light }}
                onClick={() => navigate(`/sacred-books/library/${book.slug}`)}
              >
                <div className="book-cover">
                  <OmMark />
                  <span className="cover-pages">{book.page_count} pages</span>
                </div>
                <div className="book-face">
                  <h2>{book.title}</h2>
                  <p className="book-author">{book.author || 'Traditional text'}</p>
                  <p className="book-desc">{book.description || 'Available in three complete translations and the original edition.'}</p>
                  <button>Open book <span>→</span></button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
    <Footer />
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Crimson+Pro:wght@400;500&family=EB+Garamond:wght@500;600&display=swap');

      .library{position:relative;min-height:100vh;overflow:hidden;background:linear-gradient(#1c0d05,#221207 260px,#f8f2e4 260px,#f8f2e4)}
      .library-glow{position:absolute;top:0;left:0;right:0;height:420px;pointer-events:none;background:radial-gradient(ellipse 900px 400px at 50% 0%,#ffdca330,transparent 70%)}

      .library-hero{position:relative;z-index:1;text-align:center;padding:76px 20px 54px;color:#f1dcb8;max-width:760px;margin:0 auto}
      .library-badge{display:inline-flex;gap:8px;align-items:center;padding:7px 16px;border:1px solid #c9932f60;border-radius:99px;color:#e9c795;font-family:'EB Garamond',serif;font-size:13px;letter-spacing:.05em}
      .library-hero h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;font-size:clamp(30px,4.6vw,50px);margin:20px 0 14px;
        background:linear-gradient(180deg,#f7e2ae,#c9932f);-webkit-background-clip:text;background-clip:text;color:transparent}
      .library-hero p{opacity:.85;font-size:16px;font-family:'Crimson Pro',serif;margin:0 auto}
      .library-blessing{margin-top:18px;font-family:var(--font-hindi,'Noto Serif Devanagari'),serif;font-size:15px;color:#e9c795cc;letter-spacing:.02em}

      .library-content{position:relative;z-index:1;max-width:1160px;margin:auto;padding:0 20px 80px}
      .library-search{
        max-width:520px;margin:-26px auto 44px;background:#fffaf0;border:1px solid #dcc7a4;border-radius:14px;
        padding:14px 18px;display:flex;gap:10px;align-items:center;box-shadow:0 12px 30px #5c270b25;color:#7a5230
      }
      .library-search input{border:0;outline:0;width:100%;font-size:15px;background:transparent;font-family:'Crimson Pro',serif;color:#432516}

      .shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:26px}
      .book-card{
        display:flex;flex-direction:column;background:#fffefb;border-radius:10px;overflow:hidden;cursor:pointer;
        box-shadow:0 10px 26px #5c270b1a;transition:transform .2s ease, box-shadow .2s ease;border:1px solid #e9dcc6;
      }
      .book-card:hover{transform:translateY(-5px);box-shadow:0 20px 40px #5c270b30}

      .book-cover{
        position:relative;height:132px;display:flex;align-items:center;justify-content:center;
        background:linear-gradient(135deg,var(--cover-light),var(--cover-dark));
        box-shadow:inset 0 -3px 10px #00000030;
      }
      .cover-mark{width:44px;height:44px;color:#f1e0b8cc}
      .cover-pages{position:absolute;bottom:10px;right:14px;font-family:'EB Garamond',serif;font-size:11px;letter-spacing:.08em;color:#f1e0b0b0}

      .book-face{padding:20px 22px 20px;flex:1;min-width:0;display:flex;flex-direction:column}
      .book-face h2{margin:0 0 4px;font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;font-size:22px;color:#3a2210;line-height:1.25}
      .book-author{color:#a14a0b!important;font-weight:600;font-family:'EB Garamond',serif;font-size:13px;margin:0 0 10px;letter-spacing:.02em}
      .book-desc{color:#775e4c;line-height:1.65;font-size:13.5px;font-family:'Crimson Pro',serif;margin:0 0 14px;flex:1}
      .book-face button{align-self:flex-start;border:0;background:none;color:#8b3a15;font-weight:700;padding:0;cursor:pointer;font-family:'EB Garamond',serif;font-size:14px;letter-spacing:.02em}

      .library-state{position:relative;z-index:1;text-align:center;padding:50px;color:#806957;font-family:'Crimson Pro',serif}
      .library-state.error{color:#a11}
    `}</style>
  </>;
}