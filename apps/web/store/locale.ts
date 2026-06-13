export type Locale = "en" | "ja" | "vi"

export const LOCALES: Locale[] = ["en", "ja", "vi"]
export const DEFAULT_LOCALE: Locale = "en"

/**
 * Cookie/localStorage key. The cookie lets the server read the locale during SSR.
 * Must be a valid cookie name (no ":" — RFC 6265 token), so use underscore.
 */
export const LOCALE_COOKIE = "tempo_locale"

export function isLocale(v: unknown): v is Locale {
  return v === "en" || v === "ja" || v === "vi"
}

/**
 * Write locale to cookie + localStorage and update <html lang>. Client-only.
 * The cookie is what the server reads on the next request so SSR renders in the
 * correct language (no flash, no hydration mismatch).
 */
export function persistLocale(locale: Locale) {
  if (typeof document !== "undefined") {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`
    document.documentElement.lang = locale
  }
  try {
    localStorage.setItem(LOCALE_COOKIE, locale)
  } catch {
    /* ignore */
  }
}
