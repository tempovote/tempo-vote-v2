import type { WalletApi } from "./types"
import { getWalletInfo } from "./wallets"

/**
 * Enable a wallet with CIP-95 governance extension.
 * Prompts the user for permission in the wallet extension popup.
 *
 * @param walletName  lowercase wallet identifier, e.g. "eternl", "lace"
 * @throws if wallet not found or user rejects
 */
export async function connectWallet(walletName: string): Promise<WalletApi> {
  const walletInfo = getWalletInfo(walletName)
  if (!walletInfo) {
    throw new Error(
      `Wallet "${walletName}" not found. Make sure the extension is installed.`
    )
  }

  const api = await walletInfo.enable({
    extensions: [{ cip: 95 }],  // request CIP-95 governance extension
  })

  return api as WalletApi
}

/**
 * Check if a wallet is already enabled (without prompting).
 */
export async function isWalletEnabled(walletName: string): Promise<boolean> {
  const walletInfo = getWalletInfo(walletName)
  if (!walletInfo) return false
  return walletInfo.isEnabled()
}

export function disconnectWallet(): void {
  // CIP-30 has no explicit disconnect method — clear local state only
  // The wallet extension maintains its own session
}
