"use client"

import { useState, useEffect } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface WhaleLeaderEntry {
  id: string
  credHex: string
  name: string | null
  imageUrl: string | null
  anchorUrl: string | null
  whaleCount: number
  delegatorCount: number
  activeVotingPower: number
}

const CACHE_TTL = 30 * 60 * 1000  // 30 min — backend caches 2 h, frontend refreshes on tab navigation
interface CacheEntry { entries: WhaleLeaderEntry[]; ts: number }
const cache = new Map<string, CacheEntry>()

function getCached(key: string): WhaleLeaderEntry[] | null {
  const e = cache.get(key)
  return e && Date.now() - e.ts < CACHE_TTL ? e.entries : null
}

export function useDRepWhaleLeaders(network: string, limit = 5) {
  const cacheKey = `${network}:${limit}`
  const [entries, setEntries] = useState<WhaleLeaderEntry[]>(() => getCached(cacheKey) ?? [])
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
    fetch(`${API_URL}/dreps/whale-leaders?limit=${limit}&network=${network}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (!cancelled && Array.isArray(data)) {
          const typed = data as WhaleLeaderEntry[]
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
