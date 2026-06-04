import type { CardanoWindow, WalletInfo } from "./types"

/** Wallets known to support CIP-95 (governance) */
export const CIP95_WALLETS = ["eternl", "yoroi", "lace", "vespr", "nufi"] as const
export type SupportedWallet = (typeof CIP95_WALLETS)[number]

/** Returns names of wallets currently injected into window.cardano */
export function getAvailableWallets(): string[] {
  if (typeof window === "undefined") return []
  const cardano = (window as unknown as { cardano?: CardanoWindow }).cardano
  if (!cardano) return []
  return Object.keys(cardano)
}

/** Returns only wallets that support CIP-95 */
export function getGovernanceWallets(): string[] {
  return getAvailableWallets().filter((w) =>
    CIP95_WALLETS.includes(w.toLowerCase() as SupportedWallet)
  )
}

/** Returns WalletInfo for a specific wallet name */
export function getWalletInfo(walletName: string): WalletInfo | null {
  if (typeof window === "undefined") return null
  const cardano = (window as unknown as { cardano?: CardanoWindow }).cardano
  return cardano?.[walletName.toLowerCase()] ?? null
}
