import { describe, it, expect } from "vitest"
import { resolvePollCta, resolveTargetDrepId } from "./pollCta"

// The CTA routing matrix is the fix for the "Internal Poll button sends non-DReps
// into a never-activated community" bug. Every branch is pinned here.

describe("resolveTargetDrepId", () => {
  it("uses the wallet's own DRep when it is a registered DRep", () => {
    expect(resolveTargetDrepId(true, "drepOWN", "drepDELEGATED")).toBe("drepOWN")
  })

  it("uses the delegated DRep when the wallet is not a DRep", () => {
    expect(resolveTargetDrepId(false, "drepOWN", "drepDELEGATED")).toBe("drepDELEGATED")
  })

  it("falls back to delegated when own DRep id is missing", () => {
    expect(resolveTargetDrepId(true, null, "drepDELEGATED")).toBe("drepDELEGATED")
  })

  it("treats unknown registration (null) as not-a-DRep", () => {
    expect(resolveTargetDrepId(null, "drepOWN", "drepDELEGATED")).toBe("drepDELEGATED")
  })

  it("is null when there is neither a DRep role nor a delegation", () => {
    expect(resolveTargetDrepId(false, "drepOWN", null)).toBeNull()
  })
})

describe("resolvePollCta", () => {
  const base = { network: "mainnet" as const }

  it("non-DRep with no delegation → register as a DRep", () => {
    // ownDrepId is present (every CIP-95 wallet has one) but must NOT route here.
    const cta = resolvePollCta({ ...base, isDrepRegistered: false, ownDrepId: "drepOWN", delegatedDrepId: null, targetActive: false })
    expect(cta).toEqual({ href: "/dreps/register", labelKey: "governance.list.becomeDrep" })
  })

  it("registered DRep + active own community → create internal poll", () => {
    const cta = resolvePollCta({ ...base, isDrepRegistered: true, ownDrepId: "drepOWN", delegatedDrepId: null, targetActive: true })
    expect(cta).toEqual({ href: "/dreps/drepOWN/community?create=true", labelKey: "governance.list.internalPoll" })
  })

  it("registered DRep + inactive own community → activate community", () => {
    const cta = resolvePollCta({ ...base, isDrepRegistered: true, ownDrepId: "drepOWN", delegatedDrepId: null, targetActive: false })
    expect(cta).toEqual({ href: "/dreps/drepOWN/community", labelKey: "governance.list.activateCommunity" })
  })

  it("delegator + active delegated community → create internal poll (delegators may create too)", () => {
    const cta = resolvePollCta({ ...base, isDrepRegistered: false, ownDrepId: "drepSELF", delegatedDrepId: "drepX", targetActive: true })
    expect(cta).toEqual({ href: "/dreps/drepX/community?create=true", labelKey: "governance.list.internalPoll" })
  })

  it("delegator + inactive delegated community → open the delegated community", () => {
    const cta = resolvePollCta({ ...base, isDrepRegistered: false, ownDrepId: "drepSELF", delegatedDrepId: "drepX", targetActive: false })
    expect(cta).toEqual({ href: "/dreps/drepX/community", labelKey: "governance.list.drepCommunity" })
  })

  it("appends &network on preprod for the create link", () => {
    const cta = resolvePollCta({ network: "preprod", isDrepRegistered: true, ownDrepId: "drepOWN", delegatedDrepId: null, targetActive: true })
    expect(cta.href).toBe("/dreps/drepOWN/community?create=true&network=preprod")
  })

  it("appends ?network on preprod for the plain community link", () => {
    const cta = resolvePollCta({ network: "preprod", isDrepRegistered: false, ownDrepId: "drepSELF", delegatedDrepId: "drepX", targetActive: false })
    expect(cta.href).toBe("/dreps/drepX/community?network=preprod")
  })
})
