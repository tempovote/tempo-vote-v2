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
import {
  useAllianceProposals,
  type ProposalItem,
} from "@/hooks/useAllianceProposals"
import { useT } from "@/i18n/useT"
import DRepAvatar from "@/components/drep/DRepAvatar"

type Tab = "overview" | "members" | "ga_positions" | "proposals"

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
          <Link
            href={`/dreps/${encodeURIComponent(member.drepId)}`}
            className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity"
          >
            <DRepAvatar
              name={member.name ?? null}
              imageUrl={member.imageUrl ?? null}
              credHex={member.drepId}
              size="sm"
            />
            <div className="flex flex-col gap-0.5 min-w-0">
              {member.name ? (
                <span className="text-sm font-medium text-text-primary truncate">{member.name}</span>
              ) : (
                <span className="text-sm font-mono text-accent-light truncate">
                  {member.drepId.slice(0, 20)}…{member.drepId.slice(-8)}
                </span>
              )}
              <span className="text-xs text-text-muted">
                {t("alliance.joinedAt", { date: new Date(member.joinedAt).toLocaleDateString() })}
              </span>
            </div>
          </Link>
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

// ─── Status chip ──────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const t = useT()
  const colors: Record<string, string> = {
    voting:           "bg-accent/20 text-accent-light",
    approved_pending: "bg-yellow-500/20 text-yellow-300",
    approved:         "bg-green-500/20 text-green-300",
    passed:           "bg-green-500/20 text-green-300",
    rejected:         "bg-danger/20 text-danger",
    failed:           "bg-danger/20 text-danger",
    executed:         "bg-blue-500/20 text-blue-300",
    cancelled:        "bg-bg-card-hover text-text-muted",
  }
  const key = `alliance.proposal.status.${status}` as Parameters<typeof t>[0]
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? colors.voting}`}>
      {t(key)}
    </span>
  )
}

// ─── Vote badge ────────────────────────────────────────────────────────────────

function VoteBadge({ vote }: { vote: string }) {
  const colors = { YES: "text-vote-bar-yes", NO: "text-vote-bar-no", ABSTAIN: "text-text-muted" }
  return (
    <span className={`text-xs font-bold ${colors[vote as keyof typeof colors] ?? "text-text-muted"}`}>
      {vote}
    </span>
  )
}

// ─── Tally bar ────────────────────────────────────────────────────────────────

function TallyBar({ tally }: { tally: ProposalItem["tally"] }) {
  const t = useT()
  const total = tally.yesCount + tally.noCount + tally.abstainCount
  if (total === 0) return (
    <div className="h-1.5 w-full rounded-full bg-bg-card-hover" />
  )
  const yesPct   = (tally.yesCount   / total) * 100
  const noPct    = (tally.noCount    / total) * 100

  return (
    <div className="space-y-0.5">
      <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-bg-card-hover">
        <div style={{ width: `${yesPct}%` }}   className="bg-vote-bar-yes" />
        <div style={{ width: `${noPct}%` }}    className="bg-vote-bar-no" />
      </div>
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span className="text-vote-bar-yes">{tally.yesCount} {t("alliance.proposal.tally.yes")}</span>
        <span className="text-vote-bar-no">{tally.noCount} {t("alliance.proposal.tally.no")}</span>
        <span>{tally.abstainCount} {t("alliance.proposal.tally.abstain")}</span>
        <span className="ml-auto">
          {t("alliance.proposal.tally.voted", { n: String(tally.totalVoted), total: String(tally.totalMembers) })}
        </span>
      </div>
    </div>
  )
}

// ─── Proposal card ────────────────────────────────────────────────────────────

function ProposalCard({ proposal, allianceId }: { proposal: ProposalItem; allianceId: string }) {
  const t = useT()
  const isActive = proposal.status === "voting"
  const endsAt = new Date(proposal.votingEndsAt)
  const now = new Date()

  return (
    <Link
      href={`/alliances/${allianceId}/proposals/${proposal.id}`}
      className="block bg-bg-card hover:bg-bg-card-hover transition-colors rounded-xl p-4 border border-border-subtle"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <StatusChip status={proposal.status} />
            {proposal.myVote && <VoteBadge vote={proposal.myVote} />}
          </div>
          <h4 className="text-sm font-semibold text-text-primary truncate">{proposal.title}</h4>
          {proposal.proposerName && (
            <p className="text-xs text-text-muted mt-0.5">by {proposal.proposerName}</p>
          )}
        </div>
        {proposal.proposalType === "withdrawal" && proposal.amountLovelace && (
          <div className="text-right shrink-0">
            <div className="text-sm font-bold text-accent-light">
              {(proposal.amountLovelace / 1_000_000).toLocaleString()} ₳
            </div>
          </div>
        )}
      </div>
      <TallyBar tally={proposal.tally} />
      <div className="mt-2 text-xs text-text-muted">
        {isActive && endsAt > now
          ? t("alliance.proposal.ends", { date: endsAt.toLocaleDateString() })
          : t("alliance.proposal.ended", { date: endsAt.toLocaleDateString() })}
      </div>
    </Link>
  )
}

// ─── Proposals tab ────────────────────────────────────────────────────────────

function ProposalsTab({
  allianceId,
  drepId,
  myMemberRole,
}: {
  allianceId: string
  drepId?: string
  myMemberRole?: string
}) {
  const t = useT()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAllianceProposals(allianceId, {
    type: "withdrawal",
    drepId,
    page,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-bg-card-hover animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {myMemberRole && (
        <div className="flex justify-end">
          <Link
            href={`/alliances/${allianceId}/proposals/new?type=withdrawal`}
            className="btn-primary px-4 py-2 text-sm"
          >
            {t("alliance.proposal.createBtn")}
          </Link>
        </div>
      )}

      {!data || data.items.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-text-muted text-sm">{t("alliance.proposal.empty")}</p>
          {myMemberRole && (
            <p className="text-text-muted text-xs mt-1">{t("alliance.proposal.emptyHint")}</p>
          )}
        </div>
      ) : (
        <>
          {data.items.map((p) => (
            <ProposalCard key={p.id} proposal={p} allianceId={allianceId} />
          ))}
          {data.total > data.items.length && (
            <div className="flex justify-center gap-2 pt-2">
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
        </>
      )}
    </div>
  )
}

// ─── GA Positions tab ─────────────────────────────────────────────────────────

function GAPositionsTab({
  allianceId,
  drepId,
  myMemberRole,
}: {
  allianceId: string
  drepId?: string
  myMemberRole?: string
}) {
  const t = useT()
  const [page, setPage] = useState(1)
  const { data, isLoading } = useAllianceProposals(allianceId, {
    type: "ga_stance",
    drepId,
    page,
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-bg-card-hover animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {myMemberRole && (
        <div className="flex justify-end">
          <Link
            href={`/alliances/${allianceId}/proposals/new?type=ga_stance`}
            className="btn-primary px-4 py-2 text-sm"
          >
            {t("alliance.proposal.createBtn")}
          </Link>
        </div>
      )}

      {!data || data.items.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-text-muted text-sm">{t("alliance.gaPositions.empty")}</p>
          {myMemberRole && (
            <p className="text-text-muted text-xs mt-1">{t("alliance.gaPositions.emptyHint")}</p>
          )}
        </div>
      ) : (
        <>
          {data.items.map((p) => (
            <ProposalCard key={p.id} proposal={p} allianceId={allianceId} />
          ))}
          {data.total > data.items.length && (
            <div className="flex justify-center gap-2 pt-2">
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
        </>
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
      <div className="flex items-center gap-3 text-sm text-text-muted">
        <span>{new Date(alliance.createdAt).toLocaleDateString()}</span>
        <span>·</span>
        <Link
          href={`/dreps/${encodeURIComponent(alliance.creatorDrepId)}`}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <DRepAvatar
            name={alliance.creatorName ?? null}
            imageUrl={alliance.creatorImageUrl ?? null}
            credHex={alliance.creatorDrepId}
            size="sm"
          />
          <span className={alliance.creatorName ? "text-text-primary font-medium" : "font-mono text-accent-light"}>
            {alliance.creatorName ?? `${alliance.creatorDrepId.slice(0, 20)}…`}
          </span>
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
    { key: "overview",     label: t("alliance.tabs.overview") },
    { key: "members",      label: t("alliance.tabs.members") },
    { key: "ga_positions", label: t("alliance.tabs.gaPositions") },
    { key: "proposals",    label: t("alliance.tabs.proposals") },
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
      {activeTab === "ga_positions" && (
        <GAPositionsTab
          allianceId={params.id}
          drepId={drepId}
          myMemberRole={myMembership?.role}
        />
      )}
      {activeTab === "proposals" && (
        <ProposalsTab
          allianceId={params.id}
          drepId={drepId}
          myMemberRole={myMembership?.role}
        />
      )}
    </div>
  )
}
