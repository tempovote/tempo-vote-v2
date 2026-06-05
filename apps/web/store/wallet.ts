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
  hasCip95: boolean
  isConnected: boolean
  isConnecting: boolean
  error: string | null
}

interface WalletActions {
  setWallet: (data: Omit<WalletState, "isConnecting" | "error" | "isDrepRegistered" | "drepName" | "delegatedDrep" | "drepStatusLoading">) => void
  setDRepStatus: (data: { isDrepRegistered: boolean; drepName: string | null; delegatedDrep: DelegatedDrep | null }) => void
  setDRepStatusLoading: (v: boolean) => void
  setConnecting: (v: boolean) => void
  setError: (msg: string) => void
  clearError: () => void
  reset: () => void
}

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
  hasCip95: false,
  isConnected: false,
  isConnecting: false,
  error: null,
}

export const useWalletStore = create<WalletState & WalletActions>((set) => ({
  ...initialState,
  setWallet: (data) => set({ ...data, isConnecting: false, error: null }),
  setDRepStatus: ({ isDrepRegistered, drepName, delegatedDrep }) =>
    set({ isDrepRegistered, drepName, delegatedDrep, drepStatusLoading: false }),
  setDRepStatusLoading: (v) => set({ drepStatusLoading: v }),
  setConnecting: (v) => set({ isConnecting: v }),
  setError: (msg) => set({ error: msg, isConnecting: false }),
  clearError: () => set({ error: null }),
  reset: () => set(initialState),
}))
