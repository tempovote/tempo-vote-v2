import { create } from "zustand"
import type { WalletApi, NetworkId, DRepKey } from "@tempo/wallet-bridge"

export interface DelegatedDrep {
  id: string
  name: string | null
}

interface WalletState {
  api: WalletApi | null
  name: string | null
  networkId: NetworkId | null
  changeAddress: string | null
  rewardAddress: string | null
  drepKey: DRepKey | null
  drepName: string | null
  // null = not yet checked (loading or no CIP-95); true/false = confirmed by Ogmios
  isDrepRegistered: boolean | null
  delegatedDrep: DelegatedDrep | null
  drepStatusLoading: boolean
  // "network" = API server unreachable; "server" = Ogmios/backend error; null = no error
  drepStatusError: "network" | "server" | null
  hasCip95: boolean
  isConnected: boolean
  isConnecting: boolean
  // True while autoReconnect is in-flight after page reload (browser only)
  isWalletHydrating: boolean
  error: string | null
  walletBalance: { lovelace: number; ada: number; utxoCount: number } | null
  jwt: string | null
  // User-selected data network (independent of connected wallet's networkId)
  selectedNetwork: "mainnet" | "preprod"
  walletModalOpen: boolean
}

interface WalletActions {
  setWallet: (data: Omit<WalletState, "isConnecting" | "isWalletHydrating" | "error" | "isDrepRegistered" | "drepName" | "delegatedDrep" | "drepStatusLoading" | "drepStatusError" | "walletBalance" | "jwt" | "selectedNetwork" | "walletModalOpen">) => void
  setDRepStatus: (data: { isDrepRegistered: boolean; drepName: string | null; delegatedDrep: DelegatedDrep | null }) => void
  setDRepStatusLoading: (v: boolean) => void
  setDRepStatusError: (kind: "network" | "server") => void
  setWalletBalance: (b: { lovelace: number; ada: number; utxoCount: number } | null) => void
  setJwt: (token: string | null) => void
  setConnecting: (v: boolean) => void
  setWalletHydrating: (v: boolean) => void
  setError: (msg: string) => void
  clearError: () => void
  reset: () => void
  setSelectedNetwork: (network: "mainnet" | "preprod") => void
  initNetwork: () => void
  openWalletModal: () => void
  closeWalletModal: () => void
}

const NETWORK_STORAGE_KEY = "tempo:network"

const initialState: WalletState = {
  api: null,
  name: null,
  networkId: null,
  changeAddress: null,
  rewardAddress: null,
  drepKey: null,
  drepName: null,
  isDrepRegistered: null,
  delegatedDrep: null,
  drepStatusLoading: false,
  drepStatusError: null,
  hasCip95: false,
  isConnected: false,
  isConnecting: false,
  isWalletHydrating: false,
  error: null,
  walletBalance: null,
  jwt: null,
  selectedNetwork: "mainnet",
  walletModalOpen: false,
}

export const useWalletStore = create<WalletState & WalletActions>((set) => ({
  ...initialState,
  setWallet: (data) => set({
    ...data,
    isConnecting: false,
    error: null,
    // Auto-sync selected network to wallet's actual network
    selectedNetwork: data.networkId === 1 ? "mainnet" : "preprod",
  }),
  setDRepStatus: ({ isDrepRegistered, drepName, delegatedDrep }) =>
    set({ isDrepRegistered, drepName, delegatedDrep, drepStatusLoading: false, drepStatusError: null }),
  setDRepStatusLoading: (v) => set({ drepStatusLoading: v }),
  setDRepStatusError: (kind) => set({ drepStatusError: kind, drepStatusLoading: false }),
  setWalletBalance: (b) => set({ walletBalance: b }),
  setJwt: (token) => set({ jwt: token }),
  setConnecting: (v) => set({ isConnecting: v }),
  setWalletHydrating: (v) => set({ isWalletHydrating: v }),
  setError: (msg) => set({ error: msg, isConnecting: false }),
  clearError: () => set({ error: null }),
  // On disconnect: keep selectedNetwork so user can keep browsing the same network
  reset: () => set((state) => ({ ...initialState, selectedNetwork: state.selectedNetwork })),
  setSelectedNetwork: (network) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(NETWORK_STORAGE_KEY, network)
    }
    set({ selectedNetwork: network })
  },
  initNetwork: () => {
    if (typeof window === "undefined") return
    const stored = localStorage.getItem(NETWORK_STORAGE_KEY)
    if (stored === "mainnet" || stored === "preprod") {
      set({ selectedNetwork: stored })
    }
  },
  openWalletModal:  () => set({ walletModalOpen: true }),
  closeWalletModal: () => set({ walletModalOpen: false }),
}))
