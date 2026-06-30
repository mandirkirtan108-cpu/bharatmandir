const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const memoryCache = new Map();

function cacheKey(lang, text) {
  return `${lang}:${String(text || '').trim()}`;
}

function readPersistentCache(key) {
  try {
    return localStorage.getItem(`bm_translate:${key}`);
  } catch {
    return null;
  }
}

function writePersistentCache(key, value) {
  try {
    if (value && value.length < 2000) {
      localStorage.setItem(`bm_translate:${key}`, value);
    }
  } catch {
    // Browser storage may be full or disabled.
  }
}

export async function translateTextBatch(texts, targetLang = 'hi') {
  const unique = [...new Set(
    texts
      .map(text => String(text || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
  )];

  const result = {};
  const missing = [];

  for (const text of unique) {
    const key = cacheKey(targetLang, text);
    if (memoryCache.has(key)) {
      result[text] = memoryCache.get(key);
      continue;
    }
    const stored = readPersistentCache(key);
    if (stored) {
      memoryCache.set(key, stored);
      result[text] = stored;
      continue;
    }
    missing.push(text);
  }

  if (missing.length === 0) return result;

  const response = await fetch(`${API_BASE}/api/translate/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts: missing, target_lang: targetLang }),
  });

  if (!response.ok) return result;
  const data = await response.json();
  const translations = data.translations || {};

  for (const [source, translated] of Object.entries(translations)) {
    const key = cacheKey(targetLang, source);
    memoryCache.set(key, translated);
    writePersistentCache(key, translated);
    result[source] = translated;
  }

  return result;
}
