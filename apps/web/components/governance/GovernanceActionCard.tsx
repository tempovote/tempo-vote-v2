"use client"

import Link from "next/link"
import type { GovernanceAction, VoteCounts } from "@tempo/types"
import { computeVotePercent, VOTE_THRESHOLDS } from "@/lib/governance"
import { useWalletStore } from "@/store/wallet"
import { useMyVote } from "@/hooks/useMyVote"
import type { MyVote } from "@/hooks/useMyVote"
import { useAnchorTitle } from "@/hooks/useAnchorTitle"
import { ActionIdChip } from "./ActionIdChip"

interface Props {
  action: GovernanceAction
  compact?: boolean
}

function MyVoteBadge({ vote }: { vote: MyVote }) {
  if (!vote) return null
  const cfg = {
    YES:     { cls: "bg-success/15 text-success border-success/30",  label: "✓ YES" },
    NO:      { cls: "bg-danger/15 text-danger border-danger/30",     label: "✓ NO" },
    ABSTAIN: { cls: "bg-bg-elevated text-text-secondary border-border-default", label: "✓ ABSTAIN" },
  }[vote]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

export default function GovernanceActionCard({ action, compact = false }: Props) {
  const anchorTitle = useAnchorTitle(action.anchorUrl)

  const { isDrepRegistered, drepKey, selectedNetwork } = useWalletStore()
  const drepId = isDrepRegistered ? drepKey?.dRepIDCip105 : undefined
  const myVote = useMyVote(action.txHash, action.index, drepId, selectedNetwork)

  const thresholds = VOTE_THRESHOLDS[action.actionType] ?? {}

  const drepPct = computeVotePercent(action.drepVotes)
  const spoPct  = computeVotePercent(action.spoVotes)
  const ccPct   = computeVotePercent(action.ccVotes)

  const spoHasVotes = action.spoVotes.yes + action.spoVotes.no + action.spoVotes.abstain > 0
  const ccHasVotes  = action.ccVotes.yes  + action.ccVotes.no  + action.ccVotes.abstain  > 0

  const showSpo = thresholds.spo !== undefined || spoHasVotes
  const showCc  = thresholds.cc  !== undefined || ccHasVotes

  const proposalTitle = anchorTitle ?? action.type

  return (
    <Link href={`/governance-actions/${action.txHash}/${action.index}`} className="block">
      <div className="card-static space-y-4 animate-fade-in hover:border-border-default transition-colors cursor-pointer">

        {/* Header */}
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <h3 className={`font-semibold leading-snug ${compact ? "text-sm" : "text-base"}`}>
              {proposalTitle}
            </h3>
            <MyVoteBadge vote={myVote} />
          </div>
          <ActionIdChip txHash={action.txHash} index={action.index} size="sm" />
        </div>

        {/* Meta — single row: epoch · status · type */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="text-text-secondary">
            Hết hạn{" "}
            <span className="text-text-primary font-medium">Epoch {action.expiresEpoch}</span>
          </span>
          <span className="text-text-muted">·</span>
          <span className="badge badge-active">Active</span>
          <span className="text-text-muted">·</span>
          <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-bg-elevated text-text-secondary border border-border-subtle">
            {action.type}
          </span>
        </div>

        {/* Voting Results */}
        <div className="bg-bg-secondary rounded-xl p-4 space-y-3 border border-border-subtle">
          <h4 className="font-semibold text-sm">Kết quả bỏ phiếu</h4>

          <VoteRow
            label="DRep"
            votes={action.drepVotes}
            yesPercent={drepPct.yesPercent}
            noPercent={drepPct.noPercent}
            threshold={thresholds.drep !== undefined ? Math.round(thresholds.drep * 100) : null}
          />

          {showSpo && (
            <VoteRow
              label="SPO"
              votes={action.spoVotes}
              yesPercent={spoPct.yesPercent}
              noPercent={spoPct.noPercent}
              threshold={thresholds.spo !== undefined ? Math.round(thresholds.spo * 100) : null}
            />
          )}

          {showCc && (
            <VoteRow
              label="CC"
              votes={action.ccVotes}
              yesPercent={ccPct.yesPercent}
              noPercent={ccPct.noPercent}
              threshold={thresholds.cc !== undefined ? Math.round(thresholds.cc * 100) : null}
            />
          )}
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
  const showLabelInBar = yesPercent > 20
  const tooltipText = !showLabelInBar
    ? `Yes: ${yesPercent}% · No: ${noPercent}% · Abstain: ${100 - yesPercent - noPercent}%`
    : undefined

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-secondary w-10 shrink-0">{label}</span>
        <div className="flex-1 relative">
          <div className="vote-bar" title={tooltipText}>
            <div
              className="vote-bar-yes"
              style={{ width: `${yesPercent}%` }}
            >
              {showLabelInBar && (
                <span className="text-white text-[10px] font-bold px-1.5 leading-none drop-shadow-sm select-none">
                  {yesPercent}%
                </span>
              )}
            </div>
            <div className="vote-bar-no" style={{ width: `${noPercent}%` }} />
          </div>
          {threshold !== null && (
            <div
              className="absolute z-10 w-[2px] rounded-full"
              style={{
                left:       `${threshold}%`,
                top:        "-2px",
                bottom:     "-2px",
                background: "white",
                boxShadow:  "0 0 0 1px rgba(0,0,0,0.3)",
              }}
            />
          )}
        </div>
        {threshold !== null ? (
          <span className="text-xs text-text-secondary font-semibold w-9 text-right shrink-0">
            {threshold}%
          </span>
        ) : (
          <span className="w-9 shrink-0" />
        )}
      </div>
      <div className="pl-[52px] text-xs text-text-muted">
        <span className="text-success">{votes.yes} Yes ({yesPercent}%)</span>
        {" · "}
        <span className="text-danger">{votes.no} No</span>
        {" · "}
        {votes.abstain} Abstain
        {total > 0 && ` · ${total} tổng`}
      </div>
    </div>
  )
}
