"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useWallet } from "@/hooks/useWallet"
import {
  useProposalDetail,
  castVote,
  cancelProposal,
  markProposalExecuted,
  type ProposalItem,
} from "@/hooks/useAllianceProposals"
import { useAllianceDetail, useTreasuryBalance } from "@/hooks/useAlliance"
import { useTx } from "@/hooks/useTx"
import { useT } from "@/i18n/useT"

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

// ─── Countdown ────────────────────────────────────────────────────────────────

function Countdown({ endsAt }: { endsAt: string }) {
  const t = useT()
  const date = new Date(endsAt)
  const now = new Date()
  if (date <= now) {
    return (
      <span className="text-xs text-text-muted">
        {t("alliance.proposal.ended", { date: date.toLocaleDateString() })}
      </span>
    )
  }
  const diff = date.getTime() - now.getTime()
  const days = Math.floor(diff / 86400000)
  const hrs  = Math.floor((diff % 86400000) / 3600000)
  const mins = Math.floor((diff % 3600000) / 60000)
  const timeStr = days > 0 ? `${days}d ${hrs}h` : hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`
  return (
    <span className="text-xs text-accent-light font-mono">
      {t("alliance.proposal.ends", { date: timeStr })}
    </span>
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
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${colors[status] ?? colors.voting}`}>
      {t(key)}
    </span>
  )
}

// ─── Tally section ────────────────────────────────────────────────────────────

function TallySection({ proposal }: { proposal: ProposalItem }) {
  const t = useT()
  const { tally } = proposal
  const total = tally.yesCount + tally.noCount + tally.abstainCount

  const yesPct    = total > 0 ? (tally.yesCount    / total) * 100 : 0
  const noPct     = total > 0 ? (tally.noCount     / total) * 100 : 0
  const abstainPct= total > 0 ? (tally.abstainCount / total) * 100 : 0

  const votedVp = tally.yesVp + tally.noVp + tally.abstainVp
  const yesVpPct = votedVp > 0 ? (tally.yesVp / votedVp) * 100 : 0

  return (
    <div className="card-static rounded-xl p-5 flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-text-secondary">Vote Results</h3>

      {/* Headcount bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
          <span>Headcount</span>
          <span>{t("alliance.proposal.tally.voted", { n: String(total), total: String(tally.totalMembers) })}</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-bg-card-hover">
          <div style={{ width: `${yesPct}%` }}    className="bg-vote-bar-yes" />
          <div style={{ width: `${noPct}%` }}     className="bg-vote-bar-no" />
          <div style={{ width: `${abstainPct}%` }} className="bg-text-muted/30" />
        </div>
        <div className="flex items-center gap-4 mt-1.5 text-xs">
          <span className="text-vote-bar-yes font-medium">{t("alliance.proposal.tally.yes")} {tally.yesCount} ({yesPct.toFixed(0)}%)</span>
          <span className="text-vote-bar-no font-medium">{t("alliance.proposal.tally.no")} {tally.noCount} ({noPct.toFixed(0)}%)</span>
          <span className="text-text-muted">{t("alliance.proposal.tally.abstain")} {tally.abstainCount}</span>
        </div>
      </div>

      {/* VP bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
          <span>Voting Power (weighted)</span>
        </div>
        <div className="flex h-2 rounded-full overflow-hidden bg-bg-card-hover">
          <div style={{ width: `${yesVpPct}%` }} className="bg-vote-bar-yes" />
          <div style={{ width: `${100 - yesVpPct}%` }} className="bg-vote-bar-no/50" />
        </div>
        <p className="text-xs text-text-muted mt-1">
          YES {(tally.yesVp / 1_000_000).toLocaleString()} ₳ / {(votedVp / 1_000_000).toLocaleString()} ₳ voted
        </p>
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-border-subtle">
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${tally.isQuorumMet ? "bg-green-500/10 text-green-400" : "bg-danger/10 text-danger"}`}>
          <span className="font-medium">{t("alliance.proposal.tally.quorum")}:</span>
          <span>{tally.isQuorumMet ? t("alliance.proposal.tally.quorumMet") : t("alliance.proposal.tally.quorumNotMet")}</span>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs ${tally.isApproved ? "bg-green-500/10 text-green-400" : "bg-bg-card-hover text-text-muted"}`}>
          <span>{tally.isApproved ? t("alliance.proposal.tally.approved") : t("alliance.proposal.tally.notApproved")}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Vote panel ───────────────────────────────────────────────────────────────

function VotePanel({
  proposal,
  allianceId,
  myVote,
  isMember,
  onVoted,
}: {
  proposal: ProposalItem
  allianceId: string
  myVote: string | null
  isMember: boolean
  onVoted: () => void
}) {
  const t = useT()
  const { jwt } = useWalletStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (proposal.status !== "voting") return null

  const endsAt = new Date(proposal.votingEndsAt)
  const now = new Date()
  if (endsAt <= now) return null

  if (!isMember) {
    return (
      <div className="card-static rounded-xl p-4 text-center text-sm text-text-muted">
        {t("alliance.proposal.vote.notMember")}
      </div>
    )
  }

  async function handleVote(choice: string) {
    if (!jwt) return
    setLoading(true)
    setError(null)
    try {
      await castVote(allianceId, proposal.id, choice, jwt)
      onVoted()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setLoading(false)
    }
  }

  const votes = ["YES", "NO", "ABSTAIN"] as const
  const voteColors = {
    YES:     "border-vote-bar-yes/50 hover:bg-vote-bar-yes/10 data-[active=true]:bg-vote-bar-yes/20 data-[active=true]:border-vote-bar-yes text-vote-bar-yes",
    NO:      "border-vote-bar-no/50 hover:bg-vote-bar-no/10 data-[active=true]:bg-vote-bar-no/20 data-[active=true]:border-vote-bar-no text-vote-bar-no",
    ABSTAIN: "border-border-subtle hover:bg-bg-card-hover data-[active=true]:bg-bg-card-hover data-[active=true]:border-text-muted text-text-muted",
  }

  return (
    <div className="card-static rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-secondary">
          {myVote ? t("alliance.proposal.vote.change") : t("alliance.proposal.vote.cast")}
        </h3>
        {myVote && (
          <span className="text-xs text-text-muted">
            {t("alliance.proposal.vote.myVote", { v: myVote })}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {votes.map((v) => (
          <button
            key={v}
            data-active={myVote === v}
            onClick={() => handleVote(v)}
            disabled={loading}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all disabled:opacity-50 ${voteColors[v]}`}
          >
            {t(`alliance.proposal.vote.${v.toLowerCase()}` as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

// ─── Execute panel ────────────────────────────────────────────────────────────

function cardanoscanTxUrl(txHash: string, network: string) {
  return network === "mainnet"
    ? `https://cardanoscan.io/transaction/${txHash}`
    : `https://preprod.cardanoscan.io/transaction/${txHash}`
}

function ExecuteSuccessCard({ txHash, network }: { txHash: string; network: string }) {
  const t = useT()
  return (
    <div className="card-static rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-success/15 flex items-center justify-center shrink-0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">{t("alliance.treasury.executeSuccessTitle")}</p>
          <p className="text-xs text-text-muted">{t("alliance.treasury.executeSuccessDesc")}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 bg-bg-secondary rounded-lg px-3 py-2">
        <span className="font-mono text-xs text-text-muted flex-1 break-all">{txHash}</span>
      </div>
      <a
        href={cardanoscanTxUrl(txHash, network)}
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
  )
}

function ExecutePanel({
  proposal,
  allianceId,
  isOwnerOrAdmin,
  network,
  onExecuted,
}: {
  proposal: ProposalItem
  allianceId: string
  isOwnerOrAdmin: boolean
  network: string
  onExecuted: () => void
}) {
  const t = useT()
  const { submitTx } = useTx()
  const { isConnected, jwt: storedJwt } = useWalletStore()
  const { reauthenticate } = useWallet()
  const { data: treasury } = useTreasuryBalance(allianceId)
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(proposal.executedTxHash)
  const [error, setError] = useState<string | null>(null)

  async function ensureJwt(): Promise<string | null> {
    if (storedJwt && jwtHasDrepId(storedJwt)) return storedJwt
    return await reauthenticate().catch(() => null)
  }

  if (proposal.proposalType !== "withdrawal") return null
  // Already executed → show the result card, never the Execute button (drain prevention).
  if (proposal.status === "executed" || proposal.executedTxHash) {
    const hash = proposal.executedTxHash ?? txHash
    return hash ? <ExecuteSuccessCard txHash={hash} network={network} /> : null
  }
  if (proposal.status !== "approved_pending" && proposal.status !== "approved") return null
  if (!proposal.finalizationTxHash || proposal.finalizationTxIndex == null) {
    return (
      <div className="notice-warning text-xs py-2 px-3 rounded-lg">
        {t("alliance.treasury.finalizationPending")}
      </div>
    )
  }

  const executableAt = proposal.executableAt ? new Date(proposal.executableAt) : null
  const now = new Date()
  const timelockActive = executableAt && executableAt > now

  if (timelockActive) {
    return (
      <div className="card-static rounded-xl px-4 py-3 text-sm text-text-muted">
        {t("alliance.treasury.timelockActive", { date: executableAt!.toLocaleString() })}
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="card-static rounded-xl px-4 py-3 text-sm text-text-muted">
        {t("alliance.treasury.connectWalletToExecute")}
      </div>
    )
  }

  if (!isOwnerOrAdmin) {
    return (
      <div className="card-static rounded-xl px-4 py-3 text-sm text-text-muted">
        {t("alliance.treasury.ownerAdminRequired")}
      </div>
    )
  }

  if (txHash) {
    return <ExecuteSuccessCard txHash={txHash} network={network} />
  }

  const treasuryUtxo = treasury?.utxos[0]

  async function handleExecute() {
    if (!treasuryUtxo || !proposal.finalizationTxHash || proposal.finalizationTxIndex == null) return
    const jwt = await ensureJwt()
    if (!jwt) {
      setError(t("alliance.treasury.authRequired"))
      return
    }
    setLoading(true)
    setError(null)
    try {
      const hash = await submitTx("ALLIANCE_WITHDRAW", {
        allianceId,
        proposalId: proposal.id,
        treasuryUtxoTxHash:    treasuryUtxo.txHash,
        treasuryUtxoIndex:     treasuryUtxo.outputIndex,
        treasuryUtxoLovelace:  treasuryUtxo.lovelace,
        treasuryUtxoAddress:   treasury?.treasuryAddress,
        finalizationTxHash:    proposal.finalizationTxHash,
        finalizationTxIndex:   proposal.finalizationTxIndex,
        recipientAddress:      proposal.recipientAddress ?? undefined,
        amountLovelace:        proposal.amountLovelace ?? undefined,
        executableAtMs:        executableAt?.getTime() ?? undefined,
      }, jwt)
      // Mark executed server-side: flips status to `executed`, which hides this button and blocks
      // any further withdrawal TX for this proposal. Critical for treasury drain prevention.
      await markProposalExecuted(allianceId, proposal.id, hash, jwt).catch((e: unknown) => {
        console.error("Failed to mark proposal executed:", e)
      })
      setTxHash(hash)
      setTimeout(onExecuted, 4000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("alliance.treasury.executeError"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {!treasuryUtxo && (
        <p className="text-xs text-text-muted">{t("alliance.treasury.noTreasuryUtxo")}</p>
      )}
      <button
        onClick={handleExecute}
        disabled={loading || !treasuryUtxo || !isOwnerOrAdmin || !isConnected}
        className="btn-primary px-4 py-2 text-sm self-start disabled:opacity-50"
      >
        {loading ? t("alliance.treasury.executing") : t("alliance.treasury.executeBtn")}
      </button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ProposalDetailPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams<{ id: string; pid: string }>()
  const { isConnected, isDrepRegistered, drepKey, jwt } = useWalletStore()

  const drepId = drepKey?.dRepIDCip105 ?? undefined
  const { alliance } = useAllianceDetail(params.id, drepId)
  const { proposal, isLoading, error, refetch } = useProposalDetail(params.id, params.pid, drepId)

  const myMembership = alliance?.myMembership
  const isMember = !!myMembership
  const isOwnerOrAdmin = myMembership?.role === "owner" || myMembership?.role === "admin"

  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  async function handleCancel() {
    if (!jwt || !confirm(t("alliance.proposal.cancelConfirm"))) return
    setCancelling(true)
    setCancelError(null)
    try {
      await cancelProposal(params.id, params.pid, jwt)
      refetch()
    } catch (e: unknown) {
      setCancelError(e instanceof Error ? e.message : "Failed")
    } finally {
      setCancelling(false)
    }
  }

  if (isLoading) {
    return (
      <div className="page-container py-8">
        <div className="flex flex-col gap-4">
          <div className="h-8 w-48 bg-bg-card-hover rounded animate-pulse" />
          <div className="h-32 bg-bg-card-hover rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className="page-container py-8">
        <div className="notice-warning text-sm">Proposal not found.</div>
        <button onClick={() => router.back()} className="mt-4 text-sm text-accent-light hover:underline">
          ← Back
        </button>
      </div>
    )
  }

  const isProposer = drepId === proposal.proposerDrepId
  const canCancel = (isProposer || myMembership?.role === "owner" || myMembership?.role === "admin") &&
    proposal.status === "voting"

  return (
    <div className="page-container py-8 max-w-2xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6 flex-wrap">
        <Link href="/alliances" className="hover:text-text-secondary">Alliances</Link>
        <span>/</span>
        <Link href={`/alliances/${params.id}`} className="hover:text-text-secondary">
          {alliance?.name ?? "Alliance"}
        </Link>
        <span>/</span>
        <span className="text-text-primary truncate max-w-48">{proposal.title}</span>
      </nav>

      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="card-static rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <StatusChip status={proposal.status} />
                <span className="text-xs text-text-muted px-2 py-0.5 rounded-full bg-bg-card-hover">
                  {proposal.proposalType === "ga_stance" ? t("alliance.proposal.typeGaStance") : t("alliance.proposal.typeWithdrawal")}
                </span>
              </div>
              <h1 className="text-xl font-bold text-text-primary">{proposal.title}</h1>
              {proposal.proposerName && (
                <p className="text-sm text-text-muted mt-1">by {proposal.proposerName}</p>
              )}
            </div>
            {proposal.proposalType === "withdrawal" && proposal.amountLovelace && (
              <div className="shrink-0 text-right">
                <div className="text-2xl font-bold text-accent-light">
                  {(proposal.amountLovelace / 1_000_000).toLocaleString()} ₳
                </div>
                {proposal.recipientLabel && (
                  <div className="text-xs text-text-muted mt-0.5">{proposal.recipientLabel}</div>
                )}
              </div>
            )}
          </div>

          {proposal.description && (
            <p className="text-sm text-text-secondary whitespace-pre-wrap mt-3 border-t border-border-subtle pt-3">
              {proposal.description}
            </p>
          )}

          {/* GA info */}
          {proposal.proposalType === "ga_stance" && proposal.govActionTxHash && (
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <p className="text-xs text-text-muted mb-1">{t("alliance.proposal.gaSearchLabel")}</p>
              <Link
                href={`/governance-actions/${proposal.govActionTxHash}/${proposal.govActionIndex}`}
                className="text-sm font-mono text-accent-light hover:underline"
              >
                {proposal.govActionTxHash.slice(0, 24)}…#{proposal.govActionIndex}
              </Link>
            </div>
          )}

          {/* Withdrawal recipient */}
          {proposal.proposalType === "withdrawal" && proposal.recipientAddress && (
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <p className="text-xs text-text-muted mb-1">{t("alliance.proposal.recipientLabel")}</p>
              <p className="text-sm font-mono text-text-secondary break-all">{proposal.recipientAddress}</p>
            </div>
          )}

          {/* Approved/Executable info */}
          {proposal.executableAt && (
            <div className="mt-3 pt-3 border-t border-border-subtle">
              <p className="text-xs text-text-muted">
                {t("alliance.proposal.executableAt", {
                  date: new Date(proposal.executableAt).toLocaleString(),
                })}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 mt-4 pt-3 border-t border-border-subtle">
            <Countdown endsAt={proposal.votingEndsAt} />
            <span className="text-text-muted">·</span>
            <span className="text-xs text-text-muted">
              {new Date(proposal.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Vote panel */}
        <VotePanel
          proposal={proposal}
          allianceId={params.id}
          myVote={proposal.myVote}
          isMember={isMember}
          onVoted={refetch}
        />

        {/* Tally */}
        <TallySection proposal={proposal} />

        {/* Execute (treasury withdrawal) */}
        <ExecutePanel
          proposal={proposal}
          allianceId={params.id}
          isOwnerOrAdmin={isOwnerOrAdmin}
          network={alliance?.network ?? "preprod"}
          onExecuted={refetch}
        />

        {/* Cancel */}
        {canCancel && (
          <div className="flex flex-col gap-1">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="px-4 py-2 rounded-lg text-sm border border-border-subtle text-text-muted hover:text-danger hover:border-danger transition-colors disabled:opacity-50 self-start"
            >
              {t("alliance.proposal.cancel")}
            </button>
            {cancelError && <p className="text-xs text-danger">{cancelError}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
