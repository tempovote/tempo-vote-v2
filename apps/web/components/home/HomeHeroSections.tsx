"use client"

import Link from "next/link"
import { useWallet } from "@/hooks/useWallet"
import { useDRepProfile } from "@/hooks/useDRepProfile"
import { useDRepStats } from "@/hooks/useDRepStats"
import { useCommunity } from "@/hooks/useCommunity"
import { DRepProfileCard } from "@/components/drep/DRepProfileCard"
import { useT } from "@/i18n/useT"

// ─── Delegated DRep Section ───────────────────────────────────────────────────

function DelegatedDRepSection({ drepId, network }: { drepId: string; network: string }) {
  const { profile, isLoading } = useDRepProfile(drepId, network)
  const { stats: drepStats, loading: statsLoading } = useDRepStats(
    profile?.isRegistered ? drepId : null,
    network,
  )
  const { isActive, isLoading: communityLoading } = useCommunity(drepId, network)

  if (isLoading) {
    return (
      <div className="card-static space-y-4 animate-pulse">
        <div className="flex gap-4">
          <div className="w-16 h-16 rounded-full bg-bg-elevated shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-5 bg-bg-elevated rounded w-48" />
            <div className="h-3 bg-bg-elevated rounded w-32" />
          </div>
        </div>
        <div className="h-24 bg-bg-elevated rounded-xl" />
      </div>
    )
  }

  if (!profile) return null

  return (
    <DRepProfileCard
      profile={profile}
      drepStats={drepStats}
      statsLoading={statsLoading}
      network={network}
      isActive={isActive}
      communityLoading={communityLoading}
    />
  )
}

// ─── Hero Sections ────────────────────────────────────────────────────────────

export default function HomeHeroSections() {
  const t = useT()
  const { isConnected, isDrepRegistered, delegatedDrep, selectedNetwork } = useWallet()

  // Hide both cards when confirmed DRep — they're irrelevant
  if (isConnected && isDrepRegistered === true) return null

  return (
    <>
      {/* ── Section 1: Become a DRep ─────────────────────────── */}
      <section className="card-accent text-center space-y-4 animate-slide-up">
        <h2 className="text-xl font-bold">{t("home.becomeDrep.title")}</h2>
        <p className="text-text-secondary text-sm max-w-lg mx-auto">
          {t("home.becomeDrep.desc")}
        </p>
        <Link href="/dreps/register" className="btn-primary gap-2 mx-auto">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t("home.becomeDrep.cta")}
        </Link>
      </section>

      {/* ── Section 2: Delegated DRep profile card or generic CTA ── */}
      {isConnected && delegatedDrep ? (
        <DelegatedDRepSection drepId={delegatedDrep.id} network={selectedNetwork} />
      ) : (
        <section className="card-static text-center space-y-3 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="text-lg font-bold">{t("home.delegate.title")}</h2>
          <p className="text-sm text-text-secondary max-w-lg mx-auto">
            {t("home.delegate.desc")}
          </p>
          <Link href="/dreps" className="btn-primary mx-auto justify-center">
            {t("home.delegate.cta")}
          </Link>
        </section>
      )}
    </>
  )
}
