"use client"

import { useState } from "react"
import { useVoteQueue, queueKey, type VoteQueueItem, type VoteChoice } from "@/store/voteQueue"
import { useWalletStore } from "@/store/wallet"
import { useWallet } from "@/hooks/useWallet"
import { useTx } from "@/hooks/useTx"
import { RationaleEditor } from "@/components/governance/RationaleEditor"
import { writeOptimisticVote } from "@/hooks/useMyVote"
import { getJwt, authHeader } from "@/lib/api"
import { useT, type TFunc } from "@/i18n/useT"
import { normalizeActionType } from "@/lib/governance"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ── helpers ────────────────────────────────────────────────────────────────────

function cardanoscanUrl(txHash: string, network: string) {
  return network === "mainnet"
    ? `https://cardanoscan.io/transaction/${txHash}`
    : `https://preprod.cardanoscan.io/transaction/${txHash}`
}

async function doReauth(reauthenticate: () => Promise<string | null>, t: TFunc): Promise<string> {
  let jwt: string | null = null
  try {
    jwt = await reauthenticate()
  } catch (err: unknown) {
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

// ── choice chip ───────────────────────────────────────────────────────────────

function ChoiceChip({ choice }: { choice: VoteChoice }) {
  const t = useT()
  const cfg: Record<VoteChoice, { cls: string; label: string }> = {
    YES:     { cls: "bg-success/15 text-success border-success/30",             label: t("governance.vote.yes") },
    NO:      { cls: "bg-danger/15 text-danger border-danger/30",                label: t("governance.vote.no") },
    ABSTAIN: { cls: "bg-bg-elevated text-text-secondary border-border-default", label: t("governance.vote.abstain") },
  }
  const { cls, label } = cfg[choice]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${cls}`}>
      {label}
    </span>
  )
}

// ── quick-change vote buttons inside panel ─────────────────────────────────────

function PanelVoteButtons({ item, itemKey }: { item: VoteQueueItem; itemKey: string }) {
  const t = useT()
  const { addOrUpdate } = useVoteQueue()
  const CHOICES: VoteChoice[] = ["YES", "NO", "ABSTAIN"]
  const labels: Record<VoteChoice, string> = {
    YES: t("governance.vote.yes"),
    NO: t("governance.vote.no"),
    ABSTAIN: t("governance.vote.abstain"),
  }
  const activeCls: Record<VoteChoice, string> = {
    YES:     "border-success bg-success/20 text-success",
    NO:      "border-danger bg-danger/20 text-danger",
    ABSTAIN: "border-border-default bg-bg-elevated text-text-primary",
  }
  const idleCls: Record<VoteChoice, string> = {
    YES:     "border-success/30 text-success/60 hover:bg-success/10 hover:border-success/60",
    NO:      "border-danger/30 text-danger/60 hover:bg-danger/10 hover:border-danger/60",
    ABSTAIN: "border-border-subtle text-text-muted hover:bg-white/5",
  }
  return (
    <div className="flex gap-1.5">
      {CHOICES.map((c) => (
        <button
          key={c}
          onClick={() => addOrUpdate({ ...item, choice: c })}
          className={`flex-1 py-1 rounded-lg border text-xs font-semibold transition-colors ${
            item.choice === c ? activeCls[c] : idleCls[c]
          }`}
        >
          {item.choice === c ? `✓ ${labels[c]}` : labels[c]}
        </button>
      ))}
    </div>
  )
}

// ── queue item row ─────────────────────────────────────────────────────────────

function QueueItemRow({
  item,
  itemKey,
  disabled,
}: {
  item: VoteQueueItem
  itemKey: string
  disabled: boolean
}) {
  const t = useT()
  const { remove, setRationale } = useVoteQueue()
  const [expanded, setExpanded] = useState(false)

  const hasRationale = item.rationale.trim().length > 0

  return (
    <div className="border border-border-subtle rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-start gap-3 p-3">
        <ChoiceChip choice={item.choice} />
        <div className="flex-1 min-w-0 space-y-0.5">
          <p className="text-sm font-medium leading-snug line-clamp-2">{item.ga.title}</p>
          <p className="text-xs text-text-muted">
            {t(`governance.type.${normalizeActionType(item.ga.actionType)}`)}
          </p>
        </div>
        <button
          onClick={() => remove(itemKey)}
          disabled={disabled}
          className="shrink-0 text-text-muted hover:text-danger transition-colors disabled:opacity-40"
          title="Remove"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Change vote row */}
      <div className="px-3 pb-2">
        <PanelVoteButtons item={item} itemKey={itemKey} />
      </div>

      {/* Rationale toggle */}
      <div className="px-3 pb-3 space-y-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          disabled={disabled}
          className="flex items-center gap-1.5 text-xs text-accent-light hover:underline disabled:opacity-40"
        >
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
            className={`transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          {expanded
            ? t("governance.voteQueue.collapseRationale")
            : hasRationale
              ? t("governance.voteQueue.editRationale")
              : t("governance.voteQueue.addRationale")}
        </button>

        {expanded && (
          <RationaleEditor
            value={item.rationale}
            onChange={(v) => setRationale(itemKey, v)}
            optional
            height={180}
            label=""
            description=""
          />
        )}
      </div>
    </div>
  )
}

// ── main panel ────────────────────────────────────────────────────────────────

type SubmitStep = "idle" | "signing" | "success" | "error"
type SigningPhase = "auth" | "upload" | "sign"

export function VoteQueuePanel() {
  const t = useT()
  const { items, panelOpen, closePanel, clearAll } = useVoteQueue()
  const { isDrepRegistered, drepKey, selectedNetwork } = useWalletStore()
  const { reauthenticate } = useWallet()
  const { submitTx, isReady } = useTx()

  const [step, setStep] = useState<SubmitStep>("idle")
  const [signingPhase, setSigningPhase] = useState<SigningPhase>("sign")
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 })
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const itemList = Object.entries(items)
  const count = itemList.length
  const disabled = step !== "idle"

  async function handleSubmit() {
    if (!isDrepRegistered || !drepKey?.dRepIDCip105) return
    if (count === 0) return

    setStep("signing")
    setSigningPhase("auth")
    setErrorMsg(null)

    try {
      // 1. Auth
      let jwt = getJwt()
      if (!jwt) {
        jwt = await doReauth(reauthenticate, t)
      }

      // 2. Upload rationales sequentially for items that have one
      const withRationale = itemList.filter(([, item]) => item.rationale.trim().length > 0)
      const rationaleMap: Record<string, { rationaleUrl: string; rationaleHash: string }> = {}

      if (withRationale.length > 0) {
        setSigningPhase("upload")
        setUploadProgress({ done: 0, total: withRationale.length })

        for (const [key, item] of withRationale) {
          const body = JSON.stringify({
            drepId: drepKey.dRepIDCip105,
            govActionTxHash: item.ga.txHash,
            govActionIndex: item.ga.index,
            voteKind: item.choice,
            comment: item.rationale.trim(),
          })

          let res = await fetch(`${API_URL}/metadata/vote-rationale`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader(jwt!) },
            body,
          })

          if (res.status === 401) {
            setSigningPhase("auth")
            jwt = await doReauth(reauthenticate, t)
            setSigningPhase("upload")
            res = await fetch(`${API_URL}/metadata/vote-rationale`, {
              method: "POST",
              headers: { "Content-Type": "application/json", ...authHeader(jwt) },
              body,
            })
          }

          if (!res.ok) {
            let msg = t("governance.voteForm.errUploadFailed", { status: res.status })
            try { const d = await res.json(); if (d.error) msg = d.error } catch { /* ignore */ }
            throw new Error(msg)
          }
          const data = await res.json()
          rationaleMap[key] = { rationaleUrl: data.anchorUrl, rationaleHash: data.anchorDataHash }
          setUploadProgress((prev) => ({ ...prev, done: prev.done + 1 }))
        }
      }

      // 3. Build + sign + submit (single TX with all votes)
      setSigningPhase("sign")
      const votes = itemList.map(([key, item]) => ({
        govActionTxHash: item.ga.txHash,
        govActionIndex: item.ga.index,
        voteKind: item.choice,
        ...(rationaleMap[key] ?? {}),
      }))

      const txHash = await submitTx("MULTI_VOTE", {
        drepId: drepKey.dRepIDCip105,
        votes,
      })

      // 4. Optimistic updates + clear queue
      for (const [, item] of itemList) {
        writeOptimisticVote(item.ga.txHash, item.ga.index, item.choice)
      }
      clearAll()
      setSuccessTxHash(txHash)
      setStep("success")
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t("governance.voteForm.errUnknown"))
      setStep("error")
    }
  }

  if (!panelOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={closePanel}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-[420px] z-50 flex flex-col bg-bg-card border-l border-border-subtle shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-base">{t("governance.voteQueue.panelTitle")}</h2>
            {count > 0 && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent text-white text-xs font-bold">
                {count}
              </span>
            )}
          </div>
          <button
            onClick={closePanel}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

          {/* Success */}
          {step === "success" && successTxHash && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/15 flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold">{t("governance.voteQueue.successTitle")}</p>
                  <p className="text-sm text-text-muted">
                    {count === 1
                      ? t("governance.voteQueue.successDescSingle")
                      : t("governance.voteQueue.successDesc", { n: count })}
                  </p>
                </div>
              </div>
              <div className="bg-bg-secondary rounded-lg p-3 font-mono text-xs text-text-muted break-all">
                {successTxHash}
              </div>
              <a
                href={cardanoscanUrl(successTxHash, selectedNetwork)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline w-full text-sm flex items-center justify-center gap-2"
              >
                {t("governance.voteQueue.viewOnCardanoscan")}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
              <button
                onClick={() => { setStep("idle"); setSuccessTxHash(null) }}
                className="btn-outline w-full text-sm"
              >
                {t("governance.voteQueue.submitAnother")}
              </button>
            </div>
          )}

          {/* Error */}
          {step === "error" && (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-danger/15 flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-danger">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold">{t("governance.voteQueue.errTitle")}</p>
                  <p className="text-sm text-text-muted mt-1">{errorMsg}</p>
                </div>
              </div>
              <button
                onClick={() => setStep("idle")}
                className="btn-outline w-full text-sm"
              >
                {t("governance.voteQueue.retry")}
              </button>
            </div>
          )}

          {/* Signing progress */}
          {step === "signing" && (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <svg className="animate-spin w-6 h-6 text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-sm text-text-secondary text-center">
                {signingPhase === "auth"
                  ? t("governance.voteQueue.signingAuth")
                  : signingPhase === "upload"
                    ? t("governance.voteQueue.signingUpload", {
                        done: uploadProgress.done,
                        total: uploadProgress.total,
                      })
                    : t("governance.voteQueue.signingSign")}
              </p>
            </div>
          )}

          {/* Idle — queue items */}
          {step === "idle" && count === 0 && (
            <div className="py-10 text-center space-y-2">
              <p className="text-text-muted text-sm">{t("governance.voteQueue.empty")}</p>
              <p className="text-text-muted/60 text-xs">{t("governance.voteQueue.emptyHint")}</p>
            </div>
          )}

          {step === "idle" && itemList.map(([key, item]) => (
            <QueueItemRow
              key={key}
              item={item}
              itemKey={key}
              disabled={disabled}
            />
          ))}
        </div>

        {/* Footer — submit */}
        {step === "idle" && count > 0 && (
          <div className="px-5 py-4 border-t border-border-subtle space-y-3 shrink-0">
            <p className="text-xs text-text-muted text-center">
              {t("governance.voteQueue.costNote", { n: count })}
            </p>
            <button
              onClick={handleSubmit}
              disabled={!isReady || !isDrepRegistered}
              className="btn-primary w-full text-sm"
            >
              {count === 1
                ? t("governance.voteQueue.submitBtn", { n: 1 })
                : t("governance.voteQueue.submitBtnPlural", { n: count })}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

// ── FAB — floating toggle button ──────────────────────────────────────────────

export function VoteQueueFab() {
  const t = useT()
  const { items, panelOpen, togglePanel } = useVoteQueue()
  const { isDrepRegistered } = useWalletStore()
  const count = Object.keys(items).length

  if (!isDrepRegistered || count === 0) return null

  return (
    <button
      onClick={togglePanel}
      className={`fixed bottom-6 right-6 z-30 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg font-semibold text-sm transition-colors ${
        panelOpen
          ? "bg-bg-elevated text-text-primary border border-border-default"
          : "bg-accent text-white hover:bg-accent/90"
      }`}
      title={t("governance.voteQueue.panelTitle")}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 11 12 14 22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
      {count === 1
        ? t("governance.voteQueue.submitBtn", { n: count })
        : t("governance.voteQueue.submitBtnPlural", { n: count })}
    </button>
  )
}
