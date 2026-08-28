import { useContext } from "react";
import { I18nContext } from "./i18nContext";
import { translations, type Language, type Translations } from "./i18n.constants";

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    return {
      lang: "es" as Language,
      setLang: () => {},
      t: (key: keyof Translations) => translations.es[key] || key,
    };
  }
  return context;
}
