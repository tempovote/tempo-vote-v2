"use client"

import { use, useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useWallet } from "@/hooks/useWallet"
import { usePollComments } from "@/hooks/useCommunity"
import type { PollComment } from "@tempo/types"

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
  const { isConnected, rewardAddress: stakeAddress } = useWallet()
  const commentRef = useRef<HTMLDivElement>(null)

  const { comments, total, isLoading, error, refetch } = usePollComments(pollId)

  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const networkParam = network !== "mainnet" ? `?network=${network}` : ""

  // Scroll to comment section if hash is #comment
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
      const res = await fetch(`${API_URL}/communities/polls/${pollId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stakeAddress, content: content.trim() }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error ?? "Gửi comment thất bại")
      }
      setContent("")
      refetch()
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Đã xảy ra lỗi")
    } finally {
      setSubmitting(false)
    }
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

      {/* Comments section */}
      <div id="comment" ref={commentRef} className="card-static space-y-0 !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="text-base font-bold">
            Thảo luận
            {total > 0 && <span className="ml-2 text-sm font-normal text-text-muted">({total})</span>}
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
        {isLoading && (
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

        {!isLoading && error && (
          <div className="px-5 py-8 text-center text-sm text-text-muted">Không thể tải bình luận</div>
        )}

        {!isLoading && !error && comments.length === 0 && (
          <div className="px-5 py-10 text-center space-y-2">
            <p className="text-3xl">💬</p>
            <p className="text-sm text-text-muted">Chưa có bình luận nào</p>
          </div>
        )}

        {!isLoading && !error && comments.length > 0 && (
          <div className="px-5 divide-y divide-border-subtle">
            {comments.map((c) => <CommentItem key={c.id} comment={c} />)}
          </div>
        )}
      </div>

    </div>
  )
}
