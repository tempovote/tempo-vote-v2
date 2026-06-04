"use client"

import { useWalletStore } from "@/store/wallet"
import { signTx, getUtxos, getChangeAddress, getRewardAddresses } from "@tempo/wallet-bridge"
import type { BuildTxRequest, BuildTxResponse } from "@tempo/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

export function useTx() {
  const { api, networkId } = useWalletStore()

  /**
   * Full flow: build (backend) → sign (wallet) → submit (backend)
   * Returns txHash on success, throws on error.
   */
  async function submitTx(txType: BuildTxRequest["txType"], params: Omit<BuildTxRequest, "txType" | "utxos" | "changeAddress" | "rewardAddress" | "network">): Promise<string> {
    if (!api) throw new Error("Wallet not connected")

    // 1. Collect wallet data needed by backend to build tx
    const [utxos, changeAddress, rewardAddresses] = await Promise.all([
      getUtxos(api),
      getChangeAddress(api),
      getRewardAddresses(api),
    ])

    // 2. Build unsigned tx on backend
    const buildReq: BuildTxRequest = {
      txType,
      utxos,
      changeAddress,
      rewardAddress: rewardAddresses[0] ?? "",
      network: networkId === 1 ? "mainnet" : "preprod",
      ...params,
    }

    const buildRes = await fetch(`${API_URL}/tx/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildReq),
    })

    if (!buildRes.ok) {
      const err = await buildRes.json().catch(() => ({ message: "Build failed" }))
      throw new Error(err.message ?? "Failed to build transaction")
    }

    const { unsignedTxCbor }: BuildTxResponse = await buildRes.json()

    // 3. Sign in wallet (private key never leaves the wallet)
    const signedTxCbor = await signTx(api, unsignedTxCbor)

    // 4. Submit via backend (which uses ogmios to submit)
    const submitRes = await fetch(`${API_URL}/tx/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedTx: signedTxCbor, network: networkId === 1 ? "mainnet" : "preprod" }),
    })

    if (!submitRes.ok) {
      const err = await submitRes.json().catch(() => ({ message: "Submit failed" }))
      throw new Error(err.message ?? "Failed to submit transaction")
    }

    const { txHash } = await submitRes.json()
    return txHash
  }

  return { submitTx, isReady: !!api }
}
