// Role-based routing for the "Internal Poll" CTA on the Governance Actions list.
//
// The community a wallet "belongs to" is its own (if a registered DRep) else the DRep
// it delegated to. Both DReps AND their delegators may create internal polls, so the
// CTA adapts to the target community's activation state. Pure + framework-free so it
// can be unit-tested in isolation (the page wires `useCommunity` + i18n around it).

export interface PollCtaInput {
  /** Whether the connected wallet is a registered DRep (null = unknown/not loaded). */
  isDrepRegistered: boolean | null
  /** The wallet's own DRep ID (drepKey.dRepIDCip105) — present for any CIP-95 wallet. */
  ownDrepId: string | null
  /** The DRep this wallet delegated to (delegatedDrep.id), or null. */
  delegatedDrepId: string | null
  /** Whether the *target* community (see resolveTargetDrepId) is active. */
  targetActive: boolean
  /** Selected network ("mainnet" | "preprod" | ...). */
  network: string
}

export interface PollCta {
  href: string
  /** i18n key; the caller resolves it with t(). Keeps this fn pure. */
  labelKey: string
}

/** The DRep whose community this wallet belongs to: own if a DRep, else the delegated one. */
export function resolveTargetDrepId(
  isDrepRegistered: boolean | null,
  ownDrepId: string | null,
  delegatedDrepId: string | null,
): string | null {
  const isDrep = isDrepRegistered === true && !!ownDrepId
  return isDrep ? ownDrepId : delegatedDrepId
}

export function resolvePollCta(input: PollCtaInput): PollCta {
  const { isDrepRegistered, ownDrepId, delegatedDrepId, targetActive, network } = input

  const isDrep = isDrepRegistered === true && !!ownDrepId
  const targetDrepId = resolveTargetDrepId(isDrepRegistered, ownDrepId, delegatedDrepId)

  const netSuffix = network !== "mainnet" ? `&network=${network}` : ""
  const netQuery = network !== "mainnet" ? `?network=${network}` : ""

  // Belongs to no community (not a DRep, hasn't delegated) → register as a DRep.
  if (!targetDrepId) {
    return { href: "/dreps/register", labelKey: "governance.list.becomeDrep" }
  }
  // Active community → DRep + delegators may both create an internal poll.
  if (targetActive) {
    return {
      href: `/dreps/${targetDrepId}/community?create=true${netSuffix}`,
      labelKey: "governance.list.internalPoll",
    }
  }
  // Inactive: owner can activate; a delegator can only open it (page explains).
  return {
    href: `/dreps/${targetDrepId}/community${netQuery}`,
    labelKey: isDrep ? "governance.list.activateCommunity" : "governance.list.drepCommunity",
  }
}
