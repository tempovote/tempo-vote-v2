"use client"

import { useState, useEffect } from "react"
import type { DRepVote } from "@tempo/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

interface UseDRepVotingHistoryResult {
  votes: DRepVote[]
  total: number
  page: number
  limit: number
  isLoading: boolean
  error: string | null
}

export function useDRepVotingHistory(
  drepId: string,
  network: string,
  page: number,
  limit = 20,
): UseDRepVotingHistoryResult {
  const [votes, setVotes] = useState<DRepVote[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    const url = `${API_URL}/dreps/${encodeURIComponent(drepId)}/votes?network=${network}&page=${page}&limit=${limit}`

    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { votes: DRepVote[]; total: number; page: number; limit: number }) => {
        if (cancelled) return
        setVotes(data.votes ?? [])
        setTotal(data.total ?? 0)
        setIsLoading(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Không thể tải lịch sử bỏ phiếu")
        setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [drepId, network, page, limit])

  return { votes, total, page, limit, isLoading, error }
}
