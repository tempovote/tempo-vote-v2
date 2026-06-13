"use client"

import Link from "next/link"
import HomeHeroSections from "@/components/home/HomeHeroSections"
import { DRepBanner } from "@/components/home/DRepBanner"
import NetworkStatsBar from "@/components/home/NetworkStatsBar"
import GaStatsPreview from "@/components/home/GaStatsPreview"
import DRepLeaderboardPreview from "@/components/home/DRepLeaderboardPreview"
import { useT } from "@/i18n/useT"

export default function Home() {
  const t = useT()
  return (
    <div className="page-container space-y-8">
      <DRepBanner />
      <HomeHeroSections />

      {/* Network Stats */}
      <NetworkStatsBar />

      {/* Governance Actions */}
      <section className="space-y-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("home.gaHeading")}</h2>
          <Link
            href="/governance-actions"
            className="text-sm text-accent-light hover:text-accent transition-colors"
          >
            {t("common.viewAll")}
          </Link>
        </div>
        <GaStatsPreview />
      </section>

      {/* DRep Leaderboard */}
      <section className="space-y-4 animate-slide-up" style={{ animationDelay: "0.3s" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{t("home.topDreps")}</h2>
          <Link
            href="/dreps"
            className="text-sm text-accent-light hover:text-accent transition-colors"
          >
            {t("common.viewAll")}
          </Link>
        </div>
        <DRepLeaderboardPreview />
      </section>
    </div>
  )
}
