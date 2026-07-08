import { describe, it, expect } from "vitest"
import { cn } from "./utils"

describe("cn", () => {
  it("gộp nhiều class", () => {
    expect(cn("a", "b")).toBe("a b")
  })
  it("bỏ giá trị falsy", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c")
  })
  it("merge xung đột tailwind — class sau thắng", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4")
  })
  it("hỗ trợ object syntax của clsx", () => {
    expect(cn({ "text-danger": true, hidden: false }, "font-bold")).toBe("text-danger font-bold")
  })
})
