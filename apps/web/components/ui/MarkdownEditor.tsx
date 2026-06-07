"use client"

import { useState, useCallback } from "react"
import { marked } from "marked"

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  id?: string
}

export default function MarkdownEditor({ value, onChange, placeholder, rows = 5, id }: Props) {
  const [tab, setTab] = useState<"write" | "preview">("write")

  const html = useCallback(() => {
    if (!value.trim()) return ""
    return marked.parse(value, { async: false }) as string
  }, [value])

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-border-subtle">
        <button
          type="button"
          onClick={() => setTab("write")}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            tab === "write"
              ? "text-text-primary border-b-2 border-accent -mb-px"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Viết
        </button>
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={`px-4 py-2 text-xs font-medium transition-colors ${
            tab === "preview"
              ? "text-text-primary border-b-2 border-accent -mb-px"
              : "text-text-muted hover:text-text-secondary"
          }`}
        >
          Xem trước
        </button>
        <div className="flex-1" />
        <span className="px-3 py-2 text-xs text-text-muted opacity-50 select-none">Markdown</span>
      </div>

      {/* Write */}
      {tab === "write" && (
        <textarea
          id={id}
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none outline-none leading-relaxed"
        />
      )}

      {/* Preview */}
      {tab === "preview" && (
        <div
          className="px-4 py-3 text-sm text-text-primary leading-relaxed markdown-preview"
          style={{ minHeight: `${rows * 1.6}rem` }}
        >
          {value.trim() ? (
            // marked output — backend stores raw markdown, not HTML; no user script injection path
            // eslint-disable-next-line react/no-danger
            <div dangerouslySetInnerHTML={{ __html: html() }} />
          ) : (
            <span className="text-text-muted italic">Chưa có nội dung...</span>
          )}
        </div>
      )}
    </div>
  )
}
