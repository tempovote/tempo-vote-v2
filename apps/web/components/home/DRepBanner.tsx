"use client"

import Link from "next/link"
import Image from "next/image"
import { useWalletStore } from "@/store/wallet"
import { useDRepProfile } from "@/hooks/useDRepProfile"
import { resolveAnchorUrl } from "@/lib/governance"

function lovelaceToAda(lovelace: number | null): string {
  if (!lovelace || lovelace === 0) return "0"
  return (lovelace / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })
}

export function DRepBanner() {
  const { isDrepRegistered, drepKey, selectedNetwork } = useWalletStore()
  const drepId = drepKey?.dRepIDCip105 ?? null

  const { profile, isLoading } = useDRepProfile(drepId ?? "", selectedNetwork)

  if (!isDrepRegistered || !drepId) return null

  const name = profile?.givenName ?? profile?.name ?? drepId.slice(0, 12) + "…"
  const avatarUrl = profile?.imageUrl ? resolveAnchorUrl(profile.imageUrl) : null
  const votingPower = profile?.votingPower ?? null
  const hasVotingPower = votingPower !== null && votingPower > 0
  const networkParam = selectedNetwork !== "mainnet" ? `?network=${selectedNetwork}` : ""

  return (
    <section className="animate-slide-up">
      <div className="card-accent rounded-2xl p-5 space-y-4">
        {/* Top row: avatar + name + status */}
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="shrink-0 w-14 h-14 rounded-full overflow-hidden bg-bg-elevated border border-border-subtle flex items-center justify-center">
            {isLoading ? (
              <div className="w-full h-full bg-bg-elevated animate-pulse rounded-full" />
            ) : avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={name}
                width={56}
                height={56}
                className="w-full h-full object-cover"
                unoptimized
              />
            ) : (
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            )}
          </div>

          {/* Name + DRep ID */}
          <div className="flex-1 min-w-0">
            {isLoading ? (
              <div className="space-y-1.5">
                <div className="h-5 w-32 bg-bg-elevated rounded animate-pulse" />
                <div className="h-3.5 w-40 bg-bg-elevated rounded animate-pulse" />
              </div>
            ) : (
              <>
                <p className="font-bold text-text-primary truncate">{name}</p>
                <p className="text-xs text-text-muted font-mono truncate mt-0.5">
                  {drepId.slice(0, 16)}…{drepId.slice(-6)}
                </p>
              </>
            )}
          </div>

          {/* Active badge */}
          <span className="badge badge-active shrink-0">Active</span>
        </div>

        {/* Voting power row */}
        <div className="bg-bg-elevated/60 rounded-xl px-4 py-3 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-text-muted mb-0.5">Active Voting Power</p>
            {isLoading ? (
              <div className="h-6 w-20 bg-bg-elevated rounded animate-pulse mt-1" />
            ) : (
              <p className="text-xl font-bold text-text-primary">
                {lovelaceToAda(votingPower)} <span className="text-base font-normal text-text-muted">₳</span>
              </p>
            )}
            {!isLoading && !hasVotingPower && (
              <p className="text-xs text-text-muted mt-0.5">chưa có delegator</p>
            )}
          </div>
        </div>

        {/* CTA */}
        <Link
          href={`/dreps/${encodeURIComponent(drepId)}/community${networkParam}`}
          className="block w-full py-3 rounded-xl text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ background: "linear-gradient(90deg, #4f46e5 0%, #a855f7 100%)" }}
        >
          Your DRep Community
        </Link>
      </div>
    </section>
  )
}
