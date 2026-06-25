"use client"

import Link from "next/link"
import { useT } from "@/i18n/useT"

interface Props {
  txHash: string
  drepName: string
  networkId: number | null
  successMessage?: string
  selfDelegated?: boolean
}

export default function RegisterDRepSuccess({
  txHash,
  drepName,
  networkId,
  successMessage,
  selfDelegated = false,
}: Props) {
  const t = useT()
  const message = successMessage ?? t("drepWizard.successDefaultMsg")

  const explorerBase =
    networkId === 1
      ? "https://cardanoscan.io/transaction"
      : "https://preprod.cardanoscan.io/transaction"

  const explorerUrl = `${explorerBase}/${txHash}`
  const short = `${txHash.slice(0, 12)}...${txHash.slice(-8)}`

  return (
    <div className="text-center space-y-6 py-4">
      {/* Icon */}
      <div className="mx-auto w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
        <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <div>
        <h2 className="text-xl font-bold text-text-primary">{message}</h2>
        <p className="text-text-secondary text-sm mt-1">
          <span className="text-accent font-semibold">{drepName}</span>{" "}
          {t("drepWizard.successSubmitted")}
        </p>
        {selfDelegated && (
          <p className="text-text-muted text-xs mt-1">
            {t("drepWizard.successSelfDelegatedNote")}
          </p>
        )}
      </div>

      {/* TX Hash */}
      <div className="card-static text-left space-y-1">
        <p className="text-text-muted text-xs font-medium">Transaction Hash</p>
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-sm text-accent hover:text-accent-light break-all transition-colors"
        >
          {short}
        </a>
      </div>

      {/* Notice */}
      <div className="notice flex-col gap-2 text-left">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
          </svg>
          <p className="font-semibold text-sm text-text-primary">{t("drepWizard.successWaitTitle")}</p>
        </div>
        <p className="text-text-secondary text-xs leading-relaxed">
          {t("drepWizard.successWaitDesc")}
        </p>
        {selfDelegated && (
          <p className="text-text-secondary text-xs leading-relaxed">
            {t("drepWizard.successVpNote")}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline flex-1 text-center"
        >
          {t("drepWizard.successViewCardanoscan")}
        </a>
        <Link href="/dreps" className="btn-primary flex-1 text-center">
          {t("drepWizard.successDrepListBtn")}
        </Link>
      </div>
    </div>
  )
}
