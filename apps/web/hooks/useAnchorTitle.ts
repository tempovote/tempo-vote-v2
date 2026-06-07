"use client"

import { useState, useEffect } from "react"
import { resolveAnchorUrls } from "@/lib/governance"

// GA anchor metadata is immutable (content addressed on-chain).
// Cache titles in a module-level Map (session) and localStorage (cross-reload).
const STORAGE_KEY = "tempo:anchor-titles"
const MAX_ENTRIES  = 500

// session cache: anchorUrl → title (null = fetched but no title found)
const sessionCache = new Map<string, string | null>()
// in-flight dedup: prevents duplicate IPFS fetches when multiple cards mount simultaneously
const inFlight     = new Map<string, Promise<string | null>>()

function loadFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const stored = JSON.parse(raw) as Record<string, unknown>
    for (const [k, v] of Object.entries(stored)) {
      if (typeof v === "string") sessionCache.set(k, v)
    }
  } catch { /* ignore parse errors / private browsing */ }
}

function saveToStorage(key: string, value: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const store: Record<string, string> = raw ? JSON.parse(raw) : {}
    const keys = Object.keys(store)
    if (keys.length >= MAX_ENTRIES) {
      // Simple FIFO eviction — remove oldest 25% when full
      keys.slice(0, Math.floor(MAX_ENTRIES / 4)).forEach(k => delete store[k])
    }
    store[key] = value
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch { /* storage full or private browsing — non-fatal */ }
}

// Populate session cache from localStorage on module load (browser only)
if (typeof window !== "undefined") loadFromStorage()

function extractTitle(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  const body = d.body as Record<string, unknown> | undefined
  // GA anchor: body.title / title
  // DRep CIP-119: body.givenName / givenName
  const val = body?.title ?? d.title ?? body?.givenName ?? d.givenName
  return typeof val === "string" && val.length > 0 ? val : null
}

async function fetchTitle(anchorUrl: string): Promise<string | null> {
  const urls = resolveAnchorUrls(anchorUrl)

  const tryFetch = async (remaining: string[]): Promise<string | null> => {
    if (remaining.length === 0) return null
    const [url, ...rest] = remaining as [string, ...string[]]
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const r = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (!r.ok) return tryFetch(rest)
      const data: unknown = await r.json()
      const t = extractTitle(data)
      return t ?? tryFetch(rest)
    } catch {
      return tryFetch(rest)
    }
  }

  const result = await tryFetch(urls)
  // Write to both caches before resolving so concurrent subscribers see the result
  sessionCache.set(anchorUrl, result)
  if (result !== null) saveToStorage(anchorUrl, result)
  return result
}

/**
 * Batch-resolve anchor titles for a list of URLs.
 * Uses the same session/localStorage cache and in-flight dedup as useAnchorTitle.
 * Re-renders the consumer whenever a new title is resolved, so search filters
 * using the returned map stay up to date as IPFS fetches complete.
 */
export function useAnchorTitlesMap(
  urls: (string | null | undefined)[],
): ReadonlyMap<string, string> {
  const urlsKey = urls.filter(Boolean).join("\0")

  const [map, setMap] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>()
    for (const url of urls) {
      if (!url) continue
      const cached = sessionCache.get(url)
      if (cached) m.set(url, cached)
    }
    return m
  })

  useEffect(() => {
    let cancelled = false
    for (const url of urls) {
      if (!url) continue
      if (sessionCache.has(url)) {
        const t = sessionCache.get(url)
        if (t != null)
          setMap((prev) =>
            prev.get(url) === t ? prev : new Map([...prev, [url, t]]),
          )
        continue
      }
      let p = inFlight.get(url)
      if (!p) {
        p = fetchTitle(url)
        inFlight.set(url, p)
        p.finally(() => inFlight.delete(url))
      }
      p.then((result) => {
        if (cancelled || result == null) return
        setMap((prev) =>
          prev.get(url) === result ? prev : new Map([...prev, [url, result]]),
        )
      })
    }
    return () => {
      cancelled = true
    }
    // urlsKey is a stable serialisation of the url list; changing it means a
    // genuinely different set of anchors (new page of actions loaded, etc.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey])

  return map
}

export function useAnchorTitle(anchorUrl: string | null | undefined): string | null {
  const [title, setTitle] = useState<string | null>(null)

  useEffect(() => {
    const url = anchorUrl ?? null
    if (!url) return

    // Session cache hit (includes entries loaded from localStorage on init)
    if (sessionCache.has(url)) {
      setTitle(sessionCache.get(url) ?? null)
      return
    }

    // Deduplicate: re-use an in-flight fetch instead of starting a new one
    let p = inFlight.get(url)
    if (!p) {
      p = fetchTitle(url)
      inFlight.set(url, p)
      p.finally(() => inFlight.delete(url))
    }

    let cancelled = false
    p.then(result => { if (!cancelled) setTitle(result) })
    return () => { cancelled = true }
  }, [anchorUrl])

  return title
}
