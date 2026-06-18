"use client"

import { useState, useEffect, useCallback } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface AllianceItem {
  id: string
  name: string
  description: string | null
  tags: string[]
  logoUrl: string | null
  network: string
  memberCount: number
  createdAt: string
}

export interface AllianceDetail {
  id: string
  name: string
  description: string | null
  charter: string | null
  tags: string[]
  logoUrl: string | null
  creatorDrepId: string
  creatorName: string | null
  creatorImageUrl: string | null
  network: string
  treasuryAddress: string | null
  approvalThresholdVp: number
  approvalThresholdCount: number
  quorumThreshold: number
  vpCapPct: number
  timelockHours: number
  maxWithdrawalPct: number
  proposalDurationDays: number
  memberCount: number
  myMembership: { role: string; joinedAt: string } | null
  createdAt: string
}

export interface AllianceMember {
  id: string
  drepId: string
  stakeAddress: string
  role: string
  joinedAt: string
  name: string | null
  imageUrl: string | null
}

export interface AllianceListResponse {
  items: AllianceItem[]
  total: number
  page: number
  limit: number
}

export interface AllianceMembersResponse {
  items: AllianceMember[]
  total: number
}

// ─── List alliances ───────────────────────────────────────────────────────────

export function useAllianceList(network: string, page = 1, tag?: string) {
  const [data, setData] = useState<AllianceListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    const qs = new URLSearchParams({ network, page: String(page) })
    if (tag) qs.set("tag", tag)
    fetch(`${API_URL}/alliances?${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d: AllianceListResponse) => { if (!cancelled) setData(d) })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load") })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [network, page, tag, tick])

  return { data, isLoading, error, refetch: () => setTick((t) => t + 1) }
}

// ─── Alliance detail ──────────────────────────────────────────────────────────

export function useAllianceDetail(id: string, drepId?: string | null) {
  const [alliance, setAlliance] = useState<AllianceDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const load = useCallback(() => {
    if (!id) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    const qs = drepId ? `?drepId=${encodeURIComponent(drepId)}` : ""
    fetch(`${API_URL}/alliances/${id}${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d: AllianceDetail) => { if (!cancelled) setAlliance(d) })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load") })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [id, drepId])

  useEffect(() => {
    const cancel = load()
    return cancel
  }, [load, tick])

  return { alliance, isLoading, error, refetch: () => setTick((t) => t + 1) }
}

// ─── Alliance members ─────────────────────────────────────────────────────────

export function useAllianceMembers(allianceId: string, page = 1) {
  const [data, setData] = useState<AllianceMembersResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!allianceId) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetch(`${API_URL}/alliances/${allianceId}/members?page=${page}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d: AllianceMembersResponse) => { if (!cancelled) setData(d) })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load") })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [allianceId, page, tick])

  return { data, isLoading, error, refetch: () => setTick((t) => t + 1) }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createAlliance(
  body: { name: string; description?: string; charter?: string; tags?: string[]; logoUrl?: string; network: string },
  token: string,
): Promise<{ id: string }> {
  const r = await fetch(`${API_URL}/alliances`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`)
  return data as { id: string }
}

export async function joinAlliance(allianceId: string, token: string): Promise<void> {
  const r = await fetch(`${API_URL}/alliances/${allianceId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({}),
  })
  if (!r.ok) {
    const data = await r.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`)
  }
}

export async function leaveAlliance(allianceId: string, token: string): Promise<void> {
  const r = await fetch(`${API_URL}/alliances/${allianceId}/leave`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const data = await r.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`)
  }
}

export interface TreasuryUtxo {
  txHash: string
  outputIndex: number
  lovelace: number
}

export interface TreasuryBalance {
  treasuryAddress: string
  balanceLovelace: number
  utxos: TreasuryUtxo[]
}

export function useTreasuryBalance(allianceId: string) {
  const [data, setData] = useState<TreasuryBalance | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!allianceId) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetch(`${API_URL}/alliances/${allianceId}/treasury`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d: TreasuryBalance) => { if (!cancelled) setData(d) })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed") })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [allianceId, tick])

  return { data, isLoading, error, refetch: () => setTick((t) => t + 1) }
}

export async function triggerFinalization(allianceId: string, proposalId: string, token: string): Promise<string> {
  const r = await fetch(`${API_URL}/alliances/${allianceId}/proposals/${proposalId}/finalize`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`)
  return (data as { txHash: string }).txHash
}
