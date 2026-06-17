"use client"

import { useState, useRef } from "react"
import { authHeader, getJwt } from "@/lib/api"
import { useWallet } from "@/hooks/useWallet"
import MarkdownEditor from "@/components/ui/MarkdownEditor"
import { useT } from "@/i18n/useT"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// Ordered fallback list — gateway.pinata.cloud first (files pinned via Pinata are always available there)
const IPFS_DISPLAY_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
]

// Extract bare CID from ipfs:// or any known https gateway URL
function extractCid(url: string): string | null {
  if (url.startsWith("ipfs://")) return url.slice(7)
  for (const gw of IPFS_DISPLAY_GATEWAYS) {
    if (url.startsWith(gw)) return url.slice(gw.length)
  }
  return null
}

// Resolve URL for <img> display using a specific gateway index (for onError fallback)
function toDisplaySrc(url: string, gwIdx: number): string {
  const cid = extractCid(url)
  if (cid) return IPFS_DISPLAY_GATEWAYS[Math.min(gwIdx, IPFS_DISPLAY_GATEWAYS.length - 1)] + cid
  return url
}

export interface DRepFormData {
  givenName: string
  motivations: string
  objectives: string
  qualifications: string
  imageUrl: string
  imagePreviewUrl: string  // local blob URL for display (not stored on-chain)
  paymentAddress: string
  references: { type: string; label: string; uri: string }[]
}

interface Props {
  data: DRepFormData
  step: 1 | 2
  onChange: (data: DRepFormData) => void
  onNext: () => void
  onBack: () => void
}

export default function RegisterDRepForm({ data, step, onChange, onNext, onBack }: Props) {
  const t = useT()
  const set = (patch: Partial<DRepFormData>) => onChange({ ...data, ...patch })
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "error" | "auth">("idle")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [imgGwIdx, setImgGwIdx] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { reauthenticate } = useWallet()

  async function ensureJwt(): Promise<string | null> {
    const existing = getJwt()
    if (existing) return existing
    return reauthenticate()
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Unpin previous IPFS upload if being replaced
    if (data.imageUrl.startsWith("ipfs://")) {
      fetch(`${API_URL}/metadata/unpin/${data.imageUrl.slice(7)}`, { method: "DELETE", headers: authHeader(getJwt()) }).catch(() => {})
    }

    const localUrl = URL.createObjectURL(file)
    setImagePreview(localUrl)
    setUploadError(null)
    setImgGwIdx(0)
    set({ imageUrl: "" })

    try {
      // Ensure JWT — re-run auth challenge if session expired
      setUploadState("auth")
      const jwt = await ensureJwt()
      if (!jwt) throw new Error("auth")

      setUploadState("uploading")
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(((reader.result as string).split(",")[1]) ?? "")
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await fetch(`${API_URL}/metadata/upload-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(jwt) },
        body: JSON.stringify({ base64, mimeType: file.type, filename: file.name }),
      })

      if (res.status === 401) throw new Error("auth")
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? `HTTP ${res.status}`)
      }
      const { imageUrl } = await res.json()
      set({ imageUrl, imagePreviewUrl: localUrl })
      setUploadState("idle")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ""
      setUploadState("error")
      setUploadError(msg === "auth" ? t("drepWizard.formAvatarAuthError") : null)
      URL.revokeObjectURL(localUrl)
      setImagePreview(null)
    }
    // Reset file input so same file can be re-selected
    e.target.value = ""
  }

  const addReference = () =>
    set({ references: [...data.references, { type: "Link", label: "", uri: "" }] })

  const updateReference = (i: number, patch: Partial<{ type: string; label: string; uri: string }>) =>
    set({
      references: data.references.map((r, idx) => (idx === i ? { ...r, ...patch } : r)),
    })

  const removeReference = (i: number) =>
    set({ references: data.references.filter((_, idx) => idx !== i) })

  const canProceedStep1 = data.givenName.trim().length > 0

  if (step === 1) {
    return (
      <div className="space-y-5">
        {/* givenName */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-text-secondary">
              {t("drepWizard.formNameLabel")} <span className="text-danger">*</span>
            </label>
            <span className={`text-xs tabular-nums ${data.givenName.length >= 70 ? "text-warning" : "text-text-muted"}`}>
              {data.givenName.length}/80
            </span>
          </div>
          <input
            className="input w-full"
            placeholder={t("drepWizard.formNamePlaceholder")}
            maxLength={80}
            value={data.givenName}
            onChange={e => set({ givenName: e.target.value })}
          />
          <p className="text-text-muted text-xs mt-1">
            {t("drepWizard.formNameHint")}
          </p>
        </div>

        {/* imageUrl — URL input or local file upload */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            {t("drepWizard.formAvatarLabel")}
          </label>

          {/* Preview */}
          {(imagePreview || data.imageUrl) && (
            <div className="flex items-center gap-3 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreview || toDisplaySrc(data.imageUrl, imgGwIdx)}
                alt="preview"
                className="w-14 h-14 rounded-full object-cover border border-border-subtle"
                onError={() => {
                  if (!imagePreview && imgGwIdx < IPFS_DISPLAY_GATEWAYS.length - 1) {
                    setImgGwIdx(i => i + 1)
                  }
                }}
              />
              {(uploadState === "uploading" || uploadState === "auth") && (
                <div className="flex items-center gap-2 text-text-muted text-xs">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {uploadState === "auth" ? t("drepWizard.formAvatarAuthenticating") : t("drepWizard.formAvatarUploading")}
                </div>
              )}
              {uploadState === "idle" && data.imageUrl && (
                <p className="text-text-muted text-xs break-all line-clamp-2">{data.imageUrl}</p>
              )}
            </div>
          )}

          {/* Input row */}
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="https://example.com/avatar.png"
              value={data.imageUrl}
              onChange={e => {
                const newUrl = e.target.value
                if (data.imageUrl.startsWith("ipfs://") && !newUrl.startsWith("ipfs://")) {
                  fetch(`${API_URL}/metadata/unpin/${data.imageUrl.slice(7)}`, { method: "DELETE", headers: authHeader(getJwt()) }).catch(() => {})
                }
                set({ imageUrl: newUrl, imagePreviewUrl: "" })
                setImagePreview(null)
                setUploadState("idle")
              }}
              disabled={uploadState === "uploading" || uploadState === "auth"}
            />
            <button
              type="button"
              className="btn-outline text-xs px-3 shrink-0"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadState === "uploading" || uploadState === "auth"}
            >
              {uploadState === "uploading" || uploadState === "auth" ? t("drepWizard.formAvatarUploadingBtn") : t("drepWizard.formAvatarUploadBtn")}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          {uploadState === "error" && (
            <p className="text-danger text-xs mt-1">
              {uploadError ?? t("drepWizard.formAvatarUploadError")}
            </p>
          )}
        </div>

        {/* paymentAddress */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            {t("drepWizard.formPaymentLabel")}
          </label>
          <input
            className="input w-full font-mono text-xs"
            placeholder="addr1..."
            value={data.paymentAddress}
            onChange={e => set({ paymentAddress: e.target.value })}
          />
          <p className="text-text-muted text-xs mt-1">
            {t("drepWizard.formPaymentHint")}
          </p>
        </div>

        <div className="pt-2">
          <button
            className="btn-primary w-full"
            disabled={!canProceedStep1}
            onClick={onNext}
          >
            {t("drepWizard.formNextBtn")}
          </button>
        </div>
      </div>
    )
  }

  // Step 2
  return (
    <div className="space-y-5">
      {/* motivations */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          {t("drepWizard.formMotivationsLabel")}
        </label>
        <MarkdownEditor
          value={data.motivations}
          onChange={v => set({ motivations: v })}
          placeholder={t("drepWizard.formMotivationsPlaceholder")}
          rows={4}
          maxLength={1000}
        />
      </div>

      {/* objectives */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          {t("drepWizard.formObjectivesLabel")}
        </label>
        <MarkdownEditor
          value={data.objectives}
          onChange={v => set({ objectives: v })}
          placeholder={t("drepWizard.formObjectivesPlaceholder")}
          rows={4}
          maxLength={1000}
        />
      </div>

      {/* qualifications */}
      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1.5">
          {t("drepWizard.formQualificationsLabel")}
        </label>
        <MarkdownEditor
          value={data.qualifications}
          onChange={v => set({ qualifications: v })}
          placeholder={t("drepWizard.formQualificationsPlaceholder")}
          rows={4}
          maxLength={1000}
        />
      </div>

      {/* references */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-text-secondary">
            {t("drepWizard.formRefsLabel")}
          </label>
          <button
            className="text-accent text-xs font-medium hover:text-accent-light transition-colors"
            onClick={addReference}
          >
            {t("drepWizard.formRefsAddBtn")}
          </button>
        </div>

        {data.references.length === 0 ? (
          <p className="text-text-muted text-xs">
            {t("drepWizard.formRefsEmpty")}
          </p>
        ) : (
          <div className="space-y-3">
            {data.references.map((ref, i) => (
              <div key={i} className="bg-bg-elevated rounded-lg p-3 flex gap-2 items-start">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex gap-2">
                    <div className="relative w-28 shrink-0">
                      <select
                        className="input text-sm w-full appearance-none pr-8"
                        value={ref.type}
                        onChange={e => updateReference(i, { type: e.target.value })}
                      >
                        <option value="Link">Link</option>
                        <option value="GovernanceMetadata">Governance</option>
                        <option value="Identity">Identity</option>
                      </select>
                      <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                    <input
                      className="input text-sm flex-1 min-w-0"
                      placeholder={t("drepWizard.formRefLabelPlaceholder")}
                      value={ref.label}
                      onChange={e => updateReference(i, { label: e.target.value })}
                    />
                  </div>
                  <input
                    className="input text-sm w-full"
                    placeholder="https://..."
                    value={ref.uri}
                    onChange={e => updateReference(i, { uri: e.target.value })}
                  />
                </div>
                <button
                  className="text-text-muted hover:text-danger transition-colors shrink-0 text-lg leading-none mt-1.5"
                  onClick={() => removeReference(i)}
                  title={t("drepWizard.formRefRemoveTitle")}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <button className="btn-outline flex-1" onClick={onBack}>
          {t("drepWizard.formBackBtn")}
        </button>
        <button className="btn-primary flex-1" onClick={onNext}>
          {t("drepWizard.formPreviewBtn")}
        </button>
      </div>
    </div>
  )
}
