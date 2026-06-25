import { bech32 } from "bech32"
import type { VoteCounts, DRepVoteStats, SPOVoteStats } from "@tempo/types"

export function lovelaceToAda(lovelace: number): string {
  const ada = lovelace / 1_000_000
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(2)}B`
  if (ada >= 1_000_000)     return `${(ada / 1_000_000).toFixed(2)}M`
  if (ada >= 1_000)         return `${(ada / 1_000).toFixed(1)}K`
  return ada.toFixed(0)
}

/**
 * Compute DRep vote percentages using the GovTool ratification formula.
 *
 * Denominator = totalActiveDRepStake (excludes abstain stake).
 * Non-NoConfidence: yesTotal = yesVotingPower,                     noTotal = noVotingPower + autoNoConfidenceStake
 * NoConfidence:     yesTotal = yesVotingPower + autoNoConfidenceStake, noTotal = noVotingPower
 *
 * Returns notVotedPercent = remaining active stake that hasn't voted (shows ratification progress).
 */
export function computeDRepVotePercent(
  votes: DRepVoteStats,
  actionType: string
): { yesPercent: number; noPercent: number; notVotedPercent: number } {
  const isNoConfidence = actionType === "noConfidence"

  const yesTotal = isNoConfidence
    ? votes.yesVotingPower + votes.autoNoConfidenceStake
    : votes.yesVotingPower

  const noTotal = isNoConfidence
    ? votes.noVotingPower
    : votes.noVotingPower + votes.autoNoConfidenceStake

  const total = votes.totalActiveDRepStake
  if (total === 0) return { yesPercent: 0, noPercent: 0, notVotedPercent: 100 }

  const yesPercent = Math.round((yesTotal / total) * 100)
  const noPercent  = Math.round((noTotal  / total) * 100)
  return { yesPercent, noPercent, notVotedPercent: Math.max(0, 100 - yesPercent - noPercent) }
}

/**
 * Count-based percentage for SPO and CC.
 *
 * For CC: if activeMembers > 0, uses N_Yes/N_Active (GovTool formula).
 * A CC member who doesn't vote counts against the threshold — same logic as DRep "not voted".
 * For SPO: uses votes cast as denominator (activeMembers = 0).
 */
export function computeVotePercent(votes: VoteCounts): {
  yesPercent: number
  noPercent: number
  abstainPercent: number
  notVotedPercent: number
} {
  const activeTotal = votes.activeMembers > 0 ? votes.activeMembers : (votes.yes + votes.no + votes.abstain)
  if (activeTotal === 0) return { yesPercent: 0, noPercent: 0, abstainPercent: 0, notVotedPercent: 0 }
  const yesPercent     = Math.round((votes.yes     / activeTotal) * 100)
  const noPercent      = Math.round((votes.no      / activeTotal) * 100)
  const abstainPercent = Math.round((votes.abstain / activeTotal) * 100)
  const notVotedPercent = votes.activeMembers > 0
    ? Math.max(0, 100 - yesPercent - noPercent - abstainPercent)
    : 0
  return { yesPercent, noPercent, abstainPercent, notVotedPercent }
}

/**
 * Stake-weighted percentage for SPO votes.
 *
 * Denominator priority:
 *   1. totalActiveSPOStake — total live stake of ALL registered pools (correct per CIP-1694)
 *   2. totalVotingPower    — legacy fallback: only voted-pools stake (underestimates non-voters)
 *   3. count-based         — when no stake data available
 *
 * notVotedPercent is shown when totalActiveSPOStake is available (pools that didn't vote).
 */
export function computeSPOVotePercent(votes: SPOVoteStats): {
  yesPercent: number
  noPercent: number
  abstainPercent: number
  notVotedPercent: number
} {
  const denominator = votes.totalActiveSPOStake > 0
    ? votes.totalActiveSPOStake
    : votes.totalVotingPower
  if (denominator > 0) {
    const yesPercent     = Math.round((votes.yesVotingPower     / denominator) * 100)
    const noPercent      = Math.round((votes.noVotingPower      / denominator) * 100)
    const abstainPercent = Math.round((votes.abstainVotingPower / denominator) * 100)
    const notVotedPercent = votes.totalActiveSPOStake > 0
      ? Math.max(0, 100 - yesPercent - noPercent - abstainPercent)
      : 0
    return { yesPercent, noPercent, abstainPercent, notVotedPercent }
  }
  // Fallback: count-based (same as computeVotePercent with activeMembers = 0)
  return computeVotePercent(votes as unknown as VoteCounts)
}

// Canonical action-type keys used for i18n dict lookup (governance.type.<key>).
export type ActionTypeKey =
  | "info"
  | "treasuryWithdrawals"
  | "protocolParametersUpdate"
  | "hardForkInitiation"
  | "noConfidence"
  | "updateCommittee"
  | "newConstitution"

/**
 * Normalize any raw action-type string (our canonical names or raw Ogmios
 * strings) to a stable key. Use with i18n: t(`governance.type.${key}`).
 */
export function normalizeActionType(actionType: string): ActionTypeKey | string {
  const map: Record<string, ActionTypeKey> = {
    // canonical names (from our code / CIP)
    infoAction:               "info",
    treasuryWithdrawals:      "treasuryWithdrawals",
    protocolParametersUpdate: "protocolParametersUpdate",
    hardForkInitiation:       "hardForkInitiation",
    noConfidence:             "noConfidence",
    updateCommittee:          "updateCommittee",
    newConstitution:          "newConstitution",
    // raw Ogmios display strings
    information:              "info",
    treasuryWithdrawal:       "treasuryWithdrawals",
    protocolParameterUpdate:  "protocolParametersUpdate",
    hardFork:                 "hardForkInitiation",
    constitutionalCommittee:  "updateCommittee",
    constitution:             "newConstitution",
  }
  return map[actionType] ?? actionType
}

/** English fallback label (non-React contexts). UI should prefer i18n via normalizeActionType. */
export function getActionTypeLabel(actionType: string): string {
  const labels: Record<ActionTypeKey, string> = {
    info:                     "Info",
    treasuryWithdrawals:      "Treasury Withdrawals",
    protocolParametersUpdate: "Protocol Parameter Change",
    hardForkInitiation:       "Hard Fork Initiation",
    noConfidence:             "No Confidence",
    updateCommittee:          "Update Committee",
    newConstitution:          "New Constitution",
  }
  const key = normalizeActionType(actionType)
  return (labels as Record<string, string>)[key] ?? actionType
}

function buildIpfsGateways(): string[] {
  const pinata = process.env.NEXT_PUBLIC_PINATA_GATEWAY
  // cloudflare-ipfs.com was shut down in 2023 — removed.
  // gateway.pinata.cloud is the most reliable for Pinata-pinned files.
  const base = [
    "https://gateway.pinata.cloud/ipfs/",
    "https://ipfs.io/ipfs/",
    "https://dweb.link/ipfs/",
    "https://w3s.link/ipfs/",
    "https://nftstorage.link/ipfs/",
  ]
  return pinata ? [`${pinata}/ipfs/`, ...base] : base
}

const IPFS_GATEWAYS = buildIpfsGateways()

// Extract CID from the path segment after /ipfs/ — supports CIDv0 (Qm...) and CIDv1 (baf...)
function extractIpfsCid(url: string): string | null {
  const after = url.split("/ipfs/")[1]
  if (!after) return null
  const m = /^(Qm[1-9A-HJ-NP-Za-km-z]{44,}|baf[0-9A-Za-z]{50,})/.exec(after)
  return m?.[1] ?? null
}

// Resolve any URL to a list of candidate HTTPS URLs to try in order (IPFS gateway fallback).
// ipfs://    → all gateways
// HTTPS with /ipfs/<CID> → original URL first, then remaining gateways with same CID
// Other HTTPS → [url] unchanged (e.g. raw GitHub, direct API endpoints)
export function resolveAnchorUrls(url: string | null): string[] {
  if (!url) return []

  if (url.startsWith("ipfs://")) {
    const cid = url.slice(7)
    return IPFS_GATEWAYS.map((gw) => `${gw}${cid}`)
  }

  if (url.includes("/ipfs/")) {
    const cid = extractIpfsCid(url)
    if (cid) {
      const others = IPFS_GATEWAYS.map((gw) => `${gw}${cid}`).filter((u) => u !== url)
      return [url, ...others]
    }
  }

  return [url]
}

// ipfs:// → first gateway URL (for display links)
export function resolveAnchorUrl(url: string | null): string | null {
  const urls = resolveAnchorUrls(url)
  return urls[0] ?? null
}

// 28-byte hex credential → bech32 DRep ID (drep1...)
export function credentialHexToDrepId(hex: string): string {
  try {
    const bytes = new Uint8Array(28)
    for (let i = 0; i < 28; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
    }
    const words = bech32.toWords(bytes)
    return bech32.encode("drep", words, 200)
  } catch {
    return hex
  }
}

// CIP-129: governance action ID → bech32 (gov_action1...)
// Payload: txHash bytes (32) + index as a SINGLE byte (33 bytes total).
// This matches cardano-cli / explorers (cexplorer, Eternl). Using a 4-byte
// index produces a non-standard, longer string (…qqqqqq…) that explorers reject.
export function govActionIdToBech32(txHash: string, index: number): string {
  try {
    const payload = new Uint8Array(33)
    for (let i = 0; i < 32; i++) {
      payload[i] = parseInt(txHash.slice(i * 2, i * 2 + 2), 16)
    }
    payload[32] = index & 0xff
    const words = bech32.toWords(payload)
    return bech32.encode("gov_action", words, 200)
  } catch {
    return ""
  }
}

// Static Conway-era vote thresholds (fraction, e.g. 0.67 = 67%)
export const VOTE_THRESHOLDS: Record<string, { drep?: number; spo?: number; cc?: number }> = {
  treasuryWithdrawals:      { drep: 0.67, cc: 0.60 },
  protocolParametersUpdate: { drep: 0.75, cc: 0.60 },
  hardForkInitiation:       { drep: 0.60, spo: 0.51, cc: 0.60 },
  noConfidence:             { drep: 0.60, spo: 0.51 },
  updateCommittee:          { drep: 0.67, spo: 0.51 },  // committee changes ratified by DRep + SPO, not CC
  newConstitution:          { drep: 0.75, cc: 0.60 },
  infoAction:               {},
}
