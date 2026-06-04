import GovernanceActionCard from "@/components/governance/GovernanceActionCard"
import { mockGovernanceActions } from "@/lib/mock-data"

export default function GovernanceActionsPage() {
  return (
    <div className="page-container space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-center animate-fade-in">
        Governance Actions
      </h1>

      {/* Search bar */}
      <div className="flex gap-2 animate-fade-in">
        <div className="relative flex-1">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by name or ID"
            className="input pl-10"
          />
        </div>
        <button className="btn-primary px-6">Search</button>
        <button className="btn-outline px-3" title="Filters">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46" />
          </svg>
        </button>
      </div>

      {/* Propose action CTA */}
      <div className="card-accent space-y-3 animate-slide-up">
        <h3 className="text-base font-bold text-accent-light">
          Propose a Governance Action
        </h3>
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-text-secondary">
            Poll your DRep community first to refine your proposal and build support.
            With backing, you&apos;re ready to submit it as a Governance Action.
          </p>
          <button className="btn-primary shrink-0 text-sm">Create Poll</button>
        </div>
      </div>

      {/* Governance action list */}
      <div className="space-y-4">
        {mockGovernanceActions.map((action) => (
          <GovernanceActionCard key={action.id} action={action} />
        ))}
      </div>
    </div>
  )
}
