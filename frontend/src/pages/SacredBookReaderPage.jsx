import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Languages, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { fetchBook, fetchBookPages } from '../services/sacredBooksApi';

const LANGUAGES = [
  ['en', 'English'], ['hi', 'हिन्दी'], ['sa', 'संस्कृतम्'], ['original', 'Original'],
];

// Faint lotus watermark — sits behind the text on every leaf.
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
  const [book, setBook] = useState(null);
  const [pages, setPages] = useState([]);
  const [language, setLanguage] = useState('en');
  const [batch, setBatch] = useState(1);
  const [leaf, setLeaf] = useState(0); // index of current page inside the fetched batch
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [turnDir, setTurnDir] = useState('next');
  const jumpToEnd = useRef(false);

  useEffect(() => {
    fetchBook(slug).then(setBook).catch(e => setError(e.message));
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    fetchBookPages(slug, language, batch, 10)
      .then(r => {
        const p = r.pages || [];
        setPages(p);
        setLeaf(jumpToEnd.current ? Math.max(0, p.length - 1) : 0);
        jumpToEnd.current = false;
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, language, batch]);

  const current = pages[leaf];
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

  const percent = book?.page_count && current ? Math.min(100, Math.round((current.page_number / book.page_count) * 100)) : 0;

  return <>
    <Navbar />
    <main className="reader-shell">
      <div className="reader-glow" aria-hidden="true" />

      <header className="reader-toolbar">
        <button className="back" onClick={() => navigate('/sacred-books')}><X size={17} /> Close book</button>
        <div className="titleblock">
          <h1>{book?.title || 'Loading…'}</h1>
          {book?.author && <p>{book.author}</p>}
        </div>
        {book?.original_pdf_url
          ? <a className="seal" href={book.original_pdf_url} target="_blank" rel="noreferrer" title="Download original"><Download size={16} /></a>
          : <span />}
      </header>

      <nav className="tab-rail" aria-label="Choose translation">
        <Languages size={16} className="tab-rail-icon" />
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
        <div className="book-frame">
          <div className="spine-shadow" aria-hidden="true" />

          {loading || !current ? (
            <div className="page-leaf loading">
              <div className="reader-status">Turning the page…</div>
            </div>
          ) : (
            <article
              key={current.page_number}
              className={`page-leaf ${language === 'hi' || language === 'sa' ? 'devanagari' : ''} turn-${turnDir}`}
            >
              <PageWatermark />
              <div className="rule rule-top" />
              <div className="page-text">{current.text}</div>
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
    </main>

    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Crimson+Pro:ital,wght@0,400;0,500;0,600;1,400&family=EB+Garamond:wght@500;600&display=swap');

      .reader-shell{
        position:relative;min-height:100vh;padding-bottom:56px;overflow:hidden;
        background:
          radial-gradient(ellipse at 50% -10%, #6a2c0c66, transparent 55%),
          linear-gradient(#1c0d05, #150a05 40%, #100804);
      }
      .reader-glow{
        position:absolute;inset:0;pointer-events:none;
        background:radial-gradient(ellipse 900px 500px at 50% 30%, #ffdca340, transparent 70%);
      }

      .reader-toolbar{
        position:relative;z-index:2;color:#f1dcb8;padding:22px max(20px,calc((100% - 940px)/2)) 16px;
        display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:16px;
      }
      .titleblock{text-align:center}
      .titleblock h1{
        margin:0;font-family:'Cormorant Garamond',Georgia,serif;font-weight:700;
        font-size:clamp(20px,3vw,30px);letter-spacing:.01em;
        background:linear-gradient(180deg,#f7e2ae,#c9932f);-webkit-background-clip:text;background-clip:text;color:transparent;
      }
      .titleblock p{margin:3px 0 0;font-family:'EB Garamond',serif;font-size:13px;letter-spacing:.05em;color:#caa06c;text-transform:uppercase}
      .back{justify-self:start;display:flex;align-items:center;gap:7px;background:none;border:1px solid #7a4a2440;color:#e9c795;border-radius:99px;padding:8px 14px;cursor:pointer;font-size:13px}
      .back:hover{border-color:#c9932f}
      .seal{
        justify-self:end;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;
        background:radial-gradient(circle at 35% 30%,#e3b45a,#8b5a1e 70%,#6b3f10);
        color:#2a1503;box-shadow:0 2px 6px #00000060,inset 0 1px 1px #ffffff55;text-decoration:none;
      }

      .tab-rail{
        position:relative;z-index:2;display:flex;justify-content:center;align-items:flex-end;gap:6px;
        padding:0 20px;margin-bottom:8px;flex-wrap:wrap;
      }
      .tab-rail-icon{color:#a97b45;margin-right:4px;margin-bottom:9px}
      .tab{
        font-family:'EB Garamond',serif;font-size:14px;letter-spacing:.03em;cursor:pointer;
        background:linear-gradient(#ece0c4,#d9c69a);color:#5a3c1e;border:1px solid #b8975f;border-bottom:none;
        border-radius:8px 8px 0 0;padding:8px 18px 9px;transform:translateY(4px);box-shadow:0 -2px 6px #00000020;
      }
      .tab.active{
        background:linear-gradient(#fff8e6,#f3e3bd);color:#7a3b12;transform:translateY(0);
        box-shadow:0 -4px 10px #0000003a;border-color:#c9932f;font-weight:600;
      }

      .book-stage{position:relative;z-index:2;max-width:940px;margin:18px auto 0;padding:0 16px}
      .book-frame{position:relative;display:flex;justify-content:center}
      .spine-shadow{
        position:absolute;left:50%;top:2%;bottom:2%;width:44px;transform:translateX(-50%);
        background:linear-gradient(90deg,transparent,#00000055 45%,#00000055 55%,transparent);
        filter:blur(6px);pointer-events:none;display:none;
      }
      @media(min-width:760px){.spine-shadow{display:block}}

      .page-leaf{
        position:relative;width:100%;max-width:760px;min-height:560px;
        background:
          repeating-linear-gradient(0deg, #00000006 0 1px, transparent 1px 3px),
          radial-gradient(ellipse at top left, #fffaf0, #f4e6c4 60%, #ecd9ac);
        border-radius:2px 10px 10px 2px;
        padding:52px clamp(26px,6vw,68px) 40px;
        box-shadow:
          0 24px 60px #00000070,
          0 2px 0 #ffffffaa inset,
          -10px 0 18px -12px #00000055 inset;
        overflow:hidden;
      }
      .page-leaf::after{
        content:'';position:absolute;right:0;bottom:0;width:70px;height:70px;
        background:linear-gradient(135deg,transparent 50%,#00000018 51%,#00000008 70%,transparent 72%);
        pointer-events:none;
      }
      .page-watermark{
        position:absolute;top:50%;left:50%;width:260px;height:260px;transform:translate(-50%,-50%);
        color:#7a3b12;opacity:.05;pointer-events:none;
      }
      .rule{height:1px;margin:0 auto 22px;max-width:180px;background:linear-gradient(90deg,transparent,#a9752f,transparent)}
      .rule-top{margin-bottom:26px}
      .rule-bottom{margin-top:26px;margin-bottom:0}
      .page-text{
        position:relative;white-space:pre-wrap;font-family:'Crimson Pro',Georgia,serif;
        font-size:19px;line-height:1.95;color:#2c1c0e;text-align:left;
      }
      .page-text::first-letter{
        font-family:'Cormorant Garamond',Georgia,serif;font-size:3.4em;float:left;line-height:.82;
        padding:.04em .08em 0 0;color:#8b3a15;font-weight:700;
      }
      .page-leaf.devanagari .page-text{font-family:var(--font-hindi,'Noto Serif Devanagari'),serif;font-size:19px;line-height:2.1}
      .page-leaf.devanagari .page-text::first-letter{font-size:1em;float:none;padding:0;color:inherit;font-weight:inherit;font-family:inherit}
      .folio{
        position:relative;display:flex;justify-content:space-between;margin-top:24px;
        font-family:'EB Garamond',serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#a07a4a;
      }
      .folio-num{font-variant-numeric:tabular-nums}

      .page-leaf.loading{display:flex;align-items:center;justify-content:center;min-height:560px}

      @keyframes turnNextIn{from{opacity:0;transform:perspective(1200px) rotateY(-6deg) translateX(18px)}to{opacity:1;transform:none}}
      @keyframes turnPrevIn{from{opacity:0;transform:perspective(1200px) rotateY(6deg) translateX(-18px)}to{opacity:1;transform:none}}
      .page-leaf.turn-next{animation:turnNextIn .38s ease-out}
      .page-leaf.turn-prev{animation:turnPrevIn .38s ease-out}
      @media (prefers-reduced-motion: reduce){.page-leaf.turn-next,.page-leaf.turn-prev{animation:none}}

      .turn-zone{position:absolute;top:0;bottom:0;width:14%;background:none;border:0;cursor:pointer;opacity:0}
      .turn-zone:hover{opacity:1;background:linear-gradient(90deg,#00000010,transparent)}
      .turn-zone-left{left:0;border-radius:2px 0 0 2px}
      .turn-zone-right{right:0;background:linear-gradient(270deg,#00000010,transparent);border-radius:0 10px 10px 0}
      .turn-zone:disabled{cursor:default;opacity:0!important}

      .progress-rail{max-width:760px;margin:16px auto 0;height:3px;border-radius:99px;background:#ffffff14;overflow:hidden}
      .progress-fill{height:100%;background:linear-gradient(90deg,#c9932f,#f2d795);transition:width .3s ease}

      .reader-pager{
        position:relative;z-index:2;display:flex;justify-content:center;align-items:center;gap:22px;margin-top:26px;
      }
      .reader-pager button{
        display:flex;align-items:center;gap:6px;padding:10px 20px;border:1px solid #ad7f4880;
        background:linear-gradient(#2a1608,#1c0d05);color:#e9c795;border-radius:99px;cursor:pointer;
        font-family:'EB Garamond',serif;font-size:14px;letter-spacing:.03em;
      }
      .reader-pager button:hover:not(:disabled){border-color:#c9932f}
      .reader-pager button:disabled{opacity:.35;cursor:default}
      .pager-percent{color:#a9825a;font-family:'EB Garamond',serif;font-size:13px;letter-spacing:.05em}

      .reader-status{text-align:center;padding:60px 20px;color:#8b6a45;font-family:'EB Garamond',serif}
      .reader-status.error{color:#e08a6a}

      @media(max-width:650px){
        .reader-toolbar{grid-template-columns:1fr;text-align:center;gap:8px}
        .back{justify-self:center}
        .seal{justify-self:center}
        .page-leaf{padding:40px 22px 32px;min-height:420px;border-radius:8px}
        .tab-rail{overflow-x:auto;justify-content:flex-start;padding-bottom:2px}
      }
    `}</style>
  </>;
}