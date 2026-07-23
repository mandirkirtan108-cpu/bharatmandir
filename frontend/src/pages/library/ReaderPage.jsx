import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Bookmark, Sun, Moon, Coffee,
  Minus, Plus, Volume2, VolumeX,
} from 'lucide-react';
import { libraryAPI } from '../../services/api';

const THEMES = [
  { key: 'light', icon: Sun },
  { key: 'sepia', icon: Coffee },
  { key: 'dark', icon: Moon },
];

export default function ReaderPage() {
  const { bookId, pageNumber = '1' } = useParams();
  const navigate = useNavigate();

  const [page, setPage] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | translating | error
  const [lang, setLang] = useState('en');
  const [theme, setTheme] = useState('light');
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.6);
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef(null);

  const currentPage = parseInt(pageNumber, 10);

  // Load saved preferences once.
  useEffect(() => {
    libraryAPI.getPreferences()
      .then(({ data }) => {
        setTheme(data.theme);
        setFontSize(data.font_size);
        setLineHeight(parseFloat(data.line_height));
        setLang(data.preferred_language);
      })
      .catch(() => {}); // logged-out readers just get defaults
  }, []);

  // Fetch the page whenever book/page/lang changes.
  useEffect(() => {
    setStatus('loading');
    libraryAPI.getPage(bookId, currentPage, lang)
      .then(({ data }) => {
        setPage(data);
        setStatus('ready');
      })
      .catch((err) => {
        setStatus(err.response?.status === 202 ? 'translating' : 'error');
      });

    // Save reading progress — fire and forget, fails silently if logged out.
    libraryAPI.updateProgress({ book_id: Number(bookId), language: lang, current_page: currentPage })
      .catch(() => {});
  }, [bookId, currentPage, lang]);

  const goToPage = (n) => {
    stopSpeaking();
    navigate(`/library/${bookId}/read/${n}`);
  };

  const persistPreferences = (patch) => {
    libraryAPI.updatePreferences(patch).catch(() => {});
  };

  const changeTheme = (key) => {
    setTheme(key);
    persistPreferences({ theme: key });
  };

  const changeFontSize = (delta) => {
    const next = Math.min(28, Math.max(14, fontSize + delta));
    setFontSize(next);
    persistPreferences({ font_size: next });
  };

  const addBookmark = () => {
    libraryAPI.addBookmark({ book_id: Number(bookId), page_number: currentPage })
      .then(() => alert('Bookmarked'))
      .catch(() => alert('Log in to bookmark pages'));
  };

  const speakPage = () => {
    if (!page?.blocks || typeof window.speechSynthesis === 'undefined') return;
    stopSpeaking();
    const text = page.blocks.map((b) => b.text).join('. ');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setSpeaking(false);
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };

  const stopSpeaking = () => {
    if (typeof window.speechSynthesis !== 'undefined') window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  return (
    <div className={`reader reader--${theme}`} style={{ '--reader-font-size': `${fontSize}px`, '--reader-line-height': lineHeight }}>
      <div className="reader__toolbar">
        <div className="reader__toolbar-group">
          {THEMES.map(({ key, icon: Icon }) => (
            <button
              key={key}
              className={theme === key ? 'active' : ''}
              onClick={() => changeTheme(key)}
              aria-label={`${key} theme`}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>

        <div className="reader__toolbar-group">
          <button onClick={() => changeFontSize(-1)} aria-label="Decrease font size"><Minus size={16} /></button>
          <span>{fontSize}px</span>
          <button onClick={() => changeFontSize(1)} aria-label="Increase font size"><Plus size={16} /></button>
        </div>

        <div className="reader__toolbar-group">
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="en">English</option>
            <option value="hi">हिन्दी</option>
            <option value="sa">संस्कृत</option>
          </select>
        </div>

        <div className="reader__toolbar-group">
          <button onClick={addBookmark} aria-label="Bookmark this page"><Bookmark size={16} /></button>
          <button onClick={speaking ? stopSpeaking : speakPage} aria-label="Text to speech">
            {speaking ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </div>

      <div className="reader__page">
        {status === 'loading' && <p className="reader__status">Loading page...</p>}
        {status === 'translating' && (
          <p className="reader__status">This page is still being translated — try again shortly.</p>
        )}
        {status === 'error' && <p className="reader__status">Couldn't load this page.</p>}

        {status === 'ready' && page && (
          <div className="reader__content">
            {page.blocks.map((block, i) => {
              if (block.type === 'heading') return <h2 key={i}>{block.text}</h2>;
              if (block.type === 'verse') {
                return (
                  <p key={i} className="reader__verse">
                    <span className="reader__verse-number">{block.number}</span> {block.text}
                  </p>
                );
              }
              return <p key={i}>{block.text}</p>;
            })}
          </div>
        )}
      </div>

      <div className="reader__nav">
        <button disabled={currentPage <= 1} onClick={() => goToPage(currentPage - 1)}>
          <ChevronLeft size={20} /> Prev
        </button>
        <span>
          Page {currentPage} {page?.total_pages ? `of ${page.total_pages}` : ''}
        </span>
        <button
          disabled={page?.total_pages && currentPage >= page.total_pages}
          onClick={() => goToPage(currentPage + 1)}
        >
          Next <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}