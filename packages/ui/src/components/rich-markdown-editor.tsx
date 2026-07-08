"use client"

import { useState } from "react"
import MDEditor from "@uiw/react-md-editor"
import "@uiw/react-md-editor/markdown-editor.css"
import { cn } from "../lib/utils"
import "../styles/rich-markdown-editor.css"

export type RichMarkdownPreviewMode = "edit" | "live" | "preview"

export interface RichMarkdownEditorLabels {
  modeEdit: string
  modeSplit: string
  modePreview: string
  /** Chip "optional" cạnh label */
  optional: string
  /** vd (n) => `${n} ký tự còn lại` — dùng khi có maxLength */
  charsRemaining: (n: string) => string
  /** vd (n) => `${n} ký tự` — dùng khi không có maxLength */
  charCount: (n: string) => string
}

export interface RichMarkdownEditorProps {
  value: string
  onChange: (v: string) => void
  labels: RichMarkdownEditorLabels
  label?: string
  description?: string
  placeholder?: string
  maxLength?: number
  height?: number
  optional?: boolean
  /** data-color-mode cho @uiw editor (default "dark") */
  colorMode?: "dark" | "light"
  className?: string
}

export function RichMarkdownEditor({
  value,
  onChange,
  labels,
  label,
  description,
  placeholder,
  maxLength,
  height = 220,
  optional = false,
  colorMode = "dark",
  className,
}: RichMarkdownEditorProps) {
  const MODES: { value: RichMarkdownPreviewMode; label: string }[] = [
    { value: "edit", label: labels.modeEdit },
    { value: "live", label: labels.modeSplit },
    { value: "preview", label: labels.modePreview },
  ]
  const [previewMode, setPreviewMode] = useState<RichMarkdownPreviewMode>("edit")
  const isLimited = maxLength !== undefined
  const remaining = isLimited ? maxLength - value.length : null
  const isOver = remaining !== null && remaining < 0

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        {label ? (
          <label className="text-sm font-medium text-muted-foreground">
            {label}
            {optional && (
              <span className="ml-1.5 rounded bg-popover px-1.5 py-0.5 text-xs font-normal text-muted-foreground-subtle">
                {labels.optional}
              </span>
            )}
          </label>
        ) : (
          <span />
        )}

        {/* Mode tabs */}
        <div className="flex items-center gap-0.5 rounded-lg bg-secondary p-0.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setPreviewMode(m.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                previewMode === m.value
                  ? "bg-popover text-foreground"
                  : "text-muted-foreground-subtle hover:text-muted-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div data-color-mode={colorMode} className="tempo-rich-md-wrap overflow-hidden rounded-card">
        <MDEditor
          value={value}
          onChange={(v) => onChange(v ?? "")}
          preview={previewMode}
          height={height}
          visibleDragbar={false}
          hideToolbar={false}
          enableScroll={true}
          textareaProps={{
            placeholder,
            ...(isLimited ? { maxLength: maxLength! + 50 } : {}),
          }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs">
        {description ? <p className="text-muted-foreground-subtle/70">{description}</p> : <span />}
        {isLimited ? (
          <span className={isOver ? "font-medium text-destructive" : "text-muted-foreground-subtle"}>
            {labels.charsRemaining(remaining!.toLocaleString())}
          </span>
        ) : (
          <span className="text-muted-foreground-subtle">{labels.charCount(value.length.toLocaleString())}</span>
        )}
      </div>
    </div>
  )
}
