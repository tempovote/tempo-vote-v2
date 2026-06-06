"use client"

import { useState, useEffect } from "react"
import { resolveAnchorUrls } from "@/lib/governance"

function extractTitle(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  const body = d.body as Record<string, unknown> | undefined
  return ((body?.title ?? d.title) as string | undefined) ?? null
}

export function useAnchorTitle(anchorUrl: string | null | undefined): string | null {
  const [title, setTitle] = useState<string | null>(null)

  useEffect(() => {
    const urls = resolveAnchorUrls(anchorUrl ?? null)
    if (urls.length === 0) return
    let cancelled = false

    const tryFetch = async (remaining: string[]): Promise<void> => {
      if (cancelled || remaining.length === 0) return
      const [url, ...rest] = remaining as [string, ...string[]]
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 5000)
        const r = await fetch(url, { signal: controller.signal })
        clearTimeout(timer)
        if (!r.ok) return tryFetch(rest)
        const data: unknown = await r.json()
        const t = extractTitle(data)
        if (cancelled) return
        if (t) setTitle(t)
        else tryFetch(rest)
      } catch {
        return tryFetch(rest)
      }
    }

    tryFetch(urls)
    return () => { cancelled = true }
  }, [anchorUrl])

  return title
}
