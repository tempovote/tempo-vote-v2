"use client"

import { useState } from "react"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useWallet } from "@/hooks/useWallet"
import { useCommunity } from "@/hooks/useCommunity"
import { resolvePollCta, resolveTargetDrepId } from "@/lib/pollCta"
import GovernanceActionCard from "@/components/governance/GovernanceActionCard"
import { useGovernanceActions } from "@/hooks/useGovernanceActions"
import { govActionIdToBech32 } from "@/lib/governance"
import { useAnchorTitlesMap } from "@/hooks/useAnchorTitle"
import { useT } from "@/i18n/useT"

const STATUS_TABS = ["active", "ratified", "enacted", "expired"]

const TYPE_CHIPS = [
  "treasuryWithdrawals",
  "protocolParametersUpdate",
  "hardForkInitiation",
  "infoAction",
  "noConfidence",
  "updateCommittee",
  "newConstitution",
]

export default function GovernanceActionsPage() {
  const t = useT()
  const network = useWalletStore((s) => s.selectedNetwork)
  const isDrepRegistered = useWalletStore((s) => s.isDrepRegistered)
  const delegatedDrep = useWalletStore((s) => s.delegatedDrep)
  const { drepKey } = useWallet()

  // The CTA must reflect the user's role + real community state, not the always-present
  // derived DRep key (dRepIDCip105 exists for any CIP-95 wallet, even non-DReps).
  // Routing matrix lives in resolvePollCta (lib/pollCta.ts) so it's unit-tested.
  const ownDrepId = drepKey?.dRepIDCip105 ?? null
  const delegatedDrepId = delegatedDrep?.id ?? null
  const targetDrepId = resolveTargetDrepId(isDrepRegistered, ownDrepId, delegatedDrepId)
  const { isActive: targetActive } = useCommunity(targetDrepId ?? "", network)
  const cta = resolvePollCta({ isDrepRegistered, ownDrepId, delegatedDrepId, targetActive, network })
  const pollCta = { href: cta.href, label: t(cta.labelKey) }

  const [statusFilter, setStatusFilter] = useState("active")
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  // Always fetch ALL proposals (no type pre-filter) so the status filter has the full dataset.
  // Both status and type are filtered client-side from the single ${network}:all cache entry.
  const { actions, isLoading, error } = useGovernanceActions(network)

  // Client-side status + type filtering (order matters: status first)
  const statusFiltered = actions.filter((a) => a.status === statusFilter)
  const typeFiltered = typeFilter
    ? statusFiltered.filter((a) => a.actionType === typeFilter)
    : statusFiltered

  // Titles are served by the API (DB-backed). Only fall back to anchor-fetch for GAs
  // not yet in the DB (new proposals). Pass null for anchors that already have a title.
  const titlesMap = useAnchorTitlesMap(typeFiltered.map((a) => a.title ? null : a.anchorUrl))

  const q = search.trim().toLowerCase()
  const visible = [...(q
    ? typeFiltered.filter((a) => {
        const title = a.title ?? (a.anchorUrl ? (titlesMap.get(a.anchorUrl) ?? null) : null)
        return (
          a.txHash.toLowerCase().includes(q) ||
          a.type.toLowerCase().includes(q) ||
          a.actionType.toLowerCase().includes(q) ||
          govActionIdToBech32(a.txHash, a.index).toLowerCase().includes(q) ||
          (title?.toLowerCase().includes(q) ?? false)
        )
      })
    : typeFiltered
  )].sort((a, b) => b.expiresEpoch - a.expiresEpoch)

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-center animate-fade-in">
        {t("governance.list.title")}
      </h1>

      {/* Search bar */}
      <div className="flex gap-2 animate-fade-in">
        <div className="relative flex-1">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder={t("governance.list.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-2.5 animate-fade-in">
        {/* Status tabs — badge chip style */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted whitespace-nowrap">{t("governance.list.statusLabel")}</span>
          <div className="flex gap-2">
            {STATUS_TABS.map((value) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`badge badge-${value} transition-opacity ${
                  statusFilter === value ? "opacity-100" : "opacity-40 hover:opacity-70"
                }`}
              >
                {t(`common.status.${value}`)}
              </button>
            ))}
          </div>
        </div>

        {/* Type chips — scrollable, single-select toggle */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-text-muted whitespace-nowrap shrink-0">{t("governance.list.typeLabel")}</span>
          <div
            className="flex gap-2 overflow-x-auto min-w-0"
            style={{ scrollbarWidth: "none" }}
          >
            {TYPE_CHIPS.map((value) => (
              <button
                key={value}
                onClick={() => setTypeFilter((f) => (f === value ? null : value))}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border whitespace-nowrap shrink-0 ${
                  typeFilter === value
                    ? "bg-accent text-white border-accent"
                    : "bg-bg-card text-text-secondary border-border-subtle hover:text-text-primary hover:border-border-default"
                }`}
              >
                {t(`governance.typeChip.${value}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Propose action CTA */}
      <div className="card-accent space-y-3 animate-slide-up">
        <h3 className="text-base font-bold text-accent-light">
          {t("governance.list.proposeTitle")}
        </h3>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <p className="text-sm text-text-secondary">
            {t("governance.list.proposeDesc")}
          </p>
          <Link
            href={pollCta.href}
            className="btn-primary sm:shrink-0 text-sm inline-flex items-center gap-1.5 justify-center"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            {pollCta.label}
          </Link>
        </div>
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card-static animate-pulse h-52 rounded-xl bg-bg-card" />
          ))}
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div className="notice-warning rounded-xl p-4 space-y-1">
          <p className="font-medium">{t("governance.list.loadError")}</p>
          <p className="text-xs text-text-muted">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && visible.length === 0 && (
        <div className="text-center py-16 text-text-muted space-y-2">
          <p className="text-4xl">📭</p>
          <p className="font-medium">{t("governance.list.empty")}</p>
          {(typeFilter || search) && (
            <button
              className="text-sm text-accent-light underline"
              onClick={() => { setTypeFilter(null); setSearch("") }}
            >
              {t("governance.list.clearFilters")}
            </button>
          )}
        </div>
      )}

      {/* Governance action list */}
      {!isLoading && !error && visible.length > 0 && (
        <div className="space-y-4">
          {visible.map((action) => (
            <GovernanceActionCard
              key={`${action.txHash}-${action.index}`}
              action={action}
            />
          ))}
        </div>
      )}
    </div>
  )
}
