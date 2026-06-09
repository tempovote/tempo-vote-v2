"use client"

import { useState, useEffect } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface DRepLeaderboardEntry {
  id: string
  credHex: string
  anchorUrl: string | null
  activeVotingPower: number
  liveVotingPower: number
  delegatorCount: number
  influencePower: number
}

// Module-level cache: survives page navigation within the same browser tab.
// TTL matches backend cache (15 min) so a page visit within the window is instant.
const LEADERBOARD_TTL = 15 * 60 * 1000
interface CacheEntry { entries: DRepLeaderboardEntry[]; ts: number }
const leaderboardCache = new Map<string, CacheEntry>()

function getCached(key: string): DRepLeaderboardEntry[] | null {
  const e = leaderboardCache.get(key)
  return e && Date.now() - e.ts < LEADERBOARD_TTL ? e.entries : null
}

export function useDRepLeaderboard(network: string, limit = 5) {
  const cacheKey = `${network}:${limit}`
  const [entries, setEntries] = useState<DRepLeaderboardEntry[]>(() => getCached(cacheKey) ?? [])
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
    fetch(`${API_URL}/dreps/leaderboard?limit=${limit}&network=${network}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (!cancelled && Array.isArray(data)) {
          const typed = data as DRepLeaderboardEntry[]
          leaderboardCache.set(cacheKey, { entries: typed, ts: Date.now() })
          setEntries(typed)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [cacheKey, network, limit])

  return { entries, loading }
}
