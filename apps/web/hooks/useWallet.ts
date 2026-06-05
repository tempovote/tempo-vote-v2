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

// Cancels any in-flight fetchDRepStatus when a new wallet connect starts.
// Module-level because there is only one active wallet at a time.
let _fetchController: AbortController | null = null

/**
 * Fetch DRep registration + delegation status from the backend (Ogmios).
 *
 * Steps 1 and 2 run in parallel to minimise latency.
 * An AbortSignal is accepted so a new connect can cancel a stale in-flight call.
 */
async function fetchDRepStatus(
  drepId: string | null,
  stakeAddress: string | null,
  network: string,
  setDRepStatus: (data: { isDrepRegistered: boolean; drepName: string | null; delegatedDrep: DelegatedDrep | null }) => void,
  setDRepStatusError: (kind: "network" | "server") => void,
  signal: AbortSignal
): Promise<void> {
  let networkError = false

  // TypeError = connection refused; AbortError/TimeoutError = server slow or call cancelled
  const safeFetch = (url: string) =>
    fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(25000)]) })
      .catch((err: unknown) => {
        if (err instanceof TypeError) networkError = true
        return null
      })

  try {
    // Step 1 (DRep registration) and Step 2 (delegation) run in parallel.
    // This halves latency vs sequential awaits for non-DRep wallets.
    const [step1Res, step2Res] = await Promise.all([
      drepId
        ? safeFetch(`${API_URL}/dreps/${drepId}?network=${network}`)
        : Promise.resolve(null),
      stakeAddress
        ? safeFetch(`${API_URL}/stake/${encodeURIComponent(stakeAddress)}/delegation?network=${network}`)
        : Promise.resolve(null),
    ])

    // Abort guard: a new connect may have fired while we were waiting
    if (signal.aborted) return

    // Parse Step 1
    let isDrepRegistered = false
    let drepName: string | null = null
    let step1Succeeded = false

    if (step1Res?.ok) {
      const data = await step1Res.json().catch(() => null)
      if (data != null) {
        step1Succeeded = true
        isDrepRegistered = data.isRegistered === true
        drepName = data.name ?? null
      }
    }

    if (signal.aborted) return

    // Registered DRep — delegation check not needed
    if (isDrepRegistered) {
      setDRepStatus({ isDrepRegistered: true, drepName, delegatedDrep: null })
      return
    }

    // No stake address — cannot check delegation
    if (!stakeAddress) {
      step1Succeeded
        ? setDRepStatus({ isDrepRegistered: false, drepName: null, delegatedDrep: null })
        : setDRepStatusError(networkError ? "network" : "server")
      return
    }

    // Parse Step 2 — mandatory to distinguish "not delegated" from "query failed"
    if (step2Res?.ok) {
      const data = await step2Res.json().catch(() => null)
      if (data != null) {
        if (signal.aborted) return
        const drepData = data?.delegatedDrep
        const delegatedDrep: DelegatedDrep | null = drepData
          ? { id: drepData.id, name: drepData.name ?? null }
          : null

        // Show delegation status immediately — name may be null (backend omits it for speed)
        setDRepStatus({ isDrepRegistered: false, drepName: null, delegatedDrep })

        // Background-fetch the DRep name via /dreps/{id} (served from cache after first hit)
        if (delegatedDrep && !delegatedDrep.name) {
          safeFetch(`${API_URL}/dreps/${encodeURIComponent(delegatedDrep.id)}?network=${network}`)
            .then(res => res?.json().catch(() => null))
            .then(nameData => {
              if (signal.aborted) return
              const name: string | null = nameData?.name ?? null
              if (name) {
                setDRepStatus({
                  isDrepRegistered: false,
                  drepName: null,
                  delegatedDrep: { id: delegatedDrep.id, name },
                })
              }
            })
            .catch(() => { /* name is optional — ignore failures */ })
        }
        return
      }
    }

    // Step 2 failed — cannot confirm delegation status
    setDRepStatusError(networkError ? "network" : "server")
  } catch (err: unknown) {
    if (signal.aborted) return
    setDRepStatusError(err instanceof TypeError ? "network" : "server")
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

    // Fire-and-forget: verify actual DRep/delegation status via Ogmios.
    // Cancel any previous in-flight call to prevent stale results overwriting fresh ones.
    if (cip95Active) {
      const network = networkId === 1 ? "mainnet" : "preprod"
      const drepId  = drepKey?.dRepIDCip105 || null

      _fetchController?.abort()
      _fetchController = new AbortController()

      store.setDRepStatusLoading(true)
      fetchDRepStatus(drepId, rewardAddress, network, store.setDRepStatus, store.setDRepStatusError, _fetchController.signal)
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

  /** Disconnect — cancel in-flight status fetch, clear state + persisted key */
  const disconnect = useCallback(() => {
    _fetchController?.abort()
    _fetchController = null
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
