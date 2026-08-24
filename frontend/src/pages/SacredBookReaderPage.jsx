import { useEffect, useRef, useState } from 'react';
import { Bookmark, ChevronLeft, ChevronRight, FastForward, Languages, List, Pause, Play, Rewind, Square, Trash2, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  addBookmark,
  fetchBook,
  fetchBookmarks,
  fetchBookPages,
  fetchBookSections,
  fetchReadingProgress,
  isLoggedIn,
  removeBookmark,
  saveReadingProgress,
  synthesizeSpeech,
} from '../services/sacredBooksApi';

const LANGUAGES = [
  ['original', 'Original'], ['hi', 'हिन्दी'], ['sa', 'संस्कृतम्'], ['en', 'English'],
];

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5, 2];

const formatAudioTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
};

// OCR/translation can leave invisible characters or a space before a
// Devanagari combining mark. That makes browsers draw a dotted circle.
const cleanIndicText = (text = '') => text
  .normalize('NFC')
  .replace(/[\u200B\u200C\uFEFF]/g, '')
  .replace(/\u094D[ \t]+/g, '\u094D')
  .replace(/[ \t]+(?=[\u093A-\u094F\u0951-\u0957\u0962\u0963])/g, '');

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
  const [book, setBook] = useState(null);
  const [pages, setPages] = useState([]);
  const [language, setLanguage] = useState('original');
  const [batch, setBatch] = useState(1);
  const [leaf, setLeaf] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [turnDir, setTurnDir] = useState('next');
  const jumpToEnd = useRef(false);

  // Per-user reading progress: resume where this account left off, and
  // save as they turn pages. Guests just read without saving.
  const [progressChecked, setProgressChecked] = useState(false);
  const pendingLeaf = useRef(null);

  // AI-generated table of contents
  const [sections, setSections] = useState([]);
  const [showSections, setShowSections] = useState(false);
  const [jumpInput, setJumpInput] = useState('');

  // Per-user bookmarks — saved under the account, so they follow this
  // reader to any device they sign into (guests simply see none).
  const [bookmarks, setBookmarks] = useState([]);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);

  // Voice reading — text is sent to the backend, which synthesizes it via
  // OpenRouter and streams back an MP3 that plays through a plain <audio>.
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [activeLine, setActiveLine] = useState(-1);
  const [audioTime, setAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const voiceRequestRef = useRef(0);

  // Swipe + scroll-hint plumbing
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const textWrapRef = useRef(null);
  const [showScrollHint, setShowScrollHint] = useState(false);

  useEffect(() => {
    fetchBook(slug).then(data => {
      setBook(data);
      const available = data.available_languages?.length
        ? data.available_languages
        : data.target_languages || [];
      setLanguage(current => (
        current === 'original' || available.includes(current)
          ? current
          : available[0] || 'original'
      ));
    }).catch(e => setError(e.message));
    fetchBookSections(slug).then(r => setSections(r.sections || [])).catch(() => setSections([]));
    fetchBookmarks(slug).then(r => setBookmarks(r.bookmarks || [])).catch(() => setBookmarks([]));
  }, [slug]);

  useEffect(() => {
    if (!book) return;
    const available = book.available_languages?.length
      ? book.available_languages
      : book.target_languages || [];
    if (language !== 'original' && !available.includes(language)) {
      setLanguage(available[0] || 'original');
      setBatch(1);
      setLeaf(0);
    }
  }, [book, language]);

  // Look up this user's saved progress (if logged in) before the first page
  // batch loads, so we land straight on their page instead of flashing page 1.
  useEffect(() => {
    let cancelled = false;
    setProgressChecked(false);
    fetchReadingProgress(slug)
      .then(({ progress }) => {
        if (cancelled || !progress?.page_number) return;
        pendingLeaf.current = (progress.page_number - 1) % 10;
        if (progress.language) setLanguage(progress.language);
        setBatch(Math.max(1, Math.ceil(progress.page_number / 10)));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setProgressChecked(true); });
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (!progressChecked) return;
    setLoading(true);
    fetchBookPages(slug, language, batch, 10)
      .then(r => {
        const p = r.pages || [];
        setPages(p);
        if (pendingLeaf.current !== null) {
          setLeaf(Math.min(pendingLeaf.current, Math.max(0, p.length - 1)));
          pendingLeaf.current = null;
        } else {
          setLeaf(jumpToEnd.current ? Math.max(0, p.length - 1) : 0);
        }
        jumpToEnd.current = false;
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [slug, language, batch, progressChecked]);

  const jumpToPage = (pageNumber) => {
    const targetBatch = Math.max(1, Math.ceil(pageNumber / 10));
    const targetLeaf = (pageNumber - 1) % 10;
    setShowSections(false);
    setJumpInput('');
    setTurnDir('next');
    if (targetBatch === batch) {
      setLeaf(Math.min(targetLeaf, Math.max(0, pages.length - 1)));
    } else {
      pendingLeaf.current = targetLeaf;
      setBatch(targetBatch);
    }
  };

  const handleJumpSubmit = (e) => {
    e.preventDefault();
    const n = parseInt(jumpInput, 10);
    if (!n || n < 1) return;
    const max = book?.page_count || n;
    jumpToPage(Math.min(n, max));
  };

  const current = pages[leaf];
  const showingScan = language === 'original' && !!current?.page_image_url;
  const isVerseLanguage = language === 'hi' || language === 'sa';

  // Hindi/Sanskrit text is already one chaupai/verse per line, so it centers
  // cleanly as-is. English (and other prose) text carries hard line-breaks
  // meant for left-aligned reading — join those into flowing paragraphs
  // (keeping real paragraph breaks) so centering looks natural instead of ragged.
  const displayText = current
    ? (isVerseLanguage
        ? cleanIndicText(current.text)
        : current.text
            .split(/\n\s*\n/)
            .map(p => p.replace(/\s*\n\s*/g, ' ').trim())
            .filter(Boolean)
            .join('\n\n'))
    : '';

  const displayLines = displayText.split('\n');

  // Save progress for logged-in users whenever the visible page settles.
  useEffect(() => {
    if (!progressChecked || loading || !current || !isLoggedIn()) return;
    saveReadingProgress(slug, language, current.page_number).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, language, current?.page_number, loading, progressChecked]);

  const currentBookmark = current
    ? bookmarks.find(b => b.page_number === current.page_number)
    : null;

  const toggleBookmark = async () => {
    if (!current || bookmarkBusy) return;
    if (!isLoggedIn()) { setError('Please sign in to save bookmarks.'); return; }
    setBookmarkBusy(true);
    try {
      if (currentBookmark) {
        await removeBookmark(slug, currentBookmark.id);
        setBookmarks(bs => bs.filter(b => b.id !== currentBookmark.id));
      } else {
        const { bookmark } = await addBookmark(slug, current.page_number, language);
        setBookmarks(bs => [...bs.filter(b => b.page_number !== bookmark.page_number), bookmark]
          .sort((a, b) => a.page_number - b.page_number));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBookmarkBusy(false);
    }
  };

  const removeBookmarkById = async (bookmarkId) => {
    try {
      await removeBookmark(slug, bookmarkId);
      setBookmarks(bs => bs.filter(b => b.id !== bookmarkId));
    } catch (e) {
      setError(e.message);
    }
  };

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

  // ── Voice reading ────────────────────────────────────────────────────────
  const stopSpeaking = () => {
    voiceRequestRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setSpeaking(false);
    setPaused(false);
    setVoiceLoading(false);
    setActiveLine(-1);
    setAudioTime(0);
    setAudioDuration(0);
  };

  const speak = async () => {
    if (!current || showingScan || !displayText.trim() || voiceLoading) return;
    stopSpeaking();
    const requestId = voiceRequestRef.current;
    setVoiceLoading(true);
    try {
      const blob = await synthesizeSpeech(displayText, language === 'original' ? 'en' : language, slug, current.page_number);
      if (requestId !== voiceRequestRef.current) return;
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audio.playbackRate = playbackSpeed;
      audio.onloadedmetadata = () => {
        setAudioDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
        setActiveLine(0);
      };
      audio.ontimeupdate = () => {
        setAudioTime(audio.currentTime);
        if (!audio.duration || !Number.isFinite(audio.duration)) return;
        const readableLines = displayLines
          .map((text, index) => ({ index, weight: Math.max(1, text.trim().length) }))
          .filter(line => displayLines[line.index].trim());
        const totalWeight = readableLines.reduce((sum, line) => sum + line.weight, 0);
        const target = (audio.currentTime / audio.duration) * totalWeight;
        let cursor = 0;
        const match = readableLines.find(line => ((cursor += line.weight) >= target));
        setActiveLine(match?.index ?? readableLines.at(-1)?.index ?? -1);
      };
      audio.onended = () => { setSpeaking(false); setPaused(false); setActiveLine(-1); };
      audio.onerror = () => { setSpeaking(false); setPaused(false); setError('Voice reading failed. Please try again.'); };
      audioRef.current = audio;
      await audio.play();
      if (requestId !== voiceRequestRef.current) {
        audio.pause();
        return;
      }
      setSpeaking(true);
      setPaused(false);
    } catch (e) {
      if (requestId === voiceRequestRef.current) {
        setError(e.message || 'Voice reading failed. Please try again.');
      }
    } finally {
      if (requestId === voiceRequestRef.current) setVoiceLoading(false);
    }
  };

  const togglePause = () => {
    if (!audioRef.current || !speaking) return;
    if (paused) { audioRef.current.play(); setPaused(false); }
    else { audioRef.current.pause(); setPaused(true); }
  };

  const changePlaybackSpeed = (event) => {
    const speed = Number(event.target.value);
    setPlaybackSpeed(speed);
    if (audioRef.current) audioRef.current.playbackRate = speed;
  };

  const skipAudio = (seconds) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(Math.max(0, audio.currentTime + seconds), audio.duration || 0);
    setAudioTime(audio.currentTime);
  };

  const seekAudio = (event) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Number(event.target.value);
    setAudioTime(audio.currentTime);
  };

  // Stop reading whenever the page or language changes, and on unmount —
  // otherwise the old page's audio keeps playing over the new page's text.
  useEffect(() => {
    stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.page_number, language]);

  useEffect(() => () => stopSpeaking(), []);

  const percent = book?.page_count && current ? Math.min(100, Math.round((current.page_number / book.page_count) * 100)) : 0;

  return <>
    <Navbar />
    <main className="reader-shell">
      <TempleArch />
      <div className="reader-glow" aria-hidden="true" />

      <div className="reader-inner">
        <header className="reader-toolbar">
          <button className="back" onClick={() => { stopSpeaking(); navigate('/sacred-books'); }}><X size={16} /> Close book</button>
          <div className="titleblock">
            <h1>{book?.title || 'Almost ready…'}</h1>
            {book?.author && <p>{book.author}</p>}
          </div>
          <div className="toolbar-actions">
            <button
              className={currentBookmark ? 'bookmark-btn active' : 'bookmark-btn'}
              onClick={toggleBookmark}
              disabled={bookmarkBusy || !current}
              title={currentBookmark ? 'Remove bookmark from this page' : 'Bookmark this page'}
            >
              <Bookmark size={15} fill={currentBookmark ? 'currentColor' : 'none'} />
              {currentBookmark ? 'This page has been saved for your spiritual journey.' : 'Bookmark'}
            </button>
            <button className="index-btn" onClick={() => setShowSections(s => !s)}>
              <List size={15} /> Index
            </button>
          </div>
        </header>

        {showSections && (
          <div className="section-backdrop" onClick={() => setShowSections(false)}>
            <div className="section-panel" onClick={(e) => e.stopPropagation()}>
              <div className="section-panel-head">
                <span>Jump to page</span>
                <button className="section-close" onClick={() => setShowSections(false)} aria-label="Close index"><X size={16} /></button>
              </div>

              <form className="jump-form" onSubmit={handleJumpSubmit}>
                <input
                  type="number"
                  min="1"
                  max={book?.page_count || undefined}
                  placeholder={book?.page_count ? `1 – ${book.page_count}` : 'Page number'}
                  value={jumpInput}
                  onChange={(e) => setJumpInput(e.target.value)}
                />
                <button type="submit">Go</button>
              </form>

              {isLoggedIn() && (
                <>
                  <div className="section-panel-sub">Your bookmarks</div>
                  <div className="section-list">
                    {bookmarks.length === 0 && (
                      <p className="bookmark-empty">No bookmarks yet — tap "Bookmark" while reading a page.</p>
                    )}
                    {bookmarks.map((b) => (
                      <div
                        key={b.id}
                        className={current?.page_number === b.page_number ? 'bookmark-item active' : 'bookmark-item'}
                      >
                        <button className="bookmark-item-jump" onClick={() => jumpToPage(b.page_number)}>
                          <Bookmark size={13} fill="currentColor" />
                          <span className="section-item-title">{b.label || `Page ${b.page_number}`}</span>
                          <span className="section-item-page">p.{b.page_number}</span>
                        </button>
                        <button
                          className="bookmark-item-remove"
                          title="Remove bookmark"
                          onClick={() => removeBookmarkById(b.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {sections.length > 0 && (
                <>
                  <div className="section-panel-sub">Sections</div>
                  <div className="section-list">
                    {sections.map((s) => (
                      <button
                        key={s.page_number}
                        className={current?.page_number === s.page_number ? 'section-item active' : 'section-item'}
                        onClick={() => jumpToPage(s.page_number)}
                      >
                        <span className="section-item-title">{s.title}</span>
                        <span className="section-item-page">p.{s.page_number}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <nav className="tab-rail" aria-label="Choose translation">
          <Languages size={15} className="tab-rail-icon" />
          {LANGUAGES.filter(([code]) => (
            code === 'original'
            || (book?.available_languages?.length
              ? book.available_languages.includes(code)
              : book?.target_languages?.includes(code))
          )).map(([code, label]) => (
            <button
              key={code}
              className={language === code ? 'tab active' : 'tab'}
              onClick={() => { if (code !== language) { setLanguage(code); setBatch(1); setLeaf(0); } }}
            >{label}</button>
          ))}

          {language !== 'original' && (
            <div className="voice-controls">
              {!speaking ? (
                <button
                  className="voice-btn"
                  onClick={speak}
                  disabled={voiceLoading || !current || !displayText.trim()}
                  title="Read this page aloud"
                >
                  <Play size={14} /> {voiceLoading ? 'Almost ready…' : 'Listen'}
                </button>
              ) : (
                <>
                  <button className="voice-btn" onClick={togglePause} title={paused ? 'Resume' : 'Pause'}>
                    {paused ? <Play size={14} /> : <Pause size={14} />}
                  </button>
                  <button className="voice-btn" onClick={stopSpeaking} title="Stop reading">
                    <Square size={14} />
                  </button>
                </>
              )}
              <label className="speed-control" title="Audio speed">
                <span>Speed</span>
                <select value={playbackSpeed} onChange={changePlaybackSpeed} aria-label="Audio playback speed">
                  {PLAYBACK_SPEEDS.map(speed => <option key={speed} value={speed}>{speed}×</option>)}
                </select>
              </label>
            </div>
          )}
        </nav>

        {speaking && (
          <div className="audio-player" aria-label="Audio player">
            <div className="audio-player-buttons">
              <button className="audio-skip-btn" onClick={() => skipAudio(-10)} title="Go back 10 seconds" aria-label="Go back 10 seconds">
                <Rewind size={21} /> <span>10</span>
              </button>
              <button className="audio-main-btn" onClick={togglePause} title={paused ? 'Play' : 'Pause'} aria-label={paused ? 'Play' : 'Pause'}>
                {paused ? <Play size={23} fill="currentColor" /> : <Pause size={23} fill="currentColor" />}
              </button>
              <button className="audio-skip-btn" onClick={() => skipAudio(10)} title="Go forward 10 seconds" aria-label="Go forward 10 seconds">
                <FastForward size={21} /> <span>10</span>
              </button>
            </div>
            <div className="audio-timeline">
              <span>{formatAudioTime(audioTime)}</span>
              <input
                type="range"
                min="0"
                max={audioDuration || 0}
                step="0.1"
                value={Math.min(audioTime, audioDuration || 0)}
                onChange={seekAudio}
                aria-label="Audio position"
                style={{ '--audio-progress': `${audioDuration ? (audioTime / audioDuration) * 100 : 0}%` }}
              />
              <span>{formatAudioTime(audioDuration)}</span>
            </div>
          </div>
        )}

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
                  <div className="page-text-wrap" ref={textWrapRef}>
                    <div className="page-text">
                      {displayLines.map((line, index) => (
                        <span
                          key={`${index}-${line}`}
                          className={index === activeLine ? 'reading-line active' : 'reading-line'}
                          ref={node => {
                            if (node && index === activeLine) node.scrollIntoView({ block: 'center', behavior: 'smooth' });
                          }}
                        >{line || '\u00A0'}</span>
                      ))}
                    </div>
                  </div>
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
      .toolbar-actions{justify-self:end;display:flex;align-items:center;gap:8px}
      .index-btn{display:flex;align-items:center;gap:7px;background:none;border:1px solid #7a4a2440;color:#e9c795;border-radius:99px;padding:8px 14px;cursor:pointer;font-family:'EB Garamond',serif;font-size:13px;white-space:nowrap}
      .index-btn:hover{border-color:#c9932f}

      .bookmark-btn{display:flex;align-items:center;gap:7px;background:none;border:1px solid #7a4a2440;color:#e9c795;border-radius:99px;padding:8px 14px;cursor:pointer;font-family:'EB Garamond',serif;font-size:13px;white-space:nowrap}
      .bookmark-btn:hover:not(:disabled){border-color:#c9932f}
      .bookmark-btn:disabled{opacity:.5;cursor:default}
      .bookmark-btn.active{background:#c9932f26;border-color:#c9932f;color:#f2d795}

      .bookmark-empty{padding:4px 10px 10px;font-family:'EB Garamond',serif;font-size:13px;color:#a9825a}
      .bookmark-item{display:flex;align-items:center;gap:4px;border-radius:8px}
      .bookmark-item:hover{background:#7a4a2430}
      .bookmark-item.active{background:#c9932f26}
      .bookmark-item-jump{flex:1;min-width:0;display:flex;align-items:center;gap:8px;background:none;border:none;color:#e3cda2;text-align:left;padding:10px 10px;cursor:pointer;font-family:'EB Garamond',serif;font-size:14px}
      .bookmark-item.active .bookmark-item-jump{color:#f2d795}
      .bookmark-item-remove{flex-shrink:0;background:none;border:none;color:#a9825a;padding:8px;margin-right:4px;cursor:pointer;border-radius:6px}
      .bookmark-item-remove:hover{color:#e08a6a;background:#00000020}

      .section-backdrop{position:fixed;inset:0;z-index:20;background:#0b0503aa;display:flex;justify-content:center;align-items:flex-start;padding:90px 16px 16px}
      .section-panel{width:100%;max-width:380px;max-height:76vh;display:flex;flex-direction:column;background:linear-gradient(#241206,#180c05);border:1px solid #7a4a2455;border-radius:14px;box-shadow:0 24px 60px #00000080;overflow:hidden}
      .section-panel-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;font-family:'EB Garamond',serif;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#c9932f;border-bottom:1px solid #7a4a2440}
      .section-close{background:none;border:none;color:#caa06c;cursor:pointer;padding:2px;display:flex}
      .section-close:hover{color:#f2d795}

      .jump-form{display:flex;gap:8px;padding:14px 18px}
      .jump-form input{
        flex:1;min-width:0;background:#150a05;border:1px solid #7a4a2455;color:#f1dcb8;border-radius:8px;
        padding:9px 12px;font-family:'EB Garamond',serif;font-size:14px;
      }
      .jump-form input:focus{outline:none;border-color:#c9932f}
      .jump-form button{
        background:linear-gradient(#e3b761,#c9932f);color:#2a1608;border:none;border-radius:8px;
        padding:0 18px;font-family:'EB Garamond',serif;font-weight:600;font-size:14px;cursor:pointer;
      }
      .jump-form button:hover{filter:brightness(1.08)}

      .section-panel-sub{padding:2px 18px 6px;font-family:'EB Garamond',serif;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8c6238;border-top:1px solid #7a4a2430}
      .section-list{overflow-y:auto;padding:4px 8px 12px}
      .section-item{
        width:100%;display:flex;justify-content:space-between;align-items:center;gap:10px;
        background:none;border:none;color:#e3cda2;text-align:left;padding:10px 10px;border-radius:8px;
        cursor:pointer;font-family:'EB Garamond',serif;font-size:14px;
      }
      .section-item:hover{background:#7a4a2430}
      .section-item.active{background:#c9932f26;color:#f2d795}
      .section-item-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .section-item-page{flex-shrink:0;font-size:12px;color:#a9825a;font-variant-numeric:tabular-nums}

      .tab-rail{display:flex;justify-content:center;align-items:center;gap:6px;margin-bottom:14px;flex-wrap:wrap}
      .tab-rail-icon{color:#a97b45;margin-right:4px}
      .tab{
        font-family:'EB Garamond',serif;font-size:14px;letter-spacing:.03em;cursor:pointer;
        background:linear-gradient(#ece0c4,#d9c69a);color:#5a3c1e;border:1px solid #b8975f;border-bottom:none;
        border-radius:8px 8px 0 0;padding:8px 18px 9px;transform:translateY(4px);box-shadow:0 -2px 6px #00000020;
      }
      .tab.active{background:linear-gradient(#fff8e6,#f3e3bd);color:#7a3b12;transform:translateY(0);box-shadow:0 -4px 10px #0000003a;border-color:#c9932f;font-weight:600}

      .voice-controls{display:flex;align-items:center;gap:6px;margin-left:8px}
      .voice-btn{
        display:flex;align-items:center;gap:6px;
        font-family:'EB Garamond',serif;font-size:14px;letter-spacing:.03em;cursor:pointer;
        background:linear-gradient(#2a1608,#1c0d05);color:#e9c795;border:1px solid #ad7f4880;
        border-radius:99px;padding:8px 14px 9px;
      }
      .voice-btn:hover:not(:disabled){border-color:#c9932f}
      .voice-btn:disabled{opacity:.35;cursor:default}
      .speed-control{display:flex;align-items:center;gap:6px;color:#d3af7b;font-family:'EB Garamond',serif;font-size:13px}
      .speed-control select{border:1px solid #ad7f4880;border-radius:99px;background:#1c0d05;color:#f0d29d;padding:7px 8px;cursor:pointer}
      .audio-player{max-width:760px;margin:10px auto 4px;padding:12px 18px 10px;border:1px solid #ad7f4845;border-radius:14px;background:#110905cc;box-shadow:0 10px 28px #00000035;color:#f5dfb8}
      .audio-player-buttons{display:flex;align-items:center;justify-content:center;gap:20px;margin-bottom:8px}
      .audio-player button{border:0;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#f5dfb8;background:transparent}
      .audio-main-btn{width:44px;height:44px;border-radius:50%!important;background:#f8ecd4!important;color:#2a1508!important;box-shadow:0 3px 12px #00000055}
      .audio-skip-btn{position:relative;width:43px;height:36px}
      .audio-skip-btn span{position:absolute;font:600 9px/1 'DM Sans',sans-serif}
      .audio-player button:hover{transform:scale(1.06)}
      .audio-timeline{display:grid;grid-template-columns:42px 1fr 42px;align-items:center;gap:8px;font:12px/1 'DM Sans',sans-serif;color:#e2bd86;font-variant-numeric:tabular-nums}
      .audio-timeline span:last-child{text-align:right}
      .audio-timeline input{width:100%;height:4px;margin:0;cursor:pointer;appearance:none;border-radius:99px;background:linear-gradient(90deg,#f7e6c6 var(--audio-progress),#ffffff2e var(--audio-progress))}
      .audio-timeline input::-webkit-slider-thumb{appearance:none;width:13px;height:13px;border-radius:50%;background:#fff5df;box-shadow:0 1px 5px #0008}
      .audio-timeline input::-moz-range-thumb{width:13px;height:13px;border:0;border-radius:50%;background:#fff5df;box-shadow:0 1px 5px #0008}

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

      .page-text{position:relative;font-family:'Crimson Pro',Georgia,serif;font-size:19px;line-height:1.95;color:#2c1c0e;text-align:center;max-width:560px;margin:0 auto}
      .reading-line{display:block;border-radius:6px;padding:0 6px;transition:background-color .22s ease,color .22s ease,box-shadow .22s ease}
      .reading-line.active{background:#f3c85b66;color:#6d2509;box-shadow:0 0 0 1px #c98a2b55 inset}
      .page-text::first-letter{font-family:'Cormorant Garamond',Georgia,serif;font-size:1.7em;color:#8b3a15;font-weight:700}
      .page-leaf.devanagari .page-text{font-family:var(--font-hindi,'Noto Sans Devanagari'),sans-serif;font-size:19px;line-height:2.1;font-variant-ligatures:normal;text-rendering:optimizeLegibility}
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
        .toolbar-actions{justify-self:center}
        .section-backdrop{padding:16px}
        .section-panel{max-width:none;max-height:80vh}
        .page-leaf{padding:36px 22px 26px;border-radius:8px}
        .stack-leaf{display:none}
        .tab-rail{overflow-x:auto;justify-content:flex-start;padding-bottom:2px}
        .ribbon{right:24px}
      }
    `}</style>
  </>;
}
