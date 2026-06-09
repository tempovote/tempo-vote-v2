"use client"

import { useState, useEffect, useRef } from "react"
import { GovernanceActionSchema, type GovernanceAction } from "@tempo/types"
import { findInListCache } from "@/hooks/useGovernanceActions"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// Per-GA detail cache — complements the list cache for direct URL navigations.
const GA_DETAIL_TTL = 3 * 60 * 1000
interface DetailEntry { data: GovernanceAction; ts: number }
const gaDetailCache = new Map<string, DetailEntry>()

interface UseGovernanceActionResult {
  action: GovernanceAction | null
  loading: boolean
  error: string | null
  refetch: () => void
}

/**
 * Fetch a single governance action with two-layer caching:
 *   1. GA list cache (populated by useGovernanceActions on the list page)
 *      → instant load when navigating from the list, no spinner
 *   2. Per-GA detail cache (TTL 3 min, stale-while-revalidate)
 *      → instant load on back-navigation or direct URL revisit
 *   3. Fetch from API as fallback (first direct URL visit)
 */
export function useGovernanceAction(
  network: string,
  txHash: string,
  index: number,
): UseGovernanceActionResult {
  const cacheKey = `${network}:${txHash}:${index}`

  const [action, setAction] = useState<GovernanceAction | null>(() => {
    return findInListCache(network, txHash, index)
      ?? gaDetailCache.get(cacheKey)?.data
      ?? null
  })

  const [loading, setLoading] = useState(() => {
    return (
      findInListCache(network, txHash, index) === null &&
      gaDetailCache.get(cacheKey) === null
    )
  })

  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const isManualRefetch = useRef(false)

  useEffect(() => {
    const manual = isManualRefetch.current
    isManualRefetch.current = false

    const detailEntry = gaDetailCache.get(cacheKey)
    const detailFresh = detailEntry
      ? Date.now() - detailEntry.ts < GA_DETAIL_TTL
      : false

    // Fresh detail cache and not a manual refetch — serve from cache, skip fetch
    if (detailFresh && !manual) {
      setAction(detailEntry!.data)
      setLoading(false)
      setError(null)
      return
    }

    // Check list cache (navigation from list page)
    const fromList = findInListCache(network, txHash, index)

    let cancelled = false

    if ((fromList || detailEntry) && !manual) {
      // Have stale data — show immediately, revalidate in background
      setAction(fromList ?? detailEntry!.data)
      setLoading(false)
      setError(null)
    } else {
      // No data at all, or manual refetch — show loading spinner
      setLoading(true)
      setError(null)
    }

    fetch(`${API_URL}/governance-actions/${txHash}/${index}?network=${network}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: unknown) => {
        if (cancelled) return
        const parsed = GovernanceActionSchema.safeParse(data)
        if (parsed.success) {
          gaDetailCache.set(cacheKey, { data: parsed.data, ts: Date.now() })
          setAction(parsed.data)
          setError(null)
        } else {
          if (!fromList && !detailEntry) setError("Dữ liệu không hợp lệ từ server")
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // On background revalidation failure, keep showing stale data silently
        if (!fromList && !detailEntry) {
          setError(err instanceof Error ? err.message : "Không thể tải governance action")
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, tick])

  function refetch() {
    isManualRefetch.current = true
    setTick((t) => t + 1)
  }

  return { action, loading, error, refetch }
}
