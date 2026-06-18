"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import Link from "next/link"
import { useWallet } from "@/hooks/useWallet"
import { useDRepProfile } from "@/hooks/useDRepProfile"
import { getWalletInfo, CIP95_WALLETS } from "@tempo/wallet-bridge"
import type { NetworkId } from "@tempo/wallet-bridge"
import { copyToClipboard } from "@/lib/clipboard"
import { useT } from "@/i18n/useT"

const IPFS_DISPLAY_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
]

function resolveIpfsSrc(url: string, gwIdx: number): string {
  if (url.startsWith("ipfs://")) {
    return IPFS_DISPLAY_GATEWAYS[Math.min(gwIdx, IPFS_DISPLAY_GATEWAYS.length - 1)] + url.slice(7)
  }
  for (const gw of IPFS_DISPLAY_GATEWAYS) {
    if (url.startsWith(gw)) {
      return IPFS_DISPLAY_GATEWAYS[Math.min(gwIdx, IPFS_DISPLAY_GATEWAYS.length - 1)] + url.slice(gw.length)
    }
  }
  return url
}

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

function DRepInfoPanel({ drepName, drepId, imageUrl, onClose }: { drepName: string | null; drepId: string | null; imageUrl: string | null; onClose: () => void }) {
  const t = useT()
  const [copiedDrepId, setCopiedDrepId] = useState(false)
  const [imgGwIdx, setImgGwIdx] = useState(0)

  const handleCopyDrepId = useCallback(async () => {
    if (!drepId) return
    copyToClipboard(drepId)
    setCopiedDrepId(true)
    setTimeout(() => setCopiedDrepId(false), 2000)
  }, [drepId])

  const displayName = drepName ?? "DRep"
  const initial = displayName[0]?.toUpperCase() ?? "D"

  return (
    <div className="rounded-xl bg-bg-card border border-border-subtle divide-y divide-border-subtle overflow-hidden">
      {(drepName || imageUrl) && (
        <div className="p-3 flex items-center gap-3">
          {/* Avatar: image or initial */}
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveIpfsSrc(imageUrl, imgGwIdx)}
              alt={displayName}
              className="w-10 h-10 rounded-full object-cover border border-border-subtle shrink-0"
              onError={() => {
                if (imgGwIdx < IPFS_DISPLAY_GATEWAYS.length - 1) setImgGwIdx(i => i + 1)
              }}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-base shrink-0">
              {initial}
            </div>
          )}
          <div>
            <p className="text-text-muted text-xs mb-0.5 font-medium">{t("wallet.modal.drepName")}</p>
            <p className="text-text-primary text-sm font-semibold">{displayName}</p>
          </div>
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-text-muted text-xs font-medium">{t("wallet.modal.yourDrepId")}</p>
          {drepId && (
            <button
              onClick={handleCopyDrepId}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
              title={t("wallet.modal.copyDrepId")}
            >
              {copiedDrepId ? (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t("wallet.modal.copied")}
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                  {t("wallet.modal.copy")}
                </>
              )}
            </button>
          )}
        </div>
        <p className="text-text-secondary text-xs font-mono break-all leading-relaxed">
          {drepId || "—"}
        </p>
      </div>
      <div className="p-3 flex gap-2">
        <Link
          href="/dreps/update"
          onClick={onClose}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:bg-white/5 text-xs font-medium transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          {t("wallet.modal.update")}
        </Link>
        <Link
          href="/dreps/retire"
          onClick={onClose}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-danger/30 text-danger hover:bg-danger/10 text-xs font-medium transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
          {t("wallet.modal.retire")}
        </Link>
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
  const t = useT()
  const msg =
    errorKind === "network"
      ? t("wallet.modal.statusUnavailableNetwork")
      : t("wallet.modal.statusUnavailableServer")

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
  const t = useT()
  return (
    <div className="p-3 rounded-xl bg-bg-card border border-border-subtle space-y-3">
      <p className="text-text-secondary text-xs leading-relaxed">
        {t("wallet.modal.govCtaDesc")}
      </p>
      <div className="flex flex-col gap-2">
        <Link
          href="/dreps"
          onClick={onClose}
          className="flex items-center justify-center py-2 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:bg-white/5 text-xs font-medium transition-colors"
        >
          {t("wallet.modal.findDrep")}
        </Link>
        <Link
          href="/dreps/register"
          onClick={onClose}
          className="flex items-center justify-center py-2 rounded-lg bg-accent/15 border border-accent/30 text-accent-light hover:bg-accent/25 text-xs font-medium transition-colors"
        >
          {t("wallet.modal.registerDrep")}
        </Link>
      </div>
    </div>
  )
}

interface WalletModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const t = useT()
  const {
    isConnected, isConnecting, error,
    name, networkId, changeAddress, drepKey,
    drepName, isDrepRegistered, delegatedDrep, drepStatusLoading, drepStatusError,
    walletBalance, selectedNetwork,
    hasCip95: cip95Supported,
    connect, disconnect, availableWallets,
  } = useWallet()

  const { profile: drepProfile } = useDRepProfile(
    isDrepRegistered ? (drepKey?.dRepIDCip105 ?? "") : "",
    selectedNetwork
  )

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
    copyToClipboard(changeAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [changeAddress])

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!isOpen || !mounted) return null

  return createPortal(
    <div className="wallet-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="wallet-modal">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-text-primary">
            {isConnected ? t("wallet.modal.title") : isConnecting ? t("wallet.connecting") : t("wallet.connect")}
          </h2>
          <div className="flex items-center gap-1">
            {isConnected && (
              <button
                onClick={handleDisconnect}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-danger hover:bg-danger/10 transition-colors"
                aria-label={t("wallet.disconnect")}
                title={t("wallet.disconnect")}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
              aria-label={t("wallet.modal.close")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
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
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-text-muted text-xs font-mono truncate">
                    {changeAddress ? truncateAddress(changeAddress, 10) : "—"}
                  </p>
                  {changeAddress && (
                    <button
                      onClick={handleCopyAddress}
                      className="shrink-0 text-text-muted hover:text-text-primary transition-colors"
                      title={copied ? t("wallet.modal.copied") : t("wallet.modal.copyAddress")}
                    >
                      {copied ? (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
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
                  {t("wallet.modal.checkingGovernance")}
                </div>
              ) : isDrepRegistered === true ? (
                /* Confirmed by Ogmios: registered DRep */
                <DRepInfoPanel drepName={drepName} drepId={drepKey?.dRepIDCip105 ?? null} imageUrl={drepProfile?.imageUrl ?? null} onClose={onClose} />
              ) : isDrepRegistered === false && delegatedDrep ? (
                /* Confirmed by Ogmios: not DRep, has delegated */
                <div className="flex items-center gap-2 p-3 rounded-xl bg-success/5 border border-success/20 text-xs text-success">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {t("wallet.modal.delegatedTo", { name: delegatedDrep.name ?? truncateAddress(delegatedDrep.id, 8) })}
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
                {t("wallet.modal.noCip95")}
              </div>
            )}

          </div>
        )}

        {/* ── State B: Connecting ── */}
        {isConnecting && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
            <div className="text-center">
              <p className="font-semibold text-sm">{t("wallet.modal.connectingTo", { name: connectingWallet ?? "" })}</p>
              <p className="text-text-muted text-xs mt-1">{t("wallet.modal.approvalHint")}</p>
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
                        ? t("wallet.modal.unlockRetry")
                        : t("wallet.modal.sessionExpired")}
                    </span>
                    <button
                      onClick={() => window.location.reload()}
                      className="text-accent-light hover:underline font-medium shrink-0 ml-2"
                    >
                      {t("wallet.modal.reload")}
                    </button>
                  </div>
                )}
              </div>
            )}

            <p className="text-text-muted text-xs mb-1">
              {t("wallet.modal.selectPrompt")}
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
                        <p className="text-text-muted text-xs mt-0.5">{t("wallet.modal.notInstalled")}</p>
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
                        {t("wallet.modal.install")}
                      </a>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
