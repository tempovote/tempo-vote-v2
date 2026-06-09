"use client"

import { useState } from "react"
import type { VoteEntry } from "@tempo/types"
import { credentialHexToDrepId, lovelaceToAda } from "@/lib/governance"

type RoleTab = "drep" | "cc" | "spo"

const ROLE_LABELS: Record<RoleTab, string> = { drep: "DRep", cc: "CC", spo: "SPO" }

const VOTE_ORDER = { yes: 0, no: 1, abstain: 2 }

function voteBadge(vote: string) {
  if (vote === "yes")     return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-success/15 text-success border border-success/30">YES</span>
  if (vote === "no")      return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-danger/15 text-danger border border-danger/30">NO</span>
  return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-bg-elevated text-text-secondary border border-border-default">ABSTAIN</span>
}

function CopyableId({ id, role }: { id: string; role: RoleTab }) {
  const [copied, setCopied] = useState(false)

  const display = role === "drep"
    ? credentialHexToDrepId(id)
    : id

  const truncated = display.length > 24
    ? `${display.slice(0, 12)}…${display.slice(-8)}`
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
      className="font-mono text-xs text-text-secondary hover:text-text-primary transition-colors text-left"
    >
      {truncated}
      {copied && <span className="ml-1 text-success text-[10px]">✓</span>}
    </button>
  )
}

export function VoteHistoryTab({ votes }: { votes: VoteEntry[] }) {
  const [role, setRole] = useState<RoleTab>("drep")

  const counts: Record<RoleTab, number> = {
    drep: votes.filter((v) => v.role === "drep").length,
    cc:   votes.filter((v) => v.role === "cc").length,
    spo:  votes.filter((v) => v.role === "spo").length,
  }

  const filtered = votes
    .filter((v) => v.role === role)
    .sort((a, b) => {
      const vo = (VOTE_ORDER[a.vote as keyof typeof VOTE_ORDER] ?? 3) - (VOTE_ORDER[b.vote as keyof typeof VOTE_ORDER] ?? 3)
      if (vo !== 0) return vo
      return b.votingPower - a.votingPower
    })

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

      {/* Vote list */}
      {filtered.length === 0 ? (
        <p className="text-sm text-text-muted py-4 text-center">
          Chưa có phiếu nào từ {ROLE_LABELS[role]}
        </p>
      ) : (
        <div className="divide-y divide-border-subtle">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 py-2 text-xs text-text-muted font-medium px-1">
            <span>ID</span>
            <span className="text-right">Voting Power</span>
            <span className="text-right w-16">Phiếu</span>
          </div>
          {/* Rows */}
          {filtered.map((v, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-4 items-center py-2.5 px-1">
              <CopyableId id={v.id} role={role} />
              <span className="text-xs text-text-muted text-right tabular-nums">
                {v.votingPower > 0 ? `${lovelaceToAda(v.votingPower)} ₳` : "—"}
              </span>
              <div className="flex justify-end w-16">
                {voteBadge(v.vote)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
