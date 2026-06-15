"use client"

import { useState } from "react"
import { copyToClipboard } from "@/lib/clipboard"

interface Props {
  value: string
  title: string
  /** icon size in px (default 13) */
  size?: number
  /** override hover colour class (default accent-light) */
  className?: string
}

/**
 * Inline copy button that sits right after an ID/hash.
 * Shows a green checkmark for 1.5s after copying.
 */
export function CopyIconButton({ value, title, size = 13, className = "hover:text-accent-light" }: Props) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        copyToClipboard(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      title={title}
      className={`inline-flex align-middle ml-1.5 text-text-muted transition-colors ${className}`}
    >
      {copied ? (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
          <polyline points="20,6 9,17 4,12" />
        </svg>
      ) : (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  )
}
