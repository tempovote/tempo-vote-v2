"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { useWalletStore } from "@/store/wallet"
import { createAlliance } from "@/hooks/useAlliance"
import { useT } from "@/i18n/useT"
import { authHeader, getJwt } from "@/lib/api"
import { useWallet } from "@/hooks/useWallet"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
]

function toDisplaySrc(url: string, gwIdx: number): string {
  if (url.startsWith("ipfs://")) {
    const gw = IPFS_GATEWAYS[Math.min(gwIdx, IPFS_GATEWAYS.length - 1)]
    return gw + url.slice(7)
  }
  return url
}

const TAG_OPTIONS = ["fiscal", "tech", "social", "environment", "education"]

export default function CreateAlliancePage() {
  const t = useT()
  const router = useRouter()
  const { isConnected, isDrepRegistered, selectedNetwork, jwt } = useWalletStore()
  const { reauthenticate } = useWallet()

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [charter, setCharter] = useState("")
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [customTagInput, setCustomTagInput] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Logo upload state
  const [logoUrl, setLogoUrl] = useState("")
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoGwIdx, setLogoGwIdx] = useState(0)
  const [logoUploadState, setLogoUploadState] = useState<"idle" | "uploading" | "auth" | "error">("idle")
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function ensureJwt(): Promise<string | null> {
    const existing = getJwt()
    if (existing) return existing
    return reauthenticate()
  }

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (logoUrl.startsWith("ipfs://")) {
      fetch(`${API_URL}/metadata/unpin/${logoUrl.slice(7)}`, { method: "DELETE", headers: authHeader(getJwt()) }).catch(() => {})
    }

    const localUrl = URL.createObjectURL(file)
    setLogoPreview(localUrl)
    setLogoUploadError(null)
    setLogoGwIdx(0)
    setLogoUrl("")

    try {
      setLogoUploadState("auth")
      const token = await ensureJwt()
      if (!token) throw new Error("auth")

      setLogoUploadState("uploading")
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(((reader.result as string).split(",")[1]) ?? "")
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await fetch(`${API_URL}/metadata/upload-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(token) },
        body: JSON.stringify({ base64, mimeType: file.type, filename: file.name }),
      })

      if (res.status === 401) throw new Error("auth")
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
      }
      const { imageUrl } = await res.json() as { imageUrl: string }
      setLogoUrl(imageUrl)
      setLogoUploadState("idle")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      setLogoUploadState("error")
      setLogoUploadError(msg === "auth" ? t("alliance.create.logoAuthError") : t("alliance.create.logoUploadError"))
      URL.revokeObjectURL(localUrl)
      setLogoPreview(null)
    }
    e.target.value = ""
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  function addCustomTags() {
    const newTags = customTagInput
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && !selectedTags.includes(t))
    setSelectedTags((prev) => [...prev, ...newTags])
    setCustomTagInput("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!jwt) { setError("Not authenticated"); return }
    if (!name.trim()) { setError("Alliance name is required"); return }

    setIsSubmitting(true)
    setError(null)
    try {
      const result = await createAlliance(
        {
          name: name.trim(),
          description: description.trim() || undefined,
          charter: charter.trim() || undefined,
          tags: selectedTags,
          logoUrl: logoUrl.trim() || undefined,
          network: selectedNetwork,
        },
        jwt,
      )
      router.push(`/alliances/${result.id}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed"
      if (msg.includes("already taken") || msg.includes("already a member")) {
        setError(msg.includes("already a member") ? t("alliance.create.alreadyMember") : t("alliance.create.nameTaken"))
      } else if (msg.includes("not registered")) {
        setError(t("alliance.create.notDrep"))
      } else {
        setError(msg)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isConnected || !isDrepRegistered) {
    return (
      <div className="page-container py-16 flex flex-col items-center gap-4">
        <p className="text-text-muted">{t("alliance.create.notDrep")}</p>
      </div>
    )
  }

  return (
    <div className="page-container py-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-text-primary mb-6">{t("alliance.create.title")}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Name */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">
            {t("alliance.create.nameLabel")} *
          </label>
          <input
            className="input"
            placeholder={t("alliance.create.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Description</label>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder={t("alliance.create.descPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Charter */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">Charter</label>
          <textarea
            className="input resize-y font-mono text-sm"
            rows={6}
            placeholder={t("alliance.create.charterPlaceholder")}
            value={charter}
            onChange={(e) => setCharter(e.target.value)}
          />
        </div>

        {/* Logo */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-text-secondary">{t("alliance.create.logoLabel")}</label>

          {(logoPreview || logoUrl) && (
            <div className="flex items-center gap-3 mb-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoPreview || toDisplaySrc(logoUrl, logoGwIdx)}
                alt="logo preview"
                className="w-14 h-14 rounded-lg object-cover border border-border-subtle"
                onError={() => {
                  if (!logoPreview && logoGwIdx < IPFS_GATEWAYS.length - 1) setLogoGwIdx((i) => i + 1)
                }}
              />
              {(logoUploadState === "uploading" || logoUploadState === "auth") && (
                <div className="flex items-center gap-2 text-text-muted text-xs">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {logoUploadState === "auth" ? t("alliance.create.logoAuthError") : t("alliance.create.logoUploading")}
                </div>
              )}
              {logoUploadState === "idle" && logoUrl && (
                <p className="text-text-muted text-xs break-all line-clamp-2">{logoUrl}</p>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder={t("alliance.create.logoUrlPlaceholder")}
              value={logoUrl}
              onChange={(e) => {
                const v = e.target.value
                if (logoUrl.startsWith("ipfs://") && !v.startsWith("ipfs://")) {
                  fetch(`${API_URL}/metadata/unpin/${logoUrl.slice(7)}`, { method: "DELETE", headers: authHeader(getJwt()) }).catch(() => {})
                }
                setLogoUrl(v)
                setLogoPreview(null)
                setLogoUploadState("idle")
              }}
              disabled={logoUploadState === "uploading" || logoUploadState === "auth"}
            />
            <button
              type="button"
              className="btn-outline text-xs px-3 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={logoUploadState === "uploading" || logoUploadState === "auth"}
            >
              {logoUploadState === "uploading" || logoUploadState === "auth"
                ? t("alliance.create.logoUploading")
                : t("alliance.create.logoUploadBtn")}
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
          {logoUploadState === "error" && (
            <p className="text-danger text-xs">{logoUploadError ?? t("alliance.create.logoUploadError")}</p>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-text-secondary">Tags</label>
          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  selectedTags.includes(tag)
                    ? "bg-accent text-white"
                    : "bg-bg-card text-text-muted hover:bg-bg-card-hover border border-border-subtle"
                }`}
              >
                {t(`alliance.tags.${tag}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder={t("alliance.create.tagsPlaceholder")}
              value={customTagInput}
              onChange={(e) => setCustomTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTags() } }}
            />
            <button
              type="button"
              onClick={addCustomTags}
              className="px-3 py-1.5 rounded-lg bg-bg-card text-text-muted text-sm hover:bg-bg-card-hover border border-border-subtle"
            >
              Add
            </button>
          </div>
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-accent/20 text-accent-light"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}
                    className="hover:text-danger"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Network */}
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <span>{t("alliance.create.networkLabel")}:</span>
          <span className="px-2 py-0.5 rounded bg-bg-card-hover text-text-secondary capitalize">
            {selectedNetwork}
          </span>
        </div>

        {error && <div className="notice-warning text-sm">{error}</div>}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="btn-primary px-6 py-2 disabled:opacity-50"
          >
            {isSubmitting ? t("alliance.create.submitting") : t("alliance.create.submit")}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
