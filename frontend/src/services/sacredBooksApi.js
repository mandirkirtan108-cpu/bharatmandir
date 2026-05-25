// frontend/src/services/sacredBooksApi.js
// All API calls for the Sacred Books feature

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Session ID (anonymous user tracking) ─────────────────────────────────────
// Stored in localStorage so it persists across sessions
export function getSessionId() {
  let sid = localStorage.getItem("bm_session_id");
  if (!sid) {
    sid = "bm_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem("bm_session_id", sid);
  }
  return sid;
}

// ── Books ─────────────────────────────────────────────────────────────────────
export async function fetchBooks() {
  const r = await fetch(`${BASE}/api/books`);
  if (!r.ok) throw new Error("Failed to load books");
  return r.json(); // { books: [...] }
}

export async function fetchBook(slug) {
  const r = await fetch(`${BASE}/api/books/${slug}`);
  if (!r.ok) throw new Error("Book not found");
  return r.json();
}

// ── Chapters ──────────────────────────────────────────────────────────────────
export async function fetchChapters(slug) {
  const r = await fetch(`${BASE}/api/books/${slug}/chapters`);
  if (!r.ok) throw new Error("Failed to load chapters");
  return r.json(); // { chapters: [...] }
}

export async function fetchChapterVerses(slug, chapterNum) {
  const r = await fetch(`${BASE}/api/books/${slug}/chapters/${chapterNum}`);
  if (!r.ok) throw new Error("Failed to load chapter");
  return r.json();
  // { chapter_number, title, summary, verse_count, verses: [...] }
}

// ── Search ────────────────────────────────────────────────────────────────────
export async function searchInBook(slug, query) {
  const r = await fetch(`${BASE}/api/books/${slug}/search?q=${encodeURIComponent(query)}`);
  if (!r.ok) throw new Error("Search failed");
  return r.json(); // { query, total, results: [...] }
}

// ── Reading Progress ──────────────────────────────────────────────────────────
export async function saveProgress(slug, lastChapter, lastVerse) {
  const session_id = getSessionId();
  await fetch(`${BASE}/api/books/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id, slug, last_chapter: lastChapter, last_verse: lastVerse }),
  });
}

export async function fetchAllProgress() {
  const session_id = getSessionId();
  const r = await fetch(`${BASE}/api/books/progress/${session_id}`);
  if (!r.ok) return { progress: [] };
  return r.json(); // { progress: [...] }
}

// ── Bookmarks ─────────────────────────────────────────────────────────────────
export async function addBookmark(slug, chapterNumber, verseNumber, note = "") {
  const session_id = getSessionId();
  const r = await fetch(`${BASE}/api/books/bookmarks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id, slug, chapter_number: chapterNumber, verse_number: verseNumber, note }),
  });
  if (!r.ok) throw new Error("Bookmark failed");
  return r.json();
}

export async function fetchBookmarks() {
  const session_id = getSessionId();
  const r = await fetch(`${BASE}/api/books/bookmarks/${session_id}`);
  if (!r.ok) return { bookmarks: [] };
  return r.json();
}

export async function deleteBookmark(bookmarkId) {
  const session_id = getSessionId();
  await fetch(`${BASE}/api/books/bookmarks/${bookmarkId}?session_id=${session_id}`, {
    method: "DELETE",
  });
}