"use client"

import { useWalletStore } from "@/store/wallet"
import { useT } from "@/i18n/useT"

export function ConnectWalletCta({
  message,
  variant = "card",
}: {
  message?: string
  variant?: "card" | "inline"
}) {
  const t = useT()
  const openWalletModal = useWalletStore((s) => s.openWalletModal)
  const msg = message ?? t("wallet.connectToContinue")

  if (variant === "inline") {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4 text-center space-y-3">
        <div className="flex justify-center text-text-muted">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <path d="M16 12h.01"/>
            <path d="M2 10h20"/>
          </svg>
        </div>
        <p className="text-sm text-text-muted">{msg}</p>
        <button
          onClick={openWalletModal}
          className="btn-primary text-sm w-full"
        >
          {t("wallet.connect")}
        </button>
      </div>
    )
  }

  return (
    <div className="card-static text-center py-8 space-y-4">
      <div className="flex justify-center text-text-muted">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"/>
          <path d="M16 12h.01"/>
          <path d="M2 10h20"/>
        </svg>
      </div>
      <div className="space-y-1">
        <p className="font-medium text-text-primary">{msg}</p>
      </div>
      <button
        onClick={openWalletModal}
        className="btn-primary text-sm px-6"
      >
        {t("wallet.connect")}
      </button>
    </div>
  )
}
