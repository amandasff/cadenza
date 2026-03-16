"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { en, zh, vi, fr, es, hi, LOCALE_LABELS } from "../i18n";
import type { Locale, Translations } from "../i18n";

const TRANSLATIONS: Record<Locale, Translations> = { en, zh, vi, fr, es, hi };
const STORAGE_KEY = "cadenza-locale";

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translations;
  localeLabels: typeof LOCALE_LABELS;
}

const I18nContext = createContext<I18nCtx>({
  locale: "en",
  setLocale: () => {},
  t: en,
  localeLabels: LOCALE_LABELS,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && saved in TRANSLATIONS) {
      setLocaleState(saved);
    }
  }, []);

  function setLocale(l: Locale) {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }

  return (
    <I18nContext.Provider
      value={{ locale, setLocale, t: TRANSLATIONS[locale], localeLabels: LOCALE_LABELS }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
