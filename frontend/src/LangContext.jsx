import { createContext, useContext, useEffect, useState } from 'react';
import i18n from './i18n';   

const LangContext = createContext();

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('bharatmandir_lang') || 'en';
    return saved === 'hi' ? 'hi' : 'en';
  });

  useEffect(() => {
    localStorage.setItem('bharatmandir_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = 'ltr';
    i18n.changeLanguage(lang);
    window.dispatchEvent(new CustomEvent('bharatmandir:language-change', { detail: { lang } }));
  }, [lang]);

  const changeLang = (code) => {
    setLang(code === 'hi' ? 'hi' : 'en');
  };

  return (
    <LangContext.Provider value={{ lang, changeLang }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
