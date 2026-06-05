"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState, useCallback } from "react"
import { useWalletStore } from "@/store/wallet"
import WalletModal from "@/components/wallet/WalletModal"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/dapp-ranking", label: "DApp Ranking" },
  { href: "/dreps", label: "DReps" },
  { href: "/governance-actions", label: "Governance Actions" },
]

function truncate(addr: string, chars = 6) {
  if (!addr || addr.length <= chars * 2 + 3) return addr
  return `${addr.slice(0, chars)}...${addr.slice(-4)}`
}

export default function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [walletModalOpen, setWalletModalOpen] = useState(false)

  const { isConnected, name, networkId, changeAddress } = useWalletStore()

  const openModal  = useCallback(() => setWalletModalOpen(true),  [])
  const closeModal = useCallback(() => setWalletModalOpen(false), [])

  const isMainnet = networkId === 1
  const networkLabel = networkId === null ? "Mainnet" : isMainnet ? "Mainnet" : "Preprod"
  const networkColor = networkId === null ? "#22c55e" : isMainnet ? "#22c55e" : "#eab308"

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
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Network badge — dynamic */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-card border border-border-default text-xs font-medium text-text-secondary">
              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: networkColor }}
              />
              {networkLabel}
            </div>

            {/* Wallet button — 2 states */}
            {isConnected && changeAddress ? (
              <button
                className="wallet-connected-btn"
                onClick={openModal}
                title={changeAddress}
                id="wallet-connected-btn"
              >
                {/* Mini avatar */}
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
            ) : (
              <button
                className="btn-primary text-sm px-4 py-2"
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

              {/* Network badge in mobile */}
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-text-muted">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: networkColor }} />
                {networkLabel}
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
