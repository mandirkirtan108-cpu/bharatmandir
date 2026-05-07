import { useState, useEffect } from 'react';
import { useLang } from '../LangContext';
import { translateTemples, translateTemple } from '../services/translate';

// Hook for a list of temples
export function useTranslatedTemples(temples) {
  const { lang }                      = useLang();
  const [translated,  setTranslated]  = useState(temples);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (!temples || temples.length === 0) {
      setTranslated(temples);
      return;
    }
    if (lang === 'en') {
      setTranslated(temples);
      return;
    }
    setTranslating(true);
    translateTemples(temples, lang)
      .then(setTranslated)
      .finally(() => setTranslating(false));
  }, [temples, lang]);

  return { translated, translating };
}

// Hook for a single temple
// FIX: Initialize with temple directly so there's never a blank render cycle.
// Show English data immediately, translate in background for other languages.
export function useTranslatedTemple(temple) {
  const { lang } = useLang();

  // KEY FIX: useState(temple) not useState(null)
  // This means T is never null when temple data exists
  const [translated,  setTranslated]  = useState(temple);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (!temple) { setTranslated(null); return; }

    // English — set immediately, no API call
    if (lang === 'en') {
      setTranslated(temple);
      return;
    }

    // Other languages — show English first, translate in background
    setTranslated(temple); // show data immediately
    setTranslating(true);
    translateTemple(temple, lang)
      .then(setTranslated)
      .catch(() => setTranslated(temple))
      .finally(() => setTranslating(false));
  }, [temple, lang]);

  return { translated, translating };
}