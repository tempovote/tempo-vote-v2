import { z } from "zod"

export const VoteCountsSchema = z.object({
  yes: z.number().int(),
  no: z.number().int(),
  abstain: z.number().int(),
})
export type VoteCounts = z.infer<typeof VoteCountsSchema>

export const GovernanceActionSchema = z.object({
  txHash: z.string(),
  index: z.number().int(),
  type: z.string(),           // display label, e.g. "Treasury Withdrawals"
  actionType: z.string(),     // raw Ogmios type, e.g. "treasuryWithdrawals"
  anchorUrl: z.string().nullable(),
  anchorHash: z.string().nullable(),
  expiresEpoch: z.number().int(),
  deposit: z.number(),        // lovelace (Long on backend)
  drepVotes: VoteCountsSchema,
  spoVotes: VoteCountsSchema,
  ccVotes: VoteCountsSchema,
})
export type GovernanceAction = z.infer<typeof GovernanceActionSchema>

export const GovernanceActionListSchema = z.array(GovernanceActionSchema)
