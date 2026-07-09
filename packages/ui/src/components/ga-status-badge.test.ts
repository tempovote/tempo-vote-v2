import { describe, it, expect } from "vitest"
import { gaStatusToVariant } from "./ga-status-badge"

describe("gaStatusToVariant", () => {
  it.each([
    ["active", "status-active"],
    ["ratified", "status-ratified"],
    ["expired", "status-expired"],
    ["enacted", "status-enacted"],
    ["dropped", "status-dropped"],
  ] as const)("%s → %s", (status, variant) => {
    expect(gaStatusToVariant(status)).toBe(variant)
  })

  it("status lạ fallback về status-active (hành vi bản gốc)", () => {
    expect(gaStatusToVariant("banana")).toBe("status-active")
  })
})
