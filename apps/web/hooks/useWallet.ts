"use client"

import { useEffect, useCallback, useState } from "react"
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
  signData,
} from "@tempo/wallet-bridge"
import type { WalletApi } from "@tempo/wallet-bridge"

const STORAGE_KEY = "tempo:last_wallet"
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

async function fetchWalletBalance(
  address: string,
  network: string,
  setWalletBalance: (b: { lovelace: number; ada: number; utxoCount: number } | null) => void,
  signal: AbortSignal
): Promise<void> {
  try {
    const res = await fetch(
      `${API_URL}/wallet/balance?address=${encodeURIComponent(address)}&network=${network}`,
      { signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) }
    )
    if (!res.ok || signal.aborted) return
    const data = await res.json().catch(() => null)
    if (data && typeof data.lovelace === "number") {
      setWalletBalance({ lovelace: data.lovelace, ada: data.ada, utxoCount: data.utxoCount })
    }
  } catch {
    // balance is optional — silently ignore failures
  }
}

let _fetchController: AbortController | null = null
let _balanceController: AbortController | null = null
let _authController: AbortController | null = null

async function fetchWalletAuth(
  api: WalletApi,
  rewardAddressHex: string,
  rewardAddressBech32: string,
  network: string,
  drepId: string | null,
  setJwt: (token: string | null) => void,
  signal: AbortSignal
): Promise<void> {
  try {
    // Step 1: Get challenge nonce
    const challengeRes = await fetch(
      `${API_URL}/auth/challenge?stakeAddress=${encodeURIComponent(rewardAddressBech32)}&network=${network}`,
      { signal }
    )
    if (!challengeRes.ok || signal.aborted) return
    const { nonce } = await challengeRes.json()
    if (!nonce || signal.aborted) return

    // Step 2: Sign nonce with wallet stake key
    // nonce is a 64-char hex string (32 raw bytes); pass as-is to signData (CIP-30 expects hex payload)
    const dataSignature = await signData(api, rewardAddressHex, nonce)
    if (signal.aborted) return

    // Step 3: Verify on backend → receive JWT
    const verifyRes = await fetch(`${API_URL}/auth/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stakeAddress: rewardAddressBech32,
        network,
        nonce,
        signature: dataSignature.signature,
        key: dataSignature.key,
        drepId: drepId ?? undefined,
      }),
      signal,
    })
    if (!verifyRes.ok || signal.aborted) return
    const { jwt } = await verifyRes.json()
    if (jwt && !signal.aborted) setJwt(jwt)
  } catch {
    // auth is optional — silently ignore (user might reject signing)
  }
}

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

  // True while autoReconnect hasn't finished — prevents "Kết nối ví" guard
  // from flashing on pages that require an authenticated wallet (update, retire).
  // Must start as false so SSR and first client render match (no hydration error).
  // A separate useEffect (below) sets it to true right after mount if a reconnect
  // is expected, before autoReconnect's async work begins.
  const [isWalletHydrating, setIsWalletHydrating] = useState(false)

  /** Internal: fetch all wallet data after enabling */
  const _populate = useCallback(async (walletName: string) => {
    const api = await connectWallet(walletName)
    const networkId        = await getNetworkId(api)
    const changeAddressHex = await getChangeAddress(api)
    const rewardAddresses  = await getRewardAddresses(api)

    const rewardAddressHex  = rewardAddresses[0] ?? null
    const changeAddress     = hexAddressToBech32(changeAddressHex, networkId)
    const rewardAddress     = rewardAddressHex
      ? hexAddressToBech32(rewardAddressHex, networkId)
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

    const network = networkId === 1 ? "mainnet" : "preprod"
    const drepId  = drepKey?.dRepIDCip105 ?? null

    // Fire-and-forget: wallet balance via Kupo
    _balanceController?.abort()
    _balanceController = new AbortController()
    fetchWalletBalance(changeAddress, network, store.setWalletBalance, _balanceController.signal)

    // Fire-and-forget: wallet auth (challenge → sign → JWT) — requires stake address
    if (rewardAddressHex && rewardAddress) {
      _authController?.abort()
      _authController = new AbortController()
      fetchWalletAuth(api, rewardAddressHex, rewardAddress, network, drepId, store.setJwt, _authController.signal)
    }

    // Fire-and-forget: DRep / delegation status via Ogmios (CIP-95 only).
    if (cip95Active) {
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
    try {
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
    } finally {
      setIsWalletHydrating(false)
    }
  }, [store.isConnected, _populate])

  /** Disconnect — cancel in-flight fetches, clear state + persisted key */
  const disconnect = useCallback(() => {
    _fetchController?.abort()
    _fetchController = null
    _balanceController?.abort()
    _balanceController = null
    _authController?.abort()
    _authController = null
    store.reset()
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
  }, [store])

  // Must be defined BEFORE the autoReconnect effect so it runs first.
  // Sets hydrating=true synchronously (after mount) when a reconnect is expected,
  // so the spinner renders before autoReconnect's async work finishes.
  useEffect(() => {
    try {
      if (!store.isConnected && localStorage.getItem(STORAGE_KEY)) {
        setIsWalletHydrating(true)
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    autoReconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    ...store,
    connect,
    disconnect,
    autoReconnect,
    isWalletHydrating,
    availableWallets: getAvailableWallets(),
  }
}
