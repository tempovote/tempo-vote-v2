import type { GovernanceAction, VoteCounts } from "@tempo/types"
import { computeVotePercent, VOTE_THRESHOLDS } from "@/lib/governance"

interface Props {
  action: GovernanceAction
}

export default function VoteResultsPanel({ action }: Props) {
  const thresholds = VOTE_THRESHOLDS[action.actionType] ?? {}

  const drepPct = computeVotePercent(action.drepVotes)
  const spoPct  = computeVotePercent(action.spoVotes)
  const ccPct   = computeVotePercent(action.ccVotes)

  const spoHasVotes = action.spoVotes.yes + action.spoVotes.no + action.spoVotes.abstain > 0
  const ccHasVotes  = action.ccVotes.yes  + action.ccVotes.no  + action.ccVotes.abstain  > 0

  const showSpo = thresholds.spo !== undefined || spoHasVotes
  const showCc  = thresholds.cc  !== undefined || ccHasVotes

  return (
    <div className="space-y-3">
      <VoteRow
        label="DRep"
        votes={action.drepVotes}
        yesPercent={drepPct.yesPercent}
        noPercent={drepPct.noPercent}
        threshold={thresholds.drep !== undefined ? Math.round(thresholds.drep * 100) : null}
      />

      {showSpo && (
        <VoteRow
          label="SPO"
          votes={action.spoVotes}
          yesPercent={spoPct.yesPercent}
          noPercent={spoPct.noPercent}
          threshold={thresholds.spo !== undefined ? Math.round(thresholds.spo * 100) : null}
        />
      )}

      {showCc && (
        <VoteRow
          label="CC"
          votes={action.ccVotes}
          yesPercent={ccPct.yesPercent}
          noPercent={ccPct.noPercent}
          threshold={thresholds.cc !== undefined ? Math.round(thresholds.cc * 100) : null}
        />
      )}
    </div>
  )
}

interface VoteRowProps {
  label: string
  votes: VoteCounts
  yesPercent: number
  noPercent: number
  threshold: number | null
}

export function VoteRow({ label, votes, yesPercent, noPercent, threshold }: VoteRowProps) {
  const total = votes.yes + votes.no + votes.abstain
  const showLabelInBar = yesPercent > 20
  const tooltipText = !showLabelInBar
    ? `Yes: ${yesPercent}% · No: ${noPercent}% · Abstain: ${100 - yesPercent - noPercent}%`
    : undefined

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-secondary w-10 shrink-0">{label}</span>
        <div className="flex-1 relative">
          <div className="vote-bar" title={tooltipText}>
            <div className="vote-bar-yes" style={{ width: `${yesPercent}%` }}>
              {showLabelInBar && (
                <span className="text-white text-[10px] font-bold px-1.5 leading-none drop-shadow-sm select-none">
                  {yesPercent}%
                </span>
              )}
            </div>
            <div className="vote-bar-no" style={{ width: `${noPercent}%` }} />
          </div>
          {threshold !== null && (
            <div
              className="absolute z-10 w-[2px] rounded-full"
              style={{
                left:       `${threshold}%`,
                top:        "-2px",
                bottom:     "-2px",
                background: "white",
                boxShadow:  "0 0 0 1px rgba(0,0,0,0.3)",
              }}
            />
          )}
        </div>
        {threshold !== null ? (
          <span className="text-xs text-text-secondary font-semibold w-9 text-right shrink-0">
            {threshold}%
          </span>
        ) : (
          <span className="w-9 shrink-0" />
        )}
      </div>
      <div className="pl-[52px] text-xs text-text-muted">
        <span className="text-success">{votes.yes} Yes ({yesPercent}%)</span>
        {" · "}
        <span className="text-danger">{votes.no} No</span>
        {" · "}
        {votes.abstain} Abstain
        {total > 0 && ` · ${total} tổng`}
      </div>
    </div>
  )
}
