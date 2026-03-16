export type { Translations } from "./types";
export { default as en } from "./en";
export { default as zh } from "./zh";
export { default as vi } from "./vi";
export { default as fr } from "./fr";
export { default as es } from "./es";
export { default as hi } from "./hi";

export type Locale = "en" | "zh" | "vi" | "fr" | "es" | "hi";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  zh: "中文",
  vi: "Tiếng Việt",
  fr: "Français",
  es: "Español",
  hi: "हिन्दी",
};
