import type { WalletApi, DRepKey, PubStakeKey } from "./types"
import { pubDRepKeyToDrepId } from "./utils"

/**
 * Check if the wallet supports CIP-95 governance.
 * Checks for the api.cip95 namespace (populated when enable({ extensions: [{ cip: 95 }] })).
 */
export function hasCip95(api: WalletApi): boolean {
  return !!api.cip95
}

/**
 * Get the DRep key from a CIP-95 enabled wallet.
 *
 * Tries methods in this order:
 * 1. api.cip95.getDRepKey()      — Eternl-specific extension (returns full DRepKey)
 * 2. api.cip95.getPubDRepKey()   — CIP-95 standard (returns raw hex pubkey only)
 *
 * @throws if wallet does not support CIP-95 or no method is available
 */
export async function getDRepKey(api: WalletApi): Promise<DRepKey> {
  if (!api.cip95) {
    throw new Error(
      "Wallet does not support CIP-95. Make sure you enabled the governance extension."
    )
  }

  // Method 1: Eternl / wallets that provide the full DRepKey object
  // dRepIDCip105 may be empty on some wallets — derive from pubDRepKey as fallback
  if (typeof api.cip95.getDRepKey === "function") {
    const key = await api.cip95.getDRepKey()
    return {
      ...key,
      dRepIDCip105: key.dRepIDCip105 || pubDRepKeyToDrepId(key.pubDRepKey),
    }
  }

  // Method 2: CIP-95 standard — only returns the raw public key hex
  if (typeof api.cip95.getPubDRepKey === "function") {
    const pubDRepKey = await api.cip95.getPubDRepKey()
    return {
      pubDRepKey,
      dRepIDCip105: pubDRepKeyToDrepId(pubDRepKey),
      dRepIDBech32: undefined,
    }
  }

  throw new Error("CIP-95 extension found but no getDRepKey / getPubDRepKey method available.")
}

/** Returns the DRep ID in bech32 format (drep1...) or null if not available */
export async function getDRepId(api: WalletApi): Promise<string | null> {
  try {
    const key = await getDRepKey(api)
    return key.dRepIDCip105 || key.dRepIDBech32 || null
  } catch {
    return null
  }
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
