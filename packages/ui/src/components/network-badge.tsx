import { cn } from "../lib/utils"

const NETWORK_STYLES = {
  mainnet: { badge: "border-success/30 bg-success/12 text-success", dot: "bg-success", label: "Mainnet" },
  preprod: { badge: "border-warning/30 bg-warning/12 text-warning", dot: "bg-warning", label: "Preprod" },
} as const

export interface NetworkBadgeProps {
  network: "mainnet" | "preprod"
  className?: string
}

export function NetworkBadge({ network, className }: NetworkBadgeProps) {
  const s = NETWORK_STYLES[network]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wider",
        s.badge,
        className
      )}
    >
      <span className={cn("inline-block size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  )
}
