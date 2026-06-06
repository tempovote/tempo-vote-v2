"use client"

import { use, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useDRepProfile } from "@/hooks/useDRepProfile"
import { useDRepVotingHistory } from "@/hooks/useDRepVotingHistory"
import { useCommunity, useCommunityPolls } from "@/hooks/useCommunity"
import { useWallet } from "@/hooks/useWallet"
import { useTx } from "@/hooks/useTx"
import { ConnectWalletCta } from "@/components/ui/ConnectWalletCta"
import { resolveAnchorUrls } from "@/lib/governance"
import type { DRepVote, InternalPoll, PollStatus } from "@tempo/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ─── Avatar ──────────────────────────────────────────────────────────────────

function hashToColors(str: string): [string, string] {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  const hue1 = ((h >>> 0) % 360)
  const hue2 = (hue1 + 137) % 360
  return [`hsl(${hue1},65%,55%)`, `hsl(${hue2},65%,45%)`]
}

function DRepAvatar({ drepId, imageUrl, name, size = 64 }: {
  drepId: string
  imageUrl: string | null
  name: string | null
  size?: number
}) {
  const [colors] = useState(() => hashToColors(drepId))
  const [imgError, setImgError] = useState(false)
  const initial = (name ?? drepId).charAt(0).toUpperCase()

  if (imageUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name ?? drepId}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    )
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0 select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
      }}
    >
      {initial}
    </div>
  )
}

// ─── Short DRep ID ───────────────────────────────────────────────────────────

function shortDrepId(id: string): string {
  if (id.length <= 20) return id
  return `${id.slice(0, 12)}…${id.slice(-6)}`
}

// ─── Voting power formatter ──────────────────────────────────────────────────

function formatAda(lovelace: number): string {
  const ada = lovelace / 1_000_000
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(2)}M`
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(1)}K`
  return ada.toFixed(0)
}

// ─── Vote badge ──────────────────────────────────────────────────────────────

function VoteBadge({ vote }: { vote: DRepVote["vote"] }) {
  const cfg = {
    yes:     { cls: "bg-success/15 text-success border-success/30",     label: "YES" },
    no:      { cls: "bg-danger/15 text-danger border-danger/30",         label: "NO" },
    abstain: { cls: "bg-bg-elevated text-text-secondary border-border-default", label: "ABSTAIN" },
  }[vote]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Voting history row ───────────────────────────────────────────────────────

function VoteHistoryRow({ entry }: { entry: DRepVote }) {
  const [title, setTitle] = useState<string | null>(null)

  useEffect(() => {
    if (!entry.anchorUrl) return
    const urls = resolveAnchorUrls(entry.anchorUrl)
    if (urls.length === 0) return
    let cancelled = false

    const tryFetch = async (remaining: string[]): Promise<void> => {
      if (cancelled || remaining.length === 0) return
      const [url, ...rest] = remaining as [string, ...string[]]
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 4000)
        const r = await fetch(url, { signal: controller.signal })
        clearTimeout(timer)
        if (!r.ok) return tryFetch(rest)
        const data = await r.json() as Record<string, unknown>
        const body = ((data.body ?? data) as Record<string, unknown>)
        const t = typeof body.title === "string" ? body.title : null
        if (t && !cancelled) { setTitle(t); return }
        return tryFetch(rest)
      } catch {
        return tryFetch(rest)
      }
    }

    tryFetch(urls)
    return () => { cancelled = true }
  }, [entry.anchorUrl])

  return (
    <Link
      href={`/governance-actions/${entry.txHash}/${entry.index}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors rounded-lg group"
    >
      <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-bg-elevated text-text-secondary border border-border-subtle whitespace-nowrap shrink-0">
        {entry.type}
      </span>
      <span className="flex-1 text-sm text-text-primary group-hover:text-accent-light transition-colors truncate min-w-0">
        {title ?? `${entry.txHash.slice(0, 10)}…${entry.txHash.slice(-6)}#${entry.index}`}
      </span>
      <span className="text-xs text-text-muted whitespace-nowrap shrink-0">
        Epoch {entry.expiresEpoch}
      </span>
      <VoteBadge vote={entry.vote} />
    </Link>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, total, limit, onPage }: {
  page: number
  total: number
  limit: number
  onPage: (p: number) => void
}) {
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between px-4 pt-3 border-t border-border-subtle">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 text-sm rounded-lg border border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-default transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ← Trước
      </button>
      <span className="text-xs text-text-muted">
        Trang {page} / {totalPages} · {total} votes
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

// ─── About section ─────────────────────────────────────────────────────────────

function AboutSection({ title, content, isLoading }: {
  title: string
  content: string | null
  isLoading: boolean
}) {
  if (!isLoading && !content) return null
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">{title}</h3>
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-3 bg-bg-elevated rounded animate-pulse w-full" />
          <div className="h-3 bg-bg-elevated rounded animate-pulse w-5/6" />
          <div className="h-3 bg-bg-elevated rounded animate-pulse w-4/5" />
        </div>
      ) : (
        <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{content}</p>
      )}
    </div>
  )
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
      className="text-text-muted hover:text-accent-light transition-colors"
      title="Copy DRep ID"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-success">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

// ─── Poll status badge ────────────────────────────────────────────────────────

function PollStatusBadge({ status }: { status: PollStatus }) {
  const cfg = {
    active:  { cls: "bg-success/15 text-success border-success/30",   label: "Active" },
    pending: { cls: "bg-warning/15 text-warning border-warning/30",   label: "Sắp diễn ra" },
    closed:  { cls: "bg-bg-elevated text-text-muted border-border-subtle", label: "Đã đóng" },
  }[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Delegate Modal ───────────────────────────────────────────────────────────

function DelegateModal({
  drepId,
  drepName,
  network,
  onClose,
}: {
  drepId: string
  drepName: string | null
  network: string
  onClose: () => void
}) {
  const isConnected = useWalletStore((s) => s.isConnected)
  const delegatedDrep = useWalletStore((s) => s.delegatedDrep)
  const { submitTx, isReady } = useTx()
  const [txStatus, setTxStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  const alreadyDelegated = delegatedDrep?.id === drepId
  const displayName = drepName ?? shortDrepId(drepId)
  const explorerBase = network === "mainnet"
    ? "https://cardanoscan.io/transaction"
    : "https://preprod.cardanoscan.io/transaction"

  async function handleDelegate() {
    setTxStatus("loading")
    setTxError(null)
    try {
      const hash = await submitTx("DELEGATE", { targetDrepId: drepId, delegationType: "drep" })
      setTxHash(hash)
      setTxStatus("success")
    } catch (err: unknown) {
      setTxError(err instanceof Error ? err.message : "Giao dịch thất bại")
      setTxStatus("error")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={txStatus !== "loading" ? onClose : undefined}
      />

      <div className="relative bg-bg-card rounded-2xl w-full max-w-sm shadow-2xl border border-border-subtle">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-bold">Ủy quyền bỏ phiếu</h2>
          {txStatus !== "loading" && (
            <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">

          {/* Target DRep */}
          <div className="bg-bg-elevated rounded-xl p-4 border border-border-subtle space-y-1">
            <p className="text-xs text-text-muted">Ủy quyền cho</p>
            <p className="font-semibold text-text-primary truncate">{displayName}</p>
            <p className="font-mono text-xs text-text-muted">{shortDrepId(drepId)}</p>
          </div>

          {/* Current delegation */}
          {isConnected && !alreadyDelegated && delegatedDrep && txStatus === "idle" && (
            <div className="bg-bg-elevated rounded-xl p-3 border border-border-subtle text-xs text-text-muted space-y-0.5">
              <p>Đang ủy quyền cho</p>
              <p className="font-mono text-text-secondary truncate">
                {delegatedDrep.name ?? shortDrepId(delegatedDrep.id)}
              </p>
              <p className="text-[10px] opacity-70">Ủy quyền mới sẽ thay thế ủy quyền hiện tại</p>
            </div>
          )}

          {/* Not connected */}
          {!isConnected && (
            <ConnectWalletCta variant="inline" message="Kết nối ví để ủy quyền" />
          )}

          {/* Already delegated */}
          {isConnected && alreadyDelegated && txStatus === "idle" && (
            <div className="notice-success rounded-xl p-4 text-sm text-center">
              Bạn đã ủy quyền cho DRep này
            </div>
          )}

          {/* Loading */}
          {txStatus === "loading" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
              <p className="text-sm text-text-muted">Đang ký và gửi giao dịch...</p>
            </div>
          )}

          {/* Success */}
          {txStatus === "success" && txHash && (
            <div className="notice-success rounded-xl p-4 space-y-2">
              <p className="font-semibold text-sm">Ủy quyền thành công!</p>
              <p className="text-xs break-all font-mono opacity-80">{txHash}</p>
              <a
                href={`${explorerBase}/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs underline"
              >
                Xem trên Cardanoscan →
              </a>
            </div>
          )}

          {/* Error */}
          {txStatus === "error" && txError && (
            <div className="notice-warning rounded-xl p-4 space-y-1">
              <p className="font-semibold text-sm">Giao dịch thất bại</p>
              <p className="text-xs opacity-80">{txError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          {txStatus === "success" ? (
            <button onClick={onClose} className="btn-primary flex-1 text-sm">Đóng</button>
          ) : txStatus === "error" ? (
            <>
              <button onClick={() => setTxStatus("idle")} className="btn-outline flex-1 text-sm">Thử lại</button>
              <button onClick={onClose} className="btn-outline flex-1 text-sm">Đóng</button>
            </>
          ) : !isConnected ? (
            <button onClick={onClose} className="btn-outline flex-1 text-sm">Đóng</button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={txStatus === "loading"}
                className="btn-outline flex-1 text-sm"
              >
                Hủy
              </button>
              <button
                onClick={() => { void handleDelegate() }}
                disabled={!isReady || txStatus === "loading" || alreadyDelegated}
                className="btn-primary flex-1 text-sm disabled:opacity-50"
              >
                {alreadyDelegated ? "Đã ủy quyền" : "Ủy quyền"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Community Modal ──────────────────────────────────────────────────────────

function CommunityModal({
  drepId,
  network,
  onClose,
}: {
  drepId: string
  network: string
  onClose: () => void
}) {
  const { polls, total, isLoading } = useCommunityPolls(drepId, network, 1)
  const networkParam = network !== "mainnet" ? `?network=${network}` : ""

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-bg-card rounded-2xl w-full max-w-md max-h-[75vh] flex flex-col shadow-2xl border border-border-subtle">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
          <h2 className="text-sm font-bold">DRep Community</h2>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Poll list */}
        <div className="overflow-y-auto flex-1">
          {isLoading && (
            <div className="divide-y divide-border-subtle">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-5 py-4 space-y-2 animate-pulse">
                  <div className="h-3 w-20 bg-bg-elevated rounded-full" />
                  <div className="h-4 bg-bg-elevated rounded w-4/5" />
                  <div className="h-3 bg-bg-elevated rounded w-1/3" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && polls.length === 0 && (
            <div className="px-5 py-12 text-center space-y-2">
              <p className="text-3xl">📋</p>
              <p className="text-sm text-text-muted">Chưa có poll nào</p>
            </div>
          )}

          {!isLoading && polls.map((poll: InternalPoll) => (
            <Link
              key={poll.id}
              href={`/dreps/${drepId}/community/${poll.id}${networkParam}`}
              onClick={onClose}
              className="flex items-start gap-3 px-5 py-4 border-b border-border-subtle hover:bg-white/5 transition-colors last:border-0"
            >
              <div className="flex-1 min-w-0 space-y-1.5">
                <PollStatusBadge status={poll.status} />
                <p className="text-sm font-medium text-text-primary leading-snug line-clamp-2">
                  {poll.title}
                </p>
                <p className="text-xs text-text-muted">
                  {poll.commentCount} bình luận · kết thúc {new Date(poll.endsAt).toLocaleDateString("vi-VN")}
                </p>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-muted shrink-0 mt-1">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border-subtle shrink-0">
          <Link
            href={`/dreps/${drepId}/community${networkParam}`}
            onClick={onClose}
            className="block text-center text-sm text-accent-light hover:underline"
          >
            Xem tất cả{total > 0 ? ` (${total} polls)` : ""}
          </Link>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function DRepProfilePage({
  params,
}: {
  params: Promise<{ drepId: string }>
}) {
  const { drepId } = use(params)
  const network = useWalletStore((s) => s.selectedNetwork)
  const router = useRouter()
  const { drepKey } = useWallet()
  const { submitTx } = useTx()

  const { profile, isLoading, isLoadingMeta, error } = useDRepProfile(drepId, network)
  const [votePage, setVotePage] = useState(1)
  const canonicalId = profile?.id ?? drepId
  const { votes, total, limit, isLoading: isLoadingVotes, error: voteError } =
    useDRepVotingHistory(canonicalId, network, votePage)

  // Community state
  const { isActive, isLoading: communityLoading, refetch: refetchCommunity } = useCommunity(drepId, network)
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)
  const [communityModalOpen, setCommunityModalOpen] = useState(false)
  const [delegateModalOpen, setDelegateModalOpen] = useState(false)

  // Redirect to canonical CIP-105 URL if user landed on a CIP-129 URL
  useEffect(() => {
    if (profile?.id && profile.id !== drepId) {
      router.replace(`/dreps/${profile.id}${network !== "mainnet" ? `?network=${network}` : ""}`)
    }
  }, [profile?.id, drepId, network, router])

  async function handleActivateCommunity() {
    setActivating(true)
    setActivateError(null)
    try {
      const txHash = await submitTx("ACTIVATE_COMMUNITY", {})
      await fetch(`${API_URL}/communities/${canonicalId}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ network, txHash }),
      })
      refetchCommunity()
    } catch (err: unknown) {
      setActivateError(err instanceof Error ? err.message : "Kích hoạt thất bại")
    } finally {
      setActivating(false)
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="page-container space-y-6 animate-pulse">
        <div className="card-static space-y-4">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-full bg-bg-elevated shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-5 bg-bg-elevated rounded w-48" />
              <div className="h-3 bg-bg-elevated rounded w-72" />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="h-14 bg-bg-elevated rounded-xl flex-1" />
            <div className="h-14 bg-bg-elevated rounded-xl flex-1" />
          </div>
        </div>
        <div className="card-static h-40 bg-bg-elevated rounded-xl" />
        <div className="card-static h-64 bg-bg-elevated rounded-xl" />
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !profile) {
    return (
      <div className="page-container">
        <div className="notice-warning rounded-xl p-6 text-center space-y-3">
          <p className="font-semibold">Không tìm thấy DRep</p>
          <p className="text-xs text-text-muted">{error ?? "DRep không tồn tại hoặc chưa đăng ký"}</p>
          <Link href="/dreps" className="text-sm text-accent-light underline">
            ← Quay lại danh sách DReps
          </Link>
        </div>
      </div>
    )
  }

  const displayName = profile.givenName ?? profile.name ?? shortDrepId(profile.id)
  const hasAbout = profile.objectives || profile.motivations || profile.qualifications || isLoadingMeta
  const isOwner = !!drepKey?.dRepIDCip105 && drepKey.dRepIDCip105 === profile.id
  const networkParam = network !== "mainnet" ? `?network=${network}` : ""

  // Determine CTA button layout
  // isOwner: hide delegate, show community button (full width)
  // !isOwner + active community: [Delegate] [Your Community] side by side
  // !isOwner + no community: [Delegate] full width
  const showDelegateBtn = !isOwner

  return (
    <div className="page-container space-y-6 animate-fade-in">

      {/* Back link */}
      <Link href="/dreps" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Danh sách DReps
      </Link>

      {/* ── Profile Header ──────────────────────────────────────────────── */}
      <div className="card-static space-y-5">
        {/* Name + avatar row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <DRepAvatar
              drepId={profile.id}
              imageUrl={profile.imageUrl}
              name={displayName}
              size={64}
            />
            <div className="min-w-0 space-y-1">
              <h1 className="text-xl font-bold leading-tight break-words">{displayName}</h1>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs text-text-muted bg-bg-elevated px-2 py-0.5 rounded border border-border-subtle">
                  {shortDrepId(profile.id)}
                </span>
                <CopyButton text={profile.id} />
              </div>
            </div>
          </div>

          {/* Status chip + Share */}
          <div className="flex items-center gap-2 shrink-0">
            {profile.active ? (
              <span className="badge badge-active">Active</span>
            ) : (
              <span className="badge badge-expired">Inactive</span>
            )}
            <button
              onClick={() => navigator.clipboard.writeText(window.location.href)}
              className="p-2 rounded-lg border border-border-subtle text-text-muted hover:text-text-primary hover:border-border-default transition-colors"
              title="Sao chép link"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="bg-bg-secondary rounded-xl p-3 border border-border-subtle space-y-0.5">
          {profile.votingPower != null && profile.votingPower > 0 ? (
            <>
              <p className="text-xs text-text-muted">Active Voting Power</p>
              <p className="text-lg font-bold text-text-primary">
                {formatAda(profile.votingPower)} ₳
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-text-muted">Active Voting Power</p>
              <p className="text-lg font-bold text-text-primary">
                {profile.isRegistered ? "0 ₳" : "—"}
              </p>
              {profile.isRegistered && (
                <p className="text-[10px] text-text-muted">chưa có delegator</p>
              )}
            </>
          )}
        </div>

        {/* CTA buttons */}
        {activateError && (
          <p className="text-xs text-danger">{activateError}</p>
        )}
        <div className="flex gap-3">
          {showDelegateBtn && (
            <button
              className="btn-primary flex-1 text-sm"
              onClick={() => setDelegateModalOpen(true)}
            >
              Delegate Voting Power
            </button>
          )}

          {communityLoading ? (
            <div className="h-10 flex-1 bg-bg-elevated rounded-xl animate-pulse" />
          ) : isActive ? (
            <button
              onClick={() => setCommunityModalOpen(true)}
              className={`${isOwner ? "btn-primary" : "btn-outline"} flex-1 text-sm`}
            >
              Your DRep Community
            </button>
          ) : isOwner ? (
            <button
              onClick={handleActivateCommunity}
              disabled={activating}
              className="btn-primary flex-1 text-sm"
            >
              {activating ? "Đang kích hoạt..." : "Kích hoạt Community · 2 ADA"}
            </button>
          ) : null}
        </div>

        {/* Community link when active (for non-owners — full page link) */}
        {!communityLoading && isActive && !isOwner && (
          <Link
            href={`/dreps/${profile.id}/community${networkParam}`}
            className="text-xs text-text-muted hover:text-accent-light transition-colors text-center block"
          >
            Xem trang Community →
          </Link>
        )}
      </div>

      {/* ── About (CIP-119 metadata) ──────────────────────────────────────── */}
      {hasAbout && (
        <div className="card-static space-y-5">
          <h2 className="text-base font-bold">Về DRep này</h2>
          <AboutSection title="Objectives" content={profile.objectives} isLoading={isLoadingMeta && !profile.objectives} />
          <AboutSection title="Motivations" content={profile.motivations} isLoading={isLoadingMeta && !profile.motivations} />
          <AboutSection title="Qualifications" content={profile.qualifications} isLoading={isLoadingMeta && !profile.qualifications} />

          {/* References */}
          {profile.references && profile.references.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">References</h3>
              <div className="flex flex-wrap gap-2">
                {profile.references.map((ref, i) => (
                  <a
                    key={i}
                    href={ref.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-bg-elevated border border-border-subtle text-text-secondary hover:text-accent-light hover:border-accent/40 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    {ref.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Voting History ─────────────────────────────────────────────────── */}
      <div className="card-static space-y-0 !p-0 overflow-hidden">
        <div className="px-4 py-4 border-b border-border-subtle">
          <h2 className="text-base font-bold">
            Voting History
            {total > 0 && (
              <span className="ml-2 text-sm font-normal text-text-muted">({total})</span>
            )}
          </h2>
        </div>

        {isLoadingVotes && (
          <div className="divide-y divide-border-subtle">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                <div className="h-5 w-24 bg-bg-elevated rounded-full" />
                <div className="flex-1 h-4 bg-bg-elevated rounded" />
                <div className="h-4 w-16 bg-bg-elevated rounded" />
                <div className="h-5 w-14 bg-bg-elevated rounded-full" />
              </div>
            ))}
          </div>
        )}

        {!isLoadingVotes && voteError && (
          <div className="px-4 py-6 text-center text-sm text-text-muted">
            Không thể tải lịch sử bỏ phiếu
          </div>
        )}

        {!isLoadingVotes && !voteError && votes.length === 0 && (
          <div className="px-4 py-10 text-center space-y-2">
            <p className="text-3xl">🗳️</p>
            <p className="text-sm text-text-muted">DRep này chưa bỏ phiếu nào</p>
          </div>
        )}

        {!isLoadingVotes && !voteError && votes.length > 0 && (
          <>
            <div className="divide-y divide-border-subtle">
              {votes.map((entry) => (
                <VoteHistoryRow key={`${entry.txHash}-${entry.index}`} entry={entry} />
              ))}
            </div>
            <Pagination
              page={votePage}
              total={total}
              limit={limit}
              onPage={setVotePage}
            />
          </>
        )}
      </div>

      {/* ── Delegate Modal ────────────────────────────────────────────────── */}
      {delegateModalOpen && (
        <DelegateModal
          drepId={profile.id}
          drepName={profile.givenName ?? profile.name}
          network={network}
          onClose={() => setDelegateModalOpen(false)}
        />
      )}

      {/* ── Community Modal ───────────────────────────────────────────────── */}
      {communityModalOpen && (
        <CommunityModal
          drepId={profile.id}
          network={network}
          onClose={() => setCommunityModalOpen(false)}
        />
      )}

    </div>
  )
}
