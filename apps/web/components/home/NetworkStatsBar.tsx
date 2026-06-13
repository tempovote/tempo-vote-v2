"use client"

import { useWalletStore } from "@/store/wallet"
import { useNetworkStats } from "@/hooks/useNetworkStats"

function formatAda(lovelace: number): string {
  if (lovelace >= 1_000_000_000) return `${(lovelace / 1_000_000_000).toFixed(1)}B`
  if (lovelace >= 1_000_000)     return `${(lovelace / 1_000_000).toFixed(0)}M`
  return lovelace.toLocaleString()
}

interface StatItemProps {
  label: string
  value: string | number | undefined
  loading: boolean
  suffix?: string
}

function StatItem({ label, value, loading, suffix }: StatItemProps) {
  return (
    <div className="flex-1 text-center px-3 py-3 min-w-0">
      {loading ? (
        <div className="h-6 w-16 bg-bg-elevated rounded animate-pulse mx-auto mb-1" />
      ) : (
        <p className="text-lg font-bold text-text-primary leading-tight">
          {value ?? "—"}
          {suffix && value !== undefined && (
            <span className="text-sm font-normal text-text-muted ml-1">{suffix}</span>
          )}
        </p>
      )}
      <p className="text-xs text-text-muted mt-0.5">{label}</p>
    </div>
  )
}

export default function NetworkStatsBar() {
  const network = useWalletStore((s) => s.selectedNetwork)
  const { stats, loading } = useNetworkStats(network)

  return (
    <div className="card-static !p-0 overflow-hidden">
      <div className="flex divide-x divide-border-subtle">
        <StatItem
          label="Epoch hiện tại"
          value={stats.currentEpoch}
          loading={loading}
        />
        <StatItem
          label="DReps đang active"
          value={stats.activeDRepCount?.toLocaleString()}
          loading={loading}
        />
        <StatItem
          label="Tổng ADA được delegate"
          value={stats.totalDelegatedAda !== undefined ? formatAda(stats.totalDelegatedAda) : undefined}
          suffix="₳"
          loading={loading}
        />
        <StatItem
          label="GA đang active"
          value={stats.activeGACount}
          loading={loading}
        />
      </div>
    </div>
  )
}
