import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';
import ta from './locales/ta.json';

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

    // FIX: Default to 'en' always — let user manually switch language.
    // Browser language detector was auto-setting lang to 'hi'/'mr'/'ta'
    // for Indian users, triggering Anthropic API translation calls that
    // fail on live (no valid API key in browser env) → blank page.
    supportedLngs: ['en', 'hi', 'mr', 'ta'],

    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage'],      // only localStorage, NOT navigator
      caches: ['localStorage'],
      lookupLocalStorage: 'bharatmandir_lang',
    },
  });

export default i18n;
