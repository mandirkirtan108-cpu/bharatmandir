const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Same localStorage key the user-auth service (services/api.js) saves the
// access token under — reused here so the reader can tell who's logged in
// without introducing a second auth system.
const USER_ACCESS_KEY = 'bm_user_access_token';

async function request(path, options) {
  const response = await fetch(`${BASE}${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "We couldn't open the sacred library right now. Please try again in a few moments.");
  }
  return response.json();
}

function authHeaders() {
  const token = localStorage.getItem(USER_ACCESS_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const fetchBooks = () => request('/api/books');
export const fetchBook = (slug) => request(`/api/books/${encodeURIComponent(slug)}`);
export const fetchBookPages = (slug, language, page = 1, perPage = 10) =>
  request(`/api/books/${encodeURIComponent(slug)}/pages?language=${language}&page=${page}&per_page=${perPage}`);
export const searchInBook = (slug, query, language) =>
  request(`/api/books/${encodeURIComponent(slug)}/search?q=${encodeURIComponent(query)}&language=${language}`);

// AI-generated table of contents — [{ title, page_number }, ...]
export const fetchBookSections = (slug) =>
  request(`/api/books/${encodeURIComponent(slug)}/sections`);

// Per-user reading progress. Guests (no token) simply get { progress: null }
// back from the GET and should not call the PUT.
export const fetchReadingProgress = (slug) =>
  request(`/api/books/${encodeURIComponent(slug)}/progress`, { headers: authHeaders() });

export const saveReadingProgress = (slug, language, pageNumber) =>
  request(`/api/books/${encodeURIComponent(slug)}/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ language, page_number: pageNumber }),
  });

export const isLoggedIn = () => !!localStorage.getItem(USER_ACCESS_KEY);

// Voice reading — sends the page's text to the backend, which synthesizes
// it via OpenRouter and streams back an MP3 (or, once a page's audio has
// been generated before, redirects straight to the stored Cloudinary URL).
// Passing slug + pageNumber lets the backend cache/reuse per page; both
// are optional, falling back to a one-off, unstored synthesis without them.
export const synthesizeSpeech = async (text, language, slug, pageNumber) => {
  const response = await fetch(`${BASE}/api/books/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, slug, page_number: pageNumber }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "We couldn't prepare the sacred reading right now. Please try again in a few moments.");
  }
  return response.blob();
};

// This user's progress across every book, keyed by slug — used by the
// shelf page to show "Continue reading". Comes straight from the same
// DB table the reader page saves to, so it's never stale or device-local.
export const fetchAllProgress = () =>
  request('/api/library/progress', { headers: authHeaders() });

// Per-user bookmarks — stored under the account (user_id) on the backend,
// so they show the same list on any device the user signs into. Guests
// (no token) get back an empty list and cannot add one.
export const fetchBookmarks = (slug) =>
  request(`/api/books/${encodeURIComponent(slug)}/bookmarks`, { headers: authHeaders() });

export const addBookmark = (slug, pageNumber, language, label) =>
  request(`/api/books/${encodeURIComponent(slug)}/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ page_number: pageNumber, language, label }),
  });

export const removeBookmark = (slug, bookmarkId) =>
  request(`/api/books/${encodeURIComponent(slug)}/bookmarks/${bookmarkId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
