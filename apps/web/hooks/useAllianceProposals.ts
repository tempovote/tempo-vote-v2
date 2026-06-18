"use client"

import { useState, useEffect, useCallback } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface ProposalTally {
  yesVp: number
  noVp: number
  abstainVp: number
  yesCount: number
  noCount: number
  abstainCount: number
  totalVoted: number
  totalMembers: number
  isQuorumMet: boolean
  isApproved: boolean
}

export interface ProposalItem {
  id: string
  allianceId: string
  proposerDrepId: string
  proposerName: string | null
  proposalType: "withdrawal" | "ga_stance"
  title: string
  description: string | null
  amountLovelace: number | null
  recipientAddress: string | null
  recipientLabel: string | null
  govActionTxHash: string | null
  govActionIndex: number | null
  status: string
  votingEndsAt: string
  approvedAt: string | null
  executableAt: string | null
  executedTxHash: string | null
  createdAt: string
  tally: ProposalTally
  myVote: string | null
}

export interface ProposalListResponse {
  items: ProposalItem[]
  total: number
  page: number
  limit: number
}

export interface AllianceStanceItem {
  allianceId: string
  allianceName: string
  allianceLogoUrl: string | null
  proposalId: string
  stance: string
  yesCount: number
  noCount: number
  abstainCount: number
  totalVoted: number
  memberCount: number
  status: string
  votingEndsAt: string
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useAllianceProposals(
  allianceId: string,
  opts: { type?: string; status?: string; drepId?: string; page?: number } = {},
) {
  const { type, status, drepId, page = 1 } = opts
  const [data, setData] = useState<ProposalListResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!allianceId) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    const qs = new URLSearchParams({ page: String(page) })
    if (type) qs.set("type", type)
    if (status) qs.set("status", status)
    if (drepId) qs.set("drepId", drepId)
    fetch(`${API_URL}/alliances/${allianceId}/proposals?${qs}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d: ProposalListResponse) => { if (!cancelled) setData(d) })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed") })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [allianceId, type, status, drepId, page, tick])

  return { data, isLoading, error, refetch: () => setTick((t) => t + 1) }
}

export function useProposalDetail(allianceId: string, pid: string, drepId?: string | null) {
  const [proposal, setProposal] = useState<ProposalItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const load = useCallback(() => {
    if (!allianceId || !pid) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    const qs = drepId ? `?drepId=${encodeURIComponent(drepId)}` : ""
    fetch(`${API_URL}/alliances/${allianceId}/proposals/${pid}${qs}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d: ProposalItem) => { if (!cancelled) setProposal(d) })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed") })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [allianceId, pid, drepId])

  useEffect(() => {
    const cancel = load()
    return cancel
  }, [load, tick])

  return { proposal, isLoading, error, refetch: () => setTick((t) => t + 1) }
}

export function useAllianceStances(txHash: string, index: number | string) {
  const [stances, setStances] = useState<AllianceStanceItem[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!txHash) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    fetch(`${API_URL}/governance-actions/${txHash}/${index}/alliance-stances`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then((d: AllianceStanceItem[]) => { if (!cancelled) setStances(d) })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : "Failed") })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [txHash, index])

  return { stances, isLoading, error }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createProposal(
  allianceId: string,
  body: {
    proposalType: string
    title: string
    description?: string
    amountLovelace?: number
    recipientAddress?: string
    recipientLabel?: string
    govActionTxHash?: string
    govActionIndex?: number
  },
  token: string,
): Promise<{ id: string }> {
  const r = await fetch(`${API_URL}/alliances/${allianceId}/proposals`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await r.json()
  if (!r.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`)
  return data as { id: string }
}

export async function castVote(
  allianceId: string,
  proposalId: string,
  vote: string,
  token: string,
): Promise<void> {
  const r = await fetch(`${API_URL}/alliances/${allianceId}/proposals/${proposalId}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ vote }),
  })
  if (!r.ok) {
    const data = await r.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`)
  }
}

export async function cancelProposal(allianceId: string, proposalId: string, token: string): Promise<void> {
  const r = await fetch(`${API_URL}/alliances/${allianceId}/proposals/${proposalId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!r.ok) {
    const data = await r.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`)
  }
}
