"use client"

import { useState, useMemo } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { createProposal } from "@/hooks/useAllianceProposals"
import { useGovernanceActions } from "@/hooks/useGovernanceActions"
import { useT } from "@/i18n/useT"

const INPUT = "w-full bg-bg-elevated border border-border-subtle rounded-xl px-3 py-3 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/50 transition-colors"
const LABEL = "text-sm font-semibold text-text-primary"

type ProposalType = "withdrawal" | "ga_stance"

export default function CreateProposalPage() {
  const t = useT()
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const initialType = (searchParams.get("type") ?? "ga_stance") as ProposalType

  const { jwt, selectedNetwork, isConnected, isDrepRegistered } = useWalletStore()

  const [proposalType, setProposalType] = useState<ProposalType>(initialType)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  // withdrawal fields
  const [amountAda, setAmountAda] = useState("")
  const [recipientAddress, setRecipientAddress] = useState("")
  const [recipientLabel, setRecipientLabel] = useState("")

  // ga_stance fields
  const [gaSearch, setGaSearch] = useState("")
  const [selectedGa, setSelectedGa] = useState<{ txHash: string; index: number; title: string | null | undefined } | null>(null)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load active GAs for search
  const { actions } = useGovernanceActions(selectedNetwork ?? "mainnet")
  const filteredGas = useMemo(() => {
    if (!gaSearch.trim()) return actions.slice(0, 20)
    const q = gaSearch.toLowerCase()
    return actions.filter(
      (a) =>
        a.txHash.toLowerCase().includes(q) ||
        (a.title ?? "").toLowerCase().includes(q) ||
        a.type.toLowerCase().includes(q),
    ).slice(0, 20)
  }, [actions, gaSearch])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!jwt) return
    if (!title.trim()) { setError(t("alliance.proposal.titleLabel") + " required"); return }

    if (proposalType === "withdrawal") {
      const amountLovelace = Math.round(parseFloat(amountAda) * 1_000_000)
      if (isNaN(amountLovelace) || amountLovelace <= 0) { setError("Invalid amount"); return }
      if (!recipientAddress.trim()) { setError(t("alliance.proposal.recipientLabel") + " required"); return }
    }
    if (proposalType === "ga_stance" && !selectedGa) {
      setError("Select a governance action"); return
    }

    setSubmitting(true)
    setError(null)

    try {
      const body: Parameters<typeof createProposal>[1] = {
        proposalType,
        title: title.trim(),
        description: description.trim() || undefined,
      }
      if (proposalType === "withdrawal") {
        body.amountLovelace = Math.round(parseFloat(amountAda) * 1_000_000)
        body.recipientAddress = recipientAddress.trim()
        body.recipientLabel = recipientLabel.trim() || undefined
      }
      if (proposalType === "ga_stance" && selectedGa) {
        body.govActionTxHash = selectedGa.txHash
        body.govActionIndex  = selectedGa.index
      }

      const { id } = await createProposal(params.id, body, jwt)
      router.push(`/alliances/${params.id}/proposals/${id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed")
    } finally {
      setSubmitting(false)
    }
  }

  if (!isConnected || !isDrepRegistered) {
    return (
      <div className="page-container py-8">
        <div className="notice-warning text-sm">Connect your registered DRep wallet to create proposals.</div>
      </div>
    )
  }

  return (
    <div className="page-container py-8 max-w-2xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
        <Link href="/alliances" className="hover:text-text-secondary">Alliances</Link>
        <span>/</span>
        <Link href={`/alliances/${params.id}`} className="hover:text-text-secondary">Alliance</Link>
        <span>/</span>
        <span className="text-text-primary">{t("alliance.proposal.createBtn")}</span>
      </nav>

      <div className="card-static rounded-2xl p-6">
        <h1 className="text-xl font-bold text-text-primary mb-6">{t("alliance.proposal.createBtn")}</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* Type selector */}
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>{t("alliance.proposal.typeLabel")}</label>
            <div className="flex gap-3">
              {(["ga_stance", "withdrawal"] as ProposalType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setProposalType(type)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    proposalType === type
                      ? "border-accent bg-accent/10 text-accent-light"
                      : "border-border-subtle bg-bg-elevated text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {type === "ga_stance" ? t("alliance.proposal.typeGaStance") : t("alliance.proposal.typeWithdrawal")}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>{t("alliance.proposal.titleLabel")}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("alliance.proposal.titlePlaceholder")}
              className={INPUT}
              maxLength={255}
              required
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className={LABEL}>
              {t("alliance.proposal.descLabel")}
              <span className="ml-1.5 text-xs font-normal text-text-muted bg-bg-secondary px-1.5 py-0.5 rounded-md">Optional</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("alliance.proposal.descPlaceholder")}
              rows={4}
              className={INPUT + " resize-y min-h-[80px]"}
            />
          </div>

          {/* GA Stance fields */}
          {proposalType === "ga_stance" && (
            <div className="flex flex-col gap-1.5">
              <label className={LABEL}>{t("alliance.proposal.gaSearchLabel")}</label>
              {selectedGa ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 border border-accent/30">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {selectedGa.title ?? `${selectedGa.txHash.slice(0, 16)}…`}
                    </p>
                    <p className="text-xs text-text-muted font-mono mt-0.5">
                      {selectedGa.txHash.slice(0, 20)}…#{selectedGa.index}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedGa(null)}
                    className="text-xs text-text-muted hover:text-danger shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <input
                    type="text"
                    value={gaSearch}
                    onChange={(e) => setGaSearch(e.target.value)}
                    placeholder={t("alliance.proposal.gaSearchPlaceholder")}
                    className={INPUT}
                  />
                  {filteredGas.length > 0 && (
                    <div className="flex flex-col gap-0.5 max-h-52 overflow-y-auto rounded-xl border border-border-subtle bg-bg-card">
                      {filteredGas.map((ga) => (
                        <button
                          key={`${ga.txHash}-${ga.index}`}
                          type="button"
                          onClick={() => setSelectedGa({ txHash: ga.txHash, index: ga.index, title: ga.title })}
                          className="flex items-center justify-between px-3 py-2.5 text-left hover:bg-bg-card-hover transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm text-text-primary truncate">
                              {ga.title ?? ga.type}
                            </p>
                            <p className="text-xs text-text-muted font-mono">{ga.txHash.slice(0, 20)}…#{ga.index}</p>
                          </div>
                          <span className="ml-3 text-xs px-2 py-0.5 rounded-full bg-bg-card-hover text-text-muted shrink-0">
                            {ga.type}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Withdrawal fields */}
          {proposalType === "withdrawal" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>{t("alliance.proposal.amountLabel")}</label>
                <input
                  type="number"
                  min="1"
                  step="0.000001"
                  value={amountAda}
                  onChange={(e) => setAmountAda(e.target.value)}
                  placeholder="100"
                  className={INPUT}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>{t("alliance.proposal.recipientLabel")}</label>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="addr1..."
                  className={INPUT}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={LABEL}>
                  {t("alliance.proposal.recipientLabelField")}
                  <span className="ml-1.5 text-xs font-normal text-text-muted bg-bg-secondary px-1.5 py-0.5 rounded-md">Optional</span>
                </label>
                <input
                  type="text"
                  value={recipientLabel}
                  onChange={(e) => setRecipientLabel(e.target.value)}
                  placeholder="e.g. Development fund Q3"
                  className={INPUT}
                />
              </div>
            </>
          )}

          {error && <div className="notice-warning text-sm">{error}</div>}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary px-6 py-2.5 disabled:opacity-50"
            >
              {submitting ? t("alliance.proposal.submitting") : t("alliance.proposal.submit")}
            </button>
            <Link
              href={`/alliances/${params.id}`}
              className="px-6 py-2.5 rounded-xl text-sm text-text-muted hover:text-text-secondary border border-border-subtle hover:bg-bg-card-hover transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
