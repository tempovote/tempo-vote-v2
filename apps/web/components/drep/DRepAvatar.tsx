"use client"

import { useState } from "react"

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
]

function resolveIpfsSrc(url: string, gwIdx: number): string {
  if (url.startsWith("ipfs://")) {
    return IPFS_GATEWAYS[Math.min(gwIdx, IPFS_GATEWAYS.length - 1)]! + url.slice(7)
  }
  for (const gw of IPFS_GATEWAYS) {
    if (url.startsWith(gw)) {
      return IPFS_GATEWAYS[Math.min(gwIdx, IPFS_GATEWAYS.length - 1)]! + url.slice(gw.length)
    }
  }
  return url
}

const PALETTES: [string, string][] = [
  ["#6366f1", "#a855f7"],
  ["#14b8a6", "#6366f1"],
  ["#f59e0b", "#ef4444"],
  ["#10b981", "#14b8a6"],
  ["#ec4899", "#a855f7"],
  ["#3b82f6", "#6366f1"],
]

function gradientFromHex(credHex: string): string {
  const idx = parseInt(credHex.slice(0, 2), 16) % PALETTES.length
  const [a, b] = PALETTES[idx]!
  return `linear-gradient(135deg, ${a}, ${b})`
}

interface Props {
  name: string | null
  imageUrl: string | null | undefined
  credHex: string
  size?: "sm" | "md"
}

export default function DRepAvatar({ name, imageUrl, credHex, size = "md" }: Props) {
  const [gwIdx, setGwIdx] = useState(0)

  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : "w-10 h-10 text-sm"
  const initial = (name ? name.charAt(0) : credHex.charAt(5)).toUpperCase()

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolveIpfsSrc(imageUrl, gwIdx)}
        alt={name ?? "DRep"}
        className={`${sizeClass} rounded-full object-cover border border-border-subtle shrink-0`}
        onError={() => {
          if (gwIdx < IPFS_GATEWAYS.length - 1) setGwIdx((i) => i + 1)
        }}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
      style={{ background: gradientFromHex(credHex) }}
    >
      {initial}
    </div>
  )
}
