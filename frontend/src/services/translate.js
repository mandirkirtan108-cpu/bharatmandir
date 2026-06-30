import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Fix: translate.js is in src/services/, locales are in src/locales/
import en from '../locales/en.json';
import hi from '../locales/hi.json';
import mr from '../locales/mr.json';
import ta from '../locales/ta.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
      mr: { translation: mr },
      ta: { translation: ta },
    },
    fallbackLng: 'en',
    lng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'bharatmandir_lang',
    },
  });

export default i18n;

// ─── Temple translation helpers ───────────────────────────────────────────────
const FIELDS_TO_TRANSLATE = [
  'name', 'name_hindi', 'primary_deity', 'history',
  'significance', 'description', 'address', 'city', 'state',
];

async function callTranslateAPI(texts, targetLang) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) return texts;

  const langNames = { hi: 'Hindi', mr: 'Marathi', ta: 'Tamil' };
  const langName  = langNames[targetLang] || targetLang;

  const prompt = `Translate the following JSON values to ${langName}. Return ONLY a valid JSON object with the same keys, translated values. No explanation or markdown.\n\n${JSON.stringify(texts)}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data  = await res.json();
    const raw   = data?.content?.[0]?.text || '{}';
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return texts;
  }
}

export async function translateTemple(temple, lang) {
  if (!temple || lang === 'en') return temple;
  const toTranslate = {};
  for (const field of FIELDS_TO_TRANSLATE) {
    if (temple[field] && typeof temple[field] === 'string') {
      toTranslate[field] = temple[field];
    }
  }
  if (Object.keys(toTranslate).length === 0) return temple;
  const translated = await callTranslateAPI(toTranslate, lang);
  return { ...temple, ...translated };
}

export async function translateTemples(temples, lang) {
  if (!temples?.length || lang === 'en') return temples;
  const results = await Promise.allSettled(
    temples.map(t => translateTemple(t, lang))
  );
  return results.map((r, i) =>
    r.status === 'fulfilled' ? r.value : temples[i]
  );
}