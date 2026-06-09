"use client"

import { useState } from "react"
import { useWalletStore } from "@/store/wallet"
import GovernanceActionCard from "@/components/governance/GovernanceActionCard"
import { useGovernanceActions } from "@/hooks/useGovernanceActions"
import { govActionIdToBech32 } from "@/lib/governance"
import { useAnchorTitlesMap } from "@/hooks/useAnchorTitle"

const FILTER_CHIPS = [
  { label: "Tất cả",           value: "",             kind: "all"    },
  { label: "Expired",          value: "expired",      kind: "status" },
  { label: "Treasury",         value: "treasuryWithdrawals",        kind: "type" },
  { label: "Protocol Params",  value: "protocolParametersUpdate",   kind: "type" },
  { label: "Hard Fork",        value: "hardForkInitiation",         kind: "type" },
  { label: "Info",             value: "infoAction",                 kind: "type" },
  { label: "No Confidence",    value: "noConfidence",               kind: "type" },
  { label: "Update Committee", value: "updateCommittee",            kind: "type" },
  { label: "New Constitution", value: "newConstitution",            kind: "type" },
]

// Active/ratified proposals sort before expired; within each group sort by expiry DESC.
const STATUS_SORT_PRIORITY: Record<string, number> = { active: 0, ratified: 0 }
const getStatusPriority = (s: string) => STATUS_SORT_PRIORITY[s] ?? 1

export default function GovernanceActionsPage() {
  const network = useWalletStore((s) => s.selectedNetwork)

  const [activeFilter, setActiveFilter] = useState("")
  const [search, setSearch] = useState("")

  const activeChipKind = FILTER_CHIPS.find((c) => c.value === activeFilter)?.kind ?? "all"

  // Status filters (e.g. "expired") are applied client-side after fetching all proposals.
  // Type filters are passed to the API to reduce payload size.
  const typeForApi = activeChipKind === "type" ? activeFilter : undefined

  const { actions, isLoading, error } = useGovernanceActions(network, typeForApi)

  // Client-side status filter
  const statusFiltered =
    activeChipKind === "status"
      ? actions.filter((a) => a.status === activeFilter)
      : actions

  // Batch-resolve anchor titles so we can search by proposal name (from IPFS metadata).
  // Re-renders as titles load in, so filter results stay live while fetches complete.
  const titlesMap = useAnchorTitlesMap(statusFiltered.map((a) => a.anchorUrl))

  const q = search.trim().toLowerCase()
  const visible = [...(q
    ? statusFiltered.filter((a) => {
        const title = a.anchorUrl ? (titlesMap.get(a.anchorUrl) ?? null) : null
        return (
          a.txHash.toLowerCase().includes(q) ||
          a.type.toLowerCase().includes(q) ||
          a.actionType.toLowerCase().includes(q) ||
          govActionIdToBech32(a.txHash, a.index).toLowerCase().includes(q) ||
          (title?.toLowerCase().includes(q) ?? false)
        )
      })
    : statusFiltered
  )].sort((a, b) => {
    const pa = getStatusPriority(a.status)
    const pb = getStatusPriority(b.status)
    if (pa !== pb) return pa - pb
    return b.expiresEpoch - a.expiresEpoch
  })

  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-center animate-fade-in">
        Governance Actions
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
            placeholder="Tìm theo tên, txHash hoặc gov_action1…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 w-full"
          />
        </div>
      </div>

      {/* Filter chips — single scrollable row */}
      <div
        className="flex gap-2 overflow-x-auto animate-fade-in"
        style={{ scrollbarWidth: "none" }}
      >
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => setActiveFilter(chip.value)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border whitespace-nowrap shrink-0 ${
              activeFilter === chip.value
                ? "bg-accent text-white border-accent"
                : "bg-bg-card text-text-secondary border-border-subtle hover:text-text-primary hover:border-border-default"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Propose action CTA */}
      <div className="card-accent space-y-3 animate-slide-up">
        <h3 className="text-base font-bold text-accent-light">
          Đề xuất Governance Action
        </h3>
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-text-secondary">
            Tạo poll trong cộng đồng DRep trước để lấy ý kiến và xây dựng sự ủng hộ.
            Khi đã có đủ sự đồng thuận, bạn có thể gửi lên chain như một Governance Action.
          </p>
          <button className="btn-primary shrink-0 text-sm">Tạo Poll</button>
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
          <p className="font-medium">Không thể tải danh sách governance actions</p>
          <p className="text-xs text-text-muted">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && visible.length === 0 && (
        <div className="text-center py-16 text-text-muted space-y-2">
          <p className="text-4xl">📭</p>
          <p className="font-medium">Không có governance actions phù hợp</p>
          {(activeFilter || search) && (
            <button
              className="text-sm text-accent-light underline"
              onClick={() => { setActiveFilter(""); setSearch("") }}
            >
              Xoá bộ lọc
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
