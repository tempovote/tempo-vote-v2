"use client"

import { use, useState, useRef, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useWallet } from "@/hooks/useWallet"
import { useWalletStore } from "@/store/wallet"
import { usePollDetail } from "@/hooks/useCommunity"
import { useTx } from "@/hooks/useTx"
import { RationaleEditor } from "@/components/governance/RationaleEditor"
import { AlertModal } from "@/components/ui/AlertModal"
import { authHeader, getJwt } from "@/lib/api"
import type { BuildTxRequest } from "@tempo/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ─── GA type registry ────────────────────────────────────────────────────────

type GaTypeMeta = {
  label: string
  desc: string
  txType: BuildTxRequest["txType"] | null
}

const GA_TYPES: Record<string, GaTypeMeta> = {
  infoAction:               { label: "Info Action",               desc: "Đề xuất tư vấn, không ràng buộc on-chain",           txType: "PROPOSE_INFO_ACTION" },
  noConfidence:             { label: "No Confidence",             desc: "Bất tín nhiệm Constitutional Committee hiện tại",    txType: "PROPOSE_NO_CONFIDENCE" },
  hardForkInitiation:       { label: "Hard Fork Initiation",      desc: "Đề xuất nâng cấp phiên bản giao thức Cardano",      txType: "PROPOSE_HARD_FORK" },
  newConstitution:          { label: "New Constitution",          desc: "Đề xuất thay đổi Hiến pháp Cardano on-chain",       txType: "PROPOSE_NEW_CONSTITUTION" },
  treasuryWithdrawals:      { label: "Treasury Withdrawals",      desc: "Rút ADA từ quỹ Cardano treasury",                   txType: null },
  updateCommittee:          { label: "Update Committee",          desc: "Thêm/xóa thành viên Constitutional Committee",      txType: null },
  protocolParametersUpdate: { label: "Protocol Parameter Change", desc: "Thay đổi thông số giao thức (phức tạp)",            txType: null },
}

// ─── Shared style constants ──────────────────────────────────────────────────

const LABEL = "text-xs font-semibold text-text-secondary uppercase tracking-wider"
const INPUT = "w-full bg-bg-elevated border border-border-subtle rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60 transition-colors"
const INPUT_SM = "bg-bg-elevated border border-border-subtle rounded-xl px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/60 transition-colors"

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="text-xs font-bold text-text-muted uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-border-subtle" />
    </div>
  )
}

function explorerTxUrl(txHash: string, network: string) {
  const base = network === "mainnet" ? "https://cardanoscan.io" : "https://preprod.cardanoscan.io"
  return `${base}/transaction/${txHash}`
}

// ─── Type-specific param state ────────────────────────────────────────────────

type TypeParams = {
  prevGovActionTxHash: string
  prevGovActionIdx: string
  protocolVersionMajor: string
  protocolVersionMinor: string
  constitutionAnchorUrl: string
  constitutionAnchorHash: string
  constitutionScriptHash: string
}

const EMPTY_TYPE_PARAMS: TypeParams = {
  prevGovActionTxHash: "",
  prevGovActionIdx: "",
  protocolVersionMajor: "",
  protocolVersionMinor: "0",
  constitutionAnchorUrl: "",
  constitutionAnchorHash: "",
  constitutionScriptHash: "",
}

// ─── Type-specific field components ──────────────────────────────────────────

function PrevGovActionFields({
  params,
  onChange,
  label = "Previous Governance Action",
  hint = "ID của GA cùng loại đã được enacted trước đó. Để trống nếu đây là lần đầu.",
}: {
  params: TypeParams
  onChange: (patch: Partial<TypeParams>) => void
  label?: string
  hint?: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className={LABEL}>
          {label}
          <span className="ml-1.5 text-[10px] text-text-muted font-normal normal-case bg-bg-elevated px-1.5 py-0.5 rounded">Optional</span>
        </label>
      </div>
      <p className="text-xs text-text-muted">{hint}</p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          type="text"
          value={params.prevGovActionTxHash}
          onChange={(e) => onChange({ prevGovActionTxHash: e.target.value })}
          placeholder="TX Hash (64 hex chars)..."
          className={INPUT_SM + " font-mono text-xs"}
        />
        <input
          type="number"
          min={0}
          value={params.prevGovActionIdx}
          onChange={(e) => onChange({ prevGovActionIdx: e.target.value })}
          placeholder="Idx"
          className={INPUT_SM + " w-20 text-center"}
        />
      </div>
    </div>
  )
}

function NoConfidenceFields({ params, onChange }: { params: TypeParams; onChange: (p: Partial<TypeParams>) => void }) {
  return (
    <>
      <div className="p-3 bg-warning/8 border border-warning/20 rounded-xl text-xs text-text-secondary space-y-1">
        <p className="font-semibold text-warning">No Confidence — Lưu ý</p>
        <p>Đề xuất này yêu cầu DRep threshold 60% + SPO threshold 51% để được ratified.</p>
        <p>Khi được enacted, Constitutional Committee hiện tại sẽ bị giải tán.</p>
      </div>
      <PrevGovActionFields
        params={params}
        onChange={onChange}
        label="Previous Committee Action"
        hint="GA committee action cuối cùng đã được enacted (UpdateCommittee hoặc NoConfidence trước đó)."
      />
    </>
  )
}

function HardForkFields({ params, onChange }: { params: TypeParams; onChange: (p: Partial<TypeParams>) => void }) {
  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <label className={LABEL}>Target Protocol Version <span className="text-danger font-normal normal-case">*</span></label>
        </div>
        <p className="text-xs text-text-muted">Phiên bản giao thức sau khi hard fork (Conway era hiện tại: 9.x).</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-text-muted w-12 shrink-0">Major</span>
            <input
              type="number"
              min={0}
              max={99}
              value={params.protocolVersionMajor}
              onChange={(e) => onChange({ protocolVersionMajor: e.target.value })}
              placeholder="10"
              className={INPUT_SM + " w-full text-center tabular-nums"}
            />
          </div>
          <span className="text-text-muted text-lg font-light">.</span>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-text-muted w-12 shrink-0">Minor</span>
            <input
              type="number"
              min={0}
              max={99}
              value={params.protocolVersionMinor}
              onChange={(e) => onChange({ protocolVersionMinor: e.target.value })}
              placeholder="0"
              className={INPUT_SM + " w-full text-center tabular-nums"}
            />
          </div>
        </div>
      </div>
      <PrevGovActionFields
        params={params}
        onChange={onChange}
        label="Previous Hard Fork Action"
        hint="GA hard fork cuối cùng đã được enacted. Để trống nếu không có."
      />
    </>
  )
}

function NewConstitutionFields({ params, onChange }: { params: TypeParams; onChange: (p: Partial<TypeParams>) => void }) {
  return (
    <>
      <div className="p-3 bg-accent/8 border border-accent/20 rounded-xl text-xs text-text-secondary space-y-1">
        <p className="font-semibold text-accent-light">Constitution Anchor — Tài liệu Hiến pháp</p>
        <p>URL và hash dưới đây trỏ đến <strong>nội dung Hiến pháp mới</strong>, khác với metadata của proposal này.</p>
        <p>Hash phải là blake2b-256 hex của file tại URL đó.</p>
      </div>

      <div className="space-y-1.5">
        <label className={LABEL}>Constitution URL <span className="text-danger font-normal normal-case">*</span></label>
        <input
          type="url"
          value={params.constitutionAnchorUrl}
          onChange={(e) => onChange({ constitutionAnchorUrl: e.target.value })}
          placeholder="https://ipfs.io/ipfs/... hoặc https://..."
          className={INPUT}
        />
      </div>

      <div className="space-y-1.5">
        <label className={LABEL}>Constitution Hash (blake2b-256 hex) <span className="text-danger font-normal normal-case">*</span></label>
        <input
          type="text"
          value={params.constitutionAnchorHash}
          onChange={(e) => onChange({ constitutionAnchorHash: e.target.value })}
          placeholder="64 hex chars..."
          className={INPUT + " font-mono text-xs"}
          maxLength={64}
        />
      </div>

      <div className="space-y-1.5">
        <label className={LABEL}>
          Guardrails Script Hash
          <span className="ml-1.5 text-[10px] text-text-muted font-normal normal-case bg-bg-elevated px-1.5 py-0.5 rounded">Optional</span>
        </label>
        <input
          type="text"
          value={params.constitutionScriptHash}
          onChange={(e) => onChange({ constitutionScriptHash: e.target.value })}
          placeholder="56 hex chars (28 bytes)..."
          className={INPUT + " font-mono text-xs"}
          maxLength={56}
        />
      </div>

      <PrevGovActionFields
        params={params}
        onChange={onChange}
        label="Previous Constitution Action"
        hint="GA NewConstitution cuối cùng đã được enacted. Để trống nếu đây là lần đầu."
      />
    </>
  )
}

// ─── Validation per type ─────────────────────────────────────────────────────

function validateTypeParams(gaType: string, params: TypeParams): string | null {
  if (gaType === "hardForkInitiation") {
    const major = parseInt(params.protocolVersionMajor)
    if (!params.protocolVersionMajor || isNaN(major) || major < 0)
      return "Vui lòng nhập target protocol version (Major)."
  }
  if (gaType === "newConstitution") {
    if (!params.constitutionAnchorUrl.trim())
      return "Vui lòng nhập Constitution URL."
    if (!params.constitutionAnchorHash.trim() || params.constitutionAnchorHash.length !== 64)
      return "Constitution Hash phải là 64 hex chars (blake2b-256)."
  }
  return null
}

// ─── Resolve type-specific submitTx params ───────────────────────────────────

function buildTypeParams(gaType: string, params: TypeParams): Partial<BuildTxRequest> {
  const prevGovActionTxHash = params.prevGovActionTxHash.trim() || undefined
  const prevGovActionIdx = params.prevGovActionIdx.trim()
    ? parseInt(params.prevGovActionIdx)
    : undefined

  switch (gaType) {
    case "noConfidence":
      return { prevGovActionTxHash, prevGovActionIdx }
    case "hardForkInitiation":
      return {
        protocolVersionMajor: parseInt(params.protocolVersionMajor),
        protocolVersionMinor: parseInt(params.protocolVersionMinor) || 0,
        prevGovActionTxHash,
        prevGovActionIdx,
      }
    case "newConstitution":
      return {
        constitutionAnchorUrl: params.constitutionAnchorUrl.trim(),
        constitutionAnchorHash: params.constitutionAnchorHash.trim(),
        constitutionScriptHash: params.constitutionScriptHash.trim() || undefined,
        prevGovActionTxHash,
        prevGovActionIdx,
      }
    default:
      return {}
  }
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function NewGovernanceActionPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; type?: string; network?: string }>
}) {
  const params = use(searchParams)
  const sourcePollId = params.source ?? ""
  const gaType = params.type ?? "infoAction"
  const network = params.network ?? "preprod"
  const networkParam = network !== "mainnet" ? `?network=${network}` : ""
  const gaInfo = GA_TYPES[gaType] ?? GA_TYPES["infoAction"]!

  const router = useRouter()
  const { isConnected, reauthenticate } = useWallet()
  const drepKey = useWalletStore((s) => s.drepKey)
  const drepId = drepKey?.dRepIDCip105 ?? null

  const { poll, isLoading: pollLoading } = usePollDetail(sourcePollId)
  const { submitTx } = useTx()

  // Common CIP-108 fields
  const [title, setTitle] = useState("")
  const [abstract, setAbstract] = useState("")
  const [motivation, setMotivation] = useState("")
  const [rationale, setRationale] = useState("")
  const [links, setLinks] = useState<string[]>([""])

  // Type-specific params
  const [typeParams, setTypeParams] = useState<TypeParams>(EMPTY_TYPE_PARAMS)
  const patchTypeParams = useCallback((patch: Partial<TypeParams>) => {
    setTypeParams((prev) => ({ ...prev, ...patch }))
  }, [])

  // Pre-fill from poll (only if sourcePollId present)
  const [prefilled, setPrefilled] = useState(false)
  if (poll && !prefilled) {
    setTitle(poll.title ?? "")
    setAbstract(poll.abstract ?? "")
    setMotivation((poll as any).motivation ?? "")
    setRationale((poll as any).rationale ?? "")
    const pl: string[] = (poll as any).supportLinks ?? []
    if (pl.length > 0) setLinks(pl)
    setPrefilled(true)
  }

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [statusLabel, setStatusLabel] = useState("")
  const [alert, setAlert] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const anchorCache = useRef<{ anchorUrl: string; anchorDataHash: string } | null>(null)

  const validLinks = links.filter((l) => l.trim().startsWith("http"))

  const isTypeSupported = gaInfo.txType !== null

  const handleSubmit = useCallback(async () => {
    if (!drepId || !title.trim() || !abstract.trim()) return

    if (!isTypeSupported) {
      setAlert({
        type: "error",
        title: `${gaInfo.label} — Coming Soon`,
        message: `Loại "${gaInfo.label}" yêu cầu tham số on-chain bổ sung. Tính năng này sẽ được hỗ trợ trong phiên bản tiếp theo.`,
      })
      return
    }

    const typeError = validateTypeParams(gaType, typeParams)
    if (typeError) {
      setAlert({ type: "error", title: "Thiếu thông tin", message: typeError })
      return
    }

    setSubmitting(true)

    try {
      // Step 1: Upload CIP-108 metadata (proposal anchor) to IPFS
      if (!anchorCache.current) {
        setStatusLabel("Đang upload CIP-108 metadata lên IPFS...")

        let jwt = getJwt()
        if (!jwt) jwt = await reauthenticate()
        if (!jwt) throw new Error("Xác thực thất bại")

        const metaBody = JSON.stringify({
          drepId,
          title: title.trim(),
          abstract: abstract.trim(),
          motivation: motivation.trim() || undefined,
          rationale: rationale.trim() || undefined,
          supportLinks: validLinks,
        })

        let res = await fetch(`${API_URL}/metadata/upload-proposal`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader(jwt) },
          body: metaBody,
        })

        if (res.status === 401) {
          const newJwt = await reauthenticate()
          if (!newJwt) throw new Error("Xác thực thất bại")
          res = await fetch(`${API_URL}/metadata/upload-proposal`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader(newJwt) },
            body: metaBody,
          })
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Upload thất bại" }))
          throw new Error(err.error ?? "Upload metadata thất bại")
        }

        const { anchorUrl, anchorDataHash } = await res.json()
        anchorCache.current = { anchorUrl, anchorDataHash }
      }

      // Step 2: Build + Sign + Submit TX
      setStatusLabel("Vui lòng ký transaction trong ví...")
      const hash = await submitTx(gaInfo.txType!, {
        anchorUrl: anchorCache.current!.anchorUrl,
        anchorDataHash: anchorCache.current!.anchorDataHash,
        ...buildTypeParams(gaType, typeParams),
      })

      setTxHash(hash)
      setAlert({
        type: "success",
        title: "Governance Action đã được submit!",
        message: "Transaction đang được xử lý trên blockchain.",
      })
    } catch (e: any) {
      setAlert({
        type: "error",
        title: "Submit thất bại",
        message: e.message ?? "Có lỗi xảy ra, vui lòng thử lại.",
      })
    } finally {
      setSubmitting(false)
    }
  }, [drepId, gaInfo, gaType, typeParams, title, abstract, motivation, rationale, validLinks, isTypeSupported, reauthenticate, submitTx])

  // ─── Guards ───────────────────────────────────────────────────────────────

  if (sourcePollId && pollLoading) {
    return (
      <main className="page-container py-10 max-w-2xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-bg-elevated rounded w-1/2" />
        <div className="h-64 bg-bg-elevated rounded" />
      </main>
    )
  }

  if (!isConnected || !drepId) {
    return (
      <main className="page-container py-12 max-w-2xl mx-auto">
        <div className="notice-warning rounded-xl p-6 text-center space-y-2">
          <p className="font-semibold">{!isConnected ? "Vui lòng kết nối ví" : "Chỉ dành cho DRep"}</p>
          <p className="text-sm text-text-secondary">
            {!isConnected ? "Bạn cần kết nối ví Cardano." : "Ví của bạn chưa được đăng ký làm DRep."}
          </p>
        </div>
      </main>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const canSubmit =
    !submitting &&
    title.trim().length > 0 &&
    abstract.trim().length > 0 &&
    isTypeSupported

  return (
    <main className="page-container py-10 max-w-2xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
          <Link href={`/governance-actions${networkParam}`} className="hover:text-accent-light transition-colors">
            Governance Actions
          </Link>
          <span>/</span>
          <span>Propose</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Propose Governance Action</h1>
        {poll && (
          <p className="text-sm text-text-secondary mt-1">
            Từ Internal Poll: <span className="text-accent font-medium">"{poll.title}"</span>
          </p>
        )}
      </div>

      {/* GA type badge */}
      <div className="flex items-center gap-3 p-4 bg-bg-elevated rounded-xl border border-border-subtle">
        <div className="flex-1">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-0.5">Loại Governance Action</p>
          <p className="font-semibold text-text-primary">{gaInfo.label}</p>
          <p className="text-xs text-text-muted mt-0.5">{gaInfo.desc}</p>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-xs text-accent-light hover:underline shrink-0"
        >
          Đổi loại
        </button>
      </div>

      {/* Coming soon notice for unsupported types */}
      {!isTypeSupported && (
        <div className="notice-warning rounded-xl p-4 text-sm">
          <span className="font-semibold">{gaInfo.label}</span> — Loại này chưa được hỗ trợ submit on-chain.
          Tính năng sẽ có trong phiên bản tiếp theo.
        </div>
      )}

      {/* Deposit warning */}
      {isTypeSupported && (
        <div className="notice-warning rounded-xl p-4 text-sm">
          <span className="font-semibold">Deposit: </span>
          Ví sẽ bị khóa <span className="font-bold">100,000 ADA</span> khi submit.
          Số ADA này được hoàn trả về reward address sau khi action hết hiệu lực.
        </div>
      )}

      {/* Form */}
      <div className="card-static rounded-2xl overflow-hidden">
        <div className="p-5 sm:p-6 space-y-5">

          <SectionDivider label="Content" />

          {/* Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={LABEL}>Title <span className="text-danger font-normal normal-case">*</span></label>
              <span className={`text-xs tabular-nums ${title.length >= 70 ? "text-warning" : "text-text-muted"}`}>
                {title.length}/80
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              required
              placeholder="Tiêu đề Governance Action..."
              className={INPUT}
            />
          </div>

          {/* Abstract */}
          <div className="space-y-1.5">
            <label className={LABEL}>Abstract <span className="text-danger font-normal normal-case">*</span></label>
            <RationaleEditor
              label="" description="" placeholder="Tóm tắt nội dung đề xuất..."
              maxLength={2500} height={150}
              value={abstract} onChange={setAbstract}
            />
          </div>

          {/* Motivation */}
          <div className="space-y-1.5">
            <label className={LABEL}>
              Motivation <span className="ml-1.5 text-[10px] text-text-muted font-normal normal-case bg-bg-elevated px-1.5 py-0.5 rounded">Optional</span>
            </label>
            <RationaleEditor
              label="" description="" placeholder="Vấn đề nào đề xuất này giải quyết?"
              maxLength={2500} height={150}
              value={motivation} onChange={setMotivation}
            />
          </div>

          {/* Rationale */}
          <div className="space-y-1.5">
            <label className={LABEL}>
              Rationale <span className="ml-1.5 text-[10px] text-text-muted font-normal normal-case bg-bg-elevated px-1.5 py-0.5 rounded">Optional</span>
            </label>
            <RationaleEditor
              label="" description="" placeholder="Lập luận và bằng chứng cho đề xuất..."
              maxLength={2500} height={150}
              value={rationale} onChange={setRationale}
            />
          </div>

          {/* Type-specific fields */}
          {gaType !== "infoAction" && isTypeSupported && (
            <>
              <SectionDivider label="On-chain Parameters" />
              <div className="space-y-5">
                {gaType === "noConfidence" && (
                  <NoConfidenceFields params={typeParams} onChange={patchTypeParams} />
                )}
                {gaType === "hardForkInitiation" && (
                  <HardForkFields params={typeParams} onChange={patchTypeParams} />
                )}
                {gaType === "newConstitution" && (
                  <NewConstitutionFields params={typeParams} onChange={patchTypeParams} />
                )}
              </div>
            </>
          )}

          <SectionDivider label="References" />

          {/* Support links */}
          <div className="space-y-2">
            <label className={LABEL}>
              Support links <span className="ml-1.5 text-[10px] text-text-muted font-normal normal-case bg-bg-elevated px-1.5 py-0.5 rounded">Optional</span>
            </label>
            <div className="space-y-2">
              {links.map((link, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="flex-1 flex items-center gap-2 bg-bg-elevated border border-border-subtle rounded-xl px-3 focus-within:border-accent/50 transition-colors">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-muted shrink-0">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                    </svg>
                    <input
                      type="url"
                      value={link}
                      onChange={(e) => { const n = [...links]; n[i] = e.target.value; setLinks(n) }}
                      placeholder="https://website.com/"
                      className="flex-1 bg-transparent py-3 text-sm text-text-primary placeholder-text-muted outline-none"
                    />
                  </div>
                  {links.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLinks(links.filter((_, idx) => idx !== i))}
                      className="w-9 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLinks([...links, ""])}
              className="flex items-center gap-1.5 text-sm text-accent-light font-medium hover:underline"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Link
            </button>
          </div>

          {/* Metadata standard note */}
          <div className="text-xs text-text-muted bg-bg-elevated rounded-lg px-3 py-2 border border-border-subtle">
            Metadata sẽ được build theo chuẩn <span className="font-mono text-text-secondary">CIP-108</span> và upload lên IPFS trước khi submit transaction.
            Hash <span className="font-mono text-text-secondary">blake2b-256</span> sẽ được gắn vào TX để đảm bảo tính toàn vẹn.
          </div>
        </div>

        {/* Footer actions */}
        <div className="border-t border-border-subtle px-5 sm:px-6 py-4 flex items-center justify-between gap-3 bg-bg-elevated/50">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={submitting}
            className="px-4 py-2.5 rounded-xl text-sm border border-border-default text-text-secondary hover:border-accent/40 transition-colors disabled:opacity-40"
          >
            Hủy
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="btn-primary px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {statusLabel || "Đang xử lý..."}
              </>
            ) : (
              "Submit Governance Action"
            )}
          </button>
        </div>
      </div>

      {/* AlertModal */}
      {alert && (
        <AlertModal
          type={alert.type}
          title={alert.title}
          message={alert.message}
          onClose={() => {
            setAlert(null)
            if (alert.type === "success" && txHash) {
              router.push(`/governance-actions${networkParam}`)
            }
          }}
        >
          {alert.type === "success" && txHash && (
            <div className="w-full bg-bg-elevated rounded-xl px-3 py-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <p className="font-mono text-[11px] text-text-secondary break-all flex-1 leading-relaxed">
                  {txHash}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(txHash)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 2000)
                  }}
                  title="Copy TX Hash"
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-accent-light hover:bg-accent/10 transition-colors"
                >
                  {copied ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  )}
                </button>
              </div>
              <a
                href={explorerTxUrl(txHash, network)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent-light hover:underline"
              >
                Xem trên Cardanoscan
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            </div>
          )}
        </AlertModal>
      )}
    </main>
  )
}
