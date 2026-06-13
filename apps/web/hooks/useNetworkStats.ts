"use client"

import { useState, useEffect } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface NetworkStats {
  currentEpoch?: number
  activeDRepCount?: number
  totalDelegatedAda?: number
  activeGACount?: number
}

const CACHE_TTL = 5 * 60 * 1000
interface CacheEntry { data: NetworkStats; ts: number }
const cache = new Map<string, CacheEntry>()

function getCached(key: string): NetworkStats | null {
  const e = cache.get(key)
  return e && Date.now() - e.ts < CACHE_TTL ? e.data : null
}

export function useNetworkStats(network: string) {
  const [stats, setStats] = useState<NetworkStats>(() => getCached(network) ?? {})
  const [loading, setLoading] = useState(() => getCached(network) === null)

  useEffect(() => {
    const cached = getCached(network)
    if (cached) {
      setStats(cached)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    fetch(`${API_URL}/network/stats?network=${network}`)
      .then((r) => (r.ok ? r.json() : {}))
      .then((data: unknown) => {
        if (!cancelled && typeof data === "object" && data !== null) {
          const typed = data as NetworkStats
          cache.set(network, { data: typed, ts: Date.now() })
          setStats(typed)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [network])

  return { stats, loading }
}
