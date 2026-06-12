import { z } from "zod"

export const DRepProfileSchema = z.object({
  isRegistered: z.boolean(),
  id: z.string(),
  name: z.string().nullable(),
  anchorUrl: z.string().nullable(),
  votingPower: z.number().nullable(), // lovelace
})
export type DRepProfile = z.infer<typeof DRepProfileSchema>

export const DRepVoteSchema = z.object({
  txHash: z.string(),
  index: z.number().int(),
  type: z.string(),       // display label, e.g. "Treasury Withdrawals"
  actionType: z.string(), // raw Ogmios type
  anchorUrl: z.string().nullable(),
  vote: z.enum(["yes", "no", "abstain"]),
  expiresEpoch: z.number().int().nullable(),
  title: z.string().nullable().optional(),  // GA title from idx_governance_proposals
})
export type DRepVote = z.infer<typeof DRepVoteSchema>

export const DRepVotingHistorySchema = z.object({
  votes: z.array(DRepVoteSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
})
export type DRepVotingHistory = z.infer<typeof DRepVotingHistorySchema>

export const DRepStatsSchema = z.object({
  activeVotingPower: z.number(),    // lovelace — epoch snapshot (Ogmios)
  liveVotingPower:   z.number(),    // lovelace — real-time sum (Koios)
  delegatorCount:    z.number().int(),
  influencePower:    z.number(),    // percent 0-100
  votedCount:        z.number().int(),
  totalGaCount:      z.number().int(),
  votedPercent:      z.number(),    // 0-100
  notVotedPercent:   z.number(),    // 0-100
})
export type DRepStats = z.infer<typeof DRepStatsSchema>
