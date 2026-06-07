"use client"

import { use, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useWallet } from "@/hooks/useWallet"
import { useDRepProfile } from "@/hooks/useDRepProfile"
import { useCommunity, useCommunityPolls } from "@/hooks/useCommunity"
import { RationaleEditor } from "@/components/governance/RationaleEditor"
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
    value: "BASIC",
    label: "Basic voting",
    description: "Members vote Yes, No, or Abstain.",
  },
  {
    value: "SINGLE_CHOICE",
    label: "Single choice voting",
    description: "Members pick exactly one option from a custom list.",
  },
  {
    value: "MULTIPLE_CHOICE",
    label: "Multiple choice voting",
    description: "Members can select (approve) many options. Each selected choice will receive equal voting power.",
  },
]

// ─── Create poll form (inline) ────────────────────────────────────────────────

function CreatePollForm({
  drepId,
  network,
  onSuccess,
  onCancel,
  reauthenticate,
}: {
  drepId: string
  network: string
  onSuccess: () => void
  onCancel: () => void
  reauthenticate: () => Promise<string | null>
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const now = new Date()
  const weekLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000)

  const [title, setTitle]           = useState("")
  const [abstract, setAbstract]     = useState("")
  const [motivation, setMotivation] = useState("")
  const [rationale, setRationale]   = useState("")
  const [imageUrl, setImageUrl]     = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "error">("idle")
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [links, setLinks]           = useState<string[]>([""])
  const [votingType, setVotingType] = useState<"BASIC" | "SINGLE_CHOICE" | "MULTIPLE_CHOICE">("BASIC")
  const [options, setOptions]       = useState<string[]>(["", ""])
  const [startsAt, setStartsAt]     = useState(toDatetimeLocal(now))
  const [endsAt, setEndsAt]         = useState(toDatetimeLocal(weekLater))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

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
      const res = await fetch(`${API_URL}/metadata/upload-image`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(jwt) },
        body: JSON.stringify({ base64, mimeType: file.type, filename: file.name }),
      })
      if (res.status === 401) {
        const newJwt = await reauthenticate()
        if (!newJwt) throw new Error("auth")
        const retry = await fetch(`${API_URL}/metadata/upload-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader(newJwt) },
          body: JSON.stringify({ base64, mimeType: file.type, filename: file.name }),
        })
        if (!retry.ok) throw new Error("Upload thất bại")
        const { imageUrl: url } = await retry.json()
        setImageUrl(url)
      } else if (!res.ok) {
        throw new Error("Upload thất bại")
      } else {
        const { imageUrl: url } = await res.json()
        setImageUrl(url)
      }
      setUploadState("idle")
    } catch {
      setUploadState("error")
      setUploadError("Upload thất bại. Vui lòng thử lại.")
      URL.revokeObjectURL(localUrl)
      setImagePreview(null)
    }
  }

  // ── Build POST body ─────────────────────────────────────────────────────────
  function buildBody() {
    const validLinks = links.map((l) => l.trim()).filter(Boolean)
    const body: Record<string, unknown> = {
      network,
      title: title.trim(),
      votingType,
      startsAt: new Date(startsAt).toISOString(),
      endsAt: new Date(endsAt).toISOString(),
    }
    if (abstract.trim()) body.abstract = abstract.trim()
    if (motivation.trim()) body.motivation = motivation.trim()
    if (rationale.trim()) body.rationale = rationale.trim()
    if (imageUrl) body.imageUrl = imageUrl
    if (validLinks.length > 0) body.supportLinks = validLinks
    if (votingType !== "BASIC") body.options = options.map((o) => o.trim()).filter(Boolean)
    return body
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError("Thời gian kết thúc phải sau thời gian bắt đầu")
      return
    }
    if (votingType !== "BASIC") {
      const filled = options.filter((o) => o.trim())
      if (filled.length < 2) { setError("Cần ít nhất 2 options"); return }
    }

    setIsSubmitting(true)
    setError(null)

    const doPost = (jwt: string | null) =>
      fetch(`${API_URL}/communities/${drepId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(jwt) },
        body: JSON.stringify(buildBody()),
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
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error ?? "Tạo poll thất bại")
      }
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi")
    } finally {
      setIsSubmitting(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, abstract, motivation, rationale, imageUrl, links, votingType, options, startsAt, endsAt, drepId, network, reauthenticate, onSuccess])

  const inputCls = "w-full bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/50 transition-colors"
  const labelCls = "text-sm font-medium text-text-secondary"
  const optionalBadge = <span className="ml-1.5 text-xs text-text-muted font-normal bg-bg-elevated px-1.5 py-0.5 rounded">Optional</span>

  return (
    <form onSubmit={handleSubmit} className="border-b border-border-subtle p-5 space-y-5 bg-bg-primary">

      {/* Title */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className={labelCls}>Title <span className="text-danger">*</span></label>
          <span className="text-xs text-text-muted">{title.length}/80</span>
        </div>
        <input
          type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Type a title for your internal poll"
          maxLength={80} required className={inputCls}
        />
      </div>

      {/* Abstract */}
      <RationaleEditor label="Abstract" placeholder="Describe your internal poll"
        maxLength={2500} height={180} description="" value={abstract} onChange={setAbstract} />

      {/* Motivation */}
      <RationaleEditor label="Motivation" placeholder="What problems is your internal poll solving?"
        maxLength={2500} height={180} description="" optional value={motivation} onChange={setMotivation} />

      {/* Rationale */}
      <RationaleEditor label="Rationale" placeholder="Explain the reasoning behind this poll..."
        maxLength={2500} height={180} description="" optional value={rationale} onChange={setRationale} />

      {/* Image upload */}
      <div className="space-y-2">
        <label className={labelCls}>Upload image {optionalBadge}</label>
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadState === "uploading"}
            className={`relative w-16 h-16 rounded-lg border-2 border-dashed flex items-center justify-center shrink-0 transition-colors ${
              imagePreview || imageUrl
                ? "border-accent/50"
                : "border-border-default hover:border-accent/40"
            }`}
          >
            {imagePreview || imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imagePreview ?? imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
            ) : uploadState === "uploading" ? (
              <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            )}
          </button>
          <div className="flex-1 space-y-1">
            {imageUrl && (
              <p className="text-xs text-text-muted break-all line-clamp-2">{imageUrl}</p>
            )}
            {uploadState === "error" && uploadError && (
              <p className="text-xs text-danger">{uploadError}</p>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadState === "uploading"}
              className="text-xs text-accent-light hover:underline"
            >
              {uploadState === "uploading" ? "Đang upload..." : imageUrl ? "Thay ảnh" : "Chọn ảnh"}
            </button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
      </div>

      {/* Support links */}
      <div className="space-y-2">
        <label className={labelCls}>Support links {optionalBadge}</label>
        <div className="space-y-2">
          {links.map((link, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="url"
                value={link}
                onChange={(e) => {
                  const next = [...links]; next[i] = e.target.value; setLinks(next)
                }}
                placeholder="https://website.com/"
                className={`${inputCls} flex-1`}
              />
              {links.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLinks(links.filter((_, idx) => idx !== i))}
                  className="px-2 text-text-muted hover:text-danger transition-colors"
                  aria-label="Remove link"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setLinks([...links, ""])}
          className="flex items-center gap-1.5 text-sm text-accent-light hover:underline"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Link
        </button>
      </div>

      {/* Voting type */}
      <div className="space-y-2">
        <label className={labelCls}>Voting type</label>
        <div className="relative">
          <select
            value={votingType}
            onChange={(e) => setVotingType(e.target.value as typeof votingType)}
            className={`${inputCls} appearance-none pr-8 cursor-pointer`}
          >
            {VOTING_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
        <p className="text-xs text-text-muted">{VOTING_TYPES.find((t) => t.value === votingType)?.description}</p>
      </div>

      {/* Custom options (SINGLE / MULTIPLE) */}
      {votingType !== "BASIC" && (
        <div className="space-y-2">
          <label className={labelCls}>Options <span className="text-danger">*</span></label>
          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex gap-2 items-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted shrink-0">
                  <circle cx="9" cy="5" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="19" r="1" fill="currentColor"/>
                  <circle cx="15" cy="5" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="19" r="1" fill="currentColor"/>
                </svg>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const next = [...options]; next[i] = e.target.value; setOptions(next)
                  }}
                  placeholder="Enter an option"
                  maxLength={100}
                  className={`${inputCls} flex-1`}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                    className="px-1 text-text-muted hover:text-danger transition-colors shrink-0"
                    aria-label="Remove option"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setOptions([...options, ""])}
            className="flex items-center gap-1.5 text-sm text-accent-light hover:underline"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Option
          </button>
        </div>
      )}

      {/* Voting period */}
      <div className="space-y-1.5">
        <label className={labelCls}>Voting Period</label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Bắt đầu</label>
            <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)}
              required className={inputCls} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-text-muted">Kết thúc</label>
            <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)}
              required className={inputCls} />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && <div className="notice-warning rounded-lg p-3 text-sm">{error}</div>}

      {/* Actions */}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} disabled={isSubmitting} className="btn-outline flex-1">
          Hủy
        </button>
        <button type="submit" disabled={isSubmitting || !title.trim()} className="btn-primary flex-1">
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <span className="spinner shrink-0" style={{ width: 16, height: 16, borderWidth: 2 }} />
              Đang tạo...
            </span>
          ) : "Tạo Poll"}
        </button>
      </div>
    </form>
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

  const handleFormSuccess = useCallback(() => {
    setIsFormOpen(false)
    setPage(1)
    refetch()
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
    </div>
  )
}
