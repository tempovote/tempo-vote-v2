import { describe, it, expect } from "vitest"
import {
  lovelaceToAda,
  computeVotePercent,
  computeDRepVotePercent,
  normalizeActionType,
  getActionTypeLabel,
  resolveAnchorUrl,
  resolveAnchorUrls,
  credentialHexToDrepId,
  govActionIdToBech32,
  VOTE_THRESHOLDS,
} from "./governance"

describe("lovelaceToAda", () => {
  it("formats small amounts with no suffix", () => {
    expect(lovelaceToAda(0)).toBe("0")
    expect(lovelaceToAda(5_000_000)).toBe("5") // 5 ADA
  })
  it("formats thousands (K, 1 decimal)", () => {
    expect(lovelaceToAda(2_500_000_000)).toBe("2.5K") // 2,500 ADA
  })
  it("formats millions (M, 2 decimals)", () => {
    expect(lovelaceToAda(1_000_000_000_000)).toBe("1.00M") // 1,000,000 ADA
  })
  it("formats billions (B, 2 decimals)", () => {
    expect(lovelaceToAda(1_000_000_000_000_000)).toBe("1.00B") // 1,000,000,000 ADA
  })
})

describe("computeVotePercent (count-based)", () => {
  it("uses activeMembers as denominator and computes not-voted remainder", () => {
    const r = computeVotePercent({ yes: 6, no: 2, abstain: 1, activeMembers: 10 } as never)
    expect(r).toEqual({ yesPercent: 60, noPercent: 20, abstainPercent: 10, notVotedPercent: 10 })
  })
  it("uses votes-cast as denominator when activeMembers is 0 (no not-voted)", () => {
    const r = computeVotePercent({ yes: 3, no: 1, abstain: 0, activeMembers: 0 } as never)
    expect(r).toEqual({ yesPercent: 75, noPercent: 25, abstainPercent: 0, notVotedPercent: 0 })
  })
  it("returns all zero when there is nothing to count", () => {
    const r = computeVotePercent({ yes: 0, no: 0, abstain: 0, activeMembers: 0 } as never)
    expect(r).toEqual({ yesPercent: 0, noPercent: 0, abstainPercent: 0, notVotedPercent: 0 })
  })
})

describe("computeDRepVotePercent", () => {
  const votes = { yesVotingPower: 40, noVotingPower: 10, autoNoConfidenceStake: 20, totalActiveDRepStake: 100 }

  it("adds auto-no-confidence stake to NO for normal actions", () => {
    expect(computeDRepVotePercent(votes as never, "treasuryWithdrawals")).toEqual({
      yesPercent: 40, noPercent: 30, notVotedPercent: 30,
    })
  })
  it("adds auto-no-confidence stake to YES for a noConfidence action", () => {
    expect(computeDRepVotePercent(votes as never, "noConfidence")).toEqual({
      yesPercent: 60, noPercent: 10, notVotedPercent: 30,
    })
  })
  it("reports 100% not-voted when there is no active stake", () => {
    expect(computeDRepVotePercent({ ...votes, totalActiveDRepStake: 0 } as never, "info")).toEqual({
      yesPercent: 0, noPercent: 0, notVotedPercent: 100,
    })
  })
})

describe("normalizeActionType", () => {
  it("maps canonical names", () => {
    expect(normalizeActionType("infoAction")).toBe("info")
    expect(normalizeActionType("noConfidence")).toBe("noConfidence")
  })
  it("maps raw Ogmios strings to canonical keys", () => {
    expect(normalizeActionType("treasuryWithdrawal")).toBe("treasuryWithdrawals")
    expect(normalizeActionType("hardFork")).toBe("hardForkInitiation")
    expect(normalizeActionType("protocolParameterUpdate")).toBe("protocolParametersUpdate")
  })
  it("passes unknown strings through unchanged", () => {
    expect(normalizeActionType("somethingElse")).toBe("somethingElse")
  })
})

describe("getActionTypeLabel", () => {
  it("labels canonical and raw types", () => {
    expect(getActionTypeLabel("noConfidence")).toBe("No Confidence")
    expect(getActionTypeLabel("hardFork")).toBe("Hard Fork Initiation")
  })
  it("falls back to the raw value for unknown types", () => {
    expect(getActionTypeLabel("mystery")).toBe("mystery")
  })
})

describe("resolveAnchorUrls / resolveAnchorUrl", () => {
  it("returns empty for null", () => {
    expect(resolveAnchorUrls(null)).toEqual([])
    expect(resolveAnchorUrl(null)).toBeNull()
  })
  it("expands ipfs:// to gateway URLs preserving the CID", () => {
    const first = resolveAnchorUrl("ipfs://QmExampleCidValue123")
    expect(first).not.toBeNull()
    expect(first!.startsWith("https://")).toBe(true)
    expect(first!.endsWith("QmExampleCidValue123")).toBe(true)
  })
  it("leaves a plain https URL unchanged", () => {
    expect(resolveAnchorUrls("https://example.com/meta.json")).toEqual(["https://example.com/meta.json"])
    expect(resolveAnchorUrl("https://example.com/meta.json")).toBe("https://example.com/meta.json")
  })
})

describe("bech32 ID encoders", () => {
  it("credentialHexToDrepId produces a drep1 id", () => {
    expect(credentialHexToDrepId("00".repeat(28)).startsWith("drep1")).toBe(true)
  })
  it("govActionIdToBech32 produces a gov_action1 id", () => {
    expect(govActionIdToBech32("00".repeat(32), 0).startsWith("gov_action1")).toBe(true)
  })
  it("govActionIdToBech32 encodes the index", () => {
    const tx = "00".repeat(32)
    expect(govActionIdToBech32(tx, 0)).not.toBe(govActionIdToBech32(tx, 1))
  })
})

describe("VOTE_THRESHOLDS", () => {
  it("pins Conway-era thresholds", () => {
    expect(VOTE_THRESHOLDS.treasuryWithdrawals.drep).toBe(0.67)
    expect(VOTE_THRESHOLDS.protocolParametersUpdate.drep).toBe(0.75)
    expect(VOTE_THRESHOLDS.hardForkInitiation.spo).toBe(0.51)
    expect(VOTE_THRESHOLDS.infoAction.drep).toBeUndefined()
  })
})
