"use client"

import { useState } from "react"
import Link from "next/link"
import { useWallet } from "@/hooks/useWallet"
import { useTx } from "@/hooks/useTx"
import { useWalletStore } from "@/store/wallet"
import { useT } from "@/i18n/useT"

type TFunc = ReturnType<typeof useT>
type PageState = "confirm" | "signing" | "success" | "error"

function friendlyError(msg: string, t: TFunc): { title: string; detail: string; requiresReload?: boolean } {
  const m = msg.toLowerCase()
  if (m.includes("no account found") || m.includes("reconnect")) {
    return { title: t("drepWizard.errConnLost"), detail: t("drepWizard.errConnLostDetail"), requiresReload: true }
  }
  if (m.includes("locked")) {
    return { title: t("drepWizard.errWalletLocked"), detail: t("drepWizard.errWalletLockedDetail") }
  }
  if (m.includes("declined") || m.includes("refuse") || m.includes("cancel")) {
    return { title: t("drepWizard.errDeclined"), detail: t("drepWizard.errDeclinedDetail") }
  }
  if (m.includes("insufficient funds") || m.includes("insufficient balance")) {
    return { title: t("drepWizard.errInsufficientFunds"), detail: t("drepWizard.errInsufficientFundsRetire") }
  }
  if (m.includes("timeout") || m.includes("timed out")) {
    return { title: t("drepWizard.errTimeout"), detail: t("drepWizard.errTimeoutDetail") }
  }
  return { title: t("drepWizard.errRetireFailed"), detail: msg }
}

export default function RetireDRepPage() {
  const t = useT()
  const { isConnected, hasCip95, isDrepRegistered, drepKey, networkId, isWalletHydrating } = useWallet()
  const { submitTx } = useTx()
  const setDRepStatus = useWalletStore(s => s.setDRepStatus)

  const [pageState, setPageState] = useState<PageState>("confirm")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const drepId = drepKey?.dRepIDCip105 ?? null
  const isLoading = pageState === "signing"

  const explorerBase = networkId === 1
    ? "https://cardanoscan.io/transaction"
    : "https://preprod.cardanoscan.io/transaction"

  // ── Guards ──────────────────────────────────────────────────────────────
  if (isWalletHydrating) {
    return (
      <main className="page-container py-16 flex justify-center">
        <div className="flex items-center gap-3 text-text-muted text-sm">
          <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
          {t("drepWizard.hydrating")}
        </div>
      </main>
    )
  }

  if (!isConnected) {
    return (
      <main className="page-container py-16 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18-3a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6m18 3H3" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">{t("drepWizard.connectTitle")}</h1>
          <p className="text-text-secondary text-sm">{t("drepWizard.connectDescRetire")}</p>
        </div>
      </main>
    )
  }

  if ((!hasCip95 || isDrepRegistered === false) && pageState !== "success") {
    return (
      <main className="page-container py-16 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-warning/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">{t("drepWizard.cantProceedTitle")}</h1>
          <p className="text-text-secondary text-sm">
            {!hasCip95 ? t("drepWizard.cantProceedNoCip95") : t("drepWizard.cantProceedNotDrep")}
          </p>
          <Link href="/dreps" className="btn-outline inline-block">{t("drepWizard.cantProceedBackBtn")}</Link>
        </div>
      </main>
    )
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleRetire() {
    if (!drepId) return
    setError(null)

    try {
      setPageState("signing")
      const hash = await submitTx("DREP_RETIRE", { drepId })
      setDRepStatus({ isDrepRegistered: false, drepName: null, delegatedDrep: null })
      setTxHash(hash)
      setPageState("success")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("drepWizard.errUnknown")
      setError(msg)
      setPageState("error")
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <main className="page-container py-10">
      <div className="max-w-lg mx-auto">

        {/* Success */}
        {pageState === "success" && txHash && (
          <div className="card-static text-center space-y-6 py-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">{t("drepWizard.retireSuccessTitle")}</h2>
              <p className="text-text-secondary text-sm mt-1">
                {t("drepWizard.retireSuccessDesc")}
              </p>
            </div>
            <div className="card-static text-left space-y-1">
              <p className="text-text-muted text-xs font-medium">Transaction Hash</p>
              <a
                href={`${explorerBase}/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-accent hover:text-accent-light break-all transition-colors"
              >
                {`${txHash.slice(0, 12)}...${txHash.slice(-8)}`}
              </a>
            </div>
            <div className="notice-warning text-sm text-left">
              <p className="font-medium text-text-primary mb-1">{t("drepWizard.retireAfterTitle")}</p>
              <ul className="text-text-secondary text-xs space-y-1 list-disc list-inside">
                <li>{t("drepWizard.retireAfter1")}</li>
                <li>{t("drepWizard.retireAfter2")}</li>
                <li>{t("drepWizard.retireAfter3")}</li>
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={`${explorerBase}/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline flex-1 text-center"
              >
                {t("drepWizard.retireViewCardanoscan")}
              </a>
              <Link href="/" className="btn-primary flex-1 text-center">
                {t("drepWizard.retireHomeBtn")}
              </Link>
            </div>
          </div>
        )}

        {/* Error */}
        {pageState === "error" && (() => {
          const rawError = error ?? t("drepWizard.errUnknown")
          const { title, detail, requiresReload } = friendlyError(rawError, t)
          const showRaw = detail === rawError
          return (
            <div className="card-static space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-danger/10 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-text-primary font-semibold text-sm">{title}</p>
                  {!showRaw && <p className="text-text-secondary text-sm mt-0.5 leading-relaxed">{detail}</p>}
                  {showRaw && (
                    <pre className="mt-1 text-xs text-text-muted bg-bg-elevated rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
                      {rawError}
                    </pre>
                  )}
                </div>
              </div>
              {requiresReload ? (
                <button className="btn-primary w-full" onClick={() => window.location.reload()}>
                  {t("drepWizard.reloadBtn")}
                </button>
              ) : (
                <button className="btn-outline w-full" onClick={() => setPageState("confirm")}>
                  {t("drepWizard.retryBtn")}
                </button>
              )}
            </div>
          )
        })()}

        {/* Confirm */}
        {(pageState === "confirm" || pageState === "signing") && (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-text-primary">{t("drepWizard.retireTitle")}</h1>
              <p className="text-text-secondary text-sm mt-1">
                {t("drepWizard.retireSubtitle")}
              </p>
            </div>

            <div className="card-static space-y-5">
              {/* Warning */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-danger/5 border border-danger/20">
                <svg className="w-5 h-5 text-danger shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{t("drepWizard.retireWarningTitle")}</p>
                  <p className="text-sm text-text-secondary mt-0.5 leading-relaxed">
                    {t("drepWizard.retireWarningDesc")}
                  </p>
                </div>
              </div>

              {/* DRep ID */}
              {drepId && (
                <div className="space-y-1">
                  <p className="text-text-muted text-xs font-medium">{t("drepWizard.retireIdLabel")}</p>
                  <p className="font-mono text-xs text-text-secondary break-all bg-bg-elevated rounded-lg px-3 py-2">
                    {drepId}
                  </p>
                </div>
              )}

              {/* Fee breakdown */}
              <div className="space-y-2">
                <p className="text-text-primary text-sm font-semibold">{t("drepWizard.retireTxTitle")}</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">{t("drepWizard.retireDepositRefund")}</span>
                    <span className="text-success font-medium">+500 ADA</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-muted">{t("drepWizard.retireNetworkFee")}</span>
                    <span className="text-text-primary font-medium">~0.2 ADA</span>
                  </div>
                </div>
                <p className="text-text-muted text-xs border-t border-border-subtle pt-2">
                  {t("drepWizard.retireTxNote")}
                </p>
              </div>

              {/* Status */}
              {isLoading && (
                <div className="flex items-center gap-3 text-sm text-text-secondary">
                  <svg className="w-4 h-4 animate-spin text-accent shrink-0" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  {t("drepWizard.retireSigningMsg")}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <Link href="/dreps" className="btn-outline flex-1 text-center" aria-disabled={isLoading}>
                  {t("drepWizard.retireCancelBtn")}
                </Link>
                <button
                  className="flex-1 py-2.5 px-4 rounded-xl bg-danger/10 border border-danger/30 text-danger hover:bg-danger/20 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleRetire}
                  disabled={isLoading}
                >
                  {isLoading ? t("drepWizard.retireProcessingBtn") : t("drepWizard.retireConfirmBtn")}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
