import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { fetchBooks, fetchAllProgress, getSessionId } from '../services/sacredBooksApi';
import { getCategoryByKey, getCategoryForBook } from '../data/bookCategories';
import {
  BookIcon, Spinner, ProgressBar, getSourceLabel, SacredBooksGlobalStyle,
} from '../components/sacredBooksShared';

export default function SacredBookCategoryPage() {
  const { category } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const cat = getCategoryByKey(category);

  const [books, setBooks] = useState([]);
  const [allProgress, setAllProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!cat) { setLoading(false); return; }
    Promise.all([fetchBooks(), fetchAllProgress()])
      .then(([booksRes, progRes]) => {
        const all = booksRes.books || [];
        setBooks(all.filter(b => getCategoryForBook(b)?.key === cat.key));
        setAllProgress(progRes.progress || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [category]);

  const getProgress = (slug) => allProgress.find(p => p.slug === slug);

  const filteredBooks = books.filter(b =>
    !filter ||
    b.title.toLowerCase().includes(filter.toLowerCase()) ||
    b.deity?.toLowerCase().includes(filter.toLowerCase()) ||
    b.tradition?.toLowerCase().includes(filter.toLowerCase())
  );

  if (!cat) {
    return (
      <>
        <Navbar />
        <div style={{ maxWidth: 700, margin: '80px auto', textAlign: 'center', padding: '0 20px' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)' }}>{t('book_category.not_found')}</h2>
          <button onClick={() => navigate('/library')} style={{
            marginTop: 16, padding: '10px 22px', borderRadius: 99, border: 'none',
            background: '#8b3a15', color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>← {t('book_category.back_library')}</button>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

        {/* ── Hero Banner ── */}
        <div style={{
          position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, #4b1d04 0%, #7a3208 55%, #a14a0b 100%)',
          padding: '50px 12px', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', width: '100%', boxSizing: 'border-box',
        }}>
          <div style={{
            position: 'relative', zIndex: 1, width: '100%', maxWidth: 700,
            padding: '0 24px', boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          }}>
            <button
              onClick={() => navigate('/library')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,213,128,0.3)', borderRadius: 50, padding: '5px 16px', marginBottom: 14,
                color: 'rgba(255,213,128,0.85)', fontSize: 11, letterSpacing: '.06em',
                cursor: 'pointer', backdropFilter: 'blur(8px)',
              }}
            >‹ {t('book_category.all_categories')}</button>

            <div style={{ fontSize: 40, marginBottom: 6 }}>{cat.icon}</div>

            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(26px, 5vw, 44px)', lineHeight: 1.1,
              marginBottom: 6, marginTop: 0, color: '#ffffff', width: '100%',
            }}>
              {t(`books.categories.${cat.key}.label`, { defaultValue: cat.label })}
            </h1>
            <div style={{ fontFamily: 'var(--font-hindi)', color: 'rgba(255,213,128,0.85)', fontSize: 16, marginBottom: 10 }}>
              {cat.sanskrit}
            </div>
            <p style={{
              color: 'rgba(255,255,255,0.7)', fontSize: 14, width: '100%', maxWidth: 520,
              margin: 0, fontWeight: 300, lineHeight: 1.7, textAlign: 'center',
            }}>
              {t(`books.categories.${cat.key}.description`, { defaultValue: cat.description })}
            </p>
          </div>
        </div>

        {/* ── Book Grid ── */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', fontSize: 20 }}>
              {t('book_category.folder_count', { count: books.length })}
            </h2>
            <input
              placeholder={t('book_category.filter_placeholder')}
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{
                padding: '9px 16px', borderRadius: 99, border: '2px solid var(--cream-dark)',
                background: 'white', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', width: 260,
              }}
            />
          </div>

          {loading ? <Spinner /> : filteredBooks.length === 0 ? (
            <div style={{
              background: 'white', borderRadius: 16, border: '2px solid var(--cream-dark)',
              padding: '48px', textAlign: 'center', color: 'var(--text-muted)',
            }}>{t('book_category.empty')}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 18 }}>
              {filteredBooks.map(book => {
                const prog = getProgress(book.slug);
                return (
                  <div
                    key={book.id}
                    onClick={() => navigate(`/reader/${book.slug}`)}
                    style={{
                      background: '#fffdf9', border: '1px solid #e8ddd0', borderRadius: 14,
                      overflow: 'hidden', cursor: 'pointer',
                      transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                      boxShadow: '0 1px 4px rgba(90,50,20,0.07)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 28px rgba(90,50,20,0.13)';
                      e.currentTarget.style.borderColor = '#c2824a';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 1px 4px rgba(90,50,20,0.07)';
                      e.currentTarget.style.borderColor = '#e8ddd0';
                    }}
                  >
                    <div style={{
                      background: 'linear-gradient(135deg, #5c2208 0%, #8b3a15 100%)',
                      padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 13,
                    }}>
                      <div style={{
                        width: 46, height: 46, borderRadius: 9, background: 'rgba(255,255,255,0.1)',
                        border: '1.5px solid rgba(255,213,128,0.3)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <BookIcon size={32} color="#FFD580" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{
                          fontFamily: 'var(--font-display)', color: '#ffffff', fontSize: 15, fontWeight: 700,
                          margin: 0, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{i18n.resolvedLanguage === 'hi' ? (book.title_hi || book.title) : book.title}</h3>
                        <div style={{
                          fontFamily: 'var(--font-hindi)', fontSize: 12, color: 'rgba(255,213,128,0.8)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{book.sanskrit_title}</div>
                      </div>
                    </div>

                    <div style={{ padding: '15px 18px 18px' }}>
                      <p style={{ fontSize: 13, color: '#6b5744', lineHeight: 1.72, marginBottom: 13, marginTop: 0 }}>
                        {(i18n.resolvedLanguage === 'hi' ? (book.description_hi || book.description) : book.description)?.slice(0, 110)}…
                      </p>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                        {[book.tradition, book.language, t('book_category.chapters_short', { count: book.total_chapters }), t('book_category.verses', { count: book.total_verses || 0 })]
                          .filter(Boolean).map(tag => (
                          <span key={tag} style={{
                            fontSize: 11, padding: '3px 9px', borderRadius: 99, background: '#f4ede4',
                            color: '#7a4a2a', fontWeight: 600, border: '1px solid #e2d0be',
                          }}>{tag}</span>
                        ))}
                      </div>

                      <div style={{
                        fontSize: 10.5, color: '#a07860', marginBottom: 13, lineHeight: 1.5,
                        display: 'flex', alignItems: 'baseline', gap: 5,
                      }}>
                        <span style={{ opacity: 0.75, flexShrink: 0 }}>Source:</span>
                        <span style={{ fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {getSourceLabel(book)}
                        </span>
                      </div>

                      <div style={{ height: 1, background: '#eee5d9', marginBottom: 13 }} />

                      {prog && prog.percent_done > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: '#9a7a62', marginBottom: 5 }}>
                            {t('book_category.progress', { chapter: prog.last_chapter, percent: prog.percent_done })}
                          </div>
                          <ProgressBar percent={prog.percent_done} color="#8b3a15" />
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#8b3a15' }}>
                          {prog && prog.percent_done > 0 ? t('book_category.continue') : t('book_category.start')}
                        </span>
                        {book.tradition && (
                          <span style={{
                            fontSize: 10, color: '#a07860', background: '#f4ede4',
                            padding: '2px 8px', borderRadius: 99, border: '1px solid #e2d0be',
                          }}>{book.tradition}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <Footer />
      <SacredBooksGlobalStyle />
    </>
  );
}
