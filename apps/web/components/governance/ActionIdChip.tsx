"use client"

import { useState, useCallback } from "react"
import { govActionIdToBech32 } from "@/lib/governance"
import { copyToClipboard } from "@/lib/clipboard"
import { useT } from "@/i18n/useT"

interface Props {
  txHash: string
  index: number
  /** "sm" for card (truncated), "md" for detail page (more visible) */
  size?: "sm" | "md"
}

export function ActionIdChip({ txHash, index, size = "sm" }: Props) {
  const t = useT()
  const [mode, setMode] = useState<"hex" | "bech32">("hex")
  const [copied, setCopied] = useState(false)

  const bech32Id = govActionIdToBech32(txHash, index)
  const hexFull  = `${txHash}#${index}`

  const shortHex    = `${txHash.slice(0, 8)}…${txHash.slice(-8)}#${index}`
  const shortBech32 = bech32Id ? `${bech32Id.slice(0, 14)}…${bech32Id.slice(-6)}` : ""
  const medHex      = `${txHash.slice(0, 16)}…${txHash.slice(-12)}#${index}`
  const medBech32   = bech32Id ? `${bech32Id.slice(0, 22)}…${bech32Id.slice(-8)}` : ""

  const display   = size === "md"
    ? (mode === "hex" ? medHex    : medBech32)
    : (mode === "hex" ? shortHex  : shortBech32)
  const fullValue = mode === "hex" ? hexFull : bech32Id

  const copy = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!fullValue) return
    copyToClipboard(fullValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [fullValue])

  const toggle = useCallback((e: React.MouseEvent, next: "hex" | "bech32") => {
    e.preventDefault()
    e.stopPropagation()
    setMode(next)
  }, [])

  return (
    <div
      className="flex items-start gap-2"
      onClick={(e) => e.preventDefault()}
    >
      {/* Toggle pill */}
      <div className="flex items-center bg-bg-secondary rounded-full border border-border-subtle overflow-hidden text-xs shrink-0 mt-0.5">
        {(["hex", "bech32"] as const).map((m) => (
          <button
            key={m}
            onClick={(e) => toggle(e, m)}
            className={`px-2.5 py-0.5 transition-colors font-mono ${
              mode === m
                ? "bg-accent/20 text-accent-light font-semibold"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Value */}
      <span className={`font-mono text-text-secondary min-w-0 break-all ${size === "md" ? "text-sm" : "text-xs"} mt-0.5`}>
        {display}
      </span>

      {/* Copy button */}
      <button
        onClick={copy}
        title={t("governance.card.copyId", { mode })}
        className="text-text-muted hover:text-accent-light transition-colors shrink-0 mt-0.5"
      >
        {copied ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
            <polyline points="20,6 9,17 4,12" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>
    </div>
  )
}
