"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useDRepList } from "@/hooks/useDRepList"
import { useAnchorTitlesMap } from "@/hooks/useAnchorTitle"
import { useDRepLeaderboard } from "@/hooks/useDRepLeaderboard"
import { useDRepWhaleLeaders } from "@/hooks/useDRepWhaleLeaders"
import { useDRepVpChange } from "@/hooks/useDRepVpChange"
import { lovelaceToAda } from "@/lib/governance"
import DRepAvatar from "@/components/drep/DRepAvatar"
import CopyableId from "@/components/ui/CopyableId"

function looksLikeDrepId(q: string): boolean {
  const t = q.trim()
  return t.toLowerCase().startsWith("drep1") || /^[0-9a-f]{56}$/i.test(t)
}

function DRepCell({ entry }: {
  entry: { id: string; credHex: string; name?: string | null; imageUrl?: string | null }
}) {
  return (
    <Link href={`/dreps/${encodeURIComponent(entry.id)}`} className="flex items-center gap-2.5 hover:text-accent-light transition-colors group">
      <DRepAvatar name={entry.name ?? null} imageUrl={entry.imageUrl ?? null} credHex={entry.credHex} size="sm" />
      <div className="min-w-0">
        {entry.name && <div className="font-medium text-xs truncate group-hover:text-accent-light leading-tight">{entry.name}</div>}
        <CopyableId id={entry.id} />
      </div>
    </Link>
  )
}

function VpDeltaCell({ entry }: { entry: { delta: number; pctChange: number } }) {
  const gain = entry.delta >= 0
  return (
    <div className="text-right">
      <div className={`font-bold tabular-nums ${gain ? "text-green-400" : "text-red-400"}`}>
        {gain ? "+" : ""}{entry.pctChange.toFixed(2)}%
      </div>
      <div className={`text-xs tabular-nums ${gain ? "text-green-500/70" : "text-red-500/70"}`}>
        {gain ? "+" : ""}{lovelaceToAda(Math.abs(entry.delta))} ₳
      </div>
    </div>
  )
}

function SkeletonRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-border-subtle">
      {[...Array(cols)].map((_, i) => (
        <td key={i} className="py-3 px-4">
          <div className="h-4 rounded bg-bg-card-hover animate-pulse" style={{ width: i === 1 ? "60%" : "40%" }} />
        </td>
      ))}
    </tr>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const styles: Record<number, string> = {
    1: "bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30",
    2: "bg-slate-400/15 text-slate-300 ring-1 ring-slate-400/30",
    3: "bg-amber-700/15 text-amber-500 ring-1 ring-amber-600/30",
  }
  const cls = styles[rank] ?? "text-text-muted"
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold tabular-nums ${cls}`}>
      {rank}
    </span>
  )
}

export default function DRepsPage() {
  const router = useRouter()
  const network = useWalletStore((s) => s.selectedNetwork)
  const [inputValue, setInputValue] = useState("")

  const q = inputValue.trim().toLowerCase()
  const isIdQuery = looksLikeDrepId(inputValue)
  const nameQ = isIdQuery ? "" : q

  type LeaderboardTab = "delegators" | "whales" | "vp" | "vpChange"
  const [activeTab, setActiveTab] = useState<LeaderboardTab>("delegators")

  const { dreps, isLoading: isDrepsLoading } = useDRepList(network)
  const { entries: leaderboard,  loading: leaderboardLoading  } = useDRepLeaderboard(network, 20, "delegators")
  const { entries: byVp,         loading: byVpLoading         } = useDRepLeaderboard(network, 20, "votingPower")
  const { entries: whaleLeaders, loading: whaleLoading        } = useDRepWhaleLeaders(network, 20)
  const { entries: vpChangers,   loading: vpChangeLoading     } = useDRepVpChange(network, 20)

  // Only fetch anchor titles for the search list — leaderboard name/imageUrl come from the API.
  const anchorUrlsForSearch = nameQ.length >= 2 ? dreps.map((d) => d.anchorUrl) : []
  const namesMap = useAnchorTitlesMap(anchorUrlsForSearch)

  const searchResults = nameQ
    ? dreps.filter((d) => {
        const name = d.anchorUrl ? (namesMap.get(d.anchorUrl) ?? "") : ""
        return (
          d.id.toLowerCase().includes(nameQ) ||
          d.credHex.toLowerCase().includes(nameQ) ||
          name.toLowerCase().includes(nameQ)
        )
      })
    : []

  const handleNavigateToId = useCallback(() => {
    const trimmed = inputValue.trim()
    if (trimmed) router.push(`/dreps/${encodeURIComponent(trimmed)}`)
  }, [inputValue, router])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && isIdQuery) handleNavigateToId()
    },
    [isIdQuery, handleNavigateToId],
  )

  const anchorWithUrl = anchorUrlsForSearch.filter(Boolean).length
  const namesLoaded = namesMap.size
  const namesStillLoading = nameQ && namesLoaded < anchorWithUrl

  return (
    <div className="page-container-wide space-y-10">
      <h1 className="text-2xl font-bold animate-fade-in">DReps</h1>

      {/* Search */}
      <div className="space-y-4 animate-fade-in">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, drep1… or 56-char credential hex"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="input pl-10"
            />
          </div>
          <button className="btn-primary px-6" onClick={isIdQuery ? handleNavigateToId : undefined}>
            {isIdQuery ? "Go to Profile" : "Search"}
          </button>
        </div>

        {isIdQuery && (
          <Link
            href={`/dreps/${encodeURIComponent(inputValue.trim())}`}
            className="flex items-center gap-2 text-sm text-accent-light hover:underline"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            View profile for {inputValue.trim().slice(0, 20)}{inputValue.trim().length > 20 ? "…" : ""}
          </Link>
        )}
      </div>

      {/* Search results or leaderboards */}
      <div className="space-y-10">
        {nameQ ? (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold">Kết quả tìm kiếm</h3>
              {isDrepsLoading && (
                <span className="text-xs text-text-muted">Đang tải danh sách...</span>
              )}
              {namesStillLoading && !isDrepsLoading && (
                <span className="text-xs text-text-muted">
                  Đang tải tên ({namesLoaded}/{anchorWithUrl})...
                </span>
              )}
            </div>

            {!isDrepsLoading && searchResults.length === 0 ? (
              <div className="text-center py-10 text-text-muted space-y-2">
                <p className="text-3xl">🔍</p>
                <p className="font-medium">
                  Không tìm thấy DRep phù hợp với &ldquo;{q}&rdquo;
                </p>
                {namesStillLoading && (
                  <p className="text-xs">Tên DRep đang tải — thử lại sau vài giây</p>
                )}
                <button
                  className="text-sm text-accent-light underline"
                  onClick={() => setInputValue("")}
                >
                  Xoá tìm kiếm
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.slice(0, 30).map((drep) => {
                  const name = drep.anchorUrl ? (namesMap.get(drep.anchorUrl) ?? null) : null
                  return (
                    <Link
                      key={drep.id}
                      href={`/dreps/${encodeURIComponent(drep.id)}`}
                      className="block"
                    >
                      <div className="card flex items-center gap-4 !py-3 !px-4 hover:border-border-default transition-colors cursor-pointer">
                        <DRepAvatar
                          name={name ?? null}
                          imageUrl={null}
                          credHex={drep.credHex}
                        />
                        <div className="flex-1 min-w-0">
                          {name ? (
                            <div className="font-medium text-sm truncate">{name}</div>
                          ) : (
                            <div className="text-xs text-text-muted italic">
                              {drep.anchorUrl ? "Đang tải tên..." : "Không có tên"}
                            </div>
                          )}
                          <CopyableId id={drep.id} />
                        </div>
                        <div className="text-xs text-text-secondary shrink-0">
                          {lovelaceToAda(drep.votingPower)} ₳
                        </div>
                      </div>
                    </Link>
                  )
                })}
                {searchResults.length > 30 && (
                  <p className="text-xs text-center text-text-muted py-2">
                    Còn {searchResults.length - 30} DRep khác — nhập thêm để thu hẹp kết quả
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Leaderboards — tab-based, full-width, 20 results */
          <div className="space-y-4 animate-slide-up">

            {/* Pill tab bar — same pattern as VoteHistoryTab */}
            <div className="flex gap-1 bg-bg-secondary rounded-xl p-1 overflow-x-auto">
              {([
                { id: "delegators", label: "Delegators" },
                { id: "whales",     label: "Whale Delegators" },
                { id: "vp",         label: "Voting Power" },
                { id: "vpChange",   label: "VP Change" },
              ] as { id: LeaderboardTab; label: string }[]).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === t.id
                      ? "bg-bg-card text-text-primary shadow-sm"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {t.label}
                  {t.id === "whales" && (
                    <span className="ml-1.5 text-xs text-text-muted">&gt;1M ₳</span>
                  )}
                  {t.id === "vpChange" && (
                    <span className={`ml-1.5 text-xs ${activeTab === t.id ? "text-accent" : "text-text-muted"}`}>epoch Δ</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="card-static !p-0 overflow-hidden">
              <table className="w-full text-sm">

                {/* ── Delegators ── */}
                {activeTab === "delegators" && (<>
                  <thead><tr className="border-b border-border-default text-text-muted text-left text-xs">
                    <th className="py-2.5 px-4 font-medium w-10">#</th>
                    <th className="py-2.5 px-4 font-medium">DRep</th>
                    <th className="py-2.5 px-4 font-medium text-right">Delegators</th>
                    <th className="py-2.5 px-4 font-medium text-right hidden sm:table-cell">Active VP</th>
                    <th className="py-2.5 px-4 font-medium text-right hidden md:table-cell">Influence</th>
                  </tr></thead>
                  <tbody>
                    {leaderboardLoading
                      ? [...Array(10)].map((_, i) => <SkeletonRow key={i} cols={5} />)
                      : leaderboard.map((entry, i) => (
                          <tr key={entry.id} className={`border-b border-border-subtle hover:bg-bg-card-hover transition-colors ${i === 0 ? "bg-yellow-500/5" : ""}`}>
                            <td className="py-3 px-4"><RankBadge rank={i + 1} /></td>
                            <td className="py-3 px-4"><DRepCell entry={entry} /></td>
                            <td className="py-3 px-4 text-right"><span className="font-bold text-accent-light tabular-nums">{entry.delegatorCount.toLocaleString()}</span></td>
                            <td className="py-3 px-4 text-right text-text-muted text-xs hidden sm:table-cell">{lovelaceToAda(entry.activeVotingPower)} ₳</td>
                            <td className="py-3 px-4 text-right text-text-muted text-xs hidden md:table-cell">{entry.influencePower.toFixed(2)}%</td>
                          </tr>
                        ))}
                  </tbody>
                </>)}

                {/* ── Whale Delegators ── */}
                {activeTab === "whales" && (<>
                  <thead><tr className="border-b border-border-default text-text-muted text-left text-xs">
                    <th className="py-2.5 px-4 font-medium w-10">#</th>
                    <th className="py-2.5 px-4 font-medium">DRep</th>
                    <th className="py-2.5 px-4 font-medium text-right">Whales</th>
                    <th className="py-2.5 px-4 font-medium text-right hidden sm:table-cell">Total Delegators</th>
                    <th className="py-2.5 px-4 font-medium text-right hidden md:table-cell">Active VP</th>
                  </tr></thead>
                  <tbody>
                    {whaleLoading
                      ? [...Array(10)].map((_, i) => <SkeletonRow key={i} cols={5} />)
                      : whaleLeaders.length === 0
                        ? <tr><td colSpan={5} className="py-12 text-center text-text-muted text-sm">Whale data is being indexed — check back in a few minutes</td></tr>
                        : whaleLeaders.map((entry, i) => (
                            <tr key={entry.id} className={`border-b border-border-subtle hover:bg-bg-card-hover transition-colors ${i === 0 ? "bg-yellow-500/5" : ""}`}>
                              <td className="py-3 px-4"><RankBadge rank={i + 1} /></td>
                              <td className="py-3 px-4"><DRepCell entry={entry} /></td>
                              <td className="py-3 px-4 text-right"><span className="font-bold text-accent-light tabular-nums">{entry.whaleCount.toLocaleString()}</span></td>
                              <td className="py-3 px-4 text-right text-text-muted text-xs hidden sm:table-cell">{entry.delegatorCount.toLocaleString()}</td>
                              <td className="py-3 px-4 text-right text-text-muted text-xs hidden md:table-cell">{lovelaceToAda(entry.activeVotingPower)} ₳</td>
                            </tr>
                          ))}
                  </tbody>
                </>)}

                {/* ── Voting Power ── */}
                {activeTab === "vp" && (<>
                  <thead><tr className="border-b border-border-default text-text-muted text-left text-xs">
                    <th className="py-2.5 px-4 font-medium w-10">#</th>
                    <th className="py-2.5 px-4 font-medium">DRep</th>
                    <th className="py-2.5 px-4 font-medium text-right">Active VP</th>
                    <th className="py-2.5 px-4 font-medium text-right hidden sm:table-cell">Influence</th>
                    <th className="py-2.5 px-4 font-medium text-right hidden md:table-cell">Delegators</th>
                  </tr></thead>
                  <tbody>
                    {byVpLoading
                      ? [...Array(10)].map((_, i) => <SkeletonRow key={i} cols={5} />)
                      : byVp.map((entry, i) => (
                          <tr key={entry.id} className={`border-b border-border-subtle hover:bg-bg-card-hover transition-colors ${i === 0 ? "bg-yellow-500/5" : ""}`}>
                            <td className="py-3 px-4"><RankBadge rank={i + 1} /></td>
                            <td className="py-3 px-4"><DRepCell entry={entry} /></td>
                            <td className="py-3 px-4 text-right"><span className="font-bold text-accent-light tabular-nums">{lovelaceToAda(entry.activeVotingPower)} ₳</span></td>
                            <td className="py-3 px-4 text-right text-text-muted text-xs hidden sm:table-cell">{entry.influencePower.toFixed(2)}%</td>
                            <td className="py-3 px-4 text-right text-text-muted text-xs hidden md:table-cell">{entry.delegatorCount.toLocaleString()}</td>
                          </tr>
                        ))}
                  </tbody>
                </>)}

                {/* ── VP Change ── */}
                {activeTab === "vpChange" && (<>
                  <thead><tr className="border-b border-border-default text-text-muted text-left text-xs">
                    <th className="py-2.5 px-4 font-medium w-10">#</th>
                    <th className="py-2.5 px-4 font-medium">DRep</th>
                    <th className="py-2.5 px-4 font-medium text-right">Change</th>
                    <th className="py-2.5 px-4 font-medium text-right hidden sm:table-cell">Current VP</th>
                    <th className="py-2.5 px-4 font-medium text-right hidden md:table-cell">Prev VP</th>
                  </tr></thead>
                  <tbody>
                    {vpChangeLoading
                      ? [...Array(10)].map((_, i) => <SkeletonRow key={i} cols={5} />)
                      : vpChangers.length === 0
                        ? <tr><td colSpan={5} className="py-12 text-center text-text-muted text-sm">Collecting epoch snapshots — data available after the next epoch boundary</td></tr>
                        : vpChangers.map((entry, i) => (
                            <tr key={entry.id} className={`border-b border-border-subtle hover:bg-bg-card-hover transition-colors ${i === 0 ? "bg-yellow-500/5" : ""}`}>
                              <td className="py-3 px-4"><RankBadge rank={i + 1} /></td>
                              <td className="py-3 px-4"><DRepCell entry={entry} /></td>
                              <td className="py-3 px-4"><VpDeltaCell entry={entry} /></td>
                              <td className="py-3 px-4 text-right text-text-muted text-xs hidden sm:table-cell">{lovelaceToAda(entry.currentVp)} ₳</td>
                              <td className="py-3 px-4 text-right text-text-muted text-xs hidden md:table-cell">{lovelaceToAda(entry.prevVp)} ₳</td>
                            </tr>
                          ))}
                  </tbody>
                </>)}

              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
