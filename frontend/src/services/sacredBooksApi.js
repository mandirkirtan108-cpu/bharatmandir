const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path, options) {
  const response = await fetch(`${BASE}${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

const userToken = () => localStorage.getItem('bm_user_access_token');
const userHeaders = () => {
  const token = userToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const isLoggedIn = () => Boolean(userToken());

// Kept for compatibility with the older category page. Account-backed
// progress no longer depends on this anonymous session id.
export function getSessionId() {
  let sessionId = localStorage.getItem('bm_session_id');
  if (!sessionId) {
    sessionId = `bm_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem('bm_session_id', sessionId);
  }
  return sessionId;
}

export const fetchBooks = () => request('/api/books');
export const fetchLibraryAudio = () => request('/api/library-audio');

export const fetchAllProgress = () => {
  if (!isLoggedIn()) return Promise.resolve({ progress: [] });
  return request('/api/library/progress', { headers: userHeaders() });
};
export const fetchBook = (slug) => request(`/api/books/${encodeURIComponent(slug)}`);
export const fetchBookPages = (slug, language, page = 1, perPage = 10) =>
  request(`/api/books/${encodeURIComponent(slug)}/pages?language=${language}&page=${page}&per_page=${perPage}`);
export const searchInBook = (slug, query, language) =>
  request(`/api/books/${encodeURIComponent(slug)}/search?q=${encodeURIComponent(query)}&language=${language}`);

export const fetchBookSections = (slug) =>
  request(`/api/books/${encodeURIComponent(slug)}/sections`);

export const fetchReadingProgress = (slug) => {
  if (!isLoggedIn()) return Promise.resolve({ progress: null });
  return request(`/api/books/${encodeURIComponent(slug)}/progress`, {
    headers: userHeaders(),
  });
};

export const saveReadingProgress = (slug, language, pageNumber) =>
  request(`/api/books/${encodeURIComponent(slug)}/progress`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...userHeaders() },
    body: JSON.stringify({ language, page_number: pageNumber }),
  });

export const fetchBookmarks = (slug) => {
  if (!isLoggedIn()) return Promise.resolve({ bookmarks: [] });
  return request(`/api/books/${encodeURIComponent(slug)}/bookmarks`, {
    headers: userHeaders(),
  });
};

export const addBookmark = (slug, pageNumber, language) =>
  request(`/api/books/${encodeURIComponent(slug)}/bookmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...userHeaders() },
    body: JSON.stringify({ page_number: pageNumber, language }),
  });

export const removeBookmark = (slug, bookmarkId) =>
  request(`/api/books/${encodeURIComponent(slug)}/bookmarks/${bookmarkId}`, {
    method: 'DELETE',
    headers: userHeaders(),
  });

export async function synthesizeSpeech(text, language, slug, pageNumber) {
  const response = await fetch(`${BASE}/api/books/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language, slug, page_number: pageNumber }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || 'Voice reading failed.');
  }
  return response.blob();
}