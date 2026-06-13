"use client"

import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useGovernanceActions } from "@/hooks/useGovernanceActions"
import GovernanceActionCard from "@/components/governance/GovernanceActionCard"

const STATUS_CHIPS = [
  { value: "active",   cls: "badge-active"   },
  { value: "ratified", cls: "badge-ratified" },
  { value: "enacted",  cls: "badge-enacted"  },
  { value: "expired",  cls: "badge-expired"  },
] as const

const STATUS_LABEL: Record<string, string> = {
  active:   "Active",
  ratified: "Ratified",
  enacted:  "Enacted",
  expired:  "Expired",
}

export default function GaStatsPreview() {
  const network = useWalletStore((s) => s.selectedNetwork)
  const { actions, isLoading } = useGovernanceActions(network)

  const counts: Record<string, number> = {
    active:   0,
    ratified: 0,
    enacted:  0,
    expired:  0,
  }
  for (const a of actions) {
    if (a.status in counts) counts[a.status] = (counts[a.status] ?? 0) + 1
  }

  const activeGAs = actions.filter((a) => a.status === "active").slice(0, 3)

  return (
    <div className="space-y-4">
      {/* Stat chips */}
      <div className="flex flex-wrap gap-2">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-6 w-20 bg-bg-card rounded animate-pulse" />
            ))
          : STATUS_CHIPS.map(({ value, cls }) => (
              <Link
                key={value}
                href="/governance-actions"
                className={`badge ${cls} gap-1.5`}
              >
                <span className="font-bold">{counts[value]}</span>
                <span>{STATUS_LABEL[value]}</span>
              </Link>
            ))}
      </div>

      {/* 3 active GA cards */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card-static animate-pulse h-48 rounded-xl bg-bg-card" />
          ))}
        </div>
      ) : activeGAs.length > 0 ? (
        <div className="space-y-4">
          {activeGAs.map((action) => (
            <GovernanceActionCard
              key={`${action.txHash}-${action.index}`}
              action={action}
              compact
            />
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-text-muted py-6">Không có GA đang active</p>
      )}
    </div>
  )
}
