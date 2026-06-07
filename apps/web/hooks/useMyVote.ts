"use client"

import { useState, useEffect } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export type MyVote = "YES" | "NO" | "ABSTAIN" | null

export function useMyVote(
  txHash: string,
  index: number,
  drepId: string | null | undefined,
  network: string,
): MyVote {
  const [vote, setVote] = useState<MyVote>(null)

  useEffect(() => {
    setVote(null)
    if (!drepId) return
    let cancelled = false
    const url = `${API_URL}/governance-actions/${txHash}/${index}/my-vote?drepId=${encodeURIComponent(drepId)}&network=${network}`
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { voted?: string | null } | null) => {
        if (cancelled || !data?.voted) return
        const v = data.voted.toUpperCase()
        if (v === "YES" || v === "NO" || v === "ABSTAIN") setVote(v as MyVote)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [txHash, index, drepId, network])

  return vote
}
