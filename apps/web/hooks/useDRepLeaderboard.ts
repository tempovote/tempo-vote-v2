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

export function useDRepLeaderboard(network: string, limit = 5) {
  const [entries, setEntries] = useState<DRepLeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`${API_URL}/dreps/leaderboard?limit=${limit}&network=${network}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (!cancelled && Array.isArray(data)) setEntries(data as DRepLeaderboardEntry[])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [network, limit])

  return { entries, loading }
}
