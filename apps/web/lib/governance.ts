import { bech32 } from "bech32"
import type { VoteCounts } from "@tempo/types"

export function lovelaceToAda(lovelace: number): string {
  const ada = lovelace / 1_000_000
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(2)}B`
  if (ada >= 1_000_000)     return `${(ada / 1_000_000).toFixed(2)}M`
  if (ada >= 1_000)         return `${(ada / 1_000).toFixed(1)}K`
  return ada.toFixed(0)
}

export function computeVotePercent(votes: VoteCounts): {
  yesPercent: number
  noPercent: number
  abstainPercent: number
} {
  const total = votes.yes + votes.no + votes.abstain
  if (total === 0) return { yesPercent: 0, noPercent: 0, abstainPercent: 0 }
  return {
    yesPercent:     Math.round((votes.yes     / total) * 100),
    noPercent:      Math.round((votes.no      / total) * 100),
    abstainPercent: Math.round((votes.abstain / total) * 100),
  }
}

export function getActionTypeLabel(actionType: string): string {
  const map: Record<string, string> = {
    treasuryWithdrawals:      "Treasury Withdrawals",
    protocolParametersUpdate: "Protocol Parameter Change",
    hardForkInitiation:       "Hard Fork Initiation",
    noConfidence:             "No Confidence",
    updateCommittee:          "Update Committee",
    newConstitution:          "New Constitution",
    infoAction:               "Info Action",
  }
  return map[actionType] ?? actionType
}

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/",
]

// ipfs:// → list of candidate HTTPS URLs (for fallback fetching)
export function resolveAnchorUrls(url: string | null): string[] {
  if (!url) return []
  if (url.startsWith("ipfs://")) {
    const cid = url.slice(7)
    return IPFS_GATEWAYS.map((gw) => `${gw}${cid}`)
  }
  return [url]
}

// ipfs:// → first gateway URL (for display links)
export function resolveAnchorUrl(url: string | null): string | null {
  const urls = resolveAnchorUrls(url)
  return urls[0] ?? null
}

// CIP-129: governance action ID → bech32 (gov_action1...)
// Payload: txHash bytes (32) + index as 4-byte big-endian
export function govActionIdToBech32(txHash: string, index: number): string {
  try {
    const hashBytes = new Uint8Array(32)
    for (let i = 0; i < 32; i++) {
      hashBytes[i] = parseInt(txHash.slice(i * 2, i * 2 + 2), 16)
    }
    const indexBytes = new Uint8Array(4)
    new DataView(indexBytes.buffer).setUint32(0, index, false) // big-endian
    const payload = new Uint8Array(36)
    payload.set(hashBytes, 0)
    payload.set(indexBytes, 32)
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
  updateCommittee:          { drep: 0.67, cc: 0.60 },
  newConstitution:          { drep: 0.75, cc: 0.60 },
  infoAction:               {},
}
