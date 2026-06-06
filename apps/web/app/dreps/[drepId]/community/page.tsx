"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useWallet } from "@/hooks/useWallet"
import { useDRepProfile } from "@/hooks/useDRepProfile"
import { useCommunity, useCommunityPolls } from "@/hooks/useCommunity"
import type { InternalPoll } from "@tempo/types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return "vừa xong"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} phút trước`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ trước`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d} ngày trước`
  const mo = Math.floor(d / 30)
  return `${mo} tháng trước`
}

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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CommunityPage({
  params,
}: {
  params: Promise<{ drepId: string }>
}) {
  const { drepId } = use(params)
  const network = useWalletStore((s) => s.selectedNetwork)
  const { drepKey } = useWallet()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")

  const { profile, isLoading: profileLoading } = useDRepProfile(drepId, network)
  const { isActive, isLoading: communityLoading } = useCommunity(drepId, network)
  const { polls, total, limit, isLoading: pollsLoading } = useCommunityPolls(drepId, network, page)

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

  // ── Guards ──────────────────────────────────────────────────────────────────
  if (isLoading) {
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

      {/* Toolbar: create + search */}
      <div className="card-static !p-0 overflow-hidden">
        <div className="flex items-center border-b border-border-subtle">
          {isOwner ? (
            <Link
              href={`/dreps/${canonicalId}/community/new${networkParam}`}
              className="flex items-center gap-2 px-4 py-3 text-sm text-accent-light hover:bg-accent/5 transition-colors border-r border-border-subtle"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="9" cy="9" r="6"/><path d="M9 6v6M6 9h6"/>
                <path d="M20 14l-5 5M22 16l-3 3" strokeWidth="1.5"/>
              </svg>
              Create an internal poll
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-text-muted">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </Link>
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
              <Link href={`/dreps/${canonicalId}/community/new${networkParam}`} className="text-sm text-accent-light underline">
                Tạo poll đầu tiên
              </Link>
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
