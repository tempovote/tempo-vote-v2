"use client"

import { useState } from "react"
import { useWallet } from "@/hooks/useWallet"
import { useTx } from "@/hooks/useTx"
import { useWalletStore } from "@/store/wallet"
import RegisterDRepForm, { type DRepFormData } from "@/components/drep/RegisterDRepForm"
import RegisterDRepSuccess from "@/components/drep/RegisterDRepSuccess"
import { authHeader, getJwt } from "@/lib/api"
import { resolveAnchorUrl } from "@/lib/governance"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

type WizardStep = "step1" | "step2" | "confirm" | "uploading" | "signing" | "delegating" | "success" | "error"

const STEP_LABELS = ["Thông tin", "Hồ sơ", "Xác nhận", "Hoàn tất"]
const STEP_INDEX: Record<WizardStep, number> = {
  step1: 0, step2: 1, confirm: 2,
  uploading: 3, signing: 3, delegating: 3, success: 3, error: 3,
}

const EMPTY_FORM: DRepFormData = {
  givenName: "",
  motivations: "",
  objectives: "",
  qualifications: "",
  imageUrl: "",
  imagePreviewUrl: "",
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
  const profileSections = [
    data.motivations && { label: "Động lực", text: data.motivations },
    data.objectives && { label: "Mục tiêu", text: data.objectives },
    data.qualifications && { label: "Kinh nghiệm & Năng lực", text: data.qualifications },
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
              {data.doNotList && <span className="badge text-xs">Ẩn khỏi danh sách</span>}
              {data.paymentAddress && <span className="badge text-xs">Địa chỉ nhận phí</span>}
            </div>
          </div>
        </div>
        {drepId && (
          <div className="border-t border-border-subtle pt-3">
            <p className="text-text-muted text-xs font-medium mb-1">DRep ID (on-chain)</p>
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
              <p className="text-text-secondary text-sm leading-relaxed">{text}</p>
            </div>
          ))}
          {data.references.length > 0 && (
            <div>
              <p className="text-text-secondary text-sm font-semibold mb-1">Liên kết tham chiếu</p>
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
        <p className="text-text-primary text-sm font-semibold">Phí đăng ký</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-text-muted">Deposit (hoàn lại khi retire)</span>
            <span className="text-text-primary font-medium">500 ADA</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted">Network fee (TX 1 — đăng ký DRep)</span>
            <span className="text-text-primary font-medium">~0.2 ADA</span>
          </div>
          {enableSelfDelegate && (
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Network fee (TX 2 — ủy quyền voting power)</span>
              <span className="text-text-primary font-medium">~0.2 ADA</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-text-muted">Metadata upload (Pinata)</span>
            <span className="text-text-primary font-medium">miễn phí</span>
          </div>
          {enableCommunity && (
            <div className="flex justify-between items-center">
              <span className="text-text-muted">DRep Community (phí nền tảng)</span>
              <span className="text-accent font-medium">2 ADA</span>
            </div>
          )}
        </div>
        <p className="text-text-muted text-xs border-t border-border-subtle pt-2">
          Số tiền chính xác sẽ hiển thị trong ví khi ký.
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
              Ủy quyền voting power cho chính mình
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              Bắt buộc để có voting power — ký thêm 1 TX (~0.2 ADA). Không bật = voting power = 0.
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
              Kích hoạt DRep Community
            </p>
            <p className="text-xs text-text-muted mt-0.5">
              Tạo không gian thảo luận và đề xuất cho cộng đồng của bạn (2 ADA)
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
          ← Sửa lại
        </button>
        <button className="btn-primary flex-1" onClick={onConfirm} disabled={isLoading}>
          {isLoading ? "Đang xử lý..." : "Xác nhận & Đăng ký"}
        </button>
      </div>
    </div>
  )
}

// ─── Error helpers ───────────────────────────────────────────────────────────
function friendlyError(msg: string): { title: string; detail: string } {
  const m = msg.toLowerCase()
  if (m.includes("declined") || m.includes("refuse") || m.includes("cancel")) {
    return { title: "Giao dịch bị từ chối", detail: "Bạn đã huỷ ký trong ví. Nhấn \"Thử lại\" để đăng ký lại." }
  }
  if (m.includes("insufficient funds") || m.includes("insufficient balance") || m.includes("not enough ada")) {
    return { title: "Số dư không đủ", detail: "Cần ít nhất ~500.2 ADA (500 ADA deposit + phí mạng ~0.2 ADA)." }
  }
  if (m.includes("timeout") || m.includes("timed out")) {
    return { title: "Hết thời gian chờ", detail: "Yêu cầu mất quá nhiều thời gian. Vui lòng kiểm tra kết nối và thử lại." }
  }
  if (m.includes("already registered") || m.includes("already exists")) {
    return { title: "Đã đăng ký trước đó", detail: "DRep ID này đã được đăng ký on-chain." }
  }
  if (m.includes("pinata") || m.includes("ipfs") || m.includes("upload")) {
    return { title: "Upload metadata thất bại", detail: "Không thể tải metadata lên IPFS. Kiểm tra cấu hình Pinata JWT và thử lại." }
  }
  return { title: "Đăng ký thất bại", detail: msg }
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
  // Cache anchor data so retries skip the IPFS metadata re-upload
  const [anchorCache, setAnchorCache] = useState<{ anchorUrl: string; anchorDataHash: string } | null>(null)

  const drepId = drepKey?.dRepIDCip105 ?? null
  const isSubmitting = wizardStep === "uploading" || wizardStep === "signing" || wizardStep === "delegating"
  const [selfDelegateEnabled, setSelfDelegateEnabled] = useState(true)
  const [communityEnabled, setCommunityEnabled] = useState(false)
  const [delegateTxHash, setDelegateTxHash] = useState<string | null>(null)

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
      let anchor = anchorCache

      if (!anchor) {
        // Upload metadata to IPFS only if not already done (first attempt or form changed)
        setWizardStep("uploading")
        setStatusLabel("Đang upload metadata lên IPFS...")

        const uploadRes = await fetch(`${API_URL}/metadata/upload`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader(getJwt()) },
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
        anchor = { anchorUrl, anchorDataHash }
        setAnchorCache(anchor)
      }

      // TX 1: register DRep
      setWizardStep("signing")
      setStatusLabel(
        selfDelegateEnabled
          ? "Ký giao dịch 1/2 — Đăng ký DRep..."
          : "Đang yêu cầu ký giao dịch trong ví...",
      )

      const hash = await submitTx("DREP_REGISTER", { drepId, anchorUrl: anchor.anchorUrl, anchorDataHash: anchor.anchorDataHash })

      // TX 2: self-delegate voting power (non-blocking — user chose to enable)
      let selfDelegateDone = false
      if (selfDelegateEnabled) {
        setWizardStep("delegating")
        setStatusLabel("Ký giao dịch 2/2 — Ủy quyền voting power cho chính mình...")
        try {
          const delegateHash = await submitTx("DELEGATE", { targetDrepId: drepId, delegationType: "drep" })
          setDelegateTxHash(delegateHash)
          selfDelegateDone = true
        } catch (delegateErr: unknown) {
          console.warn("[DRep Register] Self-delegation failed (non-blocking):", delegateErr)
        }
      }

      // Update wallet store optimistically
      setDRepStatus({
        isDrepRegistered: true,
        drepName: formData.givenName,
        delegatedDrep: selfDelegateDone ? { id: drepId, name: formData.givenName } : null,
      })

      // Optional: activate DRep Community (2 ADA fee)
      if (communityEnabled) {
        setStatusLabel("Kích hoạt DRep Community (2 ADA)...")
        try {
          const communityTxHash = await submitTx("ACTIVATE_COMMUNITY", {})
          await fetch(`${API_URL}/communities/${drepId}/activate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader(getJwt()) },
            body: JSON.stringify({
              network: networkId === 1 ? "mainnet" : "preprod",
              txHash: communityTxHash,
            }),
          })
        } catch {
          // Community activation is optional — don't block success
          console.warn("[DRep Register] Community activation failed (non-blocking)")
        }
      }

      setTxHash(hash)
      setStatusLabel(null)
      setWizardStep("success")
    } catch (err: unknown) {
      setStatusLabel(null)
      const msg = err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định"
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

          {(wizardStep === "confirm" || wizardStep === "uploading" || wizardStep === "signing" || wizardStep === "delegating") && (
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
            const rawError = error ?? "Đã xảy ra lỗi không xác định"
            const { title, detail } = friendlyError(rawError)
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
                    ← Thử lại
                  </button>
                  <button className="btn-outline flex-1" onClick={() => {
                    if (formData.imageUrl.startsWith("ipfs://")) {
                      fetch(`${API_URL}/metadata/unpin/${formData.imageUrl.slice(7)}`, { method: "DELETE", headers: authHeader(getJwt()) }).catch(() => {})
                    }
                    setFormData(EMPTY_FORM)
                    setWizardStep("step1")
                  }}>
                    Bắt đầu lại
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
              delegateTxHash={delegateTxHash}
            />
          )}
        </div>
      </div>
    </main>
  )
}
