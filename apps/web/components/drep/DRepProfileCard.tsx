"use client"

import { useState } from "react"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { resolveAnchorUrls } from "@/lib/governance"
import { useT } from "@/i18n/useT"
import type { DRepFullProfile } from "@/hooks/useDRepProfile"
import type { DRepStats } from "@tempo/types"

// ─── Avatar ──────────────────────────────────────────────────────────────────

function hashToColors(str: string): [string, string] {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  const hue1 = (h >>> 0) % 360
  const hue2 = (hue1 + 137) % 360
  return [`hsl(${hue1},65%,55%)`, `hsl(${hue2},65%,45%)`]
}

export function DRepAvatar({ drepId, imageUrl, name, size = 64 }: {
  drepId: string
  imageUrl: string | null
  name: string | null
  size?: number
}) {
  const [colors] = useState(() => hashToColors(drepId))
  const [gwIdx, setGwIdx] = useState(0)
  const initial = (name ?? drepId).charAt(0).toUpperCase()
  const candidates = resolveAnchorUrls(imageUrl)
  const src = candidates[gwIdx]

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? drepId}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
        onError={() => setGwIdx((i) => i + 1)}
      />
    )
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0 select-none"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
      }}
    >
      {initial}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function shortDrepId(id: string): string {
  if (id.length <= 20) return id
  return `${id.slice(0, 12)}…${id.slice(-6)}`
}

export function formatAda(lovelace: number): string {
  const ada = lovelace / 1_000_000
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(2)}M`
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(1)}K`
  return ada.toFixed(0)
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        } else {
          const el = document.createElement("textarea")
          el.value = text
          el.style.position = "fixed"
          el.style.opacity = "0"
          document.body.appendChild(el)
          el.select()
          document.execCommand("copy")
          document.body.removeChild(el)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }
      }}
      className="text-text-muted hover:text-accent-light transition-colors"
      title="Copy DRep ID"
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-success">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

// ─── Stat Cell ────────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  loading,
  fallback = "—",
  highlight = false,
  danger = false,
}: {
  label: string
  value: string | null
  loading: boolean
  fallback?: string
  highlight?: boolean
  danger?: boolean
}) {
  return (
    <div className="px-3 py-2.5 space-y-0.5">
      <p className="text-[11px] text-text-muted leading-tight">{label}</p>
      {loading && !value ? (
        <div className="h-5 w-20 bg-bg-elevated rounded animate-pulse mt-1" />
      ) : (
        <p className={`text-sm font-bold leading-tight ${danger ? "text-danger" : highlight ? "text-accent-light" : "text-text-primary"}`}>
          {value ?? fallback}
        </p>
      )}
    </div>
  )
}

// ─── DRep Profile Card ────────────────────────────────────────────────────────

export interface DRepProfileCardProps {
  profile: DRepFullProfile
  drepStats: DRepStats | null
  statsLoading: boolean
  network: string
  isActive: boolean
  communityLoading: boolean
  activating?: boolean
  activateError?: string | null
  onDelegate?: () => void
  onActivateCommunity?: () => void
}

export function DRepProfileCard({
  profile,
  drepStats,
  statsLoading,
  network,
  isActive,
  communityLoading,
  activating = false,
  activateError = null,
  onDelegate,
  onActivateCommunity,
}: DRepProfileCardProps) {
  const t = useT()
  const drepKey = useWalletStore((s) => s.drepKey)
  const delegatedDrep = useWalletStore((s) => s.delegatedDrep)
  const isDrepRegistered = useWalletStore((s) => s.isDrepRegistered)

  const displayName = profile.givenName ?? profile.name ?? shortDrepId(profile.id)
  const isOwner = !!drepKey?.dRepIDCip105 && drepKey.dRepIDCip105 === profile.id
  const alreadyDelegatedToThis = delegatedDrep?.id === profile.id
  const networkParam = network !== "mainnet" ? `?network=${network}` : ""
  const showDelegateBtn = !isOwner && !alreadyDelegatedToThis && isDrepRegistered !== true

  return (
    <div className="card-static space-y-5">
      {/* Name + avatar row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <DRepAvatar drepId={profile.id} imageUrl={profile.imageUrl} name={displayName} size={64} />
          <div className="min-w-0 space-y-1">
            <p className="text-xl font-bold leading-tight break-words">{displayName}</p>
            {profile.adaHandle && (
              <p className="text-sm font-medium text-accent-light leading-none">
                ${profile.adaHandle}
              </p>
            )}
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-text-muted bg-bg-elevated px-2 py-0.5 rounded border border-border-subtle">
                {shortDrepId(profile.id)}
              </span>
              <CopyButton text={profile.id} />
            </div>
          </div>
        </div>

        {/* Status chip + Share */}
        <div className="flex items-center gap-2 shrink-0">
          {profile.active ? (
            <span className="badge badge-active">{t("common.status.active")}</span>
          ) : (
            <span className="badge badge-expired">{t("common.status.expired")}</span>
          )}
          <button
            onClick={() =>
              navigator.clipboard.writeText(
                `${window.location.origin}/dreps/${profile.id}${networkParam}`
              )
            }
            className="p-2 rounded-lg border border-border-subtle text-text-muted hover:text-text-primary hover:border-border-default transition-colors"
            title={t("drepDetail.copyLink")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats grid */}
      <div className="bg-bg-secondary rounded-xl border border-border-subtle divide-y divide-border-subtle">
        <div className="grid grid-cols-3 divide-x divide-border-subtle">
          <StatCell
            label={t("drepDetail.statActiveVp")}
            value={drepStats ? `${formatAda(drepStats.activeVotingPower)} ₳` : profile.votingPower != null ? `${formatAda(profile.votingPower)} ₳` : null}
            loading={statsLoading && !drepStats}
            fallback={profile.isRegistered ? "0 ₳" : "—"}
          />
          <StatCell
            label={t("drepDetail.statLiveVp")}
            value={drepStats ? `${formatAda(drepStats.liveVotingPower)} ₳` : null}
            loading={statsLoading}
          />
          <StatCell
            label={t("drepDetail.statDelegators")}
            value={drepStats ? drepStats.delegatorCount.toLocaleString() : null}
            loading={statsLoading}
          />
        </div>
        <div className="grid grid-cols-3 divide-x divide-border-subtle">
          <StatCell
            label={t("drepDetail.statInfluence")}
            value={drepStats ? `${drepStats.influencePower.toFixed(2)}%` : null}
            loading={statsLoading}
            highlight
          />
          <StatCell
            label={t("drepDetail.statVoted")}
            value={drepStats ? `${drepStats.votedPercent.toFixed(2)}%` : null}
            loading={statsLoading}
            highlight
          />
          <StatCell
            label={t("drepDetail.statNotVoted")}
            value={drepStats ? `${drepStats.notVotedPercent.toFixed(2)}%` : null}
            loading={statsLoading}
            danger={!!drepStats && drepStats.notVotedPercent > 10}
          />
        </div>
      </div>

      {/* CTA buttons */}
      {activateError && <p className="text-xs text-danger">{activateError}</p>}
      <div className="flex gap-3">
        {showDelegateBtn && (
          <button className="btn-primary flex-1 text-sm" onClick={onDelegate}>
            {t("drepDetail.delegateBtn")}
          </button>
        )}

        {communityLoading ? (
          <div className="h-10 flex-1 bg-bg-elevated rounded-xl animate-pulse" />
        ) : isActive ? (
          <Link
            href={`/dreps/${profile.id}/community${networkParam}`}
            className={`${isOwner || alreadyDelegatedToThis ? "btn-primary" : "btn-outline"} flex-1 text-sm text-center`}
          >
            {isOwner || alreadyDelegatedToThis ? t("drepDetail.communityBtn") : t("drepDetail.viewCommunityBtn")}
          </Link>
        ) : isOwner ? (
          <button
            onClick={onActivateCommunity}
            disabled={activating}
            className="btn-primary flex-1 text-sm"
          >
            {activating ? t("drepDetail.activating") : t("drepDetail.activateCommunityBtn")}
          </button>
        ) : null}
      </div>
    </div>
  )
}
