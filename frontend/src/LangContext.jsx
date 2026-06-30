import { createContext, useContext, useState } from 'react';
import i18n from './i18n';   

const LangContext = createContext();

export function LangProvider({ children }) {
  const [lang, setLang] = useState(
    localStorage.getItem('bharatmandir_lang') || 'en'
  );

  const changeLang = (code) => {
    setLang(code);
    localStorage.setItem('bharatmandir_lang', code);
    i18n.changeLanguage(code);  
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