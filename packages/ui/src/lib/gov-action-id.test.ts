import { describe, it, expect } from "vitest"
import { bech32 } from "bech32"
import { govActionIdToBech32 } from "./gov-action-id"

const TX_HASH = "a".repeat(64) // 32 bytes hex hợp lệ

describe("govActionIdToBech32", () => {
  it("encode đúng CIP-129: prefix gov_action, payload = 32 bytes txHash + 1 byte index", () => {
    const out = govActionIdToBech32(TX_HASH, 3)
    expect(out.startsWith("gov_action1")).toBe(true)
    const decoded = bech32.decode(out, 200)
    expect(decoded.prefix).toBe("gov_action")
    const payload = bech32.fromWords(decoded.words)
    expect(payload).toHaveLength(33)
    expect(payload[0]).toBe(0xaa)
    expect(payload[32]).toBe(3)
  })

  it("index khác nhau cho output khác nhau", () => {
    expect(govActionIdToBech32(TX_HASH, 0)).not.toBe(govActionIdToBech32(TX_HASH, 1))
  })
})
