import { Link } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

/**
 * Book cover rendered with a tilt-on-hover 3D effect and a visible
 * "spine" strip, so it reads as an object with physical presence
 * rather than a file-list row. Pure CSS 3D transform — no library.
 */
export default function BookCard3D({ book, progressPct = null }) {
  if (!book || !book.slug) return null;

  const spineColor = book.category_slug ? `var(--spine-${book.category_slug}, #7c4a2d)` : '#7c4a2d';

  return (
    <Link to={`/library/${book.slug}`} className="book-card-3d">
      <div className="book-card-3d__spine" style={{ background: spineColor }} />
      <div className="book-card-3d__cover">
        {book.cover_image_url ? (
          <img src={book.cover_image_url} alt={book.title} />
        ) : (
          <div className="book-card-3d__placeholder">
            <BookOpen size={28} />
            <span>{book.title}</span>
          </div>
        )}

        {progressPct !== null && (
          <div className="book-card-3d__progress">
            <div className="book-card-3d__progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
        )}
      </div>
      <div className="book-card-3d__label">
        <p className="book-card-3d__title">{book.title}</p>
        {book.author && <p className="book-card-3d__author">{book.author}</p>}
      </div>
    </Link>
  );
}