"use client"

import { useState } from "react"
import { marked } from "marked"
import { cn } from "../lib/utils"
import "../styles/markdown-editor.css"

export interface MarkdownEditorLabels {
  write: string
  preview: string
  /** Text hiện khi preview rỗng */
  empty: string
  /** Counter (vd (n) => `${n} ký tự còn lại`) — chỉ hiện khi có maxLength */
  charsRemaining?: (count: string) => string
}

export interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  labels: MarkdownEditorLabels
  placeholder?: string
  rows?: number
  id?: string
  maxLength?: number
  className?: string
}

export function MarkdownEditor({ value, onChange, labels, placeholder, rows = 5, id, maxLength, className }: MarkdownEditorProps) {
  const [tab, setTab] = useState<"write" | "preview">("write")
  const remaining = maxLength !== undefined ? maxLength - value.length : null
  const isOver = remaining !== null && remaining < 0

  const html = value.trim() ? (marked.parse(value, { async: false }) as string) : ""

  const tabCls = (active: boolean) =>
    cn(
      "px-4 py-2 text-xs font-medium transition-colors",
      active
        ? "-mb-px border-b-2 border-primary text-foreground"
        : "text-muted-foreground-subtle hover:text-muted-foreground"
    )

  return (
    <div className={cn("overflow-hidden rounded-card border border-border-subtle bg-popover", className)}>
      {/* Tab bar */}
      <div className="flex border-b border-border-subtle">
        <button type="button" onClick={() => setTab("write")} className={tabCls(tab === "write")}>
          {labels.write}
        </button>
        <button type="button" onClick={() => setTab("preview")} className={tabCls(tab === "preview")}>
          {labels.preview}
        </button>
        <div className="flex-1" />
        <span className="select-none px-3 py-2 text-xs text-muted-foreground-subtle opacity-50">Markdown</span>
      </div>

      {/* Write */}
      {tab === "write" && (
        <textarea
          id={id}
          rows={rows}
          value={value}
          onChange={(e) => {
            const v = e.target.value
            if (maxLength !== undefined && v.length > maxLength + 50) return
            onChange(v)
          }}
          placeholder={placeholder}
          className="w-full resize-none bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground-subtle"
        />
      )}

      {/* Preview */}
      {tab === "preview" && (
        <div
          className="tempo-markdown-preview px-4 py-3 text-sm leading-relaxed text-foreground"
          style={{ minHeight: `${rows * 1.6}rem` }}
        >
          {value.trim() ? (
            // marked output — backend lưu raw markdown, không có đường injection script từ user
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <span className="italic text-muted-foreground-subtle">{labels.empty}</span>
          )}
        </div>
      )}

      {/* Character counter */}
      {remaining !== null && labels.charsRemaining && (
        <div className={cn("px-4 pb-2 text-right text-xs", isOver ? "font-medium text-destructive" : "text-muted-foreground-subtle")}>
          {labels.charsRemaining(remaining.toLocaleString())}
        </div>
      )}
    </div>
  )
}
