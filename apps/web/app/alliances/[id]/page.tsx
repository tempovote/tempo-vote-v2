"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"

const IPFS_GATEWAY = "https://gateway.pinata.cloud/ipfs/"
function resolveLogoSrc(url: string): string {
  return url.startsWith("ipfs://") ? IPFS_GATEWAY + url.slice(7) : url
}

function jwtHasDrepId(token: string): boolean {
  try {
    const part = token.split(".")[1]
    if (!part) return false
    const payload = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")))
    return typeof payload.drepId === "string" && payload.drepId.length > 0
  } catch {
    return false
  }
}
import { useWalletStore } from "@/store/wallet"
import { useWallet } from "@/hooks/useWallet"
import {
  useAllianceDetail,
  useAllianceMembers,
  useTreasuryBalance,
  joinAlliance,
  leaveAlliance,
  updateMemberRole,
  removeMember,
  type AllianceMember,
  type TreasuryUtxo,
} from "@/hooks/useAlliance"
import {
  useAllianceProposals,
  type ProposalItem,
} from "@/hooks/useAllianceProposals"
import { useT } from "@/i18n/useT"
import { useTx } from "@/hooks/useTx"
import DRepAvatar from "@/components/drep/DRepAvatar"

type Tab = "overview" | "members" | "ga_positions" | "proposals" | "treasury"

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

function MembersTab({
  allianceId,
  myMemberRole,
  myDrepId,
}: {
  allianceId: string
  myMemberRole?: string
  myDrepId?: string
}) {
  const t = useT()
  const { jwt: storedJwt } = useWalletStore()
  const { reauthenticate } = useWallet()
  const [page, setPage] = useState(1)
  const { data, isLoading, refetch } = useAllianceMembers(allianceId, page)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const canManage = myMemberRole === "owner" || myMemberRole === "admin"

  async function ensureJwt(): Promise<string | null> {
    // JWT without drepId claim → API returns 403; always reauthenticate in that case
    if (storedJwt && jwtHasDrepId(storedJwt)) return storedJwt
    return await reauthenticate().catch(() => null)
  }

  async function handleRoleChange(member: AllianceMember) {
    const jwt = await ensureJwt()
    if (!jwt) return
    const newRole = member.role === "admin" ? "member" : "admin"
    setActionLoading(member.drepId)
    setActionError(null)
    try {
      await updateMemberRole(allianceId, member.drepId, newRole, jwt)
      refetch()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : t("alliance.memberActionError"))
    } finally {
      setActionLoading(null)
    }
  }

  async function handleKick(member: AllianceMember) {
    if (!confirm(t("alliance.kickConfirm"))) return
    const jwt = await ensureJwt()
    if (!jwt) return
    setActionLoading(member.drepId)
    setActionError(null)
    try {
      await removeMember(allianceId, member.drepId, jwt)
      refetch()
    } catch (e: unknown) {
      setActionError(e instanceof Error ? e.message : t("alliance.memberActionError"))
    } finally {
      setActionLoading(null)
    }
  }

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
      {actionError && (
        <div className="notice-warning text-xs px-3 py-2 rounded-lg mb-2">{actionError}</div>
      )}
      {data.items.map((member: AllianceMember) => {
        const isOwner = member.role === "owner"
        const isSelf = member.drepId === myDrepId
        const showActions = canManage && !isOwner && !isSelf
        const busy = actionLoading === member.drepId

        return (
          <div
            key={member.id}
            className="flex items-center justify-between px-4 py-3 rounded-lg bg-bg-card hover:bg-bg-card-hover transition-colors gap-3"
          >
            <Link
              href={`/dreps/${encodeURIComponent(member.drepId)}`}
              className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity flex-1"
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

            <div className="flex items-center gap-2 shrink-0">
              <RoleBadge role={member.role} />
              {showActions && (
                <>
                  <button
                    onClick={() => handleRoleChange(member)}
                    disabled={busy}
                    title={member.role === "admin" ? t("alliance.demoteToMember") : t("alliance.makeAdmin")}
                    className="px-2.5 py-1 rounded-lg text-xs border border-border-subtle text-text-muted hover:text-text-secondary hover:border-text-muted transition-colors disabled:opacity-40"
                  >
                    {busy ? "…" : member.role === "admin" ? t("alliance.demoteToMember") : t("alliance.makeAdmin")}
                  </button>
                  <button
                    onClick={() => handleKick(member)}
                    disabled={busy}
                    title={t("alliance.kickMember")}
                    className="px-2.5 py-1 rounded-lg text-xs border border-border-subtle text-text-muted hover:text-danger hover:border-danger transition-colors disabled:opacity-40"
                  >
                    {t("alliance.kickMember")}
                  </button>
                </>
              )}
            </div>
          </div>
        )
      })}

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

// ─── Treasury tab ─────────────────────────────────────────────────────────────

function cardanoscanTxUrl(txHash: string, network: string) {
  return network === "mainnet"
    ? `https://cardanoscan.io/transaction/${txHash}`
    : `https://preprod.cardanoscan.io/transaction/${txHash}`
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 2000) }
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => execCopy())
    } else {
      execCopy()
    }
    function execCopy() {
      const el = document.createElement("textarea")
      el.value = text
      el.style.cssText = "position:fixed;opacity:0"
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
      done()
    }
  }
  return (
    <button
      onClick={handleCopy}
      title="Copy address"
      className="ml-1.5 shrink-0 text-text-muted hover:text-text-secondary transition-colors"
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

type HistoryEntry =
  | { kind: "contribute"; txHash: string; outputIndex: number; lovelace: number }
  | { kind: "withdraw"; txHash: string; lovelace: number; recipientAddress: string | null; title: string; date: string | null }

function TreasuryTab({ allianceId, isMember, network }: { allianceId: string; isMember: boolean; network: string }) {
  const t = useT()
  const { submitTx } = useTx()
  const { data, isLoading, error, refetch } = useTreasuryBalance(allianceId)
  const { data: proposalData } = useAllianceProposals(allianceId, { type: "withdrawal" })
  const [showContribute, setShowContribute] = useState(false)
  const [contributeAda, setContributeAda] = useState("")
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleContribute() {
    const lovelace = Math.round(parseFloat(contributeAda) * 1_000_000)
    if (!lovelace || lovelace < 2_000_000) return
    setLoading(true)
    setTxError(null)
    setSuccessTxHash(null)
    try {
      const txHash = await submitTx("ALLIANCE_TREASURY_CONTRIBUTE", {
        allianceId,
        amountLovelace: lovelace,
      })
      setSuccessTxHash(txHash)
      setShowContribute(false)
      setContributeAda("")
      setTimeout(refetch, 4000)
    } catch (e: unknown) {
      setTxError(e instanceof Error ? e.message : t("alliance.treasury.contributeError"))
    } finally {
      setLoading(false)
    }
  }

  if (isLoading) return <div className="h-32 rounded-xl bg-bg-card-hover animate-pulse" />
  if (error) return <div className="notice-warning text-sm">{error}</div>

  const balanceAda = ((data?.balanceLovelace ?? 0) / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 2 })

  return (
    <div className="flex flex-col gap-5">
      {/* Balance card */}
      <div className="card-static rounded-xl p-5 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs text-text-muted mb-1">{t("alliance.treasury.balance")}</div>
          <div className="text-2xl font-bold text-text-primary">{balanceAda} ₳</div>
          {data?.treasuryAddress && (
            <div className="flex items-center mt-1.5">
              <span className="text-xs text-text-muted font-mono">
                {data.treasuryAddress.slice(0, 24)}…{data.treasuryAddress.slice(-8)}
              </span>
              <CopyButton text={data.treasuryAddress} />
            </div>
          )}
        </div>
        {isMember && (
          <button
            onClick={() => { setShowContribute(!showContribute); setSuccessTxHash(null) }}
            className="btn-primary px-4 py-2 text-sm shrink-0"
          >
            {t("alliance.treasury.contributeBtn")}
          </button>
        )}
      </div>

      {/* Contribute form */}
      {showContribute && (
        <div className="card-static rounded-xl p-4 flex flex-col gap-3">
          <h4 className="text-sm font-semibold text-text-secondary">{t("alliance.treasury.contributeTitle")}</h4>
          <div className="flex gap-2">
            <input
              type="number"
              min="2"
              step="1"
              placeholder={t("alliance.treasury.contributeAmountLabel")}
              value={contributeAda}
              onChange={(e) => setContributeAda(e.target.value)}
              className="flex-1 bg-bg-card border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary"
            />
            <button
              onClick={handleContribute}
              disabled={loading || !contributeAda || parseFloat(contributeAda) < 2}
              className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
            >
              {loading ? "…" : t("alliance.treasury.contributeSubmit")}
            </button>
          </div>
          {txError && <div className="text-xs text-danger">{txError}</div>}
        </div>
      )}

      {/* Success card */}
      {successTxHash && (
        <div className="card-static rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-success/15 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">{t("alliance.treasury.contributeSuccessTitle")}</p>
              <p className="text-xs text-text-muted">{t("alliance.treasury.contributeSuccessDesc")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-bg-secondary rounded-lg px-3 py-2">
            <span className="font-mono text-xs text-text-muted flex-1 break-all">{successTxHash}</span>
            <CopyButton text={successTxHash} />
          </div>
          <a
            href={cardanoscanTxUrl(successTxHash, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-outline text-sm flex items-center justify-center gap-2"
          >
            {t("alliance.treasury.viewOnCardanoscan")}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      )}

      {/* Transaction history — bank statement style */}
      {(() => {
        // Use reconstructed contribution history (not live UTxOs): withdrawal change-back outputs
        // live at the same address+datum and would otherwise show as bogus contributions.
        const contributions: HistoryEntry[] = (data?.contributions ?? []).map((u: TreasuryUtxo) => ({
          kind: "contribute",
          txHash: u.txHash,
          outputIndex: u.outputIndex,
          lovelace: u.lovelace,
        }))
        // Use the EXECUTE tx (executedTxHash) — that's when funds actually leave the treasury.
        // The finalization tx only records the on-chain ProposalResult; no ADA moves there.
        const withdrawals: HistoryEntry[] = (proposalData?.items ?? [])
          .filter((p: ProposalItem) => !!p.executedTxHash)
          .map((p: ProposalItem) => ({
            kind: "withdraw",
            txHash: p.executedTxHash!,
            lovelace: p.amountLovelace ?? 0,
            recipientAddress: p.recipientAddress,
            title: p.title,
            date: p.approvedAt ?? p.createdAt,
          }))
        const history: HistoryEntry[] = [...withdrawals, ...contributions]
        if (!history.length) {
          return <p className="text-text-muted text-sm py-4 text-center">{t("alliance.treasury.noUtxos")}</p>
        }
        return (
          <div className="flex flex-col gap-1.5">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">{t("alliance.treasury.historyTitle")}</h4>
            {history.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-bg-card border border-border-subtle">
                {/* Direction icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                  entry.kind === "contribute" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                }`}>
                  {entry.kind === "contribute" ? "↙" : "↗"}
                </div>
                {/* Details */}
                <div className="flex-1 min-w-0">
                  {entry.kind === "contribute" ? (
                    <>
                      <div className="text-xs text-text-muted">{t("alliance.treasury.historyContribute")}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-xs text-text-muted">{entry.txHash.slice(0, 14)}…#{entry.outputIndex}</span>
                        <a href={cardanoscanTxUrl(entry.txHash, network)} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-text-muted hover:text-text-secondary transition-colors" title="View on Cardanoscan">↗</a>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-text-muted truncate">
                        {t("alliance.treasury.historyWithdraw")}
                        {entry.recipientAddress && (
                          <span className="font-mono"> → {entry.recipientAddress.slice(0, 14)}…{entry.recipientAddress.slice(-6)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-xs text-text-muted">{entry.txHash.slice(0, 14)}…</span>
                        <a href={cardanoscanTxUrl(entry.txHash, network)} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-text-muted hover:text-text-secondary transition-colors" title="View on Cardanoscan">↗</a>
                        {entry.date && (
                          <span className="text-xs text-text-muted ml-1">
                            {new Date(entry.date).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                {/* Amount */}
                <span className={`font-bold text-sm shrink-0 ${entry.kind === "contribute" ? "text-success" : "text-danger"}`}>
                  {entry.kind === "contribute" ? "+" : "−"}{(entry.lovelace / 1_000_000).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₳
                </span>
              </div>
            ))}
          </div>
        )
      })()}
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
  const { isConnected, isDrepRegistered, drepKey, selectedNetwork, jwt: storedJwt } = useWalletStore()
  const { reauthenticate } = useWallet()
  const [activeTab, setActiveTab] = useState<Tab>("overview")
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const drepId = drepKey?.dRepIDCip105 ?? undefined
  const { alliance, isLoading, error, refetch } = useAllianceDetail(params.id, drepId)

  const myMembership = alliance?.myMembership
  const canJoin = isConnected && isDrepRegistered && !myMembership

  async function ensureJwtPage(): Promise<string | null> {
    if (storedJwt && jwtHasDrepId(storedJwt)) return storedJwt
    return await reauthenticate().catch(() => null)
  }

  async function handleJoin() {
    const jwt = await ensureJwtPage()
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
    if (!confirm(t("alliance.leaveConfirm"))) return
    const jwt = await ensureJwtPage()
    if (!jwt) return
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
    { key: "treasury",     label: t("alliance.tabs.treasury") },
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
      {activeTab === "members" && (
        <MembersTab
          allianceId={params.id}
          myMemberRole={myMembership?.role}
          myDrepId={drepId}
        />
      )}
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
      {activeTab === "treasury" && (
        <TreasuryTab
          allianceId={params.id}
          isMember={!!myMembership}
          network={alliance?.network ?? selectedNetwork ?? "preprod"}
        />
      )}
    </div>
  )
}
