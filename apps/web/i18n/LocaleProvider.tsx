"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { DEFAULT_LOCALE, persistLocale, type Locale } from "@/store/locale"

interface LocaleContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

/**
 * Holds the active locale. Seeded from `initialLocale` (resolved server-side from
 * the cookie), so SSR and the first client render agree — no flash, no hydration
 * mismatch. `setLocale` persists to cookie/localStorage and re-renders consumers.
 */
export default function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale
  children: React.ReactNode
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  const setLocale = useCallback((next: Locale) => {
    persistLocale(next)
    setLocaleState(next)
  }, [])

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocaleContext(): LocaleContextValue {
  const ctx = useContext(LocaleContext)
  // Fallback keeps non-wrapped trees (e.g. isolated tests) from crashing.
  if (!ctx) return { locale: DEFAULT_LOCALE, setLocale: () => {} }
  return ctx
}
