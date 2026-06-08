"use client"

import { use, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useWallet } from "@/hooks/useWallet"
import { useWalletStore } from "@/store/wallet"
import { usePollDetail } from "@/hooks/useCommunity"
import { useTx } from "@/hooks/useTx"
import { authHeader, getJwt } from "@/lib/api"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function explorerTxUrl(txHash: string, network: string) {
  const base = network === "mainnet" ? "https://cardanoscan.io" : "https://preprod.cardanoscan.io"
  return `${base}/transaction/${txHash}`
}

function govActionUrl(txHash: string, network: string) {
  const base = network === "mainnet" ? "https://cardanoscan.io" : "https://preprod.cardanoscan.io"
  return `${base}/govAction/${txHash}%2300`
}

// ─── Step indicator ──────────────────────────────────────────────────────────

const STEPS = ["Review thông tin", "Upload Metadata", "Submit lên chain"]

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
              i < current  ? "bg-accent border-accent text-white" :
              i === current ? "bg-bg-card border-accent text-accent" :
                              "bg-bg-card border-border-default text-text-muted"
            }`}>
              {i < current ? "✓" : i + 1}
            </div>
            <span className={`text-xs font-medium whitespace-nowrap ${i === current ? "text-accent" : "text-text-muted"}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mt-[-14px] transition-colors ${i < current ? "bg-accent" : "bg-border-default"}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Deposit warning ─────────────────────────────────────────────────────────

function DepositWarning({ network }: { network: string }) {
  const amount = network === "mainnet" ? "100,000 ADA" : "~500 ADA"
  return (
    <div className="notice-warning rounded-xl p-4 text-sm">
      <span className="font-semibold">Lưu ý về Deposit:</span> Khi submit Governance Action lên chain,
      ví của bạn sẽ bị khóa <span className="font-bold">{amount}</span> làm deposit. Số ADA này sẽ được
      hoàn trả về reward address của bạn sau khi action hết hiệu lực (expired epoch).
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

type Step = "review" | "upload" | "submit" | "submitting" | "success" | "error"

export default function NewGovernanceActionPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; network?: string }>
}) {
  const params = use(searchParams)
  const sourcePollId = params.source ?? ""
  const network = params.network ?? "preprod"
  const networkParam = network !== "mainnet" ? `?network=${network}` : ""

  const router = useRouter()
  const { isConnected, reauthenticate } = useWallet()
  const drepKey = useWalletStore((s) => s.drepKey)
  const drepId = drepKey?.dRepIDCip105 ?? null

  const { poll, isLoading: pollLoading, error: pollError } = usePollDetail(sourcePollId)
  const { submitTx } = useTx()

  const [step, setStep] = useState<Step>("review")
  const [statusLabel, setStatusLabel] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)

  // Editable form state (pre-filled from poll)
  const [title, setTitle] = useState("")
  const [abstract, setAbstract] = useState("")
  const [motivation, setMotivation] = useState("")
  const [rationale, setRationale] = useState("")

  // Populated after IPFS upload
  const [anchorCache, setAnchorCache] = useState<{ anchorUrl: string; anchorDataHash: string } | null>(null)

  // Pre-fill from poll once loaded
  const [prefilled, setPrefilled] = useState(false)
  if (poll && !prefilled) {
    setTitle(poll.title ?? "")
    setAbstract(poll.abstract ?? "")
    setMotivation((poll as any).motivation ?? "")
    setRationale((poll as any).rationale ?? "")
    setPrefilled(true)
  }

  const isSubmitting = step === "submitting"

  // ─── Guard: no source poll ─────────────────────────────────────────────────
  if (!sourcePollId) {
    return (
      <main className="page-container py-12 max-w-2xl mx-auto">
        <div className="notice-warning rounded-xl p-6 text-center">
          <p className="font-semibold mb-2">Thiếu thông tin Poll nguồn</p>
          <p className="text-sm text-text-secondary mb-4">
            Trang này chỉ hỗ trợ tạo Governance Action từ Internal Poll.
          </p>
          <Link href={`/governance-actions${networkParam}`} className="btn-primary px-4 py-2 text-sm rounded-lg">
            Quay lại Governance Actions
          </Link>
        </div>
      </main>
    )
  }

  // ─── Guard: wallet not connected ───────────────────────────────────────────
  if (!isConnected) {
    return (
      <main className="page-container py-12 max-w-2xl mx-auto">
        <div className="notice-warning rounded-xl p-6 text-center">
          <p className="font-semibold mb-2">Vui lòng kết nối ví</p>
          <p className="text-sm text-text-secondary">Bạn cần kết nối ví Cardano để propose Governance Action.</p>
        </div>
      </main>
    )
  }

  // ─── Guard: not a DRep ────────────────────────────────────────────────────
  if (!drepId) {
    return (
      <main className="page-container py-12 max-w-2xl mx-auto">
        <div className="notice-warning rounded-xl p-6 text-center">
          <p className="font-semibold mb-2">Chỉ dành cho DRep</p>
          <p className="text-sm text-text-secondary">
            Tính năng này yêu cầu ví của bạn phải là DRep đã đăng ký trên chain.
          </p>
        </div>
      </main>
    )
  }

  // ─── Step 1: Upload metadata to IPFS ──────────────────────────────────────
  async function handleUpload() {
    if (!drepId) return
    let jwt = getJwt()
    if (!jwt) jwt = await reauthenticate()
    if (!jwt) { setErrorMsg("Xác thực thất bại"); return }

    setStep("submitting")
    setStatusLabel("Đang upload CIP-108 metadata lên IPFS...")

    try {
      let res = await fetch(`${API_URL}/metadata/upload-proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(jwt) },
        body: JSON.stringify({ drepId, title, abstract, motivation: motivation || undefined, rationale: rationale || undefined }),
      })

      if (res.status === 401) {
        const newJwt = await reauthenticate()
        if (!newJwt) throw new Error("Xác thực thất bại")
        res = await fetch(`${API_URL}/metadata/upload-proposal`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader(newJwt) },
          body: JSON.stringify({ drepId, title, abstract, motivation: motivation || undefined, rationale: rationale || undefined }),
        })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload thất bại" }))
        throw new Error(err.error ?? "Upload thất bại")
      }

      const { anchorUrl, anchorDataHash } = await res.json()
      setAnchorCache({ anchorUrl, anchorDataHash })
      setStep("submit")
    } catch (e: any) {
      setErrorMsg(e.message ?? "Upload thất bại")
      setStep("error")
    }
  }

  // ─── Step 2: Build + Sign + Submit TX ─────────────────────────────────────
  async function handleSubmitTx() {
    if (!anchorCache) return
    setStep("submitting")
    setStatusLabel("Đang build transaction...")
    try {
      setStatusLabel("Đang ký transaction trong ví...")
      const hash = await submitTx("PROPOSE_INFO_ACTION", {
        anchorUrl: anchorCache.anchorUrl,
        anchorDataHash: anchorCache.anchorDataHash,
      })
      setTxHash(hash)
      setStep("success")
    } catch (e: any) {
      setErrorMsg(e.message ?? "Submit thất bại")
      setStep("error")
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (pollLoading) {
    return (
      <main className="page-container py-12 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-bg-elevated rounded w-2/3" />
          <div className="h-40 bg-bg-elevated rounded" />
        </div>
      </main>
    )
  }

  if (pollError || !poll) {
    return (
      <main className="page-container py-12 max-w-2xl mx-auto">
        <div className="notice-warning rounded-xl p-6 text-center">
          <p className="font-semibold">Không thể tải Poll</p>
          <p className="text-sm text-text-secondary mt-1">{pollError ?? "Poll không tồn tại"}</p>
        </div>
      </main>
    )
  }

  const stepIndex = step === "review" ? 0 : step === "upload" || (step === "submitting" && !anchorCache) ? 1 : 2

  return (
    <main className="page-container py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary mb-2">Propose Governance Action</h1>
      <p className="text-sm text-text-secondary mb-8">
        Từ Internal Poll <span className="text-accent font-medium">"{poll.title}"</span>
      </p>

      {step !== "success" && step !== "error" && <StepIndicator current={stepIndex} />}

      {/* ── Success ── */}
      {step === "success" && txHash && (
        <div className="notice-success rounded-xl p-8 text-center space-y-4">
          <div className="text-4xl">🎉</div>
          <p className="text-lg font-bold text-text-primary">Governance Action đã được submit!</p>
          <p className="text-sm text-text-secondary">
            Transaction đang được xử lý. Thường mất 1–2 phút để xuất hiện trên chain.
          </p>
          <div className="bg-bg-elevated rounded-lg p-3 font-mono text-xs text-text-secondary break-all">
            {txHash}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <a
              href={explorerTxUrl(txHash, network)}
              target="_blank" rel="noopener noreferrer"
              className="btn-primary px-5 py-2.5 rounded-lg text-sm font-semibold"
            >
              Xem TX trên Cardanoscan
            </a>
            <a
              href={govActionUrl(txHash, network)}
              target="_blank" rel="noopener noreferrer"
              className="px-5 py-2.5 rounded-lg text-sm font-semibold border border-border-default text-text-secondary hover:border-accent/50 hover:text-accent-light transition-colors"
            >
              Xem Governance Action
            </a>
            <Link
              href={`/governance-actions${networkParam}`}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold border border-border-default text-text-secondary hover:border-accent/50 hover:text-accent-light transition-colors"
            >
              Về danh sách GA
            </Link>
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {step === "error" && (
        <div className="notice-warning rounded-xl p-6 space-y-4">
          <p className="font-semibold text-text-primary">Có lỗi xảy ra</p>
          <p className="text-sm text-text-secondary">{errorMsg}</p>
          <div className="flex gap-3">
            <button
              onClick={() => { setErrorMsg(null); setStep(anchorCache ? "submit" : "review") }}
              className="btn-primary px-4 py-2 rounded-lg text-sm font-semibold"
            >
              Thử lại
            </button>
            <Link href={`/governance-actions${networkParam}`} className="px-4 py-2 rounded-lg text-sm border border-border-default text-text-secondary hover:border-accent/50 transition-colors">
              Hủy
            </Link>
          </div>
        </div>
      )}

      {/* ── Step 1: Review ── */}
      {(step === "review") && (
        <div className="space-y-6">
          <div className="card-static rounded-2xl p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Tiêu đề <span className="text-accent">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                className="w-full bg-bg-elevated border border-border-default rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/60"
                placeholder="Tiêu đề Governance Action..."
              />
              <p className="text-xs text-text-muted text-right">{title.length}/80</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Abstract <span className="text-accent">*</span>
              </label>
              <textarea
                value={abstract}
                onChange={(e) => setAbstract(e.target.value)}
                maxLength={2500}
                rows={4}
                className="w-full bg-bg-elevated border border-border-default rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/60 resize-none"
                placeholder="Tóm tắt nội dung..."
              />
              <p className="text-xs text-text-muted text-right">{abstract.length}/2500</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Motivation</label>
              <textarea
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                maxLength={2500}
                rows={4}
                className="w-full bg-bg-elevated border border-border-default rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/60 resize-none"
                placeholder="Lý do đề xuất..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Rationale</label>
              <textarea
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                maxLength={2500}
                rows={4}
                className="w-full bg-bg-elevated border border-border-default rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/60 resize-none"
                placeholder="Lập luận chi tiết..."
              />
            </div>

            <div className="pt-1 border-t border-border-subtle">
              <p className="text-xs text-text-muted">
                Loại: <span className="font-semibold text-text-secondary">Info Action</span> — advisory, không yêu cầu ngưỡng ratification.
              </p>
            </div>
          </div>

          <DepositWarning network={network} />

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => router.back()}
              className="px-5 py-2.5 rounded-lg text-sm border border-border-default text-text-secondary hover:border-accent/50 transition-colors"
            >
              Hủy
            </button>
            <button
              onClick={() => setStep("upload")}
              disabled={!title.trim() || !abstract.trim()}
              className="btn-primary px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Tiếp tục →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Upload metadata ── */}
      {step === "upload" && (
        <div className="space-y-6">
          <div className="card-static rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-text-primary">CIP-108 Metadata Preview</h2>
            <div className="bg-bg-elevated rounded-lg p-4 font-mono text-xs text-text-secondary overflow-auto max-h-64 space-y-1">
              <p><span className="text-accent">title:</span> {title}</p>
              <p><span className="text-accent">abstract:</span> {abstract.slice(0, 120)}{abstract.length > 120 ? "..." : ""}</p>
              {motivation && <p><span className="text-accent">motivation:</span> {motivation.slice(0, 80)}{motivation.length > 80 ? "..." : ""}</p>}
              {rationale && <p><span className="text-accent">rationale:</span> {rationale.slice(0, 80)}{rationale.length > 80 ? "..." : ""}</p>}
              <p className="text-text-muted mt-2">hashAlgorithm: blake2b-256</p>
            </div>
            <p className="text-sm text-text-secondary">
              File JSON-LD này sẽ được upload lên IPFS (Pinata). Hash blake2b-256 được tính và đính kèm vào transaction.
            </p>
          </div>

          <DepositWarning network={network} />

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setStep("review")}
              className="px-5 py-2.5 rounded-lg text-sm border border-border-default text-text-secondary hover:border-accent/50 transition-colors"
            >
              ← Sửa lại
            </button>
            <button
              onClick={handleUpload}
              className="btn-primary px-6 py-2.5 rounded-lg text-sm font-semibold"
            >
              Upload lên IPFS
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirm & Submit ── */}
      {step === "submit" && anchorCache && (
        <div className="space-y-6">
          <div className="card-static rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-text-primary">Xác nhận Submit</h2>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Loại Action</p>
                <p className="font-semibold text-text-primary">Info Action</p>
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Tiêu đề</p>
                <p className="text-text-primary">{title}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Anchor URL (IPFS)</p>
                <a
                  href={anchorCache.anchorUrl.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/")}
                  target="_blank" rel="noopener noreferrer"
                  className="text-accent hover:underline break-all text-xs"
                >
                  {anchorCache.anchorUrl}
                </a>
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Anchor Hash</p>
                <p className="font-mono text-xs text-text-secondary break-all">{anchorCache.anchorDataHash}</p>
              </div>
            </div>
          </div>

          <DepositWarning network={network} />

          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setStep("upload")}
              className="px-5 py-2.5 rounded-lg text-sm border border-border-default text-text-secondary hover:border-accent/50 transition-colors"
            >
              ← Quay lại
            </button>
            <button
              onClick={handleSubmitTx}
              className="btn-primary px-6 py-2.5 rounded-lg text-sm font-semibold"
            >
              Submit Governance Action
            </button>
          </div>
        </div>
      )}

      {/* ── Submitting overlay ── */}
      {step === "submitting" && (
        <div className="card-static rounded-2xl p-10 text-center space-y-4">
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-text-secondary">{statusLabel}</p>
        </div>
      )}
    </main>
  )
}
