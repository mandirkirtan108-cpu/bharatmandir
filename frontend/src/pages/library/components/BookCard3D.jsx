import { BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function BookCard3D({ book, progressPct = null, pageNumber = 1 }) {
  const navigate = useNavigate();
  const bookId = book.id ?? book.book_id;
  const languages = book.available_languages || book.translation_languages || [];
  const languageLabel = Array.isArray(languages) ? languages.join(' · ') : languages;

  return (
    <button
      type="button"
      className="book-card-3d"
      onClick={() => navigate(`/library/${bookId}/read/${pageNumber || 1}`)}
      disabled={bookId == null}
    >
      <span className="book-card-3d__cover">
        {book.cover_image_url ? (
          <img src={book.cover_image_url} alt="" loading="lazy" />
        ) : (
          <BookOpen size={48} aria-hidden="true" />
        )}
      </span>
      <span className="book-card-3d__details">
        <strong>{book.title}</strong>
        {(book.author || book.author_name) && <small>{book.author || book.author_name}</small>}
        {languageLabel && <small className="book-card-3d__translation">{languageLabel}</small>}
        {progressPct != null && (
          <span className="book-card-3d__progress">
            <span style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }} />
          </span>
        )}
      </span>
    </button>
  );
}
