import Link from "next/link"
import HomeHeroSections from "@/components/home/HomeHeroSections"
import { DRepBanner } from "@/components/home/DRepBanner"
import NetworkStatsBar from "@/components/home/NetworkStatsBar"
import GaStatsPreview from "@/components/home/GaStatsPreview"
import DRepLeaderboardPreview from "@/components/home/DRepLeaderboardPreview"

export default function Home() {
  return (
    <div className="page-container space-y-8">
      <DRepBanner />
      <HomeHeroSections />

      {/* Network Stats */}
      <NetworkStatsBar />

      {/* Governance Actions */}
      <section className="space-y-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Governance Actions</h2>
          <Link
            href="/governance-actions"
            className="text-sm text-accent-light hover:text-accent transition-colors"
          >
            Xem tất cả →
          </Link>
        </div>
        <GaStatsPreview />
      </section>

      {/* DRep Leaderboard */}
      <section className="space-y-4 animate-slide-up" style={{ animationDelay: "0.3s" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Top DReps</h2>
          <Link
            href="/dreps"
            className="text-sm text-accent-light hover:text-accent transition-colors"
          >
            Xem tất cả →
          </Link>
        </div>
        <DRepLeaderboardPreview />
      </section>
    </div>
  )
}
