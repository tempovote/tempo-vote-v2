"use client"

import { useState, useCallback } from "react"
import { resolveAnchorUrls } from "@/lib/governance"

export interface RationaleContent {
  // CIP-100 generic fields
  title?: string
  comment?: string
  // CIP-136 CC rationale fields
  summary?: string
  rationaleStatement?: string
  precedentDiscussion?: string
  counterargumentDiscussion?: string
  conclusion?: string
  internalVote?: {
    constitutional?: number
    unconstitutional?: number
    abstain?: number
    didNotVote?: number
  }
  // Common
  references?: Array<{ label?: string; uri?: string }>
}

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; content: RationaleContent }
  | { status: "error" }

function parseRationale(data: unknown): RationaleContent {
  if (!data || typeof data !== "object") return {}
  const d = data as Record<string, unknown>
  const body = d.body as Record<string, unknown> | undefined
  if (!body) return {}

  const str = (key: string): string | undefined =>
    typeof body[key] === "string" ? (body[key] as string) : undefined

  let internalVote: RationaleContent["internalVote"] | undefined
  if (body.internalVote && typeof body.internalVote === "object") {
    const iv = body.internalVote as Record<string, unknown>
    internalVote = {
      constitutional:    typeof iv.constitutional    === "number" ? iv.constitutional    : undefined,
      unconstitutional:  typeof iv.unconstitutional  === "number" ? iv.unconstitutional  : undefined,
      abstain:           typeof iv.abstain           === "number" ? iv.abstain           : undefined,
      didNotVote:        typeof iv.didNotVote        === "number" ? iv.didNotVote        : undefined,
    }
  }

  const rawRefs = Array.isArray(body.references) ? body.references : []
  const references = rawRefs
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      label: typeof r.label === "string" ? r.label : undefined,
      uri:   typeof r.uri   === "string" ? r.uri   : undefined,
    }))
    .filter((r) => r.label || r.uri)

  return {
    title:                     str("title"),
    comment:                   str("comment"),
    summary:                   str("summary"),
    rationaleStatement:        str("rationaleStatement"),
    precedentDiscussion:       str("precedentDiscussion"),
    counterargumentDiscussion: str("counterargumentDiscussion"),
    conclusion:                str("conclusion"),
    internalVote,
    references: references.length > 0 ? references : undefined,
  }
}

async function tryFetch(url: string, timeoutMs: number): Promise<RationaleContent | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const r = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!r.ok) return null
    const data: unknown = await r.json()
    const content = parseRationale(data)
    if (content.comment || content.title || content.summary || content.rationaleStatement) return content
  } catch {
    // ignore
  }
  return null
}

async function fetchRationale(rationaleUrl: string): Promise<RationaleContent> {
  // Try all resolved URLs (IPFS gateways, direct HTTPS)
  for (const url of resolveAnchorUrls(rationaleUrl)) {
    const content = await tryFetch(url, 8_000)
    if (content) return content
  }

  // Fallback: proxy through server-side route to handle shortened URLs
  // (tinyurl, bit.ly, etc.) that have CORS restrictions on redirect chains
  const proxyUrl = `/api/proxy-rationale?url=${encodeURIComponent(rationaleUrl)}`
  const content = await tryFetch(proxyUrl, 14_000)
  if (content) return content

  throw new Error("Rationale not available")
}

/**
 * Lazy-fetch CIP-100 vote rationale content.
 * Only fetches when `load()` is called — safe to mount without network cost.
 */
export function useRationale(rationaleUrl: string | null | undefined) {
  const [state, setState] = useState<FetchState>({ status: "idle" })

  const load = useCallback(() => {
    if (!rationaleUrl || state.status === "loading" || state.status === "done") return
    setState({ status: "loading" })
    fetchRationale(rationaleUrl)
      .then((content) => setState({ status: "done", content }))
      .catch(() => setState({ status: "error" }))
  }, [rationaleUrl, state.status])

  return { state, load }
}
