import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Languages } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { fetchBook, fetchBookPages } from '../services/sacredBooksApi';

const LANGUAGES = [
  ['en', 'English'], ['hi', 'हिन्दी'], ['sa', 'संस्कृतम्'], ['original', 'Original'],
];

export default function SacredBookReaderPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [book, setBook] = useState(null);
  const [pages, setPages] = useState([]);
  const [language, setLanguage] = useState('en');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchBook(slug).then(setBook).catch(e => setError(e.message));
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    fetchBookPages(slug, language, page, 10)
      .then(r => setPages(r.pages || [])).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [slug, language, page]);

  const totalBatches = Math.max(1, Math.ceil((book?.page_count || 1) / 10));
  return <>
    <Navbar />
    <main className="reader-shell">
      <header className="reader-head">
        <button className="back" onClick={() => navigate('/sacred-books')}>← Library</button>
        <div><h1>{book?.title || 'Book'}</h1><p>{book?.author || ''}</p></div>
        {book?.original_pdf_url && <a href={book.original_pdf_url} target="_blank" rel="noreferrer"><Download size={16}/> Original PDF</a>}
      </header>
      <nav className="language-tabs"><Languages size={19}/>{LANGUAGES.map(([code,label]) =>
        <button className={language === code ? 'active' : ''} key={code} onClick={() => {setLanguage(code);setPage(1)}}>{label}</button>
      )}</nav>
      {error && <div className="reader-status error">{error}</div>}
      {loading ? <div className="reader-status">Preparing pages…</div> : <section className={`document ${language === 'hi' || language === 'sa' ? 'devanagari' : ''}`}>
        {pages.map(item => <article className="document-page" key={item.page_number}>
          <div className="page-number">Page {item.page_number}</div>
          <div className="page-text">{item.text}</div>
        </article>)}
      </section>}
      <footer className="reader-pager">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft/> Previous</button>
        <span>{page} / {totalBatches}</span>
        <button disabled={page >= totalBatches} onClick={() => setPage(p => p + 1)}>Next <ChevronRight/></button>
      </footer>
    </main>
    <style>{`
      .reader-shell{min-height:100vh;background:#eee6da;padding-bottom:60px}.reader-head{background:#512006;color:white;padding:24px max(20px,calc((100% - 920px)/2));display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:20px}.reader-head h1{margin:0;text-align:center;font-family:var(--font-display)}.reader-head p{text-align:center;margin:4px 0;color:#e9c9a7}.reader-head a,.back{color:#ffd69d;background:none;border:0;text-decoration:none;display:flex;align-items:center;gap:7px;cursor:pointer}.reader-head a{justify-self:end}.language-tabs{position:sticky;top:0;z-index:2;background:white;border-bottom:1px solid #d6c5b5;padding:11px 18px;display:flex;justify-content:center;align-items:center;gap:8px}.language-tabs button{border:1px solid #d9c8b8;background:#fffaf3;border-radius:99px;padding:8px 16px;cursor:pointer}.language-tabs button.active{background:#7f3410;color:white;border-color:#7f3410}.document{max-width:820px;margin:32px auto;padding:0 16px}.document-page{position:relative;background:#fffefb;min-height:650px;margin:0 0 24px;padding:58px clamp(28px,7vw,78px);box-shadow:0 5px 28px #3b1d0b20;border-radius:3px}.page-number{position:absolute;right:28px;top:22px;color:#a28e7a;font-size:12px}.page-text{white-space:pre-wrap;font-family:Georgia,serif;font-size:18px;line-height:1.9;color:#30261f;text-align:left}.document.devanagari .page-text{font-family:var(--font-hindi),'Noto Serif Devanagari',serif;font-size:19px;line-height:2}.reader-pager{display:flex;justify-content:center;align-items:center;gap:24px}.reader-pager button{display:flex;align-items:center;gap:6px;padding:10px 18px;border:1px solid #bca58e;background:white;border-radius:9px;cursor:pointer}.reader-pager button:disabled{opacity:.4}.reader-status{text-align:center;padding:80px}.reader-status.error{color:#a11}@media(max-width:650px){.reader-head{grid-template-columns:1fr;text-align:center}.reader-head a,.back{justify-self:center}.document-page{padding:50px 24px}.language-tabs{overflow:auto;justify-content:flex-start}}
    `}</style>
  </>;
}