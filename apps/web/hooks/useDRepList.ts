"use client"

import { useState, useEffect } from "react"
import { credentialHexToDrepId } from "@/lib/governance"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface DRepListItem {
  id: string          // canonical drep1... bech32
  credHex: string     // 56-char hex from Ogmios
  anchorUrl: string | null
  votingPower: number // lovelace
}

function parseEntry(raw: unknown): DRepListItem | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>
  if (item.type !== "registered") return null

  const credHex = item.id as string
  if (!credHex || typeof credHex !== "string" || credHex.length !== 56) return null

  const id = credentialHexToDrepId(credHex)

  const metadata = item.metadata as Record<string, unknown> | undefined
  const anchor = item.anchor as Record<string, unknown> | undefined
  const anchorUrl = ((metadata?.url ?? anchor?.url) as string | undefined) ?? null

  const stake = item.stake as Record<string, unknown> | undefined
  const stakeAda = stake?.ada as Record<string, unknown> | undefined
  const votingPower = Number(stakeAda?.lovelace ?? stake?.lovelace ?? 0)

  return { id, credHex, anchorUrl, votingPower }
}

export function useDRepList(network: string): {
  dreps: DRepListItem[]
  isLoading: boolean
  error: string | null
} {
  const [dreps, setDreps] = useState<DRepListItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    fetch(`${API_URL}/dreps?network=${network}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: unknown) => {
        if (cancelled) return
        let items: unknown[]
        if (Array.isArray(data)) {
          items = data
        } else if (data && typeof data === "object") {
          const obj = data as Record<string, unknown>
          const arr = obj.delegateRepresentatives ?? obj.dreps
          items = Array.isArray(arr) ? arr : []
        } else {
          items = []
        }
        const parsed = items.flatMap((item) => {
          const p = parseEntry(item)
          return p ? [p] : []
        })
        // Sort by voting power descending
        parsed.sort((a, b) => b.votingPower - a.votingPower)
        setDreps(parsed)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Không thể tải danh sách DRep")
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [network])

  return { dreps, isLoading, error }
}
