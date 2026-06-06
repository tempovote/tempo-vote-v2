"use client"

import { useState, useEffect } from "react"
import { GovernanceActionListSchema, type GovernanceAction } from "@tempo/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

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
  const [actions, setActions] = useState<GovernanceAction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    const params = new URLSearchParams({ network })
    if (typeFilter) params.set("type", typeFilter)

    fetch(`${API_URL}/governance-actions?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const parsed = GovernanceActionListSchema.safeParse(data)
        if (parsed.success) {
          setActions(parsed.data)
        } else {
          console.error("[useGovernanceActions] parse error", parsed.error)
          setError("Dữ liệu từ server không hợp lệ")
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Không thể tải governance actions")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [network, typeFilter, tick])

  return { actions, isLoading, error, refetch: () => setTick((t) => t + 1) }
}
