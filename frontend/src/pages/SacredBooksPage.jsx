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

function CornerFlourish({ className }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <path d="M2 20V6a4 4 0 0 1 4-4h14" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M2 12V6a4 4 0 0 1 4-4h6" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".6" />
      <circle cx="2" cy="2" r="2" fill="currentColor" />
    </svg>
  );
}

function BookCover({ book, dark, light }) {
  return (
    <div className="book-cover" style={{ '--cover-dark': dark, '--cover-light': light }}>
      <CornerFlourish className="corner corner-tl" />
      <CornerFlourish className="corner corner-tr" />
      <CornerFlourish className="corner corner-bl" />
      <CornerFlourish className="corner corner-br" />
      <div className="cover-frame">
        <span className="cover-om">ॐ</span>
        <div className="cover-rule" />
        <h2 className="cover-title">{book.title}</h2>
        {book.author && <p className="cover-author">{book.author}</p>}
        <div className="cover-rule" />
      </div>
      <span className="cover-pages">{book.page_count} pages</span>
    </div>
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
              <article className="book-card" key={book.id} onClick={() => navigate(`/sacred-books/library/${book.slug}`)}>
                <BookCover book={book} dark={dark} light={light} />
                <div className="book-face">
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

      .shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:28px}
      .book-card{
        display:flex;flex-direction:column;height:100%;background:#fffefb;border-radius:12px;overflow:hidden;cursor:pointer;
        box-shadow:0 10px 26px #5c270b1a;transition:transform .2s ease, box-shadow .2s ease;border:1px solid #e9dcc6;
      }
      .book-card:hover{transform:translateY(-6px);box-shadow:0 22px 44px #5c270b33}
      .book-card:hover .book-cover{box-shadow:inset 0 0 0 1px #f2d795aa, inset 0 -3px 10px #00000030}

      /* Cover: a real book-cover composition (gold frame + corner flourishes +
         embossed title) so it reads well even when the title is very short. */
      .book-cover{
        position:relative;padding:26px 20px 34px;min-height:196px;display:flex;flex-direction:column;align-items:center;justify-content:center;
        background:
          repeating-linear-gradient(115deg, #ffffff08 0 2px, transparent 2px 6px),
          linear-gradient(135deg,var(--cover-light),var(--cover-dark));
        box-shadow:inset 0 -3px 10px #00000030;
        transition:box-shadow .2s ease;
      }
      .cover-frame{position:relative;width:100%;text-align:center;padding:14px 16px;border:1px solid #f1e0b855;border-radius:2px}
      .cover-om{display:block;font-family:var(--font-hindi,'Noto Serif Devanagari'),serif;font-size:15px;color:#f1e0b8b0;margin-bottom:6px}
      .cover-rule{height:1px;width:36px;margin:8px auto;background:#f1e0b866}
      .cover-title{
        margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;color:#fbecc8;
        font-size:clamp(17px,2.6vw,22px);line-height:1.25;letter-spacing:.01em;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
      }
      .cover-author{margin:6px 0 0;font-family:'EB Garamond',serif;font-size:12px;letter-spacing:.06em;color:#e9c79599;text-transform:uppercase;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .cover-pages{position:absolute;bottom:12px;right:16px;font-family:'EB Garamond',serif;font-size:10.5px;letter-spacing:.08em;color:#f1e0b0a8}
      .corner{position:absolute;width:22px;height:22px;color:#f1e0b877}
      .corner-tl{top:10px;left:10px}
      .corner-tr{top:10px;right:10px;transform:scaleX(-1)}
      .corner-bl{bottom:10px;left:10px;transform:scaleY(-1)}
      .corner-br{bottom:10px;right:10px;transform:scale(-1,-1)}

      .book-face{padding:18px 22px 22px;flex:1;min-width:0;display:flex;flex-direction:column}
      .book-desc{color:#775e4c;line-height:1.65;font-size:13.5px;font-family:'Crimson Pro',serif;margin:0 0 16px;flex:1;
        display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
      .book-face button{align-self:flex-start;border:0;background:none;color:#8b3a15;font-weight:700;padding:0;cursor:pointer;font-family:'EB Garamond',serif;font-size:14px;letter-spacing:.02em}

      .library-state{position:relative;z-index:1;text-align:center;padding:50px;color:#806957;font-family:'Crimson Pro',serif}
      .library-state.error{color:#a11}
    `}</style>
  </>;
}