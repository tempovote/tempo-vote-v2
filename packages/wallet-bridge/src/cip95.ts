import type { WalletApi, DRepKey, PubStakeKey } from "./types"

/**
 * Get the DRep key from a CIP-95 enabled wallet.
 * Returns the DRep public key + CIP-105 bech32 DRep ID.
 *
 * @throws if wallet does not support CIP-95
 */
export async function getDRepKey(api: WalletApi): Promise<DRepKey> {
  if (!api.cip95) {
    throw new Error(
      "Wallet does not support CIP-95. Make sure you enabled the governance extension."
    )
  }
  return api.cip95.getDRepKey()
}

/** Returns the DRep ID in bech32 format (drep1...) or null if not available */
export async function getDRepId(api: WalletApi): Promise<string | null> {
  try {
    const key = await getDRepKey(api)
    return key.dRepIDCip105 ?? key.dRepIDBech32 ?? null
  } catch {
    return null
  }
}

/** Check if the wallet supports CIP-95 governance */
export function hasCip95(api: WalletApi): boolean {
  return !!api.cip95
}

/** Get registered stake keys */
export async function getRegisteredStakeKeys(api: WalletApi): Promise<PubStakeKey[]> {
  if (!api.cip95) return []
  return api.cip95.getRegisteredPubStakeKeys()
}

/** Get unregistered stake keys */
export async function getUnregisteredStakeKeys(api: WalletApi): Promise<PubStakeKey[]> {
  if (!api.cip95) return []
  return api.cip95.getUnregisteredPubStakeKeys()
}
