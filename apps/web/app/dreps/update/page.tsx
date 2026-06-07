"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@/hooks/useWallet"
import { useTx } from "@/hooks/useTx"
import { useDRepProfile } from "@/hooks/useDRepProfile"
import RegisterDRepForm, { type DRepFormData } from "@/components/drep/RegisterDRepForm"
import RegisterDRepSuccess from "@/components/drep/RegisterDRepSuccess"
import { authHeader, getJwt } from "@/lib/api"
import { resolveAnchorUrl } from "@/lib/governance"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

type WizardStep = "loading" | "step1" | "step2" | "confirm" | "uploading" | "signing" | "success" | "error"

const STEP_LABELS = ["Thông tin", "Hồ sơ", "Xác nhận", "Hoàn tất"]
const STEP_INDEX: Record<WizardStep, number> = {
  loading: 0, step1: 0, step2: 1, confirm: 2,
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
  doNotList: false,
  references: [],
}

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

function ConfirmUpdateStep({
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
  const displayImageUrl = data.imagePreviewUrl || (data.imageUrl ? (resolveAnchorUrl(data.imageUrl) ?? data.imageUrl) : null)

  const profileSections = [
    data.motivations && { label: "Động lực", text: data.motivations },
    data.objectives && { label: "Mục tiêu", text: data.objectives },
    data.qualifications && { label: "Kinh nghiệm & Năng lực", text: data.qualifications },
  ].filter(Boolean) as { label: string; text: string }[]

  return (
    <div className="space-y-4">
      <div className="card-static space-y-3">
        <div className="flex items-center gap-3">
          {displayImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayImageUrl} alt="avatar" className="w-12 h-12 rounded-full object-cover shrink-0" />
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

      <div className="card-static space-y-2">
        <p className="text-text-primary text-sm font-semibold">Phí cập nhật</p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-text-muted">Network fee</span>
            <span className="text-text-primary font-medium">~0.2 ADA</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-muted">Metadata upload (Pinata)</span>
            <span className="text-text-primary font-medium">miễn phí</span>
          </div>
        </div>
        <p className="text-text-muted text-xs border-t border-border-subtle pt-2">
          Số tiền chính xác sẽ hiển thị trong ví khi ký.
        </p>
      </div>

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
          {isLoading ? "Đang xử lý..." : "Xác nhận & Cập nhật"}
        </button>
      </div>
    </div>
  )
}

function friendlyError(msg: string): { title: string; detail: string } {
  const m = msg.toLowerCase()
  if (m.includes("locked")) {
    return { title: "Ví đang bị khóa", detail: "Mở ví Eternl, nhập mật khẩu để mở khóa, sau đó nhấn \"Thử lại\"." }
  }
  if (m.includes("declined") || m.includes("refuse") || m.includes("cancel")) {
    return { title: "Giao dịch bị từ chối", detail: "Bạn đã huỷ ký trong ví. Nhấn \"Thử lại\" để tiếp tục." }
  }
  if (m.includes("insufficient funds") || m.includes("insufficient balance")) {
    return { title: "Số dư không đủ", detail: "Cần ít nhất ~0.2 ADA để trả phí mạng." }
  }
  if (m.includes("timeout") || m.includes("timed out")) {
    return { title: "Hết thời gian chờ", detail: "Yêu cầu mất quá nhiều thời gian. Kiểm tra kết nối và thử lại." }
  }
  if (m.includes("pinata") || m.includes("ipfs") || m.includes("upload")) {
    return { title: "Upload metadata thất bại", detail: "Không thể tải metadata lên IPFS. Kiểm tra cấu hình Pinata JWT và thử lại." }
  }
  return { title: "Cập nhật thất bại", detail: msg }
}

export default function UpdateDRepPage() {
  const { isConnected, hasCip95, isDrepRegistered, drepKey, networkId, isWalletHydrating } = useWallet()
  const { submitTx } = useTx()

  const drepId = drepKey?.dRepIDCip105 ?? null
  const network = networkId === 1 ? "mainnet" : "preprod"

  const { profile, isLoading: profileLoading, isLoadingMeta } = useDRepProfile(
    drepId ?? "",
    network,
  )

  const [wizardStep, setWizardStep] = useState<WizardStep>("loading")
  const [formData, setFormData] = useState<DRepFormData>(EMPTY_FORM)
  const [prefilled, setPrefilled] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [statusLabel, setStatusLabel] = useState<string | null>(null)
  const [anchorCache, setAnchorCache] = useState<{ anchorUrl: string; anchorDataHash: string } | null>(null)

  const isSubmitting = wizardStep === "uploading" || wizardStep === "signing"

  // Pre-fill form once IPFS metadata arrives
  useEffect(() => {
    if (!profile || prefilled) return
    // Wait for IPFS meta if anchor exists (isLoadingMeta), but don't block forever
    if (profile.anchorUrl && isLoadingMeta) return

    setFormData({
      givenName: profile.givenName ?? "",
      motivations: profile.motivations ?? "",
      objectives: profile.objectives ?? "",
      qualifications: profile.qualifications ?? "",
      imageUrl: profile.imageUrl ?? "",
      imagePreviewUrl: profile.imageUrl ?? "",
      paymentAddress: "",
      doNotList: false,
      references: (profile.references ?? []).map(r => ({
        type: r["@type"] ?? "Other",
        label: r.label ?? "",
        uri: r.uri ?? "",
      })),
    })
    setPrefilled(true)
    setWizardStep("step1")
  }, [profile, isLoadingMeta, prefilled])

  // Move out of "loading" if profile loaded but has no anchor (no IPFS meta to wait for)
  useEffect(() => {
    if (!profileLoading && profile && !profile.anchorUrl && !prefilled) {
      setPrefilled(true)
      setWizardStep("step1")
    }
  }, [profileLoading, profile, prefilled])

  // ── Guards ──────────────────────────────────────────────────────────────
  if (isWalletHydrating) {
    return (
      <main className="page-container py-16 flex justify-center">
        <div className="flex items-center gap-3 text-text-muted text-sm">
          <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
          Đang khôi phục kết nối ví...
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
          <h1 className="text-xl font-bold">Kết nối ví để tiếp tục</h1>
          <p className="text-text-secondary text-sm">Bạn cần kết nối ví Cardano để cập nhật hồ sơ DRep.</p>
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
          <p className="text-text-secondary text-sm">Vui lòng dùng Eternl hoặc Lace.</p>
        </div>
      </main>
    )
  }

  if (isDrepRegistered === false) {
    return (
      <main className="page-container py-16 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-warning/10 flex items-center justify-center">
            <svg className="w-7 h-7 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H2.645c-1.73 0-2.813-1.874-1.948-3.374L10.051 3.378c.866-1.5 3.032-1.5 3.898 0l8.354 14.748z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold">Bạn chưa phải DRep</h1>
          <p className="text-text-secondary text-sm">Chỉ DRep đã đăng ký mới có thể cập nhật hồ sơ.</p>
          <a href="/dreps/register" className="btn-primary inline-block">Đăng ký DRep</a>
        </div>
      </main>
    )
  }

  // ── Submit flow ──────────────────────────────────────────────────────────
  async function handleUpdate() {
    if (!drepId) return
    setError(null)

    try {
      let anchor = anchorCache

      if (!anchor) {
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
          throw new Error((err as { error?: string }).error ?? "Upload metadata thất bại")
        }

        const { anchorUrl, anchorDataHash } = await uploadRes.json() as { anchorUrl: string; anchorDataHash: string }
        anchor = { anchorUrl, anchorDataHash }
        setAnchorCache(anchor)
      }

      setWizardStep("signing")
      setStatusLabel("Đang yêu cầu ký giao dịch trong ví...")

      const hash = await submitTx("DREP_UPDATE", {
        drepId,
        anchorUrl: anchor.anchorUrl,
        anchorDataHash: anchor.anchorDataHash,
      })

      setTxHash(hash)
      setStatusLabel(null)
      setWizardStep("success")
    } catch (err: unknown) {
      setStatusLabel(null)
      const msg = err instanceof Error ? err.message : "Đã xảy ra lỗi không xác định"
      setError(msg)
      setWizardStep("error")
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <main className="page-container py-10">
      <div className="max-w-lg mx-auto">
        {wizardStep !== "success" && (
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-text-primary">Cập nhật hồ sơ DRep</h1>
            <p className="text-text-secondary text-sm mt-1">
              Chỉnh sửa thông tin và cập nhật metadata on-chain.
            </p>
          </div>
        )}

        {wizardStep !== "success" && wizardStep !== "loading" && (
          <StepIndicator current={STEP_INDEX[wizardStep]} />
        )}

        <div className="card-static">
          {wizardStep === "loading" && (
            <div className="flex items-center gap-3 py-4 text-sm text-text-muted">
              <div className="spinner shrink-0" style={{ width: 16, height: 16, borderWidth: 2 }} />
              {isLoadingMeta ? "Đang tải metadata từ IPFS..." : "Đang tải thông tin DRep..."}
            </div>
          )}

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
            <ConfirmUpdateStep
              data={formData}
              drepId={drepId}
              onConfirm={handleUpdate}
              onBack={() => setWizardStep("step2")}
              isLoading={isSubmitting}
              statusLabel={statusLabel}
            />
          )}

          {wizardStep === "error" && (() => {
            const rawError = error ?? "Đã xảy ra lỗi không xác định"
            const { title, detail } = friendlyError(rawError)
            const showRaw = detail === rawError
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
                  <button className="btn-outline flex-1" onClick={() => { setAnchorCache(null); setWizardStep("step1") }}>
                    Sửa lại từ đầu
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
              successMessage="Hồ sơ DRep đã được cập nhật thành công!"
            />
          )}
        </div>
      </div>
    </main>
  )
}
