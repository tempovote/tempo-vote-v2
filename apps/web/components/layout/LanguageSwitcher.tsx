"use client"

import { useEffect, useRef, useState } from "react"
import { LOCALES, type Locale } from "@/store/locale"
import { useLocale, useT } from "@/i18n/useT"

// ── Inline SVG flags (20×14, wrapped in a rounded clip) — render on every OS ──
const FLAGS: Record<Locale, React.ReactElement> = {
  en: (
    <svg viewBox="0 0 20 14" className="w-full h-full" aria-hidden>
      <rect width="20" height="14" fill="#012169" />
      <path d="M0,0 20,14 M20,0 0,14" stroke="#fff" strokeWidth="2.8" />
      <path d="M0,0 20,14 M20,0 0,14" stroke="#C8102E" strokeWidth="1.4" />
      <path d="M10,0 V14 M0,7 H20" stroke="#fff" strokeWidth="4" />
      <path d="M10,0 V14 M0,7 H20" stroke="#C8102E" strokeWidth="2.4" />
    </svg>
  ),
  ja: (
    <svg viewBox="0 0 20 14" className="w-full h-full" aria-hidden>
      <rect width="20" height="14" fill="#fff" />
      <circle cx="10" cy="7" r="4" fill="#BC002D" />
    </svg>
  ),
  vi: (
    <svg viewBox="0 0 20 14" className="w-full h-full" aria-hidden>
      <rect width="20" height="14" fill="#DA251D" />
      <polygon
        points="10,3 10.94,5.71 13.8,5.76 11.52,7.49 12.35,10.24 10,8.6 7.65,10.24 8.48,7.49 6.2,5.76 9.06,5.71"
        fill="#FF0"
      />
    </svg>
  ),
}

function Flag({ locale }: { locale: Locale }) {
  return (
    <span className="w-5 h-3.5 rounded-[3px] overflow-hidden shrink-0 border border-white/10 flex">
      {FLAGS[locale]}
    </span>
  )
}

export default function LanguageSwitcher() {
  const { locale, setLocale } = useLocale()
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click (same pattern as the Others dropdown in Navbar)
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-bg-card border border-border-default text-text-secondary hover:text-text-primary transition-colors"
        aria-label={t("language.label")}
        title={t("language.label")}
      >
        <Flag locale={locale} />
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 w-40 bg-bg-card border border-border-default rounded-xl shadow-2xl py-1.5 z-50 animate-fade-in">
          {LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => { setLocale(l); setOpen(false) }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                l === locale
                  ? "text-accent-light bg-accent/10"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/5"
              }`}
            >
              <Flag locale={l} />
              <span>{t(`language.${l}`)}</span>
              {l === locale && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="ml-auto">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
