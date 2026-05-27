import { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  fetchBooks, fetchChapters, fetchChapterVerses,
  searchInBook, saveProgress, fetchAllProgress,
  addBookmark, fetchBookmarks, deleteBookmark, getSessionId,
} from '../services/sacredBooksApi';

/* ═══════════════════════════════════════════════════════════════
   AUDIO — Web Speech API (free, no key needed)
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

/* ── BookCard in sidebar ── */
function BookCard({ book, isSelected, onSelect, progress }) {
  const pct = progress?.percent_done ?? 0;
  return (
    <button
      onClick={() => onSelect(book)}
      style={{
        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
        padding: '14px 16px',
        background: isSelected ? `${book.accent_color}22` : 'white',
        borderLeft: `3px solid ${isSelected ? book.accent_color : 'transparent'}`,
        borderBottom: '1px solid var(--cream-dark)',
        transition: 'all 0.18s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{book.icon_emoji}</span>
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

/* ── Single verse card in reader ── */
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
        border: `1px solid ${isBookmarked ? bookColor + '55' : 'var(--cream-dark)'}`,
        background: isBookmarked ? `${bookColor}06` : 'white',
        marginBottom: 16,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Verse header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: `${bookColor}0A`,
        borderBottom: `1px solid ${bookColor}18`,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 700, color: bookColor,
          letterSpacing: '0.07em',
        }}>
          {verse.chapter_number}.{verse.verse_number}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {/* Sanskrit toggle */}
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

          {/* Audio */}
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

          {/* Bookmark */}
          <button
            onClick={() => onBookmarkToggle(verse)}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark this verse'}
            style={{
              padding: '4px 8px', borderRadius: 99, border: `1px solid ${bookColor}33`,
              background: isBookmarked ? bookColor : 'transparent',
              color: isBookmarked ? 'white' : bookColor,
              fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
            }}
          >{isBookmarked ? '🔖' : '🔖'}</button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '14px 18px' }}>
        {/* Sanskrit */}
        {showSanskrit && verse.sanskrit && (
          <div style={{
            fontFamily: 'var(--font-hindi)',
            fontSize: 17, color: bookColor,
            lineHeight: 2, marginBottom: 12,
            whiteSpace: 'pre-line',
            animation: 'fadeDown 0.2s ease',
          }}>{verse.sanskrit}</div>
        )}

        {/* Transliteration */}
        {showSanskrit && verse.transliteration && (
          <div style={{
            fontSize: 13, color: 'var(--text-muted)',
            fontStyle: 'italic', marginBottom: 12, lineHeight: 1.7,
            whiteSpace: 'pre-line',
          }}>{verse.transliteration}</div>
        )}

        {/* Translation */}
        {verse.translation && (
          <p style={{ fontSize: 15, color: 'var(--text-mid)', lineHeight: 1.85, margin: 0 }}>
            {verse.translation}
          </p>
        )}

        {/* Commentary toggle */}
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

// Slugs jo sabse last mein aane chahiye
const LAST_BOOKS = ['ramayana', 'mahabharata', 'ramayan', 'the-ramayana', 'the-mahabharata'];

export default function SacredBooksPage() {
  // ── State ────────────────────────────────────────────────────
  const [books, setBooks] = useState([]);
  const [selectedBook, setSelectedBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [chapterData, setChapterData] = useState(null);   // { verses, title, summary }
  const [bookmarks, setBookmarks] = useState([]);
  const [allProgress, setAllProgress] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [speakingVerse, setSpeakingVerse] = useState(null);
  const [bookFilter, setBookFilter] = useState('');

  // Loading states
  const [loadingBooks, setLoadingBooks]       = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [loadingVerses, setLoadingVerses]     = useState(false);
  const [searching, setSearching]             = useState(false);

  // View mode
  const [view, setView] = useState('library'); // 'library' | 'reader' | 'bookmarks' | 'search'

  const readerTopRef = useRef(null);

  // ── Boot ─────────────────────────────────────────────────────
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

  // ── Select book ───────────────────────────────────────────────
  const handleSelectBook = useCallback(async (book) => {
    setSelectedBook(book);
    setChapters([]);
    setSelectedChapter(null);
    setChapterData(null);
    setView('reader');
    setLoadingChapters(true);
    try {
      const res = await fetchChapters(book.slug);
      setChapters(res.chapters || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingChapters(false);
    }
  }, []);

  // ── Select chapter ────────────────────────────────────────────
  const handleSelectChapter = useCallback(async (chNum) => {
    if (!selectedBook) return;
    setSelectedChapter(chNum);
    setChapterData(null);
    setLoadingVerses(true);
    readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const data = await fetchChapterVerses(selectedBook.slug, chNum);
      setChapterData(data);
      // Save progress
      await saveProgress(selectedBook.slug, chNum, 1);
      setAllProgress(prev => {
        const filtered = prev.filter(p => p.slug !== selectedBook.slug);
        return [{ slug: selectedBook.slug, last_chapter: chNum, last_verse: 1, percent_done: 0 }, ...filtered];
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingVerses(false);
    }
  }, [selectedBook]);

  // ── Bookmark toggle ───────────────────────────────────────────
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
    } else {
      const res = await addBookmark(selectedBook.slug, verse.chapter_number, verse.verse_number);
      setBookmarks(prev => [{
        id: res.bookmark_id,
        slug: selectedBook.slug,
        title: selectedBook.title,
        icon_emoji: selectedBook.icon_emoji,
        chapter_number: verse.chapter_number,
        verse_number: verse.verse_number,
      }, ...prev]);
    }
  }, [selectedBook, bookmarks]);

  // ── Search ────────────────────────────────────────────────────
  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || !selectedBook) return;
    setView('search');
    setSearching(true);
    setSearchResults(null);
    try {
      const res = await searchInBook(selectedBook.slug, searchQuery);
      setSearchResults(res);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, selectedBook]);

  // ── Audio ─────────────────────────────────────────────────────
  const handleSpeak = (key, text) => {
    if (speakingVerse === key) {
      stopSpeaking();
      setSpeakingVerse(null);
    } else {
      speakVerse(text);
      setSpeakingVerse(key);
    }
  };

  // ── Helpers ───────────────────────────────────────────────────
  const getProgress = (slug) => allProgress.find(p => p.slug === slug);

  // ── Ramayana & Mahabharata ko last mein sort karo ─────────────
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

  // ── Render ────────────────────────────────────────────────────
  return (
    <>
      <Navbar />
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

        {/* ── Hero Banner ─────────────────────────────────────── */}
        <div style={{
          background: 'linear-gradient(135deg, #1a0d00 0%, #3d1a00 50%, #2c1500 100%)',
          padding: '0 28px 40px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          marginTop: 0,
          paddingTop: 108,
        }}>
          <div style={{
            position: 'absolute', top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            fontSize: 180, opacity: 0.03,
            fontFamily: 'var(--font-hindi)', color: 'white',
            userSelect: 'none', pointerEvents: 'none',
          }}>ॐ</div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(255,255,255,0.1)',
            color: 'var(--gold-light)', borderRadius: 99,
            padding: '5px 14px', fontSize: 12, fontWeight: 600,
            letterSpacing: '0.07em', marginBottom: 14,
          }}>📚 Sacred Scriptures of Bharat</div>
          <h1 style={{
            fontFamily: 'var(--font-display)', color: 'white',
            fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 700,
            lineHeight: 1.15, marginBottom: 10,
          }}>
            Read the <span style={{ color: 'var(--gold-light)' }}>Sacred Books</span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, maxWidth: 480, margin: '0 auto' }}>
            Full text · Verse-by-verse · Sanskrit · Audio · Bookmarks · Reading progress
          </p>

          {/* Top nav tabs */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 8, marginTop: 22, flexWrap: 'wrap',
          }}>
            {[
              { id: 'library',   label: '🏛️ Library' },
              { id: 'reader',    label: '📖 Reader',   disabled: !bk },
              { id: 'bookmarks', label: `🔖 Bookmarks (${bookmarks.length})` },
              { id: 'search',    label: '🔍 Search',   disabled: !bk },
            ].map(tab => (
              <button
                key={tab.id}
                disabled={tab.disabled}
                onClick={() => !tab.disabled && setView(tab.id)}
                style={{
                  padding: '8px 18px', borderRadius: 99, border: 'none',
                  cursor: tab.disabled ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600,
                  background: view === tab.id ? 'var(--gold-light)' : 'rgba(255,255,255,0.12)',
                  color: view === tab.id ? 'var(--brown)' : tab.disabled ? 'rgba(255,255,255,0.3)' : 'white',
                  transition: 'all 0.18s',
                }}
              >{tab.label}</button>
            ))}
          </div>
        </div>

        {/* ── LIBRARY VIEW ────────────────────────────────────── */}
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
                  fontFamily: 'var(--font-body)', outline: 'none',
                  width: 260,
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
                  return (
                    <div
                      key={book.id}
                      onClick={() => handleSelectBook(book)}
                      style={{
                        background: 'white',
                        border: `2px solid var(--cream-dark)`,
                        borderRadius: 'var(--radius-xl)',
                        padding: '24px',
                        cursor: 'pointer',
                        transition: 'all 0.22s',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = book.accent_color;
                        e.currentTarget.style.transform = 'translateY(-3px)';
                        e.currentTarget.style.boxShadow = `0 8px 28px ${book.accent_color}25`;
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'var(--cream-dark)';
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      {/* Color strip */}
                      <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 4,
                        background: book.accent_color,
                      }} />

                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
                        <span style={{ fontSize: 36 }}>{book.icon_emoji}</span>
                        <div>
                          <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', fontSize: 18, marginBottom: 2 }}>
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
                        {[book.tradition, book.language, `${(book.total_verses||0).toLocaleString()} verses`].map(tag => (
                          <span key={tag} style={{
                            fontSize: 11, padding: '3px 9px', borderRadius: 99,
                            background: `${book.accent_color}18`, color: book.accent_color, fontWeight: 600,
                          }}>{tag}</span>
                        ))}
                      </div>

                      {prog && prog.percent_done > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                            Reading progress · Chapter {prog.last_chapter}
                          </div>
                          <ProgressBar percent={prog.percent_done} color={book.accent_color} />
                        </div>
                      )}

                      <div style={{
                        marginTop: 16, fontSize: 13, fontWeight: 700,
                        color: book.accent_color,
                        display: 'flex', alignItems: 'center', gap: 4,
                      }}>
                        {prog ? 'Continue Reading ›' : 'Start Reading ›'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── READER VIEW ─────────────────────────────────────── */}
        {view === 'reader' && bk && (
          <div style={{
            maxWidth: 1200, margin: '0 auto', padding: '24px 20px',
            display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20,
            alignItems: 'start',
          }}>

            {/* Chapter sidebar */}
            <aside style={{
              background: 'white',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--cream-dark)',
              overflow: 'hidden',
              position: 'sticky',
              top: 84,
              maxHeight: 'calc(100vh - 100px)',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* Book header */}
              <div style={{
                padding: '16px',
                background: bk.accent_color,
                borderBottom: '1px solid rgba(0,0,0,0.1)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>{bk.icon_emoji}</span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', color: 'white', fontWeight: 700, fontSize: 15 }}>{bk.title}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{bk.total_chapters} chapters</div>
                  </div>
                </div>
              </div>

              {/* Chapter list */}
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
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {ch.verse_count || ch.verses_count} verses
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </aside>

            {/* Verse reader */}
            <main ref={readerTopRef}>
              {!selectedChapter && (
                <div style={{
                  background: 'white', borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--cream-dark)',
                  padding: '48px 32px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>{bk.icon_emoji}</div>
                  <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', marginBottom: 10 }}>
                    {bk.title}
                  </h2>
                  <p style={{ color: 'var(--text-light)', fontSize: 15, lineHeight: 1.7, maxWidth: 500, margin: '0 auto 20px' }}>
                    {bk.description}
                  </p>
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
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>
                    ← Select a chapter to begin reading
                  </p>
                </div>
              )}

              {selectedChapter && loadingVerses && (
                <div style={{ background: 'white', borderRadius: 'var(--radius-xl)', border: '1px solid var(--cream-dark)', padding: 40 }}>
                  <Spinner color={bk.accent_color} />
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Loading verses…</p>
                </div>
              )}

              {selectedChapter && chapterData && !loadingVerses && (
                <div>
                  {/* Chapter header */}
                  <div style={{
                    background: 'white', borderRadius: 'var(--radius-xl)',
                    border: `1px solid ${bk.accent_color}33`,
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
                          <p style={{ fontSize: 14, color: 'var(--text-light)', lineHeight: 1.75, maxWidth: 600, margin: 0 }}>
                            {chapterData.summary}
                          </p>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{
                          background: `${bk.accent_color}15`, borderRadius: 'var(--radius)',
                          padding: '10px 16px', textAlign: 'center',
                        }}>
                          <div style={{ fontSize: 22, fontWeight: 700, color: bk.accent_color, fontFamily: 'var(--font-display)' }}>
                            {chapterData.verse_count || chapterData.verses?.length || 0}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Verses</div>
                        </div>
                      </div>
                    </div>

                    {/* Prev / Next navigation */}
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

                  {/* Search bar within reader */}
                  <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    <input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={`Search in ${bk.title}…`}
                      style={{
                        flex: 1, padding: '10px 16px', borderRadius: 99,
                        border: '2px solid var(--cream-dark)', background: 'white',
                        fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none',
                      }}
                    />
                    <button type="submit" style={{
                      padding: '10px 20px', borderRadius: 99, border: 'none',
                      background: bk.accent_color, color: 'white',
                      fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    }}>Search</button>
                  </form>

                  {/* Note if no full text */}
                  {chapterData.note && (
                    <div style={{
                      background: 'var(--cream-mid)', borderRadius: 'var(--radius)',
                      padding: '14px 18px', marginBottom: 20,
                      fontSize: 13, color: 'var(--text-light)',
                    }}>ℹ️ {chapterData.note}</div>
                  )}

                  {/* Verse list */}
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

                  {/* Bottom navigation */}
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
        )}

        {/* ── BOOKMARKS VIEW ──────────────────────────────────── */}
        {view === 'bookmarks' && (
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', marginBottom: 20, fontSize: 22 }}>
              🔖 Your Bookmarks ({bookmarks.length})
            </h2>
            {bookmarks.length === 0 ? (
              <div style={{
                background: 'white', borderRadius: 'var(--radius-xl)',
                border: '1px solid var(--cream-dark)', padding: '48px',
                textAlign: 'center', color: 'var(--text-muted)',
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🔖</div>
                <p>No bookmarks yet. Open a book and tap 🔖 on any verse.</p>
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
                        background: 'white', borderRadius: 'var(--radius-lg)',
                        border: `1px solid ${color}33`,
                        padding: '16px 20px',
                        display: 'flex', alignItems: 'center', gap: 14,
                      }}
                    >
                      <span style={{ fontSize: 24 }}>{bm.icon_emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, color: 'var(--brown)', fontSize: 14, marginBottom: 2 }}>
                          {bm.title} · Ch {bm.chapter_number}, Verse {bm.verse_number}
                        </div>
                        {bm.note && (
                          <div style={{ fontSize: 12, color: 'var(--text-light)', fontStyle: 'italic' }}>{bm.note}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
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

        {/* ── SEARCH RESULTS VIEW ─────────────────────────────── */}
        {view === 'search' && (
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', fontSize: 22 }}>
                Search Results
              </h2>
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
                    <div
                      key={i}
                      style={{
                        background: 'white', borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--cream-dark)', padding: '16px 20px',
                        marginBottom: 12,
                      }}
                    >
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

      {/* Responsive */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 260px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}