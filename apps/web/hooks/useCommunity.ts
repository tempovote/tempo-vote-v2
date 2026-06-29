"use client"

import { useState, useEffect, useCallback } from "react"
import type { Community, InternalPoll, PollsPage, PollDetail, PollComment, CommentsPage } from "@tempo/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ─── Community status ─────────────────────────────────────────────────────────

export function useCommunity(drepId: string, network: string) {
  const [community, setCommunity] = useState<Community | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    if (!drepId) {
      setIsLoading(false)
      return () => {}
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetch(`${API_URL}/communities/${drepId}?network=${network}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled) return
        const d = data as Record<string, unknown>
        if (d.isActive === true) {
          setCommunity(d as unknown as Community)
          setIsActive(true)
        } else {
          setCommunity(null)
          setIsActive(false)
        }
      })
      .catch(() => {
        if (!cancelled) setError("Không thể tải community")
      })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [drepId, network])

  useEffect(() => {
    const cancel = load()
    return cancel
  }, [load])

  return { community, isActive, isLoading, error, refetch: load }
}

// ─── Community polls (paginated) ──────────────────────────────────────────────

export function useCommunityPolls(drepId: string, network: string, page: number) {
  const [polls, setPolls] = useState<InternalPoll[]>([])
  const [total, setTotal] = useState(0)
  const [limit, setLimit] = useState(10)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!drepId) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetch(`${API_URL}/communities/${drepId}/polls?network=${network}&page=${page}`)
      .then((r) => {
        if (!r.ok) return r.json().then((e: unknown) => {
          const msg = (e as Record<string, string>).error ?? `HTTP ${r.status}`
          throw new Error(msg)
        })
        return r.json()
      })
      .then((data: PollsPage) => {
        if (cancelled) return
        setPolls(data.items)
        setTotal(data.total)
        setLimit(data.limit)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Không thể tải polls")
      })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [drepId, network, page, tick])

  return { polls, total, limit, isLoading, error, refetch: () => setTick((t) => t + 1) }
}

// ─── Poll detail (with options + vote counts) ─────────────────────────────────

export function usePollDetail(pollId: string, stakeAddress?: string | null) {
  const [poll, setPoll] = useState<PollDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!pollId) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    const qs = stakeAddress ? `?stakeAddress=${encodeURIComponent(stakeAddress)}` : ""
    fetch(`${API_URL}/communities/polls/${pollId}${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data: PollDetail) => {
        if (cancelled) return
        setPoll(data)
      })
      .catch(() => { if (!cancelled) setError("Không thể tải poll") })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [pollId, stakeAddress, tick])

  return { poll, isLoading, error, refetch: () => setTick((t) => t + 1) }
}

// ─── Poll comments ────────────────────────────────────────────────────────────

export function usePollComments(pollId: string) {
  const [comments, setComments] = useState<PollComment[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!pollId) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetch(`${API_URL}/communities/polls/${pollId}/comments`)
      .then((r) => r.json())
      .then((data: CommentsPage) => {
        if (cancelled) return
        setComments(data.items)
        setTotal(data.total)
      })
      .catch(() => { if (!cancelled) setError("Không thể tải comments") })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [pollId, tick])

  return { comments, total, isLoading, error, refetch: () => setTick((t) => t + 1) }
}
