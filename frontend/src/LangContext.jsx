import { createContext, useContext, useEffect, useState } from 'react';
import i18n from './i18n';   

const LangContext = createContext();

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => i18n.resolvedLanguage || i18n.language || 'en');

  const changeLang = async (code) => {
    await i18n.changeLanguage(code);
    localStorage.setItem('bharatmandir_lang', code);
    document.documentElement.lang = code;
    setLang(code);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    const syncLanguage = (code) => setLang(code);
    i18n.on('languageChanged', syncLanguage);
    return () => i18n.off('languageChanged', syncLanguage);
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, changeLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
