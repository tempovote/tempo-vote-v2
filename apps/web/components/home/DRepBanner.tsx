"use client"

import { useState } from "react"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useWallet } from "@/hooks/useWallet"
import { useDRepProfile } from "@/hooks/useDRepProfile"
import { useDRepStats } from "@/hooks/useDRepStats"
import { useTx } from "@/hooks/useTx"
import { resolveAnchorUrl } from "@/lib/governance"

// ── Helpers ───────────────────────────────────────────────────────────────────

function hashToColors(str: string): [string, string] {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  const hue1 = (h >>> 0) % 360
  return [`hsl(${hue1},65%,55%)`, `hsl(${(hue1 + 137) % 360},65%,45%)`]
}

function shortId(id: string) {
  return id.length <= 20 ? id : `${id.slice(0, 12)}…${id.slice(-6)}`
}

function formatAda(lovelace: number): string {
  const ada = lovelace / 1_000_000
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(2)}M`
  if (ada >= 1_000)     return `${(ada / 1_000).toFixed(1)}K`
  return ada.toFixed(2)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Avatar({ drepId, imageUrl, name }: { drepId: string; imageUrl: string | null; name: string | null }) {
  const [colors] = useState(() => hashToColors(drepId))
  const [imgErr, setImgErr] = useState(false)
  const initial = (name ?? drepId).charAt(0).toUpperCase()
  const size = 56

  if (imageUrl && !imgErr) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name ?? drepId}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
        onError={() => setImgErr(true)}
      />
    )
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0 select-none"
      style={{ width: size, height: size, fontSize: size * 0.4, background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})` }}
    >
      {initial}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) }) }}
      className="text-text-muted hover:text-accent-light transition-colors"
      title="Copy DRep ID"
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-success">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

function StatCell({ label, value, loading, highlight = false, danger = false }: {
  label: string; value: string | null; loading: boolean; highlight?: boolean; danger?: boolean
}) {
  return (
    <div className="px-3 py-2.5 space-y-0.5">
      <p className="text-[11px] text-text-muted leading-tight">{label}</p>
      {loading && !value ? (
        <div className="h-5 w-20 bg-bg-elevated rounded animate-pulse mt-1" />
      ) : (
        <p className={`text-sm font-bold leading-tight ${danger ? "text-danger" : highlight ? "text-accent-light" : "text-text-primary"}`}>
          {value ?? "—"}
        </p>
      )}
    </div>
  )
}

// ── Self-delegate CTA (unchanged logic) ──────────────────────────────────────

function SelfDelegateNotice({ drepId, drepName }: { drepId: string; drepName: string | null }) {
  const { submitTx, isReady } = useTx()
  const { refreshDRepStatus } = useWallet()
  const { isDrepRegistered, setDRepStatus } = useWalletStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSelfDelegate() {
    if (!isReady || loading) return
    setLoading(true)
    setError(null)
    try {
      await submitTx("DELEGATE", { targetDrepId: drepId, delegationType: "drep" })
      setDRepStatus({
        isDrepRegistered: isDrepRegistered ?? true,
        drepName: drepName ?? null,
        delegatedDrep: { id: drepId, name: drepName ?? null },
      })
      setTimeout(() => { refreshDRepStatus().catch(() => {}) }, 30_000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "TX thất bại")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl px-4 py-3 bg-warning/10 border border-warning/30 space-y-3">
      <div className="flex items-start gap-2.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-warning shrink-0 mt-0.5">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-warning leading-snug">Voting Power chưa được kích hoạt</p>
          <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
            Bạn chưa self-delegate stake về DRep này.
            Voting power sẽ bằng <span className="font-semibold text-warning/90">0 ₳</span> cho đến khi hoàn tất bước này.
          </p>
        </div>
      </div>
      {error && <p className="text-xs text-danger bg-danger/10 rounded-lg px-3 py-1.5">{error}</p>}
      <button
        onClick={handleSelfDelegate}
        disabled={!isReady || loading}
        className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all bg-warning text-bg-primary hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Đang xử lý…</>
        ) : (
          <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>Self-Delegate ngay</>
        )}
      </button>
    </div>
  )
}

function PendingEpochNote() {
  return (
    <div className="rounded-xl px-4 py-3 bg-accent/10 border border-accent/20 flex items-start gap-2.5">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-light shrink-0 mt-0.5">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      <div>
        <p className="text-xs font-semibold text-accent-light leading-snug">Delegation đã xác nhận</p>
        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">Voting power sẽ được cập nhật vào đầu epoch tiếp theo.</p>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function DRepBanner() {
  const { isDrepRegistered, drepKey, delegatedDrep, drepStatusLoading, selectedNetwork } = useWalletStore()
  const drepId = drepKey?.dRepIDCip105 ?? null

  const { profile, isLoading: profileLoading } = useDRepProfile(drepId ?? "", selectedNetwork)
  const { stats, loading: statsLoading } = useDRepStats(drepId, selectedNetwork)

  if (!isDrepRegistered || !drepId) return null

  const name       = profile?.givenName ?? profile?.name ?? null
  const displayName = name ?? shortId(drepId)
  const imageUrl   = profile?.imageUrl ? resolveAnchorUrl(profile.imageUrl) : null
  const networkParam = selectedNetwork !== "mainnet" ? `?network=${selectedNetwork}` : ""

  const anyLoading      = profileLoading || drepStatusLoading
  const needsSelfDelegate = !anyLoading && delegatedDrep?.id !== drepId
  const pendingEpoch    = !needsSelfDelegate && !stats?.activeVotingPower && delegatedDrep?.id === drepId

  return (
    <section className="card-static space-y-5 animate-slide-up">

      {/* Header: avatar + name + ID + status */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar drepId={drepId} imageUrl={imageUrl} name={name} />
          <div className="min-w-0 space-y-1">
            {anyLoading && !name ? (
              <div className="space-y-1.5">
                <div className="h-5 w-32 bg-bg-elevated rounded animate-pulse" />
                <div className="h-3.5 w-44 bg-bg-elevated rounded animate-pulse" />
              </div>
            ) : (
              <>
                <h2 className="text-lg font-bold leading-tight">{displayName}</h2>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-text-muted bg-bg-elevated px-2 py-0.5 rounded border border-border-subtle">
                    {shortId(drepId)}
                  </span>
                  <CopyButton text={drepId} />
                </div>
              </>
            )}
          </div>
        </div>
        <span className="badge badge-active shrink-0">Active</span>
      </div>

      {/* Stats grid 2×3 */}
      <div className="bg-bg-secondary rounded-xl border border-border-subtle divide-y divide-border-subtle">
        <div className="grid grid-cols-3 divide-x divide-border-subtle">
          <StatCell
            label="Active Voting Power"
            value={stats ? `${formatAda(stats.activeVotingPower)} ₳` : profile?.votingPower != null ? `${formatAda(profile.votingPower)} ₳` : null}
            loading={statsLoading && !stats}
          />
          <StatCell
            label="Live Voting Power"
            value={stats ? `${formatAda(stats.liveVotingPower)} ₳` : null}
            loading={statsLoading}
          />
          <StatCell
            label="Delegators"
            value={stats ? stats.delegatorCount.toLocaleString() : null}
            loading={statsLoading}
          />
        </div>
        <div className="grid grid-cols-3 divide-x divide-border-subtle">
          <StatCell
            label="Influence Power"
            value={stats ? `${stats.influencePower.toFixed(2)}%` : null}
            loading={statsLoading}
            highlight
          />
          <StatCell
            label="Voted"
            value={stats ? `${stats.votedPercent.toFixed(2)}%` : null}
            loading={statsLoading}
            highlight
          />
          <StatCell
            label="Not Voted"
            value={stats ? `${stats.notVotedPercent.toFixed(2)}%` : null}
            loading={statsLoading}
            danger={!!stats && stats.notVotedPercent > 10}
          />
        </div>
      </div>

      {/* Self-delegate CTA */}
      {needsSelfDelegate && (
        <SelfDelegateNotice drepId={drepId} drepName={name} />
      )}

      {/* Pending epoch info */}
      {pendingEpoch && <PendingEpochNote />}

      {/* Community CTA */}
      <Link
        href={`/dreps/${encodeURIComponent(drepId)}/community${networkParam}`}
        className="block w-full py-3 rounded-xl text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: "linear-gradient(90deg, #4f46e5 0%, #a855f7 100%)" }}
      >
        Your DRep Community
      </Link>

    </section>
  )
}
