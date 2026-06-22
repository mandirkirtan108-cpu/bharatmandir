import { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  fetchBooks, fetchChapters, fetchChapterVerses,
  searchInBook, saveProgress, fetchAllProgress,
  addBookmark, fetchBookmarks, deleteBookmark, getSessionId,
} from '../services/sacredBooksApi';

/* ═══════════════════════════════════════════════════════════════
   AUDIO — Web Speech API
═══════════════════════════════════════════════════════════════ */
function speakVerse(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = 'en-IN';
  utt.rate = 0.85;
  utt.pitch = 1;
  window.speechSynthesis.speak(utt);
}
function stopSpeaking() { window.speechSynthesis?.cancel(); }

/* ═══════════════════════════════════════════════════════════════
   BOOK ICON — Sacred book with OM printed on the cover,
   like a physical scripture (matches the uploaded reference image)
═══════════════════════════════════════════════════════════════ */
function BookIcon({ size = 48, color = '#c2410c', style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0, display: 'block', ...style }}
    >
      {/* Book spine (left edge) */}
      <rect x="4" y="6" width="6" height="36" rx="2"
        fill={color} opacity="0.85" />

      {/* Book cover (front face) */}
      <rect x="10" y="6" width="34" height="36" rx="2"
        fill={`${color}18`}
        stroke={color}
        strokeWidth="1.8" />

      {/* Cover border decoration (inner frame) */}
      <rect x="13" y="9" width="28" height="30" rx="1.5"
        fill="none"
        stroke={color}
        strokeWidth="0.9"
        opacity="0.5" />

      {/* ॐ symbol large and centered on the cover */}
      <text
        x="27"
        y="30"
        textAnchor="middle"
        fontSize="20"
        fontWeight="900"
        fill={color}
        fontFamily="Georgia, 'Noto Serif Devanagari', serif"
        opacity="0.9"
      >ॐ</text>

      {/* Subtle horizontal line above OM (like a title bar) */}
      <line x1="15" y1="14" x2="39" y2="14"
        stroke={color} strokeWidth="0.8" opacity="0.4" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SMALL COMPONENTS
═══════════════════════════════════════════════════════════════ */

function Spinner({ color = 'var(--saffron)' }) {
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      border: `3px solid ${color}33`,
      borderTopColor: color,
      animation: 'spin 0.8s linear infinite',
      margin: '40px auto',
    }} />
  );
}

function ProgressBar({ percent, color }) {
  return (
    <div style={{
      height: 4, borderRadius: 99,
      background: `${color}22`,
      overflow: 'hidden',
    }}>
      <div style={{
        height: '100%', width: `${percent}%`,
        background: `linear-gradient(90deg, ${color}, ${color}99)`,
        borderRadius: 99,
        transition: 'width 0.5s ease',
      }} />
    </div>
  );
}

function Toast({ message, visible }) {
  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(30,20,10,0.92)',
      color: '#FFD580',
      padding: '10px 22px',
      borderRadius: 99,
      fontSize: 13, fontWeight: 600,
      zIndex: 9999,
      backdropFilter: 'blur(8px)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
      animation: 'fadeDown 0.22s ease',
      whiteSpace: 'nowrap',
    }}>{message}</div>
  );
}

function BookCard({ book, isSelected, onSelect, progress }) {
  const pct = progress?.percent_done ?? 0;
  return (
    <button
      onClick={() => onSelect(book)}
      style={{
        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
        padding: '14px 16px',
        background: isSelected ? `${book.accent_color}15` : 'white',
        borderLeft: `3px solid ${isSelected ? book.accent_color : 'transparent'}`,
        borderBottom: '1px solid var(--cream-dark)',
        transition: 'all 0.18s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{
          width: 32, height: 32,
          background: `${book.accent_color}15`,
          border: `1px solid ${book.accent_color}30`,
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <BookIcon size={22} color={book.accent_color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 14, fontWeight: 700,
            color: isSelected ? book.accent_color : 'var(--brown)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{book.title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {book.total_chapters} ch · {(book.total_verses || 0).toLocaleString()} verses
          </div>
        </div>
      </div>
      {pct > 0 && (
        <div>
          <ProgressBar percent={pct} color={book.accent_color} />
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{pct}% read</div>
        </div>
      )}
    </button>
  );
}

function VerseCard({ verse, bookSlug, bookColor, bookmarks, onBookmarkToggle, speakingVerse, onSpeak }) {
  const [showSanskrit, setShowSanskrit] = useState(false);
  const [showCommentary, setShowCommentary] = useState(false);
  const key = `${verse.chapter_number}-${verse.verse_number}`;
  const isBookmarked = bookmarks.some(
    b => b.chapter_number === verse.chapter_number && b.verse_number === verse.verse_number
  );
  const isSpeaking = speakingVerse === key;

  return (
    <div
      id={`verse-${verse.verse_number}`}
      style={{
        borderRadius: 'var(--radius-lg)',
        border: `1.5px solid ${isBookmarked ? bookColor + '88' : bookColor + '33'}`,
        background: isBookmarked ? `${bookColor}06` : 'white',
        marginBottom: 16,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: `${bookColor}0A`,
        borderBottom: `1px solid ${bookColor}18`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: bookColor, letterSpacing: '0.07em' }}>
          {verse.chapter_number}.{verse.verse_number}
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowSanskrit(s => !s)}
            title="Toggle Sanskrit"
            style={{
              padding: '4px 10px', borderRadius: 99, border: `1px solid ${bookColor}33`,
              background: showSanskrit ? bookColor : 'transparent',
              color: showSanskrit ? 'white' : bookColor,
              fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >ॐ Sanskrit</button>
          <button
            onClick={() => onSpeak(key, verse.translation)}
            title={isSpeaking ? 'Stop' : 'Listen'}
            style={{
              padding: '4px 10px', borderRadius: 99, border: `1px solid ${bookColor}33`,
              background: isSpeaking ? bookColor : 'transparent',
              color: isSpeaking ? 'white' : bookColor,
              fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >{isSpeaking ? '⏹ Stop' : '🔊 Listen'}</button>
          <button
            onClick={() => onBookmarkToggle(verse)}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark this verse'}
            style={{
              padding: '4px 8px', borderRadius: 99, border: `1px solid ${bookColor}33`,
              background: isBookmarked ? bookColor : 'transparent',
              color: isBookmarked ? 'white' : bookColor,
              fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >{isBookmarked ? '🔖' : '☆'}</button>
        </div>
      </div>
      <div style={{ padding: '14px 18px' }}>
        {showSanskrit && verse.sanskrit && (
          <div style={{
            fontFamily: 'var(--font-hindi)',
            fontSize: 17, color: bookColor,
            lineHeight: 2, marginBottom: 12,
            whiteSpace: 'pre-line',
            animation: 'fadeDown 0.2s ease',
          }}>{verse.sanskrit}</div>
        )}
        {showSanskrit && verse.transliteration && (
          <div style={{
            fontSize: 13, color: 'var(--text-muted)',
            fontStyle: 'italic', marginBottom: 12, lineHeight: 1.7,
            whiteSpace: 'pre-line',
          }}>{verse.transliteration}</div>
        )}
        {verse.translation && (
          <p style={{ fontSize: 15, color: 'var(--text-mid)', lineHeight: 1.85, margin: 0 }}>
            {verse.translation}
          </p>
        )}
        {verse.commentary && (
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => setShowCommentary(c => !c)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'var(--text-muted)', fontWeight: 600,
                padding: 0, display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <span style={{ transform: showCommentary ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>›</span>
              {showCommentary ? 'Hide' : 'Show'} Commentary (Swami Sivananda)
            </button>
            {showCommentary && (
              <p style={{
                marginTop: 8, fontSize: 13, color: 'var(--text-light)',
                lineHeight: 1.8, fontStyle: 'italic',
                borderLeft: `3px solid ${bookColor}44`, paddingLeft: 12,
                animation: 'fadeDown 0.2s ease',
              }}>{verse.commentary}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */

const LAST_BOOKS = ['ramayana', 'mahabharata', 'ramayan', 'the-ramayana', 'the-mahabharata'];

export default function SacredBooksPage() {
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [chapterData, setChapterData] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [allProgress, setAllProgress] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [speakingVerse, setSpeakingVerse] = useState(null);
  const [bookFilter, setBookFilter] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', visible: false });
  const toastTimerRef = useRef(null);
  const [loadingBooks, setLoadingBooks]       = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [loadingVerses, setLoadingVerses]     = useState(false);
  const [searching, setSearching]             = useState(false);
  const [view, setView] = useState('library');
  const readerTopRef = useRef(null);

  const showToast = useCallback((message) => {
    clearTimeout(toastTimerRef.current);
    setToast({ message, visible: true });
    toastTimerRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2200);
  }, []);

  useEffect(() => {
    Promise.all([fetchBooks(), fetchBookmarks(), fetchAllProgress()])
      .then(([booksRes, bmRes, progRes]) => {
        setBooks(booksRes.books || []);
        setBookmarks(bmRes.bookmarks || []);
        setAllProgress(progRes.progress || []);
      })
      .catch(console.error)
      .finally(() => setLoadingBooks(false));
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [view, selectedChapter]);

  const handleSelectBook = useCallback(async (book) => {
    setSelectedBook(book);
    setChapters([]);
    setSelectedChapter(null);
    setChapterData(null);
    setView('reader');
    setLoadingChapters(true);
    showToast(`Opening ${book.title}…`);
    try {
      const res = await fetchChapters(book.slug);
      setChapters(res.chapters || []);
    } catch (e) { console.error(e); }
    finally { setLoadingChapters(false); }
  }, [showToast]);

  const handleSelectChapter = useCallback(async (chNum) => {
    if (!selectedBook) return;
    stopSpeaking();
    setSpeakingVerse(null);
    setSelectedChapter(chNum);
    setChapterData(null);
    setLoadingVerses(true);
    setSidebarOpen(false);
    readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const data = await fetchChapterVerses(selectedBook.slug, chNum);
      setChapterData(data);
      const pct = Math.round((chNum / selectedBook.total_chapters) * 100);
      await saveProgress(selectedBook.slug, chNum, 1);
      setAllProgress(prev => {
        const filtered = prev.filter(p => p.slug !== selectedBook.slug);
        return [{ slug: selectedBook.slug, last_chapter: chNum, last_verse: 1, percent_done: pct }, ...filtered];
      });
    } catch (e) { console.error(e); }
    finally { setLoadingVerses(false); }
  }, [selectedBook]);

  const handleBookmarkToggle = useCallback(async (verse) => {
    if (!selectedBook) return;
    const existing = bookmarks.find(
      b => b.slug === selectedBook.slug &&
           b.chapter_number === verse.chapter_number &&
           b.verse_number === verse.verse_number
    );
    if (existing) {
      await deleteBookmark(existing.id);
      setBookmarks(prev => prev.filter(b => b.id !== existing.id));
      showToast('Bookmark removed');
    } else {
      const res = await addBookmark(selectedBook.slug, verse.chapter_number, verse.verse_number);
      setBookmarks(prev => [{
        id: res.bookmark_id,
        slug: selectedBook.slug,
        title: selectedBook.title,
        chapter_number: verse.chapter_number,
        verse_number: verse.verse_number,
      }, ...prev]);
      showToast('Verse bookmarked');
    }
  }, [selectedBook, bookmarks, showToast]);

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || !selectedBook) return;
    setView('search');
    setSearching(true);
    setSearchResults(null);
    try {
      const res = await searchInBook(selectedBook.slug, searchQuery);
      setSearchResults(res);
    } catch (e) { console.error(e); }
    finally { setSearching(false); }
  }, [searchQuery, selectedBook]);

  const handleSpeak = (key, text) => {
    if (speakingVerse === key) { stopSpeaking(); setSpeakingVerse(null); }
    else { speakVerse(text); setSpeakingVerse(key); }
  };

  const getProgress = (slug) => allProgress.find(p => p.slug === slug);

  const filteredBooks = books
    .filter(b =>
      !bookFilter || b.title.toLowerCase().includes(bookFilter.toLowerCase()) ||
      b.deity?.toLowerCase().includes(bookFilter.toLowerCase()) ||
      b.tradition?.toLowerCase().includes(bookFilter.toLowerCase())
    )
    .sort((a, b) => {
      const aLast = LAST_BOOKS.includes(a.slug?.toLowerCase()) ? 1 : 0;
      const bLast = LAST_BOOKS.includes(b.slug?.toLowerCase()) ? 1 : 0;
      return aLast - bLast;
    });

  const bk = selectedBook;

  return (
    <>
      <Navbar />
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

        <Toast message={toast.message} visible={toast.visible} />

        {/* ── Hero Banner ── */}
        <div style={{
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
          padding: '50px 12px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          width: '100%', boxSizing: 'border-box',
        }}>
          <div style={{
            position: 'relative', zIndex: 1,
            width: '100%', maxWidth: 700,
            padding: '0 24px', boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', textAlign: 'center',
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,213,128,0.3)',
              borderRadius: 50, padding: '5px 16px', marginBottom: 14,
              color: 'rgba(255,213,128,0.85)', fontSize: 11, letterSpacing: '.1em',
              textTransform: 'uppercase', fontWeight: 500,
              backdropFilter: 'blur(8px)', whiteSpace: 'nowrap',
            }}>
              <BookIcon size={16} color="rgba(255,213,128,0.9)" />
              Sacred Scriptures of Bharat
            </div>

            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1,
              marginBottom: 10, marginTop: 0,
              textShadow: '0 4px 40px rgba(0,0,0,0.3)',
              color: '#ffffff', width: '100%',
            }}>
              Read the <span style={{ color: '#FFD580' }}>Sacred Books</span>
            </h1>

            <p style={{
              color: 'rgba(255,255,255,0.7)', fontSize: 14,
              width: '100%', maxWidth: 520,
              margin: '0 0 22px 0', fontWeight: 300, lineHeight: 1.7, textAlign: 'center',
            }}>
              Full text · Verse-by-verse · Sanskrit · Audio · Bookmarks · Reading progress
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', width: '100%' }}>
              {[
                { id: 'library',   label: 'Library' },
                { id: 'reader',    label: 'Reader',   disabled: !bk },
                { id: 'bookmarks', label: `Bookmarks (${bookmarks.length})` },
                { id: 'search',    label: 'Search',   disabled: !bk, tooltip: !bk ? 'Select a book first' : '' },
              ].map(tab => (
                <button
                  key={tab.id}
                  disabled={tab.disabled}
                  onClick={() => !tab.disabled && setView(tab.id)}
                  title={tab.tooltip || ''}
                  style={{
                    padding: '8px 20px', borderRadius: 50,
                    cursor: tab.disabled ? 'not-allowed' : 'pointer',
                    fontSize: 13, fontWeight: 600,
                    background: view === tab.id ? '#FFD580' : 'rgba(255,255,255,0.1)',
                    color: view === tab.id ? '#7a3208' : tab.disabled ? 'rgba(255,213,128,0.3)' : '#FFD580',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,213,128,0.2)',
                    transition: 'all 0.18s', whiteSpace: 'nowrap',
                  }}
                >{tab.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── LIBRARY VIEW ── */}
        {view === 'library' && (
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', fontSize: 22 }}>
                Sacred Library
              </h2>
              <input
                placeholder="Filter books, deities, traditions…"
                value={bookFilter}
                onChange={e => setBookFilter(e.target.value)}
                style={{
                  padding: '9px 16px', borderRadius: 99,
                  border: '2px solid var(--cream-dark)',
                  background: 'white', fontSize: 13,
                  fontFamily: 'var(--font-body)', outline: 'none', width: 260,
                }}
              />
            </div>

            {loadingBooks ? <Spinner /> : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 20,
              }}>
                {filteredBooks.map(book => {
                  const prog = getProgress(book.slug);
                  /* ── All cards use Hanuman Chalisa orange ── */
                  const cardColor = '#ea580c';
                  return (
                    <div
                      key={book.id}
                      onClick={() => handleSelectBook(book)}
                      className="book-card"
                      style={{
                        background: 'white',
                        border: `2px solid ${cardColor}`,
                        borderRadius: 16,
                        padding: '22px 24px 24px',
                        cursor: 'pointer',
                        transition: 'transform 0.22s, box-shadow 0.22s',
                        position: 'relative',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.boxShadow = `0 8px 28px ${cardColor}40`;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                        {/* Sacred book icon with OM on cover */}
                        <div style={{
                          width: 54, height: 54,
                          borderRadius: 12,
                          background: `${cardColor}15`,
                          border: `1.5px solid ${cardColor}35`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <BookIcon size={38} color={cardColor} />
                        </div>
                        <div>
                          <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', fontSize: 18, marginBottom: 3, marginTop: 0 }}>
                            {book.title}
                          </h3>
                          <div style={{ fontFamily: 'var(--font-hindi)', fontSize: 13, color: 'var(--text-muted)' }}>
                            {book.sanskrit_title}
                          </div>
                        </div>
                      </div>

                      <p style={{ fontSize: 13, color: 'var(--text-light)', lineHeight: 1.7, marginBottom: 14 }}>
                        {book.description?.slice(0, 120)}…
                      </p>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                        {[book.tradition, book.language, `${book.total_chapters} ch`, `${(book.total_verses||0).toLocaleString()} verses`]
                          .filter(Boolean).map(tag => (
                          <span key={tag} style={{
                            fontSize: 11, padding: '3px 10px', borderRadius: 99,
                            background: `${cardColor}15`,
                            color: cardColor,
                            fontWeight: 600,
                            border: `1px solid ${cardColor}30`,
                          }}>{tag}</span>
                        ))}
                      </div>

                      {prog && prog.percent_done > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                            Reading progress · Chapter {prog.last_chapter} · {prog.percent_done}%
                          </div>
                          <ProgressBar percent={prog.percent_done} color={cardColor} />
                        </div>
                      )}

                      <div style={{
                        fontSize: 13, fontWeight: 700,
                        color: cardColor,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {prog && prog.percent_done > 0 ? 'Continue Reading ›' : 'Start Reading ›'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── READER VIEW ── */}
        {view === 'reader' && bk && (
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 13, color: 'var(--text-muted)',
              marginBottom: 16, flexWrap: 'wrap',
            }}>
              <button
                onClick={() => setView('library')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: bk.accent_color, fontSize: 13, fontWeight: 600, padding: 0 }}
              >Library</button>
              <span>›</span>
              <span style={{ color: 'var(--brown)', fontWeight: 600 }}>{bk.title}</span>
              {selectedChapter && (<><span>›</span><span>Chapter {selectedChapter}</span></>)}
            </div>

            <div style={{ display: 'none' }} className="mobile-chapter-toggle">
              <button
                onClick={() => setSidebarOpen(o => !o)}
                style={{
                  width: '100%', padding: '12px 16px', marginBottom: 12,
                  background: bk.accent_color, color: 'white',
                  border: 'none', borderRadius: 'var(--radius)',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <span>{selectedChapter ? `Chapter ${selectedChapter}` : 'Select Chapter'}</span>
                <span>{sidebarOpen ? '▲' : '▼'}</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }} className="reader-grid">

              <aside
                className={`chapter-sidebar${sidebarOpen ? ' sidebar-open' : ''}`}
                style={{
                  background: 'white',
                  borderRadius: 'var(--radius-lg)',
                  border: `2px solid ${bk.accent_color}`,
                  overflow: 'hidden',
                  position: 'sticky', top: 84,
                  maxHeight: 'calc(100vh - 100px)',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                <div style={{ padding: '16px', background: bk.accent_color, borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <BookIcon size={28} color="rgba(255,255,255,0.95)" />
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', color: 'white', fontWeight: 700, fontSize: 15 }}>{bk.title}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{bk.total_chapters} chapters</div>
                    </div>
                  </div>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {loadingChapters ? <Spinner color={bk.accent_color} /> : (
                    chapters.map(ch => (
                      <button
                        key={ch.chapter_number}
                        onClick={() => handleSelectChapter(ch.chapter_number)}
                        style={{
                          width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                          padding: '11px 14px',
                          background: selectedChapter === ch.chapter_number ? `${bk.accent_color}18` : 'transparent',
                          borderLeft: `3px solid ${selectedChapter === ch.chapter_number ? bk.accent_color : 'transparent'}`,
                          borderBottom: '1px solid var(--cream-dark)',
                          transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            minWidth: 24, height: 24, borderRadius: 6,
                            background: selectedChapter === ch.chapter_number ? bk.accent_color : 'var(--cream-mid)',
                            color: selectedChapter === ch.chapter_number ? 'white' : 'var(--text-muted)',
                            fontSize: 11, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{ch.chapter_number}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 12, fontWeight: 600,
                              color: selectedChapter === ch.chapter_number ? bk.accent_color : 'var(--brown)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>{ch.title || ch.name_translated || `Chapter ${ch.chapter_number}`}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{ch.verse_count || ch.verses_count} verses</div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </aside>

              <main ref={readerTopRef}>
                {!selectedChapter && (
                  <div style={{
                    background: 'white', borderRadius: 16,
                    border: `2px solid ${bk.accent_color}`,
                    padding: '48px 32px', textAlign: 'center',
                  }}>
                    <div style={{
                      width: 80, height: 80, borderRadius: 20,
                      background: `${bk.accent_color}12`,
                      border: `2px solid ${bk.accent_color}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      margin: '0 auto 20px',
                    }}>
                      <BookIcon size={52} color={bk.accent_color} />
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', marginBottom: 10 }}>{bk.title}</h2>
                    <p style={{ color: 'var(--text-light)', fontSize: 15, lineHeight: 1.7, maxWidth: 500, margin: '0 auto 20px' }}>{bk.description}</p>
                    {getProgress(bk.slug)?.last_chapter && (
                      <button
                        onClick={() => handleSelectChapter(getProgress(bk.slug).last_chapter)}
                        style={{
                          padding: '12px 28px', borderRadius: 99,
                          background: bk.accent_color, color: 'white',
                          border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                        }}
                      >Continue from Chapter {getProgress(bk.slug).last_chapter} ›</button>
                    )}
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>← Select a chapter to begin reading</p>
                  </div>
                )}

                {selectedChapter && loadingVerses && (
                  <div style={{ background: 'white', borderRadius: 16, border: `2px solid ${bk.accent_color}`, padding: 40 }}>
                    <Spinner color={bk.accent_color} />
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Loading verses…</p>
                  </div>
                )}

                {selectedChapter && chapterData && !loadingVerses && (
                  <div>
                    <div style={{
                      background: 'white', borderRadius: 16,
                      border: `2px solid ${bk.accent_color}`,
                      padding: '24px 28px', marginBottom: 20,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: bk.accent_color, letterSpacing: '0.07em', marginBottom: 6 }}>
                            CHAPTER {selectedChapter}
                          </div>
                          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', fontSize: 22, marginBottom: 8 }}>
                            {chapterData.title || chapterData.name_translated}
                          </h2>
                          {chapterData.sanskrit_title && (
                            <div style={{ fontFamily: 'var(--font-hindi)', color: 'var(--text-muted)', fontSize: 14, marginBottom: 10 }}>
                              {chapterData.sanskrit_title}
                            </div>
                          )}
                          {chapterData.summary && (
                            <p style={{ fontSize: 14, color: 'var(--text-light)', lineHeight: 1.75, maxWidth: 600, margin: 0 }}>{chapterData.summary}</p>
                          )}
                        </div>
                        <div>
                          <div style={{
                            background: `${bk.accent_color}15`, borderRadius: 'var(--radius)',
                            padding: '10px 16px', textAlign: 'center',
                            border: `1px solid ${bk.accent_color}30`,
                          }}>
                            <div style={{ fontSize: 22, fontWeight: 700, color: bk.accent_color, fontFamily: 'var(--font-display)' }}>
                              {chapterData.verse_count || chapterData.verses?.length || 0}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Verses</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        {selectedChapter > 1 && (
                          <button onClick={() => handleSelectChapter(selectedChapter - 1)} style={{
                            padding: '8px 16px', borderRadius: 99, border: `1px solid ${bk.accent_color}44`,
                            background: 'transparent', color: bk.accent_color, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                          }}>‹ Previous Chapter</button>
                        )}
                        {selectedChapter < bk.total_chapters && (
                          <button onClick={() => handleSelectChapter(selectedChapter + 1)} style={{
                            padding: '8px 16px', borderRadius: 99, border: 'none',
                            background: bk.accent_color, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                          }}>Next Chapter ›</button>
                        )}
                      </div>
                    </div>

                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                      <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder={`Search in ${bk.title}…`}
                        style={{
                          flex: 1, padding: '10px 16px', borderRadius: 99,
                          border: `2px solid ${bk.accent_color}40`, background: 'white',
                          fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none',
                        }}
                      />
                      <button type="submit" style={{
                        padding: '10px 20px', borderRadius: 99, border: 'none',
                        background: bk.accent_color, color: 'white',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}>Search</button>
                    </form>

                    {chapterData.note && (
                      <div style={{
                        background: 'var(--cream-mid)', borderRadius: 'var(--radius)',
                        padding: '14px 18px', marginBottom: 20,
                        fontSize: 13, color: 'var(--text-light)',
                      }}>ℹ️ {chapterData.note}</div>
                    )}

                    {(chapterData.verses || []).map(verse => (
                      <VerseCard
                        key={`${verse.chapter_number}-${verse.verse_number}`}
                        verse={verse}
                        bookSlug={bk.slug}
                        bookColor={bk.accent_color}
                        bookmarks={bookmarks}
                        onBookmarkToggle={handleBookmarkToggle}
                        speakingVerse={speakingVerse}
                        onSpeak={handleSpeak}
                      />
                    ))}

                    <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                      {selectedChapter > 1 && (
                        <button onClick={() => handleSelectChapter(selectedChapter - 1)} style={{
                          padding: '12px 24px', borderRadius: 99, border: `1px solid ${bk.accent_color}44`,
                          background: 'transparent', color: bk.accent_color, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                        }}>‹ Previous Chapter</button>
                      )}
                      {selectedChapter < bk.total_chapters && (
                        <button onClick={() => handleSelectChapter(selectedChapter + 1)} style={{
                          padding: '12px 24px', borderRadius: 99, border: 'none',
                          background: bk.accent_color, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                          marginLeft: 'auto',
                        }}>Next Chapter ›</button>
                      )}
                    </div>
                  </div>
                )}
              </main>
            </div>
          </div>
        )}

        {/* ── BOOKMARKS VIEW ── */}
        {view === 'bookmarks' && (
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', marginBottom: 20, fontSize: 22 }}>
              Your Bookmarks ({bookmarks.length})
            </h2>
            {bookmarks.length === 0 ? (
              <div style={{
                background: 'white', borderRadius: 16,
                border: '2px solid var(--cream-dark)', padding: '48px',
                textAlign: 'center', color: 'var(--text-muted)',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16,
                  background: 'var(--cream-mid)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <BookIcon size={40} color="var(--text-muted)" />
                </div>
                <p>No bookmarks yet. Open a book and tap ☆ on any verse to save it.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {bookmarks.map(bm => {
                  const bookMeta = books.find(b => b.slug === bm.slug);
                  const color = bookMeta?.accent_color || 'var(--saffron)';
                  return (
                    <div
                      key={bm.id}
                      style={{
                        background: 'white', borderRadius: 14,
                        border: `2px solid ${color}`,
                        padding: '16px 20px',
                        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                      }}
                    >
                      <div style={{
                        width: 44, height: 44, borderRadius: 10,
                        background: `${color}15`,
                        border: `1.5px solid ${color}40`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <BookIcon size={28} color={color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontWeight: 700, color: 'var(--brown)', fontSize: 14, marginBottom: 2 }}>
                          {bm.title} · Ch {bm.chapter_number}, Verse {bm.verse_number}
                        </div>
                        {bm.note && (
                          <div style={{ fontSize: 12, color: 'var(--text-light)', fontStyle: 'italic' }}>{bm.note}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <button
                          onClick={async () => {
                            const book = books.find(b => b.slug === bm.slug);
                            if (book) {
                              await handleSelectBook(book);
                              await handleSelectChapter(bm.chapter_number);
                              setView('reader');
                              setTimeout(() => {
                                document.getElementById(`verse-${bm.verse_number}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              }, 800);
                            }
                          }}
                          style={{
                            padding: '6px 14px', borderRadius: 99, border: 'none',
                            background: color, color: 'white',
                            fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          }}
                        >Go to Verse</button>
                        <button
                          onClick={async () => {
                            await deleteBookmark(bm.id);
                            setBookmarks(prev => prev.filter(b => b.id !== bm.id));
                            showToast('Bookmark removed');
                          }}
                          style={{
                            padding: '6px 10px', borderRadius: 99,
                            border: '1px solid #ef444433', background: 'transparent',
                            color: '#ef4444', fontSize: 12, cursor: 'pointer',
                          }}
                        >Remove</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SEARCH RESULTS VIEW ── */}
        {view === 'search' && (
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', fontSize: 22 }}>Search Results</h2>
              {searchResults && (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  {searchResults.total} results for "{searchResults.query}"
                </span>
              )}
              <button onClick={() => setView('reader')} style={{
                marginLeft: 'auto', padding: '7px 16px', borderRadius: 99,
                border: '1px solid var(--cream-dark)', background: 'white',
                color: 'var(--text-light)', fontSize: 12, cursor: 'pointer',
              }}>← Back to Reader</button>
            </div>

            {searching && <Spinner color={bk?.accent_color} />}

            {!searching && searchResults && (
              <div>
                {searchResults.results.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                    No verses found for "{searchResults.query}"
                  </div>
                ) : (
                  searchResults.results.map((r, i) => (
                    <div key={i} style={{
                      background: 'white', borderRadius: 14,
                      border: `2px solid ${bk?.accent_color}`,
                      padding: '16px 20px', marginBottom: 12,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: bk?.accent_color, marginBottom: 6, letterSpacing: '0.06em' }}>
                        {r.chapter_title} · {r.chapter_number}.{r.verse_number}
                      </div>
                      <p style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.75, margin: '0 0 10px' }}>
                        {r.translation}
                      </p>
                      <button
                        onClick={async () => {
                          await handleSelectChapter(r.chapter_number);
                          setView('reader');
                          setTimeout(() => {
                            document.getElementById(`verse-${r.verse_number}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }, 800);
                        }}
                        style={{
                          padding: '5px 14px', borderRadius: 99, border: 'none',
                          background: bk?.accent_color, color: 'white',
                          fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >Read in Context ›</button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

      </div>
      <Footer />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }

        @media (max-width: 768px) {
          .reader-grid { grid-template-columns: 1fr !important; }
          .chapter-sidebar { display: none !important; position: static !important; max-height: 280px !important; }
          .chapter-sidebar.sidebar-open { display: flex !important; margin-bottom: 16px; }
          .mobile-chapter-toggle { display: block !important; }
        }
      `}</style>
    </>
  );
}