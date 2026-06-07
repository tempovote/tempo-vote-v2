"use client"

import { useState, useEffect } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export type MyVote = "YES" | "NO" | "ABSTAIN" | null

function sessionKey(txHash: string, index: number) {
  return `tempo:vote:${txHash}:${index}`
}

export function readOptimisticVote(txHash: string, index: number): MyVote {
  try {
    const v = sessionStorage.getItem(sessionKey(txHash, index))?.toUpperCase()
    if (v === "YES" || v === "NO" || v === "ABSTAIN") return v as MyVote
  } catch { /* SSR or storage blocked */ }
  return null
}

export function writeOptimisticVote(txHash: string, index: number, vote: MyVote) {
  try {
    if (vote) sessionStorage.setItem(sessionKey(txHash, index), vote)
  } catch { /* ignore */ }
}

export function useMyVote(
  txHash: string,
  index: number,
  drepId: string | null | undefined,
  network: string,
): MyVote {
  const [vote, setVote] = useState<MyVote>(() => readOptimisticVote(txHash, index))

  useEffect(() => {
    // Keep optimistic value while waiting for API; only clear if API returns a definitive answer
    if (!drepId) return
    let cancelled = false
    const url = `${API_URL}/governance-actions/${txHash}/${index}/my-vote?drepId=${encodeURIComponent(drepId)}&network=${network}`
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { voted?: string | null } | null) => {
        if (cancelled) return
        if (data?.voted) {
          const v = data.voted.toUpperCase()
          if (v === "YES" || v === "NO" || v === "ABSTAIN") {
            writeOptimisticVote(txHash, index, v as MyVote)
            setVote(v as MyVote)
          }
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [txHash, index, drepId, network])

  return vote
}
