import { useState, type ReactNode } from "react";
import { I18nContext } from "./i18nContext";
import { translations, type Language, type Translations } from "./i18n.constants";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem("fh_lang") as Language;
    if (saved && (saved === "es" || saved === "en" || saved === "pt")) {
      return saved;
    }
    return "es";
  });

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("fh_lang", newLang);
  };

  const t = (key: keyof Translations): string => {
    return translations[lang]?.[key] || translations.es[key] || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}
