"use client"

import { useState } from "react"
import { cn } from "../lib/utils"
import { copyToClipboard } from "../lib/clipboard"

export interface CopyButtonProps {
  value: string
  /** Tooltip (i18n-free — app truyền text đã dịch) */
  title: string
  /** icon size px (default 13) */
  size?: number
  className?: string
}

/** Nút copy inline đặt ngay sau ID/hash. Hiện checkmark xanh 1.5s sau khi copy. */
export function CopyButton({ value, title, size = 13, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        copyToClipboard(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      title={title}
      className={cn(
        "ml-1.5 inline-flex align-middle text-muted-foreground-subtle transition-colors hover:text-primary-light",
        className
      )}
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
