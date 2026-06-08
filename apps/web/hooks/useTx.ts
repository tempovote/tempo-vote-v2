"use client"

import { useWalletStore } from "@/store/wallet"
import { signTx, getUtxos, getChangeAddress, getRewardAddresses, getCollateral, hexAddressToBech32 } from "@tempo/wallet-bridge"
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
    // CIP-30 returns hex CBOR addresses — convert to bech32 for cardano-client-lib
    const [utxos, changeAddressRaw, rewardAddressesRaw, collateral] = await Promise.all([
      getUtxos(api),
      getChangeAddress(api),
      getRewardAddresses(api),
      getCollateral(api),
    ])
    const net = networkId ?? 0
    const changeAddress = hexAddressToBech32(changeAddressRaw, net)
    const rewardAddress = rewardAddressesRaw[0]
      ? hexAddressToBech32(rewardAddressesRaw[0], net)
      : ""

    // 2. Build unsigned tx on backend
    // If wallet doesn't expose a dedicated collateral UTxO, fall back to the
    // first available UTxO — same CBOR format, valid for collateral purposes.
    const effectiveCollateral = collateral.length > 0 ? collateral : utxos.slice(0, 1)

    const buildReq: BuildTxRequest = {
      txType,
      utxos,
      changeAddress,
      rewardAddress,
      network: networkId === 1 ? "mainnet" : "preprod",
      collateral: effectiveCollateral.length > 0 ? effectiveCollateral : undefined,
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

    // 3. Sign in wallet — CIP-30 signTx returns the transaction_witness_set
    const witnessSetCbor = await signTx(api, unsignedTxCbor, false)

    // 4. Send unsigned TX + witness set to backend for assembly + Ogmios submit
    // Backend assembles the full signed TX (body + witnesses) before submitting
    const submitRes = await fetch(`${API_URL}/tx/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unsignedTxCbor,
        witnessSetCbor,
        network: networkId === 1 ? "mainnet" : "preprod",
      }),
    })

    if (!submitRes.ok) {
      const err = await submitRes.json().catch(() => ({ message: "Submit failed" }))
      throw new Error(err.message ?? "Failed to submit transaction")
    }

    const { txHash } = await submitRes.json()
    if (!txHash) throw new Error("Submit returned null txHash")
    return txHash
  }

  return { submitTx, isReady: !!api }
}
