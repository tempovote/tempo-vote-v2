"use client"

import { useState } from "react"
import Link from "next/link"
import { useWallet } from "@/hooks/useWallet"
import { useDRepProfile } from "@/hooks/useDRepProfile"
import { useCommunity } from "@/hooks/useCommunity"
import { resolveAnchorUrls } from "@/lib/governance"
import { useT } from "@/i18n/useT"

// ─── Avatar ──────────────────────────────────────────────────────────────────

function hashToColors(str: string): [string, string] {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  const hue1 = (h >>> 0) % 360
  const hue2 = (hue1 + 137) % 360
  return [`hsl(${hue1},65%,55%)`, `hsl(${hue2},65%,45%)`]
}

const AVATAR_SIZE = 48

function DRepAvatar({ drepId, imageUrl, name }: { drepId: string; imageUrl: string | null; name: string }) {
  const [colors] = useState(() => hashToColors(drepId))
  const [gwIdx, setGwIdx] = useState(0)
  const candidates = resolveAnchorUrls(imageUrl)
  const src = candidates[gwIdx]

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={AVATAR_SIZE}
        height={AVATAR_SIZE}
        className="rounded-full object-cover shrink-0"
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
        onError={() => setGwIdx((i) => i + 1)}
      />
    )
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0 select-none"
      style={{
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        fontSize: AVATAR_SIZE * 0.4,
        background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
      }}
    >
      {(name || drepId).charAt(0).toUpperCase()}
    </div>
  )
}

// ─── Delegated DRep Card ──────────────────────────────────────────────────────

function DelegatedDRepCard({ drepId, network }: { drepId: string; network: string }) {
  const t = useT()
  const { profile, isLoading } = useDRepProfile(drepId, network)
  const { isActive, isLoading: communityLoading } = useCommunity(drepId, network)
  const networkParam = network !== "mainnet" ? `?network=${network}` : ""

  const displayName = profile?.givenName ?? profile?.name ?? `${drepId.slice(0, 12)}…${drepId.slice(-6)}`
  const shortId = `${drepId.slice(0, 14)}…${drepId.slice(-6)}`

  return (
    <section className="card-static space-y-4 animate-slide-up" style={{ animationDelay: "0.1s" }}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
          {t("home.yourDrep.label")}
        </p>
        <span className="badge badge-active">{t("home.yourDrep.delegatedBadge")}</span>
      </div>

      <div className="flex items-center gap-3">
        {isLoading ? (
          <div
            className="rounded-full bg-bg-elevated animate-pulse shrink-0"
            style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
          />
        ) : (
          <DRepAvatar drepId={drepId} imageUrl={profile?.imageUrl ?? null} name={displayName} />
        )}
        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="h-4 bg-bg-elevated rounded w-36 animate-pulse mb-1.5" />
          ) : (
            <p className="font-bold text-sm truncate">{displayName}</p>
          )}
          <p className="font-mono text-xs text-text-muted truncate">{shortId}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Link href={`/dreps/${drepId}${networkParam}`} className="btn-outline flex-1 text-sm text-center">
          {t("home.yourDrep.viewProfile")}
        </Link>
        {communityLoading ? (
          <div className="h-10 flex-1 bg-bg-elevated rounded-xl animate-pulse" />
        ) : isActive ? (
          <Link
            href={`/dreps/${drepId}/community${networkParam}`}
            className="btn-primary flex-1 text-sm text-center"
          >
            {t("home.yourDrep.visitCommunity")}
          </Link>
        ) : null}
      </div>
    </section>
  )
}

// ─── Hero Sections ────────────────────────────────────────────────────────────

export default function HomeHeroSections() {
  const t = useT()
  const { isConnected, isDrepRegistered, delegatedDrep, selectedNetwork } = useWallet()

  // Hide both cards when confirmed DRep — they're irrelevant
  if (isConnected && isDrepRegistered === true) return null

  return (
    <>
      {/* ── Section 1: Become a DRep ─────────────────────────── */}
      <section className="card-accent text-center space-y-4 animate-slide-up">
        <h2 className="text-xl font-bold">{t("home.becomeDrep.title")}</h2>
        <p className="text-text-secondary text-sm max-w-lg mx-auto">
          {t("home.becomeDrep.desc")}
        </p>
        <Link href="/dreps/register" className="btn-primary gap-2 mx-auto">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          {t("home.becomeDrep.cta")}
        </Link>
      </section>

      {/* ── Section 2: Delegated DRep profile or generic CTA ─── */}
      {isConnected && delegatedDrep ? (
        <DelegatedDRepCard drepId={delegatedDrep.id} network={selectedNetwork} />
      ) : (
        <section className="card-static text-center space-y-3 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="text-lg font-bold">{t("home.delegate.title")}</h2>
          <p className="text-sm text-text-secondary max-w-lg mx-auto">
            {t("home.delegate.desc")}
          </p>
          <Link href="/dreps" className="btn-primary mx-auto justify-center">
            {t("home.delegate.cta")}
          </Link>
        </section>
      )}
    </>
  )
}
