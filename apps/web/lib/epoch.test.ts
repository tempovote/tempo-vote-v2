import { describe, it, expect } from "vitest"
import {
  getEpochEndTimeMs,
  getEpochRemainingMs,
  formatEpochDuration,
  NETWORK_EPOCH_CONFIGS,
} from "./epoch"

describe("epoch calculations", () => {
  it("computes epoch end time for mainnet", () => {
    // Mainnet start: 1506203091 s (epoch 0 start)
    // Epoch 0 end (epoch 1 start): 1506203091 + 1 * 432000 = 1506635091 s
    expect(getEpochEndTimeMs(0, "mainnet")).toBe(1506635091 * 1000)

    // Epoch 500 end: 1506203091 + 501 * 432000 = 1722635091 s
    expect(getEpochEndTimeMs(500, "mainnet")).toBe(1722635091 * 1000)
  })

  it("computes epoch end time for preprod", () => {
    // Preprod start: 1654041600 s (epoch 0 start)
    // Epoch 0 end (epoch 1 start): 1654041600 + 1 * 86400 = 1654128000 s
    expect(getEpochEndTimeMs(0, "preprod")).toBe(1654128000 * 1000)
  })

  it("computes remaining ms accurately", () => {
    const endMs = getEpochEndTimeMs(600, "mainnet")
    const nowMs = endMs - 10000
    expect(getEpochRemainingMs(600, "mainnet", nowMs)).toBe(10000)

    // Already passed
    expect(getEpochRemainingMs(600, "mainnet", endMs + 5000)).toBe(0)
  })

  it("formats epoch remaining duration correctly", () => {
    // 2 days 9 hours = (2 * 86400 + 9 * 3600) * 1000 ms
    const twoDaysNineHours = (2 * 86400 + 9 * 3600 + 15 * 60) * 1000
    expect(formatEpochDuration(twoDaysNineHours)).toBe("2d 9h")

    // 5 hours 30 mins
    const fiveHoursThirtyMins = (5 * 3600 + 30 * 60) * 1000
    expect(formatEpochDuration(fiveHoursThirtyMins)).toBe("5h 30m")

    // 45 mins
    const fortyFiveMins = 45 * 60 * 1000
    expect(formatEpochDuration(fortyFiveMins)).toBe("45m")

    // < 1 min
    const thirtySecs = 30 * 1000
    expect(formatEpochDuration(thirtySecs)).toBe("< 1m")

    // <= 0
    expect(formatEpochDuration(0)).toBe("")
    expect(formatEpochDuration(-1000)).toBe("")
  })
})
