"use client"

import { useState } from "react"
import type {
  GovernanceAction,
  HardForkDetails,
  NewConstitutionDetails,
  TreasuryWithdrawalDetails,
  TreasuryWithdrawalRow,
  UpdateCommitteeDetails,
  ProtocolParamChangeDetails,
} from "@tempo/types"

// ── Ogmios protocol parameter key → human label mapping ──────────────────────

const PP_LABELS: Record<string, string> = {
  // Network Group
  maxTransactionSize:    "Max Transaction Size",
  maxBlockBodySize:      "Max Block Body Size",
  maxBlockHeaderSize:    "Max Block Header Size",
  maxValueSize:          "Max Value Size",
  maxCollateralInputs:   "Max Collateral Inputs",
  // Economic Group
  minFeeCoefficient:     "Min Fee Coefficient (A)",
  minFeeConstant:        "Min Fee Constant (B)",
  stakeKeyDeposit:       "Stake Key Deposit",
  stakePoolDeposit:      "Pool Registration Deposit",
  monetaryExpansion:     "Monetary Expansion (ρ)",
  treasuryExpansion:     "Treasury Growth Rate (τ)",
  minStakePoolCost:      "Min Pool Cost",
  minUtxoDepositCoefficient: "ADA per UTxO Byte",
  collateralPercentage:  "Collateral Percentage",
  // Technical Group
  desiredNumberOfStakePools: "Desired Pool Count (k)",
  stakePoolRetirementEpochBound: "Pool Retirement Window",
  stakePoolPledgeInfluence: "Pool Pledge Influence (a₀)",
  stakeCredentialDeposit: "Stake Key Deposit",
  maxReferenceScriptsSize: "Max Reference Scripts Size",
  // Plutus
  plutusCostModels:      "Plutus Cost Models",
  maxExecutionUnitsPerBlock: "Max Execution Units / Block",
  maxExecutionUnitsPerTransaction: "Max Execution Units / TX",
  executionUnitPrices:   "Execution Unit Prices",
  scriptExecutionPrices: "Execution Unit Prices",
  // Governance Group (Conway) — keys as Ogmios names
  governanceActionDeposit:               "Gov Action Deposit",
  governanceActionLifetime:              "Gov Action Lifetime",
  delegateRepresentativeDeposit:         "DRep Deposit",
  delegateRepresentativeMaxIdleTime:     "DRep Activity",
  constitutionalCommitteeMinSize:        "Committee Min Size",
  constitutionalCommitteeMaxTermLength:  "Committee Max Term Length",
  minFeeReferenceScripts:                "Min Fee RefScript Cost",
  stakePoolVotingThresholds:             "Pool Voting Thresholds",
  delegateRepresentativeVotingThresholds:"DRep Voting Thresholds",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function lovelaceToAda(lovelace: number) {
  return (lovelace / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 6 })
}

function shortHash(h: string) {
  return `${h.slice(0, 8)}…${h.slice(-6)}`
}

function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="font-mono text-xs text-text-secondary break-all">{value}</p>
    </div>
  )
}

function PrevAction({ txHash, index }: { txHash?: string; index?: number }) {
  if (!txHash) return null
  return (
    <div className="pt-3 border-t border-border-subtle space-y-0.5">
      <p className="text-xs text-text-muted">Previous Action ID</p>
      <p className="font-mono text-xs text-text-secondary break-all">
        {txHash}#{index ?? 0}
      </p>
    </div>
  )
}

// ── Large-value detection & summary ──────────────────────────────────────────

/**
 * Returns true for values too large to display inline:
 * - Arrays with more than 10 items
 * - Objects where any direct value is an array with >10 items
 */
function isLargeValue(val: unknown): boolean {
  if (Array.isArray(val)) return val.length > 10
  if (val !== null && typeof val === "object") {
    return Object.values(val as Record<string, unknown>).some(
      (v) => Array.isArray(v) && v.length > 10,
    )
  }
  return false
}

/**
 * Short human-readable summary for a large value.
 * - plutusCostModels → "plutus:v1 (332 ops), plutus:v2 (332 ops), ..."
 * - plain array → "[N items]"
 */
function summarizeLargeValue(val: unknown): string {
  if (Array.isArray(val)) return `[${val.length} items]`
  if (val !== null && typeof val === "object") {
    return Object.entries(val as Record<string, unknown>)
      .map(([k, v]) => (Array.isArray(v) ? `${k} (${v.length} ops)` : k))
      .join(", ")
  }
  return String(val)
}

/** Format a large value as indented Markdown code block for the modal. */
function formatModalContent(key: string, val: unknown): string {
  if (
    key === "plutusCostModels" &&
    val !== null &&
    typeof val === "object" &&
    !Array.isArray(val)
  ) {
    // Pretty-print each Plutus version as its own section
    return Object.entries(val as Record<string, unknown>)
      .map(([version, ops]) => {
        const opsArr = Array.isArray(ops) ? ops : []
        return `### ${version} — ${opsArr.length} cost values\n\`\`\`\n${JSON.stringify(opsArr, null, 2)}\n\`\`\``
      })
      .join("\n\n")
  }
  return `\`\`\`json\n${JSON.stringify(val, null, 2)}\n\`\`\``
}

// ── Expand Modal ──────────────────────────────────────────────────────────────

interface ExpandModalProps {
  label: string
  content: string    // pre-formatted text (may contain markdown-ish code fences)
  onClose: () => void
}

function ExpandModal({ label, content, onClose }: ExpandModalProps) {
  // Parse content into renderable sections (plain text or code blocks)
  const sections = parseModalContent(content)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-bg-card w-full sm:max-w-2xl max-h-[90dvh] sm:max-h-[80vh] flex flex-col sm:rounded-2xl rounded-t-2xl shadow-2xl border border-border-subtle overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
          <h3 className="font-semibold text-base">{label}</h3>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-bg-secondary text-text-muted hover:text-text-primary hover:bg-border-subtle transition-colors text-sm"
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {sections.map((section, i) =>
            section.type === "heading" ? (
              <p key={i} className="text-sm font-semibold text-text-secondary mt-2 first:mt-0">
                {section.text}
              </p>
            ) : section.type === "code" ? (
              <pre
                key={i}
                className="bg-bg-secondary border border-border-subtle rounded-xl p-3 text-xs font-mono text-text-secondary overflow-x-auto whitespace-pre leading-relaxed"
              >
                {section.text}
              </pre>
            ) : (
              <p key={i} className="text-sm text-text-secondary">
                {section.text}
              </p>
            ),
          )}
        </div>
      </div>
    </div>
  )
}

type ContentSection =
  | { type: "heading"; text: string }
  | { type: "code"; text: string }
  | { type: "text"; text: string }

function parseModalContent(raw: string): ContentSection[] {
  const sections: ContentSection[] = []
  const lines = raw.split("\n")
  let i = 0
  while (i < lines.length) {
    const line = lines[i] ?? ""
    if (line.startsWith("### ")) {
      sections.push({ type: "heading", text: line.slice(4) })
      i++
    } else if (line.startsWith("```")) {
      const codeLines: string[] = []
      i++ // skip opening fence
      while (i < lines.length) {
        const codeLine = lines[i] ?? ""
        if (codeLine.startsWith("```")) break
        codeLines.push(codeLine)
        i++
      }
      i++ // skip closing fence
      sections.push({ type: "code", text: codeLines.join("\n") })
    } else if (line.trim() === "") {
      i++
    } else {
      sections.push({ type: "text", text: line })
      i++
    }
  }
  return sections
}

// ── Type-specific detail sections ─────────────────────────────────────────────

function NoConfidenceDetail() {
  return (
    <div className="p-4 bg-warning/8 border border-warning/20 rounded-xl text-sm space-y-1.5">
      <p className="font-semibold text-warning">Bất tín nhiệm Constitutional Committee</p>
      <p className="text-text-secondary text-xs">
        Nếu được ratified, đề xuất này sẽ giải tán Constitutional Committee hiện tại.
        Cardano sẽ vào trạng thái không có CC cho đến khi một Update Committee GA mới được thông qua.
      </p>
      <p className="text-text-muted text-xs">Yêu cầu: DRep ≥ 60% + SPO ≥ 51%</p>
    </div>
  )
}

function HardForkDetail({ d }: { d: HardForkDetails }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div>
          <p className="text-xs text-text-muted mb-0.5">Phiên bản đề xuất</p>
          <p className="text-2xl font-bold tabular-nums">
            {d.versionMajor ?? "?"}.{d.versionMinor ?? "?"}
          </p>
        </div>
      </div>
      <p className="text-xs text-text-muted">
        Hard Fork sẽ nâng cấp giao thức Cardano lên phiên bản{" "}
        <span className="text-text-secondary font-medium">
          {d.versionMajor}.{d.versionMinor}
        </span>
        . Tất cả node phải được nâng cấp trước khi epoch chuyển tiếp.
      </p>
      <PrevAction txHash={d.prevActionTxHash} index={d.prevActionIndex} />
    </div>
  )
}

function NewConstitutionDetail({ d }: { d: NewConstitutionDetails }) {
  return (
    <div className="space-y-3">
      {d.constitutionUrl && (
        <HashRow label="Constitution Anchor URL" value={d.constitutionUrl} />
      )}
      {d.constitutionHash && (
        <HashRow label="Constitution Anchor Hash" value={d.constitutionHash} />
      )}
      {d.guardrailsHash && (
        <HashRow label="Guardrails Script Hash" value={d.guardrailsHash} />
      )}
      <PrevAction txHash={d.prevActionTxHash} index={d.prevActionIndex} />
    </div>
  )
}

function TreasuryWithdrawalDetail({ d }: { d: TreasuryWithdrawalDetails }) {
  // Ogmios returns withdrawals as { stakeAddr: { ada: { lovelace: N } } } (object),
  // but older/normalized data may already be an array. Handle both.
  const raw = d as unknown as Record<string, unknown>
  const withdrawals: TreasuryWithdrawalRow[] = Array.isArray(d.withdrawals)
    ? d.withdrawals
    : Object.entries((d.withdrawals ?? {}) as Record<string, { ada?: { lovelace?: number } }>)
        .map(([addr, val]) => ({ stakeCredential: addr, lovelace: val?.ada?.lovelace ?? 0 }))

  // Ogmios nests guardrails hash as { guardrails: { hash: "..." } }
  const guardrailsHash = d.guardrailsHash
    ?? (raw.guardrails as { hash?: string } | undefined)?.hash

  const totalLovelace = withdrawals.reduce((s, w) => s + w.lovelace, 0)
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-bg-secondary">
              <th className="px-3 py-2 text-left text-xs text-text-muted font-semibold">Địa chỉ Stake</th>
              <th className="px-3 py-2 text-right text-xs text-text-muted font-semibold">ADA</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map((w, i) => (
              <tr key={i} className="border-b border-border-subtle/50 last:border-0">
                <td className="px-3 py-2 font-mono text-xs text-text-secondary">
                  {shortHash(w.stakeCredential)}
                  <span className="sr-only">{w.stakeCredential}</span>
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {lovelaceToAda(w.lovelace)}{" "}
                  <span className="text-text-muted text-xs">ADA</span>
                </td>
              </tr>
            ))}
          </tbody>
          {withdrawals.length > 1 && (
            <tfoot>
              <tr className="bg-bg-secondary border-t border-border-subtle">
                <td className="px-3 py-2 text-xs text-text-muted font-semibold">Tổng cộng</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums">
                  {lovelaceToAda(totalLovelace)}{" "}
                  <span className="text-text-muted text-xs font-normal">ADA</span>
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {guardrailsHash && (
        <HashRow label="Guardrails Script Hash" value={guardrailsHash} />
      )}
      <PrevAction txHash={d.prevActionTxHash} index={d.prevActionIndex} />
    </div>
  )
}

function UpdateCommitteeDetail({ d }: { d: UpdateCommitteeDetails }) {
  const quorumLabel = d.quorumNumerator != null && d.quorumDenominator
    ? `${d.quorumNumerator}/${d.quorumDenominator} (${((d.quorumNumerator / d.quorumDenominator) * 100).toFixed(1)}%)`
    : d.quorumRate != null
      ? `${(d.quorumRate * 100).toFixed(1)}%`
      : null

  return (
    <div className="space-y-4">
      {quorumLabel && (
        <div>
          <p className="text-xs text-text-muted mb-0.5">Quorum mới</p>
          <p className="font-semibold">{quorumLabel}</p>
        </div>
      )}

      {d.addedMembers.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-success uppercase tracking-wider">
            Thêm ({d.addedMembers.length})
          </p>
          <div className="rounded-xl border border-border-subtle overflow-hidden">
            {d.addedMembers.map((m, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-border-subtle/50 last:border-0 text-xs">
                <span className="font-mono text-text-secondary">{shortHash(m.credential)}</span>
                {m.termEpoch != null && (
                  <span className="text-text-muted">hết hạn Epoch {m.termEpoch}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {d.removedMembers.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-danger uppercase tracking-wider">
            Xóa ({d.removedMembers.length})
          </p>
          <div className="rounded-xl border border-border-subtle overflow-hidden">
            {d.removedMembers.map((cred, i) => (
              <div key={i} className="px-3 py-2 border-b border-border-subtle/50 last:border-0 font-mono text-xs text-text-secondary">
                {shortHash(cred)}
              </div>
            ))}
          </div>
        </div>
      )}

      <PrevAction txHash={d.prevActionTxHash} index={d.prevActionIndex} />
    </div>
  )
}

function ProtocolParamChangeDetail({ d }: { d: ProtocolParamChangeDetails }) {
  const [modal, setModal] = useState<{ label: string; content: string } | null>(null)
  const params = d.parameters ?? {}
  const entries = Object.entries(params)

  return (
    <>
      <div className="space-y-3">
        {entries.length === 0 ? (
          <p className="text-xs text-text-muted">Không có thông số nào được thay đổi.</p>
        ) : (
          <div className="rounded-xl border border-border-subtle overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-bg-secondary">
                  <th className="px-3 py-2 text-left text-xs text-text-muted font-semibold">Thông số</th>
                  <th className="px-3 py-2 text-right text-xs text-text-muted font-semibold">Giá trị đề xuất</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(([key, val]) => {
                  const label = PP_LABELS[key] ?? key
                  const large = isLargeValue(val)
                  return (
                    <tr key={key} className="border-b border-border-subtle/50 last:border-0">
                      <td className="px-3 py-2 text-text-secondary">{label}</td>
                      <td className="px-3 py-2 text-right">
                        {large ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-mono text-xs text-text-muted">
                              {summarizeLargeValue(val)}
                            </span>
                            <button
                              onClick={() =>
                                setModal({
                                  label,
                                  content: formatModalContent(key, val),
                                })
                              }
                              className="shrink-0 px-2 py-0.5 rounded-md text-xs font-medium bg-accent/10 text-accent-light hover:bg-accent/20 transition-colors border border-accent/20"
                            >
                              Xem thêm
                            </button>
                          </div>
                        ) : (
                          <span className="font-mono text-xs font-medium tabular-nums text-accent-light">
                            {formatParamValue(val)}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {d.guardrailsHash && (
          <HashRow label="Guardrails Script Hash" value={d.guardrailsHash} />
        )}
        <PrevAction txHash={d.prevActionTxHash} index={d.prevActionIndex} />
      </div>

      {modal && (
        <ExpandModal
          label={modal.label}
          content={modal.content}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}

function formatParamValue(val: unknown): string {
  if (val === null || val === undefined) return "—"
  if (typeof val === "number") return val.toLocaleString()
  if (typeof val === "object") {
    const o = val as Record<string, unknown>
    // { lovelace: N } or { ada: { lovelace: N } }
    if ("lovelace" in o && typeof o.lovelace === "number") return o.lovelace.toLocaleString()
    if ("ada" in o && typeof o.ada === "object") {
      const ada = o.ada as Record<string, unknown>
      if ("lovelace" in ada && typeof ada.lovelace === "number") return ada.lovelace.toLocaleString()
    }
    // { bytes: N }
    if ("bytes" in o && typeof o.bytes === "number") return `${o.bytes.toLocaleString()} bytes`
    // { numerator, denominator } rational
    if ("numerator" in o && "denominator" in o) {
      const n = o.numerator as number
      const d = o.denominator as number
      return d ? `${n}/${d} (${((n / d) * 100).toFixed(2)}%)` : `${n}/${d}`
    }
    return JSON.stringify(val)
  }
  return String(val)
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ActionDetailCard({ action }: { action: GovernanceAction }) {
  const { actionType, details } = action
  const d = details as Record<string, unknown> | null | undefined

  // infoAction / information has no extra on-chain detail — nothing to show
  if (actionType === "infoAction" || actionType === "information") return null

  const title = {
    noConfidence:             "Tác động",
    hardForkInitiation:       "Phiên bản đề xuất",
    newConstitution:          "Hiến pháp mới",
    treasuryWithdrawals:      "Khoản rút",
    updateCommittee:          "Thay đổi Committee",
    protocolParametersUpdate: "Thông số đề xuất",
  }[actionType] ?? "Chi tiết"

  return (
    <div className="card-static space-y-4 animate-fade-in">
      <h2 className="font-semibold text-base">{title}</h2>
      {actionType === "noConfidence" && <NoConfidenceDetail />}
      {actionType === "hardForkInitiation" && d && (
        <HardForkDetail d={d as HardForkDetails} />
      )}
      {actionType === "newConstitution" && d && (
        <NewConstitutionDetail d={d as NewConstitutionDetails} />
      )}
      {actionType === "treasuryWithdrawals" && d && (
        <TreasuryWithdrawalDetail d={d as TreasuryWithdrawalDetails} />
      )}
      {actionType === "updateCommittee" && d && (
        <UpdateCommitteeDetail d={d as UpdateCommitteeDetails} />
      )}
      {actionType === "protocolParametersUpdate" && (
        <ProtocolParamChangeDetail d={(d ?? { parameters: {} }) as ProtocolParamChangeDetails} />
      )}
    </div>
  )
}
