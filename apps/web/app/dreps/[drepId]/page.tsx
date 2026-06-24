"use client"

import { use, useState, useEffect } from "react"
import { marked } from "marked"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useDRepProfile } from "@/hooks/useDRepProfile"
import { useDRepStats } from "@/hooks/useDRepStats"
import { useDRepVotingHistory } from "@/hooks/useDRepVotingHistory"
import { useAnchorTitlesMap } from "@/hooks/useAnchorTitle"
import { useCommunity } from "@/hooks/useCommunity"
import { useWallet } from "@/hooks/useWallet"
import { useTx } from "@/hooks/useTx"
import { ConnectWalletCta } from "@/components/ui/ConnectWalletCta"
import { DRepProfileCard, shortDrepId } from "@/components/drep/DRepProfileCard"
import { authHeader, getJwt } from "@/lib/api"
import { useT } from "@/i18n/useT"
import type { DRepVote } from "@tempo/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ─── Vote badge ──────────────────────────────────────────────────────────────

function VoteBadge({ vote }: { vote: DRepVote["vote"] }) {
  const cfg = {
    yes:     { cls: "bg-success/15 text-success border-success/30",     label: "YES" },
    no:      { cls: "bg-danger/15 text-danger border-danger/30",         label: "NO" },
    abstain: { cls: "bg-bg-elevated text-text-secondary border-border-default", label: "ABSTAIN" },
  }[vote]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Voting history row ───────────────────────────────────────────────────────

function VoteHistoryRow({ entry, resolvedTitle }: { entry: DRepVote; resolvedTitle?: string | null }) {
  const t = useT()
  const displayTitle = entry.title
    ?? resolvedTitle
    ?? `${entry.txHash.slice(0, 10)}…${entry.txHash.slice(-6)}#${entry.index}`

  return (
    <Link
      href={`/governance-actions/${entry.txHash}/${entry.index}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors rounded-lg group"
    >
      <span className="inline-flex items-center px-2 py-0.5 text-[10px] rounded-full bg-bg-elevated text-text-secondary border border-border-subtle whitespace-nowrap shrink-0">
        {entry.type}
      </span>
      <span className="flex-1 text-sm text-text-primary group-hover:text-accent-light transition-colors truncate min-w-0">
        {displayTitle}
      </span>
      <span className="text-xs text-text-muted whitespace-nowrap shrink-0">
        {entry.expiresEpoch != null ? t("drepDetail.epochLabel", { n: entry.expiresEpoch }) : t("drepDetail.expired")}
      </span>
      <VoteBadge vote={entry.vote} />
    </Link>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function pageWindow(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | "…")[] = [1]
  if (current > 3) pages.push("…")
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2) pages.push("…")
  pages.push(total)
  return pages
}

function Pagination({ page, total, limit, onPage }: {
  page: number
  total: number
  limit: number
  onPage: (p: number) => void
}) {
  const t = useT()
  const totalPages = Math.ceil(total / limit)
  if (totalPages <= 1) return null
  const pages = pageWindow(page, totalPages)

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border-subtle bg-bg-secondary/40">
      {/* Prev */}
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-text-secondary border border-border-subtle hover:text-text-primary hover:border-border-default hover:bg-bg-elevated transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {t("drepDetail.paginationPrev")}
      </button>

      {/* Page numbers */}
      <div className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="w-8 text-center text-xs text-text-muted select-none">…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPage(p as number)}
              className={`min-w-[2rem] h-8 px-1 rounded-lg text-xs font-medium transition-colors ${
                p === page
                  ? "bg-accent text-white shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-elevated"
              }`}
            >
              {p}
            </button>
          )
        )}
      </div>

      {/* Next + count */}
      <div className="flex items-center gap-3">
        <span className="hidden sm:block text-xs text-text-muted whitespace-nowrap">
          {t("drepDetail.voteCount", { total })}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-text-secondary border border-border-subtle hover:text-text-primary hover:border-border-default hover:bg-bg-elevated transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {t("drepDetail.paginationNext")}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ─── About section ─────────────────────────────────────────────────────────────

function AboutSection({ title, content, isLoading }: {
  title: string
  content: string | null
  isLoading: boolean
}) {
  if (!isLoading && !content) return null
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">{title}</h3>
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-3 bg-bg-elevated rounded animate-pulse w-full" />
          <div className="h-3 bg-bg-elevated rounded animate-pulse w-5/6" />
          <div className="h-3 bg-bg-elevated rounded animate-pulse w-4/5" />
        </div>
      ) : (
        // eslint-disable-next-line react/no-danger
        <div
          className="text-sm text-text-secondary leading-relaxed markdown-preview"
          dangerouslySetInnerHTML={{ __html: marked.parse(content ?? "", { async: false }) as string }}
        />
      )}
    </div>
  )
}

// ─── Delegate Modal ───────────────────────────────────────────────────────────

function DelegateModal({
  drepId,
  drepName,
  network,
  onClose,
}: {
  drepId: string
  drepName: string | null
  network: string
  onClose: () => void
}) {
  const t = useT()
  const isConnected = useWalletStore((s) => s.isConnected)
  const delegatedDrep = useWalletStore((s) => s.delegatedDrep)
  const { submitTx, isReady } = useTx()
  const [txStatus, setTxStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [txError, setTxError] = useState<string | null>(null)

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = "" }
  }, [])

  const alreadyDelegated = delegatedDrep?.id === drepId
  const displayName = drepName ?? shortDrepId(drepId)
  const explorerBase = network === "mainnet"
    ? "https://cardanoscan.io/transaction"
    : "https://preprod.cardanoscan.io/transaction"

  async function handleDelegate() {
    setTxStatus("loading")
    setTxError(null)
    try {
      const hash = await submitTx("DELEGATE", { targetDrepId: drepId, delegationType: "drep" })
      setTxHash(hash)
      setTxStatus("success")
    } catch (err: unknown) {
      setTxError(err instanceof Error ? err.message : t("drepDetail.delegate.txFailed"))
      setTxStatus("error")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={txStatus !== "loading" ? onClose : undefined}
      />

      <div className="relative bg-bg-card rounded-2xl w-full max-w-sm shadow-2xl border border-border-subtle">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-bold">{t("drepDetail.delegate.title")}</h2>
          {txStatus !== "loading" && (
            <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">

          {/* Target DRep */}
          <div className="bg-bg-elevated rounded-xl p-4 border border-border-subtle space-y-1">
            <p className="text-xs text-text-muted">{t("drepDetail.delegate.to")}</p>
            <p className="font-semibold text-text-primary truncate">{displayName}</p>
            <p className="font-mono text-xs text-text-muted">{shortDrepId(drepId)}</p>
          </div>

          {/* Current delegation */}
          {isConnected && !alreadyDelegated && delegatedDrep && txStatus === "idle" && (
            <div className="bg-bg-elevated rounded-xl p-3 border border-border-subtle text-xs text-text-muted space-y-0.5">
              <p>{t("drepDetail.delegate.currentLabel")}</p>
              <p className="font-mono text-text-secondary truncate">
                {delegatedDrep.name ?? shortDrepId(delegatedDrep.id)}
              </p>
              <p className="text-[10px] opacity-70">{t("drepDetail.delegate.replaceNote")}</p>
            </div>
          )}

          {/* Not connected */}
          {!isConnected && (
            <ConnectWalletCta variant="inline" message={t("drepDetail.delegate.connectMsg")} />
          )}

          {/* Already delegated */}
          {isConnected && alreadyDelegated && txStatus === "idle" && (
            <div className="notice-success rounded-xl p-4 text-sm text-center">
              {t("drepDetail.delegate.alreadyDelegatedMsg")}
            </div>
          )}

          {/* Loading */}
          {txStatus === "loading" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
              <p className="text-sm text-text-muted">{t("drepDetail.delegate.signing")}</p>
            </div>
          )}

          {/* Success */}
          {txStatus === "success" && txHash && (
            <div className="notice-success rounded-xl p-4 space-y-2">
              <p className="font-semibold text-sm">{t("drepDetail.delegate.successTitle")}</p>
              <p className="text-xs break-all font-mono opacity-80">{txHash}</p>
              <a
                href={`${explorerBase}/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs underline"
              >
                {t("drepDetail.delegate.viewCardanoscan")}
              </a>
            </div>
          )}

          {/* Error */}
          {txStatus === "error" && txError && (
            <div className="notice-warning rounded-xl p-4 space-y-1">
              <p className="font-semibold text-sm">{t("drepDetail.delegate.txFailed")}</p>
              <p className="text-xs opacity-80">{txError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          {txStatus === "success" ? (
            <button onClick={onClose} className="btn-primary flex-1 text-sm">{t("drepDetail.delegate.closeBtn")}</button>
          ) : txStatus === "error" ? (
            <>
              <button onClick={() => setTxStatus("idle")} className="btn-outline flex-1 text-sm">{t("drepDetail.delegate.retryBtn")}</button>
              <button onClick={onClose} className="btn-outline flex-1 text-sm">{t("drepDetail.delegate.closeBtn")}</button>
            </>
          ) : !isConnected ? (
            <button onClick={onClose} className="btn-outline flex-1 text-sm">{t("drepDetail.delegate.closeBtn")}</button>
          ) : (
            <>
              <button
                onClick={onClose}
                disabled={txStatus === "loading"}
                className="btn-outline flex-1 text-sm"
              >
                {t("drepDetail.delegate.cancelBtn")}
              </button>
              <button
                onClick={() => { void handleDelegate() }}
                disabled={!isReady || txStatus === "loading" || alreadyDelegated}
                className="btn-primary flex-1 text-sm disabled:opacity-50"
              >
                {alreadyDelegated ? t("drepDetail.delegate.alreadyDelegatedBtn") : t("drepDetail.delegate.delegateBtn")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function DRepProfilePage({
  params,
}: {
  params: Promise<{ drepId: string }>
}) {
  const { drepId } = use(params)
  const network = useWalletStore((s) => s.selectedNetwork)
  const router = useRouter()
  const { reauthenticate } = useWallet()
  const { submitTx } = useTx()

  const t = useT()
  const { profile, isLoading, isLoadingMeta, error } = useDRepProfile(drepId, network)
  const canonicalId = profile?.id ?? drepId
  const { stats: drepStats, loading: statsLoading } = useDRepStats(
    profile?.isRegistered ? canonicalId : null,
    network,
  )
  const [votePage, setVotePage] = useState(1)
  const { votes, total, limit, isLoading: isLoadingVotes, error: voteError } =
    useDRepVotingHistory(canonicalId, network, votePage, 10)
  // Fresh proposals often have no DB title yet — fall back to resolving the GA title
  // from anchor metadata client-side (same approach as the Governance Actions list).
  const voteTitles = useAnchorTitlesMap(votes.map((v) => (v.title ? null : v.anchorUrl)))

  // Community state
  const { isActive, isLoading: communityLoading, refetch: refetchCommunity } = useCommunity(drepId, network)
  const [activating, setActivating] = useState(false)
  const [activateError, setActivateError] = useState<string | null>(null)
  const [delegateModalOpen, setDelegateModalOpen] = useState(false)

  // Redirect to canonical CIP-105 URL if user landed on a CIP-129 URL
  useEffect(() => {
    if (profile?.id && profile.id !== drepId) {
      router.replace(`/dreps/${profile.id}${network !== "mainnet" ? `?network=${network}` : ""}`)
    }
  }, [profile?.id, drepId, network, router])

  async function handleActivateCommunity() {
    setActivating(true)
    setActivateError(null)
    try {
      const txHash = await submitTx("ACTIVATE_COMMUNITY", {})

      let jwt = getJwt()
      if (!jwt) jwt = await reauthenticate()

      const doActivate = (token: string | null) =>
        fetch(`${API_URL}/communities/${canonicalId}/activate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader(token) },
          body: JSON.stringify({ network, txHash }),
        })

      let res = await doActivate(jwt)
      // 401 = token expired; 403 = token missing drepId claim — reauthenticate for both
      if (res.status === 401 || res.status === 403) {
        const newJwt = await reauthenticate()
        res = await doActivate(newJwt)
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `${t("drepDetail.activateFailed")} (${res.status})`)
      }

      refetchCommunity()
    } catch (err: unknown) {
      setActivateError(err instanceof Error ? err.message : t("drepDetail.activateFailed"))
    } finally {
      setActivating(false)
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="page-container space-y-6 animate-pulse">
        <div className="card-static space-y-4">
          <div className="flex gap-4">
            <div className="w-16 h-16 rounded-full bg-bg-elevated shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-5 bg-bg-elevated rounded w-48" />
              <div className="h-3 bg-bg-elevated rounded w-72" />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="h-14 bg-bg-elevated rounded-xl flex-1" />
            <div className="h-14 bg-bg-elevated rounded-xl flex-1" />
          </div>
        </div>
        <div className="card-static h-40 bg-bg-elevated rounded-xl" />
        <div className="card-static h-64 bg-bg-elevated rounded-xl" />
      </div>
    )
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error || !profile) {
    return (
      <div className="page-container">
        <div className="notice-warning rounded-xl p-6 text-center space-y-3">
          <p className="font-semibold">{t("drepDetail.notFound")}</p>
          <p className="text-xs text-text-muted">{error ?? t("drepDetail.notFoundDesc")}</p>
          <Link href="/dreps" className="text-sm text-accent-light underline">
            ← {t("drepDetail.backLink")}
          </Link>
        </div>
      </div>
    )
  }

  const hasAbout = profile.objectives || profile.motivations || profile.qualifications || isLoadingMeta

  return (
    <div className="page-container space-y-6 animate-fade-in">

      {/* Back link */}
      <Link href="/dreps" className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        {t("drepDetail.backLink")}
      </Link>

      {/* ── Profile Header ──────────────────────────────────────────────── */}
      <DRepProfileCard
        profile={profile}
        drepStats={drepStats}
        statsLoading={statsLoading}
        network={network}
        isActive={isActive}
        communityLoading={communityLoading}
        activating={activating}
        activateError={activateError}
        onDelegate={() => setDelegateModalOpen(true)}
        onActivateCommunity={handleActivateCommunity}
      />

      {/* ── About (CIP-119 metadata) ──────────────────────────────────────── */}
      {hasAbout && (
        <div className="card-static space-y-5">
          <h2 className="text-base font-bold">{t("drepDetail.aboutTitle")}</h2>
          <AboutSection title={t("drepDetail.objectivesLabel")} content={profile.objectives} isLoading={isLoadingMeta && !profile.objectives} />
          <AboutSection title={t("drepDetail.motivationsLabel")} content={profile.motivations} isLoading={isLoadingMeta && !profile.motivations} />
          <AboutSection title={t("drepDetail.qualificationsLabel")} content={profile.qualifications} isLoading={isLoadingMeta && !profile.qualifications} />

          {/* References */}
          {profile.references && profile.references.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">{t("drepDetail.referencesLabel")}</h3>
              <div className="flex flex-wrap gap-2">
                {profile.references.map((ref, i) => (
                  <a
                    key={i}
                    href={ref.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-bg-elevated border border-border-subtle text-text-secondary hover:text-accent-light hover:border-accent/40 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      <polyline points="15 3 21 3 21 9"/>
                      <line x1="10" y1="14" x2="21" y2="3"/>
                    </svg>
                    {ref.label}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Voting History ─────────────────────────────────────────────────── */}
      <div className="card-static space-y-0 !p-0 overflow-hidden">
        <div className="px-4 py-4 border-b border-border-subtle">
          <h2 className="text-base font-bold">
            {t("drepDetail.voteHistoryTitle")}
            {total > 0 && (
              <span className="ml-2 text-sm font-normal text-text-muted">({total})</span>
            )}
          </h2>
        </div>

        {isLoadingVotes && (
          <div className="divide-y divide-border-subtle">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                <div className="h-5 w-24 bg-bg-elevated rounded-full" />
                <div className="flex-1 h-4 bg-bg-elevated rounded" />
                <div className="h-4 w-16 bg-bg-elevated rounded" />
                <div className="h-5 w-14 bg-bg-elevated rounded-full" />
              </div>
            ))}
          </div>
        )}

        {!isLoadingVotes && voteError && (
          <div className="px-4 py-6 text-center text-sm text-text-muted">
            {t("drepDetail.voteLoadError")}
          </div>
        )}

        {!isLoadingVotes && !voteError && votes.length === 0 && (
          <div className="px-4 py-10 text-center space-y-2">
            <p className="text-3xl">🗳️</p>
            <p className="text-sm text-text-muted">{t("drepDetail.noVotes")}</p>
          </div>
        )}

        {!isLoadingVotes && !voteError && votes.length > 0 && (
          <>
            <div className="divide-y divide-border-subtle">
              {votes.map((entry) => (
                <VoteHistoryRow
                  key={`${entry.txHash}-${entry.index}`}
                  entry={entry}
                  resolvedTitle={entry.anchorUrl ? voteTitles.get(entry.anchorUrl) ?? null : null}
                />
              ))}
            </div>
            <Pagination
              page={votePage}
              total={total}
              limit={limit}
              onPage={setVotePage}
            />
          </>
        )}
      </div>

      {/* ── Delegate Modal ────────────────────────────────────────────────── */}
      {delegateModalOpen && (
        <DelegateModal
          drepId={profile.id}
          drepName={profile.givenName ?? profile.name}
          network={network}
          onClose={() => setDelegateModalOpen(false)}
        />
      )}

    </div>
  )
}
