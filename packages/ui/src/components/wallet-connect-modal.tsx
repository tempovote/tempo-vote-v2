"use client"

import type { ReactNode } from "react"
import { cn } from "../lib/utils"
import { Dialog, DialogContent, DialogTitle } from "./dialog"
import { Spinner } from "./spinner"

export interface WalletOption {
  id: string
  label: string
  /** URL icon; null/undefined → hiện chữ cái đầu */
  icon?: string | null
  installed: boolean
  supportsCip95?: boolean
  /** Link cài đặt khi chưa installed */
  installUrl?: string
}

export interface WalletConnectModalLabels {
  title: string
  connectingTitle: string
  /** vd (name) => `Đang kết nối ${name}…` */
  connectingTo: (name: string) => string
  approvalHint: string
  selectPrompt: string
  notInstalled: string
  install: string
}

export interface WalletOptionItemProps {
  wallet: WalletOption
  notInstalledText: string
  installText: string
  onSelect: (walletId: string) => void
}

export function WalletOptionItem({ wallet, notInstalledText, installText, onSelect }: WalletOptionItemProps) {
  return (
    <button
      type="button"
      disabled={!wallet.installed}
      onClick={() => wallet.installed && onSelect(wallet.id)}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-[0.625rem] border border-border-subtle bg-card px-4 py-3.5",
        "text-left text-[0.9rem] font-medium text-foreground transition-all",
        "enabled:hover:border-primary enabled:hover:bg-muted enabled:hover:shadow-[0_0_0_2px_rgba(99,102,241,0.12)]",
        "disabled:cursor-not-allowed disabled:opacity-45"
      )}
    >
      {/* Icon */}
      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-popover">
        {wallet.icon ? (
          <img src={wallet.icon} alt={wallet.label} width={36} height={36} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs font-bold text-muted-foreground-subtle">{wallet.label[0]}</span>
        )}
      </div>

      {/* Name + badges */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{wallet.label}</span>
          {wallet.supportsCip95 && (
            <span className="rounded border border-primary/25 bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-light">
              CIP-95
            </span>
          )}
        </div>
        {!wallet.installed && <p className="mt-0.5 text-xs text-muted-foreground-subtle">{notInstalledText}</p>}
      </div>

      {/* Install link hoặc chevron */}
      {wallet.installed ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted-foreground-subtle">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      ) : wallet.installUrl ? (
        <a
          href={wallet.installUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 text-[11px] text-primary-light hover:underline"
        >
          {installText}
        </a>
      ) : null}
    </button>
  )
}

export interface WalletConnectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  wallets: WalletOption[]
  /** id ví đang connect; null/undefined = màn chọn ví */
  connectingId?: string | null
  error?: string | null
  /** Slot dưới error message (vd nút reload — app truyền, i18n-free) */
  errorAction?: ReactNode
  onSelect: (walletId: string) => void
  labels: WalletConnectModalLabels
}

export function WalletConnectModal({
  open,
  onOpenChange,
  wallets,
  connectingId,
  error,
  errorAction,
  onSelect,
  labels,
}: WalletConnectModalProps) {
  const connecting = connectingId ? wallets.find((w) => w.id === connectingId) : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="mb-5 text-base">
          {connectingId ? labels.connectingTitle : labels.title}
        </DialogTitle>

        {connectingId ? (
          /* ── Đang kết nối ── */
          <div className="flex flex-col items-center gap-4 py-8">
            <Spinner className="size-10 border-[3px]" />
            <div className="text-center">
              <p className="text-sm font-semibold">{labels.connectingTo(connecting?.label ?? connectingId)}</p>
              <p className="mt-1 text-xs text-muted-foreground-subtle">{labels.approvalHint}</p>
            </div>
          </div>
        ) : (
          /* ── Chọn ví ── */
          <div className="space-y-3">
            {error && (
              <div className="space-y-2 rounded-lg border border-destructive/25 bg-destructive/8 p-3 text-xs">
                <div className="flex items-start gap-2 text-destructive">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span>{error}</span>
                </div>
                {errorAction}
              </div>
            )}

            <p className="mb-1 text-xs text-muted-foreground-subtle">{labels.selectPrompt}</p>

            <div className="space-y-2">
              {wallets.map((wallet) => (
                <WalletOptionItem
                  key={wallet.id}
                  wallet={wallet}
                  notInstalledText={labels.notInstalled}
                  installText={labels.install}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
