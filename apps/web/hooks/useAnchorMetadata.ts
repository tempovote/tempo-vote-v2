"use client"

import { useState, useEffect } from "react"
import { resolveAnchorUrls } from "@/lib/governance"

export interface AnchorReference {
  label: string
  uri: string
}

export interface AnchorMetadata {
  title?: string
  abstract?: string
  motivation?: string
  rationale?: string
  references?: AnchorReference[]
}

interface MetadataState {
  data: AnchorMetadata | null
  loading: boolean
  error: boolean
}

// Session cache: anchorUrl → parsed metadata
const cache = new Map<string, AnchorMetadata | null>()
const inFlight = new Map<string, Promise<AnchorMetadata | null>>()

function extractMetadata(raw: unknown): AnchorMetadata | null {
  if (!raw || typeof raw !== "object") return null
  const d = raw as Record<string, unknown>
  const body = (d.body as Record<string, unknown> | undefined) ?? d

  function str(key: string): string | undefined {
    const v = body[key]
    return typeof v === "string" && v.length > 0 ? v : undefined
  }

  function refs(): AnchorReference[] | undefined {
    const r = body["references"]
    if (!Array.isArray(r)) return undefined
    return r.flatMap((item) => {
      if (!item || typeof item !== "object") return []
      const i = item as Record<string, unknown>
      const label = typeof i["label"] === "string" ? i["label"] : ""
      const uri   = typeof i["uri"]   === "string" ? i["uri"]   : ""
      return uri ? [{ label: label || uri, uri }] : []
    })
  }

  const meta: AnchorMetadata = {
    title:      str("title")      ?? str("givenName"),
    abstract:   str("abstract"),
    motivation: str("motivation"),
    rationale:  str("rationale"),
    references: refs(),
  }

  const hasContent = meta.title || meta.abstract || meta.motivation || meta.rationale
  return hasContent ? meta : null
}

async function fetchMetadata(anchorUrl: string): Promise<AnchorMetadata | null> {
  const urls = resolveAnchorUrls(anchorUrl)
  if (urls.length === 0) return null

  const tryFetch = async (remaining: string[]): Promise<AnchorMetadata | null> => {
    if (remaining.length === 0) return null
    const [url, ...rest] = remaining as [string, ...string[]]
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 8000)
      const r = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (!r.ok) return tryFetch(rest)
      const data: unknown = await r.json()
      const meta = extractMetadata(data)
      return meta ?? tryFetch(rest)
    } catch {
      return tryFetch(rest)
    }
  }

  const result = await tryFetch(urls)
  cache.set(anchorUrl, result)
  return result
}

export function useAnchorMetadata(anchorUrl: string | null | undefined): MetadataState {
  const [state, setState] = useState<MetadataState>({ data: null, loading: false, error: false })

  useEffect(() => {
    const url = anchorUrl ?? null
    if (!url) return

    if (cache.has(url)) {
      setState({ data: cache.get(url) ?? null, loading: false, error: false })
      return
    }

    setState({ data: null, loading: true, error: false })

    let p = inFlight.get(url)
    if (!p) {
      p = fetchMetadata(url)
      inFlight.set(url, p)
      p.finally(() => inFlight.delete(url))
    }

    let cancelled = false
    p.then((result) => {
      if (cancelled) return
      setState({ data: result, loading: false, error: result === null })
    }).catch(() => {
      if (!cancelled) setState({ data: null, loading: false, error: true })
    })

    return () => { cancelled = true }
  }, [anchorUrl])

  return state
}
