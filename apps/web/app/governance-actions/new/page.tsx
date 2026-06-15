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
import { useT } from "@/i18n/useT"
import type { BuildTxRequest } from "@tempo/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ─── GA type registry ────────────────────────────────────────────────────────

type GaTypeMeta = {
  label: string
  txType: BuildTxRequest["txType"] | null
}

const GA_TYPES: Record<string, GaTypeMeta> = {
  infoAction:               { label: "Info Action",               txType: "PROPOSE_INFO_ACTION" },
  noConfidence:             { label: "No Confidence",             txType: "PROPOSE_NO_CONFIDENCE" },
  hardForkInitiation:       { label: "Hard Fork Initiation",      txType: "PROPOSE_HARD_FORK" },
  newConstitution:          { label: "New Constitution",          txType: "PROPOSE_NEW_CONSTITUTION" },
  treasuryWithdrawals:      { label: "Treasury Withdrawals",      txType: "PROPOSE_TREASURY_WITHDRAWAL" },
  updateCommittee:          { label: "Update Committee",          txType: "PROPOSE_UPDATE_COMMITTEE" },
  protocolParametersUpdate: { label: "Protocol Parameter Change", txType: "PROPOSE_PROTOCOL_PARAM_CHANGE" },
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
  // Governance Group (Conway CDDL keys 25-33)
  ppGovActionDeposit: string
  ppDrepDeposit: string
  ppDrepActivity: string
  ppCommitteeMinSize: string
  ppCommitteeMaxTermLength: string
  ppGovActionLifetime: string
  ppMinFeeRefScriptCostPerByte: string
  // pool_voting_thresholds (all 5 or omit)
  ppPoolVtMotionNoConfidence: string
  ppPoolVtCommitteeNormal: string
  ppPoolVtCommitteeNoConfidence: string
  ppPoolVtHardForkInitiation: string
  ppPoolVtSecurityRelevantParam: string
  // drep_voting_thresholds (all 10 or omit)
  ppDrepVtMotionNoConfidence: string
  ppDrepVtCommitteeNormal: string
  ppDrepVtCommitteeNoConfidence: string
  ppDrepVtUpdateConstitution: string
  ppDrepVtHardForkInitiation: string
  ppDrepVtPpNetworkGroup: string
  ppDrepVtPpEconomicGroup: string
  ppDrepVtPpTechnicalGroup: string
  ppDrepVtPpGovernanceGroup: string
  ppDrepVtTreasuryWithdrawal: string
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
  ppGovActionDeposit: "",
  ppDrepDeposit: "",
  ppDrepActivity: "",
  ppCommitteeMinSize: "",
  ppCommitteeMaxTermLength: "",
  ppGovActionLifetime: "",
  ppMinFeeRefScriptCostPerByte: "",
  ppPoolVtMotionNoConfidence: "",
  ppPoolVtCommitteeNormal: "",
  ppPoolVtCommitteeNoConfidence: "",
  ppPoolVtHardForkInitiation: "",
  ppPoolVtSecurityRelevantParam: "",
  ppDrepVtMotionNoConfidence: "",
  ppDrepVtCommitteeNormal: "",
  ppDrepVtCommitteeNoConfidence: "",
  ppDrepVtUpdateConstitution: "",
  ppDrepVtHardForkInitiation: "",
  ppDrepVtPpNetworkGroup: "",
  ppDrepVtPpEconomicGroup: "",
  ppDrepVtPpTechnicalGroup: "",
  ppDrepVtPpGovernanceGroup: "",
  ppDrepVtTreasuryWithdrawal: "",
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
  label,
  hint,
}: {
  params: TypeParams
  onChange: (patch: Partial<TypeParams>) => void
  label?: string
  hint?: string
}) {
  const t = useT()
  const displayLabel = label ?? t("governance.new.prevAction.label")
  const displayHint  = hint  ?? t("governance.new.prevAction.hint")

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className={LABEL}>
          {displayLabel}
          <span className="ml-1.5 text-[10px] text-text-muted font-normal normal-case bg-bg-elevated px-1.5 py-0.5 rounded">{t("common.optional")}</span>
        </label>
      </div>
      <p className="text-xs text-text-muted">{displayHint}</p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <input
          type="text"
          value={params.prevGovActionTxHash}
          onChange={(e) => onChange({ prevGovActionTxHash: e.target.value })}
          placeholder={t("governance.new.prevAction.txHashPlaceholder")}
          className={INPUT_SM + " font-mono text-xs"}
        />
        <input
          type="number"
          min={0}
          value={params.prevGovActionIdx}
          onChange={(e) => onChange({ prevGovActionIdx: e.target.value })}
          placeholder={t("governance.new.prevAction.idxPlaceholder")}
          className={INPUT_SM + " w-20 text-center"}
        />
      </div>
    </div>
  )
}

function NoConfidenceFields({ params, onChange }: { params: TypeParams; onChange: (p: Partial<TypeParams>) => void }) {
  const t = useT()
  return (
    <>
      <div className="p-3 bg-warning/8 border border-warning/20 rounded-xl text-xs text-text-secondary space-y-1">
        <p className="font-semibold text-warning">{t("governance.new.noConfidence.noteTitle")}</p>
        <p>{t("governance.new.noConfidence.warning1")}</p>
        <p>{t("governance.new.noConfidence.warning2")}</p>
      </div>
      <PrevGovActionFields
        params={params}
        onChange={onChange}
        label={t("governance.new.noConfidence.prevLabel")}
        hint={t("governance.new.noConfidence.prevHint")}
      />
    </>
  )
}

function HardForkFields({ params, onChange }: { params: TypeParams; onChange: (p: Partial<TypeParams>) => void }) {
  const t = useT()
  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <label className={LABEL}>{t("governance.new.hardFork.versionLabel")} <span className="text-danger font-normal normal-case">*</span></label>
        </div>
        <p className="text-xs text-text-muted">{t("governance.new.hardFork.versionDesc")}</p>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs text-text-muted w-12 shrink-0">{t("governance.new.hardFork.major")}</span>
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
            <span className="text-xs text-text-muted w-12 shrink-0">{t("governance.new.hardFork.minor")}</span>
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
        label={t("governance.new.hardFork.prevLabel")}
        hint={t("governance.new.hardFork.prevHint")}
      />
    </>
  )
}

function NewConstitutionFields({ params, onChange }: { params: TypeParams; onChange: (p: Partial<TypeParams>) => void }) {
  const t = useT()
  return (
    <>
      <div className="p-3 bg-accent/8 border border-accent/20 rounded-xl text-xs text-text-secondary space-y-1">
        <p className="font-semibold text-accent-light">{t("governance.new.constitution.noteTitle")}</p>
        <p>{t("governance.new.constitution.noteDesc1")}</p>
        <p>{t("governance.new.constitution.noteDesc2")}</p>
      </div>

      <div className="space-y-1.5">
        <label className={LABEL}>{t("governance.new.constitution.urlLabel")} <span className="text-danger font-normal normal-case">*</span></label>
        <input
          type="url"
          value={params.constitutionAnchorUrl}
          onChange={(e) => onChange({ constitutionAnchorUrl: e.target.value })}
          placeholder={t("governance.new.constitution.urlPlaceholder")}
          className={INPUT}
        />
      </div>

      <div className="space-y-1.5">
        <label className={LABEL}>{t("governance.new.constitution.hashLabel")} <span className="text-danger font-normal normal-case">*</span></label>
        <input
          type="text"
          value={params.constitutionAnchorHash}
          onChange={(e) => onChange({ constitutionAnchorHash: e.target.value })}
          placeholder={t("governance.new.constitution.hashPlaceholder")}
          className={INPUT + " font-mono text-xs"}
          maxLength={64}
        />
      </div>

      <div className="space-y-1.5">
        <label className={LABEL}>
          {t("governance.new.constitution.scriptHashLabel")}
          <span className="ml-1.5 text-[10px] text-text-muted font-normal normal-case bg-bg-elevated px-1.5 py-0.5 rounded">{t("common.optional")}</span>
        </label>
        <input
          type="text"
          value={params.constitutionScriptHash}
          onChange={(e) => onChange({ constitutionScriptHash: e.target.value })}
          placeholder={t("governance.new.constitution.scriptHashPlaceholder")}
          className={INPUT + " font-mono text-xs"}
          maxLength={56}
        />
      </div>

      <PrevGovActionFields
        params={params}
        onChange={onChange}
        label={t("governance.new.constitution.prevLabel")}
        hint={t("governance.new.constitution.prevHint")}
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
  const t = useT()
  const totalAda = rows.reduce((sum, r) => sum + (parseFloat(r.adaAmount) || 0), 0)
  const stakeHint = network === "mainnet" ? "stake1..." : "stake_test1..."

  const patchRow = (i: number, patch: Partial<WithdrawalRow>) => {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <>
      <div className="p-3 bg-warning/8 border border-warning/20 rounded-xl text-xs text-text-secondary space-y-1">
        <p className="font-semibold text-warning">{t("governance.new.treasury.noteTitle")}</p>
        <p>{t("governance.new.treasury.warning1")}</p>
        <p>{t("governance.new.treasury.warning2")}</p>
      </div>

      <div className="space-y-1.5">
        <label className={LABEL}>{t("governance.new.treasury.recipientsLabel")} <span className="text-danger font-normal normal-case">*</span></label>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                type="text"
                value={row.stakeAddress}
                onChange={(e) => patchRow(i, { stakeAddress: e.target.value })}
                placeholder={t("governance.new.treasury.stakeAddressPlaceholder", { hint: stakeHint })}
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
          {t("governance.new.treasury.addRecipient")}
        </button>
      </div>

      {totalAda > 0 && (
        <div className="flex items-center justify-between px-4 py-3 bg-bg-elevated rounded-xl border border-border-subtle">
          <span className="text-xs text-text-muted uppercase tracking-wider">{t("governance.new.treasury.totalWithdrawal")}</span>
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
  const t = useT()
  const num = parseInt(params.quorumNumerator)
  const den = parseInt(params.quorumDenominator)
  const quorumPct = num > 0 && den > 0 ? ((num / den) * 100).toFixed(1) : null

  const patchAddRow = (i: number, patch: Partial<CommitteeAddRow>) => {
    onAddChange(addRows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }

  return (
    <>
      <div className="p-3 bg-warning/8 border border-warning/20 rounded-xl text-xs text-text-secondary space-y-1">
        <p className="font-semibold text-warning">{t("governance.new.committee.noteTitle")}</p>
        <p>{t("governance.new.committee.warning1")}</p>
        <p>{t("governance.new.committee.warning2")}</p>
      </div>

      {/* Remove Members */}
      <div className="space-y-1.5">
        <label className={LABEL}>
          {t("governance.new.committee.removeLabel")}
          <span className="ml-1.5 text-[10px] text-text-muted font-normal normal-case bg-bg-elevated px-1.5 py-0.5 rounded">{t("common.optional")}</span>
        </label>
        <p className="text-xs text-text-muted">{t("governance.new.committee.removeDesc")}</p>
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
                placeholder={t("governance.new.committee.removePlaceholder")}
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
          {t("governance.new.committee.addCredential")}
        </button>
      </div>

      {/* Add Members */}
      <div className="space-y-1.5">
        <label className={LABEL}>
          {t("governance.new.committee.addLabel")}
          <span className="ml-1.5 text-[10px] text-text-muted font-normal normal-case bg-bg-elevated px-1.5 py-0.5 rounded">{t("common.optional")}</span>
        </label>
        <p className="text-xs text-text-muted">{t("governance.new.committee.addDesc")}</p>
        <div className="space-y-2">
          {addRows.map((row, i) => (
            <div key={i} className="flex gap-2 items-start">
              <input
                type="text"
                value={row.credential}
                onChange={(e) => patchAddRow(i, { credential: e.target.value })}
                placeholder={t("governance.new.committee.removePlaceholder")}
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
          {t("governance.new.committee.addMember")}
        </button>
      </div>

      {/* Quorum Threshold */}
      <div className="space-y-1.5">
        <label className={LABEL}>{t("governance.new.committee.quorumLabel")} <span className="text-danger font-normal normal-case">*</span></label>
        <p className="text-xs text-text-muted">{t("governance.new.committee.quorumDesc")}</p>
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
        label={t("governance.new.committee.prevLabel")}
        hint={t("governance.new.committee.prevHint")}
      />
    </>
  )
}

// ─── Protocol Parameter Change — types & data ────────────────────────────────

type PpActiveParam = { id: string; groupId: string; paramKey: keyof TypeParams }


// ─── Protocol Parameter Change — 4 CIP-1694 parameter groups ─────────────────

type PpParamDef = {
  key: keyof TypeParams
  label: string
  unit: string
  step: string
  min: number
  max?: number
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
      { key: "ppMaxTxSize",          label: "Max Transaction Size",     unit: "bytes",    step: "1",     min: 0 },
      { key: "ppMaxBlockSize",       label: "Max Block Body Size",      unit: "bytes",    step: "1",     min: 0 },
      { key: "ppMaxBlockHeaderSize", label: "Max Block Header Size",    unit: "bytes",    step: "1",     min: 0 },
      { key: "ppMaxValSize",         label: "Max Value Size",           unit: "bytes",    step: "1",     min: 0 },
      { key: "ppMaxCollateralInputs",label: "Max Collateral Inputs",    unit: "inputs",   step: "1",     min: 0 },
    ],
  },
  {
    id: "economic",
    label: "Economic Group",
    threshold: "CC + 67% DRep",
    color: "text-success",
    params: [
      { key: "ppMinFeeA",            label: "Min Fee Coefficient (A)",  unit: "lov/byte", step: "1",     min: 0 },
      { key: "ppMinFeeB",            label: "Min Fee Constant (B)",     unit: "lovelace", step: "1",     min: 0 },
      { key: "ppKeyDeposit",         label: "Stake Key Deposit",        unit: "lovelace", step: "1",     min: 0 },
      { key: "ppPoolDeposit",        label: "Pool Registration Deposit",unit: "lovelace", step: "1",     min: 0 },
      { key: "ppExpansionRate",      label: "Monetary Expansion (ρ)",   unit: "0–1",      step: "0.001", min: 0, max: 1 },
      { key: "ppTreasuryGrowthRate", label: "Treasury Growth Rate (τ)", unit: "0–1",      step: "0.001", min: 0, max: 1 },
      { key: "ppMinPoolCost",        label: "Min Pool Cost",            unit: "lovelace", step: "1",     min: 0 },
      { key: "ppAdaPerUtxoByte",     label: "ADA per UTxO Byte",        unit: "lovelace", step: "1",     min: 0 },
      { key: "ppCollateralPercent",  label: "Collateral Percentage",    unit: "%",        step: "1",     min: 0 },
    ],
  },
  {
    id: "technical",
    label: "Technical Group",
    threshold: "CC + 67% DRep",
    color: "text-warning",
    params: [
      { key: "ppNOpt",               label: "Desired Pool Count (k)",   unit: "pools",    step: "1",     min: 0 },
      { key: "ppMaxEpoch",           label: "Pool Retirement Window",   unit: "epochs",   step: "1",     min: 0 },
      { key: "ppPoolPledgeInfluence",label: "Pool Pledge Influence (a₀)",unit: "0–2",     step: "0.001", min: 0, max: 2 },
    ],
  },
  {
    id: "governance",
    label: "Governance Group",
    threshold: "CC + 67% DRep",
    color: "text-accent",
    params: [
      { key: "ppGovActionDeposit",           label: "Gov Action Deposit",              unit: "lovelace", step: "1",     min: 0 },
      { key: "ppDrepDeposit",                label: "DRep Deposit",                    unit: "lovelace", step: "1",     min: 0 },
      { key: "ppDrepActivity",               label: "DRep Activity",                   unit: "epochs",   step: "1",     min: 0 },
      { key: "ppCommitteeMinSize",           label: "Committee Min Size",              unit: "members",  step: "1",     min: 0 },
      { key: "ppCommitteeMaxTermLength",     label: "Committee Max Term Length",       unit: "epochs",   step: "1",     min: 0 },
      { key: "ppGovActionLifetime",          label: "Gov Action Lifetime",             unit: "epochs",   step: "1",     min: 0 },
      { key: "ppMinFeeRefScriptCostPerByte", label: "Min Fee RefScript Cost/Byte",     unit: "0–∞",      step: "0.001", min: 0 },
      { key: "ppPoolVtMotionNoConfidence",    label: "Pool VT: Motion No Confidence",   unit: "0–1",      step: "0.001", min: 0, max: 1 },
      { key: "ppPoolVtCommitteeNormal",       label: "Pool VT: Committee Normal",       unit: "0–1",      step: "0.001", min: 0, max: 1 },
      { key: "ppPoolVtCommitteeNoConfidence", label: "Pool VT: Committee No Confidence",unit: "0–1",      step: "0.001", min: 0, max: 1 },
      { key: "ppPoolVtHardForkInitiation",    label: "Pool VT: Hard Fork Initiation",   unit: "0–1",      step: "0.001", min: 0, max: 1 },
      { key: "ppPoolVtSecurityRelevantParam", label: "Pool VT: Security Relevant Param",unit: "0–1",      step: "0.001", min: 0, max: 1 },
      { key: "ppDrepVtMotionNoConfidence",    label: "DRep VT: Motion No Confidence",   unit: "0–1",      step: "0.001", min: 0, max: 1 },
      { key: "ppDrepVtCommitteeNormal",       label: "DRep VT: Committee Normal",       unit: "0–1",      step: "0.001", min: 0, max: 1 },
      { key: "ppDrepVtCommitteeNoConfidence", label: "DRep VT: Committee No Confidence",unit: "0–1",      step: "0.001", min: 0, max: 1 },
      { key: "ppDrepVtUpdateConstitution",    label: "DRep VT: Update Constitution",    unit: "0–1",      step: "0.001", min: 0, max: 1 },
      { key: "ppDrepVtHardForkInitiation",    label: "DRep VT: Hard Fork Initiation",   unit: "0–1",      step: "0.001", min: 0, max: 1 },
      { key: "ppDrepVtPpNetworkGroup",        label: "DRep VT: PP Network Group",       unit: "0–1",      step: "0.001", min: 0, max: 1 },
      { key: "ppDrepVtPpEconomicGroup",       label: "DRep VT: PP Economic Group",      unit: "0–1",      step: "0.001", min: 0, max: 1 },
      { key: "ppDrepVtPpTechnicalGroup",      label: "DRep VT: PP Technical Group",     unit: "0–1",      step: "0.001", min: 0, max: 1 },
      { key: "ppDrepVtPpGovernanceGroup",     label: "DRep VT: PP Governance Group",    unit: "0–1",      step: "0.001", min: 0, max: 1 },
      { key: "ppDrepVtTreasuryWithdrawal",    label: "DRep VT: Treasury Withdrawal",    unit: "0–1",      step: "0.001", min: 0, max: 1 },
    ],
  },
]

function ProtocolParamChangeFields({
  params,
  onChange,
  network: _network,
}: {
  params: TypeParams
  onChange: (patch: Partial<TypeParams>) => void
  network: string
}) {
  const t = useT()
  const [activeParams, setActiveParams] = useState<PpActiveParam[]>([])
  const [selGroup, setSelGroup] = useState("")
  const [selParam, setSelParam] = useState("")

  const addedKeys = new Set(activeParams.map((p) => p.paramKey))
  const selGroupDef = CIP1694_GROUPS.find((g) => g.id === selGroup)
  const availableForSel = (selGroupDef?.params ?? []).filter((p) => !addedKeys.has(p.key))
  const allParamDefs = CIP1694_GROUPS.flatMap((g) => g.params)

  const handleAdd = () => {
    if (!selParam) return
    setActiveParams((prev) => [
      ...prev,
      { id: `${selParam}-${Date.now()}`, groupId: selGroup, paramKey: selParam as keyof TypeParams },
    ])
    setSelParam("")
  }

  const handleRemove = (id: string, paramKey: keyof TypeParams) => {
    setActiveParams((prev) => prev.filter((p) => p.id !== id))
    onChange({ [paramKey]: "" } as Partial<TypeParams>)
  }

  const filledCount = activeParams.filter((p) => params[p.paramKey].trim() !== "").length

  return (
    <>
      {/* Intro */}
      <div className="p-3 bg-accent/8 border border-accent/20 rounded-xl text-xs text-text-secondary space-y-1">
        <p className="font-semibold text-accent-light">{t("governance.new.pp.guideTitle")}</p>
        <p>{t("governance.new.pp.guideDesc")}</p>
      </div>

      {/* Selector */}
      <div className="space-y-2">
        <label className={LABEL}>{t("governance.new.pp.addParamLabel")}</label>
        <div className="flex gap-2 flex-wrap items-center">
          {/* Group dropdown */}
          <div className="relative flex-1 min-w-[150px]">
            <select
              value={selGroup}
              onChange={(e) => { setSelGroup(e.target.value); setSelParam("") }}
              className={`${INPUT_SM} w-full pr-8 appearance-none cursor-pointer`}
            >
              <option value="">{t("governance.new.pp.selectGroup")}</option>
              {CIP1694_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>

          {/* Param dropdown */}
          {selGroup && (
            <div className="relative flex-1 min-w-[220px]">
              <select
                value={selParam}
                onChange={(e) => setSelParam(e.target.value)}
                className={`${INPUT_SM} w-full pr-8 appearance-none cursor-pointer disabled:opacity-50`}
                disabled={availableForSel.length === 0}
              >
                <option value="">
                  {availableForSel.length === 0 ? t("governance.new.pp.allAdded") : t("governance.new.pp.selectParam")}
                </option>
                {availableForSel.map((p) => (
                  <option key={p.key} value={p.key}>{p.label} ({p.unit})</option>
                ))}
              </select>
              <svg className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          )}

          {/* Add button */}
          {selGroup && (
            <button
              type="button"
              onClick={handleAdd}
              disabled={!selParam || availableForSel.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-accent/10 text-accent-light border border-accent/20 hover:bg-accent/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {t("governance.new.pp.addBtn")}
            </button>
          )}
        </div>

        {/* Governance Group hint */}
        {selGroup === "governance" && (
          <div className="px-3 py-2 bg-accent/8 border border-accent/20 rounded-xl text-xs text-text-muted">
            {t("governance.new.pp.governanceHint")}
          </div>
        )}
      </div>

      {/* Active params list */}
      {activeParams.length === 0 ? (
        <div className="text-center py-6 text-sm text-text-muted border border-dashed border-border-subtle rounded-xl">
          {t("governance.new.pp.noParams")}
        </div>
      ) : (
        <div className="space-y-2">
          {filledCount > 0 && (
            <p className="text-xs text-success font-semibold">
              {t("governance.new.pp.filledCount", { filled: filledCount, total: activeParams.length })}
            </p>
          )}
          {activeParams.map((entry) => {
            const groupDef = CIP1694_GROUPS.find((g) => g.id === entry.groupId)
            const paramDef = allParamDefs.find((p) => p.key === entry.paramKey)
            if (!paramDef) return null
            const hasValue = params[entry.paramKey].trim() !== ""

            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-colors ${
                  hasValue ? "bg-accent/5 border-accent/20" : "bg-bg-elevated border-border-subtle"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider leading-none mb-0.5">
                    {groupDef?.label}
                  </p>
                  <p className="text-sm font-medium text-text-primary leading-tight">{paramDef.label}</p>
                  <p className="text-[10px] text-text-muted">{paramDef.unit}</p>
                </div>
                <input
                  type="number"
                  min={paramDef.min}
                  max={paramDef.max}
                  step={paramDef.step}
                  value={params[entry.paramKey]}
                  onChange={(e) => onChange({ [entry.paramKey]: e.target.value } as Partial<TypeParams>)}
                  placeholder={t("governance.new.pp.proposedValuePlaceholder")}
                  className={`w-40 text-right tabular-nums text-sm rounded-xl px-3 py-2 bg-bg-secondary placeholder-text-muted focus:outline-none transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                    hasValue
                      ? "border border-accent/60 text-text-primary focus:border-accent"
                      : "border border-border-default text-text-primary focus:border-accent/60"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => handleRemove(entry.id, entry.paramKey)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors shrink-0"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Previous enacted ParameterChange */}
      <div className="pt-1">
        <PrevGovActionFields
          params={params}
          onChange={onChange}
          label={t("governance.new.pp.prevLabel")}
          hint={t("governance.new.pp.prevHint")}
        />
      </div>
    </>
  )
}

// ─── Validation per type ─────────────────────────────────────────────────────

type TFunc = ReturnType<typeof useT>

function validateTypeParams(
  gaType: string,
  params: TypeParams,
  withdrawalRows: WithdrawalRow[],
  committeeRemoveRows: string[],
  committeeAddRows: CommitteeAddRow[],
  t: TFunc,
): string | null {
  if (gaType === "hardForkInitiation") {
    const major = parseInt(params.protocolVersionMajor)
    if (!params.protocolVersionMajor || isNaN(major) || major < 0)
      return t("governance.new.err.hardForkMajor")
  }
  if (gaType === "newConstitution") {
    if (!params.constitutionAnchorUrl.trim())
      return t("governance.new.err.constitutionUrl")
    if (!params.constitutionAnchorHash.trim() || params.constitutionAnchorHash.length !== 64)
      return t("governance.new.err.constitutionHash")
  }
  if (gaType === "treasuryWithdrawals") {
    const valid = withdrawalRows.filter(
      (r) => r.stakeAddress.trim().startsWith("stake") && parseFloat(r.adaAmount) > 0,
    )
    if (valid.length === 0)
      return t("governance.new.err.treasuryRecipient")
    const bad = withdrawalRows.find(
      (r) => r.stakeAddress.trim() && !r.stakeAddress.trim().startsWith("stake"),
    )
    if (bad) return t("governance.new.err.treasuryInvalidStake", { addr: bad.stakeAddress })
  }
  if (gaType === "updateCommittee") {
    const num = parseInt(params.quorumNumerator)
    const den = parseInt(params.quorumDenominator)
    if (!params.quorumNumerator || !params.quorumDenominator || isNaN(num) || isNaN(den))
      return t("governance.new.err.quorumRequired")
    if (num <= 0 || den <= 0)
      return t("governance.new.err.quorumPositive")
    if (num > den)
      return t("governance.new.err.quorumExceeded")
    const badRemove = committeeRemoveRows.find(
      (c) => c.trim() && !c.trim().startsWith("cc_cold"),
    )
    if (badRemove)
      return t("governance.new.err.committeeInvalidRemove", { cred: badRemove })
    const badAdd = committeeAddRows.find(
      (r) => r.credential.trim() && !r.credential.trim().startsWith("cc_cold"),
    )
    if (badAdd)
      return t("governance.new.err.committeeInvalidAdd", { cred: badAdd.credential })
    const badEpoch = committeeAddRows.find(
      (r) => r.credential.trim() && (!r.termEpoch || parseInt(r.termEpoch) <= 0),
    )
    if (badEpoch)
      return t("governance.new.err.committeeEpoch", { cred: badEpoch.credential })
  }
  if (gaType === "protocolParametersUpdate") {
    const allPpKeys: Array<keyof TypeParams> = [
      "ppMinFeeA", "ppMinFeeB", "ppMaxTxSize", "ppMaxBlockSize", "ppMaxBlockHeaderSize",
      "ppKeyDeposit", "ppPoolDeposit", "ppNOpt", "ppMaxEpoch", "ppMinPoolCost",
      "ppPoolPledgeInfluence", "ppAdaPerUtxoByte", "ppExpansionRate", "ppTreasuryGrowthRate",
      "ppMaxValSize", "ppCollateralPercent", "ppMaxCollateralInputs",
      "ppGovActionDeposit", "ppDrepDeposit", "ppDrepActivity",
      "ppCommitteeMinSize", "ppCommitteeMaxTermLength", "ppGovActionLifetime",
      "ppMinFeeRefScriptCostPerByte",
      "ppPoolVtMotionNoConfidence", "ppPoolVtCommitteeNormal", "ppPoolVtCommitteeNoConfidence",
      "ppPoolVtHardForkInitiation", "ppPoolVtSecurityRelevantParam",
      "ppDrepVtMotionNoConfidence", "ppDrepVtCommitteeNormal", "ppDrepVtCommitteeNoConfidence",
      "ppDrepVtUpdateConstitution", "ppDrepVtHardForkInitiation",
      "ppDrepVtPpNetworkGroup", "ppDrepVtPpEconomicGroup", "ppDrepVtPpTechnicalGroup",
      "ppDrepVtPpGovernanceGroup", "ppDrepVtTreasuryWithdrawal",
    ]
    const filled = allPpKeys.filter((k) => params[k].trim() !== "")
    if (filled.length === 0)
      return t("governance.new.err.ppNoParams")
    const decimalKeys: Array<keyof TypeParams> = ["ppExpansionRate", "ppTreasuryGrowthRate"]
    for (const k of decimalKeys) {
      if (params[k].trim() !== "") {
        const v = parseFloat(params[k])
        if (isNaN(v) || v < 0 || v > 1)
          return t("governance.new.err.ppDecimalRange")
      }
    }
    if (params.ppPoolPledgeInfluence.trim() !== "") {
      const v = parseFloat(params.ppPoolPledgeInfluence)
      if (isNaN(v) || v < 0 || v > 2)
        return t("governance.new.err.ppPledgeInfluence")
    }
    const poolVtKeys: Array<keyof TypeParams> = [
      "ppPoolVtMotionNoConfidence", "ppPoolVtCommitteeNormal", "ppPoolVtCommitteeNoConfidence",
      "ppPoolVtHardForkInitiation", "ppPoolVtSecurityRelevantParam",
    ]
    const poolVtFilled = poolVtKeys.filter((k) => params[k].trim() !== "").length
    if (poolVtFilled > 0 && poolVtFilled < 5)
      return t("governance.new.err.ppPoolVtIncomplete")
    const drepVtKeys: Array<keyof TypeParams> = [
      "ppDrepVtMotionNoConfidence", "ppDrepVtCommitteeNormal", "ppDrepVtCommitteeNoConfidence",
      "ppDrepVtUpdateConstitution", "ppDrepVtHardForkInitiation",
      "ppDrepVtPpNetworkGroup", "ppDrepVtPpEconomicGroup", "ppDrepVtPpTechnicalGroup",
      "ppDrepVtPpGovernanceGroup", "ppDrepVtTreasuryWithdrawal",
    ]
    const drepVtFilled = drepVtKeys.filter((k) => params[k].trim() !== "").length
    if (drepVtFilled > 0 && drepVtFilled < 10)
      return t("governance.new.err.ppDrepVtIncomplete")
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
      const pi = (v: string) => (v.trim() !== "" ? parseInt(v) : undefined)
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
          // Governance Group
          govActionDeposit: pi(params.ppGovActionDeposit),
          drepDeposit: pi(params.ppDrepDeposit),
          drepActivity: pi(params.ppDrepActivity),
          committeeMinSize: pi(params.ppCommitteeMinSize),
          committeeMaxTermLength: pi(params.ppCommitteeMaxTermLength),
          govActionLifetime: pi(params.ppGovActionLifetime),
          minFeeRefScriptCostPerBytePerMillion: toPerMillion(params.ppMinFeeRefScriptCostPerByte),
          poolVtMotionNoConfidencePerMillion: toPerMillion(params.ppPoolVtMotionNoConfidence),
          poolVtCommitteeNormalPerMillion: toPerMillion(params.ppPoolVtCommitteeNormal),
          poolVtCommitteeNoConfidencePerMillion: toPerMillion(params.ppPoolVtCommitteeNoConfidence),
          poolVtHardForkInitiationPerMillion: toPerMillion(params.ppPoolVtHardForkInitiation),
          poolVtSecurityRelevantParamPerMillion: toPerMillion(params.ppPoolVtSecurityRelevantParam),
          drepVtMotionNoConfidencePerMillion: toPerMillion(params.ppDrepVtMotionNoConfidence),
          drepVtCommitteeNormalPerMillion: toPerMillion(params.ppDrepVtCommitteeNormal),
          drepVtCommitteeNoConfidencePerMillion: toPerMillion(params.ppDrepVtCommitteeNoConfidence),
          drepVtUpdateConstitutionPerMillion: toPerMillion(params.ppDrepVtUpdateConstitution),
          drepVtHardForkInitiationPerMillion: toPerMillion(params.ppDrepVtHardForkInitiation),
          drepVtPpNetworkGroupPerMillion: toPerMillion(params.ppDrepVtPpNetworkGroup),
          drepVtPpEconomicGroupPerMillion: toPerMillion(params.ppDrepVtPpEconomicGroup),
          drepVtPpTechnicalGroupPerMillion: toPerMillion(params.ppDrepVtPpTechnicalGroup),
          drepVtPpGovernanceGroupPerMillion: toPerMillion(params.ppDrepVtPpGovernanceGroup),
          drepVtTreasuryWithdrawalPerMillion: toPerMillion(params.ppDrepVtTreasuryWithdrawal),
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

  const t = useT()
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
        message: t("governance.new.unsupportedNotice", { label: gaInfo.label }),
      })
      return
    }

    const typeError = validateTypeParams(gaType, typeParams, withdrawalRows, committeeRemoveRows, committeeAddRows, t)
    if (typeError) {
      setAlert({ type: "error", title: t("governance.new.missingInfo"), message: typeError })
      return
    }

    setSubmitting(true)

    try {
      // Step 1: Upload CIP-108 metadata (proposal anchor) to IPFS
      if (!anchorCache.current) {
        setStatusLabel(t("governance.new.uploadingMetadata"))

        let jwt = getJwt()
        if (!jwt) jwt = await reauthenticate()
        if (!jwt) throw new Error(t("governance.new.missingInfo"))

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
          if (!newJwt) throw new Error(t("governance.new.missingInfo"))
          res = await fetch(`${API_URL}/metadata/upload-proposal`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeader(newJwt) },
            body: metaBody,
          })
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: t("governance.new.defaultError") }))
          throw new Error(err.error ?? t("governance.new.defaultError"))
        }

        const { anchorUrl, anchorDataHash } = await res.json()
        anchorCache.current = { anchorUrl, anchorDataHash }
      }

      // Step 2: Build + Sign + Submit TX
      setStatusLabel(t("governance.new.signingTx"))
      const hash = await submitTx(gaInfo.txType!, {
        anchorUrl: anchorCache.current!.anchorUrl,
        anchorDataHash: anchorCache.current!.anchorDataHash,
        ...buildTypeParams(gaType, typeParams, withdrawalRows, committeeRemoveRows, committeeAddRows),
      })

      setTxHash(hash)
      setAlert({
        type: "success",
        title: t("governance.new.successTitle"),
        message: t("governance.new.successDesc"),
      })
    } catch (e: any) {
      setAlert({
        type: "error",
        title: t("governance.new.submitFailed"),
        message: e.message ?? t("governance.new.defaultError"),
      })
    } finally {
      setSubmitting(false)
    }
  }, [drepId, gaInfo, gaType, typeParams, withdrawalRows, committeeRemoveRows, committeeAddRows, title, abstract, motivation, rationale, validLinks, isTypeSupported, reauthenticate, submitTx, t])

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
          <p className="font-semibold">{!isConnected ? t("governance.new.connectWallet") : t("governance.new.drepOnly")}</p>
          <p className="text-sm text-text-secondary">
            {!isConnected ? t("governance.new.connectWalletDesc") : t("governance.new.drepOnlyDesc")}
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
            {t("governance.new.breadcrumbParent")}
          </Link>
          <span>/</span>
          <span>{t("governance.new.breadcrumbCurrent")}</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary">{t("governance.new.pageTitle")}</h1>
        {poll && (
          <p className="text-sm text-text-secondary mt-1">
            {t("governance.new.fromPoll", { title: poll.title ?? "" })}
          </p>
        )}
      </div>

      {/* GA type badge */}
      <div className="flex items-center gap-3 p-4 bg-bg-elevated rounded-xl border border-border-subtle">
        <div className="flex-1">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-0.5">{t("governance.new.gaTypeLabel")}</p>
          <p className="font-semibold text-text-primary">{gaInfo.label}</p>
          <p className="text-xs text-text-muted mt-0.5">{t(`governance.new.gaDesc.${gaType}`)}</p>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-xs text-accent-light hover:underline shrink-0"
        >
          {t("governance.new.changeType")}
        </button>
      </div>

      {/* Coming soon notice for unsupported types */}
      {!isTypeSupported && (
        <div className="notice-warning rounded-xl p-4 text-sm">
          {t("governance.new.unsupportedNotice", { label: gaInfo.label })}
        </div>
      )}

      {/* Deposit warning */}
      {isTypeSupported && (
        <div className="notice-warning rounded-xl p-4 text-sm">
          {t("governance.new.depositWarning", { amount: "100,000" })}
        </div>
      )}

      {/* Form */}
      <div className="card-static rounded-2xl overflow-hidden">
        <div className="p-5 sm:p-6 space-y-5">

          <SectionDivider label={t("governance.new.sectionContent")} />

          {/* Title */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={LABEL}>{t("governance.new.titleField")} <span className="text-danger font-normal normal-case">*</span></label>
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
              placeholder={t("governance.new.titlePlaceholder")}
              className={INPUT}
            />
          </div>

          {/* Abstract */}
          <div className="space-y-1.5">
            <label className={LABEL}>{t("governance.new.abstractField")} <span className="text-danger font-normal normal-case">*</span></label>
            <RationaleEditor
              label="" description="" placeholder={t("governance.new.abstractPlaceholder")}
              maxLength={2500} height={150}
              value={abstract} onChange={setAbstract}
            />
          </div>

          {/* Motivation */}
          <div className="space-y-1.5">
            <label className={LABEL}>
              {t("governance.new.motivationField")} <span className="ml-1.5 text-[10px] text-text-muted font-normal normal-case bg-bg-elevated px-1.5 py-0.5 rounded">{t("common.optional")}</span>
            </label>
            <RationaleEditor
              label="" description="" placeholder={t("governance.new.motivationPlaceholder")}
              maxLength={15000} height={150}
              value={motivation} onChange={setMotivation}
            />
          </div>

          {/* Rationale */}
          <div className="space-y-1.5">
            <label className={LABEL}>
              {t("governance.new.rationaleField")} <span className="ml-1.5 text-[10px] text-text-muted font-normal normal-case bg-bg-elevated px-1.5 py-0.5 rounded">{t("common.optional")}</span>
            </label>
            <RationaleEditor
              label="" description="" placeholder={t("governance.new.rationalePlaceholder")}
              height={150}
              value={rationale} onChange={setRationale}
            />
          </div>

          {/* Type-specific fields */}
          {gaType !== "infoAction" && isTypeSupported && (
            <>
              <SectionDivider label={t("governance.new.sectionParams")} />
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

          <SectionDivider label={t("governance.new.sectionReferences")} />

          {/* Support links */}
          <div className="space-y-2">
            <label className={LABEL}>
              {t("governance.new.supportLinks")} <span className="ml-1.5 text-[10px] text-text-muted font-normal normal-case bg-bg-elevated px-1.5 py-0.5 rounded">{t("common.optional")}</span>
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
              {t("governance.new.addLink")}
            </button>
          </div>

          {/* Metadata standard note */}
          <div className="text-xs text-text-muted bg-bg-elevated rounded-lg px-3 py-2 border border-border-subtle">
            {t("governance.new.metadataNotePre")}{" "}
            <span className="font-mono text-text-secondary">CIP-108</span>{" "}
            {t("governance.new.metadataNotePost")}{" "}
            <span className="font-mono text-text-secondary">blake2b-256</span>{" "}
            {t("governance.new.metadataNoteEnd")}
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
            {t("governance.new.cancel")}
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
                {statusLabel || t("governance.new.processing")}
              </>
            ) : (
              t("governance.new.submitBtn")
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
                  title={t("governance.new.copyTxHash")}
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
                {t("governance.new.viewOnCardanoscan")}
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
