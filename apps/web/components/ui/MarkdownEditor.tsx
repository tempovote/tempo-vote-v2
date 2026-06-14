"use client"

import { useState, useCallback } from "react"
import { marked } from "marked"
import { useT } from "@/i18n/useT"

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  id?: string
  maxLength?: number
}

export default function MarkdownEditor({ value, onChange, placeholder, rows = 5, id, maxLength }: Props) {
  const t = useT()
  const [tab, setTab] = useState<"write" | "preview">("write")
  const remaining = maxLength !== undefined ? maxLength - value.length : null
  const isOver = remaining !== null && remaining < 0

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
          {t("editor.write")}
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
          {t("editor.preview")}
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
          onChange={e => {
            const v = e.target.value
            if (maxLength !== undefined && v.length > maxLength + 50) return
            onChange(v)
          }}
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
            <span className="text-text-muted italic">{t("editor.empty")}</span>
          )}
        </div>
      )}

      {/* Character counter */}
      {remaining !== null && (
        <div className={`px-4 pb-2 text-xs text-right ${isOver ? "text-danger font-medium" : "text-text-muted"}`}>
          {t("editor.charsRemaining", { count: remaining.toLocaleString() })}
        </div>
      )}
    </div>
  )
}
