import type { WalletApi, DataSignature } from "./types"

/**
 * Sign a transaction CBOR with the wallet.
 * @param api           connected wallet API
 * @param unsignedTxCbor hex-encoded unsigned transaction CBOR (from backend /tx/build)
 * @param partialSign   set true for multi-sig — wallet only adds its own witnesses
 * @returns signed transaction CBOR hex
 */
export async function signTx(
  api: WalletApi,
  unsignedTxCbor: string,
  partialSign = false
): Promise<string> {
  return api.signTx(unsignedTxCbor, partialSign)
}

/**
 * Sign arbitrary data for authentication (CIP-30 signData).
 * Used for wallet auth: backend issues a nonce, client signs it.
 *
 * @param api     connected wallet API
 * @param address bech32 address (must be owned by wallet)
 * @param payload hex-encoded data to sign
 * @returns { signature, key } — send to backend for verification
 */
export async function signData(
  api: WalletApi,
  address: string,
  payload: string
): Promise<DataSignature> {
  return api.signData(address, payload)
}

/**
 * Submit a signed transaction directly from the wallet (bypass backend submit).
 * Alternative to POST /tx/submit when you want the wallet to handle submission.
 *
 * @returns txHash
 */
export async function submitTx(api: WalletApi, signedTxCbor: string): Promise<string> {
  return api.submitTx(signedTxCbor)
}
