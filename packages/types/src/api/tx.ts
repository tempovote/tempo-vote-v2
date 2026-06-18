import { z } from "zod"

export const NetworkSchema = z.enum(["preprod", "mainnet"])
export type Network = z.infer<typeof NetworkSchema>

export const TxTypeSchema = z.enum([
  "DREP_REGISTER",
  "DREP_UPDATE",
  "DREP_RETIRE",
  "VOTE",
  "MULTI_VOTE",
  "DELEGATE",
  "ACTIVATE_COMMUNITY",
  "PROPOSE_INFO_ACTION",
  "PROPOSE_NO_CONFIDENCE",
  "PROPOSE_HARD_FORK",
  "PROPOSE_NEW_CONSTITUTION",
  "PROPOSE_TREASURY_WITHDRAWAL",
  "PROPOSE_UPDATE_COMMITTEE",
  "PROPOSE_PROTOCOL_PARAM_CHANGE",
  "ALLIANCE_TREASURY_CONTRIBUTE",
  "ALLIANCE_WITHDRAW",
])
export type TxType = z.infer<typeof TxTypeSchema>

export const VoteItemSchema = z.object({
  govActionTxHash: z.string(),
  govActionIndex: z.number().int().min(0),
  voteKind: z.enum(["YES", "NO", "ABSTAIN"]),
  rationaleUrl: z.string().url().optional(),
  rationaleHash: z.string().optional(),
})
export type VoteItem = z.infer<typeof VoteItemSchema>

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
  // Vote (single)
  govActionTxHash: z.string().optional(),
  govActionIndex: z.number().int().min(0).optional(),
  voteKind: z.enum(["YES", "NO", "ABSTAIN"]).optional(),
  rationaleUrl: z.string().url().optional(),
  rationaleHash: z.string().optional(),
  // Vote (multi) — MULTI_VOTE txType
  votes: z.array(VoteItemSchema).optional(),
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
  // ALLIANCE_TREASURY_CONTRIBUTE
  allianceId: z.string().uuid().optional(),
  amountLovelace: z.number().int().positive().optional(),
  // ALLIANCE_WITHDRAW
  proposalId: z.string().uuid().optional(),
  treasuryUtxoTxHash: z.string().optional(),
  treasuryUtxoIndex: z.number().int().min(0).optional(),
  treasuryUtxoLovelace: z.number().int().positive().optional(),
  finalizationTxHash: z.string().optional(),
  finalizationTxIndex: z.number().int().min(0).optional(),
  recipientAddress: z.string().optional(),
  executableAtMs: z.number().int().positive().optional(),
  // PROPOSE_UPDATE_COMMITTEE: members to remove/add and new quorum threshold
  committeeRemove: z.array(z.string()).optional(),
  committeeAdd: z.array(z.object({
    credential: z.string(),
    termEpoch: z.number().int().min(0),
  })).optional(),
  quorumNumerator: z.number().int().min(1).optional(),
  quorumDenominator: z.number().int().min(1).optional(),
  // PROPOSE_PROTOCOL_PARAM_CHANGE: only the fields to change (all optional, at least 1 required)
  // Rate fields (expansionRate, treasuryGrowthRate, poolPledgeInfluence) expressed as
  // parts-per-million: e.g. 0.003 → 3000, 0.2 → 200000, 0.3 → 300000
  protocolParamUpdate: z.object({
    minFeeA: z.number().int().min(0).optional(),
    minFeeB: z.number().int().min(0).optional(),
    maxTxSize: z.number().int().min(0).optional(),
    maxBlockSize: z.number().int().min(0).optional(),
    maxBlockHeaderSize: z.number().int().min(0).optional(),
    keyDeposit: z.number().int().min(0).optional(),
    poolDeposit: z.number().int().min(0).optional(),
    nOpt: z.number().int().min(0).optional(),
    maxEpoch: z.number().int().min(0).optional(),
    minPoolCost: z.number().int().min(0).optional(),
    poolPledgeInfluencePerMillion: z.number().int().min(0).max(2000000).optional(),
    adaPerUtxoByte: z.number().int().min(0).optional(),
    expansionRatePerMillion: z.number().int().min(0).max(1000000).optional(),
    treasuryGrowthRatePerMillion: z.number().int().min(0).max(1000000).optional(),
    maxValSize: z.number().int().min(0).optional(),
    collateralPercent: z.number().int().min(0).optional(),
    maxCollateralInputs: z.number().int().min(0).optional(),
    // Conway governance group (fields 25-33)
    // pool_voting_thresholds — all 5 must be supplied together or omitted
    poolVtMotionNoConfidencePerMillion: z.number().int().min(0).max(1000000).optional(),
    poolVtCommitteeNormalPerMillion: z.number().int().min(0).max(1000000).optional(),
    poolVtCommitteeNoConfidencePerMillion: z.number().int().min(0).max(1000000).optional(),
    poolVtHardForkInitiationPerMillion: z.number().int().min(0).max(1000000).optional(),
    poolVtSecurityRelevantParamPerMillion: z.number().int().min(0).max(1000000).optional(),
    // drep_voting_thresholds — all 10 must be supplied together or omitted
    drepVtMotionNoConfidencePerMillion: z.number().int().min(0).max(1000000).optional(),
    drepVtCommitteeNormalPerMillion: z.number().int().min(0).max(1000000).optional(),
    drepVtCommitteeNoConfidencePerMillion: z.number().int().min(0).max(1000000).optional(),
    drepVtUpdateConstitutionPerMillion: z.number().int().min(0).max(1000000).optional(),
    drepVtHardForkInitiationPerMillion: z.number().int().min(0).max(1000000).optional(),
    drepVtPpNetworkGroupPerMillion: z.number().int().min(0).max(1000000).optional(),
    drepVtPpEconomicGroupPerMillion: z.number().int().min(0).max(1000000).optional(),
    drepVtPpTechnicalGroupPerMillion: z.number().int().min(0).max(1000000).optional(),
    drepVtPpGovernanceGroupPerMillion: z.number().int().min(0).max(1000000).optional(),
    drepVtTreasuryWithdrawalPerMillion: z.number().int().min(0).max(1000000).optional(),
    committeeMinSize: z.number().int().min(0).optional(),
    committeeMaxTermLength: z.number().int().min(0).optional(),
    govActionLifetime: z.number().int().min(0).optional(),
    govActionDeposit: z.number().int().min(0).optional(),
    drepDeposit: z.number().int().min(0).optional(),
    drepActivity: z.number().int().min(0).optional(),
    minFeeRefScriptCostPerBytePerMillion: z.number().int().min(0).optional(),
  }).optional(),
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
