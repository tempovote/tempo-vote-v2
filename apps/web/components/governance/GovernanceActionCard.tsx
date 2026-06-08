"use client"

import Link from "next/link"
import type { GovernanceAction } from "@tempo/types"
import { useWalletStore } from "@/store/wallet"
import { useMyVote } from "@/hooks/useMyVote"
import type { MyVote } from "@/hooks/useMyVote"
import { useAnchorTitle } from "@/hooks/useAnchorTitle"
import { ActionIdChip } from "./ActionIdChip"
import VoteResultsPanel from "./VoteResultsPanel"
import { getActionTypeLabel } from "@/lib/governance"

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
            {getActionTypeLabel(action.actionType)}
          </span>
        </div>

        {/* Voting Results */}
        <div className="bg-bg-secondary rounded-xl p-4 space-y-3 border border-border-subtle">
          <h4 className="font-semibold text-sm">Kết quả bỏ phiếu</h4>
          <VoteResultsPanel action={action} />
        </div>
      </div>
    </Link>
  )
}

