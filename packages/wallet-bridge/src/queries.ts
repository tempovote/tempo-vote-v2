import type { WalletApi, NetworkId, NetworkName } from "./types"

/** Returns network ID: 0 = testnet/preprod, 1 = mainnet */
export async function getNetworkId(api: WalletApi): Promise<NetworkId> {
  return api.getNetworkId() as Promise<NetworkId>
}

/** Maps networkId to string name used in API calls */
export function networkIdToName(networkId: NetworkId): NetworkName {
  return networkId === 1 ? "mainnet" : "preprod"
}

/** bech32 change address (payment address) */
export async function getChangeAddress(api: WalletApi): Promise<string> {
  return api.getChangeAddress()
}

/** bech32 stake/reward addresses */
export async function getRewardAddresses(api: WalletApi): Promise<string[]> {
  return api.getRewardAddresses()
}

/**
 * UTxOs as CBOR hex strings — used as input to the backend tx builder.
 * Returns empty array if wallet has no UTxOs.
 */
export async function getUtxos(api: WalletApi): Promise<string[]> {
  const utxos = await api.getUtxos()
  return utxos ?? []
}

/** ADA balance as lovelace CBOR hex */
export async function getBalance(api: WalletApi): Promise<string> {
  return api.getBalance()
}

/** Collateral UTxOs (for Plutus script transactions) */
export async function getCollateral(api: WalletApi): Promise<string[]> {
  const collateral = await api.getCollateral?.({ amount: "5000000" })
  return collateral ?? []
}
