import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import BookCard3D from '../components/BookCard3D';
import { libraryAPI } from '../../services/api';

export default function LibraryPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [booksByCategory, setBooksByCategory] = useState({});
  const [continueReading, setContinueReading] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: cats } = await libraryAPI.getCategories();
        setCategories(cats);

        const results = await Promise.all(
          cats.map((c) => libraryAPI.getBooks({ category: c.slug, limit: 12 }))
        );
        const grouped = {};
        cats.forEach((c, i) => {
          grouped[c.slug] = results[i].data;
        });
        setBooksByCategory(grouped);
      } catch (err) {
        console.error('Failed to load library', err);
      } finally {
        setLoading(false);
      }
    })();

    // Continue-reading only applies to logged-in users — fail silently
    // if not authenticated, same pattern as templeAPI.getMedia().
    libraryAPI.getContinueReading()
      .then((res) => setContinueReading(res.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const timeout = setTimeout(() => {
      libraryAPI.getBooks({ search: searchQuery, limit: 24 })
        .then((res) => setSearchResults(res.data))
        .catch(() => setSearchResults([]));
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  return (
    <>
      <Navbar />
      <div className="library-page">
        <div className="library-hero">
          <h1>{t('library.title', 'Sacred Books Library')}</h1>
          <p>{t('library.subtitle', 'Read scripture the way it was meant to be read.')}</p>

          <div className="library-search">
            <Search size={18} />
            <input
              type="text"
              placeholder={t('library.searchPlaceholder', 'Search by title or author...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {searchResults !== null ? (
          <section className="library-row">
            <h2>{t('library.searchResults', 'Search results')}</h2>
            <div className="library-row__scroll">
              {searchResults.map((book) => (
                <BookCard3D key={book.id} book={book} />
              ))}
              {searchResults.length === 0 && <p className="library-empty">{t('library.noResults', 'No books found.')}</p>}
            </div>
          </section>
        ) : (
          <>
            {continueReading.length > 0 && (
              <section className="library-row">
                <h2>{t('library.continueReading', 'Continue Reading')}</h2>
                <div className="library-row__scroll">
                  {continueReading.map((item) => (
                    <BookCard3D
                      key={item.book_id}
                      book={{ slug: item.slug, title: item.title, cover_image_url: item.cover_image_url }}
                      progressPct={item.total_pages ? Math.round((item.current_page / item.total_pages) * 100) : null}
                    />
                  ))}
                </div>
              </section>
            )}

            {loading ? (
              <p className="library-loading">{t('common.loading', 'Loading...')}</p>
            ) : (
              categories.map((cat) => {
                const books = booksByCategory[cat.slug] || [];
                if (books.length === 0) return null;
                return (
                  <section className="library-row" key={cat.id}>
                    <h2>{cat.name}</h2>
                    <div className="library-row__scroll">
                      {books.map((book) => (
                        <BookCard3D key={book.id} book={book} />
                      ))}
                    </div>
                  </section>
                );
              })
            )}
          </>
        )}
      </div>
      <Footer />
    </>
  );
}