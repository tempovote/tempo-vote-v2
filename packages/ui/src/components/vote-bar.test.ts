import { describe, it, expect } from "vitest"
import { voteBarSegmentWidth, MIN_SLIVER_PERCENT } from "./vote-bar"

describe("voteBarSegmentWidth", () => {
  it("0 → 0 (không sliver khi không có vote)", () => {
    expect(voteBarSegmentWidth(0)).toBe(0)
  })
  it("giá trị dương dưới 0.5% → sliver 0.5% (PR #110)", () => {
    expect(voteBarSegmentWidth(0.01)).toBe(MIN_SLIVER_PERCENT)
    expect(voteBarSegmentWidth(0.49)).toBe(MIN_SLIVER_PERCENT)
  })
  it("giá trị ≥ 0.5% giữ nguyên", () => {
    expect(voteBarSegmentWidth(0.5)).toBe(0.5)
    expect(voteBarSegmentWidth(67)).toBe(67)
  })
  it("giá trị âm → 0", () => {
    expect(voteBarSegmentWidth(-1)).toBe(0)
  })
})
