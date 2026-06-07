import Link from "next/link"
import GovernancePreview from "@/components/governance/GovernancePreview"
import HomeHeroSections from "@/components/home/HomeHeroSections"
import { mockPolls } from "@/lib/mock-data"

export default function Home() {

  return (
    <div className="page-container space-y-8">
      <HomeHeroSections />

      {/* ── Section 3: Governance Action Preview ────────────── */}
      <section className="space-y-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Governance Action</h2>
          <Link
            href="/governance-actions"
            className="text-sm text-accent-light hover:text-accent transition-colors"
          >
            View more
          </Link>
        </div>
        <GovernancePreview />
      </section>

      {/* ── Section 4: Community Quick Polls ────────────────── */}
      <section className="space-y-5 animate-slide-up" style={{ animationDelay: "0.3s" }}>
        <h2 className="text-lg font-bold">Cardano Community Temp Check</h2>

        <div className="notice notice-success">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-success shrink-0">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <polyline points="8,12 11,15 16,9" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm">
            Participating in quick polls does <strong>NOT</strong> require wallet signing – just
            connect your wallet to record your voting power in the results.
          </span>
        </div>

        {mockPolls.map((poll) => {
          const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0)
          const option1 = poll.options[0]
          const option2 = poll.options[1]
          if (!option1 || !option2) return null
          const percent1 = totalVotes > 0 ? (option1.votes / totalVotes) * 100 : 50

          return (
            <div key={poll.id} className="card-static space-y-5">
              <h3 className="text-center font-semibold leading-snug">
                {poll.question}
              </h3>

              {/* ADA amounts */}
              <div className="flex items-center justify-between text-sm text-text-secondary">
                <span>
                  {option1.label} ({option1.ada} ₳)
                </span>
                <span>
                  {option2.label} ({option2.ada} ₳)
                </span>
              </div>

              {/* Progress bar */}
              <div className="vote-bar h-3 rounded-full">
                <div
                  className="vote-bar-yes rounded-l-full"
                  style={{ width: `${percent1}%` }}
                />
                <div
                  className="vote-bar-no rounded-r-full"
                  style={{ width: `${100 - percent1}%` }}
                />
              </div>

              {/* Vote buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button className="py-3 rounded-xl border-2 border-success/40 text-success font-bold text-sm hover:bg-success/10 transition-colors">
                  {option1.label}
                  <div className="text-xs font-normal text-text-muted mt-0.5">
                    ({option1.votes} votes)
                  </div>
                </button>
                <button className="py-3 rounded-xl border-2 border-danger/40 text-danger font-bold text-sm hover:bg-danger/10 transition-colors">
                  {option2.label}
                  <div className="text-xs font-normal text-text-muted mt-0.5">
                    ({option2.votes} votes)
                  </div>
                </button>
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
