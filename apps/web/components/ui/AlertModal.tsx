"use client"

import { useEffect, useRef } from "react"
import { useT } from "@/i18n/useT"

export type AlertType = "success" | "error" | "warning" | "info"

interface Props {
  type: AlertType
  title: string
  message?: string
  children?: React.ReactNode
  onClose: () => void
}

const CONFIG: Record<AlertType, { icon: string; iconCls: string; btnCls: string }> = {
  success: {
    icon: "M20 6L9 17l-5-5",
    iconCls: "bg-success/15 text-success",
    btnCls: "bg-success hover:bg-success/90 text-white",
  },
  error: {
    icon: "M18 6L6 18M6 6l12 12",
    iconCls: "bg-danger/15 text-danger",
    btnCls: "bg-danger hover:bg-danger/90 text-white",
  },
  warning: {
    icon: "M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
    iconCls: "bg-warning/15 text-warning",
    btnCls: "bg-warning hover:bg-warning/90 text-white",
  },
  info: {
    icon: "M12 8h.01M12 12v4",
    iconCls: "bg-accent/15 text-accent",
    btnCls: "bg-accent hover:bg-accent/90 text-white",
  },
}

export function AlertModal({ type, title, message, children, onClose }: Props) {
  const t = useT()
  const btnRef = useRef<HTMLButtonElement>(null)
  const cfg = CONFIG[type]

  // Focus OK button and handle Escape/Enter
  useEffect(() => {
    btnRef.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="alert-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative w-full max-w-sm bg-bg-card rounded-2xl shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">

        {/* Icon + title (fixed) */}
        <div className="flex flex-col items-center gap-3 px-6 pt-7 pb-4 shrink-0">
          <span className={`w-14 h-14 rounded-full flex items-center justify-center ${cfg.iconCls}`}>
            <svg
              width="26" height="26" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round"
            >
              <path d={cfg.icon} />
            </svg>
          </span>
          <h2 id="alert-title" className="text-lg font-bold text-text-primary text-center leading-snug">
            {title}
          </h2>
        </div>

        {/* Scrollable message body */}
        {(message || children) && (
          <div className="px-6 pb-4 overflow-y-auto flex-1 min-h-0">
            {message && (
              <p className="text-sm text-text-secondary text-center leading-relaxed break-all">
                {message}
              </p>
            )}
            {children && (
              <div className="w-full mt-1">{children}</div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="h-px bg-border-subtle shrink-0" />

        {/* Actions (fixed at bottom) */}
        <div className="px-6 py-4 shrink-0">
          <button
            ref={btnRef}
            onClick={onClose}
            className={`w-full h-11 rounded-xl text-sm font-semibold transition-colors ${cfg.btnCls}`}
          >
            {t("common.ok")}
          </button>
        </div>
      </div>
    </div>
  )
}
