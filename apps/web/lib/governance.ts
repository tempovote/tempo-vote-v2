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

// ipfs:// → https://ipfs.io/ipfs/... for browser display
export function resolveAnchorUrl(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${url.slice(7)}`
  }
  return url
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
