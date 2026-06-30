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
      .catch(() => setTranslated(temples))
      .finally(() => setTranslating(false));
  }, [temples, lang]);

  return { translated, translating };
}

export function useTranslatedTemple(temple) {
  const { lang } = useLang();

  // Initialize with temple directly so English data is always shown immediately
  const [translated,  setTranslated]  = useState(temple);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (!temple) { setTranslated(null); return; }

    // Always show English data immediately — never leave screen blank
    setTranslated(temple);

    if (lang === 'en') return;

    // Translate in background; on any error fall back to English
    setTranslating(true);
    translateTemple(temple, lang)
      .then(result => {
        // Extra safety: if translation somehow returned something falsy,
        // keep the original English temple object
        setTranslated(result || temple);
      })
      .catch(() => setTranslated(temple))
      .finally(() => setTranslating(false));
  }, [temple, lang]);

  return { translated, translating };
}
