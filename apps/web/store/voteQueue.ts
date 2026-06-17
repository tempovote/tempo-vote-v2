import { create } from "zustand"

export type VoteChoice = "YES" | "NO" | "ABSTAIN"

export interface VoteQueueItem {
  ga: {
    txHash: string
    index: number
    title: string
    actionType: string
  }
  choice: VoteChoice
  rationale: string
}

export function queueKey(txHash: string, index: number): string {
  return `${txHash}#${index}`
}

interface VoteQueueState {
  items: Record<string, VoteQueueItem>
  panelOpen: boolean
}

interface VoteQueueActions {
  addOrUpdate: (item: VoteQueueItem) => void
  remove: (key: string) => void
  setRationale: (key: string, rationale: string) => void
  clearAll: () => void
  openPanel: () => void
  closePanel: () => void
  togglePanel: () => void
}

export const useVoteQueue = create<VoteQueueState & VoteQueueActions>((set) => ({
  items: {},
  panelOpen: false,

  addOrUpdate: (item) =>
    set((state) => ({
      items: {
        ...state.items,
        [queueKey(item.ga.txHash, item.ga.index)]: {
          ...item,
          // preserve rationale if already in queue for this GA
          rationale: state.items[queueKey(item.ga.txHash, item.ga.index)]?.rationale ?? item.rationale,
        },
      },
      panelOpen: true,
    })),

  remove: (key) =>
    set((state) => {
      const { [key]: _, ...rest } = state.items
      return { items: rest }
    }),

  setRationale: (key, rationale) =>
    set((state) => {
      const item = state.items[key]
      if (!item) return state
      return { items: { ...state.items, [key]: { ...item, rationale } } }
    }),

  clearAll: () => set({ items: {} }),
  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
}))
