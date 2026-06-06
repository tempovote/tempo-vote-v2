"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import type { GovernanceAction, VoteCounts } from "@tempo/types"
import { computeVotePercent, resolveAnchorUrl, VOTE_THRESHOLDS } from "@/lib/governance"

function useAnchorTitle(anchorUrl: string | null): string | null {
  const [title, setTitle] = useState<string | null>(null)

  useEffect(() => {
    const url = resolveAnchorUrl(anchorUrl)
    if (!url) return
    let cancelled = false
    fetch(url)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled || !data || typeof data !== "object") return
        const d = data as Record<string, unknown>
        const body = d.body as Record<string, unknown> | undefined
        const t = (body?.title ?? d.title) as string | undefined
        setTitle(t ?? null)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [anchorUrl])

  return title
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`
}

interface Props {
  action: GovernanceAction
  compact?: boolean
}

export default function GovernanceActionCard({ action, compact = false }: Props) {
  const anchorTitle = useAnchorTitle(action.anchorUrl)

  const drepPct = computeVotePercent(action.drepVotes)
  const ccPct = computeVotePercent(action.ccVotes)

  const thresholds = VOTE_THRESHOLDS[action.actionType]
  const drepThreshold = thresholds?.drep ? Math.round(thresholds.drep * 100) : null
  const ccThreshold = thresholds?.cc ? Math.round(thresholds.cc * 100) : null

  const heading = anchorTitle ?? action.type

  return (
    <Link href={`/governance-actions/${action.txHash}/${action.index}`} className="block">
      <div className="card-static space-y-4 animate-fade-in hover:border-border-default transition-colors cursor-pointer">
        {/* Header */}
        <div className="min-w-0">
          <h3 className={`font-semibold leading-snug ${compact ? "text-sm" : "text-base"}`}>
            {heading}
          </h3>
          {anchorTitle && (
            <p className="text-xs text-text-muted mt-0.5">{action.type}</p>
          )}
          <p className="text-xs text-text-muted font-mono mt-0.5">
            {shortHash(action.txHash)}#{action.index}
          </p>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
          <span>
            Hết hạn{" "}
            <span className="text-text-primary font-medium">Epoch {action.expiresEpoch}</span>
          </span>
          <span className="badge badge-active">Active</span>
        </div>

        {/* Voting Results */}
        <div className="bg-bg-secondary rounded-xl p-4 space-y-4 border border-border-subtle">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Kết quả bỏ phiếu</h4>
            {drepThreshold && (
              <span className="text-xs text-text-muted flex items-center gap-1">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12,6 12,12 16,14" />
                </svg>
                Cần {drepThreshold}%
              </span>
            )}
          </div>

          <VoteRow
            label="DRep"
            votes={action.drepVotes}
            yesPercent={drepPct.yesPercent}
            noPercent={drepPct.noPercent}
            threshold={drepThreshold}
          />

          <VoteRow
            label="CC"
            votes={action.ccVotes}
            yesPercent={ccPct.yesPercent}
            noPercent={ccPct.noPercent}
            threshold={ccThreshold}
          />
        </div>
      </div>
    </Link>
  )
}

interface VoteRowProps {
  label: string
  votes: VoteCounts
  yesPercent: number
  noPercent: number
  threshold: number | null
}

function VoteRow({ label, votes, yesPercent, noPercent, threshold }: VoteRowProps) {
  const total = votes.yes + votes.no + votes.abstain
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-secondary w-12 shrink-0">{label}</span>
        <div className="flex-1">
          <div className="vote-bar">
            <div className="vote-bar-yes" style={{ width: `${yesPercent}%` }} />
            <div className="vote-bar-no" style={{ width: `${noPercent}%` }} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-text-muted pl-15">
        <span>
          {votes.yes} Yes ({yesPercent}%) · {votes.no} No · {votes.abstain} Abstain
          {total > 0 && ` · ${total} tổng`}
        </span>
        {threshold !== null && (
          <div className="flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 10 10" className="text-warning">
              <polygon points="5,0 10,10 0,10" fill="currentColor" />
            </svg>
            <span>{threshold}%</span>
          </div>
        )}
      </div>
    </div>
  )
}
