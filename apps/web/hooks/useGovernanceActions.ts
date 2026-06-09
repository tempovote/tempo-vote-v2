"use client"

import { useState, useEffect, useRef } from "react"
import { GovernanceActionListSchema, type GovernanceAction } from "@tempo/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// Module-level cache — survives page navigation within the same browser tab.
// TTL 3 min: backend parsedGovActions refreshes every 5 min so staleness is bounded.
const GA_CACHE_TTL = 3 * 60 * 1000
interface CacheEntry { data: GovernanceAction[]; ts: number }
const gaCache = new Map<string, CacheEntry>()

function getCached(key: string): CacheEntry | null {
  const e = gaCache.get(key)
  return e ?? null
}

function isFresh(entry: CacheEntry): boolean {
  return Date.now() - entry.ts < GA_CACHE_TTL
}

async function fetchActions(network: string, typeFilter?: string): Promise<GovernanceAction[]> {
  const params = new URLSearchParams({ network })
  if (typeFilter) params.set("type", typeFilter)
  const res = await fetch(`${API_URL}/governance-actions?${params}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data: unknown = await res.json()
  const parsed = GovernanceActionListSchema.safeParse(data)
  if (!parsed.success) {
    console.error("[useGovernanceActions] parse error", parsed.error)
    throw new Error("Dữ liệu từ server không hợp lệ")
  }
  return parsed.data
}

interface UseGovernanceActionsResult {
  actions: GovernanceAction[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useGovernanceActions(
  network: string,
  typeFilter?: string,
): UseGovernanceActionsResult {
  const cacheKey = `${network}:${typeFilter ?? "all"}`

  const [actions, setActions] = useState<GovernanceAction[]>(() => getCached(cacheKey)?.data ?? [])
  const [isLoading, setIsLoading] = useState(() => getCached(cacheKey) === null)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  // Track whether the current effect run is a manual refetch (tick > 0)
  const isManualRefetch = useRef(false)

  useEffect(() => {
    const entry = getCached(cacheKey)
    const manual = isManualRefetch.current
    isManualRefetch.current = false

    // Cache hit and still fresh — no fetch needed, no loading flash
    if (entry && isFresh(entry) && !manual) {
      setActions(entry.data)
      setIsLoading(false)
      setError(null)
      return
    }

    let cancelled = false

    if (entry && !manual) {
      // Stale cache — serve stale data immediately (no spinner), revalidate in background
      setActions(entry.data)
      setIsLoading(false)
      setError(null)
    } else {
      // No cache (first visit) or manual refetch — show loading state
      setIsLoading(true)
      setError(null)
    }

    fetchActions(network, typeFilter)
      .then((data) => {
        if (cancelled) return
        gaCache.set(cacheKey, { data, ts: Date.now() })
        setActions(data)
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // On background revalidation failure, keep showing stale data silently
        if (!entry) {
          setError(err instanceof Error ? err.message : "Không thể tải governance actions")
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, tick])

  function refetch() {
    isManualRefetch.current = true
    setTick((t) => t + 1)
  }

  return { actions, isLoading, error, refetch }
}
