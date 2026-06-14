"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState, useCallback, useEffect, useRef } from "react"
import { useWalletStore } from "@/store/wallet"
import WalletModal from "@/components/wallet/WalletModal"
import LanguageSwitcher from "@/components/layout/LanguageSwitcher"
import { useT } from "@/i18n/useT"

const BANNER_KEY = "tempo:banner-dismissed-v1"

const navLinks = [
  { href: "/", key: "nav.home" },
  { href: "/dapp-ranking", key: "nav.dappRanking" },
  { href: "/dreps", key: "nav.dreps" },
  { href: "/governance-actions", key: "nav.governanceActions" },
]

const othersLinks = [
  { href: "/treasury-projection", key: "nav.treasuryProjection" },
  { href: "/user-guides",         key: "nav.userGuides" },
  { href: "/about",               key: "nav.about" },
]

function truncate(addr: string, chars = 6) {
  if (!addr || addr.length <= chars * 2 + 3) return addr
  return `${addr.slice(0, chars)}...${addr.slice(-4)}`
}

export default function Navbar() {
  const t = useT()
  const pathname = usePathname()
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [othersOpen,  setOthersOpen]  = useState(false)
  const [mobileOthersOpen, setMobileOthersOpen] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const othersRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      if (!localStorage.getItem(BANNER_KEY)) setBannerVisible(true)
    } catch { setBannerVisible(true) }
  }, [])

  const dismissBanner = useCallback(() => {
    setBannerVisible(false)
    try { localStorage.setItem(BANNER_KEY, "1") } catch { /* ignore */ }
  }, [])

  // Close Others dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (othersRef.current && !othersRef.current.contains(e.target as Node)) {
        setOthersOpen(false)
      }
    }
    if (othersOpen) document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [othersOpen])

  const { isConnected, isWalletHydrating, name, changeAddress, selectedNetwork, setSelectedNetwork, initNetwork, walletModalOpen, openWalletModal, closeWalletModal, reset } =
    useWalletStore()

  const handleDisconnect = useCallback(() => {
    reset()
    try { localStorage.removeItem("tempo:last_wallet") } catch { /* ignore */ }
  }, [reset])

  // When wallet is connected, network is locked to wallet's network
  const networkLocked = isConnected

  const openModal  = useCallback(() => { setMobileOpen(false); openWalletModal() },  [openWalletModal])
  const closeModal = useCallback(() => closeWalletModal(), [closeWalletModal])

  // Restore persisted network preference on first render
  useEffect(() => { initNetwork() }, [initNetwork])

  return (
    <>
      {/* Top banner */}
      {bannerVisible && (
        <div className="w-full bg-gradient-to-r from-accent-dark via-accent to-accent-purple flex items-center justify-center gap-3 py-2 px-4 text-sm text-white/90 relative">
          <span>
            {t("banner.pre")}
            <span className="underline font-semibold cursor-pointer">{t("banner.profile")}</span>
            {t("banner.mid")}
            <span className="underline font-semibold cursor-pointer">{t("banner.delegate")}</span>
            {t("banner.post")}
          </span>
          <button
            onClick={dismissBanner}
            className="shrink-0 text-white/70 hover:text-white transition-colors"
            aria-label={t("banner.close")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Main navbar */}
      <nav className="sticky top-0 z-50 bg-bg-primary/80 backdrop-blur-xl border-b border-border-default">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Image src="/logo.webp" alt="Tempo" width={140} height={36} className="h-8 w-auto" priority />
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "text-accent-light bg-accent/10"
                      : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                  }`}
                >
                  {t(link.key)}
                </Link>
              )
            })}

            {/* Others dropdown */}
            <div ref={othersRef} className="relative">
              <button
                onClick={() => setOthersOpen(o => !o)}
                className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  othersLinks.some(l => pathname.startsWith(l.href))
                    ? "text-accent-light bg-accent/10"
                    : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                }`}
              >
                {t("nav.others")}
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                  className={`transition-transform duration-150 ${othersOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {othersOpen && (
                <div className="absolute top-full left-0 mt-1.5 w-52 bg-bg-card border border-border-default rounded-xl shadow-2xl py-1.5 z-50 animate-fade-in">
                  {othersLinks.map(link => {
                    const isActive = pathname.startsWith(link.href)
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setOthersOpen(false)}
                        className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                          isActive
                            ? "text-accent-light bg-accent/10"
                            : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                        }`}
                      >
                        {link.href === "/treasury-projection" && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                            <polyline points="17 6 23 6 23 12" />
                          </svg>
                        )}
                        {link.href === "/user-guides" && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                          </svg>
                        )}
                        {link.href === "/about" && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                        )}
                        {t(link.key)}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Network selector */}
            <div
              className="hidden sm:flex items-center gap-0.5 p-1 rounded-lg bg-bg-card border border-border-default"
              title={networkLocked ? t("wallet.networkLocked") : undefined}
            >
              <button
                onClick={() => !networkLocked && setSelectedNetwork("mainnet")}
                disabled={networkLocked}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedNetwork === "mainnet"
                    ? "bg-success/15 text-success"
                    : networkLocked
                    ? "text-text-muted opacity-40"
                    : "text-text-muted hover:text-text-secondary"
                } ${networkLocked ? "cursor-default" : "cursor-pointer"}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${selectedNetwork === "mainnet" ? "animate-pulse" : ""}`}
                  style={{ backgroundColor: "#22c55e" }}
                />
                Mainnet
              </button>
              <button
                onClick={() => !networkLocked && setSelectedNetwork("preprod")}
                disabled={networkLocked}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  selectedNetwork === "preprod"
                    ? "bg-warning/15 text-warning"
                    : networkLocked
                    ? "text-text-muted opacity-40"
                    : "text-text-muted hover:text-text-secondary"
                } ${networkLocked ? "cursor-default" : "cursor-pointer"}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${selectedNetwork === "preprod" ? "animate-pulse" : ""}`}
                  style={{ backgroundColor: "#eab308" }}
                />
                Preprod
              </button>
              {networkLocked && (
                <span className="px-1.5 text-text-muted opacity-50">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 1C9.24 1 7 3.24 7 6v2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v2H9V6c0-1.66 1.34-3 3-3zm0 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>
                  </svg>
                </span>
              )}
            </div>

            {/* Language switcher — next to wallet */}
            <LanguageSwitcher />

            {/* Wallet button — 3 states: connected / hydrating / disconnected */}
            {isConnected && changeAddress ? (
              <div className="flex items-center gap-1.5">
                {/* Mobile: avatar circle only */}
                <div className="sm:hidden">
                  <button
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white ring-2 ring-accent/30 hover:ring-accent/60 transition-all"
                    style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
                    onClick={openModal}
                    title={changeAddress}
                  >
                    {name ? name[0]?.toUpperCase() : "W"}
                  </button>
                </div>
                {/* Desktop: full button with address */}
                <div className="hidden sm:block">
                  <button
                    className="wallet-connected-btn"
                    onClick={openModal}
                    title={changeAddress}
                    id="wallet-connected-btn"
                  >
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                      style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
                    >
                      {name ? name[0]?.toUpperCase() : "W"}
                    </div>
                    <span className="font-mono">{truncate(changeAddress)}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-text-muted">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition-colors shrink-0"
                  title={t("wallet.disconnect")}
                  aria-label={t("wallet.disconnect")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </div>
            ) : isWalletHydrating ? (
              <>
                {/* Mobile: spinner icon only */}
                <div className="sm:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-accent/10 text-accent-light cursor-default pointer-events-none">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                </div>
                {/* Desktop: full spinner button */}
                <div className="hidden sm:block">
                  <div className="btn-primary text-sm px-4 py-1.5 opacity-70 cursor-default pointer-events-none select-none">
                    <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    {t("wallet.connecting")}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Mobile: wallet icon button */}
                <div className="sm:hidden">
                  <button
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent/15 text-accent-light hover:bg-accent/25 transition-colors border border-accent/30"
                    onClick={openModal}
                    aria-label={t("wallet.connect")}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                      <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
                    </svg>
                  </button>
                </div>
                {/* Desktop: full text button */}
                <div className="hidden sm:block">
                  <button
                    className="btn-primary text-sm px-4 py-1.5"
                    onClick={openModal}
                    id="wallet-connect-btn"
                  >
                    {t("wallet.connect")}
                  </button>
                </div>
              </>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-text-secondary hover:text-text-primary transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {mobileOpen ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu overlay backdrop */}
        {mobileOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-40"
            style={{ top: 0 }}
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border-default bg-bg-card animate-fade-in relative z-50">
            <div className="px-4 py-3 space-y-1">
              {navLinks.map((link) => {
                const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "text-accent-light bg-accent/10"
                        : "text-text-primary hover:text-accent-light hover:bg-white/5"
                    }`}
                  >
                    {t(link.key)}
                  </Link>
                )
              })}

              {/* Others section in mobile */}
              <div>
                <button
                  onClick={() => setMobileOthersOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-text-primary hover:text-accent-light hover:bg-white/5 transition-colors"
                >
                  {t("nav.others")}
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    className={`transition-transform duration-150 ${mobileOthersOpen ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {mobileOthersOpen && (
                  <div className="pl-4 space-y-0.5 mt-0.5">
                    {othersLinks.map(link => {
                      const isActive = pathname.startsWith(link.href)
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => { setMobileOpen(false); setMobileOthersOpen(false) }}
                          className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                            isActive
                              ? "text-accent-light bg-accent/10"
                              : "text-text-primary hover:text-accent-light hover:bg-white/5"
                          }`}
                        >
                          {t(link.key)}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Network selector in mobile */}
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  onClick={() => !networkLocked && setSelectedNetwork("mainnet")}
                  disabled={networkLocked}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedNetwork === "mainnet"
                      ? "border-success/40 text-success bg-success/10"
                      : "border-border-subtle text-text-muted"
                  } ${networkLocked && selectedNetwork !== "mainnet" ? "opacity-40" : ""}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  Mainnet
                </button>
                <button
                  onClick={() => !networkLocked && setSelectedNetwork("preprod")}
                  disabled={networkLocked}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    selectedNetwork === "preprod"
                      ? "border-warning/40 text-warning bg-warning/10"
                      : "border-border-subtle text-text-muted"
                  } ${networkLocked && selectedNetwork !== "preprod" ? "opacity-40" : ""}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#eab308]" />
                  Preprod
                </button>
                {networkLocked && (
                  <span className="text-xs text-text-muted opacity-50 flex items-center gap-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 1C9.24 1 7 3.24 7 6v2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v2H9V6c0-1.66 1.34-3 3-3zm0 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/>
                    </svg>
                    {t("wallet.lockedShort")}
                  </span>
                )}
              </div>

              {/* Wallet in mobile menu */}
              <div className="px-3 py-2 border-t border-border-subtle mt-1 pt-3">
                {isConnected && changeAddress ? (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => { setMobileOpen(false); openWalletModal() }}
                      className="wallet-connected-btn flex-1"
                    >
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
                      >
                        {name ? name[0]?.toUpperCase() : "W"}
                      </div>
                      <span className="font-mono text-sm">{truncate(changeAddress, 8)}</span>
                    </button>
                    <button
                      onClick={() => { setMobileOpen(false); handleDisconnect() }}
                      className="w-9 h-9 flex items-center justify-center rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition-colors shrink-0"
                      aria-label={t("wallet.disconnect")}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn-primary w-full text-sm py-2"
                    onClick={() => { setMobileOpen(false); openWalletModal() }}
                  >
                    {t("wallet.connect")}
                  </button>
                )}
              </div>

              {/* Language switcher in mobile */}
              <div className="px-3 py-2">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Wallet Modal — rendered at root level via portal-like placement */}
      <WalletModal isOpen={walletModalOpen} onClose={closeModal} />
    </>
  )
}
