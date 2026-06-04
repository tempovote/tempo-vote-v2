"use client"

import { useEffect } from "react"
import { useWalletStore } from "@/store/wallet"
import {
  connectWallet,
  disconnectWallet,
  getAvailableWallets,
  getNetworkId,
  getChangeAddress,
  getRewardAddresses,
  getUtxos,
  getDRepKey,
  type WalletApi,
  type NetworkId,
} from "@tempo/wallet-bridge"

export function useWallet() {
  const store = useWalletStore()

  async function connect(walletName: string) {
    try {
      store.setConnecting(true)
      const api = await connectWallet(walletName)
      const networkId = await getNetworkId(api)
      const changeAddress = await getChangeAddress(api)
      const rewardAddresses = await getRewardAddresses(api)
      const drepKey = await getDRepKey(api).catch(() => null)

      store.setWallet({
        api,
        name: walletName,
        networkId,
        changeAddress,
        rewardAddress: rewardAddresses[0] ?? null,
        drepKey,
        isConnected: true,
      })
    } catch (err) {
      store.setError(err instanceof Error ? err.message : "Failed to connect wallet")
    } finally {
      store.setConnecting(false)
    }
  }

  function disconnect() {
    store.reset()
  }

  const availableWallets = getAvailableWallets()

  return {
    ...store,
    connect,
    disconnect,
    availableWallets,
  }
}
