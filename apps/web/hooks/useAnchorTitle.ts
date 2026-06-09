"use client"

import { useState, useEffect } from "react"
import { resolveAnchorUrls, resolveAnchorUrl } from "@/lib/governance"

// v2: stores {v, t} objects so we can apply TTL to both hits and misses.
// Changing the key drops the old format gracefully (old key is simply ignored).
const STORAGE_KEY  = "tempo:anchor-titles-v2"
const TTL_HIT  = 7 * 24 * 60 * 60 * 1000  // 7 days  — found names rarely change
const TTL_MISS = 1 * 24 * 60 * 60 * 1000  // 1 day   — re-check missing names daily
const MAX_ENTRIES = 600

interface StoredEntry { v: string | null; t: number }

// session cache: anchorUrl → title (null = fetched, no title found)
const sessionCache = new Map<string, string | null>()
// session cache: anchorUrl → imageUrl (null = fetched, no image found)
const imageSessionCache = new Map<string, string | null>()
// in-flight dedup: prevents duplicate fetches when multiple cards mount simultaneously
const inFlight     = new Map<string, Promise<string | null>>()

function loadFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const stored = JSON.parse(raw) as Record<string, unknown>
    const now = Date.now()
    for (const [k, raw] of Object.entries(stored)) {
      if (!raw || typeof raw !== "object") continue
      const entry = raw as StoredEntry
      const ttl = entry.v !== null ? TTL_HIT : TTL_MISS
      if (now - entry.t > ttl) continue  // expired — will re-fetch
      sessionCache.set(k, entry.v)
    }
  } catch { /* ignore parse errors / private browsing */ }
}

function saveToStorage(key: string, value: string | null): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const store: Record<string, StoredEntry> = raw ? JSON.parse(raw) : {}
    const keys = Object.keys(store)
    if (keys.length >= MAX_ENTRIES) {
      // Evict oldest 25% by timestamp
      keys
        .sort((a, b) => (store[a]?.t ?? 0) - (store[b]?.t ?? 0))
        .slice(0, Math.floor(MAX_ENTRIES / 4))
        .forEach((k) => delete store[k])
    }
    store[key] = { v: value, t: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch { /* storage full or private browsing — non-fatal */ }
}

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

// CIP-119: body.image may be a string URL, or { contentUrl, url, "@id" }
function extractImage(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const d = data as Record<string, unknown>
  const body = d.body as Record<string, unknown> | undefined
  const image = body?.image ?? d.image
  if (!image) return null
  const raw = typeof image === "string"
    ? image
    : (() => {
        const obj = image as Record<string, unknown>
        return (typeof obj.contentUrl === "string" ? obj.contentUrl : null)
          ?? (typeof obj.url === "string" ? obj.url : null)
          ?? (typeof obj["@id"] === "string" ? (obj["@id"] as string) : null)
      })()
  return raw ? (resolveAnchorUrl(raw) ?? null) : null
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
      // Piggyback image extraction on same parse — no extra network call
      if (!imageSessionCache.has(anchorUrl)) {
        imageSessionCache.set(anchorUrl, extractImage(data))
      }
      return t ?? tryFetch(rest)
    } catch {
      return tryFetch(rest)
    }
  }

  const result = await tryFetch(urls)
  // Cache both hits (name found) and misses (null) — misses use shorter TTL
  sessionCache.set(anchorUrl, result)
  saveToStorage(anchorUrl, result)
  return result
}

/**
 * Batch-resolve anchor titles for a list of URLs.
 * Uses session cache (per page load) backed by localStorage (TTL: 7d hit / 1d miss).
 * Re-renders the consumer as each title resolves, so lists update progressively.
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
      if (cached != null) m.set(url, cached)
    }
    return m
  })

  useEffect(() => {
    let cancelled = false
    for (const url of urls) {
      if (!url) continue
      if (sessionCache.has(url)) {
        // Already in session cache (hit or miss) — update map if it's a hit
        const t = sessionCache.get(url)
        if (t != null)
          setMap((prev) => prev.get(url) === t ? prev : new Map([...prev, [url, t]]))
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
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey])

  return map
}

/**
 * Returns imageUrl (string) for anchor URLs whose metadata has already been fetched
 * by useAnchorTitlesMap. Images are extracted from the same CIP-119 JSON parse —
 * no extra network calls. Returns null for URLs not yet fetched or with no image.
 */
export function useAnchorImagesMap(
  urls: (string | null | undefined)[],
): ReadonlyMap<string, string> {
  const urlsKey = urls.filter(Boolean).join("\0")

  const [map, setMap] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>()
    for (const url of urls) {
      if (!url) continue
      const cached = imageSessionCache.get(url)
      if (cached != null) m.set(url, cached)
    }
    return m
  })

  useEffect(() => {
    let cancelled = false
    for (const url of urls) {
      if (!url) continue
      const cached = imageSessionCache.get(url)
      if (cached != null) {
        setMap((prev) => prev.get(url) === cached ? prev : new Map([...prev, [url, cached]]))
        continue
      }
      // If not yet fetched, subscribe to the same inFlight promise as fetchTitle
      let p = inFlight.get(url)
      if (!p) {
        p = fetchTitle(url)   // triggers fetch which also populates imageSessionCache
        inFlight.set(url, p)
        p.finally(() => inFlight.delete(url))
      }
      p.then(() => {
        if (cancelled) return
        const img = imageSessionCache.get(url)
        if (img != null)
          setMap((prev) => prev.get(url) === img ? prev : new Map([...prev, [url, img]]))
      })
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey])

  return map
}

export function useAnchorTitle(anchorUrl: string | null | undefined): string | null {
  const [title, setTitle] = useState<string | null>(null)

  useEffect(() => {
    const url = anchorUrl ?? null
    if (!url) return

    if (sessionCache.has(url)) {
      setTitle(sessionCache.get(url) ?? null)
      return
    }

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
