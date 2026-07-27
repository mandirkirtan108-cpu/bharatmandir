const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Same localStorage key the user-auth service (services/api.js) saves the
// access token under — reused here so the reader can tell who's logged in
// without introducing a second auth system.
const USER_ACCESS_KEY = 'bm_user_access_token';

async function request(path, options) {
  const response = await fetch(`${BASE}${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status})`);
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