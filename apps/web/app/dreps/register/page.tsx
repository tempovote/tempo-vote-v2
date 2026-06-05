"use client"

import { useState } from "react"
import { useWallet } from "@/hooks/useWallet"
import { useTx } from "@/hooks/useTx"
import { useWalletStore } from "@/store/wallet"
import RegisterDRepForm, { type DRepFormData } from "@/components/drep/RegisterDRepForm"
import RegisterDRepSuccess from "@/components/drep/RegisterDRepSuccess"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

type WizardStep = "step1" | "step2" | "confirm" | "uploading" | "signing" | "success" | "error"

const STEP_LABELS = ["Thông tin", "Hồ sơ", "Xác nhận", "Hoàn tất"]
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
  paymentAddress: "",
  doNotList: false,
  references: [],
}

// ─── Step indicator ─────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {STEP_LABELS.map((label, i) => (
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
          {i < STEP_LABELS.length - 1 && (
            <div className={`w-10 sm:w-16 h-0.5 mx-1 mb-4 transition-colors ${i < current ? "bg-accent" : "bg-border-default"}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Confirm step ────────────────────────────────────────────────────────────
function ConfirmStep({
  data,
  drepId,
  onConfirm,
  onBack,
  isLoading,
  statusLabel,
}: {
  data: DRepFormData
  drepId: string | null
  onConfirm: () => void
  onBack: () => void
  isLoading: boolean
  statusLabel: string | null
}) {
  const filledFields = [
    data.motivations && "Động lực",
    data.objectives && "Mục tiêu",
    data.qualifications && "Năng lực",
    data.imageUrl && "Ảnh đại diện",
    data.paymentAddress && "Địa chỉ nhận phí",
    data.references.length > 0 && `${data.references.length} liên kết`,
  ].filter(Boolean)

  return (
    <div className="space-y-5">
      {/* DRep preview */}
      <div className="card-static space-y-4">
        <div className="flex items-center gap-4">
          {data.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.imageUrl} alt="avatar" className="w-14 h-14 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-xl shrink-0">
              {data.givenName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-text-primary font-bold text-lg">{data.givenName}</p>
            {data.doNotList && (
              <span className="badge text-xs">Ẩn khỏi danh sách</span>
            )}
          </div>
        </div>

        {filledFields.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {filledFields.map(f => (
              <span key={String(f)} className="badge text-xs">{String(f)}</span>
            ))}
          </div>
        )}
      </div>

      {/* DRep ID */}
      {drepId && (
        <div className="card-static">
          <p className="text-text-muted text-xs font-medium mb-1">DRep ID (on-chain)</p>
          <p className="font-mono text-xs text-text-secondary break-all">{drepId}</p>
        </div>
      )}

      {/* Fee notice */}
      <div className="notice">
        <p className="text-text-primary text-sm font-medium mb-1">Phí đăng ký</p>
        <ul className="text-text-secondary text-xs space-y-0.5">
          <li>• Deposit: <span className="text-text-primary font-medium">500 ADA</span> (hoàn lại khi retire)</li>
          <li>• Network fee: <span className="text-text-primary font-medium">~0.2 ADA</span></li>
          <li>• Metadata upload: <span className="text-text-primary font-medium">miễn phí</span> (Pinata)</li>
        </ul>
        <p className="text-text-muted text-xs mt-2">
          Số tiền chính xác sẽ hiển thị trong ví khi ký.
        </p>
      </div>

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
          ← Sửa lại
        </button>
        <button className="btn-primary flex-1" onClick={onConfirm} disabled={isLoading}>
          {isLoading ? "Đang xử lý..." : "Xác nhận & Đăng ký"}
        </button>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────
export default function RegisterDRepPage() {
  const { isConnected, hasCip95, isDrepRegistered, drepKey, networkId } = useWallet()
  const { submitTx } = useTx()
  const setDRepStatus = useWalletStore(s => s.setDRepStatus)

  const [wizardStep, setWizardStep] = useState<WizardStep>("step1")
  const [formData, setFormData] = useState<DRepFormData>(EMPTY_FORM)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusLabel, setStatusLabel] = useState<string | null>(null)

  const drepId = drepKey?.dRepIDCip105 ?? null
  const isSubmitting = wizardStep === "uploading" || wizardStep === "signing"

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
          <h1 className="text-xl font-bold">Kết nối ví để tiếp tục</h1>
          <p className="text-text-secondary text-sm">
            Bạn cần kết nối ví Cardano hỗ trợ CIP-95 (Eternl, Lace, Yoroi...) để đăng ký DRep.
          </p>
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
          <h1 className="text-xl font-bold">Ví không hỗ trợ CIP-95</h1>
          <p className="text-text-secondary text-sm">
            Ví hiện tại không hỗ trợ Cardano Governance (CIP-95). Vui lòng dùng{" "}
            <span className="text-text-primary font-medium">Eternl</span> hoặc{" "}
            <span className="text-text-primary font-medium">Lace</span>.
          </p>
        </div>
      </main>
    )
  }

  if (isDrepRegistered === true && wizardStep !== "success") {
    return (
      <main className="page-container py-16 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-success/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Bạn đã là DRep</h1>
          <p className="text-text-secondary text-sm">
            Ví này đã được đăng ký làm DRep trên Cardano blockchain.
          </p>
          <a href="/dreps" className="btn-primary inline-block">
            Xem danh sách DRep
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
      // Step: upload metadata to IPFS
      setWizardStep("uploading")
      setStatusLabel("Đang upload metadata lên IPFS...")

      const uploadRes = await fetch(`${API_URL}/metadata/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drepId,
          givenName: formData.givenName,
          motivations: formData.motivations || undefined,
          objectives: formData.objectives || undefined,
          qualifications: formData.qualifications || undefined,
          imageUrl: formData.imageUrl || undefined,
          paymentAddress: formData.paymentAddress || undefined,
          doNotList: formData.doNotList,
          references: formData.references.filter(r => r.label && r.uri),
        }),
      })

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}))
        throw new Error(err.error ?? "Upload metadata thất bại")
      }

      const { anchorUrl, anchorDataHash } = await uploadRes.json()

      // Step: build + sign + submit TX
      setWizardStep("signing")
      setStatusLabel("Đang yêu cầu ký giao dịch trong ví...")

      const hash = await submitTx("DREP_REGISTER", { drepId, anchorUrl, anchorDataHash })

      // Update wallet store optimistically
      setDRepStatus({ isDrepRegistered: true, drepName: formData.givenName, delegatedDrep: null })

      setTxHash(hash)
      setStatusLabel(null)
      setWizardStep("success")
    } catch (err: unknown) {
      setStatusLabel(null)
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định")
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
            <h1 className="text-2xl font-bold text-text-primary">Đăng ký DRep</h1>
            <p className="text-text-secondary text-sm mt-1">
              Trở thành Đại diện Ủy quyền (DRep) trên Cardano blockchain.
            </p>
          </div>
        )}

        {/* Step indicator */}
        {wizardStep !== "success" && (
          <StepIndicator current={STEP_INDEX[wizardStep]} />
        )}

        {/* Card */}
        <div className="card-static">
          {wizardStep === "step1" && (
            <RegisterDRepForm
              data={formData}
              step={1}
              onChange={setFormData}
              onNext={() => setWizardStep("step2")}
              onBack={() => {}}
            />
          )}

          {wizardStep === "step2" && (
            <RegisterDRepForm
              data={formData}
              step={2}
              onChange={setFormData}
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
            />
          )}

          {wizardStep === "error" && (
            <div className="space-y-5">
              <div className="notice-warning">
                <p className="text-text-primary font-medium text-sm mb-1">Đăng ký thất bại</p>
                <p className="text-text-secondary text-sm">{error}</p>
              </div>
              <div className="flex gap-3">
                <button className="btn-outline flex-1" onClick={() => setWizardStep("confirm")}>
                  ← Thử lại
                </button>
                <button className="btn-outline flex-1" onClick={() => { setFormData(EMPTY_FORM); setWizardStep("step1") }}>
                  Bắt đầu lại
                </button>
              </div>
            </div>
          )}

          {wizardStep === "success" && txHash && (
            <RegisterDRepSuccess
              txHash={txHash}
              drepName={formData.givenName}
              networkId={networkId}
            />
          )}
        </div>
      </div>
    </main>
  )
}
