"use client"

import { useState } from "react"
import { marked } from "marked"
import { useWallet } from "@/hooks/useWallet"
import { useTx } from "@/hooks/useTx"
import { useWalletStore } from "@/store/wallet"
import RegisterDRepForm, { type DRepFormData } from "@/components/drep/RegisterDRepForm"
import RegisterDRepSuccess from "@/components/drep/RegisterDRepSuccess"
import { authHeader, getJwt } from "@/lib/api"
import { resolveAnchorUrl } from "@/lib/governance"
import { useT } from "@/i18n/useT"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

type TFunc = ReturnType<typeof useT>
type WizardStep = "step1" | "step2" | "confirm" | "uploading" | "signing" | "success" | "error"

const STEP_INDEX: Record<WizardStep, number> = {
  step1: 0, step2: 1, confirm: 2,
  uploading: 3, signing: 3, success: 3, error: 3,
}

const EMPTY_FORM: DRepFormData = {
  givenName: "",
  motivations: "",
  objectives: "",
  qualifications: "",
  imageUrl: "",
  imagePreviewUrl: "",
  paymentAddress: "",
  references: [],
}

// ─── Step indicator ─────────────────────────────────────────────────────────
function StepIndicator({ current, stepLabels }: { current: number; stepLabels: string[] }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {stepLabels.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i < current
                  ? "bg-accent text-white"
                  : i === current
                  ? "bg-accent text-white ring-2 ring-accent/30"
                  : "bg-bg-elevated text-text-muted"
              }`}
            >
              {i < current ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span className={`text-xs hidden sm:block ${i === current ? "text-accent font-medium" : "text-text-muted"}`}>
              {label}
            </span>
          </div>
          {i < stepLabels.length - 1 && (
            <div className={`w-10 sm:w-16 h-0.5 mx-1 mb-4 transition-colors ${i < current ? "bg-accent" : "bg-border-default"}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function toDisplayUrl(url: string): string {
  return resolveAnchorUrl(url) ?? url
}

// ─── Confirm step ────────────────────────────────────────────────────────────
function ConfirmStep({
  data,
  drepId,
  onConfirm,
  onBack,
  isLoading,
  statusLabel,
  enableSelfDelegate,
  onToggleSelfDelegate,
  enableCommunity,
  onToggleCommunity,
}: {
  data: DRepFormData
  drepId: string | null
  onConfirm: () => void
  onBack: () => void
  isLoading: boolean
  statusLabel: string | null
  enableSelfDelegate: boolean
  onToggleSelfDelegate: () => void
  enableCommunity: boolean
  onToggleCommunity: () => void
}) {
  const t = useT()
  const profileSections = [
    data.motivations && { label: t("drepWizard.formMotivationsLabel"), text: data.motivations },
    data.objectives && { label: t("drepWizard.formObjectivesLabel"), text: data.objectives },
    data.qualifications && { label: t("drepWizard.formQualificationsLabel"), text: data.qualifications },
  ].filter(Boolean) as { label: string; text: string }[]

  return (
    <div className="space-y-4">
      {/* DRep identity + DRep ID */}
      <div className="card-static space-y-3">
        <div className="flex items-center gap-3">
          {(data.imagePreviewUrl || data.imageUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.imagePreviewUrl || toDisplayUrl(data.imageUrl)}
              alt="avatar"
              className="w-12 h-12 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-lg shrink-0">
              {data.givenName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-text-primary font-bold">{data.givenName}</p>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {data.paymentAddress && <span className="badge text-xs">{t("drepWizard.confirmBadgePayment")}</span>}
            </div>
          </div>
        </div>
        {drepId && (
          <div className="border-t border-border-subtle pt-3">
            <p className="text-text-muted text-xs font-medium mb-1">{t("drepWizard.confirmDrepIdLabel")}</p>
            <p className="font-mono text-xs text-text-secondary break-all">{drepId}</p>
          </div>
        )}
      </div>

      {/* Profile content preview */}
      {profileSections.length > 0 && (
        <div className="card-static space-y-3">
          {profileSections.map(({ label, text }) => (
            <div key={label}>
              <p className="text-text-secondary text-sm font-semibold mb-1">{label}</p>
              {/* eslint-disable-next-line react/no-danger */}
              <div
                className="text-text-secondary text-sm leading-relaxed markdown-preview"
                dangerouslySetInnerHTML={{ __html: marked.parse(text, { async: false }) as string }}
              />
            </div>
          ))}
          {data.references.length > 0 && (
            <div>
              <p className="text-text-secondary text-sm font-semibold mb-1">{t("drepWizard.confirmRefsLabel")}</p>
              <ul className="space-y-1">
                {data.references.filter(r => r.label || r.uri).map((r, i) => (
                  <li key={i} className="text-xs">
                    <span className="text-text-secondary font-medium">{r.label || r.type}</span>
                    {r.uri && <span className="text-text-muted break-all"> — {r.uri}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Fee breakdown */}
      <div className="card-static space-y-2">
        <p className="text-text-primary text-sm font-semibold">{t("drepWizard.confirmFeeRegistration")}</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-text-muted">{t("drepWizard.confirmFeeDeposit")}</span>
            <span className="text-text-primary font-medium">500 ADA</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted">{t("drepWizard.confirmFeeRegTx")}</span>
            <span className="text-text-primary font-medium">~0.2 ADA</span>
          </div>
          {enableSelfDelegate && (
            <div className="flex justify-between items-center">
              <span className="text-text-muted">{t("drepWizard.confirmFeeSelfDelegateTx")}</span>
              <span className="text-text-primary font-medium">~0.2 ADA</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-text-muted">{t("drepWizard.confirmFeeMetadata")}</span>
            <span className="text-text-primary font-medium">{t("drepWizard.confirmFeeMetadataFree")}</span>
          </div>
          {enableCommunity && (
            <div className="flex justify-between items-center">
              <span className="text-text-muted">{t("drepWizard.confirmFeeCommunity")}</span>
              <span className="text-accent font-medium">2 ADA</span>
            </div>
          )}
        </div>
        <p className="text-text-muted text-xs border-t border-border-subtle pt-2">
          {t("drepWizard.confirmFeeNote")}
        </p>
      </div>

      {/* Self-delegate toggle */}
      <button
        type="button"
        onClick={onToggleSelfDelegate}
        disabled={isLoading}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
          enableSelfDelegate
            ? "border-accent/50 bg-accent/5"
            : "border-border-subtle bg-bg-elevated hover:border-border-default"
        }`}
      >
        <div className="flex items-center gap-3 text-left">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            enableSelfDelegate ? "bg-accent/20" : "bg-bg-elevated border border-border-default"
          }`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={enableSelfDelegate ? "text-accent" : "text-text-muted"}>
              <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
              <circle cx="12" cy="12" r="2"/>
            </svg>
          </div>
          <div>
            <p className={`text-sm font-medium ${enableSelfDelegate ? "text-accent-light" : "text-text-secondary"}`}>
              {t("drepWizard.confirmSelfDelegateTitle")}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              {t("drepWizard.confirmSelfDelegateDesc")}
            </p>
          </div>
        </div>
        <div className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${
          enableSelfDelegate ? "bg-accent" : "bg-bg-elevated border border-border-default"
        }`}>
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            enableSelfDelegate ? "translate-x-4" : "translate-x-0.5"
          }`} />
        </div>
      </button>

      {/* DRep Community toggle */}
      <button
        type="button"
        onClick={onToggleCommunity}
        disabled={isLoading}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${
          enableCommunity
            ? "border-accent/50 bg-accent/5"
            : "border-border-subtle bg-bg-elevated hover:border-border-default"
        }`}
      >
        <div className="flex items-center gap-3 text-left">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
            enableCommunity ? "bg-accent/20" : "bg-bg-elevated border border-border-default"
          }`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={enableCommunity ? "text-accent" : "text-text-muted"}>
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <p className={`text-sm font-medium ${enableCommunity ? "text-accent-light" : "text-text-secondary"}`}>
              {t("drepWizard.confirmCommunityTitle")}
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              {t("drepWizard.confirmCommunityDesc")}
            </p>
          </div>
        </div>
        <div className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${
          enableCommunity ? "bg-accent" : "bg-bg-elevated border border-border-default"
        }`}>
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            enableCommunity ? "translate-x-4" : "translate-x-0.5"
          }`} />
        </div>
      </button>

      {/* Status while loading */}
      {statusLabel && (
        <div className="flex items-center gap-3 text-sm text-text-secondary">
          <svg className="w-4 h-4 animate-spin text-accent shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          {statusLabel}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button className="btn-outline flex-1" onClick={onBack} disabled={isLoading}>
          {t("drepWizard.confirmBackBtn")}
        </button>
        <button className="btn-primary flex-1" onClick={onConfirm} disabled={isLoading}>
          {isLoading ? t("drepWizard.confirmProcessingBtn") : t("drepWizard.confirmRegisterBtn")}
        </button>
      </div>
    </div>
  )
}

// ─── Error helpers ───────────────────────────────────────────────────────────
function friendlyError(msg: string, t: TFunc): { title: string; detail: string } {
  const m = msg.toLowerCase()
  if (m.includes("declined") || m.includes("refuse") || m.includes("cancel")) {
    return { title: t("drepWizard.errDeclined"), detail: t("drepWizard.errDeclinedDetailRegister") }
  }
  if (m.includes("insufficient funds") || m.includes("insufficient balance") || m.includes("not enough ada")) {
    return { title: t("drepWizard.errInsufficientFunds"), detail: t("drepWizard.errInsufficientFundsRegister") }
  }
  if (m.includes("timeout") || m.includes("timed out")) {
    return { title: t("drepWizard.errTimeout"), detail: t("drepWizard.errTimeoutDetail") }
  }
  if (m.includes("already registered") || m.includes("already exists")) {
    return { title: t("drepWizard.errAlreadyRegistered"), detail: t("drepWizard.errAlreadyRegisteredDetail") }
  }
  if (m.includes("pinata") || m.includes("ipfs") || m.includes("upload")) {
    return { title: t("drepWizard.errUploadFailed"), detail: t("drepWizard.errUploadFailedDetail") }
  }
  return { title: t("drepWizard.errRegisterFailed"), detail: msg }
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function RegisterDRepPage() {
  const t = useT()
  const { isConnected, hasCip95, isDrepRegistered, drepKey, networkId, reauthenticate } = useWallet()
  const { submitTx } = useTx()
  const setDRepStatus = useWalletStore(s => s.setDRepStatus)
  const openWalletModal = useWalletStore(s => s.openWalletModal)

  const [wizardStep, setWizardStep] = useState<WizardStep>("step1")
  const [formData, setFormData] = useState<DRepFormData>(EMPTY_FORM)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusLabel, setStatusLabel] = useState<string | null>(null)
  // Cache anchor data so retries skip the IPFS metadata re-upload
  const [anchorCache, setAnchorCache] = useState<{ anchorUrl: string; anchorDataHash: string } | null>(null)

  const drepId = drepKey?.dRepIDCip105 ?? null
  const isSubmitting = wizardStep === "uploading" || wizardStep === "signing"
  const [selfDelegateEnabled, setSelfDelegateEnabled] = useState(true)
  const [communityEnabled, setCommunityEnabled] = useState(false)

  // ── Guards ──────────────────────────────────────────────────────────────
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
          <p className="text-text-secondary text-sm">
            {t("drepWizard.connectDescRegister")}
          </p>
          <button
            onClick={openWalletModal}
            className="btn-primary mx-auto gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="2" y="6" width="20" height="14" rx="2" />
              <path d="M16 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
              <path d="M22 10V8a2 2 0 0 0-2-2H4" />
            </svg>
            {t("drepWizard.connectBtn")}
          </button>
        </div>
      </main>
    )
  }

  if (!hasCip95) {
    return (
      <main className="page-container py-16 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-warning/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">{t("drepWizard.noCip95Title")}</h1>
          <p className="text-text-secondary text-sm">
            {t("drepWizard.noCip95DescFull")}
          </p>
        </div>
      </main>
    )
  }

  if (isDrepRegistered === true && wizardStep !== "success" && wizardStep !== "signing" && wizardStep !== "uploading") {
    return (
      <main className="page-container py-16 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-success/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">{t("drepWizard.alreadyDrepTitle")}</h1>
          <p className="text-text-secondary text-sm">
            {t("drepWizard.alreadyDrepDesc")}
          </p>
          <a href="/dreps" className="btn-primary inline-block">
            {t("drepWizard.viewDrepListBtn")}
          </a>
        </div>
      </main>
    )
  }

  // ── Submit flow ──────────────────────────────────────────────────────────
  async function handleRegister() {
    if (!drepId) return
    setError(null)

    try {
      let anchor = anchorCache

      // Obtain (or refresh) JWT once — reuse throughout the entire flow including
      // community activation so the token is consistent and definitely has drepId.
      setStatusLabel(t("drepWizard.statusAuthenticating"))
      let jwt = getJwt()
      if (!jwt) jwt = await reauthenticate()
      if (!jwt) throw new Error("auth failed — cannot get JWT")

      if (!anchor) {
        // Upload metadata to IPFS only if not already done (first attempt or form changed)
        setWizardStep("uploading")

        setStatusLabel(t("drepWizard.statusUploadingMeta"))

        const uploadRes = await fetch(`${API_URL}/metadata/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader(jwt) },
          body: JSON.stringify({
            drepId,
            givenName: formData.givenName,
            motivations: formData.motivations || undefined,
            objectives: formData.objectives || undefined,
            qualifications: formData.qualifications || undefined,
            imageUrl: formData.imageUrl || undefined,
            paymentAddress: formData.paymentAddress || undefined,
            references: formData.references.filter(r => r.label && r.uri),
          }),
        })

        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}))
          throw new Error(err.error ?? t("drepWizard.errUploadFailed"))
        }

        const { anchorUrl, anchorDataHash } = await uploadRes.json()
        anchor = { anchorUrl, anchorDataHash }
        setAnchorCache(anchor)
      }

      // Build + sign single TX: DRep registration cert (+ optional VoteDelegCert if selfDelegate).
      // Both certs are atomic in the same block — no double-spent or unconfirmed-DRep risk.
      setWizardStep("signing")
      setStatusLabel(
        selfDelegateEnabled
          ? t("drepWizard.statusSigningWithDelegate")
          : t("drepWizard.statusSigning"),
      )

      const hash = await submitTx("DREP_REGISTER", {
        drepId,
        anchorUrl: anchor.anchorUrl,
        anchorDataHash: anchor.anchorDataHash,
        selfDelegate: selfDelegateEnabled,
      })

      // Update wallet store optimistically
      setDRepStatus({
        isDrepRegistered: true,
        drepName: formData.givenName,
        delegatedDrep: selfDelegateEnabled ? { id: drepId, name: formData.givenName } : null,
      })

      // Optional: activate DRep Community (2 ADA fee)
      if (communityEnabled) {
        setStatusLabel(t("drepWizard.statusActivatingCommunity"))
        try {
          const communityTxHash = await submitTx("ACTIVATE_COMMUNITY", {})
          await fetch(`${API_URL}/communities/${drepId}/activate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader(jwt) },
            body: JSON.stringify({
              network: networkId === 1 ? "mainnet" : "preprod",
              txHash: communityTxHash,
            }),
          })
        } catch (communityErr) {
          // Community activation is optional — don't block success, but log clearly
          console.warn("[DRep Register] Community activation failed (non-blocking):", communityErr)
        }
      }

      setTxHash(hash)
      setStatusLabel(null)
      setWizardStep("success")
    } catch (err: unknown) {
      setStatusLabel(null)
      const msg = err instanceof Error ? err.message : t("drepWizard.errUnknown")
      console.error("[DRep Register] error:", msg, err)
      setError(msg)
      setWizardStep("error")
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <main className="page-container py-10">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        {wizardStep !== "success" && (
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-text-primary">{t("drepWizard.registerTitle")}</h1>
            <p className="text-text-secondary text-sm mt-1">
              {t("drepWizard.registerSubtitle")}
            </p>
          </div>
        )}

        {/* Step indicator */}
        {wizardStep !== "success" && (
          <StepIndicator current={STEP_INDEX[wizardStep]} stepLabels={[t("drepWizard.stepInfo"), t("drepWizard.stepProfile"), t("drepWizard.stepConfirm"), t("drepWizard.stepDone")]} />
        )}

        {/* Card */}
        <div className="card-static">
          {wizardStep === "step1" && (
            <RegisterDRepForm
              data={formData}
              step={1}
              onChange={(d) => { setFormData(d); setAnchorCache(null) }}
              onNext={() => setWizardStep("step2")}
              onBack={() => {}}
            />
          )}

          {wizardStep === "step2" && (
            <RegisterDRepForm
              data={formData}
              step={2}
              onChange={(d) => { setFormData(d); setAnchorCache(null) }}
              onNext={() => setWizardStep("confirm")}
              onBack={() => setWizardStep("step1")}
            />
          )}

          {(wizardStep === "confirm" || wizardStep === "uploading" || wizardStep === "signing") && (
            <ConfirmStep
              data={formData}
              drepId={drepId}
              onConfirm={handleRegister}
              onBack={() => setWizardStep("step2")}
              isLoading={isSubmitting}
              statusLabel={statusLabel}
              enableSelfDelegate={selfDelegateEnabled}
              onToggleSelfDelegate={() => setSelfDelegateEnabled((v) => !v)}
              enableCommunity={communityEnabled}
              onToggleCommunity={() => setCommunityEnabled((v) => !v)}
            />
          )}

          {wizardStep === "error" && (() => {
            const rawError = error ?? t("drepWizard.errUnknown")
            const { title, detail } = friendlyError(rawError, t)
            const showRaw = detail === rawError // only show raw block for unrecognised errors
            return (
              <div className="space-y-5">
                <div className="card-static space-y-2">
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
                </div>
                <div className="flex gap-3">
                  <button className="btn-outline flex-1" onClick={() => setWizardStep("confirm")}>
                    {t("drepWizard.retryBtn")}
                  </button>
                  <button className="btn-outline flex-1" onClick={() => {
                    if (formData.imageUrl.startsWith("ipfs://")) {
                      fetch(`${API_URL}/metadata/unpin/${formData.imageUrl.slice(7)}`, { method: "DELETE", headers: authHeader(getJwt()) }).catch(() => {})
                    }
                    setFormData(EMPTY_FORM)
                    setWizardStep("step1")
                  }}>
                    {t("drepWizard.restartBtn")}
                  </button>
                </div>
              </div>
            )
          })()}

          {wizardStep === "success" && txHash && (
            <RegisterDRepSuccess
              txHash={txHash}
              drepName={formData.givenName}
              networkId={networkId}
              selfDelegated={selfDelegateEnabled}
            />
          )}
        </div>
      </div>
    </main>
  )
}
