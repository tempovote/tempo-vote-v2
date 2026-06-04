"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useState } from "react"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/dapp-ranking", label: "DApp Ranking" },
  { href: "/dreps", label: "DReps" },
  { href: "/governance-actions", label: "Governance Actions" },
]

export default function Navbar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

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
            <Image
              src="/logo.webp"
              alt="Tempo"
              width={140}
              height={36}
              className="h-8 w-auto"
              priority
            />
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href)
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
            {/* Network badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-bg-card border border-border-default text-xs font-medium text-text-secondary">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              Mainnet
            </div>

            {/* Connect Wallet button */}
            <button className="btn-primary text-sm px-4 py-2">
              Connect Wallet
            </button>

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 text-text-secondary hover:text-text-primary transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
                const isActive =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(link.href)
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
            </div>
          </div>
        )}
      </nav>
    </>
  )
}
