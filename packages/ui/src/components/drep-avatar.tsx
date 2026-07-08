"use client"

import { useState } from "react"
import { cn } from "../lib/utils"

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

function hashToColors(str: string): [string, string] {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  const hue1 = (h >>> 0) % 360
  return [`hsl(${hue1},65%,55%)`, `hsl(${(hue1 + 137) % 360},65%,45%)`]
}

export interface DRepAvatarProps {
  /** Seed cho gradient fallback (DRep ID / credential hex) */
  id: string
  name?: string | null
  imageUrl?: string | null
  /** px (default 40) */
  size?: number
  className?: string
}

export function DRepAvatar({ id, name, imageUrl, size = 40, className }: DRepAvatarProps) {
  const [colors] = useState(() => hashToColors(id))
  const [gwIdx, setGwIdx] = useState(0)
  const initial = (name ?? id).charAt(0).toUpperCase()

  const src = imageUrl && gwIdx < IPFS_GATEWAYS.length ? resolveIpfsSrc(imageUrl, gwIdx) : null

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? "DRep"}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full border border-border-subtle object-cover", className)}
        style={{ width: size, height: size }}
        onError={() => setGwIdx((i) => i + 1)}
      />
    )
  }

  return (
    <div
      className={cn("flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
      }}
    >
      {initial}
    </div>
  )
}
