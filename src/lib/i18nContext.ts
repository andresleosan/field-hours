import { createContext } from "react";
import type { Language, Translations } from "./i18n.constants";

export interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: keyof Translations) => string;
}

export const I18nContext = createContext<I18nContextType | null>(null);
