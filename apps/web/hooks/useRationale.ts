"use client"

import { useState, useCallback } from "react"
import { resolveAnchorUrls } from "@/lib/governance"

export interface RationaleContent {
  comment?: string
  title?: string
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

  const comment = typeof body.comment === "string" ? body.comment : undefined
  const title   = typeof body.title   === "string" ? body.title   : undefined

  const rawRefs = Array.isArray(body.references) ? body.references : []
  const references = rawRefs
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      label: typeof r.label === "string" ? r.label : undefined,
      uri:   typeof r.uri   === "string" ? r.uri   : undefined,
    }))
    .filter((r) => r.label || r.uri)

  return { comment, title, references }
}

async function fetchRationale(rationaleUrl: string): Promise<RationaleContent> {
  const urls = resolveAnchorUrls(rationaleUrl)

  for (const url of urls) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      const r = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (!r.ok) continue
      const data: unknown = await r.json()
      const content = parseRationale(data)
      if (content.comment || content.title) return content
    } catch {
      // try next gateway
    }
  }

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
