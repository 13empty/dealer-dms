export type AppLocale = "es" | "en" | "fr";

export const LOCALES: { id: AppLocale; label: string; intl: string; currency: string }[] = [
  { id: "es", label: "Español", intl: "es-CA", currency: "CAD" },
  { id: "en", label: "English (CAD)", intl: "en-CA", currency: "CAD" },
  { id: "fr", label: "Français (CAD)", intl: "fr-CA", currency: "CAD" },
];

const STORAGE_KEY = "dealer-dms-locale";

function isLocale(value: string | null): value is AppLocale {
  return value === "es" || value === "en" || value === "fr";
}

export function readStoredLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // ignore
  }
  return "es";
}

let current: AppLocale = "es";

export function getAppLocale() {
  return current;
}

export function setAppLocale(locale: AppLocale) {
  current = locale;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
  if (typeof document !== "undefined") document.documentElement.lang = locale === "es" ? "es" : locale === "fr" ? "fr-CA" : "en-CA";
}

export function localeConfig(locale: AppLocale = current) {
  return LOCALES.find((l) => l.id === locale) || LOCALES[0];
}

export function initLocale() {
  setAppLocale(readStoredLocale());
}
