import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import BookCard3D from '../components/BookCard3D';
import { libraryAPI } from '../../services/api';
import '../library.css';

const asList = (value) => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.books)) return value.books;
  if (Array.isArray(value?.categories)) return value.categories;
  return [];
};

export default function LibraryPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [booksByCategory, setBooksByCategory] = useState({});
  const [continueReading, setContinueReading] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const { data } = await libraryAPI.getCategories();
        const cats = asList(data);
        if (!active) return;
        setCategories(cats);

        const results = await Promise.all(
          cats.map((category) =>
            libraryAPI.getBooks({ category: category.slug, limit: 12 })
          )
        );
        if (!active) return;

        const grouped = {};
        cats.forEach((category, index) => {
          grouped[category.slug] = asList(results[index].data);
        });
        setBooksByCategory(grouped);
      } catch (err) {
        console.error('Failed to load library', err);
        if (active) setError(t('library.loadError', 'Unable to load the library right now.'));
      } finally {
        if (active) setLoading(false);
      }
    })();

    libraryAPI.getContinueReading()
      .then(({ data }) => {
        if (active) setContinueReading(asList(data));
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return undefined;
    }

    const timeout = setTimeout(() => {
      libraryAPI.getBooks({ search: searchQuery.trim(), limit: 24 })
        .then(({ data }) => setSearchResults(asList(data)))
        .catch(() => setSearchResults([]));
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  return (
    <>
      <Navbar />
      <main className="library-page">
        <div className="library-hero">
          <h1>{t('library.title', 'Sacred Books Library')}</h1>
          <p>{t('library.subtitle', 'Read scripture the way it was meant to be read.')}</p>

          <label className="library-search">
            <Search size={18} />
            <input
              type="search"
              placeholder={t('library.searchPlaceholder', 'Search by title or author...')}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </label>
        </div>

        {searchResults !== null ? (
          <section className="library-row">
            <h2>{t('library.searchResults', 'Search results')}</h2>
            <div className="library-row__scroll">
              {searchResults.map((book) => <BookCard3D key={book.id} book={book} />)}
              {searchResults.length === 0 && (
                <p className="library-empty">{t('library.noResults', 'No books found.')}</p>
              )}
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
                      book={{
                        id: item.book_id,
                        slug: item.slug,
                        title: item.title,
                        cover_image_url: item.cover_image_url,
                      }}
                      progressPct={
                        item.total_pages
                          ? Math.round((item.current_page / item.total_pages) * 100)
                          : null
                      }
                      pageNumber={item.current_page}
                    />
                  ))}
                </div>
              </section>
            )}

            {loading && (
              <p className="library-loading">{t('common.loading', 'Loading...')}</p>
            )}
            {!loading && error && <p className="library-empty">{error}</p>}
            {!loading && !error && categories.map((category) => {
              const books = booksByCategory[category.slug] || [];
              if (books.length === 0) return null;
              return (
                <section className="library-row" key={category.id ?? category.slug}>
                  <h2>{category.name}</h2>
                  <div className="library-row__scroll">
                    {books.map((book) => <BookCard3D key={book.id} book={book} />)}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
