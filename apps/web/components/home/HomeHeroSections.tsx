"use client"

import Link from "next/link"
import { useWallet } from "@/hooks/useWallet"

export default function HomeHeroSections() {
  const { isConnected, isDrepRegistered } = useWallet()

  // Hide both cards when confirmed DRep — they're irrelevant
  if (isConnected && isDrepRegistered === true) return null

  return (
    <>
      {/* ── Section 1: Become a DRep ────────────────────────── */}
      <section className="card-accent text-center space-y-4 animate-slide-up">
        <h2 className="text-xl font-bold">Become a DRep</h2>
        <p className="text-text-secondary text-sm max-w-lg mx-auto">
          Help to grow Cardano by becoming an active voter. ADA holders can delegate their voting
          power to you.
        </p>
        <Link href="/dreps/register" className="btn-primary gap-2 mx-auto">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Register as a DRep
        </Link>
      </section>

      {/* ── Section 2: Delegate To DRep ─────────────────────── */}
      <section className="card-static space-y-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
        <h2 className="text-lg font-bold">Delegate To DRep</h2>

        <div className="notice notice-success">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-success shrink-0">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <polyline points="8,12 11,15 16,9" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-sm">
            Find a DRep, review their profile, and delegate your voting power to them
          </span>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or ID"
              className="input pl-10"
            />
          </div>
          <button className="btn-primary px-6">Search</button>
        </div>
      </section>
    </>
  )
}
