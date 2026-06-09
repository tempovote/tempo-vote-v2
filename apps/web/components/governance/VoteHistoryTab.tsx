"use client"

import { useState } from "react"
import type { VoteEntry } from "@tempo/types"
import { credentialHexToDrepId, lovelaceToAda } from "@/lib/governance"
import { useAnchorTitlesMap } from "@/hooks/useAnchorTitle"

type RoleTab = "drep" | "cc" | "spo"

const ROLE_LABELS: Record<RoleTab, string> = { drep: "DRep", cc: "CC", spo: "SPO" }

function CopyableId({ id, role, name }: { id: string; role: RoleTab; name?: string }) {
  const [copied, setCopied] = useState(false)

  const display = role === "drep" ? credentialHexToDrepId(id) : id
  const truncated = display.length > 20
    ? `${display.slice(0, 10)}…${display.slice(-7)}`
    : display

  function copy() {
    navigator.clipboard.writeText(display).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      onClick={copy}
      title={display}
      className="text-left min-w-0 flex flex-col gap-0.5"
    >
      {name && (
        <span className="text-xs font-medium text-text-primary truncate leading-tight">
          {name}
        </span>
      )}
      <span className="font-mono text-[11px] text-text-muted hover:text-text-secondary transition-colors truncate leading-tight">
        {truncated}
        {copied && <span className="ml-1 text-success text-[10px]">✓</span>}
      </span>
    </button>
  )
}

function VoteTable({
  votes,
  role,
  side,
  namesMap,
}: {
  votes: VoteEntry[]
  role: RoleTab
  side: "yes" | "no-abstain"
  namesMap: ReadonlyMap<string, string>
}) {
  const filtered = votes
    .filter((v) => side === "yes" ? v.vote === "yes" : v.vote === "no" || v.vote === "abstain")
    .sort((a, b) => b.votingPower - a.votingPower)

  const headerCls = side === "yes"
    ? "text-success/70"
    : "text-danger/70"

  const emptyLabel = side === "yes" ? "Không có YES" : "Không có NO / ABSTAIN"

  return (
    <div className="flex-1 min-w-0">
      {/* Column header */}
      <div className={`text-xs font-semibold mb-2 ${headerCls}`}>
        {side === "yes"
          ? `YES · ${filtered.length}`
          : `NO + ABSTAIN · ${filtered.length}`}
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-text-muted py-3 text-center">{emptyLabel}</p>
      ) : (
        <div>
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto] gap-2 pb-1.5 text-[11px] text-text-muted font-medium">
            <span>ID</span>
            <span className="text-right">VP / Vote</span>
          </div>
          {/* Scrollable rows — max ~50 visible */}
          <div className="overflow-y-auto max-h-[500px] divide-y divide-border-subtle pr-1 scrollbar-thin">
          {filtered.map((v, i) => {
            const isNo      = v.vote === "no"
            const isAbstain = v.vote === "abstain"
            const voteCls   = isNo      ? "text-danger"
                            : isAbstain ? "text-text-muted"
                            : "text-success"
            const voteLabel = isNo ? "NO" : isAbstain ? "ABS" : "YES"

            const resolvedName = v.anchorUrl ? namesMap.get(v.anchorUrl) : undefined
            const nameLoading  = role === "drep" && v.anchorUrl && resolvedName === undefined

            return (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-start py-2">
                {nameLoading ? (
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="h-2.5 w-24 rounded bg-bg-elevated animate-pulse" />
                    <CopyableId id={v.id} role={role} />
                  </div>
                ) : (
                  <CopyableId id={v.id} role={role} name={resolvedName} />
                )}
                <div className="flex items-center gap-1.5 justify-end shrink-0">
                  {v.votingPower > 0 && (
                    <span className="text-[11px] text-text-muted tabular-nums">
                      {lovelaceToAda(v.votingPower)}₳
                    </span>
                  )}
                  <span className={`text-[11px] font-bold ${voteCls} w-7 text-right`}>
                    {voteLabel}
                  </span>
                </div>
              </div>
            )
          })}
          </div>
        </div>
      )}
    </div>
  )
}

export function VoteHistoryTab({ votes }: { votes: VoteEntry[] }) {
  const [role, setRole] = useState<RoleTab>("drep")

  const counts: Record<RoleTab, number> = {
    drep: votes.filter((v) => v.role === "drep").length,
    cc:   votes.filter((v) => v.role === "cc").length,
    spo:  votes.filter((v) => v.role === "spo").length,
  }

  const roleVotes = votes.filter((v) => v.role === role)

  // Batch-resolve DRep names from CIP-119 anchor documents
  const drepAnchorUrls = votes
    .filter((v) => v.role === "drep" && v.anchorUrl)
    .map((v) => v.anchorUrl!)
  const namesMap = useAnchorTitlesMap(drepAnchorUrls)

  return (
    <div className="space-y-4">
      {/* Role sub-tabs */}
      <div className="flex gap-1 bg-bg-secondary rounded-xl p-1 w-fit">
        {(["drep", "cc", "spo"] as RoleTab[]).map((r) => (
          <button
            key={r}
            onClick={() => setRole(r)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              role === r
                ? "bg-bg-card text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {ROLE_LABELS[r]}
            <span className={`ml-1.5 text-xs ${role === r ? "text-accent" : "text-text-muted"}`}>
              {counts[r]}
            </span>
          </button>
        ))}
      </div>

      {/* Two-column vote tables */}
      {roleVotes.length === 0 ? (
        <p className="text-sm text-text-muted py-4 text-center">
          Chưa có phiếu nào từ {ROLE_LABELS[role]}
        </p>
      ) : (
        <div className="flex gap-5">
          <VoteTable votes={roleVotes} role={role} side="yes" namesMap={namesMap} />
          <div className="w-px bg-border-subtle shrink-0" />
          <VoteTable votes={roleVotes} role={role} side="no-abstain" namesMap={namesMap} />
        </div>
      )}
    </div>
  )
}
