"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/"
function resolveLogoSrc(url: string): string {
  return url.startsWith("ipfs://") ? IPFS_GATEWAY + url.slice(7) : url
}
import { useWalletStore } from "@/store/wallet"
import {
  useAllianceDetail,
  useAllianceMembers,
  joinAlliance,
  leaveAlliance,
  type AllianceMember,
} from "@/hooks/useAlliance"
import { useT } from "@/i18n/useT"

type Tab = "overview" | "members"

// ─── Role badge ───────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  const t = useT()
  const colors: Record<string, string> = {
    owner: "bg-accent/20 text-accent-light",
    admin: "bg-yellow-500/20 text-yellow-300",
    member: "bg-bg-card-hover text-text-muted",
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${colors[role] ?? colors.member}`}>
      {t(`alliance.memberRole.${role}` as Parameters<typeof t>[0])}
    </span>
  )
}

// ─── Members tab ──────────────────────────────────────────────────────────────

function MembersTab({ allianceId }: { allianceId: string }) {
  const t = useT()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAllianceMembers(allianceId, page)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-bg-card-hover animate-pulse" />
        ))}
      </div>
    )
  }

  if (!data || data.items.length === 0) {
    return <p className="text-text-muted text-sm py-4">{t("alliance.empty")}</p>
  }

  return (
    <div className="flex flex-col gap-1">
      {data.items.map((member: AllianceMember) => (
        <div
          key={member.id}
          className="flex items-center justify-between px-4 py-3 rounded-lg bg-bg-card hover:bg-bg-card-hover transition-colors"
        >
          <div className="flex flex-col gap-0.5 min-w-0">
            <Link
              href={`/dreps/${encodeURIComponent(member.drepId)}`}
              className="text-sm font-mono text-accent-light hover:underline truncate"
            >
              {member.drepId.slice(0, 20)}…{member.drepId.slice(-8)}
            </Link>
            <span className="text-xs text-text-muted">
              Joined {new Date(member.joinedAt).toLocaleDateString()}
            </span>
          </div>
          <RoleBadge role={member.role} />
        </div>
      ))}

      {data.total > data.items.length && (
        <div className="flex justify-center gap-2 pt-4">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 rounded text-sm bg-bg-card text-text-muted disabled:opacity-40 hover:bg-bg-card-hover"
          >
            ← Prev
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 rounded text-sm bg-bg-card text-text-muted hover:bg-bg-card-hover"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab({ alliance }: { alliance: ReturnType<typeof useAllianceDetail>["alliance"] }) {
  const t = useT()
  if (!alliance) return null

  return (
    <div className="flex flex-col gap-6">
      {/* Charter */}
      <div>
        <h3 className="text-sm font-semibold text-text-secondary mb-2">Charter</h3>
        {alliance.charter ? (
          <div className="prose prose-sm prose-invert max-w-none bg-bg-card rounded-lg p-4 text-sm text-text-secondary whitespace-pre-wrap">
            {alliance.charter}
          </div>
        ) : (
          <p className="text-text-muted text-sm">{t("alliance.overview.noCharter")}</p>
        )}
      </div>

      {/* Governance params */}
      <div>
        <h3 className="text-sm font-semibold text-text-secondary mb-3">
          {t("alliance.overview.governanceParams")}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: t("alliance.overview.approvalVp"), value: `${alliance.approvalThresholdVp}%` },
            { label: t("alliance.overview.approvalCount"), value: `${alliance.approvalThresholdCount}%` },
            { label: t("alliance.overview.quorum"), value: `${alliance.quorumThreshold}%` },
            { label: t("alliance.overview.vpCap"), value: `${alliance.vpCapPct}%` },
            { label: t("alliance.overview.timelock"), value: `${alliance.timelockHours}h` },
            { label: t("alliance.overview.maxWithdrawal"), value: `${alliance.maxWithdrawalPct}%` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-bg-card rounded-lg px-3 py-2.5">
              <div className="text-xs text-text-muted">{label}</div>
              <div className="font-semibold text-text-primary mt-0.5">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Creator */}
      <div className="text-sm text-text-muted">
        {t("alliance.overview.createdBy")}:{" "}
        <Link
          href={`/dreps/${encodeURIComponent(alliance.creatorDrepId)}`}
          className="text-accent-light hover:underline font-mono"
        >
          {alliance.creatorDrepId.slice(0, 20)}…
        </Link>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AllianceDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const { isConnected, isDrepRegistered, drepKey, selectedNetwork, jwt } = useWalletStore()
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const drepId = drepKey?.dRepIDCip105 ?? undefined
  const { alliance, isLoading, error, refetch } = useAllianceDetail(params.id, drepId)

  const myMembership = alliance?.myMembership
  const canJoin = isConnected && isDrepRegistered && !myMembership

  async function handleJoin() {
    if (!jwt) return
    setActionLoading(true)
    setActionError(null)
    try {
      await joinAlliance(params.id, jwt)
      refetch()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : "Failed")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleLeave() {
    if (!jwt || !confirm(t("alliance.leaveConfirm"))) return
    setActionLoading(true)
    setActionError(null)
    try {
      await leaveAlliance(params.id, jwt)
      refetch()
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed"
      if (msg.includes("Owner cannot leave")) setActionError(t("alliance.ownerCannotLeave"))
      else setActionError(msg)
    } finally {
      setActionLoading(false)
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: t("alliance.tabs.overview") },
    { key: "members",  label: t("alliance.tabs.members") },
  ]

  if (isLoading) {
    return (
      <div className="page-container py-8">
        <div className="h-8 w-64 rounded bg-bg-card-hover animate-pulse mb-4" />
        <div className="h-4 w-48 rounded bg-bg-card-hover animate-pulse" />
      </div>
    )
  }

  if (error || !alliance) {
    return (
      <div className="page-container py-8">
        <div className="notice-warning text-sm">Alliance not found.</div>
        <button onClick={() => router.back()} className="mt-4 text-sm text-accent-light hover:underline">
          ← Back
        </button>
      </div>
    )
  }

  return (
    <div className="page-container py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {alliance.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveLogoSrc(alliance.logoUrl)}
              alt={alliance.name}
              className="w-16 h-16 rounded-xl object-cover border border-border-subtle shrink-0 mt-0.5"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-bg-card-hover shrink-0 mt-0.5 flex items-center justify-center text-2xl font-bold text-text-muted">
              {alliance.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-text-primary">{alliance.name}</h1>
            {myMembership && <RoleBadge role={myMembership.role} />}
          </div>
          {alliance.description && (
            <p className="text-sm text-text-muted mt-1.5">{alliance.description}</p>
          )}
          {alliance.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {alliance.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full text-xs bg-bg-card-hover text-text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <div className="text-xs text-text-muted mt-2">
            {alliance.memberCount === 1 ? t("alliance.member") : t("alliance.members", { n: alliance.memberCount })}
            {" · "}{alliance.network}
          </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 items-end shrink-0">
          {myMembership ? (
            myMembership.role !== "owner" && (
              <button
                onClick={handleLeave}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm border border-border-subtle text-text-muted hover:text-danger hover:border-danger transition-colors disabled:opacity-50"
              >
                {t("alliance.leaveBtn")}
              </button>
            )
          ) : (
            canJoin && (
              <button
                onClick={handleJoin}
                disabled={actionLoading}
                className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                {t("alliance.joinBtn")}
              </button>
            )
          )}
          {actionError && <div className="text-xs text-danger max-w-48 text-right">{actionError}</div>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-subtle mb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? "border-accent text-accent-light"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab alliance={alliance} />}
      {activeTab === "members" && <MembersTab allianceId={params.id} />}
    </div>
  )
}
