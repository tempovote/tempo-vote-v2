import Link from "next/link"
import type { DRep } from "@/lib/mock-data"

interface Props {
  title: string
  dreps: DRep[]
}

export default function DRepList({ title, dreps }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-bold">{title}</h3>
      <div className="space-y-3">
        {dreps.map((drep) => {
          const isPositive = drep.votingPowerChange.startsWith("+")
          return (
            <div
              key={drep.id + title}
              className="card flex items-center gap-4 !py-3.5 !px-4"
            >
              {/* Avatar */}
              <div
                className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: drep.avatarColor }}
              >
                {drep.name.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dreps/${encodeURIComponent(drep.id)}`}
                    className="font-semibold text-sm truncate hover:text-accent-light transition-colors"
                  >
                    {drep.name}
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-text-muted">
                  <span>
                    Active Voting Power:{" "}
                    <span className="text-text-primary font-medium">{drep.activeVotingPower}</span>
                  </span>
                  <span className={isPositive ? "text-success" : "text-danger"}>
                    {drep.votingPowerChange}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5 text-xs text-text-muted">
                  <span>
                    Delegators:{" "}
                    <span className="text-text-primary font-medium">{drep.delegators.toLocaleString()}</span>
                  </span>
                  <span>
                    Influence power ⓘ:{" "}
                    <span className="text-text-primary font-medium">{drep.influencePower}</span>
                  </span>
                </div>
              </div>

              {/* Vote buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  className="w-8 h-8 rounded-lg border border-success/40 text-success hover:bg-success/10 flex items-center justify-center transition-colors"
                  title="Vote Yes"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20,6 9,17 4,12" />
                  </svg>
                </button>
                <button
                  className="w-8 h-8 rounded-lg border border-danger/40 text-danger hover:bg-danger/10 flex items-center justify-center transition-colors"
                  title="Vote No"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
