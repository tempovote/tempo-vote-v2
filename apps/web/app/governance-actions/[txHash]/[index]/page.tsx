"use client"

import { useState, use } from "react"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useWallet } from "@/hooks/useWallet"
import { useTx } from "@/hooks/useTx"
import { useMyVote, writeOptimisticVote, type MyVote } from "@/hooks/useMyVote"
import { useAnchorTitle } from "@/hooks/useAnchorTitle"
import { useGovernanceAction } from "@/hooks/useGovernanceAction"
import { ActionIdChip } from "@/components/governance/ActionIdChip"
import { ConnectWalletCta } from "@/components/ui/ConnectWalletCta"
import { RationaleEditor } from "@/components/governance/RationaleEditor"
import { type GovernanceAction } from "@tempo/types"
import { resolveAnchorUrl, normalizeActionType } from "@/lib/governance"
import { getJwt, authHeader } from "@/lib/api"
import { useT, type TFunc } from "@/i18n/useT"
import VoteResultsPanel from "@/components/governance/VoteResultsPanel"
import { ActionDetailCard } from "@/components/governance/ActionDetailCard"
import { GaStatusBadge } from "@/components/governance/GaStatusBadge"
import { GaDetailTabs } from "@/components/governance/GaDetailTabs"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

type VoteStep = "idle" | "rationale" | "confirm" | "signing" | "success" | "error"
type VoteChoice = "YES" | "NO" | "ABSTAIN"

// ── Helpers ───────────────────────────────────────────────────────────────────

function cardanoscanUrl(txHash: string, network: string) {
  const base = network === "mainnet"
    ? "https://cardanoscan.io"
    : "https://preprod.cardanoscan.io"
  return `${base}/transaction/${txHash}`
}

// Runs reauthenticate() and converts any error (including CIP-30 DataSignError) to a
// user-readable Error. Returns the new JWT string (never null) or throws.
async function doReauth(reauthenticate: () => Promise<string | null>, t: TFunc): Promise<string> {
  let jwt: string | null = null
  try {
    jwt = await reauthenticate()
  } catch (err: unknown) {
    // CIP-30 DataSignError is a plain object { code: number, info: string }
    if (err && typeof err === "object" && "code" in err) {
      const code = (err as { code: number }).code
      const info = "info" in err ? String((err as { info: unknown }).info) : ""
      if (code === 2) throw new Error(t("governance.voteForm.errAuthRejected"))
      throw new Error(t("governance.voteForm.errWalletSign", { code, info: info ? ": " + info : "" }))
    }
    throw err instanceof Error ? err : new Error(String(err))
  }
  if (!jwt) throw new Error(t("governance.voteForm.errNoJwt"))
  return jwt
}

// ── Vote section ──────────────────────────────────────────────────────────────
function VoteSection({ action, network }: { action: GovernanceAction; network: string }) {
  const t = useT()
  const { isConnected, isDrepRegistered, drepKey, selectedNetwork } = useWalletStore()
  const { reauthenticate } = useWallet()
  const { submitTx, isReady } = useTx()

  const drepId = isDrepRegistered ? drepKey?.dRepIDCip105 : undefined
  const myVote = useMyVote(action.txHash, action.index, drepId, selectedNetwork)

  const [step, setStep] = useState<VoteStep>("idle")
  const [choice, setChoice] = useState<VoteChoice | null>(null)
  const [rationale, setRationale] = useState("")
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [signingPhase, setSigningPhase] = useState<"auth" | "upload" | "sign">("sign")

  if (!isConnected) {
    return <ConnectWalletCta message={t("governance.voteForm.connectToVote")} />
  }

  if (!isDrepRegistered) {
    return (
      <div className="card-static text-center py-8 space-y-2 text-text-muted">
        <p className="font-medium">{t("governance.voteForm.onlyDrep")}</p>
        <Link href="/dreps/register" className="text-sm text-accent-light underline">
          {t("governance.voteForm.registerNow")}
        </Link>
      </div>
    )
  }

  async function handleVote() {
    if (!choice || !drepKey) return
    setStep("signing")
    setErrorMsg(null)
    try {
      // If rationale provided: upload CIP-100 metadata to IPFS first
      let rationaleUrl: string | undefined
      let rationaleHash: string | undefined
      if (rationale.trim()) {
        let jwt = getJwt()

        // JWT absent — run auth flow now (user must approve signing popup in wallet)
        if (!jwt) {
          setSigningPhase("auth")
          jwt = await doReauth(reauthenticate, t)
        }

        setSigningPhase("upload")
        const rationaleBody = JSON.stringify({
          drepId: drepKey.dRepIDCip105,
          govActionTxHash: action.txHash,
          govActionIndex: action.index,
          voteKind: choice,
          comment: rationale.trim(),
        })

        let metaRes = await fetch(`${API_URL}/metadata/vote-rationale`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader(jwt) },
          body: rationaleBody,
        })

        // On 401, try one re-auth and retry (handles token expiry)
        if (metaRes.status === 401) {
          setSigningPhase("auth")
          jwt = await doReauth(reauthenticate, t)
          setSigningPhase("upload")
          metaRes = await fetch(`${API_URL}/metadata/vote-rationale`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader(jwt) },
            body: rationaleBody,
          })
        }

        if (!metaRes.ok) {
          let errMsg = t("governance.voteForm.errUploadFailed", { status: metaRes.status })
          try {
            const errData = await metaRes.json()
            if (errData.error) errMsg = errData.error
          } catch { /* response body không phải JSON, dùng status code */ }
          throw new Error(errMsg)
        }
        const metaData = await metaRes.json()
        rationaleUrl = metaData.anchorUrl
        rationaleHash = metaData.anchorDataHash
      }

      setSigningPhase("sign")
      const txHash = await submitTx("VOTE", {
        drepId: drepKey.dRepIDCip105,
        govActionTxHash: action.txHash,
        govActionIndex: action.index,
        voteKind: choice,
        rationaleUrl,
        rationaleHash,
      })
      writeOptimisticVote(action.txHash, action.index, choice)
      setSuccessTxHash(txHash)
      setStep("success")
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t("governance.voteForm.errUnknown"))
      setStep("error")
    }
  }

  // Success state
  if (step === "success" && successTxHash) {
    return (
      <div className="card-static space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="font-semibold">{t("governance.voteForm.successTitle")}</p>
            <p className="text-sm text-text-muted">
              {t("governance.voteForm.successDesc", { choice: choice ? t(`governance.vote.${choice.toLowerCase()}`) : "" })}
              {rationale.trim() && t("governance.voteForm.rationaleSaved")}
            </p>
          </div>
        </div>
        <div className="bg-bg-secondary rounded-lg p-3 font-mono text-xs text-text-muted break-all">
          {successTxHash}
        </div>
        <a
          href={cardanoscanUrl(successTxHash, network)}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline w-full text-sm flex items-center justify-center gap-2"
        >
          {t("governance.voteForm.viewOnCardanoscan")}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </a>
      </div>
    )
  }

  // Confirm state
  if (step === "confirm" && choice) {
    return (
      <div className="card-static space-y-5">
        <h3 className="font-semibold text-base">{t("governance.voteForm.confirmTitle")}</h3>
        <div className="bg-bg-secondary rounded-xl p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">{t("governance.voteForm.gaLabel")}</span>
            <span className="font-mono text-xs text-text-secondary">
              {action.txHash.slice(0, 10)}…{action.txHash.slice(-6)}#{action.index}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">{t("governance.voteForm.typeLabel")}</span>
            <span>{t(`governance.type.${normalizeActionType(action.actionType)}`)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">{t("governance.voteForm.choiceLabel")}</span>
            <span className={`font-bold text-base ${
              choice === "YES" ? "text-success" : choice === "NO" ? "text-danger" : "text-text-secondary"
            }`}>
              {t(`governance.vote.${choice.toLowerCase()}`)}
            </span>
          </div>
          {rationale.trim() && (
            <div className="border-t border-border-subtle pt-3 space-y-1">
              <span className="text-text-muted block">{t("governance.voteForm.rationaleLabel")}</span>
              <p className="text-text-secondary text-xs line-clamp-3 whitespace-pre-wrap">{rationale.trim()}</p>
              <button
                onClick={() => setStep("rationale")}
                className="text-xs text-accent-light hover:underline"
              >
                {t("governance.voteForm.edit")}
              </button>
            </div>
          )}
          <div className="flex justify-between border-t border-border-subtle pt-3">
            <span className="text-text-muted">{t("governance.voteForm.networkFee")}</span>
            <span className="text-text-primary">~0.2 ADA</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setStep("rationale")}
            className="btn-outline flex-1 text-sm"
          >
            {t("governance.voteForm.back")}
          </button>
          <button
            onClick={handleVote}
            disabled={!isReady}
            className="btn-primary flex-1 text-sm"
          >
            {t("governance.voteForm.confirmSign")}
          </button>
        </div>
      </div>
    )
  }

  // Rationale step — optional markdown editor
  if (step === "rationale" && choice) {
    const isOver = rationale.length > 2000
    return (
      <div className="card-static space-y-5">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            choice === "YES" ? "bg-success/20 text-success" : choice === "NO" ? "bg-danger/20 text-danger" : "bg-bg-elevated text-text-secondary"
          }`}>
            {choice === "YES" ? "Y" : choice === "NO" ? "N" : "A"}
          </div>
          <div>
            <p className="font-semibold text-sm">{t("governance.voteForm.addRationaleTitle")}</p>
            <p className="text-xs text-text-muted">{t("governance.voteForm.addRationaleSubtitle")}</p>
          </div>
        </div>

        <RationaleEditor value={rationale} onChange={setRationale} />

        <div className="flex gap-3">
          <button
            onClick={() => setStep("idle")}
            className="btn-outline flex-1 text-sm"
          >
            {t("governance.voteForm.back")}
          </button>
          <button
            onClick={() => setStep("confirm")}
            className="btn-outline flex-1 text-sm"
          >
            {t("governance.voteForm.skip")}
          </button>
          <button
            onClick={() => setStep("confirm")}
            disabled={isOver}
            className="btn-primary flex-1 text-sm"
          >
            {t("governance.voteForm.continue")}
          </button>
        </div>
      </div>
    )
  }

  // Signing state
  if (step === "signing") {
    const phaseMsg =
      signingPhase === "auth"   ? t("governance.voteForm.signingAuth") :
      signingPhase === "upload" ? t("governance.voteForm.signingUpload") :
                                  t("governance.voteForm.signingSign")
    return (
      <div className="card-static flex items-center justify-center gap-3 py-8">
        <svg className="animate-spin w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <span className="text-text-secondary">{phaseMsg}</span>
      </div>
    )
  }

  // Error state
  if (step === "error") {
    return (
      <div className="card-static space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-danger/15 flex items-center justify-center shrink-0 mt-0.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-danger">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <div>
            <p className="font-semibold">{t("governance.voteForm.voteFailed")}</p>
            <p className="text-sm text-text-muted mt-1">{errorMsg}</p>
          </div>
        </div>
        <button onClick={() => setStep("idle")} className="btn-outline w-full text-sm">
          {t("common.retry")}
        </button>
      </div>
    )
  }

  // Idle state — choose YES / NO / ABSTAIN
  const CHOICES: { value: VoteChoice; label: string; cls: string; activeCls: string }[] = [
    { value: "YES",     label: t("governance.vote.yes"),     cls: "border-success/50 text-success hover:bg-success/10",           activeCls: "border-success bg-success/20 text-success" },
    { value: "NO",      label: t("governance.vote.no"),      cls: "border-danger/50 text-danger hover:bg-danger/10",              activeCls: "border-danger bg-danger/20 text-danger" },
    { value: "ABSTAIN", label: t("governance.vote.abstain"), cls: "border-border-default text-text-secondary hover:bg-white/5",   activeCls: "border-border-default bg-bg-elevated text-text-primary" },
  ]

  return (
    <div className="card-static space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">
          {myVote ? t("governance.voteForm.yourVote") : t("governance.voteForm.castVote")}
        </h3>
        {myVote && (
          <MyVoteBadge vote={myVote} />
        )}
      </div>

      {myVote && (
        <p className="text-xs text-text-muted">
          {t("governance.voteForm.canChange")}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {CHOICES.map(({ value, label, cls, activeCls }) => {
          const isCurrentVote = myVote === value
          return (
            <button
              key={value}
              onClick={() => { setChoice(value); setRationale(""); setStep("rationale") }}
              className={`py-3 rounded-xl border-2 font-bold text-sm transition-colors ${
                isCurrentVote ? activeCls : cls
              }`}
            >
              {isCurrentVote ? `✓ ${label}` : label}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-text-muted text-center">
        {t("governance.voteForm.willSign")}
      </p>
    </div>
  )
}

function MyVoteBadge({ vote }: { vote: MyVote }) {
  const t = useT()
  if (!vote) return null
  const cfg = {
    YES:     { cls: "bg-success/15 text-success border-success/30",  label: `✓ ${t("governance.vote.yes")}` },
    NO:      { cls: "bg-danger/15 text-danger border-danger/30",     label: `✓ ${t("governance.vote.no")}` },
    ABSTAIN: { cls: "bg-bg-elevated text-text-secondary border-border-default", label: `✓ ${t("governance.vote.abstain")}` },
  }[vote]
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GovernanceActionDetailPage({
  params,
}: {
  params: Promise<{ txHash: string; index: string }>
}) {
  const t = useT()
  const { txHash, index: indexStr } = use(params)
  const index = parseInt(indexStr, 10)
  const network = useWalletStore((s) => s.selectedNetwork)

  const { action, loading, error: fetchError } = useGovernanceAction(network, txHash, index)

  // Use DB title if available; fall back to anchor-fetch for new proposals not yet in DB
  const anchorTitle = useAnchorTitle(action?.title ? null : (action?.anchorUrl ?? null))

  const heading = action?.title ?? anchorTitle ?? action?.type ?? t("governance.detail.fallbackHeading")

  return (
    <div className="page-container space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted animate-fade-in">
        <Link href="/governance-actions" className="hover:text-text-primary transition-colors whitespace-nowrap">
          {t("governance.list.title")}
        </Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {loading && !action ? (
          <div className="h-4 w-36 bg-bg-elevated rounded animate-pulse" />
        ) : (
          <span className="text-text-primary truncate max-w-[200px]">{heading}</span>
        )}
      </nav>

      {/* Loading */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="card-static h-48 bg-bg-card" />
          <div className="card-static h-40 bg-bg-card" />
        </div>
      )}

      {/* Error */}
      {!loading && fetchError && (
        <div className="notice-warning rounded-xl p-4 space-y-1">
          <p className="font-medium">{t("governance.detail.notFound")}</p>
          <p className="text-xs text-text-muted">{fetchError}</p>
          <Link href="/governance-actions" className="text-sm text-accent-light underline block mt-2">
            {t("governance.detail.backToList")}
          </Link>
        </div>
      )}

      {/* Content */}
      {!loading && action && (
        <>
          {/* Header card */}
          <div className="card-static space-y-5 animate-fade-in">
            {/* Title + type badge */}
            <div className="space-y-2">
              <div className="flex items-start gap-3 flex-wrap">
                <GaStatusBadge status={action.status} />
                <span className="text-xs text-text-muted bg-bg-elevated px-2 py-0.5 rounded-full shrink-0">
                  {t(`governance.type.${normalizeActionType(action.actionType)}`)}
                </span>
              </div>
              <h1 className="text-xl font-bold leading-snug">{heading}</h1>
              <ActionIdChip txHash={action.txHash} index={action.index} size="md" />
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-text-muted text-xs mb-0.5">{t("governance.card.expires")}</p>
                <p className="font-medium">{t("governance.card.epoch", { n: action.expiresEpoch })}</p>
              </div>
              <div>
                <p className="text-text-muted text-xs mb-0.5">{t("governance.detail.deposit")}</p>
                <p className="font-medium">
                  {(action.deposit / 1_000_000).toLocaleString()} ADA
                </p>
              </div>
              {action.anchorUrl && (
                <div>
                  <p className="text-text-muted text-xs mb-0.5">{t("governance.detail.attachedDoc")}</p>
                  <a
                    href={resolveAnchorUrl(action.anchorUrl) ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-light hover:underline text-xs truncate block"
                  >
                    {action.anchorUrl.startsWith("ipfs://")
                      ? action.anchorUrl.slice(0, 30) + "…"
                      : action.anchorUrl}
                  </a>
                </div>
              )}
            </div>

            {/* Anchor hash */}
            {action.anchorHash && (
              <div className="bg-bg-secondary rounded-lg px-3 py-2 text-xs text-text-muted font-mono flex items-center justify-between gap-2">
                <span>
                  <span className="text-text-muted/60 mr-2">hash:</span>
                  <span title={action.anchorHash}>
                    {action.anchorHash.slice(0, 12)}…{action.anchorHash.slice(-8)}
                  </span>
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(action.anchorHash!)}
                  className="shrink-0 text-text-muted hover:text-text-primary transition-colors"
                  title={t("governance.detail.copyHash")}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Type-specific detail card */}
          <ActionDetailCard action={action} />

          {/* Vote results card */}
          <div className="card-static space-y-3 animate-fade-in">
            <h2 className="font-semibold text-base">{t("governance.card.voteResults")}</h2>
            <VoteResultsPanel action={action} />
          </div>

          {/* Vote history + Metadata tabs */}
          <GaDetailTabs action={action} />

          {/* Vote action */}
          <div className="animate-slide-up">
            <VoteSection action={action} network={network} />
          </div>
        </>
      )}
    </div>
  )
}
