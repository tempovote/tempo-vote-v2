import { describe, it, expect } from "vitest"
import { formatAda, formatCompact, formatPct, truncateMiddle } from "./format"

describe("formatAda (input: lovelace)", () => {
  it("tỷ ADA → B, 2 số lẻ", () => {
    expect(formatAda(1_234_000_000_000_000)).toBe("1.23B")
  })
  it("triệu ADA → M, 2 số lẻ", () => {
    expect(formatAda(595_013_768_459_950)).toBe("595.01M")
  })
  it("nghìn ADA → K, 1 số lẻ", () => {
    expect(formatAda(1_500_000_000)).toBe("1.5K")
  })
  it("dưới nghìn → nguyên", () => {
    expect(formatAda(999_000_000)).toBe("999")
  })
  it("0 → \"0\"", () => {
    expect(formatAda(0)).toBe("0")
  })
})

describe("formatCompact (input: ADA)", () => {
  it("tỷ → B 1 số lẻ", () => {
    expect(formatCompact(1_500_000_000)).toBe("1.5B")
  })
  it("triệu → M nguyên", () => {
    expect(formatCompact(23_400_000)).toBe("23M")
  })
  it("dưới triệu → toLocaleString", () => {
    expect(formatCompact(999_999)).toBe((999_999).toLocaleString())
  })
})

describe("formatPct", () => {
  it("0 → \"0\"", () => {
    expect(formatPct(0)).toBe("0")
  })
  it("dưới 1 → 1 số lẻ", () => {
    expect(formatPct(0.42)).toBe("0.4")
  })
  it("từ 1 trở lên → làm tròn", () => {
    expect(formatPct(74.657)).toBe("75")
  })
})

describe("truncateMiddle", () => {
  it("mặc định 10…6", () => {
    const h = "4b10e5793208cb8f228756e02113227c91602248eac4d992681a0ee760b6c4e2"
    expect(truncateMiddle(h)).toBe("4b10e57932…b6c4e2")
  })
  it("chuỗi ngắn giữ nguyên", () => {
    expect(truncateMiddle("abc")).toBe("abc")
  })
  it("head/tail tuỳ chỉnh", () => {
    expect(truncateMiddle("abcdefghijklmnop", 4, 2)).toBe("abcd…op")
  })
})
