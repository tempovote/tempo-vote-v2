"use client"

import { useCallback, useState } from "react"
import type { MouseEvent } from "react"
import { cn } from "../lib/utils"
import { copyToClipboard } from "../lib/clipboard"
import { govActionIdToBech32 } from "../lib/gov-action-id"

export interface ActionIdChipProps {
  txHash: string
  index: number
  /** "sm" cho card (rút gọn nhiều), "md" cho trang detail */
  size?: "sm" | "md"
  /** Title nút copy theo mode hiện tại (i18n-free); mặc định "Copy <mode>" */
  copyTitle?: (mode: "hex" | "bech32") => string
  className?: string
}

export function ActionIdChip({ txHash, index, size = "sm", copyTitle, className }: ActionIdChipProps) {
  const [mode, setMode] = useState<"hex" | "bech32">("hex")
  const [copied, setCopied] = useState(false)

  const bech32Id = govActionIdToBech32(txHash, index)
  const hexFull = `${txHash}#${index}`

  const shortHex = `${txHash.slice(0, 8)}…${txHash.slice(-8)}#${index}`
  const shortBech32 = bech32Id ? `${bech32Id.slice(0, 14)}…${bech32Id.slice(-6)}` : ""
  const medHex = `${txHash.slice(0, 16)}…${txHash.slice(-12)}#${index}`
  const medBech32 = bech32Id ? `${bech32Id.slice(0, 22)}…${bech32Id.slice(-8)}` : ""

  const display = size === "md" ? (mode === "hex" ? medHex : medBech32) : (mode === "hex" ? shortHex : shortBech32)
  const fullValue = mode === "hex" ? hexFull : bech32Id

  const copy = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!fullValue) return
      copyToClipboard(fullValue)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    },
    [fullValue]
  )

  const toggle = useCallback((e: MouseEvent, next: "hex" | "bech32") => {
    e.preventDefault()
    e.stopPropagation()
    setMode(next)
  }, [])

  return (
    <div className={cn("flex items-start gap-2", className)} onClick={(e) => e.preventDefault()}>
      {/* Toggle pill */}
      <div className="mt-0.5 flex shrink-0 items-center overflow-hidden rounded-full border border-border-subtle bg-secondary text-xs">
        {(["hex", "bech32"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={(e) => toggle(e, m)}
            className={cn(
              "px-2.5 py-0.5 font-mono transition-colors",
              mode === m
                ? "bg-primary/20 font-semibold text-primary-light"
                : "text-muted-foreground-subtle hover:text-muted-foreground"
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Value */}
      <span
        className={cn(
          "mt-0.5 min-w-0 break-all font-mono text-muted-foreground",
          size === "md" ? "text-sm" : "text-xs"
        )}
      >
        {display}
      </span>

      {/* Copy button */}
      <button
        type="button"
        onClick={copy}
        title={copyTitle ? copyTitle(mode) : `Copy ${mode}`}
        className="mt-0.5 shrink-0 text-muted-foreground-subtle transition-colors hover:text-primary-light"
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
