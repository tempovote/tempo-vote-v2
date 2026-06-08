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
  "PROPOSE_INFO_ACTION",
  "PROPOSE_NO_CONFIDENCE",
  "PROPOSE_HARD_FORK",
  "PROPOSE_NEW_CONSTITUTION",
  "PROPOSE_TREASURY_WITHDRAWAL",
  "PROPOSE_UPDATE_COMMITTEE",
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
  anchorUrl: z.string().optional(),
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
  // DREP_REGISTER: include a self-delegation cert in the same TX (atomic, no double-spent risk)
  selfDelegate: z.boolean().optional(),
  // Governance proposals — previous GA of same type (on-chain chaining, null = first of type)
  prevGovActionTxHash: z.string().optional(),
  prevGovActionIdx: z.number().int().min(0).optional(),
  // PROPOSE_HARD_FORK: target protocol version
  protocolVersionMajor: z.number().int().min(0).optional(),
  protocolVersionMinor: z.number().int().min(0).optional(),
  // PROPOSE_NEW_CONSTITUTION: constitution document anchor (separate from proposal anchor)
  constitutionAnchorUrl: z.string().optional(),
  constitutionAnchorHash: z.string().optional(),
  constitutionScriptHash: z.string().optional(),
  // PROPOSE_TREASURY_WITHDRAWAL: list of (stakeAddress, lovelace) recipients
  // lovelace as string to avoid JS number precision loss on large values
  treasuryWithdrawals: z.array(z.object({
    stakeAddress: z.string(),
    lovelace: z.string(),
  })).optional(),
  // Collateral inputs — required when the TX executes Plutus scripts (e.g. guardrails)
  collateral: z.array(z.string()).optional(),
  // PROPOSE_UPDATE_COMMITTEE: members to remove/add and new quorum threshold
  committeeRemove: z.array(z.string()).optional(),
  committeeAdd: z.array(z.object({
    credential: z.string(),
    termEpoch: z.number().int().min(0),
  })).optional(),
  quorumNumerator: z.number().int().min(1).optional(),
  quorumDenominator: z.number().int().min(1).optional(),
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
