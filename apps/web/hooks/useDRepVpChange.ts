"use client"

import { useState, useEffect } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface VpChangeEntry {
  id: string
  credHex: string
  name: string | null
  imageUrl: string | null
  anchorUrl: string | null
  currentVp: number
  prevVp: number
  delta: number
  pctChange: number
}

const CACHE_TTL = 2 * 60 * 1000
interface CacheEntry { entries: VpChangeEntry[]; ts: number }
const cache = new Map<string, CacheEntry>()

function getCached(key: string): VpChangeEntry[] | null {
  const e = cache.get(key)
  return e && Date.now() - e.ts < CACHE_TTL ? e.entries : null
}

export function useDRepVpChange(network: string, limit = 5) {
  const cacheKey = `${network}:${limit}`
  const [entries, setEntries] = useState<VpChangeEntry[]>(() => getCached(cacheKey) ?? [])
  const [loading, setLoading] = useState(() => getCached(cacheKey) === null)

  useEffect(() => {
    const cached = getCached(cacheKey)
    if (cached) {
      setEntries(cached)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    fetch(`${API_URL}/dreps/vp-change?limit=${limit}&network=${network}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (!cancelled && Array.isArray(data)) {
          const typed = data as VpChangeEntry[]
          cache.set(cacheKey, { entries: typed, ts: Date.now() })
          setEntries(typed)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [cacheKey, network, limit])

  return { entries, loading }
}
