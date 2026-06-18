"use client"

import { useState, useRef, type ReactNode } from "react"
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
    return IPFS_GATEWAYS[Math.min(gwIdx, IPFS_GATEWAYS.length - 1)] + url.slice(7)
  }
  return url
}

// ─── Shared style tokens ──────────────────────────────────────────────────────

const INPUT = "w-full bg-bg-elevated border border-border-subtle rounded-xl px-3 py-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/50 transition-colors"
const LABEL = "text-sm font-semibold text-text-primary"
const OPTIONAL = (
  <span className="ml-1.5 text-xs font-normal text-text-muted bg-bg-secondary px-1.5 py-0.5 rounded-md">
    Optional
  </span>
)

function SectionDivider({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
        {icon}
        {label}
      </span>
    </div>
  )
}

const TAG_OPTIONS = ["fiscal", "tech", "social", "environment", "education"]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateAlliancePage() {
  const t = useT()
  const router = useRouter()
  const { isConnected, isDrepRegistered, selectedNetwork, jwt } = useWalletStore()
  const { reauthenticate } = useWallet()

  const [name, setName]                     = useState("")
  const [description, setDescription]       = useState("")
  const [charter, setCharter]               = useState("")
  const [selectedTags, setSelectedTags]     = useState<string[]>([])
  const [customTagInput, setCustomTagInput] = useState("")
  const [isSubmitting, setIsSubmitting]     = useState(false)
  const [error, setError]                   = useState<string | null>(null)

  // Logo upload
  const [logoUrl, setLogoUrl]               = useState("")
  const [logoPreview, setLogoPreview]       = useState<string | null>(null)
  const [logoGwIdx, setLogoGwIdx]           = useState(0)
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
      fetch(`${API_URL}/metadata/unpin/${logoUrl.slice(7)}`, {
        method: "DELETE",
        headers: authHeader(getJwt()),
      }).catch(() => {})
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
      const { imageUrl } = (await res.json()) as { imageUrl: string }
      setLogoUrl(imageUrl)
      setLogoUploadState("idle")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      setLogoUploadState("error")
      setLogoUploadError(
        msg === "auth"
          ? t("alliance.create.logoAuthError")
          : t("alliance.create.logoUploadError"),
      )
      URL.revokeObjectURL(localUrl)
      setLogoPreview(null)
    }
    e.target.value = ""
  }

  function removeLogo() {
    if (logoUrl.startsWith("ipfs://")) {
      fetch(`${API_URL}/metadata/unpin/${logoUrl.slice(7)}`, {
        method: "DELETE",
        headers: authHeader(getJwt()),
      }).catch(() => {})
    }
    setLogoUrl("")
    setLogoPreview(null)
    setLogoUploadState("idle")
    setLogoUploadError(null)
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
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
      if (msg.includes("already taken"))       setError(t("alliance.create.nameTaken"))
      else if (msg.includes("already a member")) setError(t("alliance.create.alreadyMember"))
      else if (msg.includes("not registered")) setError(t("alliance.create.notDrep"))
      else setError(msg)
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

  const logoSrc = logoPreview || (logoUrl ? toDisplaySrc(logoUrl, logoGwIdx) : null)

  return (
    <div className="page-container py-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-text-primary mb-6">{t("alliance.create.title")}</h1>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <SectionDivider
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
            </svg>
          }
          label="Content"
        />

        {/* Name */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className={LABEL}>
              {t("alliance.create.nameLabel")} <span className="text-danger font-normal">*</span>
            </label>
            <span className={`text-xs tabular-nums ${name.length >= 80 ? "text-warning" : "text-text-muted"}`}>
              {name.length}/100
            </span>
          </div>
          <input
            className={INPUT}
            placeholder={t("alliance.create.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            required
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className={LABEL}>Description {OPTIONAL}</label>
          <textarea
            className={`${INPUT} resize-none`}
            rows={3}
            placeholder={t("alliance.create.descPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* ── Charter ─────────────────────────────────────────────────────── */}
        <SectionDivider
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          }
          label="Charter"
        />

        <div className="space-y-1.5">
          <label className={LABEL}>Charter {OPTIONAL}</label>
          <textarea
            className={`${INPUT} resize-y font-mono text-xs`}
            rows={7}
            placeholder={t("alliance.create.charterPlaceholder")}
            value={charter}
            onChange={(e) => setCharter(e.target.value)}
          />
          <p className="text-xs text-text-muted">
            Supports plain text. Describe governance rules, values, and procedures.
          </p>
        </div>

        {/* ── Identity ────────────────────────────────────────────────────── */}
        <SectionDivider
          icon={
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          }
          label="Identity"
        />

        {/* Logo upload */}
        <div className="space-y-2">
          <label className={LABEL}>Logo {OPTIONAL}</label>

          {logoSrc ? (
            <div className="relative rounded-xl overflow-hidden bg-bg-elevated w-32 h-32">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt="logo preview"
                className="w-full h-full object-cover"
                onError={() => {
                  if (!logoPreview && logoGwIdx < IPFS_GATEWAYS.length - 1)
                    setLogoGwIdx((i) => i + 1)
                }}
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-1 bg-white/20 hover:bg-white/30 text-white text-xs rounded-lg backdrop-blur-sm transition-colors"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={removeLogo}
                  className="px-2 py-1 bg-white/20 hover:bg-danger/60 text-white text-xs rounded-lg backdrop-blur-sm transition-colors"
                >
                  Remove
                </button>
              </div>
              {(logoUploadState === "uploading" || logoUploadState === "auth") && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span
                    className="spinner"
                    style={{ width: 24, height: 24, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }}
                  />
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={logoUploadState === "uploading" || logoUploadState === "auth"}
              className="w-32 h-32 rounded-xl border-2 border-dashed border-border-default hover:border-accent/40 transition-colors flex flex-col items-center justify-center gap-2 text-text-muted hover:text-text-secondary group"
            >
              {logoUploadState === "uploading" || logoUploadState === "auth" ? (
                <span className="spinner" style={{ width: 22, height: 22, borderWidth: 2 }} />
              ) : (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="group-hover:scale-110 transition-transform">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span className="text-xs text-center leading-tight px-2">Upload logo</span>
                </>
              )}
            </button>
          )}

          {/* URL input row */}
          <div className="flex gap-2">
            <input
              className={`${INPUT} flex-1 text-sm`}
              placeholder={t("alliance.create.logoUrlPlaceholder")}
              value={logoUrl}
              onChange={(e) => {
                const v = e.target.value
                if (logoUrl.startsWith("ipfs://") && !v.startsWith("ipfs://")) {
                  fetch(`${API_URL}/metadata/unpin/${logoUrl.slice(7)}`, {
                    method: "DELETE",
                    headers: authHeader(getJwt()),
                  }).catch(() => {})
                }
                setLogoUrl(v)
                setLogoPreview(null)
                setLogoUploadState("idle")
              }}
              disabled={logoUploadState === "uploading" || logoUploadState === "auth"}
            />
            <button
              type="button"
              className="shrink-0 px-3 py-2 rounded-xl border border-border-subtle bg-bg-elevated text-text-secondary text-sm hover:border-accent/40 hover:text-text-primary transition-colors disabled:opacity-50"
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
            <p className="text-danger text-xs flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {logoUploadError ?? t("alliance.create.logoUploadError")}
            </p>
          )}
        </div>

        {/* Tags */}
        <div className="space-y-2">
          <label className={LABEL}>Tags {OPTIONAL}</label>

          <div className="flex flex-wrap gap-2">
            {TAG_OPTIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  selectedTags.includes(tag)
                    ? "border-accent bg-accent/10 text-accent-light"
                    : "border-border-subtle bg-bg-elevated text-text-secondary hover:border-accent/40"
                }`}
              >
                {t(`alliance.tags.${tag}` as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-border-subtle rounded-xl px-3 focus-within:border-accent/50 transition-colors">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-muted shrink-0">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                <line x1="7" y1="7" x2="7.01" y2="7"/>
              </svg>
              <input
                className="flex-1 bg-transparent py-3 text-sm text-text-primary placeholder-text-muted outline-none"
                placeholder={t("alliance.create.tagsPlaceholder")}
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTags() } }}
              />
            </div>
            <button
              type="button"
              onClick={addCustomTags}
              className="shrink-0 px-3 py-2 rounded-xl border border-border-subtle bg-bg-elevated text-text-secondary text-sm hover:border-accent/40 hover:text-text-primary transition-colors"
            >
              Add
            </button>
          </div>

          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedTags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-accent/10 text-accent-light border border-accent/20"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}
                    className="hover:text-danger ml-0.5"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Network indicator ────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-accent/8 border border-accent/20">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-xs text-accent-light">
            {t("alliance.create.networkLabel")}:{" "}
            <span className="font-semibold capitalize">{selectedNetwork}</span>
            {" "}— Alliance will be created on this network.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="notice-warning rounded-xl p-3 text-sm flex items-start gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={isSubmitting}
            className="btn-outline flex-1 h-11"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !name.trim() || logoUploadState === "uploading" || logoUploadState === "auth"}
            className="btn-primary flex-1 h-11"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="spinner shrink-0" style={{ width: 15, height: 15, borderWidth: 2 }} />
                {t("alliance.create.submitting")}
              </span>
            ) : t("alliance.create.submit")}
          </button>
        </div>

      </form>
    </div>
  )
}
