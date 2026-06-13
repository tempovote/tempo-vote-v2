"use client"

import Link from "next/link"
import Image from "next/image"
import { useWalletStore } from "@/store/wallet"
import { useDRepLeaderboard } from "@/hooks/useDRepLeaderboard"
import { resolveAnchorUrl } from "@/lib/governance"

function formatAda(lovelace: number): string {
  const ada = lovelace / 1_000_000
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(1)}M`
  if (ada >= 1_000)     return `${(ada / 1_000).toFixed(0)}K`
  return ada.toFixed(0)
}

const RANK_COLOR = ["text-[#FFD700]", "text-[#C0C0C0]", "text-[#CD7F32]"]

export default function DRepLeaderboardPreview() {
  const network = useWalletStore((s) => s.selectedNetwork)
  const { entries, loading } = useDRepLeaderboard(network, 5, "votingPower")
  const networkParam = network !== "mainnet" ? `?network=${network}` : ""

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 bg-bg-card rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return <p className="text-center text-sm text-text-muted py-6">Không có dữ liệu</p>
  }

  return (
    <div className="space-y-2">
      {entries.map((entry, i) => {
        const avatarUrl = entry.imageUrl ? resolveAnchorUrl(entry.imageUrl) : null
        const name = entry.name ?? `${entry.id.slice(0, 10)}…`

        return (
          <Link
            key={entry.id}
            href={`/dreps/${encodeURIComponent(entry.id)}${networkParam}`}
            className="flex items-center gap-3 card-static !py-3 !px-4 hover:border-border-default transition-colors"
          >
            {/* Rank */}
            <span className={`w-5 text-center text-sm font-bold shrink-0 ${RANK_COLOR[i] ?? "text-text-muted"}`}>
              {i + 1}
            </span>

            {/* Avatar */}
            <div className="w-9 h-9 rounded-full overflow-hidden bg-bg-elevated border border-border-subtle flex items-center justify-center shrink-0">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={name}
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-sm font-bold text-text-muted">
                  {name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>

            {/* Name + delegators */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{name}</p>
              <p className="text-xs text-text-muted mt-0.5">
                {entry.delegatorCount.toLocaleString()} delegators
              </p>
            </div>

            {/* Voting power */}
            <div className="text-right shrink-0">
              <p className="text-sm font-bold">{formatAda(entry.activeVotingPower)} ₳</p>
              <p className="text-xs text-text-muted">Voting Power</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
