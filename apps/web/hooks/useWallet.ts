"use client"

import { useEffect, useCallback } from "react"
import { useWalletStore } from "@/store/wallet"
import type { DelegatedDrep } from "@/store/wallet"
import {
  connectWallet,
  getAvailableWallets,
  getNetworkId,
  getChangeAddress,
  getRewardAddresses,
  getDRepKey,
  hasCip95,
  isWalletEnabled,
  hexAddressToBech32,
} from "@tempo/wallet-bridge"

const STORAGE_KEY = "tempo:last_wallet"
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

/**
 * Fetch DRep registration + delegation status from the backend (Ogmios).
 *
 * On success  → calls setDRepStatus with confirmed on-chain data.
 * On failure  → calls setDRepStatusLoading(false), leaves isDrepRegistered=null
 *               so the UI can fall back to wallet-provided data (drepKey).
 */
async function fetchDRepStatus(
  drepId: string | null,
  stakeAddress: string | null,
  network: string,
  setDRepStatus: (data: { isDrepRegistered: boolean; drepName: string | null; delegatedDrep: DelegatedDrep | null }) => void,
  setDRepStatusError: (kind: "network" | "server") => void
): Promise<void> {
  let isDrepRegistered = false
  let drepName: string | null = null
  let delegatedDrep: DelegatedDrep | null = null
  let apiCallSucceeded = false
  let networkError = false

  try {
    // Step 1: Check if this wallet's DRep key is registered on-chain
    if (drepId) {
      const res = await fetch(`${API_URL}/dreps/${drepId}?network=${network}`, {
        signal: AbortSignal.timeout(8000),
      }).catch(() => { networkError = true; return null })

      if (res?.ok) {
        const data = await res.json().catch(() => null)
        if (data != null) {
          apiCallSucceeded = true
          isDrepRegistered = data.isRegistered === true
          drepName = data.name ?? null
        }
      }
    }

    // Step 2: If not a registered DRep, check delegation for this stake address
    if (!isDrepRegistered && stakeAddress) {
      const res = await fetch(
        `${API_URL}/stake/${encodeURIComponent(stakeAddress)}/delegation?network=${network}`,
        { signal: AbortSignal.timeout(8000) }
      ).catch(() => { networkError = true; return null })

      if (res?.ok) {
        const data = await res.json().catch(() => null)
        if (data != null) {
          apiCallSucceeded = true
          if (data?.delegatedDrep) {
            delegatedDrep = {
              id: data.delegatedDrep.id,
              name: data.delegatedDrep.name ?? null,
            }
          }
        }
      }
    }

    if (apiCallSucceeded) {
      setDRepStatus({ isDrepRegistered, drepName, delegatedDrep })
    } else {
      setDRepStatusError(networkError ? "network" : "server")
    }
  } catch {
    setDRepStatusError("network")
  }
}

export function useWallet() {
  const store = useWalletStore()

  /** Internal: fetch all wallet data after enabling */
  const _populate = useCallback(async (walletName: string) => {
    const api = await connectWallet(walletName)
    const networkId        = await getNetworkId(api)
    const changeAddressHex = await getChangeAddress(api)
    const rewardAddresses  = await getRewardAddresses(api)

    const changeAddress = hexAddressToBech32(changeAddressHex, networkId)
    const rewardAddress = rewardAddresses[0]
      ? hexAddressToBech32(rewardAddresses[0], networkId)
      : null

    const drepKey     = await getDRepKey(api).catch(() => null)
    const cip95Active = hasCip95(api)

    store.setWallet({
      api,
      name: walletName,
      networkId,
      changeAddress,
      rewardAddress,
      drepKey,
      hasCip95: cip95Active,
      isConnected: true,
    })

    try { localStorage.setItem(STORAGE_KEY, walletName) } catch { /* SSR safe */ }

    // Fire-and-forget: verify actual DRep/delegation status via Ogmios
    if (cip95Active) {
      const network = networkId === 1 ? "mainnet" : "preprod"
      const drepId  = drepKey?.dRepIDCip105 || null
      store.setDRepStatusLoading(true)
      fetchDRepStatus(drepId, rewardAddress, network, store.setDRepStatus, store.setDRepStatusError)
    }
  }, [store])

  /** User-initiated connect */
  const connect = useCallback(async (walletName: string) => {
    try {
      store.clearError()
      store.setConnecting(true)
      await _populate(walletName)
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Failed to connect wallet")
    } finally {
      store.setConnecting(false)
    }
  }, [store, _populate])

  /** Silent reconnect on page load — no popup if wallet already approved */
  const autoReconnect = useCallback(async () => {
    if (store.isConnected) return
    let savedWallet: string | null = null
    try { savedWallet = localStorage.getItem(STORAGE_KEY) } catch { return }
    if (!savedWallet) return

    const enabled = await isWalletEnabled(savedWallet).catch(() => false)
    if (!enabled) return

    try {
      await _populate(savedWallet)
    } catch {
      try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    }
  }, [store.isConnected, _populate])

  /** Disconnect — clear state + persisted key */
  const disconnect = useCallback(() => {
    store.reset()
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [store])

  useEffect(() => {
    autoReconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    ...store,
    connect,
    disconnect,
    autoReconnect,
    availableWallets: getAvailableWallets(),
  }
}
