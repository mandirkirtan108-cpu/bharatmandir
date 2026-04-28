const CACHE = new Map();

const FIELD_MAP = {
  hi: 'Hindi',
  mr: 'Marathi',
  ta: 'Tamil',
};

// Fields from backend that should be translated
const TRANSLATABLE_FIELDS = [
  'name', 'history', 'significance', 'description',
  'primary_deity', 'sect', 'temple_type', 'architecture_style',
  'dress_code', 'best_time_to_visit', 'address',
  'nearest_railway', 'nearest_airport', 'city', 'state',
];

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const HEADERS = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
  'anthropic-version': '2023-06-01',
  'anthropic-dangerous-direct-browser-access': 'true',
};

export async function translateTemple(temple, targetLang) {
  if (targetLang === 'en') return temple;

  const cacheKey = `${temple.id}_${targetLang}`;
  if (CACHE.has(cacheKey)) return CACHE.get(cacheKey);

  const fieldsToTranslate = {};
  TRANSLATABLE_FIELDS.forEach(field => {
    if (temple[field]) fieldsToTranslate[field] = temple[field];
  });

  const langName = FIELD_MAP[targetLang] || targetLang;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Translate the following temple data fields to ${langName}. 
Return ONLY a valid JSON object with the same keys, values translated to ${langName}.
Do not translate proper nouns like specific deity names (e.g. Shiva, Vishnu, Ram), 
temple names that are Sanskrit/proper names, or place names that are universally known.
Translate descriptions, history, significance, and general text naturally.

Data to translate:
${JSON.stringify(fieldsToTranslate, null, 2)}

Return only the JSON object, no explanation.`,
        }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return temple;
    }

    const raw        = data.content?.[0]?.text || '{}';
    const clean      = raw.replace(/```json|```/g, '').trim();
    const translated = JSON.parse(clean);

    const result = { ...temple, ...translated };
    CACHE.set(cacheKey, result);
    return result;

  } catch (err) {
    console.error('Translation failed, falling back to English:', err);
    return temple;
  }
}

// Translate an array of temples
export async function translateTemples(temples, targetLang) {
  if (targetLang === 'en') return temples;
  return Promise.all(temples.map(t => translateTemple(t, targetLang)));
}

// Translate a single string
export async function translateText(text, targetLang) {
  if (targetLang === 'en' || !text) return text;

  const cacheKey = `text_${targetLang}_${text.slice(0, 40)}`;
  if (CACHE.has(cacheKey)) return CACHE.get(cacheKey);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Translate this text to ${FIELD_MAP[targetLang]}. Return only the translated text, nothing else:\n\n${text}`,
        }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return text;
    }

    const result = data.content?.[0]?.text?.trim() || text;
    CACHE.set(cacheKey, result);
    return result;
  } catch {
    return text;
  }
}

// Clear cache (call this if needed)
export function clearTranslationCache() {
  CACHE.clear();
}