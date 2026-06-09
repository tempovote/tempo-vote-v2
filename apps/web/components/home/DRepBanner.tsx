"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useWalletStore } from "@/store/wallet"
import { useDRepProfile } from "@/hooks/useDRepProfile"
import { useTx } from "@/hooks/useTx"
import { resolveAnchorUrl } from "@/lib/governance"

function lovelaceToAda(lovelace: number | null): string {
  if (!lovelace || lovelace === 0) return "0"
  return (lovelace / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })
}

function SelfDelegateNotice({ drepId }: { drepId: string }) {
  const { submitTx, isReady } = useTx()
  const [loading, setLoading]   = useState(false)
  const [txHash, setTxHash]     = useState<string | null>(null)
  const [error, setError]       = useState<string | null>(null)

  async function handleSelfDelegate() {
    if (!isReady || loading) return
    setLoading(true)
    setError(null)
    try {
      const hash = await submitTx("DELEGATE", { targetDrepId: drepId, delegationType: "drep" })
      setTxHash(hash)
    } catch (e) {
      setError(e instanceof Error ? e.message : "TX thất bại")
    } finally {
      setLoading(false)
    }
  }

  if (txHash) {
    return (
      <div className="rounded-xl px-4 py-3 bg-success/10 border border-success/30 space-y-1">
        <p className="text-sm font-semibold text-success">Self-delegate thành công!</p>
        <p className="text-xs text-text-muted">
          Voting power sẽ được cập nhật vào epoch tiếp theo.
        </p>
        <p className="text-[11px] font-mono text-text-muted break-all">TX: {txHash}</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl px-4 py-3 bg-warning/10 border border-warning/30 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-2.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning shrink-0 mt-0.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-warning leading-snug">
            Voting Power chưa được kích hoạt
          </p>
          <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
            Bạn chưa self-delegate stake của mình về DRep này.
            Voting power sẽ bằng&nbsp;
            <span className="font-semibold text-warning/90">0 ₳</span>
            &nbsp;cho đến khi hoàn tất bước này.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-1.5">{error}</p>
      )}

      <button
        onClick={handleSelfDelegate}
        disabled={!isReady || loading}
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all
          bg-warning text-bg-primary hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Đang xử lý…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Self-Delegate ngay
          </>
        )}
      </button>
    </div>
  )
}

export function DRepBanner() {
  const { isDrepRegistered, drepKey, delegatedDrep, selectedNetwork } = useWalletStore()
  const drepId = drepKey?.dRepIDCip105 ?? null

  const { profile, isLoading } = useDRepProfile(drepId ?? "", selectedNetwork)

  if (!isDrepRegistered || !drepId) return null

  const name         = profile?.givenName ?? profile?.name ?? drepId.slice(0, 12) + "…"
  const avatarUrl    = profile?.imageUrl ? resolveAnchorUrl(profile.imageUrl) : null
  const votingPower  = profile?.votingPower ?? null
  const hasVotingPower = votingPower !== null && votingPower > 0
  const networkParam = selectedNetwork !== "mainnet" ? `?network=${selectedNetwork}` : ""

  // Show CTA when registered but stake not delegated to own DRep ID
  const needsSelfDelegate = drepId && delegatedDrep?.id !== drepId

  return (
    <section className="animate-slide-up">
      <div className="card-accent rounded-2xl p-5 space-y-4">
        {/* Top row: avatar + name + status */}
        <div className="flex items-center gap-4">
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
            {!isLoading && !hasVotingPower && !needsSelfDelegate && (
              <p className="text-xs text-text-muted mt-0.5">chưa có delegator</p>
            )}
          </div>
        </div>

        {/* Self-delegate CTA — shown when stake not yet delegated to own DRep */}
        {!isLoading && needsSelfDelegate && (
          <SelfDelegateNotice drepId={drepId} />
        )}

        {/* Community CTA */}
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
