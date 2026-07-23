import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  fetchBooks, fetchChapters, fetchChapterVerses,
  searchInBook, saveProgress, fetchAllProgress,
  addBookmark, fetchBookmarks, deleteBookmark,
} from '../services/sacredBooksApi';
import { getCategoryByKey, getCategoryForBook } from '../data/bookCategories';
import {
  THEME_COLOR, THEME_COLOR_DARK, THEME_GOLD,
  BookIcon, Spinner, ProgressBar, Toast, VerseCard,
  getSourceLabel, speakVerse, stopSpeaking, SacredBooksGlobalStyle,
} from '../components/sacredBooksShared';

export default function SacredBookReaderPage() {
  const { category, slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const cat = getCategoryByKey(category);

  const [books, setBooks] = useState([]);
  const [book, setBook] = useState(null);
  const [bookLoading, setBookLoading] = useState(true);
  const [chapters, setChapters] = useState([]);
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [chapterData, setChapterData] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [allProgress, setAllProgress] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [speakingVerse, setSpeakingVerse] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', visible: false });
  const toastTimerRef = useRef(null);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [searching, setSearching] = useState(false);
  const [view, setView] = useState('reader'); // 'reader' | 'bookmarks' | 'search'
  const readerTopRef = useRef(null);

  const showToast = useCallback((message) => {
    clearTimeout(toastTimerRef.current);
    setToast({ message, visible: true });
    toastTimerRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 2200);
  }, []);

  /* Load book list once, find the book matching this slug, plus bookmarks/progress */
  useEffect(() => {
    setBookLoading(true);
    Promise.all([fetchBooks(), fetchBookmarks(), fetchAllProgress()])
      .then(([booksRes, bmRes, progRes]) => {
        setBooks(booksRes.books || []);
        setBookmarks(bmRes.bookmarks || []);
        setAllProgress(progRes.progress || []);
      })
      .catch(console.error)
      .finally(() => setBookLoading(false));
  }, []);

  useEffect(() => {
    const found = books.find(b => b.slug === slug);
    setBook(found || null);
  }, [books, slug]);

  /* Load chapters whenever the book changes */
  useEffect(() => {
    if (!book) return;
    setChapters([]);
    setSelectedChapter(null);
    setChapterData(null);
    setView('reader');
    setLoadingChapters(true);
    fetchChapters(book.slug)
      .then(res => setChapters(res.chapters || []))
      .catch(console.error)
      .finally(() => setLoadingChapters(false));
  }, [book]);

  /* If we arrived via a bookmark/search "jump to verse", auto-select the chapter */
  useEffect(() => {
    const jumpTo = location.state?.jumpTo;
    if (jumpTo && book && chapters.length > 0) {
      handleSelectChapter(jumpTo.chapter).then(() => {
        setTimeout(() => {
          document.getElementById(`verse-${jumpTo.verse}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 600);
      });
      // clear the state so a refresh doesn't re-trigger it
      navigate(location.pathname, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapters]);

  useEffect(() => { setSidebarOpen(false); }, [view, selectedChapter]);

  const handleSelectChapter = useCallback(async (chNum) => {
    if (!book) return;
    stopSpeaking();
    setSpeakingVerse(null);
    setSelectedChapter(chNum);
    setChapterData(null);
    setLoadingVerses(true);
    setSidebarOpen(false);
    readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      const data = await fetchChapterVerses(book.slug, chNum);
      setChapterData(data);
      const pct = Math.round((chNum / book.total_chapters) * 100);
      await saveProgress(book.slug, chNum, 1);
      setAllProgress(prev => {
        const filtered = prev.filter(p => p.slug !== book.slug);
        return [{ slug: book.slug, last_chapter: chNum, last_verse: 1, percent_done: pct }, ...filtered];
      });
    } catch (e) { console.error(e); }
    finally { setLoadingVerses(false); }
  }, [book]);

  const handleBookmarkToggle = useCallback(async (verse) => {
    if (!book) return;
    const existing = bookmarks.find(
      b => b.slug === book.slug &&
           b.chapter_number === verse.chapter_number &&
           b.verse_number === verse.verse_number
    );
    if (existing) {
      await deleteBookmark(existing.id);
      setBookmarks(prev => prev.filter(b => b.id !== existing.id));
      showToast('Bookmark removed');
    } else {
      const res = await addBookmark(book.slug, verse.chapter_number, verse.verse_number);
      setBookmarks(prev => [{
        id: res.bookmark_id, slug: book.slug, title: book.title,
        chapter_number: verse.chapter_number, verse_number: verse.verse_number,
      }, ...prev]);
      showToast('Verse bookmarked');
    }
  }, [book, bookmarks, showToast]);

  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || !book) return;
    setView('search');
    setSearching(true);
    setSearchResults(null);
    try {
      const res = await searchInBook(book.slug, searchQuery);
      setSearchResults(res);
    } catch (e) { console.error(e); }
    finally { setSearching(false); }
  }, [searchQuery, book]);

  const handleSpeak = (key, text) => {
    if (speakingVerse === key) { stopSpeaking(); setSpeakingVerse(null); }
    else { speakVerse(text); setSpeakingVerse(key); }
  };

  const getProgress = (bslug) => allProgress.find(p => p.slug === bslug);

  /* Navigate to another book from the bookmarks list — resolves its own category */
  const goToBookmark = (bm) => {
    const targetBook = books.find(b => b.slug === bm.slug);
    if (!targetBook) return;
    const targetCat = getCategoryForBook(targetBook);
    navigate(`/reader/${bm.slug}`, {
      state: { jumpTo: { chapter: bm.chapter_number, verse: bm.verse_number } },
    });
  };

  const goToSearchResult = (r) => {
    handleSelectChapter(r.chapter_number).then(() => {
      setView('reader');
      setTimeout(() => {
        document.getElementById(`verse-${r.verse_number}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 600);
    });
  };

  /* ── Loading / not-found states ── */
  if (bookLoading) {
    return (
      <>
        <Navbar />
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spinner color={THEME_COLOR} />
        </div>
        <Footer />
      </>
    );
  }

  if (!book || !cat) {
    return (
      <>
        <Navbar />
        <div style={{ maxWidth: 700, margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)' }}>Book not found</h2>
          <button onClick={() => navigate('/library')} style={{
            marginTop: 16, padding: '10px 22px', borderRadius: 99, border: 'none',
            background: THEME_COLOR, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>← Back to Library</button>
        </div>
        <Footer />
      </>
    );
  }

  const bk = book;

  return (
    <>
      <Navbar />
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

        <Toast message={toast.message} visible={toast.visible} />

        {/* ── Hero Banner ── */}
        <div style={{
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
          padding: '40px 12px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', width: '100%', boxSizing: 'border-box',
        }}>
          <div style={{
            position: 'relative', zIndex: 1, width: '100%', maxWidth: 700,
            padding: '0 24px', boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button onClick={() => navigate('/library')} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,213,128,0.3)', borderRadius: 50, padding: '5px 14px',
                color: 'rgba(255,213,128,0.85)', fontSize: 11, cursor: 'pointer', backdropFilter: 'blur(8px)',
              }}>‹ All Categories</button>
              <button onClick={() => navigate(`/library/${cat.key}`)} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,213,128,0.3)', borderRadius: 50, padding: '5px 14px',
                color: 'rgba(255,213,128,0.85)', fontSize: 11, cursor: 'pointer', backdropFilter: 'blur(8px)',
              }}>{cat.icon} {cat.label}</button>
            </div>

            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(24px, 4.5vw, 40px)', lineHeight: 1.1,
              marginBottom: 6, marginTop: 0, color: '#ffffff', width: '100%',
            }}>{bk.title}</h1>
            {bk.sanskrit_title && (
              <div style={{ fontFamily: 'var(--font-hindi)', color: 'rgba(255,213,128,0.85)', fontSize: 15, marginBottom: 18 }}>
                {bk.sanskrit_title}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', width: '100%' }}>
              {[
                { id: 'reader',    label: 'Reader' },
                { id: 'bookmarks', label: `Bookmarks (${bookmarks.length})` },
                { id: 'search',    label: 'Search' },
              ].map(tab => (
                <button key={tab.id} onClick={() => setView(tab.id)} style={{
                  padding: '8px 20px', borderRadius: 50, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: view === tab.id ? '#FFD580' : 'rgba(255,255,255,0.1)',
                  color: view === tab.id ? '#7a3208' : '#FFD580',
                  backdropFilter: 'blur(8px)', border: '1px solid rgba(255,213,128,0.2)',
                  transition: 'all 0.18s', whiteSpace: 'nowrap',
                }}>{tab.label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* ── READER VIEW ── */}
        {view === 'reader' && (
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px' }}>

            <div style={{ display: 'none' }} className="mobile-chapter-toggle">
              <button onClick={() => setSidebarOpen(o => !o)} style={{
                width: '100%', padding: '12px 16px', marginBottom: 12,
                background: THEME_COLOR, color: 'white', border: 'none', borderRadius: 'var(--radius)',
                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <span>{selectedChapter ? `Chapter ${selectedChapter}` : 'Select Chapter'}</span>
                <span>{sidebarOpen ? '▲' : '▼'}</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 20, alignItems: 'start' }} className="reader-grid">

              <aside className={`chapter-sidebar${sidebarOpen ? ' sidebar-open' : ''}`} style={{
                background: 'white', borderRadius: 'var(--radius-lg)', border: `2px solid ${THEME_COLOR}`,
                overflow: 'hidden', position: 'sticky', top: 84, maxHeight: 'calc(100vh - 100px)',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{
                  background: `linear-gradient(135deg, ${THEME_COLOR_DARK} 0%, ${THEME_COLOR} 100%)`,
                  borderBottom: '1px solid rgba(0,0,0,0.1)',
                }}>
                  <button onClick={() => navigate(`/library/${cat.key}`)} style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px',
                    background: 'rgba(0,0,0,0.15)', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.12)',
                    color: THEME_GOLD, fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left',
                  }}>
                    <span style={{ fontSize: 14 }}>‹</span> Back to {cat.label}
                  </button>
                  <div style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <BookIcon size={28} color="rgba(255,255,255,0.95)" />
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', color: 'white', fontWeight: 700, fontSize: 15 }}>{bk.title}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{bk.total_chapters} chapters</div>
                    </div>
                  </div>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {loadingChapters ? <Spinner color={THEME_COLOR} /> : (
                    chapters.map(ch => (
                      <button key={ch.chapter_number} onClick={() => handleSelectChapter(ch.chapter_number)} style={{
                        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', padding: '11px 14px',
                        background: selectedChapter === ch.chapter_number ? `${THEME_COLOR}18` : 'transparent',
                        borderLeft: `3px solid ${selectedChapter === ch.chapter_number ? THEME_COLOR : 'transparent'}`,
                        borderBottom: '1px solid var(--cream-dark)', transition: 'all 0.15s',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            minWidth: 24, height: 24, borderRadius: 6,
                            background: selectedChapter === ch.chapter_number ? THEME_COLOR : 'var(--cream-mid)',
                            color: selectedChapter === ch.chapter_number ? 'white' : 'var(--text-muted)',
                            fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>{ch.chapter_number}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 12, fontWeight: 600,
                              color: selectedChapter === ch.chapter_number ? THEME_COLOR : 'var(--brown)',
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
                  <div style={{ background: 'white', borderRadius: 16, border: `2px solid ${THEME_COLOR}`, padding: '48px 32px', textAlign: 'center' }}>
                    <div style={{
                      width: 80, height: 80, borderRadius: 20, background: `${THEME_COLOR}12`,
                      border: `2px solid ${THEME_COLOR}40`, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', margin: '0 auto 20px',
                    }}>
                      <BookIcon size={52} color={THEME_COLOR} />
                    </div>
                    <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', marginBottom: 10 }}>{bk.title}</h2>
                    <p style={{ color: 'var(--text-light)', fontSize: 15, lineHeight: 1.7, maxWidth: 500, margin: '0 auto 20px' }}>{bk.description}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic', margin: '0 auto 20px' }}>
                      Source: {getSourceLabel(bk)}
                    </p>
                    {getProgress(bk.slug)?.last_chapter && (
                      <button onClick={() => handleSelectChapter(getProgress(bk.slug).last_chapter)} style={{
                        padding: '12px 28px', borderRadius: 99, background: THEME_COLOR, color: 'white',
                        border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                      }}>Continue from Chapter {getProgress(bk.slug).last_chapter} ›</button>
                    )}
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 16 }}>← Select a chapter to begin reading</p>
                  </div>
                )}

                {selectedChapter && loadingVerses && (
                  <div style={{ background: 'white', borderRadius: 16, border: `2px solid ${THEME_COLOR}`, padding: 40 }}>
                    <Spinner color={THEME_COLOR} />
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>Loading verses…</p>
                  </div>
                )}

                {selectedChapter && chapterData && !loadingVerses && (
                  <div>
                    <div style={{ background: 'white', borderRadius: 16, border: `2px solid ${THEME_COLOR}`, padding: '24px 28px', marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: THEME_COLOR, letterSpacing: '0.07em', marginBottom: 6 }}>
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
                            background: `${THEME_COLOR}15`, borderRadius: 'var(--radius)', padding: '10px 16px',
                            textAlign: 'center', border: `1px solid ${THEME_COLOR}30`,
                          }}>
                            <div style={{ fontSize: 22, fontWeight: 700, color: THEME_COLOR, fontFamily: 'var(--font-display)' }}>
                              {chapterData.verse_count || chapterData.verses?.length || 0}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Verses</div>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        {selectedChapter > 1 && (
                          <button onClick={() => handleSelectChapter(selectedChapter - 1)} style={{
                            padding: '8px 16px', borderRadius: 99, border: `1px solid ${THEME_COLOR}44`,
                            background: 'transparent', color: THEME_COLOR, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                          }}>‹ Previous Chapter</button>
                        )}
                        {selectedChapter < bk.total_chapters && (
                          <button onClick={() => handleSelectChapter(selectedChapter + 1)} style={{
                            padding: '8px 16px', borderRadius: 99, border: 'none',
                            background: THEME_COLOR, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600,
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
                          flex: 1, padding: '10px 16px', borderRadius: 99, border: `2px solid ${THEME_COLOR}40`,
                          background: 'white', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none',
                        }}
                      />
                      <button type="submit" style={{
                        padding: '10px 20px', borderRadius: 99, border: 'none',
                        background: THEME_COLOR, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}>Search</button>
                    </form>

                    {chapterData.note && (
                      <div style={{
                        background: 'var(--cream-mid)', borderRadius: 'var(--radius)', padding: '14px 18px',
                        marginBottom: 20, fontSize: 13, color: 'var(--text-light)',
                      }}>ℹ️ {chapterData.note}</div>
                    )}

                    {(chapterData.verses || []).map(verse => (
                      <VerseCard
                        key={`${verse.chapter_number}-${verse.verse_number}`}
                        verse={verse}
                        bookColor={THEME_COLOR}
                        bookmarks={bookmarks}
                        onBookmarkToggle={handleBookmarkToggle}
                        speakingVerse={speakingVerse}
                        onSpeak={handleSpeak}
                      />
                    ))}

                    <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                      {selectedChapter > 1 && (
                        <button onClick={() => handleSelectChapter(selectedChapter - 1)} style={{
                          padding: '12px 24px', borderRadius: 99, border: `1px solid ${THEME_COLOR}44`,
                          background: 'transparent', color: THEME_COLOR, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                        }}>‹ Previous Chapter</button>
                      )}
                      {selectedChapter < bk.total_chapters && (
                        <button onClick={() => handleSelectChapter(selectedChapter + 1)} style={{
                          padding: '12px 24px', borderRadius: 99, border: 'none',
                          background: THEME_COLOR, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700, marginLeft: 'auto',
                        }}>Next Chapter ›</button>
                      )}
                    </div>
                  </div>
                )}
              </main>
            </div>
          </div>
        )}

        {/* ── BOOKMARKS VIEW (all bookmarks across every book) ── */}
        {view === 'bookmarks' && (
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 20px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', marginBottom: 20, fontSize: 22 }}>
              Your Bookmarks ({bookmarks.length})
            </h2>
            {bookmarks.length === 0 ? (
              <div style={{
                background: 'white', borderRadius: 16, border: '2px solid var(--cream-dark)',
                padding: '48px', textAlign: 'center', color: 'var(--text-muted)',
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16, background: 'var(--cream-mid)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                }}>
                  <BookIcon size={40} color="var(--text-muted)" />
                </div>
                <p>No bookmarks yet. Open a book and tap ☆ on any verse to save it.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {bookmarks.map(bm => (
                  <div key={bm.id} style={{
                    background: 'white', borderRadius: 14, border: `2px solid ${THEME_COLOR}`,
                    padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10, background: `${THEME_COLOR}15`,
                      border: `1.5px solid ${THEME_COLOR}40`, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <BookIcon size={28} color={THEME_COLOR} />
                    </div>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontWeight: 700, color: 'var(--brown)', fontSize: 14, marginBottom: 2 }}>
                        {bm.title} · Ch {bm.chapter_number}, Verse {bm.verse_number}
                      </div>
                      {bm.note && <div style={{ fontSize: 12, color: 'var(--text-light)', fontStyle: 'italic' }}>{bm.note}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button onClick={() => goToBookmark(bm)} style={{
                        padding: '6px 14px', borderRadius: 99, border: 'none',
                        background: THEME_COLOR, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}>Go to Verse</button>
                      <button onClick={async () => {
                        await deleteBookmark(bm.id);
                        setBookmarks(prev => prev.filter(b => b.id !== bm.id));
                        showToast('Bookmark removed');
                      }} style={{
                        padding: '6px 10px', borderRadius: 99, border: '1px solid #ef444433',
                        background: 'transparent', color: '#ef4444', fontSize: 12, cursor: 'pointer',
                      }}>Remove</button>
                    </div>
                  </div>
                ))}
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

            {searching && <Spinner color={THEME_COLOR} />}

            {!searching && searchResults && (
              <div>
                {searchResults.results.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
                    No verses found for "{searchResults.query}"
                  </div>
                ) : (
                  searchResults.results.map((r, i) => (
                    <div key={i} style={{
                      background: 'white', borderRadius: 14, border: `2px solid ${THEME_COLOR}`,
                      padding: '16px 20px', marginBottom: 12,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: THEME_COLOR, marginBottom: 6, letterSpacing: '0.06em' }}>
                        {r.chapter_title} · {r.chapter_number}.{r.verse_number}
                      </div>
                      <p style={{ fontSize: 14, color: 'var(--text-mid)', lineHeight: 1.75, margin: '0 0 10px' }}>
                        {r.translation}
                      </p>
                      <button onClick={() => goToSearchResult(r)} style={{
                        padding: '5px 14px', borderRadius: 99, border: 'none',
                        background: THEME_COLOR, color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}>Read in Context ›</button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

      </div>
      <Footer />
      <SacredBooksGlobalStyle />
    </>
  );
}
