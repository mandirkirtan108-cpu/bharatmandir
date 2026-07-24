const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request(path, options) {
  const response = await fetch(`${BASE}${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

export const fetchBooks = () => request('/api/books');
export const fetchBook = (slug) => request(`/api/books/${encodeURIComponent(slug)}`);
export const fetchBookPages = (slug, language, page = 1, perPage = 10) =>
  request(`/api/books/${encodeURIComponent(slug)}/pages?language=${language}&page=${page}&per_page=${perPage}`);
export const searchInBook = (slug, query, language) =>
  request(`/api/books/${encodeURIComponent(slug)}/search?q=${encodeURIComponent(query)}&language=${language}`);