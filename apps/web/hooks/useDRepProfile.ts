"use client"

import { useState, useEffect } from "react"
import { resolveAnchorUrl, resolveAnchorUrls } from "@/lib/governance"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export interface DRepFullProfile {
  isRegistered: boolean
  id: string
  name: string | null
  anchorUrl: string | null
  votingPower: number | null    // lovelace — delegated stake (epoch snapshot)
  stakeKeyBalance: number | null // lovelace — own stake key balance (best-effort fallback)
  // From CIP-119 IPFS metadata
  givenName: string | null
  motivations: string | null
  objectives: string | null
  qualifications: string | null
  imageUrl: string | null
  references: Array<{ "@type": string; label: string; uri: string }> | null
}

interface UseDRepProfileResult {
  profile: DRepFullProfile | null
  isLoading: boolean
  isLoadingMeta: boolean
  error: string | null
}

export function useDRepProfile(drepId: string, network: string): UseDRepProfileResult {
  const [profile, setProfile] = useState<DRepFullProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMeta, setIsLoadingMeta] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    setProfile(null)

    fetch(`${API_URL}/dreps/${encodeURIComponent(drepId)}?network=${network}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: {
        isRegistered: boolean
        id: string
        name: string | null
        anchorUrl: string | null
        votingPower: number | null
        stakeKeyBalance: number | null
      }) => {
        if (cancelled) return

        const base: DRepFullProfile = {
          isRegistered: data.isRegistered ?? false,
          id: data.id ?? drepId,
          name: data.name ?? null,
          anchorUrl: data.anchorUrl ?? null,
          votingPower: data.votingPower ?? null,
          stakeKeyBalance: data.stakeKeyBalance ?? null,
          givenName: null,
          motivations: null,
          objectives: null,
          qualifications: null,
          imageUrl: null,
          references: null,
        }
        setProfile(base)
        setIsLoading(false)

        // Fetch CIP-119 metadata from IPFS if anchor is available
        if (data.anchorUrl) {
          setIsLoadingMeta(true)
          fetchCip119(data.anchorUrl).then((meta) => {
            if (cancelled) return
            setIsLoadingMeta(false)
            if (meta) {
              setProfile((prev) =>
                prev ? { ...prev, ...meta } : prev
              )
            }
          })
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Không thể tải thông tin DRep")
        setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [drepId, network])

  return { profile, isLoading, isLoadingMeta, error }
}

interface Cip119Meta {
  givenName: string | null
  motivations: string | null
  objectives: string | null
  qualifications: string | null
  imageUrl: string | null
  references: Array<{ "@type": string; label: string; uri: string }> | null
}

async function fetchCip119(anchorUrl: string): Promise<Cip119Meta | null> {
  const urls = resolveAnchorUrls(anchorUrl)
  if (urls.length === 0) return null

  const tryFetch = async (remaining: string[]): Promise<Cip119Meta | null> => {
    if (remaining.length === 0) return null
    const [url, ...rest] = remaining as [string, ...string[]]
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const r = await fetch(url, { signal: controller.signal })
      clearTimeout(timer)
      if (!r.ok) return tryFetch(rest)
      const data = await r.json() as Record<string, unknown>
      return parseCip119(data) ?? tryFetch(rest)
    } catch {
      return tryFetch(rest)
    }
  }

  return tryFetch(urls)
}

function parseCip119(data: Record<string, unknown>): Cip119Meta | null {
  // CIP-119: { body: { givenName, motivations, objectives, qualifications, image, references } }
  const body = (data.body as Record<string, unknown> | undefined) ?? data

  const givenName =
    (body.givenName as string | undefined) ??
    (data.name as string | undefined) ??
    null

  if (!givenName) return null

  const image = body.image as Record<string, unknown> | string | undefined
  const rawImageUrl =
    typeof image === "string"
      ? image
      : (image?.contentUrl as string | undefined) ?? null
  // Resolve ipfs:// or raw IPFS URLs through HTTP gateway
  const imageUrl = rawImageUrl ? resolveAnchorUrl(rawImageUrl) : null

  const references = Array.isArray(body.references)
    ? (body.references as Array<{ "@type": string; label: string; uri: string }>)
    : null

  return {
    givenName,
    motivations: (body.motivations as string | undefined) ?? null,
    objectives: (body.objectives as string | undefined) ?? null,
    qualifications: (body.qualifications as string | undefined) ?? null,
    imageUrl,
    references,
  }
}
