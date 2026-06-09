"use client"

import { useState } from "react"

interface Props {
  id: string
  className?: string
}

export default function CopyableId({ id, className = "" }: Props) {
  const [copied, setCopied] = useState(false)

  const truncated =
    id.length > 20 ? `${id.slice(0, 10)}…${id.slice(-7)}` : id

  function copy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button onClick={copy} title={id} className={`text-left ${className}`}>
      <span className="font-mono text-[11px] text-text-muted hover:text-text-secondary transition-colors leading-tight">
        {truncated}
        {copied && <span className="ml-1 text-success text-[10px]">✓</span>}
      </span>
    </button>
  )
}
