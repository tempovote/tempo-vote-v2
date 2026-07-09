"use client"

import { useState } from "react"
import type { MouseEvent } from "react"
import { cn } from "../lib/utils"
import { copyToClipboard } from "../lib/clipboard"
import { truncateMiddle } from "../lib/format"

export interface CopyableIdProps {
  id: string
  className?: string
}

/** ID rút gọn dạng text, click để copy; hiện ✓ 1.5s. */
export function CopyableId({ id, className }: CopyableIdProps) {
  const [copied, setCopied] = useState(false)

  function copy(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    copyToClipboard(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button type="button" onClick={copy} title={id} className={cn("text-left", className)}>
      <span className="font-mono text-[11px] leading-tight text-muted-foreground-subtle transition-colors hover:text-muted-foreground">
        {truncateMiddle(id, 10, 7)}
        {copied && <span className="ml-1 text-[10px] text-success">✓</span>}
      </span>
    </button>
  )
}
