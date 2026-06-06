"use client"

import { useWalletStore } from "@/store/wallet"
import GovernanceActionCard from "./GovernanceActionCard"
import { useGovernanceActions } from "@/hooks/useGovernanceActions"

export default function GovernancePreview() {
  const network = useWalletStore((s) => s.selectedNetwork)
  const { actions, isLoading } = useGovernanceActions(network)

  if (isLoading) {
    return <div className="card-static animate-pulse h-52 rounded-xl bg-bg-card" />
  }

  const first = actions[0]
  if (!first) return null

  return <GovernanceActionCard action={first} />
}
