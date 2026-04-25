import { createContext, useContext, useMemo, useState } from 'react';

const LANGUAGES = ['English', 'Spanish', 'Korean', 'Russian'];

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [activeLanguage, setActiveLanguage] = useState('English');

  const value = useMemo(
    () => ({
      languages: LANGUAGES,
      activeLanguage,
      setActiveLanguage,
    }),
    [activeLanguage]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('useLanguage must be used inside LanguageProvider');
  }

  return context;
}