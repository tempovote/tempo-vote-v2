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
      const msg = String(args[0] ?? "")
      // Eternl wallet internal DOM communication errors
      if (msg.startsWith("dom:")) return
      orig(...args)
    }
    return () => {
      console.error = orig
    }
  }, [])

  return null
}
