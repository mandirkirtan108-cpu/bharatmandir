import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { fetchBooks } from '../services/sacredBooksApi';
import { CATEGORIES, groupBooksByCategory } from '../data/bookCategories';
import {
  BookIcon, FolderIcon, Spinner, SacredBooksGlobalStyle,
} from '../components/sacredBooksShared';

export default function SacredBooksPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetchBooks()
      .then(res => setBooks(res.books || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const grouped = groupBooksByCategory(books);

  const visibleCategories = CATEGORIES.filter(cat => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      cat.label.toLowerCase().includes(q) ||
      cat.sanskrit.includes(filter) ||
      grouped[cat.key].some(b => b.title.toLowerCase().includes(q))
    );
  });

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
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,213,128,0.3)',
              borderRadius: 50, padding: '5px 16px', marginBottom: 14,
              color: 'rgba(255,213,128,0.85)', fontSize: 11, letterSpacing: '.1em',
              textTransform: 'uppercase', fontWeight: 500, backdropFilter: 'blur(8px)', whiteSpace: 'nowrap',
            }}>
              <BookIcon size={16} color="rgba(255,213,128,0.9)" />
              {t('books.badge')}
            </div>

            <h1 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1,
              marginBottom: 10, marginTop: 0, textShadow: '0 4px 40px rgba(0,0,0,0.3)',
              color: '#ffffff', width: '100%',
            }}>
              {t('books.title')}
            </h1>

            <p style={{
              color: 'rgba(255,255,255,0.7)', fontSize: 14, width: '100%', maxWidth: 520,
              margin: '0 0 22px 0', fontWeight: 300, lineHeight: 1.7, textAlign: 'center',
            }}>
              {t('books.subtitle')}
            </p>
          </div>
        </div>

        {/* ── Folder Grid ── */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brown)', fontSize: 22 }}>
              {t('books.library')}
            </h2>
            <input
              placeholder={t('books.filter_placeholder')}
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{
                padding: '9px 16px', borderRadius: 99, border: '2px solid var(--cream-dark)',
                background: 'white', fontSize: 13, fontFamily: 'var(--font-body)', outline: 'none', width: 260,
              }}
            />
          </div>

          {loading ? <Spinner /> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
              {visibleCategories.map(cat => {
                const catBooks = grouped[cat.key];
                if (filter && catBooks.length === 0 &&
                    !cat.label.toLowerCase().includes(filter.toLowerCase())) return null;
                return (
                  <div
                    key={cat.key}
                    onClick={() => navigate(`/library/${cat.key}`)}
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
                      padding: '18px', display: 'flex', alignItems: 'center', gap: 14,
                    }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: 12,
                        background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,213,128,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 26,
                      }}>
                        {cat.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{
                          fontFamily: 'var(--font-display)', color: '#ffffff', fontSize: 17, fontWeight: 700,
                          margin: 0, marginBottom: 2,
                        }}>{t(`books.categories.${cat.key}.label`, { defaultValue: cat.label })}</h3>
                        <div style={{ fontFamily: 'var(--font-hindi)', fontSize: 13, color: 'rgba(255,213,128,0.8)' }}>
                          {cat.sanskrit}
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: '15px 18px 18px' }}>
                      <p style={{ fontSize: 13, color: '#6b5744', lineHeight: 1.72, marginBottom: 13, marginTop: 0 }}>
                        {t(`books.categories.${cat.key}.description`, { defaultValue: cat.description })}
                      </p>
                      <div style={{ height: 1, background: '#eee5d9', marginBottom: 13 }} />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#8b3a15' }}>
                          {t('books.open_folder')} ›
                        </span>
                        <span style={{
                          fontSize: 10, color: '#a07860', background: '#f4ede4',
                          padding: '2px 8px', borderRadius: 99, border: '1px solid #e2d0be',
                        }}>
                          {loading ? '…' : t('books.count', { count: catBooks.length })}
                        </span>
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
