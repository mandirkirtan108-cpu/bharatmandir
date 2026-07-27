import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Languages, X } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { fetchBook, fetchBookPages } from '../services/sacredBooksApi';

const LANGUAGES = [
  ['en', 'English'], ['hi', 'हिन्दी'], ['sa', 'संस्कृतम्'], ['original', 'Original'],
];

const PAGE_BATCH_SIZE = 10;
const progressKey = (slug) => `sacredbook-progress:${slug}`;

// Where should this book open? An explicit ?page= in the URL (e.g. from a
// chapter/index link) always wins; otherwise fall back to the reader's
// last saved position for this book.
function getResumeTarget(slug, urlPage) {
  if (Number.isFinite(urlPage) && urlPage > 0) return { page: urlPage, language: null };
  try {
    const saved = JSON.parse(localStorage.getItem(progressKey(slug)) || 'null');
    if (saved?.pageNumber) return { page: saved.pageNumber, language: saved.language || null };
  } catch { /* localStorage unavailable or corrupt — ignore */ }
  return null;
}

function saveProgress(slug, pageNumber, language, percent) {
  try {
    localStorage.setItem(progressKey(slug), JSON.stringify({ pageNumber, language, percent, updatedAt: Date.now() }));
  } catch { /* ignore quota/availability errors */ }
}

function TempleArch() {
  return (
    <svg className="temple-arch" viewBox="0 0 900 500" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path d="M450 20c150 0 260 110 260 260v180H190V280C190 130 300 20 450 20Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M450 70c120 0 210 90 210 210v170H240V280C240 160 330 70 450 70Z" fill="none" stroke="currentColor" strokeWidth="1.2" opacity=".6" />
      <circle cx="450" cy="60" r="8" fill="currentColor" opacity=".7" />
    </svg>
  );
}

function PageWatermark() {
  return (
    <svg className="page-watermark" viewBox="0 0 200 200" aria-hidden="true">
      <g fill="currentColor">
        <path d="M100 60c8 18 24 30 40 32-10 14-30 20-40 14-10 6-30 0-40-14 16-2 32-14 40-32z" />
        <path d="M100 60c-4 22-18 38-36 44 6 16 24 26 36 22 12 4 30-6 36-22-18-6-32-22-36-44z" opacity=".7" />
        <path d="M100 60c14 12 22 30 20 48-16 2-32-8-38-22-6 14-22 24-38 22-2-18 6-36 20-48 12-8 24-8 36 0z" opacity=".45" />
      </g>
    </svg>
  );
}

export default function SacredBookReaderPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Resolve where to open this book, once, from the URL or saved progress —
  // used to seed the initial language/batch so the very first fetch already
  // requests the right page (no flash of page 1 before jumping).
  const initialTarget = getResumeTarget(slug, parseInt(searchParams.get('page'), 10));

  const [book, setBook] = useState(null);
  const [pages, setPages] = useState([]);
  const [language, setLanguage] = useState(initialTarget?.language || 'en');
  const [batch, setBatch] = useState(initialTarget ? Math.max(1, Math.ceil(initialTarget.page / PAGE_BATCH_SIZE)) : 1);
  const [leaf, setLeaf] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [turnDir, setTurnDir] = useState('next');
  const jumpToEnd = useRef(false);
  // Set whenever we need the *next* successful page fetch to land on a
  // specific leaf instead of the default (leaf 0) — used by the resume jump.
  const jumpLeafRef = useRef(initialTarget ? (initialTarget.page - 1) % PAGE_BATCH_SIZE : null);

  // Swipe + scroll-hint plumbing
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const textWrapRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  useEffect(() => {
    fetchBook(slug).then(setBook).catch(e => setError(e.message));
  }, [slug]);

  // Re-resolve the resume target if the reader is reused for a different
  // book without a full remount (e.g. navigating between books via a link).
  // On the very first mount this just re-confirms what the lazy state
  // initializers above already set, so it doesn't cause an extra fetch.
  useEffect(() => {
    const target = getResumeTarget(slug, parseInt(searchParams.get('page'), 10));
    if (target) {
      const targetBatch = Math.max(1, Math.ceil(target.page / PAGE_BATCH_SIZE));
      jumpLeafRef.current = (target.page - 1) % PAGE_BATCH_SIZE;
      if (target.language) setLanguage(target.language);
      setBatch(targetBatch);
    } else {
      jumpLeafRef.current = null;
      setBatch(1);
    }
    setLeaf(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    fetchBookPages(slug, language, batch, 10)
      .then(r => {
        const p = r.pages || [];
        setPages(p);
        if (jumpToEnd.current) {
          setLeaf(Math.max(0, p.length - 1));
        } else if (jumpLeafRef.current !== null) {
          setLeaf(Math.min(Math.max(jumpLeafRef.current, 0), Math.max(0, p.length - 1)));
        } else {
          setLeaf(0);
        }
        jumpToEnd.current = false;
        jumpLeafRef.current = null;
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, language, batch]);

  const current = pages[leaf];
  const showingScan = language === 'original' && !!current?.page_image_url;
  const isVerseLanguage = language === 'hi' || language === 'sa';

  // Hindi/Sanskrit text is already one chaupai/verse per line, so it centers
  // cleanly as-is. English (and other prose) text carries hard line-breaks
  // meant for left-aligned reading — join those into flowing paragraphs
  // (keeping real paragraph breaks) so centering looks natural instead of ragged.
  const displayText = current
    ? (isVerseLanguage
        ? current.text
        : current.text
            .split(/\n\s*\n/)
            .map(p => p.replace(/\s*\n\s*/g, ' ').trim())
            .filter(Boolean)
            .join('\n\n'))
    : '';
  const atBookStart = batch === 1 && leaf === 0;
  const atBookEnd = !!(book && current && current.page_number >= book.page_count);

  const goNext = () => {
    if (atBookEnd) return;
    setTurnDir('next');
    if (leaf < pages.length - 1) setLeaf(l => l + 1);
    else setBatch(b => b + 1);
  };
  const goPrev = () => {
    if (atBookStart) return;
    setTurnDir('prev');
    if (leaf > 0) setLeaf(l => l - 1);
    else { jumpToEnd.current = true; setBatch(b => b - 1); }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Swipe-to-turn — mirrors a real page turn using the same turn-next/turn-prev animation
  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };
  const onTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - (touchStartY.current ?? 0);
    touchStartX.current = null;
    touchStartY.current = null;
    // Ignore short drags and mostly-vertical drags (those are scrolling the page text)
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goNext(); else goPrev();
  };

  // Show a subtle "more to read" hint whenever the current page's text overflows
  useEffect(() => {
    const el = textWrapRef.current;
    if (!el || showingScan || loading) { setShowScrollHint(false); return; }
    const check = () => {
      const overflowing = el.scrollHeight > el.clientHeight + 4;
      const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
      setShowScrollHint(overflowing && !nearBottom);
    };
    check();
    el.addEventListener('scroll', check);
    window.addEventListener('resize', check);
    return () => {
      el.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [current, language, showingScan, loading]);

  const percent = book?.page_count && current ? Math.min(100, Math.round((current.page_number / book.page_count) * 100)) : 0;

  // Bookmark progress — saved every time the visible page settles, so
  // reopening this book (or the library card) can resume from here.
  useEffect(() => {
    if (!current || loading) return;
    saveProgress(slug, current.page_number, language, percent);
  }, [slug, current, language, percent, loading]);

  return <>
    <Navbar />
    <main className="reader-shell">
      <TempleArch />
      <div className="reader-glow" aria-hidden="true" />

      <div className="reader-inner">
        <header className="reader-toolbar">
          <button className="back" onClick={() => navigate('/sacred-books')}><X size={16} /> Close book</button>
          <div className="titleblock">
            <h1>{book?.title || 'Loading…'}</h1>
            {book?.author && <p>{book.author}</p>}
          </div>
          <span />
        </header>

        <nav className="tab-rail" aria-label="Choose translation">
          <Languages size={15} className="tab-rail-icon" />
          {LANGUAGES.map(([code, label]) => (
            <button
              key={code}
              className={language === code ? 'tab active' : 'tab'}
              onClick={() => { if (code !== language) { setLanguage(code); setBatch(1); setLeaf(0); } }}
            >{label}</button>
          ))}
        </nav>

        {error && <div className="reader-status error">{error}</div>}

        <div className="book-stage">
          <div className="book-frame" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            <div className="stack-leaf stack-2" aria-hidden="true" />
            <div className="stack-leaf stack-1" aria-hidden="true" />

            {loading || !current ? (
              <div className="page-leaf loading">
                <div className="reader-status">Turning the page…</div>
              </div>
            ) : (
              <article
                key={`${current.page_number}-${language}`}
                className={`page-leaf ${language === 'hi' || language === 'sa' ? 'devanagari' : ''} turn-${turnDir}`}
              >
                <div className="ribbon" aria-hidden="true" />
                {!showingScan && <PageWatermark />}
                <div className="rule rule-top" />

                {showingScan ? (
                  <div className="page-scan">
                    <img src={current.page_image_url} alt={`Page ${current.page_number} — original scan`} />
                  </div>
                ) : (
                  <div className="page-text-wrap" ref={textWrapRef}><div className="page-text">{displayText}</div></div>
                )}

                {!showingScan && showScrollHint && (
                  <div className="scroll-hint" aria-hidden="true">
                    Scroll for more <span className="scroll-hint-chevron">⌄</span>
                  </div>
                )}

                <div className="rule rule-bottom" />
                <div className="folio">
                  <span>{book?.title}</span>
                  <span className="folio-num">{current.page_number} / {book?.page_count || '—'}</span>
                </div>
              </article>
            )}

            {!loading && current && (
              <>
                <button className="turn-zone turn-zone-left" aria-label="Previous page" disabled={atBookStart} onClick={goPrev} />
                <button className="turn-zone turn-zone-right" aria-label="Next page" disabled={atBookEnd} onClick={goNext} />
              </>
            )}
          </div>

          <div className="progress-rail" aria-hidden="true">
            <div className="progress-fill" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <footer className="reader-pager">
          <button disabled={atBookStart} onClick={goPrev}><ChevronLeft size={18} /> Previous</button>
          <span className="pager-percent">{percent}% read</span>
          <button disabled={atBookEnd} onClick={goNext}>Next <ChevronRight size={18} /></button>
        </footer>
        <p className="swipe-hint">Swipe left or right to turn the page</p>
      </div>
    </main>

    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Crimson+Pro:ital,wght@0,400;0,500;0,600;1,400&family=EB+Garamond:wght@500;600&display=swap');

      .reader-shell{
        --content-width:900px;
        --page-height:660px;
        position:relative;min-height:100vh;padding-bottom:56px;overflow:hidden;
        background:
          radial-gradient(ellipse at 50% -10%, #6a2c0c66, transparent 55%),
          linear-gradient(#1c0d05, #150a05 40%, #100804);
      }
      .reader-glow{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 900px 500px at 50% 30%, #ffdca340, transparent 70%)}
      .temple-arch{position:absolute;top:60px;left:50%;transform:translateX(-50%);width:min(900px,100%);height:520px;color:#c9932f;opacity:.09;pointer-events:none}

      .reader-inner{position:relative;z-index:2;max-width:var(--content-width);margin:0 auto;padding:0 20px}

      .reader-toolbar{padding:26px 0 16px;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;color:#f1dcb8}
      .titleblock{text-align:center;min-width:0}
      .titleblock h1{
        margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;
        font-size:clamp(20px,3vw,30px);letter-spacing:.01em;
        background:linear-gradient(180deg,#f7e2ae,#c9932f);-webkit-background-clip:text;background-clip:text;color:transparent;
      }
      .titleblock p{margin:3px 0 0;font-family:'EB Garamond',serif;font-size:13px;letter-spacing:.05em;color:#caa06c;text-transform:uppercase}
      .back{justify-self:start;display:flex;align-items:center;gap:7px;background:none;border:1px solid #7a4a2440;color:#e9c795;border-radius:99px;padding:8px 14px;cursor:pointer;font-family:'EB Garamond',serif;font-size:13px;white-space:nowrap}
      .back:hover{border-color:#c9932f}

      .tab-rail{display:flex;justify-content:center;align-items:flex-end;gap:6px;margin-bottom:14px;flex-wrap:wrap}
      .tab-rail-icon{color:#a97b45;margin-right:4px;margin-bottom:9px}
      .tab{
        font-family:'EB Garamond',serif;font-size:14px;letter-spacing:.03em;cursor:pointer;
        background:linear-gradient(#ece0c4,#d9c69a);color:#5a3c1e;border:1px solid #b8975f;border-bottom:none;
        border-radius:8px 8px 0 0;padding:8px 18px 9px;transform:translateY(4px);box-shadow:0 -2px 6px #00000020;
      }
      .tab.active{background:linear-gradient(#fff8e6,#f3e3bd);color:#7a3b12;transform:translateY(0);box-shadow:0 -4px 10px #0000003a;border-color:#c9932f;font-weight:600}

      .book-stage{position:relative;margin-top:14px}
      .book-frame{position:relative;display:flex;justify-content:center;touch-action:pan-y}

      /* Stacked leaves behind the current page give consistent thickness —
         sized off the same fixed --page-height so it never shifts between pages. */
      .stack-leaf{
        position:absolute;top:10px;height:var(--page-height);width:100%;max-width:760px;border-radius:2px 10px 10px 2px;
        background:linear-gradient(#f4e6c4,#e2cd9c);box-shadow:0 14px 30px #00000050;
      }
      .stack-leaf.stack-1{transform:translate(6px,6px) rotate(.6deg);opacity:.9;z-index:0}
      .stack-leaf.stack-2{transform:translate(11px,11px) rotate(1.1deg);opacity:.55;z-index:-1}

      /* Fixed height so every page — long or short — reads as the same
         physical size, like real leaves of one book. Overflow text scrolls
         inside the page rather than growing the page itself. */
      .page-leaf{
        position:relative;z-index:1;width:100%;max-width:760px;height:var(--page-height);
        display:flex;flex-direction:column;
        background:
          repeating-linear-gradient(0deg, #00000006 0 1px, transparent 1px 3px),
          radial-gradient(ellipse at top left, #fffaf0, #f4e6c4 60%, #ecd9ac);
        border-radius:2px 10px 10px 2px;
        padding:52px clamp(26px,6vw,68px) 32px;
        box-shadow:0 24px 60px #00000070, 0 2px 0 #ffffffaa inset, -10px 0 18px -12px #00000055 inset;
        overflow:hidden;
      }
      .page-leaf::after{
        content:'';position:absolute;right:0;bottom:0;width:70px;height:70px;
        background:linear-gradient(135deg,transparent 50%,#00000018 51%,#00000008 70%,transparent 72%);
        pointer-events:none;
      }
      .ribbon{
        position:absolute;top:-2px;right:52px;width:26px;height:64px;
        background:linear-gradient(180deg,#a63d0f,#7a2c0b);
        clip-path:polygon(0 0,100% 0,100% 100%,50% 78%,0 100%);
        box-shadow:0 4px 8px #00000040;
      }
      .page-watermark{position:absolute;top:50%;left:50%;width:260px;height:260px;transform:translate(-50%,-50%);color:#7a3b12;opacity:.05;pointer-events:none}
      .rule{height:1px;flex-shrink:0;margin:0 auto;max-width:180px;width:100%;background:linear-gradient(90deg,transparent,#a9752f,transparent)}
      .rule-top{margin-bottom:22px}
      .rule-bottom{margin-top:16px}

      .page-text-wrap{flex:1;min-height:0;overflow-y:auto;padding-right:6px;margin-right:-6px}
      .page-text-wrap::-webkit-scrollbar{width:5px}
      .page-text-wrap::-webkit-scrollbar-thumb{background:#c9932f66;border-radius:99px}
      .page-text-wrap::-webkit-scrollbar-track{background:transparent}

      .page-text{position:relative;white-space:pre-line;font-family:'Crimson Pro',Georgia,serif;font-size:19px;line-height:1.95;color:#2c1c0e;text-align:center;max-width:560px;margin:0 auto}
      .page-text::first-letter{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.7em;color:#8b3a15;font-weight:700}
      .page-leaf.devanagari .page-text{font-family:var(--font-hindi,'Noto Serif Devanagari'),serif;font-size:19px;line-height:2.1}
      .page-leaf.devanagari .page-text::first-letter{font-size:1em;color:inherit;font-weight:inherit;font-family:inherit}

      /* Scroll hint — fades in over the bottom of the text when there's more to read,
         and disappears automatically once the reader scrolls near the end of the page. */
      .scroll-hint{
        position:absolute;left:50%;bottom:54px;transform:translateX(-50%);
        display:flex;align-items:center;gap:4px;pointer-events:none;z-index:2;
        font-family:'EB Garamond',serif;font-size:11px;letter-spacing:.08em;text-transform:uppercase;
        color:#9c6a2f;background:linear-gradient(180deg, transparent, #fdf6e3 55%);
        padding:18px 12px 4px;
      }
      .scroll-hint-chevron{display:inline-block;animation:hintBob 1.4s ease-in-out infinite}
      @keyframes hintBob{0%,100%{transform:translateY(0)}50%{transform:translateY(4px)}}

      .page-scan{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;text-align:center}
      .page-scan img{max-width:100%;max-height:100%;height:auto;width:auto;object-fit:contain;border-radius:4px;box-shadow:0 6px 20px #00000030;border:1px solid #d9c49a}

      .folio{position:relative;flex-shrink:0;display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:16px;font-family:'EB Garamond',serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8c6238}
      .folio-num{font-variant-numeric:tabular-nums;white-space:nowrap}

      .page-leaf.loading{align-items:center;justify-content:center}

      @keyframes turnNextIn{from{opacity:0;transform:perspective(1200px) rotateY(-6deg) translateX(18px)}to{opacity:1;transform:none}}
      @keyframes turnPrevIn{from{opacity:0;transform:perspective(1200px) rotateY(6deg) translateX(-18px)}to{opacity:1;transform:none}}
      .page-leaf.turn-next{animation:turnNextIn .38s ease-out}
      .page-leaf.turn-prev{animation:turnPrevIn .38s ease-out}
      @media (prefers-reduced-motion: reduce){.page-leaf.turn-next,.page-leaf.turn-prev{animation:none}}

      .turn-zone{position:absolute;top:0;bottom:0;z-index:2;width:14%;background:none;border:0;cursor:pointer;opacity:0}
      .turn-zone:hover{opacity:1;background:linear-gradient(90deg,#00000010,transparent)}
      .turn-zone-left{left:0;border-radius:2px 0 0 2px}
      .turn-zone-right{right:0;background:linear-gradient(270deg,#00000010,transparent);border-radius:0 10px 10px 0}
      .turn-zone:disabled{cursor:default;opacity:0!important}

      .progress-rail{max-width:760px;margin:18px auto 0;height:3px;border-radius:99px;background:#ffffff14;overflow:hidden}
      .progress-fill{height:100%;background:linear-gradient(90deg,#c9932f,#f2d795);transition:width .3s ease}

      .reader-pager{display:flex;justify-content:center;align-items:center;gap:22px;margin-top:26px}
      .reader-pager button{display:flex;align-items:center;gap:6px;padding:10px 20px;border:1px solid #ad7f4880;background:linear-gradient(#2a1608,#1c0d05);color:#e9c795;border-radius:99px;cursor:pointer;font-family:'EB Garamond',serif;font-size:14px;letter-spacing:.03em}
      .reader-pager button:hover:not(:disabled){border-color:#c9932f}
      .reader-pager button:disabled{opacity:.35;cursor:default}
      .pager-percent{color:#a9825a;font-family:'EB Garamond',serif;font-size:13px;letter-spacing:.05em}

      /* Only shown on touch devices, so desktop users (who already see the click zones) don't see it */
      .swipe-hint{display:none;text-align:center;margin-top:10px;font-family:'EB Garamond',serif;font-size:12px;color:#8b6a45}
      @media (hover:none) and (pointer:coarse){.swipe-hint{display:block}}

      .reader-status{text-align:center;padding:60px 20px;color:#8b6a45;font-family:'EB Garamond',serif}
      .reader-status.error{color:#e08a6a}

      @media(max-width:650px){
        .reader-shell{--page-height:72vh}
        .reader-toolbar{grid-template-columns:1fr;text-align:center;gap:8px}
        .back{justify-self:center}
        .page-leaf{padding:36px 22px 26px;border-radius:8px}
        .stack-leaf{display:none}
        .tab-rail{overflow-x:auto;justify-content:flex-start;padding-bottom:2px}
        .ribbon{right:24px}
      }
    `}</style>
  </>;
}