import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { translateTemples, translateTemple } from '../services/translate';

// Hook for a list of temples
export function useTranslatedTemples(temples) {
  const { i18n }  = useTranslation();
  const [translated, setTranslated] = useState(temples);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (!temples || temples.length === 0) {
      setTranslated(temples);
      return;
    }
    if (i18n.language === 'en') {
      setTranslated(temples);
      return;
    }
    setTranslating(true);
    translateTemples(temples, i18n.language)
      .then(setTranslated)
      .finally(() => setTranslating(false));
  }, [temples, i18n.language]);

  return { translated, translating };
}

// Hook for a single temple
export function useTranslatedTemple(temple) {
  const { i18n }  = useTranslation();
  const [translated, setTranslated] = useState(temple);
  const [translating, setTranslating] = useState(false);

  useEffect(() => {
    if (!temple) { setTranslated(temple); return; }
    if (i18n.language === 'en') { setTranslated(temple); return; }
    setTranslating(true);
    translateTemple(temple, i18n.language)
      .then(setTranslated)
      .finally(() => setTranslating(false));
  }, [temple, i18n.language]);

  return { translated, translating };
}