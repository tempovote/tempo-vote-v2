"use client"

import { useState, use } from "react"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useMyVote, type MyVote } from "@/hooks/useMyVote"
import { useVoteQueue, queueKey, type VoteChoice } from "@/store/voteQueue"
import { useAnchorTitle } from "@/hooks/useAnchorTitle"
import { useGovernanceAction } from "@/hooks/useGovernanceAction"
import { ActionIdChip } from "@/components/governance/ActionIdChip"
import { ConnectWalletCta } from "@/components/ui/ConnectWalletCta"
import { type GovernanceAction } from "@tempo/types"
import { resolveAnchorUrl, normalizeActionType } from "@/lib/governance"
import { CopyIconButton } from "@/components/ui/CopyIconButton"
import { useT } from "@/i18n/useT"
import VoteResultsPanel from "@/components/governance/VoteResultsPanel"
import { ActionDetailCard } from "@/components/governance/ActionDetailCard"
import { GaStatusBadge } from "@/components/governance/GaStatusBadge"
import { GaDetailTabs } from "@/components/governance/GaDetailTabs"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ── Vote section ──────────────────────────────────────────────────────────────
function VoteSection({ action, heading }: { action: GovernanceAction; heading: string }) {
  const t = useT()
  const { isConnected, isDrepRegistered, drepKey, selectedNetwork } = useWalletStore()
  const { addOrUpdate, remove, items, openPanel } = useVoteQueue()

  const drepId = isDrepRegistered ? drepKey?.dRepIDCip105 : undefined
  const myVote = useMyVote(action.txHash, action.index, drepId, selectedNetwork)

  const key = queueKey(action.txHash, action.index)
  const queued = items[key]

  if (!isConnected) {
    return <ConnectWalletCta message={t("governance.voteForm.connectToVote")} />
  }

  if (!isDrepRegistered) {
    return (
      <div className="card-static text-center py-8 space-y-2 text-text-muted">
        <p className="font-medium">{t("governance.voteForm.onlyDrep")}</p>
        <Link href="/dreps/register" className="text-sm text-accent-light underline">
          {t("governance.voteForm.registerNow")}
        </Link>
      </div>
    )
  }

  function handleVote(choice: VoteChoice) {
    if (queued?.choice === choice) {
      remove(key)
    } else {
      addOrUpdate({
        ga: {
          txHash: action.txHash,
          index: action.index,
          title: heading,
          actionType: action.actionType,
        },
        choice,
        rationale: queued?.rationale ?? "",
      })
    }
  }

  const CHOICES: { value: VoteChoice; label: string; cls: string; activeCls: string }[] = [
    { value: "YES",     label: t("governance.vote.yes"),     cls: "border-success/50 text-success hover:bg-success/10",          activeCls: "border-success bg-success/20 text-success" },
    { value: "NO",      label: t("governance.vote.no"),      cls: "border-danger/50 text-danger hover:bg-danger/10",             activeCls: "border-danger bg-danger/20 text-danger" },
    { value: "ABSTAIN", label: t("governance.vote.abstain"), cls: "border-border-default text-text-secondary hover:bg-white/5",  activeCls: "border-border-default bg-bg-elevated text-text-primary" },
  ]

  return (
    <div className="card-static space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">
          {myVote ? t("governance.voteForm.yourVote") : t("governance.voteForm.castVote")}
        </h3>
        {myVote && <MyVoteBadge vote={myVote} />}
      </div>

      {myVote && (
        <p className="text-xs text-text-muted">{t("governance.voteForm.canChange")}</p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {CHOICES.map(({ value, label, cls, activeCls }) => {
          const isQueued = queued?.choice === value
          const isCurrentVote = myVote === value && !queued
          return (
            <button
              key={value}
              onClick={() => handleVote(value)}
              className={`py-3 rounded-xl border-2 font-bold text-sm transition-colors ${
                isQueued ? activeCls : isCurrentVote ? activeCls : cls
              }`}
            >
              {(isQueued || isCurrentVote) ? `✓ ${label}` : label}
            </button>
          )
        })}
      </div>

      {queued ? (
        <div className="flex items-center justify-between bg-bg-secondary rounded-xl px-4 py-3">
          <p className="text-sm text-text-secondary">
            {t("governance.voteForm.inQueue")}
          </p>
          <button
            onClick={openPanel}
            className="text-sm text-accent-light font-medium hover:underline"
          >
            {t("governance.voteForm.openQueue")} →
          </button>
        </div>
      ) : (
        <p className="text-xs text-text-muted text-center">
          {t("governance.voteForm.willSign")}
        </p>
      )}
    </div>
  )
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
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GovernanceActionDetailPage({
  params,
}: {
  params: Promise<{ txHash: string; index: string }>
}) {
  const t = useT()
  const { txHash, index: indexStr } = use(params)
  const index = parseInt(indexStr, 10)
  const network = useWalletStore((s) => s.selectedNetwork)

  const { action, loading, error: fetchError } = useGovernanceAction(network, txHash, index)

  // Use DB title if available; fall back to anchor-fetch for new proposals not yet in DB
  const anchorTitle = useAnchorTitle(action?.title ? null : (action?.anchorUrl ?? null))

  const heading = action?.title ?? anchorTitle ?? action?.type ?? t("governance.detail.fallbackHeading")

  return (
    <div className="page-container space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted animate-fade-in">
        <Link href="/governance-actions" className="hover:text-text-primary transition-colors whitespace-nowrap">
          {t("governance.list.title")}
        </Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {loading && !action ? (
          <div className="h-4 w-36 bg-bg-elevated rounded animate-pulse" />
        ) : (
          <span className="text-text-primary truncate max-w-[200px]">{heading}</span>
        )}
      </nav>

      {/* Loading */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="card-static h-48 bg-bg-card" />
          <div className="card-static h-40 bg-bg-card" />
        </div>
      )}

      {/* Error */}
      {!loading && fetchError && (
        <div className="notice-warning rounded-xl p-4 space-y-1">
          <p className="font-medium">{t("governance.detail.notFound")}</p>
          <p className="text-xs text-text-muted">{fetchError}</p>
          <Link href="/governance-actions" className="text-sm text-accent-light underline block mt-2">
            {t("governance.detail.backToList")}
          </Link>
        </div>
      )}

      {/* Content */}
      {!loading && action && (
        <>
          {/* Header card */}
          <div className="card-static space-y-5 animate-fade-in">
            {/* Title + type badge */}
            <div className="space-y-2">
              <div className="flex items-start gap-3 flex-wrap">
                <GaStatusBadge status={action.status} />
                <span className="text-xs text-text-muted bg-bg-elevated px-2 py-0.5 rounded-full shrink-0">
                  {t(`governance.type.${normalizeActionType(action.actionType)}`)}
                </span>
              </div>
              <h1 className="text-xl font-bold leading-snug">{heading}</h1>
              <ActionIdChip txHash={action.txHash} index={action.index} size="md" />
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-text-muted text-xs mb-0.5">{t("governance.card.expires")}</p>
                <p className="font-medium">{t("governance.card.epoch", { n: action.expiresEpoch })}</p>
              </div>
              <div>
                <p className="text-text-muted text-xs mb-0.5">{t("governance.detail.deposit")}</p>
                <p className="font-medium">
                  {(action.deposit / 1_000_000).toLocaleString()} ADA
                </p>
              </div>
              {action.anchorUrl && (
                <div>
                  <p className="text-text-muted text-xs mb-0.5">{t("governance.detail.attachedDoc")}</p>
                  <a
                    href={resolveAnchorUrl(action.anchorUrl) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-light hover:underline text-xs truncate block"
                  >
                    {action.anchorUrl.startsWith("ipfs://")
                      ? action.anchorUrl.slice(0, 30) + "…"
                      : action.anchorUrl}
                  </a>
                </div>
              )}
            </div>

            {/* Anchor hash */}
            {action.anchorHash && (
              <div className="bg-bg-secondary rounded-lg px-3 py-2 text-xs text-text-muted font-mono break-all">
                <span className="text-text-muted/60 mr-2">hash:</span>
                <span title={action.anchorHash}>
                  {/* full on desktop, truncated on mobile */}
                  <span className="hidden sm:inline">{action.anchorHash}</span>
                  <span className="sm:hidden">{action.anchorHash.slice(0, 12)}…{action.anchorHash.slice(-8)}</span>
                </span>
                <CopyIconButton
                  value={action.anchorHash}
                  title={t("governance.detail.copyHash")}
                  size={11}
                  className="hover:text-text-primary"
                />
              </div>
            )}
          </div>

          {/* Type-specific detail card */}
          <ActionDetailCard action={action} />

          {/* Vote results card */}
          <div className="card-static space-y-3 animate-fade-in">
            <h2 className="font-semibold text-base">{t("governance.card.voteResults")}</h2>
            <VoteResultsPanel action={action} />
          </div>

          {/* Vote history + Metadata tabs */}
          <GaDetailTabs action={action} />

          {/* Vote action */}
          <div className="animate-slide-up">
            <VoteSection action={action} heading={heading} />
          </div>
        </>
      )}
    </div>
  )
}
