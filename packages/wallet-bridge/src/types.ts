/**
 * Raw CIP-30 wallet API (injected into window.cardano by wallet extensions)
 * Spec: https://cips.cardano.org/cip/CIP-30
 */
export interface Cip30Api {
  getNetworkId(): Promise<number>
  getUtxos(amount?: string, paginate?: Paginate): Promise<string[] | null>
  getBalance(): Promise<string>
  getUsedAddresses(paginate?: Paginate): Promise<string[]>
  getUnusedAddresses(): Promise<string[]>
  getChangeAddress(): Promise<string>
  getRewardAddresses(): Promise<string[]>
  signTx(tx: string, partialSign?: boolean): Promise<string>
  signData(addr: string, payload: string): Promise<DataSignature>
  submitTx(tx: string): Promise<string>
  getCollateral(params?: { amount: string }): Promise<string[] | null>
}

/**
 * CIP-95 extension — Conway governance
 * Spec: https://cips.cardano.org/cip/CIP-95
 */
export interface Cip95Extension {
  getPubDRepKey(): Promise<string>
  getDRepKey(): Promise<DRepKey>
  getUnregisteredPubStakeKeys(): Promise<PubStakeKey[]>
  getRegisteredPubStakeKeys(): Promise<PubStakeKey[]>
  signData(addr: string, payload: string): Promise<DataSignature>
}

export interface WalletApi extends Cip30Api {
  cip95?: Cip95Extension
}

export interface DRepKey {
  pubDRepKey: string        // hex encoded public key
  dRepIDCip105: string      // bech32 DRep ID (CIP-105 format: drep1...)
  dRepIDBech32?: string
}

export interface PubStakeKey {
  pubStakeKey: string
  pubStakeKeyHash: string
}

export interface DataSignature {
  signature: string
  key: string
}

export interface Paginate {
  page: number
  limit: number
}

export type NetworkId = 0 | 1  // 0 = testnet/preprod, 1 = mainnet

export type NetworkName = "preprod" | "mainnet"

export interface WalletInfo {
  name: string
  icon: string
  apiVersion: string
  isEnabled: () => Promise<boolean>
  enable: (options?: { extensions?: Array<{ cip: number }> }) => Promise<WalletApi>
}

/** window.cardano shape */
export type CardanoWindow = Record<string, WalletInfo>
