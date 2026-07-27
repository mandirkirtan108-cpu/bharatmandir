import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { fetchBooks } from '../services/sacredBooksApi';

// A handful of cover tones, all within the site's warm orange/gold family
// so the shelf reads as one cohesive theme instead of a mixed color wheel.
const COVERS = [
  ['#4b1d04', '#7a3208'],
  ['#5c2508', '#8f3d0f'],
  ['#3a2410', '#6b4720'],
  ['#6b2d0a', '#a14a0b'],
  ['#452008', '#7a4315'],
];

// Hand-picked tones for well-known scriptures, so their covers stay
// consistent (e.g. Hanuman Chalisa always the same deep rust) instead of
// whatever the shelf order lands on — still within the same theme family.
const CURATED_COVERS = {
  'hanuman-chalisa': ['#4b1d04', '#7a3208'],
  'bhagavad-gita': ['#5c2508', '#8f3d0f'],
  'vishnu-purana': ['#3a2410', '#6b4720'],
  'manusmriti': ['#452008', '#7a4315'],
};

// Simple deterministic hash so any book without a curated color still always
// gets the *same* cover, regardless of search filters or list order.
function hashKey(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function coverColors(book) {
  const key = (book.slug || book.title || String(book.id) || '').toLowerCase();
  if (CURATED_COVERS[key]) return CURATED_COVERS[key];
  return COVERS[hashKey(key) % COVERS.length];
}

function CornerFlourish({ className }) {
  return (
    <svg className={className} viewBox="0 0 44 44" aria-hidden="true">
      <path d="M3 30V10a7 7 0 0 1 7-7h20" fill="none" stroke="currentColor" strokeWidth="1.1" />
      <path d="M3 18v-8a7 7 0 0 1 7-7h8" fill="none" stroke="currentColor" strokeWidth="1.1" opacity=".65" />
      <path d="M3 30c6 0 8-3 8-8" fill="none" stroke="currentColor" strokeWidth="1.1" opacity=".8" />
      <circle cx="3" cy="3" r="2.4" fill="currentColor" />
    </svg>
  );
}

function BookCover({ book, dark, light }) {
  return (
    <div className="book-cover" style={{ '--cover-dark': dark, '--cover-light': light }}>
      <div className="cover-vignette" aria-hidden="true" />
      <CornerFlourish className="corner corner-tl" />
      <CornerFlourish className="corner corner-tr" />
      <CornerFlourish className="corner corner-bl" />
      <CornerFlourish className="corner corner-br" />
      <div className="cover-frame">
        <div className="cover-emblem" aria-hidden="true">
          <svg viewBox="0 0 60 60"><g fill="none" stroke="currentColor" strokeWidth="0.8" opacity=".55">
            <circle cx="30" cy="30" r="20" />
            {Array.from({ length: 12 }).map((_, i) => (
              <line key={i} x1="30" y1="30" x2={30 + 26 * Math.cos((i * Math.PI) / 6)} y2={30 + 26 * Math.sin((i * Math.PI) / 6)} />
            ))}
          </g></svg>
          <span>ॐ</span>
        </div>
        <div className="cover-rule" />
        <h2 className="cover-title">{book.title}</h2>
        {book.author && <p className="cover-author">{book.author}</p>}
        <div className="cover-rule diamond" />
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
      <section className="library-hero">
        <div className="library-hero-inner">
          <div className="library-badge"><BookOpen size={15} /> Digital scripture library</div>
          <h1>A quiet place to read the scriptures</h1>
          <p>Every page kept exactly as it was written — Sanskrit, Hindi, English, and the original, side by side. Open a book, not a webpage.</p>
          <div className="library-blessing">सुस्वागतम् — welcome, devotee</div>
        </div>
      </section>

      <section className="library-content">
        <label className="library-search"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search books, authors, or subjects" /></label>

        {loading && <div className="library-state">Bringing the volumes to the table…</div>}
        {error && <div className="library-state error">{error}</div>}
        {!loading && !error && visible.length === 0 && <div className="library-state">No books have been published yet.</div>}

        <div className="shelf">
          {visible.map((book) => {
            const [dark, light] = coverColors(book);
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

      .library{position:relative;min-height:100vh;background:#f8f2e4}

      /* Full-bleed hero: breaks out of any parent max-width wrapper so the
         banner always spans the true viewport width, never just the content column. */
      .library-hero{
        position:relative;overflow:hidden;
        width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);
        background:
          radial-gradient(ellipse 900px 400px at 50% 0%, #ffdca330, transparent 70%),
          linear-gradient(135deg,#4b1d04 0%,#7a3208 55%,#a14a0b 100%);
        padding:70px 20px 120px;
      }
      .library-hero-inner{position:relative;z-index:1;max-width:760px;margin:0 auto;text-align:center;color:#f1dcb8}
      .library-badge{display:inline-flex;gap:8px;align-items:center;padding:7px 16px;border:1px solid #c9932f60;border-radius:99px;color:#e9c795;font-family:'EB Garamond',serif;font-size:13px;letter-spacing:.05em}
      .library-hero h1{font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;font-size:clamp(30px,4.6vw,50px);margin:20px 0 14px;
        background:linear-gradient(180deg,#f7e2ae,#c9932f);-webkit-background-clip:text;background-clip:text;color:transparent}
      .library-hero p{opacity:.85;font-size:16px;font-family:'Crimson Pro',serif;margin:0 auto}
      .library-blessing{margin-top:18px;font-family:var(--font-hindi,'Noto Serif Devanagari'),serif;font-size:15px;color:#e9c795cc;letter-spacing:.02em}

      .library-content{position:relative;z-index:1;max-width:1160px;margin:auto;padding:0 20px 80px}
      .library-search{
        max-width:520px;margin:-64px auto 44px;background:#fffaf0;border:1px solid #dcc7a4;border-radius:14px;
        padding:14px 18px;display:flex;gap:10px;align-items:center;box-shadow:0 12px 30px #5c270b25;color:#7a5230
      }
      .library-search input{border:0;outline:0;width:100%;font-size:15px;background:transparent;font-family:'Crimson Pro',serif;color:#432516}

      .shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:28px}
      .book-card{
        display:flex;flex-direction:column;height:100%;background:#fffefb;border-radius:12px;overflow:hidden;cursor:pointer;
        box-shadow:0 10px 26px #5c270b1a;transition:transform .2s ease, box-shadow .2s ease;border:1px solid #e9dcc6;
      }
      .book-card:hover{transform:translateY(-6px);box-shadow:0 22px 44px #5c270b33}
      .book-card:hover .book-cover{box-shadow:inset 0 0 0 1px #f2d795aa, inset 0 -3px 14px #00000035}

      /* Cover: gold frame + radiating emblem + corner filigree, styled after
         classic embossed scripture covers — reads well even with short titles. */
      .book-cover{
        position:relative;padding:28px 20px 36px;min-height:216px;display:flex;flex-direction:column;align-items:center;justify-content:center;
        background:
          radial-gradient(ellipse 260px 180px at 15% -10%, #ffdca355, transparent 65%),
          repeating-linear-gradient(115deg, #ffffff08 0 2px, transparent 2px 6px),
          linear-gradient(135deg,var(--cover-light),var(--cover-dark));
        box-shadow:inset 0 -3px 10px #00000030;
        transition:box-shadow .2s ease;
      }
      .cover-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center, transparent 45%, #00000040 100%);pointer-events:none}
      .cover-frame{position:relative;width:100%;text-align:center;padding:16px 16px;border:1px solid #f1e0b855;border-radius:2px;box-shadow:0 0 0 4px #00000018, inset 0 0 0 1px #ffffff12}
      .cover-emblem{position:relative;display:flex;align-items:center;justify-content:center;height:30px;margin-bottom:2px;color:#f1e0b8}
      .cover-emblem svg{position:absolute;width:60px;height:60px;top:50%;left:50%;transform:translate(-50%,-50%)}
      .cover-emblem span{position:relative;font-family:var(--font-hindi,'Noto Serif Devanagari'),serif;font-size:17px;color:#f1e0b8dd}
      .cover-rule{height:1px;width:36px;margin:8px auto;background:#f1e0b866}
      .cover-rule.diamond{position:relative}
      .cover-rule.diamond::after{content:'';position:absolute;left:50%;top:50%;width:5px;height:5px;transform:translate(-50%,-50%) rotate(45deg);background:#f1e0b899}
      .cover-title{
        margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;color:#fbecc8;
        font-size:clamp(17px,2.6vw,22px);line-height:1.25;letter-spacing:.01em;
        display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
      }
      .cover-author{margin:6px 0 0;font-family:'EB Garamond',serif;font-size:12px;letter-spacing:.06em;color:#e9c79599;text-transform:uppercase;
        overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .cover-pages{position:relative;z-index:1;margin-top:14px;font-family:'EB Garamond',serif;font-size:10.5px;letter-spacing:.1em;color:#f1e0b0b0;text-transform:uppercase}
      .corner{position:absolute;width:24px;height:24px;color:#f1e0b877;z-index:1}
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