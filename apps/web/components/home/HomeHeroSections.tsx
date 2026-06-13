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
      <section className="card-static space-y-3 animate-slide-up" style={{ animationDelay: "0.1s" }}>
        <h2 className="text-lg font-bold">Delegate To DRep</h2>
        <p className="text-sm text-text-secondary">
          Tìm DRep phù hợp, xem profile và lịch sử bỏ phiếu, sau đó delegate voting power của bạn cho họ.
        </p>
        <Link href="/dreps" className="btn-primary w-full justify-center">
          Khám phá DReps
        </Link>
      </section>
    </>
  )
}
