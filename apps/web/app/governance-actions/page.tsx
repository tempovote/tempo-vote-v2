"use client"

import { useState } from "react"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useWallet } from "@/hooks/useWallet"
import GovernanceActionCard from "@/components/governance/GovernanceActionCard"
import { useGovernanceActions } from "@/hooks/useGovernanceActions"
import { govActionIdToBech32 } from "@/lib/governance"
import { useAnchorTitlesMap } from "@/hooks/useAnchorTitle"

const STATUS_TABS = [
  { label: "Active",          value: "active"   },
  { label: "Ratified",        value: "ratified" },
  { label: "Enacted",         value: "enacted"  },
  { label: "Expired",         value: "expired"  },
]

const TYPE_CHIPS = [
  { label: "Treasury",          value: "treasuryWithdrawals"      },
  { label: "Protocol Params",   value: "protocolParametersUpdate" },
  { label: "Hard Fork",         value: "hardForkInitiation"       },
  { label: "Info",              value: "infoAction"               },
  { label: "No Confidence",     value: "noConfidence"             },
  { label: "Update Committee",  value: "updateCommittee"          },
  { label: "New Constitution",  value: "newConstitution"          },
]

export default function GovernanceActionsPage() {
  const network = useWalletStore((s) => s.selectedNetwork)
  const { drepKey } = useWallet()

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

      {/* Filters */}
      <div className="space-y-2.5 animate-fade-in">
        {/* Status tabs — badge chip style */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted whitespace-nowrap">Trạng thái</span>
          <div className="flex gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`badge badge-${tab.value} transition-opacity ${
                  statusFilter === tab.value ? "opacity-100" : "opacity-40 hover:opacity-70"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Type chips — scrollable, single-select toggle */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted whitespace-nowrap">Loại GA</span>
          <div
            className="flex gap-2 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {TYPE_CHIPS.map((chip) => (
              <button
                key={chip.value}
                onClick={() => setTypeFilter((f) => (f === chip.value ? null : chip.value))}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border whitespace-nowrap shrink-0 ${
                  typeFilter === chip.value
                    ? "bg-accent text-white border-accent"
                    : "bg-bg-card text-text-secondary border-border-subtle hover:text-text-primary hover:border-border-default"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
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
          <Link
            href={
              drepKey?.dRepIDCip105
                ? `/dreps/${drepKey.dRepIDCip105}/community?create=true${network !== "mainnet" ? `&network=${network}` : ""}`
                : "/dreps"
            }
            className="btn-primary shrink-0 text-sm inline-flex items-center gap-1.5"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Internal Poll
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
          <p className="font-medium">Không thể tải danh sách governance actions</p>
          <p className="text-xs text-text-muted">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && visible.length === 0 && (
        <div className="text-center py-16 text-text-muted space-y-2">
          <p className="text-4xl">📭</p>
          <p className="font-medium">Không có governance actions phù hợp</p>
          {(typeFilter || search) && (
            <button
              className="text-sm text-accent-light underline"
              onClick={() => { setTypeFilter(null); setSearch("") }}
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
