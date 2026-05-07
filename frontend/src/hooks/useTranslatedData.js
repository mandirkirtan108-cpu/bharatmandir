import { useState, useEffect } from 'react';
import { useLang } from '../LangContext';
import { translateTemples, translateTemple } from '../services/translate';

export function useTranslatedTemples(temples) {
  const { lang } = useLang();
  const [translated,  setTranslated]  = useState(temples);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (!temples || temples.length === 0) { setTranslated(temples); return; }
    if (lang === 'en') { setTranslated(temples); return; }
    setTranslating(true);
    translateTemples(temples, lang)
      .then(setTranslated)
      .catch(() => setTranslated(temples))   // FIX: always fallback, never leave null
      .finally(() => setTranslating(false));
  }, [temples, lang]);

  return { translated, translating };
}

export function useTranslatedTemple(temple) {
  const { lang } = useLang();

  // FIX: Initialize with temple directly — never null when data exists
  const [translated,  setTranslated]  = useState(temple);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (!temple) { setTranslated(null); return; }

    // Always show data immediately in English first
    setTranslated(temple);

    if (lang === 'en') return;  // English — done, no API call needed

    // Other languages — translate in background
    setTranslating(true);
    translateTemple(temple, lang)
      .then(setTranslated)
      .catch(() => setTranslated(temple))   // FIX: fallback to English on error
      .finally(() => setTranslating(false));
  }, [temple, lang]);

  return { translated, translating };
}