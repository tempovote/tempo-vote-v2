"use client"

import { use, useState, useCallback, useRef, useEffect } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useWallet } from "@/hooks/useWallet"
import { useDRepProfile } from "@/hooks/useDRepProfile"
import { useCommunity, useCommunityPolls } from "@/hooks/useCommunity"
import { RationaleEditor } from "@/components/governance/RationaleEditor"
import { AlertModal } from "@/components/ui/AlertModal"
import { authHeader, getJwt } from "@/lib/api"
import type { InternalPoll } from "@tempo/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeFromNow(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now()
  if (ms <= 0) {
    const ago = Math.abs(ms)
    const d = Math.floor(ago / 86400000)
    const h = Math.floor((ago % 86400000) / 3600000)
    return `Ended ${d} days ${h} hours ago`
  }
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  return `Ends in ${d}d ${h}h`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", { year: "numeric", month: "2-digit", day: "2-digit" })
}

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: InternalPoll["status"] }) {
  const cfg = {
    active:  { cls: "bg-success/15 text-success border-success/30",       label: "Active" },
    closed:  { cls: "bg-bg-elevated text-text-muted border-border-default", label: "Closed" },
    pending: { cls: "bg-accent/15 text-accent border-accent/30",           label: "Pending" },
  }[status]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Poll card ────────────────────────────────────────────────────────────────

function PollCard({ poll, drepId, network }: { poll: InternalPoll; drepId: string; network: string }) {
  const [expanded, setExpanded] = useState(false)
  const ABSTRACT_LIMIT = 200
  const showToggle = (poll.abstract?.length ?? 0) > ABSTRACT_LIMIT

  const networkParam = network !== "mainnet" ? `?network=${network}` : ""

  return (
    <div className="border-b border-border-subtle last:border-0 p-5 space-y-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base font-bold text-text-primary leading-snug flex-1 min-w-0">
          {poll.title}
        </h3>
        <Link
          href={`/governance-actions/new?source=${poll.id}${networkParam.replace("?", "&")}`}
          className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border-default text-text-secondary hover:border-accent/50 hover:text-accent-light transition-colors"
          title="Đề xuất thành Governance Action"
        >
          Propose Action
        </Link>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 text-xs text-text-muted flex-wrap">
        <StatusBadge status={poll.status} />
        <span>{formatDate(poll.endsAt)}</span>
        <span>·</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>{timeFromNow(poll.endsAt)}</span>
      </div>

      {/* Abstract */}
      {poll.abstract && (
        <div>
          <p className="text-sm text-text-secondary leading-relaxed">
            {expanded || !showToggle
              ? poll.abstract
              : `${poll.abstract.slice(0, ABSTRACT_LIMIT)}...`}
          </p>
          {showToggle && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-accent-light mt-1 hover:underline"
            >
              {expanded ? "Thu gọn" : "Xem thêm"}
            </button>
          )}
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center gap-4 text-xs text-text-muted">
        <Link
          href={`/dreps/${drepId}/community/${poll.id}${networkParam}`}
          className="flex items-center gap-1.5 hover:text-text-primary transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {poll.commentCount} Comments
        </Link>
        <Link
          href={`/dreps/${drepId}/community/${poll.id}${networkParam}#comment`}
          className="flex items-center gap-1.5 hover:text-text-primary transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Add comment
        </Link>
        <button
          onClick={() => navigator.clipboard.writeText(
            `${typeof window !== "undefined" ? window.location.origin : ""}/dreps/${drepId}/community/${poll.id}${networkParam}`
          )}
          className="flex items-center gap-1.5 hover:text-text-primary transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Share
        </button>
      </div>
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, total, limit, onPage }: {
  page: number; total: number; limit: number; onPage: (p: number) => void
}) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 text-sm rounded-lg border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ← Trước
      </button>
      <span className="text-xs text-text-muted">
        Trang {page} / {totalPages} · {total} polls
      </span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 text-sm rounded-lg border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Tiếp →
      </button>
    </div>
  )
}

// ─── Voting type config ───────────────────────────────────────────────────────

const VOTING_TYPES = [
  {
    value: "BASIC" as const,
    label: "Basic",
    sub: "Yes / No / Abstain",
    description: "Members vote Yes, No, or Abstain.",
  },
  {
    value: "SINGLE_CHOICE" as const,
    label: "Single choice",
    sub: "Pick one option",
    description: "Members pick exactly one option from a custom list.",
  },
  {
    value: "MULTIPLE_CHOICE" as const,
    label: "Multiple choice",
    sub: "Pick many options",
    description: "Members can select many options. Each choice receives equal weight.",
  },
]

// ─── Shared styles ────────────────────────────────────────────────────────────

const INPUT = "w-full bg-bg-elevated border border-border-subtle rounded-xl px-3 py-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/50 transition-colors"
const LABEL = "text-sm font-semibold text-text-primary"
const OPTIONAL = <span className="ml-1.5 text-xs font-normal text-text-muted bg-bg-secondary px-1.5 py-0.5 rounded-md">Optional</span>
const SECTION_HDR = "flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider"

// ─── Section divider ──────────────────────────────────────────────────────────

function SectionDivider({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="pt-2">
      <div className={SECTION_HDR}>
        {icon}
        {label}
      </div>
    </div>
  )
}

// ─── Create poll form (mobile-first bottom sheet / inline on desktop) ─────────

function CreatePollForm({
  drepId,
  network,
  onSuccess,
  onCancel,
  onError,
  reauthenticate,
}: {
  drepId: string
  network: string
  onSuccess: (title: string) => void
  onCancel: () => void
  onError: (msg: string) => void
  reauthenticate: () => Promise<string | null>
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const now = new Date()
  const weekLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000)

  const [title, setTitle]               = useState("")
  const [abstract, setAbstract]         = useState("")
  const [motivation, setMotivation]     = useState("")
  const [rationale, setRationale]       = useState("")
  const [imageUrl, setImageUrl]         = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadState, setUploadState]   = useState<"idle" | "uploading" | "error">("idle")
  const [uploadError, setUploadError]   = useState<string | null>(null)
  const [links, setLinks]               = useState<string[]>([""])
  const [votingType, setVotingType]     = useState<"BASIC" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE">("BASIC")
  const [options, setOptions]           = useState<string[]>(["", ""])
  const [startsAt, setStartsAt]         = useState(toDatetimeLocal(now))
  const [endsAt, setEndsAt]             = useState(toDatetimeLocal(weekLater))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError]               = useState<string | null>(null)

  // Lock body scroll on mobile when sheet is open
  useEffect(() => {
    if (window.innerWidth >= 640) return  // desktop: form is inline, no lock needed
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [])

  // ── Image upload ────────────────────────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (imageUrl.startsWith("ipfs://")) {
      fetch(`${API_URL}/metadata/unpin/${imageUrl.slice(7)}`, { method: "DELETE", headers: authHeader(getJwt()) }).catch(() => {})
    }
    const localUrl = URL.createObjectURL(file)
    setImagePreview(localUrl)
    setImageUrl("")
    setUploadError(null)
    setUploadState("uploading")
    e.target.value = ""
    try {
      let jwt = getJwt()
      if (!jwt) jwt = await reauthenticate()
      if (!jwt) throw new Error("auth")
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(((reader.result as string).split(",")[1]) ?? "")
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const doUpload = (token: string) =>
        fetch(`${API_URL}/metadata/upload-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader(token) },
          body: JSON.stringify({ base64, mimeType: file.type, filename: file.name }),
        })
      let res = await doUpload(jwt)
      if (res.status === 401) {
        const newJwt = await reauthenticate()
        if (!newJwt) throw new Error("auth")
        res = await doUpload(newJwt)
      }
      if (!res.ok) throw new Error("upload")
      const { imageUrl: url } = await res.json()
      setImageUrl(url)
      setUploadState("idle")
    } catch {
      setUploadState("error")
      setUploadError("Upload thất bại. Vui lòng thử lại.")
      URL.revokeObjectURL(localUrl)
      setImagePreview(null)
    }
  }

  function removeImage() {
    if (imageUrl.startsWith("ipfs://")) {
      fetch(`${API_URL}/metadata/unpin/${imageUrl.slice(7)}`, { method: "DELETE", headers: authHeader(getJwt()) }).catch(() => {})
    }
    setImageUrl("")
    setImagePreview(null)
    setUploadState("idle")
    setUploadError(null)
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    // Read all current state values inside the callback to avoid stale closures
    const currentTitle      = title.trim()
    const currentAbstract   = abstract.trim()
    const currentMotivation = motivation.trim()
    const currentRationale  = rationale.trim()
    const currentImageUrl   = imageUrl
    const currentLinks      = links.map((l) => l.trim()).filter(Boolean)
    const currentOptions    = options.map((o) => o.trim()).filter(Boolean)
    const currentStartsAt   = new Date(startsAt).toISOString()
    const currentEndsAt     = new Date(endsAt).toISOString()

    if (!currentTitle) return
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError("Thời gian kết thúc phải sau thời gian bắt đầu")
      return
    }
    if (votingType !== "BASIC" && currentOptions.length < 2) {
      setError("Cần ít nhất 2 options")
      return
    }

    setIsSubmitting(true)
    setError(null)

    const body: Record<string, unknown> = {
      network, title: currentTitle, votingType,
      startsAt: currentStartsAt, endsAt: currentEndsAt,
    }
    if (currentAbstract)   body.abstract      = currentAbstract
    if (currentMotivation) body.motivation    = currentMotivation
    if (currentRationale)  body.rationale     = currentRationale
    if (currentImageUrl)   body.imageUrl      = currentImageUrl
    if (currentLinks.length) body.supportLinks = currentLinks
    if (votingType !== "BASIC") body.options  = currentOptions

    const doPost = (jwt: string | null) =>
      fetch(`${API_URL}/communities/${drepId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(jwt) },
        body: JSON.stringify(body),
      })

    try {
      let jwt = getJwt()
      if (!jwt) jwt = await reauthenticate()
      if (!jwt) throw new Error("Cần xác thực ví trước khi tạo poll.")

      let res = await doPost(jwt)
      if (res.status === 401) {
        const newJwt = await reauthenticate()
        if (!newJwt) throw new Error("Xác thực thất bại. Vui lòng thử lại.")
        res = await doPost(newJwt)
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error((errBody as Record<string, string>).error ?? `Tạo poll thất bại (${res.status})`)
      }

      onSuccess(currentTitle)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Đã xảy ra lỗi"
      setError(msg)
      onError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }, [title, abstract, motivation, rationale, imageUrl, links, votingType, options, startsAt, endsAt, drepId, network, reauthenticate, onSuccess, onError])

  // ── Action buttons (reused in header & inline footer) ──────────────────────
  const ActionButtons = (
    <>
      <button type="button" onClick={onCancel} disabled={isSubmitting} className="btn-outline flex-1 h-11">
        Hủy
      </button>
      <button
        type="submit" form="create-poll-form"
        disabled={isSubmitting || !title.trim() || uploadState === "uploading"}
        className="btn-primary flex-1 h-11"
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="spinner shrink-0" style={{ width: 15, height: 15, borderWidth: 2 }} />
            Đang tạo...
          </span>
        ) : "Tạo Poll"}
      </button>
    </>
  )

  return (
    <>
      {/* ── Mobile backdrop ── */}
      <div
        className="fixed inset-0 bg-black/50 z-40 sm:hidden"
        onClick={onCancel}
        aria-hidden
      />

      {/* ── Sheet wrapper ──
          Mobile: fixed bottom sheet (92svh, rounded-t-2xl)
          Desktop: inline within card (no fixed, no rounding) */}
      <div className="
        fixed inset-x-0 bottom-0 z-50 flex flex-col max-h-[92svh] rounded-t-2xl bg-bg-card
        sm:static sm:z-auto sm:max-h-none sm:rounded-none sm:bg-transparent sm:border-b sm:border-border-subtle
      ">

        {/* ── Mobile sticky header ── */}
        <div className="sm:hidden flex items-center justify-between px-4 py-3.5 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent-light">
              <rect x="3" y="3" width="18" height="18" rx="3"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="8" x2="12" y2="16"/>
            </svg>
            <span className="font-semibold text-sm text-text-primary">Create Internal Poll</span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
            aria-label="Đóng"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* ── Scrollable form body ── */}
        <div className="overflow-y-auto overscroll-contain flex-1">
          <form id="create-poll-form" onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-5">

            {/* ── SECTION: Content ── */}
            <SectionDivider
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>}
              label="Content"
            />

            {/* Title */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className={LABEL}>Title <span className="text-danger font-normal">*</span></label>
                <span className={`text-xs tabular-nums ${title.length >= 70 ? "text-warning" : "text-text-muted"}`}>
                  {title.length}/80
                </span>
              </div>
              <input
                type="text" value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tiêu đề cho internal poll"
                maxLength={80} required
                className={INPUT}
              />
            </div>

            {/* Abstract */}
            <div className="space-y-1.5">
              <label className={LABEL}>Abstract</label>
              <RationaleEditor
                label="" placeholder="Mô tả nội dung poll..."
                maxLength={2500} height={150} description=""
                value={abstract} onChange={setAbstract}
              />
            </div>

            {/* Motivation */}
            <div className="space-y-1.5">
              <label className={LABEL}>Motivation {OPTIONAL}</label>
              <RationaleEditor
                label="" placeholder="Vấn đề poll này giải quyết?"
                maxLength={2500} height={150} description=""
                value={motivation} onChange={setMotivation}
              />
            </div>

            {/* Rationale */}
            <div className="space-y-1.5">
              <label className={LABEL}>Rationale {OPTIONAL}</label>
              <RationaleEditor
                label="" placeholder="Lý do và lập luận cho poll này..."
                maxLength={2500} height={150} description=""
                value={rationale} onChange={setRationale}
              />
            </div>

            {/* ── SECTION: Media ── */}
            <SectionDivider
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>}
              label="Media"
            />

            {/* Image upload */}
            <div className="space-y-2">
              <label className={LABEL}>Cover image {OPTIONAL}</label>
              {imagePreview || imageUrl ? (
                /* Preview */
                <div className="relative rounded-xl overflow-hidden bg-bg-elevated aspect-video">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview ?? imageUrl} alt="Cover" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs rounded-lg backdrop-blur-sm transition-colors"
                    >
                      Đổi ảnh
                    </button>
                    <button
                      type="button"
                      onClick={removeImage}
                      className="px-3 py-1.5 bg-white/20 hover:bg-danger/60 text-white text-xs rounded-lg backdrop-blur-sm transition-colors"
                    >
                      Xóa
                    </button>
                  </div>
                  {uploadState === "uploading" && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <span className="spinner" style={{ width: 28, height: 28, borderWidth: 3, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                    </div>
                  )}
                </div>
              ) : (
                /* Upload zone */
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadState === "uploading"}
                  className="w-full rounded-xl border-2 border-dashed border-border-default hover:border-accent/40 transition-colors py-8 flex flex-col items-center gap-2 text-text-muted hover:text-text-secondary group"
                >
                  {uploadState === "uploading" ? (
                    <span className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} />
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="group-hover:scale-110 transition-transform">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                  )}
                  <span className="text-sm">
                    {uploadState === "uploading" ? "Đang upload lên IPFS..." : "Chọn ảnh bìa"}
                  </span>
                  <span className="text-xs opacity-60">PNG, JPG, GIF • Tối đa 5MB</span>
                </button>
              )}
              {uploadState === "error" && uploadError && (
                <p className="text-xs text-danger flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {uploadError}
                </p>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
            </div>

            {/* Support links */}
            <div className="space-y-2">
              <label className={LABEL}>Support links {OPTIONAL}</label>
              <div className="space-y-2">
                {links.map((link, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-border-subtle rounded-xl px-3 focus-within:border-accent/50 transition-colors">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-muted shrink-0">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                      </svg>
                      <input
                        type="url" value={link}
                        onChange={(e) => { const n = [...links]; n[i] = e.target.value; setLinks(n) }}
                        placeholder="https://website.com/"
                        className="flex-1 bg-transparent py-3 text-sm text-text-primary placeholder-text-muted outline-none"
                      />
                    </div>
                    {links.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLinks(links.filter((_, idx) => idx !== i))}
                        className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                        aria-label="Xóa link"
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setLinks([...links, ""])}
                className="flex items-center gap-1.5 text-sm text-accent-light font-medium hover:underline"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Link
              </button>
            </div>

            {/* ── SECTION: Voting ── */}
            <SectionDivider
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>}
              label="Voting"
            />

            {/* Voting type — radio cards */}
            <div className="space-y-2">
              <label className={LABEL}>Voting type</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {VOTING_TYPES.map((t) => {
                  const active = votingType === t.value
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        setVotingType(t.value)
                        if (t.value === "BASIC") setOptions(["", ""])
                      }}
                      className={`text-left rounded-xl border px-4 py-3 transition-all ${
                        active
                          ? "border-accent bg-accent/10 text-text-primary"
                          : "border-border-subtle bg-bg-elevated text-text-secondary hover:border-accent/40"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors ${
                          active ? "border-accent bg-accent" : "border-border-default"
                        }`} />
                        <span className="font-medium text-sm">{t.label}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-text-muted pl-5">{t.sub}</p>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-text-muted px-1">
                {VOTING_TYPES.find((t) => t.value === votingType)?.description}
              </p>
            </div>

            {/* Custom options */}
            {votingType !== "BASIC" && (
              <div className="space-y-2">
                <label className={LABEL}>Options <span className="text-danger font-normal">*</span></label>
                <div className="space-y-2">
                  {options.map((opt, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-border-subtle rounded-xl px-3 focus-within:border-accent/50 transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-text-muted/50 shrink-0 select-none">
                          <circle cx="9" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/>
                          <circle cx="15" cy="5" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                        </svg>
                        <input
                          type="text" value={opt}
                          onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n) }}
                          placeholder={`Option ${i + 1}`}
                          maxLength={100}
                          className="flex-1 bg-transparent py-3 text-sm text-text-primary placeholder-text-muted outline-none"
                        />
                      </div>
                      {options.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                          className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                          aria-label="Xóa option"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setOptions([...options, ""])}
                  className="flex items-center gap-1.5 text-sm text-accent-light font-medium hover:underline"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Add Option
                </button>
              </div>
            )}

            {/* ── SECTION: Period ── */}
            <SectionDivider
              icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
              label="Voting Period"
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted">Bắt đầu</label>
                <input
                  type="datetime-local" value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required className={INPUT}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-text-muted">Kết thúc</label>
                <input
                  type="datetime-local" value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  required className={INPUT}
                />
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-accent/8 border border-accent/20 px-3 py-2.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs text-accent-light leading-relaxed">
                Voting power được tính tại epoch bắt đầu của voting period.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="notice-warning rounded-xl p-3 text-sm flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {error}
              </div>
            )}

            {/* Desktop action buttons (inside form) */}
            <div className="hidden sm:flex gap-3 pt-1">
              {ActionButtons}
            </div>

          </form>
        </div>

        {/* ── Mobile sticky footer ── */}
        <div
          className="sm:hidden flex gap-3 px-4 py-3 border-t border-border-subtle bg-bg-card shrink-0"
          style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
        >
          {ActionButtons}
        </div>
      </div>
    </>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CommunityPage({
  params,
}: {
  params: Promise<{ drepId: string }>
}) {
  const { drepId } = use(params)
  const network = useWalletStore((s) => s.selectedNetwork)
  const { drepKey, isConnected, isWalletHydrating, reauthenticate } = useWallet()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [alertModal, setAlertModal] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null)

  const { profile, isLoading: profileLoading } = useDRepProfile(drepId, network)
  const { isActive, isLoading: communityLoading } = useCommunity(drepId, network)
  const { polls, total, limit, isLoading: pollsLoading, refetch } = useCommunityPolls(drepId, network, page)

  const canonicalId = profile?.id ?? drepId
  const isOwner = !!drepKey?.dRepIDCip105 && drepKey.dRepIDCip105 === canonicalId
  const networkParam = network !== "mainnet" ? `?network=${network}` : ""

  const filteredPolls = search.trim()
    ? polls.filter((p) =>
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        (p.abstract ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : polls

  const isLoading = profileLoading || communityLoading

  const handleFormSuccess = useCallback((pollTitle: string) => {
    setIsFormOpen(false)
    setPage(1)
    refetch()
    setAlertModal({ type: "success", title: "Poll tạo thành công!", message: `"${pollTitle}" đã được tạo.` })
  }, [refetch])

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (isWalletHydrating || isLoading) {
    return (
      <div className="page-container space-y-6 animate-pulse">
        <div className="h-8 w-48 bg-bg-elevated rounded" />
        <div className="card-static h-12 bg-bg-elevated rounded-xl" />
        <div className="card-static space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2 pb-4 border-b border-border-subtle last:border-0">
              <div className="h-5 w-3/4 bg-bg-elevated rounded" />
              <div className="h-3 w-32 bg-bg-elevated rounded" />
              <div className="h-3 w-full bg-bg-elevated rounded" />
              <div className="h-3 w-5/6 bg-bg-elevated rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!isActive) {
    return (
      <div className="page-container">
        <Link href={`/dreps/${drepId}${networkParam}`} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-6">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          DRep Profile
        </Link>
        <div className="notice-warning rounded-xl p-8 text-center space-y-3">
          <p className="font-semibold">Community chưa được kích hoạt</p>
          <p className="text-sm text-text-muted">DRep này chưa kích hoạt DRep Community.</p>
          <Link href={`/dreps/${drepId}${networkParam}`} className="text-sm text-accent-light underline">
            Quay lại profile
          </Link>
        </div>
      </div>
    )
  }

  const displayName = profile?.givenName ?? profile?.name ?? drepId.slice(0, 12) + "..."

  return (
    <div className="page-container space-y-6 animate-fade-in">

      {/* Back link */}
      <Link href={`/dreps/${canonicalId}${networkParam}`} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {displayName}
      </Link>

      {/* Title */}
      <h1 className="text-2xl font-bold text-center">DRep Community</h1>

      {/* Toolbar + inline form + poll list */}
      <div className="card-static !p-0 overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center border-b border-border-subtle">
          {isOwner ? (
            <button
              type="button"
              onClick={() => setIsFormOpen((v) => !v)}
              className="flex items-center gap-2 px-4 py-3 text-sm text-accent-light hover:bg-accent/5 transition-colors border-r border-border-subtle"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="9" cy="9" r="6"/><path d="M9 6v6M6 9h6"/>
                <path d="M20 14l-5 5M22 16l-3 3" strokeWidth="1.5"/>
              </svg>
              Create an internal poll
              {/* Toggle icon: ⊕ when closed, ⊖ when open */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-text-muted">
                <circle cx="12" cy="12" r="10"/>
                {isFormOpen
                  ? <line x1="8" y1="12" x2="16" y2="12"/>
                  : <><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></>
                }
              </svg>
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-text-muted border-r border-border-subtle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Internal Polls
            </div>
          )}
          <div className="flex-1 flex items-center px-4 py-3">
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted outline-none"
            />
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-muted shrink-0">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
        </div>

        {/* Inline create form */}
        {isFormOpen && isOwner && (
          isConnected ? (
            <CreatePollForm
              drepId={canonicalId}
              network={network}
              onSuccess={handleFormSuccess}
              onCancel={() => setIsFormOpen(false)}
              onError={(msg) => setAlertModal({ type: "error", title: "Tạo poll thất bại", message: msg })}
              reauthenticate={reauthenticate}
            />
          ) : (
            <div className="border-b border-border-subtle p-5 text-center space-y-2">
              <p className="text-sm text-text-secondary">Kết nối ví để tạo Internal Poll.</p>
            </div>
          )
        )}

        {/* Poll list */}
        {pollsLoading && (
          <div className="divide-y divide-border-subtle">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-5 space-y-3 animate-pulse">
                <div className="h-5 w-3/4 bg-bg-elevated rounded" />
                <div className="h-3 w-32 bg-bg-elevated rounded" />
                <div className="h-3 w-full bg-bg-elevated rounded" />
              </div>
            ))}
          </div>
        )}

        {!pollsLoading && filteredPolls.length === 0 && (
          <div className="py-16 text-center space-y-3">
            <p className="text-4xl">📋</p>
            <p className="text-sm text-text-muted">
              {search ? "Không tìm thấy poll nào phù hợp" : "Chưa có Internal Poll nào"}
            </p>
            {isOwner && !search && (
              <button
                onClick={() => setIsFormOpen(true)}
                className="text-sm text-accent-light underline"
              >
                Tạo poll đầu tiên
              </button>
            )}
          </div>
        )}

        {!pollsLoading && filteredPolls.length > 0 && (
          <>
            <div>
              {filteredPolls.map((poll) => (
                <PollCard key={poll.id} poll={poll} drepId={canonicalId} network={network} />
              ))}
            </div>
            {!search && (
              <Pagination page={page} total={total} limit={limit} onPage={setPage} />
            )}
          </>
        )}
      </div>

      {alertModal && (
        <AlertModal
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          onClose={() => setAlertModal(null)}
        />
      )}
    </div>
  )
}
