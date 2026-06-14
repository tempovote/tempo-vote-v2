"use client"

import { use, useState, useRef, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { marked } from "marked"
import { useWalletStore } from "@/store/wallet"
import { useWallet } from "@/hooks/useWallet"
import { usePollDetail, usePollComments } from "@/hooks/useCommunity"
import { useDRepProfile } from "@/hooks/useDRepProfile"
import { authHeader, getJwt } from "@/lib/api"
import { resolveAnchorUrl } from "@/lib/governance"
import { useT } from "@/i18n/useT"
import type { TFunc } from "@/i18n/useT"
import type { PollOptionWithCount, PollComment } from "@tempo/types"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string, t: TFunc): string {
  const ms = Date.now() - new Date(iso).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return t("community.poll.justNow")
  const m = Math.floor(s / 60)
  if (m < 60) return t("community.poll.minutesAgo", { m })
  const h = Math.floor(m / 60)
  if (h < 24) return t("community.poll.hoursAgo", { h })
  const d = Math.floor(h / 24)
  return t("community.poll.daysAgo", { d })
}

function timeLabel(status: string, endsAt: string, startsAt: string, t: TFunc): string {
  if (status === "pending") {
    const ms = new Date(startsAt).getTime() - Date.now()
    if (ms <= 0) return t("community.poll.startingSoon")
    const d = Math.floor(ms / 86400000)
    const h = Math.floor((ms % 86400000) / 3600000)
    return d > 0 ? t("community.poll.startsIn", { d, h }) : t("community.poll.startsInHours", { h })
  }
  if (status === "closed") {
    const d = Math.floor((Date.now() - new Date(endsAt).getTime()) / 86400000)
    return t("community.poll.endedDaysAgo", { d })
  }
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return t("community.poll.ending")
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  return d > 0 ? t("community.poll.endsIn", { d, h }) : t("community.poll.endsInHours", { h })
}

function shortAddress(addr: string): string {
  if (addr.length <= 20) return addr
  return `${addr.slice(0, 10)}…${addr.slice(-8)}`
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    active:  { cls: "bg-success/15 text-success border-success/30", label: "Active" },
    closed:  { cls: "bg-bg-elevated text-text-muted border-border-default", label: "Closed" },
    pending: { cls: "bg-accent/15 text-accent border-accent/30", label: "Pending" },
  }
  const { cls, label } = cfg[status] ?? cfg["pending"]!
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  )
}

// ─── Vote option button ───────────────────────────────────────────────────────

function OptionButton({
  option,
  total,
  selected,
  hasVoted,
  isActive,
  isConnected,
  onClick,
}: {
  option: PollOptionWithCount
  total: number
  selected: boolean
  hasVoted: boolean
  isActive: boolean
  isConnected: boolean
  onClick: () => void
}) {
  const t = useT()
  const pct = total > 0 ? Math.round((option.voteCount / total) * 100) : 0
  const showResults = hasVoted || !isActive

  const colorMap: Record<string, string> = {
    Yes: "bg-success/20 border-success/40",
    No: "bg-danger/20 border-danger/40",
    Abstain: "bg-text-muted/15 border-border-default",
  }
  const barColorMap: Record<string, string> = {
    Yes: "bg-success/50",
    No: "bg-danger/50",
    Abstain: "bg-text-muted/30",
  }

  const isVotable = isActive && isConnected && !hasVoted

  return (
    <button
      onClick={isVotable ? onClick : undefined}
      disabled={!isVotable}
      className={[
        "relative w-full rounded-xl border px-4 py-3 text-left transition-all overflow-hidden",
        isVotable
          ? "hover:border-accent/50 hover:bg-accent/5 cursor-pointer"
          : "cursor-default",
        selected
          ? (colorMap[option.text] ?? "bg-accent/15 border-accent/50")
          : "border-border-subtle bg-bg-elevated",
      ].join(" ")}
    >
      {showResults && total > 0 && (
        <div
          className={`absolute inset-y-0 left-0 rounded-xl transition-all duration-500 ${barColorMap[option.text] ?? "bg-accent/20"}`}
          style={{ width: `${pct}%` }}
        />
      )}

      <div className="relative flex items-center justify-between gap-3">
        <span className="font-semibold text-sm text-text-primary">{option.text}</span>
        {showResults && (
          <span className="text-xs text-text-muted shrink-0">
            {t("community.poll.voteCountDisplay", { count: option.voteCount, pct })}
          </span>
        )}
        {selected && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 text-success">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    </button>
  )
}

// ─── Voting section ───────────────────────────────────────────────────────────

function VotingSection({
  pollId,
  options,
  totalVotes,
  userVote,
  status,
  stakeAddress,
  isConnected,
  reauthenticate,
  onVoted,
}: {
  pollId: string
  options: PollOptionWithCount[]
  totalVotes: number
  userVote: string | null
  status: string
  stakeAddress: string | null | undefined
  isConnected: boolean
  reauthenticate: () => Promise<string | null>
  onVoted: () => void
}) {
  const t = useT()
  const [pending, setPending] = useState<string | null>(null)
  const [voteError, setVoteError] = useState<string | null>(null)

  const hasVoted = !!userVote
  const isActive = status === "active"

  async function castVote(optionId: string) {
    if (!stakeAddress || hasVoted || !isActive) return
    setPending(optionId)
    setVoteError(null)
    try {
      let jwt = getJwt()
      if (!jwt) jwt = await reauthenticate()
      if (!jwt) throw new Error(t("community.poll.authError"))
      const doVote = (token: string) =>
        fetch(`${API_URL}/communities/polls/${pollId}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader(token) },
          body: JSON.stringify({ optionId }),
        })
      let res = await doVote(jwt)
      if (res.status === 401) {
        const newJwt = await reauthenticate()
        if (!newJwt) throw new Error(t("community.poll.authFailed"))
        res = await doVote(newJwt)
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error ?? t("community.poll.voteFailed"))
      }
      onVoted()
    } catch (err: unknown) {
      setVoteError(err instanceof Error ? err.message : t("community.poll.unknownError"))
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span>{t("community.poll.voteCount", { count: totalVotes })}</span>
        {hasVoted && <span className="text-success font-medium">{t("community.poll.alreadyVoted")}</span>}
        {!isConnected && isActive && <span>{t("community.poll.connectToVote")}</span>}
        {isConnected && !isActive && status === "closed" && <span>{t("community.poll.pollEnded")}</span>}
        {isConnected && !isActive && status === "pending" && <span>{t("community.poll.pollPending")}</span>}
      </div>

      <div className="space-y-2">
        {options.map((opt) => (
          <OptionButton
            key={opt.id}
            option={opt}
            total={totalVotes}
            selected={userVote === opt.id}
            hasVoted={hasVoted}
            isActive={isActive}
            isConnected={isConnected}
            onClick={() => { void castVote(opt.id) }}
          />
        ))}
      </div>

      {pending && (
        <p className="text-xs text-text-muted text-center animate-pulse">{t("community.poll.voting")}</p>
      )}
      {voteError && (
        <p className="text-xs text-danger text-center">{voteError}</p>
      )}
    </div>
  )
}

// ─── Comment helpers ──────────────────────────────────────────────────────────

function hashToColors(str: string): [string, string] {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  const hue1 = (h >>> 0) % 360
  const hue2 = (hue1 + 137) % 360
  return [`hsl(${hue1},65%,55%)`, `hsl(${hue2},65%,45%)`]
}

function DRepCommentAvatar({ drepId, drepName, network }: {
  drepId: string
  drepName: string | null | undefined
  network: string
}) {
  const { profile } = useDRepProfile(drepId, network)
  const [imgError, setImgError] = useState(false)
  const [c1, c2] = hashToColors(drepId)
  const initial = (drepName ?? drepId).charAt(0).toUpperCase()

  if (profile?.imageUrl && !imgError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.imageUrl}
        alt={drepName ?? drepId}
        className="w-8 h-8 rounded-full object-cover shrink-0"
        onError={() => setImgError(true)}
      />
    )
  }
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 select-none"
      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
    >
      {initial}
    </div>
  )
}

// ─── Comment item ─────────────────────────────────────────────────────────────

function CommentItem({ comment, network, myStakeAddress, pollId, onDeleted }: {
  comment: PollComment
  network: string
  myStakeAddress: string | null | undefined
  pollId: string
  onDeleted: () => void
}) {
  const t = useT()
  const { reauthenticate } = useWallet()
  const [deleting, setDeleting] = useState(false)
  const isDRep = !!comment.drepId
  const isOwn = !!myStakeAddress && comment.stakeAddress === myStakeAddress
  const networkParam = network !== "mainnet" ? `?network=${network}` : ""

  const [c1, c2] = hashToColors(comment.stakeAddress)
  const stakeInitial = comment.stakeAddress.slice(-2).toUpperCase()

  async function handleDelete() {
    if (deleting) return
    setDeleting(true)
    try {
      let jwt = getJwt()
      if (!jwt) jwt = await reauthenticate()
      if (!jwt) return
      const res = await fetch(`${API_URL}/communities/polls/${pollId}/comments/${comment.id}`, {
        method: "DELETE",
        headers: authHeader(jwt),
      })
      if (res.status === 401) {
        const newJwt = await reauthenticate()
        if (!newJwt) return
        await fetch(`${API_URL}/communities/polls/${pollId}/comments/${comment.id}`, {
          method: "DELETE",
          headers: authHeader(newJwt),
        })
      }
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  const avatar = isDRep ? (
    <Link href={`/dreps/${comment.drepId}${networkParam}`}>
      <DRepCommentAvatar drepId={comment.drepId!} drepName={comment.drepName} network={network} />
    </Link>
  ) : (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white select-none"
      style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
    >
      {stakeInitial}
    </div>
  )

  const nameEl = isDRep ? (
    <Link
      href={`/dreps/${comment.drepId}${networkParam}`}
      className="text-xs font-medium text-accent-light hover:underline"
    >
      {comment.drepName ?? `${comment.drepId!.slice(0, 12)}…${comment.drepId!.slice(-6)}`}
    </Link>
  ) : (
    <span className="font-mono text-xs text-text-muted">{shortAddress(comment.stakeAddress)}</span>
  )

  return (
    <div className="flex gap-3 py-4 border-b border-border-subtle last:border-0 group">
      {avatar}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          {nameEl}
          <span className="text-xs text-text-muted">·</span>
          <span className="text-xs text-text-muted">{relativeTime(comment.createdAt, t)}</span>
          {isOwn && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 text-text-muted hover:text-danger disabled:opacity-30"
              title={t("community.poll.deleteComment")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">{comment.content}</p>
      </div>
    </div>
  )
}

// ─── GA type list ─────────────────────────────────────────────────────────────

const GA_TYPES = [
  { value: "infoAction",               label: "Info Action",               desc: "Advisory proposal, non-binding" },
  { value: "treasuryWithdrawals",      label: "Treasury Withdrawals",      desc: "Withdraw ADA from Cardano treasury" },
  { value: "protocolParametersUpdate", label: "Protocol Parameter Change", desc: "Change protocol parameters" },
  { value: "hardForkInitiation",       label: "Hard Fork Initiation",      desc: "Upgrade protocol version" },
  { value: "noConfidence",             label: "No Confidence",             desc: "No confidence in Constitutional Committee" },
  { value: "updateCommittee",          label: "Update Committee",          desc: "Add/remove CC members" },
  { value: "newConstitution",          label: "New Constitution",          desc: "Change Cardano Constitution" },
]

// ─── Propose Action dropdown ──────────────────────────────────────────────────

function ProposeDropdown({ pollId, network }: { pollId: string; network: string }) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const np = network !== "mainnet" ? `&network=${network}` : ""

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border-default text-text-secondary hover:border-accent/50 hover:text-accent-light transition-colors"
      >
        Propose Action
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-64 bg-bg-card border border-border-default rounded-xl shadow-2xl overflow-hidden animate-fade-in">
          <p className="px-3 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider border-b border-border-subtle">
            {t("community.proposeDropdownTitle")}
          </p>
          {GA_TYPES.map((gt) => (
            <button
              key={gt.value}
              type="button"
              onClick={() => {
                setOpen(false)
                router.push(`/governance-actions/new?source=${pollId}&type=${gt.value}${np}`)
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-bg-elevated transition-colors border-b border-border-subtle last:border-0"
            >
              <p className="text-sm font-medium text-text-primary leading-tight">{gt.label}</p>
              <p className="text-[11px] text-text-muted mt-0.5 leading-tight">{gt.desc}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function MarkdownBody({ value }: { value: string }) {
  const html = marked.parse(value, { async: false }) as string
  return (
    // eslint-disable-next-line react/no-danger
    <div
      className="text-sm text-text-secondary leading-relaxed markdown-preview"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PollDetailPage({
  params,
}: {
  params: Promise<{ drepId: string; pollId: string }>
}) {
  const t = useT()
  const { drepId, pollId } = use(params)
  const network = useWalletStore((s) => s.selectedNetwork)
  const connectedDrepId = useWalletStore((s) => s.drepKey?.dRepIDCip105 ?? null)
  const { isConnected, rewardAddress: stakeAddress, reauthenticate } = useWallet()
  const commentRef = useRef<HTMLDivElement>(null)

  const { poll, isLoading: pollLoading, error: pollError, refetch: refetchPoll } = usePollDetail(pollId, stakeAddress)
  const { comments, total: commentTotal, isLoading: commentsLoading, error: commentsError, refetch: refetchComments } = usePollComments(pollId)

  const [content, setContent] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const networkParam = network !== "mainnet" ? `?network=${network}` : ""

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#comment") {
      commentRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [])

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim() || !stakeAddress) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      let jwt = getJwt()
      if (!jwt) jwt = await reauthenticate()
      if (!jwt) throw new Error(t("community.poll.commentAuthError"))
      const doPost = (token: string) =>
        fetch(`${API_URL}/communities/polls/${pollId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader(token) },
          body: JSON.stringify({ content: content.trim(), ...(connectedDrepId ? { drepId: connectedDrepId } : {}) }),
        })
      let res = await doPost(jwt)
      if (res.status === 401) {
        const newJwt = await reauthenticate()
        if (!newJwt) throw new Error(t("community.poll.commentAuthFailed"))
        res = await doPost(newJwt)
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as Record<string, string>).error ?? t("community.poll.commentFailed"))
      }
      setContent("")
      refetchComments()
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : t("community.poll.commentUnknownError"))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (pollLoading) {
    return (
      <div className="page-container space-y-6 animate-pulse">
        <div className="h-5 w-32 bg-bg-elevated rounded" />
        <div className="card-static space-y-4">
          <div className="h-7 w-3/4 bg-bg-elevated rounded" />
          <div className="h-4 w-24 bg-bg-elevated rounded" />
          <div className="h-3 w-full bg-bg-elevated rounded" />
          <div className="h-3 w-5/6 bg-bg-elevated rounded" />
          <div className="space-y-2 pt-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-bg-elevated rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  if (pollError || !poll) {
    return (
      <div className="page-container">
        <Link href={`/dreps/${drepId}/community${networkParam}`} className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors mb-6">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
          DRep Community
        </Link>
        <div className="notice-warning rounded-xl p-8 text-center">
          <p className="font-semibold">{t("community.poll.notFound")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container space-y-6 animate-fade-in">

      <Link
        href={`/dreps/${drepId}/community${networkParam}`}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        DRep Community
      </Link>

      {/* Poll card */}
      <div className="card-static space-y-5">

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={poll.status} />
            <span className="text-xs text-text-muted">{timeLabel(poll.status, poll.endsAt, poll.startsAt, t)}</span>
            <div className="ml-auto">
              <ProposeDropdown pollId={poll.id} network={network} />
            </div>
          </div>
          <h1 className="text-xl font-bold text-text-primary leading-snug">{poll.title}</h1>
        </div>

        {/* Cover image */}
        {poll.imageUrl && resolveAnchorUrl(poll.imageUrl) && (
          <div className="rounded-xl overflow-hidden border border-border-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolveAnchorUrl(poll.imageUrl)!}
              alt="Poll cover"
              className="w-full max-h-72 object-cover"
            />
          </div>
        )}

        {poll.abstract && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t("community.poll.sectionAbstract")}</h3>
            <MarkdownBody value={poll.abstract} />
          </div>
        )}

        {poll.motivation && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t("community.poll.sectionMotivation")}</h3>
            <MarkdownBody value={poll.motivation} />
          </div>
        )}

        {poll.rationale && (
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t("community.poll.sectionRationale")}</h3>
            <MarkdownBody value={poll.rationale} />
          </div>
        )}

        {poll.supportLinks && poll.supportLinks.length > 0 && (
          <div className="space-y-1.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{t("community.poll.sectionReferences")}</h3>
            <ul className="space-y-1">
              {poll.supportLinks.map((link, i) => (
                <li key={i}>
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-accent-light hover:underline break-all"
                  >
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <hr className="border-border-subtle" />

        <VotingSection
          pollId={pollId}
          options={poll.options}
          totalVotes={poll.totalVotes}
          userVote={poll.userVote}
          status={poll.status}
          stakeAddress={stakeAddress}
          isConnected={isConnected}
          reauthenticate={reauthenticate}
          onVoted={refetchPoll}
        />
      </div>

      {/* Comments */}
      <div id="comment" ref={commentRef} className="card-static space-y-0 !p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-border-subtle">
          <h2 className="text-base font-bold">
            {t("community.poll.discussion")}
            {commentTotal > 0 && <span className="ml-2 text-sm font-normal text-text-muted">({commentTotal})</span>}
          </h2>
        </div>

        {/* Comment form */}
        {isConnected && stakeAddress ? (
          <form onSubmit={handleComment} className="px-5 py-4 border-b border-border-subtle space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("community.poll.commentPlaceholder")}
              rows={3}
              className="w-full bg-bg-elevated border border-border-subtle rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none focus:border-accent/50 transition-colors resize-none"
            />
            {submitError && <p className="text-xs text-danger">{submitError}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !content.trim()}
                className="btn-primary text-sm px-5"
              >
                {submitting ? t("community.poll.submittingComment") : t("community.poll.sendCommentBtn")}
              </button>
            </div>
          </form>
        ) : (
          <div className="px-5 py-4 border-b border-border-subtle text-center text-sm text-text-muted">
            {t("community.poll.connectToComment")}
          </div>
        )}

        {commentsLoading && (
          <div className="divide-y divide-border-subtle px-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3 py-4 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-bg-elevated shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 w-32 bg-bg-elevated rounded" />
                  <div className="h-3 w-full bg-bg-elevated rounded" />
                  <div className="h-3 w-4/5 bg-bg-elevated rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!commentsLoading && commentsError && (
          <div className="px-5 py-8 text-center text-sm text-text-muted">{t("community.poll.commentLoadError")}</div>
        )}

        {!commentsLoading && !commentsError && comments.length === 0 && (
          <div className="px-5 py-10 text-center space-y-2">
            <p className="text-3xl">💬</p>
            <p className="text-sm text-text-muted">{t("community.poll.noComments")}</p>
          </div>
        )}

        {!commentsLoading && !commentsError && comments.length > 0 && (
          <div className="px-5 divide-y divide-border-subtle">
            {comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                network={network}
                myStakeAddress={stakeAddress}
                pollId={pollId}
                onDeleted={refetchComments}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
