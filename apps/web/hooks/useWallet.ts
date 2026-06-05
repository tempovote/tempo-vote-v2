"use client"

import { useEffect, useCallback } from "react"
import { useWalletStore } from "@/store/wallet"
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

export function useWallet() {
  const store = useWalletStore()

  /** Internal: fetch all wallet data after enabling */
  const _populate = useCallback(async (walletName: string) => {
    const api = await connectWallet(walletName)
    const networkId       = await getNetworkId(api)
    const changeAddressHex = await getChangeAddress(api)
    const rewardAddresses  = await getRewardAddresses(api)

    // Decode CIP-30 hex address → human-readable bech32 (addr1... / addr_test1...)
    const changeAddress = hexAddressToBech32(changeAddressHex, networkId)
    const rewardAddress = rewardAddresses[0]
      ? hexAddressToBech32(rewardAddresses[0], networkId)
      : null

    // Try to get DRep key (CIP-95). Null if wallet doesn't support it or user hasn't set it up.
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

    // Persist wallet name for auto-reconnect
    try { localStorage.setItem(STORAGE_KEY, walletName) } catch { /* SSR safe */ }
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
