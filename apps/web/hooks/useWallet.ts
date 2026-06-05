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
 * Fetch DRep registration status + delegation info from the backend.
 * Runs in the background after wallet connect — never blocks the UI.
 *
 * Logic:
 *  1. If drepId provided → GET /dreps/{id} → check isRegistered + fetch name
 *  2. If not registered (or no drepId) + stakeAddress → GET /stake/{addr}/delegation
 */
async function fetchDRepStatus(
  drepId: string | null,
  stakeAddress: string | null,
  network: string,
  setDRepStatus: (data: { isDrepRegistered: boolean; drepName: string | null; delegatedDrep: DelegatedDrep | null }) => void
): Promise<void> {
  let isDrepRegistered = false
  let drepName: string | null = null
  let delegatedDrep: DelegatedDrep | null = null

  try {
    // Step 1: Check if this wallet's DRep key is actually registered on-chain
    if (drepId) {
      const res = await fetch(`${API_URL}/dreps/${drepId}?network=${network}`, {
        signal: AbortSignal.timeout(8000),
      }).catch(() => null)

      if (res?.ok) {
        const data = await res.json().catch(() => null)
        if (data) {
          isDrepRegistered = data.isRegistered === true
          drepName = data.name ?? null
        }
      }
    }

    // Step 2: If not a registered DRep, check what DRep this stake address delegated to
    if (!isDrepRegistered && stakeAddress) {
      const res = await fetch(`${API_URL}/stake/${encodeURIComponent(stakeAddress)}/delegation?network=${network}`, {
        signal: AbortSignal.timeout(8000),
      }).catch(() => null)

      if (res?.ok) {
        const data = await res.json().catch(() => null)
        if (data?.delegatedDrep) {
          delegatedDrep = {
            id: data.delegatedDrep.id,
            name: data.delegatedDrep.name ?? null,
          }
        }
      }
    }
  } catch {
    // Silent fail — UI will show CTA (not delegated state)
  }

  setDRepStatus({ isDrepRegistered, drepName, delegatedDrep })
}

export function useWallet() {
  const store = useWalletStore()

  /** Internal: fetch all wallet data after enabling */
  const _populate = useCallback(async (walletName: string) => {
    const api = await connectWallet(walletName)
    const networkId        = await getNetworkId(api)
    const changeAddressHex = await getChangeAddress(api)
    const rewardAddresses  = await getRewardAddresses(api)

    // Decode CIP-30 hex address → human-readable bech32 (addr1... / addr_test1...)
    const changeAddress = hexAddressToBech32(changeAddressHex, networkId)
    const rewardAddress = rewardAddresses[0]
      ? hexAddressToBech32(rewardAddresses[0], networkId)
      : null

    // Try to get DRep key (CIP-95). Null if wallet doesn't support it.
    const drepKey      = await getDRepKey(api).catch(() => null)
    const cip95Active  = hasCip95(api)

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

    // Persist wallet name for auto-reconnect
    try { localStorage.setItem(STORAGE_KEY, walletName) } catch { /* SSR safe */ }

    // Fire-and-forget: check actual DRep registration + delegation status via Ogmios
    if (cip95Active) {
      const network = networkId === 1 ? "mainnet" : "preprod"
      const drepId  = drepKey?.dRepIDCip105 || null
      store.setDRepStatusLoading(true)
      fetchDRepStatus(drepId, rewardAddress, network, store.setDRepStatus)
        .catch(() => store.setDRepStatusLoading(false))
    }
  }, [store])

  /** User-initiated connect — shows wallet popup */
  const connect = useCallback(async (walletName: string) => {
    try {
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
    if (store.isConnected) return          // already connected
    let savedWallet: string | null = null
    try { savedWallet = localStorage.getItem(STORAGE_KEY) } catch { return }
    if (!savedWallet) return

    // Check wallet is still installed + already enabled (no popup)
    const enabled = await isWalletEnabled(savedWallet).catch(() => false)
    if (!enabled) return

    try {
      await _populate(savedWallet)
    } catch {
      // Silent fail — user will connect manually
      try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    }
  }, [store.isConnected, _populate])

  /** Disconnect — clear state + persisted key */
  const disconnect = useCallback(() => {
    store.reset()
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [store])

  // Run auto-reconnect once on mount
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
