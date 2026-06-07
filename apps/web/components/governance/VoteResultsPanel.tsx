import type { GovernanceAction, VoteCounts } from "@tempo/types"
import { computeDRepVotePercent, computeVotePercent, lovelaceToAda, VOTE_THRESHOLDS } from "@/lib/governance"

interface Props {
  action: GovernanceAction
}

export default function VoteResultsPanel({ action }: Props) {
  const thresholds = VOTE_THRESHOLDS[action.actionType] ?? {}

  const drepPct = computeDRepVotePercent(action.drepVotes, action.actionType)
  const spoPct  = computeVotePercent(action.spoVotes)
  const ccPct   = computeVotePercent(action.ccVotes)

  const spoHasVotes = action.spoVotes.yes + action.spoVotes.no + action.spoVotes.abstain > 0
  const ccHasVotes  = action.ccVotes.yes  + action.ccVotes.no  + action.ccVotes.abstain  > 0

  const showSpo = thresholds.spo !== undefined || spoHasVotes
  const showCc  = thresholds.cc  !== undefined || ccHasVotes

  // Effective yes/no after applying GovTool formula (auto-noConfidence routing)
  const isNoConfidence = action.actionType === "noConfidence"
  const drepYesPower = isNoConfidence
    ? action.drepVotes.yesVotingPower + action.drepVotes.autoNoConfidenceStake
    : action.drepVotes.yesVotingPower
  const drepNoPower = isNoConfidence
    ? action.drepVotes.noVotingPower
    : action.drepVotes.noVotingPower + action.drepVotes.autoNoConfidenceStake

  return (
    <div className="space-y-3">
      <DRepVoteRow
        votes={action.drepVotes}
        yesPercent={drepPct.yesPercent}
        noPercent={drepPct.noPercent}
        notVotedPercent={drepPct.notVotedPercent}
        yesPower={drepYesPower}
        noPower={drepNoPower}
        threshold={thresholds.drep !== undefined ? Math.round(thresholds.drep * 100) : null}
      />

      {showSpo && (
        <SimpleVoteRow
          label="SPO"
          votes={action.spoVotes}
          yesPercent={spoPct.yesPercent}
          noPercent={spoPct.noPercent}
          notVotedPercent={spoPct.notVotedPercent}
          threshold={thresholds.spo !== undefined ? Math.round(thresholds.spo * 100) : null}
        />
      )}

      {showCc && (
        <SimpleVoteRow
          label="CC"
          votes={action.ccVotes}
          yesPercent={ccPct.yesPercent}
          noPercent={ccPct.noPercent}
          notVotedPercent={ccPct.notVotedPercent}
          threshold={
            action.ccVotes.quorum > 0
              ? Math.round(action.ccVotes.quorum * 100)
              : thresholds.cc !== undefined ? Math.round(thresholds.cc * 100) : null
          }
        />
      )}
    </div>
  )
}

// ── DRep row — stake-weighted with Not Voted segment ────────────────────────

interface DRepVoteRowProps {
  votes: GovernanceAction["drepVotes"]
  yesPercent: number
  noPercent: number
  notVotedPercent: number
  yesPower: number
  noPower: number
  threshold: number | null
}

function DRepVoteRow({ votes, yesPercent, noPercent, notVotedPercent, yesPower, noPower, threshold }: DRepVoteRowProps) {
  const hasPower = votes.totalActiveDRepStake > 0
  const showLabelInBar = yesPercent > 12

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-secondary w-10 shrink-0">DRep</span>
        <div className="flex-1 relative">
          <div className="vote-bar">
            {/* YES segment */}
            <div className="vote-bar-yes" style={{ width: `${yesPercent}%` }}>
              {showLabelInBar && (
                <span className="text-white text-[10px] font-bold px-1.5 leading-none drop-shadow-sm select-none">
                  {yesPercent}%
                </span>
              )}
            </div>
            {/* NO segment */}
            <div className="vote-bar-no" style={{ width: `${noPercent}%` }} />
            {/* Not Voted segment (grey) */}
            {notVotedPercent > 0 && (
              <div
                className="opacity-20"
                style={{
                  width: `${notVotedPercent}%`,
                  backgroundColor: "var(--color-text-muted)",
                  transition: "width 0.6s ease",
                }}
              />
            )}
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

      {/* Stake-weighted details */}
      <div className="pl-[52px] text-xs text-text-muted space-y-0.5">
        {hasPower ? (
          <>
            <div>
              <span className="text-success font-medium">{yesPercent}% Yes</span>
              <span className="text-text-muted"> · {lovelaceToAda(yesPower)} ₳</span>
              <span className="mx-1.5 text-text-muted/50">·</span>
              <span className="text-danger font-medium">{noPercent}% No</span>
              <span className="text-text-muted"> · {lovelaceToAda(noPower)} ₳</span>
              {notVotedPercent > 0 && (
                <>
                  <span className="mx-1.5 text-text-muted/50">·</span>
                  <span>{notVotedPercent}% chưa bỏ phiếu</span>
                </>
              )}
            </div>
            {(votes.abstainVotingPower > 0 || votes.autoAbstainStake > 0) && (
              <div className="text-text-muted/70">
                Abstain: {lovelaceToAda(votes.abstainVotingPower + votes.autoAbstainStake)} ₳
                {votes.autoAbstainStake > 0 && ` (bao gồm ${lovelaceToAda(votes.autoAbstainStake)} ₳ auto-abstain)`}
              </div>
            )}
          </>
        ) : (
          <div>
            <span className="text-success">{votes.yes} Yes</span>
            {" · "}
            <span className="text-danger">{votes.no} No</span>
            {votes.abstain > 0 && ` · ${votes.abstain} Abstain`}
          </div>
        )}
      </div>
    </div>
  )
}

// ── SPO / CC rows — count-based (no stake weighting) ────────────────────────

interface SimpleVoteRowProps {
  label: string
  votes: VoteCounts
  yesPercent: number
  noPercent: number
  notVotedPercent: number
  threshold: number | null
}

export function VoteRow({ label, votes, yesPercent, noPercent, notVotedPercent, threshold }: SimpleVoteRowProps) {
  return <SimpleVoteRow label={label} votes={votes} yesPercent={yesPercent} noPercent={noPercent} notVotedPercent={notVotedPercent} threshold={threshold} />
}

function SimpleVoteRow({ label, votes, yesPercent, noPercent, notVotedPercent, threshold }: SimpleVoteRowProps) {
  const hasActiveMembers = votes.activeMembers > 0
  const showLabelInBar = yesPercent > 20

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-secondary w-10 shrink-0">{label}</span>
        <div className="flex-1 relative">
          <div className="vote-bar">
            <div className="vote-bar-yes" style={{ width: `${yesPercent}%` }}>
              {showLabelInBar && (
                <span className="text-white text-[10px] font-bold px-1.5 leading-none drop-shadow-sm select-none">
                  {yesPercent}%
                </span>
              )}
            </div>
            <div className="vote-bar-no" style={{ width: `${noPercent}%` }} />
            {/* Not voted segment — only shown for CC where N_Active is known */}
            {hasActiveMembers && notVotedPercent > 0 && (
              <div
                className="opacity-20"
                style={{
                  width: `${notVotedPercent}%`,
                  backgroundColor: "var(--color-text-muted)",
                  transition: "width 0.6s ease",
                }}
              />
            )}
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
        {hasActiveMembers ? (
          <>
            <span className="text-success font-medium">{votes.yes}/{votes.activeMembers} Yes ({yesPercent}%)</span>
            {" · "}
            <span className="text-danger">{votes.no} No</span>
            {votes.abstain > 0 && ` · ${votes.abstain} Abstain`}
            {notVotedPercent > 0 && (
              <span className="text-text-muted/70"> · {votes.activeMembers - votes.yes - votes.no - votes.abstain} chưa bỏ phiếu</span>
            )}
          </>
        ) : (
          <>
            <span className="text-success">{votes.yes} Yes ({yesPercent}%)</span>
            {" · "}
            <span className="text-danger">{votes.no} No</span>
            {votes.abstain > 0 && ` · ${votes.abstain} Abstain`}
            {votes.yes + votes.no + votes.abstain > 0 && ` · ${votes.yes + votes.no + votes.abstain} tổng`}
          </>
        )}
      </div>
    </div>
  )
}
