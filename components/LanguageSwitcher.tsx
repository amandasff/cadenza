"use client";
import { useI18n } from "../lib/context/I18nContext";
import type { Locale } from "../lib/i18n";

export default function LanguageSwitcher() {
  const { locale, setLocale, localeLabels } = useI18n();

  return (
    <select
      value={locale}
      onChange={(e) => setLocale(e.target.value as Locale)}
      style={{
        width: "100%",
        background: "none",
        border: "1px solid var(--border)",
        borderRadius: 2,
        padding: "0.4rem 0.75rem",
        cursor: "pointer",
        fontSize: "0.6875rem",
        fontFamily: "Inter, sans-serif",
        fontWeight: 500,
        color: "var(--muted)",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        appearance: "none",
        WebkitAppearance: "none",
      }}
      aria-label="Select language"
    >
      {(Object.entries(localeLabels) as [Locale, string][]).map(([code, label]) => (
        <option key={code} value={code} style={{ textTransform: "none" }}>
          {label}
        </option>
      ))}
    </select>
  );
}
