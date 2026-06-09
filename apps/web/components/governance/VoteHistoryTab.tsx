"use client"

import { useState } from "react"
import type { VoteEntry } from "@tempo/types"
import { credentialHexToDrepId, lovelaceToAda } from "@/lib/governance"

type RoleTab = "drep" | "cc" | "spo"

const ROLE_LABELS: Record<RoleTab, string> = { drep: "DRep", cc: "CC", spo: "SPO" }

function CopyableId({ id, role }: { id: string; role: RoleTab }) {
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
      className="font-mono text-xs text-text-secondary hover:text-text-primary transition-colors text-left truncate max-w-full"
    >
      {truncated}
      {copied && <span className="ml-1 text-success text-[10px]">✓</span>}
    </button>
  )
}

function VoteTable({
  votes,
  role,
  side,
}: {
  votes: VoteEntry[]
  role: RoleTab
  side: "yes" | "no-abstain"
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
        <div className="divide-y divide-border-subtle">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto] gap-2 pb-1.5 text-[11px] text-text-muted font-medium">
            <span>ID</span>
            <span className="text-right">VP / Vote</span>
          </div>
          {/* Rows */}
          {filtered.map((v, i) => {
            const isNo      = v.vote === "no"
            const isAbstain = v.vote === "abstain"
            const voteCls   = isNo      ? "text-danger"
                            : isAbstain ? "text-text-muted"
                            : "text-success"
            const voteLabel = isNo ? "NO" : isAbstain ? "ABS" : "YES"

            return (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-center py-2">
                <CopyableId id={v.id} role={role} />
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
          <VoteTable votes={roleVotes} role={role} side="yes" />
          <div className="w-px bg-border-subtle shrink-0" />
          <VoteTable votes={roleVotes} role={role} side="no-abstain" />
        </div>
      )}
    </div>
  )
}
