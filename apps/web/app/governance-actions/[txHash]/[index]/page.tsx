"use client"

import { useState, useEffect, use } from "react"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useTx } from "@/hooks/useTx"
import { useMyVote, type MyVote } from "@/hooks/useMyVote"
import { GovernanceActionSchema, type GovernanceAction, type VoteCounts } from "@tempo/types"
import {
  computeVotePercent,
  resolveAnchorUrl,
  VOTE_THRESHOLDS,
} from "@/lib/governance"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

type VoteStep = "idle" | "confirm" | "signing" | "success" | "error"
type VoteChoice = "YES" | "NO" | "ABSTAIN"

// ── Anchor title fetch ────────────────────────────────────────────────────────
function useAnchorTitle(anchorUrl: string | null) {
  const [title, setTitle] = useState<string | null>(null)
  useEffect(() => {
    const url = resolveAnchorUrl(anchorUrl)
    if (!url) return
    let cancelled = false
    fetch(url)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (cancelled || !data || typeof data !== "object") return
        const d = data as Record<string, unknown>
        const body = d.body as Record<string, unknown> | undefined
        const t = (body?.title ?? d.title) as string | undefined
        setTitle(t ?? null)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [anchorUrl])
  return title
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function shortHash(hash: string) {
  return `${hash.slice(0, 10)}…${hash.slice(-10)}`
}

function cardanoscanUrl(txHash: string, network: string) {
  const base = network === "mainnet"
    ? "https://cardanoscan.io"
    : "https://preprod.cardanoscan.io"
  return `${base}/transaction/${txHash}`
}

// ── Sub-components ────────────────────────────────────────────────────────────
function VoteBar({ label, votes, threshold }: { label: string; votes: VoteCounts; threshold?: number }) {
  const { yesPercent, noPercent, abstainPercent } = computeVotePercent(votes)
  const total = votes.yes + votes.no + votes.abstain
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-text-secondary">{label}</span>
        {threshold && (
          <span className="text-xs text-text-muted flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 10 10" className="text-warning">
              <polygon points="5,0 10,10 0,10" fill="currentColor" />
            </svg>
            Ngưỡng {threshold}%
          </span>
        )}
      </div>
      <div className="vote-bar h-3">
        <div className="vote-bar-yes" style={{ width: `${yesPercent}%` }} />
        <div className="vote-bar-no" style={{ width: `${noPercent}%` }} />
      </div>
      <div className="flex justify-between text-xs text-text-muted">
        <span className="text-success font-medium">{votes.yes} Yes ({yesPercent}%)</span>
        <span>{votes.abstain} Abstain ({abstainPercent}%)</span>
        <span className="text-danger font-medium">{votes.no} No ({noPercent}%)</span>
      </div>
      <p className="text-xs text-text-muted">{total} tổng phiếu</p>
    </div>
  )
}

// ── Vote section ──────────────────────────────────────────────────────────────
function VoteSection({ action, network }: { action: GovernanceAction; network: string }) {
  const { isConnected, isDrepRegistered, drepKey, selectedNetwork } = useWalletStore()
  const { submitTx, isReady } = useTx()

  const drepId = isDrepRegistered ? drepKey?.dRepIDCip105 : undefined
  const myVote = useMyVote(action.txHash, action.index, drepId, selectedNetwork)

  const [step, setStep] = useState<VoteStep>("idle")
  const [choice, setChoice] = useState<VoteChoice | null>(null)
  const [successTxHash, setSuccessTxHash] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isConnected) {
    return (
      <div className="card-static text-center py-8 space-y-2 text-text-muted">
        <p className="font-medium">Kết nối ví để bỏ phiếu</p>
        <p className="text-sm">Cần kết nối ví hỗ trợ CIP-95 (DRep key).</p>
      </div>
    )
  }

  if (!isDrepRegistered) {
    return (
      <div className="card-static text-center py-8 space-y-2 text-text-muted">
        <p className="font-medium">Chỉ DRep đã đăng ký mới được bỏ phiếu</p>
        <Link href="/dreps/register" className="text-sm text-accent-light underline">
          Đăng ký DRep ngay
        </Link>
      </div>
    )
  }

  async function handleVote() {
    if (!choice || !drepKey) return
    setStep("signing")
    setErrorMsg(null)
    try {
      const txHash = await submitTx("VOTE", {
        drepId: drepKey.dRepIDCip105,
        govActionTxHash: action.txHash,
        govActionIndex: action.index,
        voteKind: choice,
      })
      setSuccessTxHash(txHash)
      setStep("success")
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Lỗi không xác định")
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
            <p className="font-semibold">Đã bỏ phiếu thành công!</p>
            <p className="text-sm text-text-muted">
              Phiếu <span className={`font-bold ${choice === "YES" ? "text-success" : choice === "NO" ? "text-danger" : "text-text-secondary"}`}>{choice}</span> đã được ghi nhận on-chain.
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
          Xem trên CardanoScan
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
        <h3 className="font-semibold text-base">Xác nhận bỏ phiếu</h3>
        <div className="bg-bg-secondary rounded-xl p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-text-muted">Governance Action</span>
            <span className="font-mono text-xs">{shortHash(action.txHash)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Loại</span>
            <span>{action.type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-muted">Lựa chọn</span>
            <span className={`font-bold text-base ${
              choice === "YES" ? "text-success" : choice === "NO" ? "text-danger" : "text-text-secondary"
            }`}>
              {choice}
            </span>
          </div>
          <div className="flex justify-between border-t border-border-subtle pt-3">
            <span className="text-text-muted">Phí mạng</span>
            <span className="text-text-primary">~0.2 ADA</span>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setStep("idle")}
            className="btn-outline flex-1 text-sm"
          >
            Huỷ
          </button>
          <button
            onClick={handleVote}
            disabled={!isReady}
            className="btn-primary flex-1 text-sm"
          >
            Xác nhận &amp; Ký
          </button>
        </div>
      </div>
    )
  }

  // Signing state
  if (step === "signing") {
    return (
      <div className="card-static flex items-center justify-center gap-3 py-8">
        <svg className="animate-spin w-5 h-5 text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <span className="text-text-secondary">Đang ký giao dịch trong ví…</span>
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
            <p className="font-semibold">Bỏ phiếu thất bại</p>
            <p className="text-sm text-text-muted mt-1">{errorMsg}</p>
          </div>
        </div>
        <button onClick={() => setStep("idle")} className="btn-outline w-full text-sm">
          Thử lại
        </button>
      </div>
    )
  }

  // Idle state — choose YES / NO / ABSTAIN
  const CHOICES: { value: VoteChoice; label: string; cls: string; activeCls: string }[] = [
    { value: "YES",     label: "YES",     cls: "border-success/50 text-success hover:bg-success/10",           activeCls: "border-success bg-success/20 text-success" },
    { value: "NO",      label: "NO",      cls: "border-danger/50 text-danger hover:bg-danger/10",              activeCls: "border-danger bg-danger/20 text-danger" },
    { value: "ABSTAIN", label: "ABSTAIN", cls: "border-border-default text-text-secondary hover:bg-white/5",   activeCls: "border-border-default bg-bg-elevated text-text-primary" },
  ]

  return (
    <div className="card-static space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">
          {myVote ? "Phiếu của bạn" : "Bỏ phiếu của bạn"}
        </h3>
        {myVote && (
          <MyVoteBadge vote={myVote} />
        )}
      </div>

      {myVote && (
        <p className="text-xs text-text-muted">
          Bạn có thể đổi phiếu bằng cách chọn lựa chọn khác bên dưới.
        </p>
      )}

      <div className="grid grid-cols-3 gap-3">
        {CHOICES.map(({ value, label, cls, activeCls }) => {
          const isCurrentVote = myVote === value
          return (
            <button
              key={value}
              onClick={() => { setChoice(value); setStep("confirm") }}
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
        Ví sẽ yêu cầu ký giao dịch sau khi bạn xác nhận.
      </p>
    </div>
  )
}

function MyVoteBadge({ vote }: { vote: MyVote }) {
  if (!vote) return null
  const cfg = {
    YES:     { cls: "bg-success/15 text-success border-success/30",  label: "✓ YES" },
    NO:      { cls: "bg-danger/15 text-danger border-danger/30",     label: "✓ NO" },
    ABSTAIN: { cls: "bg-bg-elevated text-text-secondary border-border-default", label: "✓ ABSTAIN" },
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
  const { txHash, index } = use(params)
  const network = useWalletStore((s) => s.selectedNetwork)

  const [action, setAction] = useState<GovernanceAction | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const anchorTitle = useAnchorTitle(action?.anchorUrl ?? null)

  useEffect(() => {
    setLoading(true)
    setFetchError(null)
    fetch(`${API_URL}/governance-actions/${txHash}/${index}?network=${network}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => {
        const parsed = GovernanceActionSchema.safeParse(data)
        if (parsed.success) setAction(parsed.data)
        else setFetchError("Dữ liệu không hợp lệ từ server")
      })
      .catch((err: unknown) => {
        setFetchError(err instanceof Error ? err.message : "Không thể tải governance action")
      })
      .finally(() => setLoading(false))
  }, [txHash, index, network])

  const thresholds = action ? VOTE_THRESHOLDS[action.actionType] : undefined
  const heading = anchorTitle ?? action?.type ?? "Governance Action"

  return (
    <div className="page-container space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted animate-fade-in">
        <Link href="/governance-actions" className="hover:text-text-primary transition-colors">
          Governance Actions
        </Link>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <span className="text-text-primary truncate max-w-[200px]">{heading}</span>
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
          <p className="font-medium">Không tìm thấy governance action</p>
          <p className="text-xs text-text-muted">{fetchError}</p>
          <Link href="/governance-actions" className="text-sm text-accent-light underline block mt-2">
            ← Quay lại danh sách
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
                <span className="badge badge-active shrink-0">Active</span>
                <span className="text-xs text-text-muted bg-bg-elevated px-2 py-0.5 rounded-full shrink-0">
                  {action.type}
                </span>
              </div>
              <h1 className="text-xl font-bold leading-snug">{heading}</h1>
              <p className="text-xs text-text-muted font-mono">
                {action.txHash}#{action.index}
              </p>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-text-muted text-xs mb-0.5">Hết hạn</p>
                <p className="font-medium">Epoch {action.expiresEpoch}</p>
              </div>
              <div>
                <p className="text-text-muted text-xs mb-0.5">Deposit</p>
                <p className="font-medium">
                  {(action.deposit / 1_000_000).toLocaleString()} ADA
                </p>
              </div>
              {action.anchorUrl && (
                <div>
                  <p className="text-text-muted text-xs mb-0.5">Anchor</p>
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
              <div className="bg-bg-secondary rounded-lg px-3 py-2 text-xs text-text-muted font-mono break-all">
                <span className="text-text-muted/60 mr-2">hash:</span>{action.anchorHash}
              </div>
            )}
          </div>

          {/* Vote results card */}
          <div className="card-static space-y-6 animate-fade-in">
            <h2 className="font-semibold text-base">Kết quả bỏ phiếu</h2>
            <VoteBar
              label="DRep"
              votes={action.drepVotes}
              threshold={thresholds?.drep ? Math.round(thresholds.drep * 100) : undefined}
            />
            <VoteBar
              label="SPO"
              votes={action.spoVotes}
              threshold={thresholds?.spo ? Math.round(thresholds.spo * 100) : undefined}
            />
            <VoteBar
              label="Constitutional Committee"
              votes={action.ccVotes}
              threshold={thresholds?.cc ? Math.round(thresholds.cc * 100) : undefined}
            />
          </div>

          {/* Vote action */}
          <div className="animate-slide-up">
            <VoteSection action={action} network={network} />
          </div>
        </>
      )}
    </div>
  )
}
