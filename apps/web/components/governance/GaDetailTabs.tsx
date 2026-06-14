"use client"

import { useState } from "react"
import type { GovernanceAction } from "@tempo/types"
import { VoteHistoryTab } from "./VoteHistoryTab"
import { GaMetadataTab } from "./GaMetadataTab"
import { useT } from "@/i18n/useT"

type Tab = "votes" | "metadata"

export function GaDetailTabs({ action }: { action: GovernanceAction }) {
  const t = useT()
  const hasMetadata = Boolean(action.anchorUrl)
  const [tab, setTab] = useState<Tab>("votes")

  const TABS: { id: Tab; label: string; show: boolean }[] = [
    { id: "votes",    label: t("governance.tabs.votes"),    show: true },
    { id: "metadata", label: t("governance.tabs.metadata"), show: hasMetadata },
  ]

  const visibleTabs = TABS.filter((t) => t.show)

  return (
    <div className="card-static space-y-4 animate-fade-in">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border-subtle -mx-5 px-5">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-accent text-text-primary"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "votes" && (
        <VoteHistoryTab votes={action.votes} />
      )}
      {tab === "metadata" && action.anchorUrl && (
        <GaMetadataTab anchorUrl={action.anchorUrl} />
      )}
    </div>
  )
}
