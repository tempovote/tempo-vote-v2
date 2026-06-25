"use client"

import { useEffect } from "react"

/**
 * Suppresses console.error messages from browser wallet extensions (e.g. Eternl)
 * that would otherwise trigger the Next.js Turbopack dev error overlay.
 * These errors are extension-internal and not caused by our application code.
 */
export function ExtensionErrorFilter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return

    const orig = console.error.bind(console)
    console.error = (...args: unknown[]) => {
      const first = args[0]
      const msg = (first instanceof Error ? first.message : String(first ?? "")).toLowerCase()
      // Eternl wallet internal DOM communication errors ("dom:" or "DOM:")
      if (msg.startsWith("dom:")) return
      orig(...args)
    }
    return () => {
      console.error = orig
    }
  }, [])

  return null
}
