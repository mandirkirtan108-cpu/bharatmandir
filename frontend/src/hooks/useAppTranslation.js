import { useTranslation } from 'react-i18next';

export function useAppTranslation(namespace) {
  const translation = useTranslation(namespace);
  const { t, i18n, ready } = translation;

  const translate = (key, fallback, options = {}) => {
    if (!key) return fallback || '';
    const value = t(key, { defaultValue: fallback || key, ...options });
    return value || fallback || key;
  };

  return {
    ...translation,
    t,
    translate,
    i18n,
    ready,
    language: i18n?.language || 'en',
    changeLanguage: i18n?.changeLanguage,
  };
}

export default useAppTranslation;
