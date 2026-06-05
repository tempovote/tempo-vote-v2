import { create } from "zustand"
import type { WalletApi, NetworkId, DRepKey } from "@tempo/wallet-bridge"

interface WalletState {
  api: WalletApi | null
  name: string | null
  networkId: NetworkId | null
  changeAddress: string | null
  rewardAddress: string | null
  drepKey: DRepKey | null
  hasCip95: boolean
  isConnected: boolean
  isConnecting: boolean
  error: string | null
}

interface WalletActions {
  setWallet: (data: Omit<WalletState, "isConnecting" | "error">) => void
  setConnecting: (v: boolean) => void
  setError: (msg: string) => void
  reset: () => void
}

const initialState: WalletState = {
  api: null,
  name: null,
  networkId: null,
  changeAddress: null,
  rewardAddress: null,
  drepKey: null,
  hasCip95: false,
  isConnected: false,
  isConnecting: false,
  error: null,
}

export const useWalletStore = create<WalletState & WalletActions>((set) => ({
  ...initialState,
  setWallet: (data) => set({ ...data, isConnecting: false, error: null }),
  setConnecting: (v) => set({ isConnecting: v }),
  setError: (msg) => set({ error: msg, isConnecting: false }),
  reset: () => set(initialState),
}))
