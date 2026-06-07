import { z } from "zod"

export const VoteCountsSchema = z.object({
  yes: z.number().int(),
  no: z.number().int(),
  abstain: z.number().int(),
  /** For CC only: total active CC members. Used as denominator (N_Yes/N_Active). 0 = fall back to votes-cast. */
  activeMembers: z.number().int().default(0),
  /** For CC only: on-chain quorum fraction (e.g. 0.6667 for 2/3). 0 = use static fallback threshold. */
  quorum: z.number().default(0),
})
export type VoteCounts = z.infer<typeof VoteCountsSchema>

/**
 * DRep vote totals with ADA voting power — implements the GovTool ratification formula.
 *
 * Ratification denominator = totalActiveDRepStake (excludes abstain stake).
 * Non-NoConfidence: yesTotal = yesVotingPower, noTotal = noVotingPower + autoNoConfidenceStake
 * NoConfidence:     yesTotal = yesVotingPower + autoNoConfidenceStake, noTotal = noVotingPower
 */
export const DRepVoteStatsSchema = VoteCountsSchema.extend({
  /** Lovelace staked by DReps that voted yes/no/abstain. */
  yesVotingPower: z.number(),
  noVotingPower: z.number(),
  abstainVotingPower: z.number(),
  /** Stake delegated to the always-abstain predefined DRep. NOT in ratification denominator. */
  autoAbstainStake: z.number(),
  /** Stake delegated to the always-no-confidence predefined DRep. IS in denominator. */
  autoNoConfidenceStake: z.number(),
  /** Denominator for ratification: Σ(active DRep stakes) + autoNoConfidenceStake. */
  totalActiveDRepStake: z.number(),
})
export type DRepVoteStats = z.infer<typeof DRepVoteStatsSchema>

export const GovernanceActionSchema = z.object({
  txHash: z.string(),
  index: z.number().int(),
  type: z.string(),           // display label, e.g. "Treasury Withdrawals"
  actionType: z.string(),     // raw Ogmios type, e.g. "treasuryWithdrawals"
  anchorUrl: z.string().nullable(),
  anchorHash: z.string().nullable(),
  expiresEpoch: z.number().int(),
  deposit: z.number(),        // lovelace (Long on backend)
  drepVotes: DRepVoteStatsSchema,
  spoVotes: VoteCountsSchema,
  ccVotes: VoteCountsSchema,
})
export type GovernanceAction = z.infer<typeof GovernanceActionSchema>

export const GovernanceActionListSchema = z.array(GovernanceActionSchema)
