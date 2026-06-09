import type {
  GovernanceAction,
  HardForkDetails,
  NewConstitutionDetails,
  TreasuryWithdrawalDetails,
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
  const totalLovelace = d.withdrawals.reduce((s, w) => s + w.lovelace, 0)
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-border-subtle">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-bg-secondary">
              <th className="px-3 py-2 text-left text-xs text-text-muted font-semibold">Stake Credential</th>
              <th className="px-3 py-2 text-right text-xs text-text-muted font-semibold">ADA</th>
            </tr>
          </thead>
          <tbody>
            {d.withdrawals.map((w, i) => (
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
          {d.withdrawals.length > 1 && (
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
      {d.guardrailsHash && (
        <HashRow label="Guardrails Script Hash" value={d.guardrailsHash} />
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
  const params = d.parameters ?? {}
  const entries = Object.entries(params)

  return (
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
                const display = formatParamValue(val)
                return (
                  <tr key={key} className="border-b border-border-subtle/50 last:border-0">
                    <td className="px-3 py-2 text-text-secondary">{label}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs font-medium tabular-nums text-accent-light">
                      {display}
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

  // infoAction has no extra detail — nothing to show
  if (actionType === "infoAction") return null

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
