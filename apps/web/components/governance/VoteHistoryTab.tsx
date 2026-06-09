"use client"

import { useState } from "react"
import type { VoteEntry } from "@tempo/types"
import { credentialHexToDrepId, lovelaceToAda } from "@/lib/governance"
import { useAnchorTitlesMap } from "@/hooks/useAnchorTitle"
import { useRationale } from "@/hooks/useRationale"
import type { RationaleContent } from "@/hooks/useRationale"
import { marked } from "marked"

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

// ── Rationale modal ─────────────────────────────────────────────────────────

function RationaleModal({
  rationaleUrl,
  voterName,
  vote,
  onClose,
}: {
  rationaleUrl: string
  voterName?: string
  vote: string
  onClose: () => void
}) {
  const { state, load } = useRationale(rationaleUrl)

  // kick off fetch when modal mounts
  if (state.status === "idle") load()

  const voteCls = vote === "yes" ? "text-success" : vote === "no" ? "text-danger" : "text-text-muted"
  const voteLabel = vote === "yes" ? "YES" : vote === "no" ? "NO" : "ABSTAIN"

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      <div
        className="relative z-10 bg-bg-card border border-border-subtle rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-border-subtle shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className={`text-xs font-bold ${voteCls}`}>{voteLabel}</span>
              <span className="text-xs text-text-muted">·</span>
              <span className="text-xs text-text-muted">Rationale</span>
            </div>
            {voterName && (
              <p className="text-sm font-medium text-text-primary truncate">{voterName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* body */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4 scrollbar-thin">
          {state.status === "loading" && (
            <div className="space-y-2.5">
              <div className="h-3 w-3/4 rounded bg-bg-elevated animate-pulse" />
              <div className="h-3 w-full rounded bg-bg-elevated animate-pulse" />
              <div className="h-3 w-5/6 rounded bg-bg-elevated animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-bg-elevated animate-pulse" />
            </div>
          )}

          {state.status === "error" && (
            <p className="text-sm text-text-muted text-center py-4">
              Không tải được nội dung rationale.{" "}
              <a
                href={rationaleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline"
              >
                Mở trực tiếp
              </a>
            </p>
          )}

          {state.status === "done" && (
            <RationaleBody content={state.content} rationaleUrl={rationaleUrl} />
          )}
        </div>
      </div>
    </div>
  )
}

function MarkdownSection({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">{label}</h4>
      <div
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: marked.parse(text, { async: false }) as string }}
        className="prose-metadata text-sm text-text-secondary leading-relaxed"
      />
    </div>
  )
}

function RationaleBody({ content, rationaleUrl }: { content: RationaleContent; rationaleUrl: string }) {
  const hasContent =
    content.title || content.comment ||
    content.summary || content.rationaleStatement

  if (!hasContent) {
    return (
      <p className="text-sm text-text-muted text-center py-4">
        Không có nội dung text.{" "}
        <a
          href={rationaleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline"
        >
          Xem tài liệu gốc
        </a>
      </p>
    )
  }

  return (
    <>
      {/* CIP-100 title */}
      {content.title && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">Tiêu đề</h4>
          <p className="text-sm text-text-primary">{content.title}</p>
        </div>
      )}

      {/* CIP-136 summary (short statement) */}
      {content.summary && (
        <div className="bg-bg-primary rounded-lg px-3 py-2 border border-border">
          <p className="text-sm text-text-primary font-medium">{content.summary}</p>
        </div>
      )}

      {/* CIP-100 comment */}
      {content.comment && (
        <MarkdownSection label={content.title ? "Nội dung" : ""} text={content.comment} />
      )}

      {/* CIP-136 main rationale text */}
      {content.rationaleStatement && (
        <MarkdownSection label="Lý luận" text={content.rationaleStatement} />
      )}

      {/* CIP-136 optional sections */}
      {content.precedentDiscussion && (
        <MarkdownSection label="Tiền lệ" text={content.precedentDiscussion} />
      )}
      {content.counterargumentDiscussion && (
        <MarkdownSection label="Phản biện" text={content.counterargumentDiscussion} />
      )}
      {content.conclusion && (
        <MarkdownSection label="Kết luận" text={content.conclusion} />
      )}

      {/* CIP-136 internal CC vote breakdown */}
      {content.internalVote && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Phiếu nội bộ</h4>
          <div className="flex flex-wrap gap-3 text-xs">
            {content.internalVote.constitutional != null && (
              <span className="px-2 py-1 rounded bg-vote-bar-yes/20 text-vote-bar-yes font-medium">
                Hợp hiến: {content.internalVote.constitutional}
              </span>
            )}
            {content.internalVote.unconstitutional != null && (
              <span className="px-2 py-1 rounded bg-vote-bar-no/20 text-vote-bar-no font-medium">
                Bất hợp hiến: {content.internalVote.unconstitutional}
              </span>
            )}
            {content.internalVote.abstain != null && (
              <span className="px-2 py-1 rounded bg-bg-primary text-text-muted font-medium border border-border">
                Kiêng: {content.internalVote.abstain}
              </span>
            )}
            {content.internalVote.didNotVote != null && (
              <span className="px-2 py-1 rounded bg-bg-primary text-text-muted font-medium border border-border">
                Không bỏ phiếu: {content.internalVote.didNotVote}
              </span>
            )}
          </div>
        </div>
      )}

      {content.references && content.references.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Tài liệu tham chiếu</h4>
          <ul className="space-y-1">
            {content.references.map((ref, i) => (
              <li key={i} className="text-xs">
                {ref.uri ? (
                  <a
                    href={ref.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline break-all"
                  >
                    {ref.label ?? ref.uri}
                  </a>
                ) : (
                  <span className="text-text-secondary">{ref.label}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

// ── Vote row ─────────────────────────────────────────────────────────────────

function RationaleButton({
  rationaleUrl,
  vote,
  voterName,
}: {
  rationaleUrl: string
  vote: string
  voterName?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Xem Rationale"
        className="shrink-0 text-text-muted hover:text-accent transition-colors"
      >
        {/* chat bubble icon */}
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      {open && (
        <RationaleModal
          rationaleUrl={rationaleUrl}
          voterName={voterName}
          vote={vote}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

// ── Vote table ────────────────────────────────────────────────────────────────

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

  const emptyLabel = side === "yes" ? "Không có YES" : "Không có NO / ABSTAIN"

  return (
    <div className="flex-1 min-w-0">
      {/* Column header */}
      {side === "yes" ? (
        <div className="text-xs font-semibold mb-2 text-success/70">
          YES · {filtered.length}
        </div>
      ) : (
        <div className="text-xs font-semibold mb-2 flex items-center gap-2">
          <span className="text-danger/70">
            NO · {votes.filter((v) => v.vote === "no").length}
          </span>
          <span className="text-text-muted/40">|</span>
          <span className="text-text-muted/70">
            ABSTAIN · {votes.filter((v) => v.vote === "abstain").length}
          </span>
        </div>
      )}

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

            // Server-side voterName (bypasses CORS) takes priority;
            // fall back to browser-fetched name for CORS-friendly hosts.
            const resolvedName = role === "cc"
              ? (v.memberName ?? undefined)
              : role === "spo"
                ? (v.poolName ?? undefined)
                : (v.voterName ?? (v.anchorUrl ? namesMap.get(v.anchorUrl) : undefined))
            const nameLoading  = role === "drep" && v.anchorUrl && !v.voterName && resolvedName === undefined

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
                  {v.rationaleUrl && (
                    <RationaleButton
                      rationaleUrl={v.rationaleUrl}
                      vote={v.vote}
                      voterName={resolvedName}
                    />
                  )}
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

  // Browser-fetch names for DReps without a server-side voterName (CORS-friendly hosts resolve fine)
  const drepAnchorUrls = votes
    .filter((v) => v.role === "drep" && v.anchorUrl && !v.voterName)
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
