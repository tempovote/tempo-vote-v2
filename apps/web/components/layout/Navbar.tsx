"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState, useCallback, useEffect, useRef } from "react"
import { useWalletStore } from "@/store/wallet"
import WalletModal from "@/components/wallet/WalletModal"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/dapp-ranking", label: "DApp Ranking" },
  { href: "/dreps", label: "DReps" },
  { href: "/governance-actions", label: "Governance Actions" },
]

const othersLinks = [
  { href: "/treasury-projection", label: "Treasury Projection" },
  { href: "/user-guides",         label: "User Guides" },
  { href: "/about",               label: "About" },
]

function truncate(addr: string, chars = 6) {
  if (!addr || addr.length <= chars * 2 + 3) return addr
  return `${addr.slice(0, chars)}...${addr.slice(-4)}`
}

export default function Navbar() {
  const pathname = usePathname()
  const [mobileOpen,  setMobileOpen]  = useState(false)
  const [othersOpen,  setOthersOpen]  = useState(false)
  const [mobileOthersOpen, setMobileOthersOpen] = useState(false)
  const othersRef = useRef<HTMLDivElement>(null)

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

  const openModal  = useCallback(() => openWalletModal(),  [openWalletModal])
  const closeModal = useCallback(() => closeWalletModal(), [closeWalletModal])

  // Restore persisted network preference on first render
  useEffect(() => { initNetwork() }, [initNetwork])

  return (
    <>
      {/* Top banner */}
      <div className="w-full bg-gradient-to-r from-accent-dark via-accent to-accent-purple text-center py-2 px-4 text-sm text-white/90">
        Check out{" "}
        <span className="underline font-semibold cursor-pointer">Tempo DRep profile</span>{" "}
        and{" "}
        <span className="underline font-semibold cursor-pointer">delegate</span>{" "}
        to help shape Cardano&apos;s transparent governance!
      </div>

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
                  {link.label}
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
                Others
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
                        {link.label === "Treasury Projection" && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                            <polyline points="17 6 23 6 23 12" />
                          </svg>
                        )}
                        {link.label === "User Guides" && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                          </svg>
                        )}
                        {link.label === "About" && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                        )}
                        {link.label}
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
              title={networkLocked ? "Mạng được khóa theo ví đang kết nối" : undefined}
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

            {/* Wallet button — 3 states: connected / hydrating / disconnected */}
            {isConnected && changeAddress ? (
              <div className="flex items-center gap-1.5">
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
                <button
                  onClick={handleDisconnect}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition-colors shrink-0"
                  title="Disconnect wallet"
                  aria-label="Disconnect wallet"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              </div>
            ) : isWalletHydrating ? (
              <div className="btn-primary text-sm px-4 py-1.5 opacity-70 flex items-center gap-2 cursor-default pointer-events-none select-none">
                <svg className="w-3.5 h-3.5 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Đang kết nối...
              </div>
            ) : (
              <button
                className="btn-primary text-sm px-4 py-1.5"
                onClick={openModal}
                id="wallet-connect-btn"
              >
                Connect Wallet
              </button>
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

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border-default bg-bg-secondary/95 backdrop-blur-xl animate-fade-in">
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
                        : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}

              {/* Others section in mobile */}
              <div>
                <button
                  onClick={() => setMobileOthersOpen(o => !o)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
                >
                  Others
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
                              : "text-text-muted hover:text-text-secondary hover:bg-white/5"
                          }`}
                        >
                          {link.label}
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
                    Khóa theo ví
                  </span>
                )}
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
