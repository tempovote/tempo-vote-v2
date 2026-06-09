"use client"

import { useState, useEffect } from "react"
import type { DRepStats } from "@tempo/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export function useDRepStats(drepId: string | null, network: string) {
  const [stats, setStats]     = useState<DRepStats | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!drepId) return
    let cancelled = false
    setLoading(true)
    fetch(`${API_URL}/dreps/${drepId}/stats?network=${network}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (!cancelled && data) setStats(data as DRepStats)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [drepId, network])

  return { stats, loading }
}
