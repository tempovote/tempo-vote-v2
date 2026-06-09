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

export const VoteEntrySchema = z.object({
  role: z.enum(["drep", "cc", "spo"]),
  id: z.string(),
  vote: z.enum(["yes", "no", "abstain"]),
  votingPower: z.number().default(0),
  anchorUrl: z.string().nullable().optional(),
  memberName: z.string().nullable().optional(),  // CC member display name (resolved via hot→cold credential mapping)
})
export type VoteEntry = z.infer<typeof VoteEntrySchema>

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
  votes: z.array(VoteEntrySchema).default([]),  // individual votes for vote history display
  details: z.unknown().nullable().optional(),    // type-specific action body from extractActionDetails()
  status: z.string().default("active"),          // computed by backend: active | ratified | expired | enacted | dropped
})
export type GovernanceAction = z.infer<typeof GovernanceActionSchema>

// ── Typed action details (narrowed from details: unknown) ────────────────────

export type HardForkDetails = {
  versionMajor?: number
  versionMinor?: number
  prevActionTxHash?: string
  prevActionIndex?: number
}

export type NewConstitutionDetails = {
  constitutionUrl?: string
  constitutionHash?: string
  guardrailsHash?: string
  prevActionTxHash?: string
  prevActionIndex?: number
}

export type TreasuryWithdrawalRow = {
  stakeCredential: string
  lovelace: number
}
export type TreasuryWithdrawalDetails = {
  withdrawals: TreasuryWithdrawalRow[]
  guardrailsHash?: string
  prevActionTxHash?: string
  prevActionIndex?: number
}

export type CommitteeMember = { credential: string; termEpoch?: number }
export type UpdateCommitteeDetails = {
  quorumNumerator?: number
  quorumDenominator?: number
  quorumRate?: number
  addedMembers: CommitteeMember[]
  removedMembers: string[]
  prevActionTxHash?: string
  prevActionIndex?: number
}

export type ProtocolParamChangeDetails = {
  parameters?: Record<string, unknown>
  guardrailsHash?: string
  prevActionTxHash?: string
  prevActionIndex?: number
}

export const GovernanceActionListSchema = z.array(GovernanceActionSchema)

export const ProposalUploadRequestSchema = z.object({
  drepId: z.string(),
  title: z.string().min(1).max(80),
  abstract: z.string().min(1).max(2500),
  motivation: z.string().max(2500).optional(),
  rationale: z.string().max(2500).optional(),
  references: z.array(z.object({
    type: z.string(),
    label: z.string(),
    uri: z.string().url(),
  })).optional().default([]),
})
export type ProposalUploadRequest = z.infer<typeof ProposalUploadRequestSchema>
