"use client"

import Link from "next/link"
import type { GovernanceAction } from "@tempo/types"
import { useWalletStore } from "@/store/wallet"
import { useMyVote } from "@/hooks/useMyVote"
import type { MyVote } from "@/hooks/useMyVote"
import { useAnchorTitle } from "@/hooks/useAnchorTitle"
import { ActionIdChip } from "./ActionIdChip"
import VoteResultsPanel from "./VoteResultsPanel"
import { normalizeActionType } from "@/lib/governance"
import { GaStatusBadge } from "./GaStatusBadge"
import { useT } from "@/i18n/useT"
import { useVoteQueue, queueKey, type VoteChoice } from "@/store/voteQueue"

interface Props {
  action: GovernanceAction
  compact?: boolean
}

function MyVoteBadge({ vote }: { vote: MyVote }) {
  const t = useT()
  if (!vote) return null
  const cfg = {
    YES:     { cls: "bg-success/15 text-success border-success/30",  label: `✓ ${t("governance.vote.yes")}` },
    NO:      { cls: "bg-danger/15 text-danger border-danger/30",     label: `✓ ${t("governance.vote.no")}` },
    ABSTAIN: { cls: "bg-bg-elevated text-text-secondary border-border-default", label: `✓ ${t("governance.vote.abstain")}` },
  }[vote]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ── Inline quick-vote row ──────────────────────────────────────────────────────

function InlineVoteButtons({ action, proposalTitle }: { action: GovernanceAction; proposalTitle: string }) {
  const t = useT()
  const { addOrUpdate, remove, items } = useVoteQueue()
  const key = queueKey(action.txHash, action.index)
  const queued = items[key]

  const CHOICES: { value: VoteChoice; label: string; cls: string; activeCls: string }[] = [
    {
      value: "YES",
      label: t("governance.vote.yes"),
      cls: "border-success/40 text-success hover:bg-success/10 hover:border-success/70",
      activeCls: "border-success bg-success/20 text-success",
    },
    {
      value: "NO",
      label: t("governance.vote.no"),
      cls: "border-danger/40 text-danger hover:bg-danger/10 hover:border-danger/70",
      activeCls: "border-danger bg-danger/20 text-danger",
    },
    {
      value: "ABSTAIN",
      label: t("governance.vote.abstain"),
      cls: "border-border-default text-text-secondary hover:bg-white/5 hover:border-border-default",
      activeCls: "border-border-default bg-bg-elevated text-text-primary",
    },
  ]

  function handleVote(choice: VoteChoice, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (queued?.choice === choice) {
      remove(key)
    } else {
      addOrUpdate({
        ga: {
          txHash: action.txHash,
          index: action.index,
          title: proposalTitle,
          actionType: action.actionType,
        },
        choice,
        rationale: queued?.rationale ?? "",
      })
    }
  }

  return (
    <div
      className="flex items-center gap-2 mt-3"
      onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
    >
      {CHOICES.map(({ value, label, cls, activeCls }) => {
        const isActive = queued?.choice === value
        return (
          <button
            key={value}
            onClick={(e) => handleVote(value, e)}
            className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${isActive ? activeCls : cls}`}
          >
            {isActive ? `✓ ${label}` : label}
          </button>
        )
      })}
      {queued && (
        <span className="text-xs text-accent-light whitespace-nowrap shrink-0">
          {t("governance.voteForm.inQueue")}
        </span>
      )}
    </div>
  )
}

// ── Card ──────────────────────────────────────────────────────────────────────

export default function GovernanceActionCard({ action, compact = false }: Props) {
  const t = useT()
  const anchorTitle = useAnchorTitle(action.title ? null : action.anchorUrl)
  const { isConnected, isDrepRegistered, drepKey, selectedNetwork } = useWalletStore()
  const drepId = isDrepRegistered ? drepKey?.dRepIDCip105 : undefined
  const myVote = useMyVote(action.txHash, action.index, drepId, selectedNetwork)

  const proposalTitle = action.title ?? anchorTitle ?? t(`governance.type.${normalizeActionType(action.actionType)}`)
  const showVoteButtons = isDrepRegistered && action.status === "active"

  return (
    <div className="card-static animate-fade-in hover:border-border-default transition-colors">
      {/* Navigable area */}
      <Link href={`/governance-actions/${action.txHash}/${action.index}`} className="block space-y-4">
        {/* Header */}
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <h3 className={`font-semibold leading-snug ${compact ? "text-sm" : "text-base"}`}>
              {proposalTitle}
            </h3>
            {isConnected && <MyVoteBadge vote={myVote} />}
          </div>
          <ActionIdChip txHash={action.txHash} index={action.index} size="sm" />
        </div>

        {/* Meta — single row: epoch · status · type */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="text-text-secondary">
            {t("governance.card.expires")}{" "}
            <span className="text-text-primary font-medium">{t("governance.card.epoch", { n: action.expiresEpoch })}</span>
          </span>
          <span className="text-text-muted">·</span>
          <GaStatusBadge status={action.status} />
          <span className="text-text-muted">·</span>
          <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-bg-elevated text-text-secondary border border-border-subtle">
            {t(`governance.type.${normalizeActionType(action.actionType)}`)}
          </span>
        </div>

        {/* Voting Results */}
        <div className="bg-bg-secondary rounded-xl p-4 space-y-3 border border-border-subtle">
          <h4 className="font-semibold text-sm">{t("governance.card.voteResults")}</h4>
          <VoteResultsPanel action={action} />
        </div>
      </Link>

      {/* Quick vote row — outside Link so clicks don't navigate */}
      {showVoteButtons && (
        <InlineVoteButtons action={action} proposalTitle={proposalTitle} />
      )}
    </div>
  )
}
