"use client"

import { use, useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useWallet } from "@/hooks/useWallet"
import { usePollDetail, usePollComments } from "@/hooks/useCommunity"
import { authHeader, getJwt } from "@/lib/api"
import type { PollOptionWithCount, PollComment } from "@tempo/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

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
  return `${d} ngày trước`
}

function shortAddress(addr: string): string {
  if (addr.length <= 20) return addr
  return `${addr.slice(0, 10)}…${addr.slice(-8)}`
}

function timeLabel(status: string, endsAt: string, startsAt: string): string {
  if (status === "pending") {
    const ms = new Date(startsAt).getTime() - Date.now()
    if (ms <= 0) return "Sắp bắt đầu"
    const d = Math.floor(ms / 86400000)
    const h = Math.floor((ms % 86400000) / 3600000)
    return d > 0 ? `Bắt đầu sau ${d}d ${h}h` : `Bắt đầu sau ${h}h`
  }
  if (status === "closed") {
    const d = Math.floor((Date.now() - new Date(endsAt).getTime()) / 86400000)
    return `Đã kết thúc ${d} ngày trước`
  }
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return "Đang kết thúc..."
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  return d > 0 ? `Còn ${d}d ${h}h` : `Còn ${h}h`
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    active:  { cls: "bg-success/15 text-success border-success/30", label: "Active" },
    closed:  { cls: "bg-bg-elevated text-text-muted border-border-default", label: "Closed" },
    pending: { cls: "bg-accent/15 text-accent border-accent/30", label: "Pending" },
  }
  const { cls, label } = cfg[status] ?? cfg["pending"]!
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  )
}

// ─── Vote option button ───────────────────────────────────────────────────────

function OptionButton({
  option,
  total,
  selected,
  hasVoted,
  isActive,
  isConnected,
  onClick,
}: {
  option: PollOptionWithCount
  total: number
  selected: boolean
  hasVoted: boolean
  isActive: boolean
  isConnected: boolean
  onClick: () => void
}) {
  const pct = total > 0 ? Math.round((option.voteCount / total) * 100) : 0
  const showResults = hasVoted || !isActive

  const colorMap: Record<string, string> = {
    Yes: "bg-success/20 border-success/40",
    No: "bg-danger/20 border-danger/40",
    Abstain: "bg-text-muted/15 border-border-default",
  }
  const barColorMap: Record<string, string> = {
    Yes: "bg-success/50",
    No: "bg-danger/50",
    Abstain: "bg-text-muted/30",
  }

  const isVotable = isActive && isConnected && !hasVoted

  return (
    <button
      onClick={isVotable ? onClick : undefined}
      disabled={!isVotable}
      className={[
        "relative w-full rounded-xl border px-4 py-3 text-left transition-all overflow-hidden",
        isVotable
          ? "hover:border-accent/50 hover:bg-accent/5 cursor-pointer"
          : "cursor-default",
        selected
          ? (colorMap[option.text] ?? "bg-accent/15 border-accent/50")
          : "border-border-subtle bg-bg-elevated",
      ].join(" ")}
    >
      {/* Result bar */}
      {showResults && total > 0 && (
        <div
          className={`absolute inset-y-0 left-0 rounded-xl transition-all duration-500 ${barColorMap[option.text] ?? "bg-accent/20"}`}
          style={{ width: `${pct}%` }}
        />
      )}

      <div className="relative flex items-center justify-between gap-3">
        <span className="font-semibold text-sm text-text-primary">{option.text}</span>
        {showResults && (
          <span className="text-xs text-text-muted shrink-0">
            {option.voteCount} phiếu · {pct}%
          </span>
        )}
        {selected && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 text-success">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    </button>
  )
}

// ─── Voting section ───────────────────────────────────────────────────────────

function VotingSection({
  pollId,
  options,
  totalVotes,
  userVote,
  status,
  stakeAddress,
  isConnected,
  reauthenticate,
  onVoted,
}: {
  pollId: string
  options: PollOptionWithCount[]
  totalVotes: number
  userVote: string | null
  status: string
  stakeAddress: string | null | undefined
  isConnected: boolean
  reauthenticate: () => Promise<string | null>
  onVoted: () => void
}) {
  const [pending, setPending] = useState<string | null>(null)
  const [voteError, setVoteError] = useState<string | null>(null)

  const hasVoted = !!userVote
  const isActive = status === "active"

  async function castVote(optionId: string) {
    if (!stakeAddress || hasVoted || !isActive) return
    setPending(optionId)
    setVoteError(null)
    try {
      let jwt = getJwt()
      if (!jwt) jwt = await reauthenticate()
      if (!jwt) throw new Error("Cần xác thực ví trước khi bỏ phiếu.")
      const doVote = (token: string) =>
        fetch(`${API_URL}/communities/polls/${pollId}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader(token) },
          body: JSON.stringify({ optionId }),
        })
      let res = await doVote(jwt)
      if (res.status === 401) {
        const newJwt = await reauthenticate()
        if (!newJwt) throw new Error("Xác thực thất bại.")
        res = await doVote(newJwt)
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error ?? "Bỏ phiếu thất bại")
      }
      onVoted()
    } catch (err: unknown) {
      setVoteError(err instanceof Error ? err.message : "Đã xảy ra lỗi")
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>{totalVotes} phiếu đã bỏ</span>
        {hasVoted && <span className="text-success font-medium">✓ Bạn đã bỏ phiếu</span>}
        {!isConnected && isActive && <span>Kết nối ví để bỏ phiếu</span>}
        {isConnected && !isActive && status === "closed" && <span>Poll đã kết thúc</span>}
        {isConnected && !isActive && status === "pending" && <span>Poll chưa bắt đầu</span>}
      </div>

      <div className="space-y-2">
        {options.map((opt) => (
          <OptionButton
            key={opt.id}
            option={opt}
            total={totalVotes}
            selected={userVote === opt.id}
            hasVoted={hasVoted}
            isActive={isActive}
            isConnected={isConnected}
            onClick={() => { void castVote(opt.id) }}
          />
        ))}
      </div>

      {pending && (
        <p className="text-xs text-text-muted text-center animate-pulse">Đang bỏ phiếu...</p>
      )}
      {voteError && (
        <p className="text-xs text-danger text-center">{voteError}</p>
      )}
    </div>
  )
}

// ─── Comment item ─────────────────────────────────────────────────────────────

function CommentItem({ comment }: { comment: PollComment }) {
  return (
    <div className="flex gap-3 py-4 border-b border-border-subtle last:border-0">
      <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0 text-xs font-bold text-accent-light">
        {comment.stakeAddress.slice(-2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-text-muted">{shortAddress(comment.stakeAddress)}</span>
          <span className="text-xs text-text-muted">·</span>
          <span className="text-xs text-text-muted">{relativeTime(comment.createdAt)}</span>
        </div>
        <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{comment.content}</p>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PollDetailPage({
  params,
}: {
  params: Promise<{ drepId: string; pollId: string }>
}) {
  const { drepId, pollId } = use(params)
  const network = useWalletStore((s) => s.selectedNetwork)
  const { isConnected, rewardAddress: stakeAddress, reauthenticate } = useWallet()
  const commentRef = useRef<HTMLDivElement>(null)

  const { poll, isLoading: pollLoading, error: pollError, refetch: refetchPoll } = usePollDetail(pollId, stakeAddress)
  const { comments, total: commentTotal, isLoading: commentsLoading, error: commentsError, refetch: refetchComments } = usePollComments(pollId)

  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const networkParam = network !== "mainnet" ? `?network=${network}` : ""

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#comment") {
      commentRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [])

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || !stakeAddress) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      let jwt = getJwt()
      if (!jwt) jwt = await reauthenticate()
      if (!jwt) throw new Error("Cần xác thực ví trước khi bình luận.")
      const doPost = (token: string) =>
        fetch(`${API_URL}/communities/polls/${pollId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader(token) },
          body: JSON.stringify({ content: content.trim() }),
        })
      let res = await doPost(jwt)
      if (res.status === 401) {
        const newJwt = await reauthenticate()
        if (!newJwt) throw new Error("Xác thực thất bại.")
        res = await doPost(newJwt)
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error ?? "Gửi comment thất bại")
      }
      setContent("")
      refetchComments()
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Đã xảy ra lỗi")
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (pollLoading) {
    return (
      <div className="page-container space-y-6 animate-pulse">
        <div className="h-5 w-32 bg-bg-elevated rounded" />
        <div className="card-static space-y-4">
          <div className="h-7 w-3/4 bg-bg-elevated rounded" />
          <div className="h-4 w-24 bg-bg-elevated rounded" />
          <div className="h-3 w-full bg-bg-elevated rounded" />
          <div className="h-3 w-5/6 bg-bg-elevated rounded" />
          <div className="space-y-2 pt-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-bg-elevated rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  if (pollError || !poll) {
    return (
      <div className="page-container">
        <Link href={`/dreps/${drepId}/community${networkParam}`} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-6">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          DRep Community
        </Link>
        <div className="notice-warning rounded-xl p-8 text-center">
          <p className="font-semibold">Không tìm thấy poll</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container space-y-6 animate-fade-in">

      {/* Back */}
      <Link
        href={`/dreps/${drepId}/community${networkParam}`}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        DRep Community
      </Link>

      {/* Poll card */}
      <div className="card-static space-y-5">

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={poll.status} />
            <span className="text-xs text-text-muted">{timeLabel(poll.status, poll.endsAt, poll.startsAt)}</span>
          </div>
          <h1 className="text-xl font-bold text-text-primary leading-snug">{poll.title}</h1>
        </div>

        {/* Cover image */}
        {poll.imageUrl && (
          <div className="rounded-xl overflow-hidden border border-border-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={poll.imageUrl}
              alt="Poll cover"
              className="w-full max-h-72 object-cover"
            />
          </div>
        )}

        {/* Abstract */}
        {poll.abstract && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Tóm tắt</h3>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{poll.abstract}</p>
          </div>
        )}

        {/* Motivation */}
        {poll.motivation && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Động lực</h3>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{poll.motivation}</p>
          </div>
        )}

        {/* Rationale */}
        {poll.rationale && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Cơ sở lý luận</h3>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">{poll.rationale}</p>
          </div>
        )}

        {/* Support links */}
        {poll.supportLinks && poll.supportLinks.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Tài liệu tham khảo</h3>
            <ul className="space-y-1">
              {poll.supportLinks.map((link, i) => (
                <li key={i}>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent-light hover:underline break-all"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Divider */}
        <hr className="border-border-subtle" />

        {/* Voting */}
        <VotingSection
          pollId={pollId}
          options={poll.options}
          totalVotes={poll.totalVotes}
          userVote={poll.userVote}
          status={poll.status}
          stakeAddress={stakeAddress}
          isConnected={isConnected}
          reauthenticate={reauthenticate}
          onVoted={refetchPoll}
        />
      </div>

      {/* Comments */}
      <div id="comment" ref={commentRef} className="card-static space-y-0 !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="text-base font-bold">
            Thảo luận
            {commentTotal > 0 && <span className="ml-2 text-sm font-normal text-text-muted">({commentTotal})</span>}
          </h2>
        </div>

        {/* Comment form */}
        {isConnected && stakeAddress ? (
          <form onSubmit={handleComment} className="px-5 py-4 border-b border-border-subtle space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Viết bình luận của bạn..."
              rows={3}
              className="w-full bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/50 transition-colors resize-none"
            />
            {submitError && <p className="text-xs text-danger">{submitError}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !content.trim()}
                className="btn-primary text-sm px-5"
              >
                {submitting ? "Đang gửi..." : "Gửi"}
              </button>
            </div>
          </form>
        ) : (
          <div className="px-5 py-4 border-b border-border-subtle text-center text-sm text-text-muted">
            Kết nối ví để tham gia thảo luận
          </div>
        )}

        {/* Comments list */}
        {commentsLoading && (
          <div className="divide-y divide-border-subtle px-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 py-4 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-bg-elevated shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 w-32 bg-bg-elevated rounded" />
                  <div className="h-3 w-full bg-bg-elevated rounded" />
                  <div className="h-3 w-4/5 bg-bg-elevated rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!commentsLoading && commentsError && (
          <div className="px-5 py-8 text-center text-sm text-text-muted">Không thể tải bình luận</div>
        )}

        {!commentsLoading && !commentsError && comments.length === 0 && (
          <div className="px-5 py-10 text-center space-y-2">
            <p className="text-3xl">💬</p>
            <p className="text-sm text-text-muted">Chưa có bình luận nào</p>
          </div>
        )}

        {!commentsLoading && !commentsError && comments.length > 0 && (
          <div className="px-5 divide-y divide-border-subtle">
            {comments.map((c) => <CommentItem key={c.id} comment={c} />)}
          </div>
        )}
      </div>

    </div>
  )
}
