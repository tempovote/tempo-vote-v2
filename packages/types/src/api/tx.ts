import { z } from "zod"

export const NetworkSchema = z.enum(["preprod", "mainnet"])
export type Network = z.infer<typeof NetworkSchema>

export const TxTypeSchema = z.enum([
  "DREP_REGISTER",
  "DREP_UPDATE",
  "DREP_RETIRE",
  "VOTE",
  "DELEGATE",
  "ACTIVATE_COMMUNITY",
])
export type TxType = z.infer<typeof TxTypeSchema>

export const BuildTxRequestSchema = z.object({
  txType: TxTypeSchema,
  network: NetworkSchema,
  utxos: z.array(z.string()),
  changeAddress: z.string(),
  rewardAddress: z.string(),
  // DRep operations
  drepId: z.string().optional(),
  anchorUrl: z.string().url().optional(),
  anchorDataHash: z.string().optional(),
  // Vote
  govActionTxHash: z.string().optional(),
  govActionIndex: z.number().int().min(0).optional(),
  voteKind: z.enum(["YES", "NO", "ABSTAIN"]).optional(),
  rationaleUrl: z.string().url().optional(),
  rationaleHash: z.string().optional(),
  // Delegation
  delegationType: z.enum(["drep", "abstain", "no_confidence"]).optional(),
  targetDrepId: z.string().optional(),
})
export type BuildTxRequest = z.infer<typeof BuildTxRequestSchema>

export const BuildTxResponseSchema = z.object({
  unsignedTxCbor: z.string(),
})
export type BuildTxResponse = z.infer<typeof BuildTxResponseSchema>

export const SubmitTxRequestSchema = z.object({
  signedTx: z.string(),
  network: NetworkSchema,
})
export type SubmitTxRequest = z.infer<typeof SubmitTxRequestSchema>

export const SubmitTxResponseSchema = z.object({
  txHash: z.string(),
})
export type SubmitTxResponse = z.infer<typeof SubmitTxResponseSchema>
