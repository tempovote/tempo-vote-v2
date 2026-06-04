import type { GovernanceAction } from "@/lib/mock-data"

interface Props {
  action: GovernanceAction
  compact?: boolean
}

export default function GovernanceActionCard({ action, compact = false }: Props) {
  const yesWidth = action.drep.yesPercent
  const noWidth = action.drep.noPercent
  const ccPercent = (action.cc.approved / action.cc.total) * 100

  return (
    <div className="card-static space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <h3 className={`font-semibold leading-snug ${compact ? "text-sm" : "text-base"}`}>
          {action.title}
        </h3>
        <button className="text-text-muted hover:text-text-primary shrink-0 transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
        <span>
          Expires <span className="text-text-primary font-medium">{action.expires}</span>
        </span>
        <span>Status</span>
        <span
          className={`badge ${
            action.status === "Active"
              ? "badge-active"
              : action.status === "Expired"
              ? "badge-expired"
              : "badge-active"
          }`}
        >
          {action.status}
        </span>
        <span>
          Type <span className="text-text-primary font-medium">{action.type}</span>
        </span>
      </div>

      {/* Voting Results */}
      <div className="bg-bg-secondary rounded-xl p-4 space-y-4 border border-border-subtle">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-sm">Voting Results</h4>
          <span className="text-xs text-text-muted flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12,6 12,12 16,14" />
            </svg>
            {action.drep.threshold}%
          </span>
        </div>

        {/* DRep bar */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary w-12 shrink-0">DRep</span>
            <div className="flex-1">
              <div className="vote-bar">
                <div className="vote-bar-yes" style={{ width: `${yesWidth}%` }} />
                <div className="vote-bar-no" style={{ width: `${noWidth}%` }} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-text-muted pl-15">
            <span>
              {action.drep.yesAda} ({action.drep.yesPercent}%)
            </span>
            {/* Threshold marker */}
            <div className="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-warning">
                <polygon points="5,0 10,10 0,10" fill="currentColor" />
              </svg>
              <span>{action.cc.threshold}%</span>
            </div>
          </div>
        </div>

        {/* CC bar */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-text-secondary w-12 shrink-0">CC</span>
            <div className="flex-1">
              <div className="vote-bar">
                <div
                  className="vote-bar-yes"
                  style={{ width: `${ccPercent}%` }}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-text-muted pl-15">
            <span>
              {action.cc.approved} ({ccPercent.toFixed(0)}%)
            </span>
            <div className="flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 10 10" className="text-warning">
                <polygon points="5,0 10,10 0,10" fill="currentColor" />
              </svg>
              <span>{action.cc.threshold}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Poll button */}
      <button className="btn-outline w-full text-sm py-2.5">
        Poll your community
      </button>
    </div>
  )
}
