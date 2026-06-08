"use client"

import { use, useState, useRef, useCallback, useEffect } from "react"
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
  treasuryWithdrawals:      { label: "Treasury Withdrawals",      desc: "Rút ADA từ quỹ Cardano treasury",                   txType: "PROPOSE_TREASURY_WITHDRAWAL" },
  updateCommittee:          { label: "Update Committee",          desc: "Thêm/xóa thành viên Constitutional Committee",      txType: "PROPOSE_UPDATE_COMMITTEE" },
  protocolParametersUpdate: { label: "Protocol Parameter Change", desc: "Thay đổi thông số giao thức Cardano on-chain",      txType: "PROPOSE_PROTOCOL_PARAM_CHANGE" },
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
  quorumNumerator: string
  quorumDenominator: string
  // Protocol Parameter Change — only filled fields are included in the on-chain update
  ppMinFeeA: string
  ppMinFeeB: string
  ppMaxTxSize: string
  ppMaxBlockSize: string
  ppMaxBlockHeaderSize: string
  ppKeyDeposit: string
  ppPoolDeposit: string
  ppNOpt: string
  ppMaxEpoch: string
  ppMinPoolCost: string
  ppPoolPledgeInfluence: string   // decimal e.g. "0.3"
  ppAdaPerUtxoByte: string
  ppExpansionRate: string         // decimal e.g. "0.003"
  ppTreasuryGrowthRate: string    // decimal e.g. "0.2"
  ppMaxValSize: string
  ppCollateralPercent: string
  ppMaxCollateralInputs: string
}

const EMPTY_TYPE_PARAMS: TypeParams = {
  prevGovActionTxHash: "",
  prevGovActionIdx: "",
  protocolVersionMajor: "",
  protocolVersionMinor: "0",
  constitutionAnchorUrl: "",
  constitutionAnchorHash: "",
  constitutionScriptHash: "",
  quorumNumerator: "",
  quorumDenominator: "",
  ppMinFeeA: "",
  ppMinFeeB: "",
  ppMaxTxSize: "",
  ppMaxBlockSize: "",
  ppMaxBlockHeaderSize: "",
  ppKeyDeposit: "",
  ppPoolDeposit: "",
  ppNOpt: "",
  ppMaxEpoch: "",
  ppMinPoolCost: "",
  ppPoolPledgeInfluence: "",
  ppAdaPerUtxoByte: "",
  ppExpansionRate: "",
  ppTreasuryGrowthRate: "",
  ppMaxValSize: "",
  ppCollateralPercent: "",
  ppMaxCollateralInputs: "",
}

// ─── Row types for dynamic lists ─────────────────────────────────────────────

type WithdrawalRow = { stakeAddress: string; adaAmount: string }
const EMPTY_WITHDRAWAL_ROW: WithdrawalRow = { stakeAddress: "", adaAmount: "" }

type CommitteeAddRow = { credential: string; termEpoch: string }
const EMPTY_COMMITTEE_ADD_ROW: CommitteeAddRow = { credential: "", termEpoch: "" }

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

// ─── Treasury Withdrawal UI ───────────────────────────────────────────────────

function TreasuryWithdrawalFields({
  rows,
  onChange,
  network,
}: {
  rows: WithdrawalRow[]
  onChange: (rows: WithdrawalRow[]) => void
  network: string
}) {
  const totalAda = rows.reduce((sum, r) => sum + (parseFloat(r.adaAmount) || 0), 0)
  const stakeHint = network === "mainnet" ? "stake1..." : "stake_test1..."

  const patchRow = (i: number, patch: Partial<WithdrawalRow>) => {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <>
      <div className="p-3 bg-warning/8 border border-warning/20 rounded-xl text-xs text-text-secondary space-y-1">
        <p className="font-semibold text-warning">Treasury Withdrawals — Lưu ý</p>
        <p>Yêu cầu DRep threshold <strong>67%</strong> + CC threshold <strong>60%</strong> để được ratified.</p>
        <p>ADA được rút trực tiếp từ Cardano treasury vào reward address của recipient.</p>
      </div>

      <div className="space-y-1.5">
        <label className={LABEL}>Recipients <span className="text-danger font-normal normal-case">*</span></label>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                value={row.stakeAddress}
                onChange={(e) => patchRow(i, { stakeAddress: e.target.value })}
                placeholder={`Stake address (${stakeHint})`}
                className={INPUT_SM + " flex-1 min-w-0 font-mono text-xs"}
              />
              <div className="relative shrink-0 w-44">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={row.adaAmount}
                  onChange={(e) => patchRow(i, { adaAmount: e.target.value })}
                  placeholder="0"
                  className={INPUT_SM + " w-full text-right pr-9 tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-muted pointer-events-none select-none">₳</span>
              </div>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
                  className="w-8 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onChange([...rows, { ...EMPTY_WITHDRAWAL_ROW }])}
          className="flex items-center gap-1.5 text-sm text-accent-light font-medium hover:underline mt-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Recipient
        </button>
      </div>

      {totalAda > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-bg-elevated rounded-xl border border-border-subtle">
          <span className="text-xs text-text-muted uppercase tracking-wider">Total Withdrawal</span>
          <span className="font-bold text-text-primary tabular-nums">
            {totalAda.toLocaleString("en-US", { maximumFractionDigits: 6 })} <span className="text-text-muted font-normal">₳</span>
          </span>
        </div>
      )}
    </>
  )
}

// ─── Update Committee UI ──────────────────────────────────────────────────────

function UpdateCommitteeFields({
  params,
  onParamChange,
  removeRows,
  onRemoveChange,
  addRows,
  onAddChange,
}: {
  params: TypeParams
  onParamChange: (patch: Partial<TypeParams>) => void
  removeRows: string[]
  onRemoveChange: (rows: string[]) => void
  addRows: CommitteeAddRow[]
  onAddChange: (rows: CommitteeAddRow[]) => void
}) {
  const num = parseInt(params.quorumNumerator)
  const den = parseInt(params.quorumDenominator)
  const quorumPct = num > 0 && den > 0 ? ((num / den) * 100).toFixed(1) : null

  const patchAddRow = (i: number, patch: Partial<CommitteeAddRow>) => {
    onAddChange(addRows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <>
      <div className="p-3 bg-warning/8 border border-warning/20 rounded-xl text-xs text-text-secondary space-y-1">
        <p className="font-semibold text-warning">Update Committee — Lưu ý</p>
        <p>Yêu cầu DRep 60% + SPO 51% để ratified (hoặc CC 51% nếu chỉ thay quorum).</p>
        <p>Cold credential: bech32 <span className="font-mono">cc_cold1...</span> (mainnet) / <span className="font-mono">cc_cold_test1...</span> (testnet).</p>
      </div>

      {/* Remove Members */}
      <div className="space-y-1.5">
        <label className={LABEL}>
          Members to Remove
          <span className="ml-1.5 text-[10px] text-text-muted font-normal normal-case bg-bg-elevated px-1.5 py-0.5 rounded">Optional</span>
        </label>
        <p className="text-xs text-text-muted">Cold credentials của CC members cần xóa khỏi committee.</p>
        <div className="space-y-2">
          {removeRows.map((cred, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={cred}
                onChange={(e) => {
                  const next = [...removeRows]
                  next[i] = e.target.value
                  onRemoveChange(next)
                }}
                placeholder="cc_cold1... hoặc cc_cold_test1..."
                className={INPUT_SM + " flex-1 font-mono text-xs"}
              />
              {removeRows.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveChange(removeRows.filter((_, idx) => idx !== i))}
                  className="w-8 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onRemoveChange([...removeRows, ""])}
          className="flex items-center gap-1.5 text-sm text-accent-light font-medium hover:underline mt-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Credential
        </button>
      </div>

      {/* Add Members */}
      <div className="space-y-1.5">
        <label className={LABEL}>
          Members to Add
          <span className="ml-1.5 text-[10px] text-text-muted font-normal normal-case bg-bg-elevated px-1.5 py-0.5 rounded">Optional</span>
        </label>
        <p className="text-xs text-text-muted">Cold credential và epoch (cuối nhiệm kỳ) của CC members mới.</p>
        <div className="space-y-2">
          {addRows.map((row, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                type="text"
                value={row.credential}
                onChange={(e) => patchAddRow(i, { credential: e.target.value })}
                placeholder="cc_cold1..."
                className={INPUT_SM + " flex-1 font-mono text-xs"}
              />
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  min={0}
                  value={row.termEpoch}
                  onChange={(e) => patchAddRow(i, { termEpoch: e.target.value })}
                  placeholder="Epoch"
                  className={INPUT_SM + " w-24 text-center tabular-nums"}
                />
              </div>
              {addRows.length > 1 && (
                <button
                  type="button"
                  onClick={() => onAddChange(addRows.filter((_, idx) => idx !== i))}
                  className="w-8 h-9 flex items-center justify-center rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onAddChange([...addRows, { ...EMPTY_COMMITTEE_ADD_ROW }])}
          className="flex items-center gap-1.5 text-sm text-accent-light font-medium hover:underline mt-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Member
        </button>
      </div>

      {/* Quorum Threshold */}
      <div className="space-y-1.5">
        <label className={LABEL}>Quorum Threshold <span className="text-danger font-normal normal-case">*</span></label>
        <p className="text-xs text-text-muted">Tỷ lệ tối thiểu CC members phải đồng ý để vote passed (e.g. 2/3 = 66.7%).</p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            value={params.quorumNumerator}
            onChange={(e) => onParamChange({ quorumNumerator: e.target.value })}
            placeholder="2"
            className={INPUT_SM + " w-24 text-center tabular-nums"}
          />
          <span className="text-text-muted text-lg">/</span>
          <input
            type="number"
            min={1}
            value={params.quorumDenominator}
            onChange={(e) => onParamChange({ quorumDenominator: e.target.value })}
            placeholder="3"
            className={INPUT_SM + " w-24 text-center tabular-nums"}
          />
          {quorumPct && (
            <span className="text-sm font-semibold text-accent-light tabular-nums">= {quorumPct}%</span>
          )}
        </div>
      </div>

      <PrevGovActionFields
        params={params}
        onChange={onParamChange}
        label="Previous Committee Action"
        hint="GA UpdateCommittee hoặc NoConfidence cuối cùng đã được enacted. Để trống nếu đây là lần đầu."
      />
    </>
  )
}

// ─── Protocol Parameter Change — chain-info hook ─────────────────────────────

type ChainProtocolParams = {
  minFeeA?: number; minFeeB?: number
  maxTxSize?: number; maxBlockSize?: number; maxBlockHeaderSize?: number
  maxValSize?: number; maxCollateralInputs?: number
  keyDeposit?: number; poolDeposit?: number
  expansionRate?: number; treasuryGrowthRate?: number
  minPoolCost?: number; adaPerUtxoByte?: number; collateralPercent?: number
  nOpt?: number; maxEpoch?: number; poolPledgeInfluence?: number
}

type ChainInfo = { guardrailsHash?: string; protocolParams: ChainProtocolParams }

function useChainInfo(network: string, enabled: boolean) {
  const [data, setData] = useState<ChainInfo | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return
    setLoading(true)
    fetch(`${API_URL}/governance/chain-info?network=${network}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [network, enabled])

  return { data, loading }
}

// ─── Protocol Parameter Change — display helpers ──────────────────────────────

function fmtLovelace(v?: number) {
  if (v === undefined || v === null) return null
  const ada = v / 1_000_000
  return `${v.toLocaleString()} (${ada % 1 === 0 ? ada.toFixed(0) : ada.toFixed(2)} ₳)`
}

function fmtInt(v?: number)  { return v !== undefined && v !== null ? v.toLocaleString() : null }
function fmtRate(v?: number) { return v !== undefined && v !== null ? v.toPrecision(4).replace(/\.?0+$/, "") : null }

// ─── Protocol Parameter Change — 4 CIP-1694 parameter groups ─────────────────

type PpParamDef = {
  key: keyof TypeParams
  label: string
  unit: string
  chainKey: keyof ChainProtocolParams
  step: string
  min: number
  max?: number
  format: (v?: number) => string | null
}

type PpCIP1694Group = {
  id: string
  label: string
  threshold: string
  color: string
  params: PpParamDef[]
}

const CIP1694_GROUPS: PpCIP1694Group[] = [
  {
    id: "network",
    label: "Network Group",
    threshold: "CC + 60% DRep + 51% SPO",
    color: "text-accent-light",
    params: [
      { key: "ppMaxTxSize",         label: "Max Transaction Size",    unit: "bytes",    chainKey: "maxTxSize",         step: "1",     min: 0, format: fmtInt },
      { key: "ppMaxBlockSize",      label: "Max Block Body Size",     unit: "bytes",    chainKey: "maxBlockSize",      step: "1",     min: 0, format: fmtInt },
      { key: "ppMaxBlockHeaderSize",label: "Max Block Header Size",   unit: "bytes",    chainKey: "maxBlockHeaderSize",step: "1",     min: 0, format: fmtInt },
      { key: "ppMaxValSize",        label: "Max Value Size",          unit: "bytes",    chainKey: "maxValSize",        step: "1",     min: 0, format: fmtInt },
      { key: "ppMaxCollateralInputs",label:"Max Collateral Inputs",   unit: "inputs",   chainKey: "maxCollateralInputs",step:"1",     min: 0, format: fmtInt },
    ],
  },
  {
    id: "economic",
    label: "Economic Group",
    threshold: "CC + 67% DRep",
    color: "text-success",
    params: [
      { key: "ppMinFeeA",           label: "Min Fee Coefficient (A)", unit: "lov/byte", chainKey: "minFeeA",          step: "1",     min: 0, format: fmtInt },
      { key: "ppMinFeeB",           label: "Min Fee Constant (B)",    unit: "lovelace", chainKey: "minFeeB",          step: "1",     min: 0, format: fmtLovelace },
      { key: "ppKeyDeposit",        label: "Stake Key Deposit",       unit: "lovelace", chainKey: "keyDeposit",       step: "1",     min: 0, format: fmtLovelace },
      { key: "ppPoolDeposit",       label: "Pool Registration Deposit",unit:"lovelace", chainKey: "poolDeposit",      step: "1",     min: 0, format: fmtLovelace },
      { key: "ppExpansionRate",     label: "Monetary Expansion (ρ)",  unit: "0–1",      chainKey: "expansionRate",    step: "0.001", min: 0, max: 1, format: fmtRate },
      { key: "ppTreasuryGrowthRate",label: "Treasury Growth Rate (τ)",unit: "0–1",      chainKey: "treasuryGrowthRate",step:"0.001", min: 0, max: 1, format: fmtRate },
      { key: "ppMinPoolCost",       label: "Min Pool Cost",           unit: "lovelace", chainKey: "minPoolCost",      step: "1",     min: 0, format: fmtLovelace },
      { key: "ppAdaPerUtxoByte",    label: "ADA per UTxO Byte",       unit: "lovelace", chainKey: "adaPerUtxoByte",   step: "1",     min: 0, format: fmtInt },
      { key: "ppCollateralPercent", label: "Collateral Percentage",   unit: "%",        chainKey: "collateralPercent",step: "1",     min: 0, format: fmtInt },
    ],
  },
  {
    id: "technical",
    label: "Technical Group",
    threshold: "CC + 67% DRep",
    color: "text-warning",
    params: [
      { key: "ppNOpt",              label: "Desired Pool Count (k)",  unit: "pools",    chainKey: "nOpt",             step: "1",     min: 0, format: fmtInt },
      { key: "ppMaxEpoch",          label: "Pool Retirement Window",  unit: "epochs",   chainKey: "maxEpoch",         step: "1",     min: 0, format: fmtInt },
      { key: "ppPoolPledgeInfluence",label:"Pool Pledge Influence (a₀)",unit:"0–2",     chainKey: "poolPledgeInfluence",step:"0.001",min: 0, max: 2, format: fmtRate },
    ],
  },
]

function ProtocolParamChangeFields({
  params,
  onChange,
  network,
}: {
  params: TypeParams
  onChange: (patch: Partial<TypeParams>) => void
  network: string
}) {
  const { data: chainInfo, loading } = useChainInfo(network, true)
  const [copied, setCopied] = useState(false)

  const pp = chainInfo?.protocolParams ?? {}
  const guardrailsHash = chainInfo?.guardrailsHash

  const filledCount = CIP1694_GROUPS.flatMap((g) => g.params)
    .filter((p) => params[p.key].trim() !== "").length

  const numInput = "w-full tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"

  return (
    <>
      {/* Guardrails Hash Script */}
      <div className="space-y-1.5">
        <label className={LABEL}>Guardrails Script Hash</label>
        <p className="text-xs text-text-muted">
          Hash script guardrails của Constitution hiện tại. Được gắn tự động vào TX khi submit.
        </p>
        <div className="flex items-center gap-2 px-3 py-2.5 bg-bg-elevated border border-border-subtle rounded-xl">
          {loading ? (
            <span className="text-xs text-text-muted animate-pulse">Đang tải...</span>
          ) : guardrailsHash ? (
            <>
              <span className="font-mono text-xs text-text-secondary flex-1 truncate">{guardrailsHash}</span>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(guardrailsHash); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="shrink-0 text-text-muted hover:text-accent-light transition-colors"
                title="Copy"
              >
                {copied ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                )}
              </button>
            </>
          ) : (
            <span className="text-xs text-text-muted italic">Không có guardrails script</span>
          )}
        </div>
      </div>

      {/* Previous Governance Action Id */}
      <PrevGovActionFields
        params={params}
        onChange={onChange}
        label="Previous Protocol Parameter Change Action Id"
        hint="Governance Action Id của lần ParameterChange cuối cùng đã được enacted. Để trống nếu đây là lần đầu tiên."
      />

      {/* Intro notice */}
      <div className="p-3 bg-accent/8 border border-accent/20 rounded-xl text-xs text-text-secondary space-y-1">
        <p className="font-semibold text-accent-light">Hướng dẫn</p>
        <p>Chỉ điền các thông số muốn <strong>thay đổi</strong>. Thông số để trống sẽ không bị ảnh hưởng.</p>
        <p className="text-warning">Governance Group (govActionDeposit, dRepDeposit…) sẽ được hỗ trợ trong phiên bản tiếp theo.</p>
      </div>

      {/* Counter */}
      {filledCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-success/8 border border-success/20 rounded-xl">
          <span className="text-xs text-success font-semibold">{filledCount} thông số sẽ được thay đổi</span>
        </div>
      )}

      {/* 4 CIP-1694 groups */}
      <div className="space-y-5">
        {CIP1694_GROUPS.map((group) => (
          <div key={group.id} className="space-y-2">
            {/* Group header */}
            <div className="flex items-baseline justify-between border-b border-border-subtle pb-1">
              <span className={`text-[11px] font-bold uppercase tracking-widest ${group.color}`}>
                {group.label}
              </span>
              <span className="text-[10px] text-text-muted">{group.threshold}</span>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[1fr_28px_1fr] gap-x-2 px-0.5">
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider text-center">Existing</span>
              <span />
              <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider text-center">Proposed</span>
            </div>

            {/* Param rows */}
            <div className="space-y-2.5">
              {group.params.map((p) => {
                const existingVal = pp[p.chainKey]
                const existingFmt = p.format(existingVal as number | undefined)
                const hasProposed = params[p.key].trim() !== ""

                return (
                  <div key={p.key} className="space-y-1">
                    <div className="text-[11px] font-medium text-text-secondary leading-none">
                      {p.label}
                      <span className="ml-1.5 text-[10px] text-text-muted font-normal">({p.unit})</span>
                    </div>
                    <div className="grid grid-cols-[1fr_28px_1fr] gap-x-2 items-center">
                      {/* Existing */}
                      <div className={`px-3 py-2 rounded-xl border text-xs font-mono leading-tight ${
                        loading
                          ? "bg-bg-elevated border-border-subtle text-text-muted animate-pulse"
                          : existingFmt
                            ? "bg-bg-elevated border-border-subtle text-text-secondary"
                            : "bg-bg-elevated border-border-subtle text-text-muted italic"
                      }`}>
                        {loading ? "…" : (existingFmt ?? "–")}
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="2" strokeLinecap="round"
                          className={hasProposed ? "text-accent-light" : "text-border-default"}>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                          <polyline points="12 5 19 12 12 19"/>
                        </svg>
                      </div>

                      {/* Proposed input */}
                      <input
                        type="number"
                        min={p.min}
                        max={p.max}
                        step={p.step}
                        value={params[p.key]}
                        onChange={(e) => onChange({ [p.key]: e.target.value } as Partial<TypeParams>)}
                        placeholder={existingFmt ?? "–"}
                        className={`${INPUT_SM} ${numInput} ${hasProposed ? "border-accent/60" : ""}`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Governance Group — display-only notice */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between border-b border-border-subtle pb-1">
            <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">
              Governance Group
            </span>
            <span className="text-[10px] text-text-muted">CC + 67% DRep</span>
          </div>
          <div className="px-3 py-2.5 bg-bg-elevated border border-border-subtle rounded-xl text-xs text-text-muted space-y-1">
            <p className="font-semibold text-text-secondary">Các thông số Governance Group</p>
            <p>govActionDeposit · dRepDeposit · dRepActivity · committeeMinSize · committeeMaxTermLength · các voting thresholds</p>
            <p className="text-warning mt-1">Các thông số này (Conway keys 25+) chưa được hỗ trợ trong phiên bản hiện tại của thư viện Bloxbean. Sẽ có trong phiên bản tiếp theo.</p>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Validation per type ─────────────────────────────────────────────────────

function validateTypeParams(
  gaType: string,
  params: TypeParams,
  withdrawalRows: WithdrawalRow[],
  committeeRemoveRows: string[],
  committeeAddRows: CommitteeAddRow[],
): string | null {
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
  if (gaType === "treasuryWithdrawals") {
    const valid = withdrawalRows.filter(
      (r) => r.stakeAddress.trim().startsWith("stake") && parseFloat(r.adaAmount) > 0,
    )
    if (valid.length === 0)
      return "Cần ít nhất 1 recipient hợp lệ (stake address + ADA > 0)."
    const bad = withdrawalRows.find(
      (r) => r.stakeAddress.trim() && !r.stakeAddress.trim().startsWith("stake"),
    )
    if (bad) return `Stake address không hợp lệ: "${bad.stakeAddress}". Phải bắt đầu bằng "stake".`
  }
  if (gaType === "updateCommittee") {
    const num = parseInt(params.quorumNumerator)
    const den = parseInt(params.quorumDenominator)
    if (!params.quorumNumerator || !params.quorumDenominator || isNaN(num) || isNaN(den))
      return "Vui lòng nhập Quorum Threshold (numerator/denominator)."
    if (num <= 0 || den <= 0)
      return "Numerator và denominator phải > 0."
    if (num > den)
      return "Numerator không được lớn hơn denominator (quorum ≤ 100%)."
    const badRemove = committeeRemoveRows.find(
      (c) => c.trim() && !c.trim().startsWith("cc_cold"),
    )
    if (badRemove)
      return `Credential không hợp lệ: "${badRemove}". Phải là bech32 cc_cold1... hoặc cc_cold_test1...`
    const badAdd = committeeAddRows.find(
      (r) => r.credential.trim() && !r.credential.trim().startsWith("cc_cold"),
    )
    if (badAdd)
      return `Credential không hợp lệ: "${badAdd.credential}". Phải là bech32 cc_cold1...`
    const badEpoch = committeeAddRows.find(
      (r) => r.credential.trim() && (!r.termEpoch || parseInt(r.termEpoch) <= 0),
    )
    if (badEpoch)
      return `Vui lòng nhập term epoch cho credential "${badEpoch.credential}".`
  }
  if (gaType === "protocolParametersUpdate") {
    const allPpKeys: Array<keyof TypeParams> = [
      "ppMinFeeA", "ppMinFeeB", "ppMaxTxSize", "ppMaxBlockSize", "ppMaxBlockHeaderSize",
      "ppKeyDeposit", "ppPoolDeposit", "ppNOpt", "ppMaxEpoch", "ppMinPoolCost",
      "ppPoolPledgeInfluence", "ppAdaPerUtxoByte", "ppExpansionRate", "ppTreasuryGrowthRate",
      "ppMaxValSize", "ppCollateralPercent", "ppMaxCollateralInputs",
    ]
    const filled = allPpKeys.filter((k) => params[k].trim() !== "")
    if (filled.length === 0)
      return "Vui lòng điền ít nhất một thông số muốn thay đổi."
    const decimalKeys: Array<keyof TypeParams> = ["ppExpansionRate", "ppTreasuryGrowthRate"]
    for (const k of decimalKeys) {
      if (params[k].trim() !== "") {
        const v = parseFloat(params[k])
        if (isNaN(v) || v < 0 || v > 1)
          return `Giá trị "${k.replace("pp", "")}" phải là số từ 0 đến 1.`
      }
    }
    if (params.ppPoolPledgeInfluence.trim() !== "") {
      const v = parseFloat(params.ppPoolPledgeInfluence)
      if (isNaN(v) || v < 0 || v > 2)
        return "Pool Pledge Influence phải là số từ 0 đến 2."
    }
  }
  return null
}

// ─── Resolve type-specific submitTx params ───────────────────────────────────

function buildTypeParams(
  gaType: string,
  params: TypeParams,
  withdrawalRows: WithdrawalRow[],
  committeeRemoveRows: string[],
  committeeAddRows: CommitteeAddRow[],
): Partial<BuildTxRequest> {
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
    case "treasuryWithdrawals":
      return {
        treasuryWithdrawals: withdrawalRows
          .filter((r) => r.stakeAddress.trim().startsWith("stake") && parseFloat(r.adaAmount) > 0)
          .map((r) => ({
            stakeAddress: r.stakeAddress.trim(),
            // Convert ADA → lovelace as string to preserve precision
            lovelace: String(Math.round(parseFloat(r.adaAmount) * 1_000_000)),
          })),
      }
    case "updateCommittee":
      return {
        committeeRemove: committeeRemoveRows.filter((c) => c.trim()).map((c) => c.trim()),
        committeeAdd: committeeAddRows
          .filter((r) => r.credential.trim() && parseInt(r.termEpoch) > 0)
          .map((r) => ({ credential: r.credential.trim(), termEpoch: parseInt(r.termEpoch) })),
        quorumNumerator: parseInt(params.quorumNumerator),
        quorumDenominator: parseInt(params.quorumDenominator),
        prevGovActionTxHash,
        prevGovActionIdx,
      }
    case "protocolParametersUpdate": {
      // Helper: parse optional integer field
      const pi = (v: string) => (v.trim() !== "" ? parseInt(v) : undefined)
      // Helper: convert decimal string (e.g. "0.003") to parts-per-million integer (e.g. 3000)
      const toPerMillion = (v: string) =>
        v.trim() !== "" ? Math.round(parseFloat(v) * 1_000_000) : undefined

      return {
        protocolParamUpdate: {
          minFeeA: pi(params.ppMinFeeA),
          minFeeB: pi(params.ppMinFeeB),
          maxTxSize: pi(params.ppMaxTxSize),
          maxBlockSize: pi(params.ppMaxBlockSize),
          maxBlockHeaderSize: pi(params.ppMaxBlockHeaderSize),
          keyDeposit: pi(params.ppKeyDeposit),
          poolDeposit: pi(params.ppPoolDeposit),
          nOpt: pi(params.ppNOpt),
          maxEpoch: pi(params.ppMaxEpoch),
          minPoolCost: pi(params.ppMinPoolCost),
          adaPerUtxoByte: pi(params.ppAdaPerUtxoByte),
          maxValSize: pi(params.ppMaxValSize),
          collateralPercent: pi(params.ppCollateralPercent),
          maxCollateralInputs: pi(params.ppMaxCollateralInputs),
          poolPledgeInfluencePerMillion: toPerMillion(params.ppPoolPledgeInfluence),
          expansionRatePerMillion: toPerMillion(params.ppExpansionRate),
          treasuryGrowthRatePerMillion: toPerMillion(params.ppTreasuryGrowthRate),
        },
        prevGovActionTxHash,
        prevGovActionIdx,
      }
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

  // Type-specific params (flat fields)
  const [typeParams, setTypeParams] = useState<TypeParams>(EMPTY_TYPE_PARAMS)
  const patchTypeParams = useCallback((patch: Partial<TypeParams>) => {
    setTypeParams((prev) => ({ ...prev, ...patch }))
  }, [])

  // Treasury Withdrawal recipient rows
  const [withdrawalRows, setWithdrawalRows] = useState<WithdrawalRow[]>([{ ...EMPTY_WITHDRAWAL_ROW }])

  // Update Committee member rows
  const [committeeRemoveRows, setCommitteeRemoveRows] = useState<string[]>([""])
  const [committeeAddRows, setCommitteeAddRows] = useState<CommitteeAddRow[]>([{ ...EMPTY_COMMITTEE_ADD_ROW }])

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

    const typeError = validateTypeParams(gaType, typeParams, withdrawalRows, committeeRemoveRows, committeeAddRows)
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
        ...buildTypeParams(gaType, typeParams, withdrawalRows, committeeRemoveRows, committeeAddRows),
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
  }, [drepId, gaInfo, gaType, typeParams, withdrawalRows, committeeRemoveRows, committeeAddRows, title, abstract, motivation, rationale, validLinks, isTypeSupported, reauthenticate, submitTx])

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
              maxLength={15000} height={150}
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
              maxLength={15000} height={150}
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
                {gaType === "treasuryWithdrawals" && (
                  <TreasuryWithdrawalFields
                    rows={withdrawalRows}
                    onChange={setWithdrawalRows}
                    network={network}
                  />
                )}
                {gaType === "updateCommittee" && (
                  <UpdateCommitteeFields
                    params={typeParams}
                    onParamChange={patchTypeParams}
                    removeRows={committeeRemoveRows}
                    onRemoveChange={setCommitteeRemoveRows}
                    addRows={committeeAddRows}
                    onAddChange={setCommitteeAddRows}
                  />
                )}
                {gaType === "protocolParametersUpdate" && (
                  <ProtocolParamChangeFields params={typeParams} onChange={patchTypeParams} network={network} />
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
