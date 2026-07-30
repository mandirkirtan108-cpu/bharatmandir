import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { fetchAllProgress, fetchBooks, isLoggedIn } from '../services/sacredBooksApi';

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
        <div className="cover-emblem" aria-hidden="true"><span>ॐ</span></div>
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
  const [progressMap, setProgressMap] = useState({});

  useEffect(() => {
    fetchBooks().then(r => setBooks(r.books || [])).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, []);

  // "Continue reading" progress, per book, for whoever is signed in right
  // now. Pulled from the account's saved progress in the database — not
  // this browser's storage — so it's the same shelf whether this is Rohit
  // opening it on his laptop or his phone, and never mixes with Tanisha's.
  useEffect(() => {
    if (!isLoggedIn()) { setProgressMap({}); return; }
    let cancelled = false;
    fetchAllProgress()
      .then((r) => {
        if (cancelled) return;
        const map = {};
        for (const p of r.progress || []) {
          map[p.slug] = { pageNumber: p.page_number, percent: p.percent || 0 };
        }
        setProgressMap(map);
      })
      .catch(() => { if (!cancelled) setProgressMap({}); });
    return () => { cancelled = true; };
  }, [books]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? books.filter(b => `${b.title} ${b.author || ''} ${b.description || ''}`.toLowerCase().includes(q)) : books;
  }, [books, query]);

  const handleSearch = (e) => {
    e.preventDefault();
  };

  return <>
    <Navbar />
    <main className="library">

      {/* ══════════════ HERO (matches Search page hero) ══════════════ */}
      <section style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
        padding: '50px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        boxSizing: 'border-box',
      }}>
        <div style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: 700,
          padding: '0 24px',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}>

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,213,128,0.3)',
            borderRadius: 50, padding: '5px 16px', marginBottom: 14,
            color: 'rgba(255,213,128,0.85)', fontSize: 11, letterSpacing: '.1em',
            textTransform: 'uppercase', fontWeight: 500,
            backdropFilter: 'blur(8px)',
            whiteSpace: 'nowrap',
          }}><BookOpen size={13} style={{ marginRight: 2 }} /> Digital scripture library</div>

          {/* Title */}
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1,
            marginBottom: 10, marginTop: 0,
            textShadow: '0 4px 40px rgba(0,0,0,0.3)',
            color: '#ffffff',
            width: '100%',
          }}>
            A quiet place to read the scriptures
          </h1>

          {/* Subtitle */}
          <p style={{
            color: 'rgba(255,255,255,0.7)', fontSize: 14,
            width: '100%', maxWidth: 520,
            margin: '0 0 10px 0',
            fontWeight: 300, lineHeight: 1.7,
            textAlign: 'center',
          }}>
            Every page kept exactly as it was written — Sanskrit, Hindi, English, and the original, side by side. Open a book, not a webpage.
          </p>

          <div style={{
            fontFamily: 'var(--font-hindi, "Noto Serif Devanagari", serif)',
            fontSize: 14, color: 'rgba(233,199,149,0.8)',
            marginBottom: 22, letterSpacing: '.02em',
          }}>
            सुस्वागतम् — welcome, devotee
          </div>

          {/* Search bar — same shape/behavior as the Search page */}
          <form
            onSubmit={handleSearch}
            style={{
              display: 'flex',
              width: '100%',
              maxWidth: 580,
              background: 'rgba(255,255,255,0.97)',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,213,128,0.25)',
            }}
          >
            <input
              id="library-search-input"
              name="library-search-query"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search books, authors, or subjects"
              autoFocus
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                padding: '15px 18px',
                fontSize: 15,
                fontFamily: 'var(--font-body)',
                color: '#1A0A00',
                background: 'transparent',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '15px 24px',
                background: 'linear-gradient(135deg, #E8650A 0%, #B84D00 100%)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                letterSpacing: '.04em',
                whiteSpace: 'nowrap',
                transition: 'opacity .2s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              <Search size={15} />
              Search
            </button>
          </form>

        </div>
      </section>
      {/* ════════════════════════════════════ */}

      <section className="library-content">
        {loading && <div className="library-state">Bringing the volumes to the table…</div>}
        {error && <div className="library-state error">{error}</div>}
        {!loading && !error && visible.length === 0 && <div className="library-state">No books have been published yet.</div>}

        <div className="shelf">
          {visible.map((book) => {
            const [dark, light] = coverColors(book);
            const progress = progressMap[book.slug];
            const openHref = `/sacred-books/library/${book.slug}`;
            return (
              <article className="book-card" key={book.id} onClick={() => navigate(openHref)}>
                <BookCover book={book} dark={dark} light={light} />
                <div className="book-face">
                  <p className="book-desc">{book.description || 'Available in three complete translations and the original edition.'}</p>
                  {progress && (
                    <div className="book-progress">
                      <div className="book-progress-rail"><div className="book-progress-fill" style={{ width: `${progress.percent || 0}%` }} /></div>
                      <span>{progress.percent || 0}% read</span>
                    </div>
                  )}
                  <button>{progress ? 'Continue reading' : 'Open book'} <span>→</span></button>
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

      .library-content{position:relative;z-index:1;max-width:1160px;margin:auto;padding:44px 20px 80px}

      .shelf{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:28px}
      .book-card{
        display:flex;flex-direction:column;height:100%;border-radius:12px;overflow:hidden;cursor:pointer;
        background:linear-gradient(165deg, #fffefb 0%, #fdf1dc 60%, #fbe6c4 100%);
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
      .cover-emblem{position:relative;display:flex;align-items:center;justify-content:center;height:36px;margin-bottom:2px;color:#f1e0b8}
      .cover-emblem span{font-family:var(--font-hindi,'Noto Serif Devanagari'),serif;font-size:30px;color:#f1e0b8dd;line-height:1}
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

      .book-progress{display:flex;align-items:center;gap:8px;margin:0 0 12px}
      .book-progress-rail{flex:1;height:4px;border-radius:99px;background:#e9dcc6;overflow:hidden}
      .book-progress-fill{height:100%;background:linear-gradient(90deg,#c9932f,#f2a545);transition:width .3s ease}
      .book-progress span{flex-shrink:0;font-family:'EB Garamond',serif;font-size:11px;letter-spacing:.05em;color:#a9752f;text-transform:uppercase}

      .library-state{position:relative;z-index:1;text-align:center;padding:50px;color:#806957;font-family:'Crimson Pro',serif}
      .library-state.error{color:#a11}
    `}</style>
  </>;
}