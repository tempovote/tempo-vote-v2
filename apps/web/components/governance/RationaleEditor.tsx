"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import "@uiw/react-md-editor/markdown-editor.css"
import { useT } from "@/i18n/useT"

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false })

interface Props {
  value: string
  onChange: (v: string) => void
  label?: string
  description?: string
  placeholder?: string
  maxLength?: number
  height?: number
  optional?: boolean
}

type PreviewMode = "edit" | "live" | "preview"

export function RationaleEditor({
  value,
  onChange,
  label: labelProp,
  description: descriptionProp,
  placeholder: placeholderProp,
  maxLength,
  height = 220,
  optional = false,
}: Props) {
  const t = useT()
  const label = labelProp ?? t("governance.rationaleEditor.label")
  const description = descriptionProp ?? t("governance.rationaleEditor.description")
  const placeholder = placeholderProp ?? t("governance.rationaleEditor.placeholder")
  const MODES: { value: PreviewMode; label: string }[] = [
    { value: "edit",    label: t("governance.rationaleEditor.modeEdit") },
    { value: "live",    label: t("governance.rationaleEditor.modeSplit") },
    { value: "preview", label: t("governance.rationaleEditor.modePreview") },
  ]
  const [previewMode, setPreviewMode] = useState<PreviewMode>("edit")
  const isLimited = maxLength !== undefined
  const remaining = isLimited ? maxLength - value.length : null
  const isOver = remaining !== null && remaining < 0

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        {label ? (
          <label className="text-sm font-medium text-text-secondary">
            {label}
            {optional && (
              <span className="ml-1.5 text-xs text-text-muted font-normal bg-bg-elevated px-1.5 py-0.5 rounded">
                {t("common.optional")}
              </span>
            )}
          </label>
        ) : <span />}

        {/* Mode tabs */}
        <div className="flex items-center bg-bg-secondary rounded-lg p-0.5 gap-0.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setPreviewMode(m.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                previewMode === m.value
                  ? "bg-bg-elevated text-text-primary"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div data-color-mode="dark" className="rationale-editor-wrap rounded-xl overflow-hidden">
        {MDEditor ? (
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
        ) : (
          <div className="animate-pulse bg-bg-secondary rounded-xl" style={{ height }} />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs">
        {description ? (
          <p className="text-text-muted/70">{description}</p>
        ) : (
          <span />
        )}
        {isLimited ? (
          <span className={isOver ? "text-danger font-medium" : "text-text-muted"}>
            {t("governance.rationaleEditor.charsRemaining", { n: remaining!.toLocaleString() })}
          </span>
        ) : (
          <span className="text-text-muted">
            {t("governance.rationaleEditor.charCount", { n: value.length.toLocaleString() })}
          </span>
        )}
      </div>
    </div>
  )
}
