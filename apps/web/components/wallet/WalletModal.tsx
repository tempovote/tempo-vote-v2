"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { useWallet } from "@/hooks/useWallet"
import { getWalletInfo, CIP95_WALLETS } from "@tempo/wallet-bridge"
import type { NetworkId } from "@tempo/wallet-bridge"

// All well-known wallets — shown even if not installed
const KNOWN_WALLETS = [
  { id: "eternl", label: "Eternl", icon: "https://eternl.io/icons/favicon-96x96.png" },
  { id: "lace", label: "Lace", icon: "https://www.lace.io/favicon.ico" },
  { id: "vespr", label: "Vespr", icon: "https://vespr.xyz/favicon.ico" },
  { id: "yoroi", label: "Yoroi", icon: "https://yoroi-wallet.com/favicon.ico" },
  { id: "nufi", label: "NuFi", icon: "https://nu.fi/favicon.ico" },
  { id: "flint", label: "Flint", icon: "https://flint-wallet.com/favicon.ico" },
]

const WALLET_INSTALL_URLS: Record<string, string> = {
  eternl: "https://eternl.io",
  lace: "https://www.lace.io",
  vespr: "https://vespr.xyz",
  yoroi: "https://yoroi-wallet.com",
  nufi: "https://nu.fi",
  flint: "https://flint-wallet.com",
}

function NetworkBadge({ networkId }: { networkId: NetworkId }) {
  const isMainnet = networkId === 1
  return (
    <span className={isMainnet ? "network-badge-mainnet" : "network-badge-preprod"}>
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ background: isMainnet ? "#22c55e" : "#eab308" }}
      />
      {isMainnet ? "Mainnet" : "Preprod"}
    </span>
  )
}

function truncateAddress(addr: string, chars = 8): string {
  if (addr.length <= chars * 2 + 3) return addr
  return `${addr.slice(0, chars)}...${addr.slice(-chars)}`
}

function DRepInfoPanel({ drepName, drepId }: { drepName: string | null; drepId: string | null }) {
  return (
    <div className="rounded-xl bg-bg-card border border-border-subtle divide-y divide-border-subtle overflow-hidden">
      {drepName && (
        <div className="p-3">
          <p className="text-text-muted text-xs mb-1 font-medium">DRep Name</p>
          <p className="text-text-primary text-sm font-semibold">{drepName}</p>
        </div>
      )}
      <div className="p-3">
        <p className="text-text-muted text-xs mb-1 font-medium">Your DRep ID</p>
        <p className="text-text-secondary text-xs font-mono break-all leading-relaxed">
          {drepId || "—"}
        </p>
      </div>
    </div>
  )
}

function GovernanceStatusUnavailable({
  errorKind,
  onClose,
}: {
  errorKind: "network" | "server" | null
  onClose: () => void
}) {
  const msg =
    errorKind === "network"
      ? "API server not running — start the Kotlin backend"
      : "Không thể kiểm tra trạng thái on-chain"

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 p-3 rounded-xl bg-bg-card border border-border-subtle">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-text-muted">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-text-muted text-xs">{msg}</p>
      </div>
      <GovernanceCTA onClose={onClose} />
    </div>
  )
}

function GovernanceCTA({ onClose }: { onClose: () => void }) {
  return (
    <div className="p-3 rounded-xl bg-bg-card border border-border-subtle space-y-3">
      <p className="text-text-secondary text-xs leading-relaxed">
        Tham gia quản trị Cardano bằng cách delegate cho DRep hoặc tự đăng ký trở thành DRep.
      </p>
      <div className="flex flex-col gap-2">
        <a
          href="/dreps"
          onClick={onClose}
          className="flex items-center justify-center py-2 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:bg-white/5 text-xs font-medium transition-colors"
        >
          Tìm DRep để delegate
        </a>
        <a
          href="/dreps/register"
          onClick={onClose}
          className="flex items-center justify-center py-2 rounded-lg bg-accent/15 border border-accent/30 text-accent-light hover:bg-accent/25 text-xs font-medium transition-colors"
        >
          Đăng ký trở thành DRep
        </a>
      </div>
    </div>
  )
}

interface WalletModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const {
    isConnected, isConnecting, error,
    name, networkId, changeAddress, drepKey,
    drepName, isDrepRegistered, delegatedDrep, drepStatusLoading, drepStatusError,
    walletBalance,
    hasCip95: cip95Supported,
    connect, disconnect, availableWallets,
  } = useWallet()

  const [connectingWallet, setConnectingWallet] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [isOpen, onClose])

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [isOpen])

  // Auto-close after successful connect
  useEffect(() => {
    if (isConnected && connectingWallet) {
      setConnectingWallet(null)
      onClose()
    }
  }, [isConnected, connectingWallet, onClose])

  const handleConnect = useCallback(async (walletId: string) => {
    setConnectingWallet(walletId)
    await connect(walletId)
    // onClose is handled by the useEffect above
  }, [connect])

  const handleDisconnect = useCallback(() => {
    disconnect()
    onClose()
  }, [disconnect, onClose])

  const handleCopyAddress = useCallback(async () => {
    if (!changeAddress) return
    await navigator.clipboard.writeText(changeAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [changeAddress])

  if (!isOpen) return null

  return (
    <div className="wallet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="wallet-modal">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-text-primary">
            {isConnected ? "Wallet" : isConnecting ? "Connecting..." : "Connect Wallet"}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* ── State A: Connected ── */}
        {isConnected && networkId !== null && (
          <div className="space-y-4">
            {/* Wallet info row */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-card border border-border-default">
              <div className="wallet-avatar">
                {name ? name[0]?.toUpperCase() : "W"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm capitalize">{name}</span>
                  <NetworkBadge networkId={networkId} />
                </div>
                <p className="text-text-muted text-xs mt-0.5 font-mono truncate">
                  {changeAddress ? truncateAddress(changeAddress, 10) : "—"}
                </p>
              </div>
              {walletBalance !== null && (
                <div className="text-right shrink-0">
                  <p className="text-text-primary text-sm font-semibold tabular-nums">
                    {walletBalance.ada.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    <span className="text-text-muted font-normal ml-1">₳</span>
                  </p>
                </div>
              )}
            </div>

            {/* ── Governance status (CIP-95 only) ── */}
            {cip95Supported && (
              drepStatusLoading ? (
                /* Fetching on-chain status from Ogmios */
                <div className="flex items-center gap-3 p-3 rounded-xl bg-bg-card border border-border-subtle text-xs text-text-muted">
                  <div className="spinner shrink-0" style={{ width: 14, height: 14, borderWidth: 2 }} />
                  Checking governance status...
                </div>
              ) : isDrepRegistered === true ? (
                /* Confirmed by Ogmios: registered DRep */
                <DRepInfoPanel drepName={drepName} drepId={drepKey?.dRepIDCip105 ?? null} />
              ) : isDrepRegistered === false && delegatedDrep ? (
                /* Confirmed by Ogmios: not DRep, has delegated */
                <div className="flex items-center gap-2 p-3 rounded-xl bg-success/5 border border-success/20 text-xs text-success">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Delegated to: &ldquo;{delegatedDrep.name ?? truncateAddress(delegatedDrep.id, 8)}&rdquo;
                </div>
              ) : isDrepRegistered === false ? (
                /* Confirmed by Ogmios: not DRep, not delegated */
                <GovernanceCTA onClose={onClose} />
              ) : drepKey ? (
                /* isDrepRegistered === null: backend/Ogmios unavailable — show ID only, no status claim */
                <GovernanceStatusUnavailable errorKind={drepStatusError} onClose={onClose} />
              ) : (
                /* No DRep key and no backend data */
                <GovernanceCTA onClose={onClose} />
              )
            )}

            {/* No CIP-95 notice */}
            {!cip95Supported && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-warning/5 border border-warning/20 text-xs text-warning">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Wallet doesn&apos;t support CIP-95 — governance features limited
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleCopyAddress}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:bg-white/5 text-sm font-medium transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                {copied ? "Copied!" : "Copy Address"}
              </button>
              <button
                onClick={handleDisconnect}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-danger/30 text-danger hover:bg-danger/10 text-sm font-medium transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* ── State B: Connecting ── */}
        {isConnecting && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
            <div className="text-center">
              <p className="font-semibold text-sm">Connecting to {connectingWallet}...</p>
              <p className="text-text-muted text-xs mt-1">Check your wallet extension for approval</p>
            </div>
          </div>
        )}

        {/* ── State C: Select wallet ── */}
        {!isConnected && !isConnecting && (
          <div className="space-y-3">
            {error && (
              <div className="p-3 rounded-lg bg-danger/8 border border-danger/25 text-xs space-y-2">
                <div className="flex items-start gap-2 text-danger">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 mt-0.5">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span>{error}</span>
                </div>
                {/no account found|reconnect|locked/i.test(error) && (
                  <div className="flex items-center justify-between pl-5">
                    <span className="text-text-muted">
                      {/locked/i.test(error)
                        ? "Unlock your wallet then try again, or reload."
                        : "Wallet session expired — reload to fix."}
                    </span>
                    <button
                      onClick={() => window.location.reload()}
                      className="text-accent-light hover:underline font-medium shrink-0 ml-2"
                    >
                      Reload ↺
                    </button>
                  </div>
                )}
              </div>
            )}

            <p className="text-text-muted text-xs mb-1">
              Select a wallet to connect. CIP-95 wallets support governance features.
            </p>

            <div className="space-y-2">
              {KNOWN_WALLETS.map((wallet) => {
                const isInstalled = availableWallets
                  .map((w) => w.toLowerCase())
                  .includes(wallet.id)
                const supportsCip95 = CIP95_WALLETS.includes(wallet.id as typeof CIP95_WALLETS[number])
                const walletInfo = getWalletInfo(wallet.id)

                return (
                  <button
                    key={wallet.id}
                    className="wallet-option"
                    disabled={!isInstalled}
                    onClick={() => isInstalled && handleConnect(wallet.id)}
                  >
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-lg overflow-hidden bg-bg-elevated flex items-center justify-center shrink-0">
                      {walletInfo?.icon ? (
                        <Image
                          src={walletInfo.icon}
                          alt={wallet.label}
                          width={36}
                          height={36}
                          className="w-full h-full object-contain"
                          unoptimized
                        />
                      ) : (
                        <span className="text-text-muted text-xs font-bold">
                          {wallet.label[0]}
                        </span>
                      )}
                    </div>

                    {/* Name + badges */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{wallet.label}</span>
                        {supportsCip95 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/15 text-accent-light border border-accent/25 font-semibold leading-none">
                            CIP-95
                          </span>
                        )}
                      </div>
                      {!isInstalled && (
                        <p className="text-text-muted text-xs mt-0.5">Not installed</p>
                      )}
                    </div>

                    {/* Install link or chevron */}
                    {isInstalled ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-muted shrink-0">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    ) : (
                      <a
                        href={WALLET_INSTALL_URLS[wallet.id]}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[11px] text-accent-light hover:underline shrink-0"
                      >
                        Install ↗
                      </a>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
