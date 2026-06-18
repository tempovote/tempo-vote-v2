"use client"

import Link from "next/link"
import { useAllianceStances, type AllianceStanceItem } from "@/hooks/useAllianceProposals"
import { useT } from "@/i18n/useT"

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/"
function resolveLogoSrc(url: string): string {
  return url.startsWith("ipfs://") ? IPFS_GATEWAY + url.slice(7) : url
}

function StanceChip({ stance }: { stance: string }) {
  const colors = {
    YES:     "bg-vote-bar-yes/20 text-vote-bar-yes border-vote-bar-yes/40",
    NO:      "bg-vote-bar-no/20 text-vote-bar-no border-vote-bar-no/40",
    ABSTAIN: "bg-bg-card-hover text-text-muted border-border-subtle",
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${colors[stance as keyof typeof colors] ?? colors.ABSTAIN}`}>
      {stance}
    </span>
  )
}

function AllianceStanceRow({ item }: { item: AllianceStanceItem }) {
  const t = useT()
  const isActive = item.status === "voting"
  return (
    <Link
      href={`/alliances/${item.allianceId}/proposals/${item.proposalId}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-bg-card-hover transition-colors"
    >
      {/* Logo */}
      {item.allianceLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolveLogoSrc(item.allianceLogoUrl)}
          alt={item.allianceName}
          className="w-8 h-8 rounded-lg object-cover border border-border-subtle shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-lg bg-bg-card-hover shrink-0 flex items-center justify-center text-sm font-bold text-text-muted">
          {item.allianceName.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{item.allianceName}</p>
        <p className="text-xs text-text-muted">
          {t("alliance.stances.members", {
            n: String(item.totalVoted),
            total: String(item.memberCount),
          })}
          {isActive && (
            <span className="ml-2 text-accent-light">• voting</span>
          )}
        </p>
      </div>

      {/* Stance */}
      <StanceChip stance={item.stance} />
    </Link>
  )
}

export function AllianceStancesPanel({ txHash, index }: { txHash: string; index: number }) {
  const t = useT()
  const { stances, isLoading } = useAllianceStances(txHash, index)

  if (isLoading) {
    return (
      <div className="card-static animate-fade-in">
        <div className="px-4 py-3 border-b border-border-subtle">
          <h2 className="font-semibold text-base">{t("alliance.stances.title")}</h2>
        </div>
        <div className="flex flex-col gap-1 p-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-bg-card-hover animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!stances || stances.length === 0) {
    return null
  }

  return (
    <div className="card-static animate-fade-in">
      <div className="px-4 py-3 border-b border-border-subtle">
        <h2 className="font-semibold text-base">{t("alliance.stances.title")}</h2>
        <p className="text-xs text-text-muted mt-0.5">{t("alliance.stances.subtitle")}</p>
      </div>
      <div className="divide-y divide-border-subtle">
        {stances.map((item) => (
          <AllianceStanceRow key={item.proposalId} item={item} />
        ))}
      </div>
    </div>
  )
}
