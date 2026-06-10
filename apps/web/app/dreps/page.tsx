"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useWalletStore } from "@/store/wallet"
import { useDRepList } from "@/hooks/useDRepList"
import { useAnchorTitlesMap } from "@/hooks/useAnchorTitle"
import { useDRepLeaderboard } from "@/hooks/useDRepLeaderboard"
import { useDRepWhaleLeaders } from "@/hooks/useDRepWhaleLeaders"
import { lovelaceToAda } from "@/lib/governance"
import DRepAvatar from "@/components/drep/DRepAvatar"
import CopyableId from "@/components/ui/CopyableId"

function looksLikeDrepId(q: string): boolean {
  const t = q.trim()
  return t.toLowerCase().startsWith("drep1") || /^[0-9a-f]{56}$/i.test(t)
}

function SkeletonRow() {
  return (
    <tr className="border-b border-border-subtle">
      {[...Array(5)].map((_, i) => (
        <td key={i} className="py-3 px-4">
          <div className="h-4 rounded bg-bg-card-hover animate-pulse" style={{ width: i === 1 ? "60%" : "40%" }} />
        </td>
      ))}
    </tr>
  )
}

export default function DRepsPage() {
  const router = useRouter()
  const network = useWalletStore((s) => s.selectedNetwork)
  const [inputValue, setInputValue] = useState("")

  const q = inputValue.trim().toLowerCase()
  const isIdQuery = looksLikeDrepId(inputValue)
  const nameQ = isIdQuery ? "" : q

  const { dreps, isLoading: isDrepsLoading } = useDRepList(network)
  const { entries: leaderboard, loading: leaderboardLoading } = useDRepLeaderboard(network, 5)
  const { entries: whaleLeaders, loading: whaleLoading } = useDRepWhaleLeaders(network, 5)

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

      {/* Explore DRep search */}
      <div className="space-y-4 animate-fade-in">
        <h2 className="text-xl font-bold">Explore DRep</h2>
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
          /* Leaderboards when not searching */
          <>
          <div className="space-y-4 animate-slide-up">
            <h2 className="text-xl font-bold">Top 5 DReps with the most delegators</h2>
            <div className="card-static !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default text-text-muted text-left">
                      <th className="py-3 px-4 font-medium w-8">#</th>
                      <th className="py-3 px-4 font-medium">DRep</th>
                      <th className="py-3 px-4 font-medium text-right">Delegators</th>
                      <th className="py-3 px-4 font-medium text-right">Active VP</th>
                      <th className="py-3 px-4 font-medium text-right">Influence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboardLoading
                      ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                      : leaderboard.map((entry, i) => {
                          return (
                            <tr
                              key={entry.id}
                              className="border-b border-border-subtle hover:bg-bg-card-hover transition-colors"
                            >
                              <td className="py-3 px-4 text-text-muted text-xs font-mono">{i + 1}</td>
                              <td className="py-3 px-4">
                                <Link
                                  href={`/dreps/${encodeURIComponent(entry.id)}`}
                                  className="flex items-center gap-3 hover:text-accent-light transition-colors group"
                                >
                                  <DRepAvatar
                                    name={entry.name}
                                    imageUrl={entry.imageUrl}
                                    credHex={entry.credHex}
                                    size="sm"
                                  />
                                  <div className="min-w-0">
                                    {entry.name && (
                                      <div className="font-medium text-sm truncate group-hover:text-accent-light">
                                        {entry.name}
                                      </div>
                                    )}
                                    <CopyableId id={entry.id} />
                                  </div>
                                </Link>
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-accent-light">
                                {entry.delegatorCount.toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-right text-text-secondary">
                                {lovelaceToAda(entry.activeVotingPower)} ₳
                              </td>
                              <td className="py-3 px-4 text-right text-text-secondary">
                                {entry.influencePower.toFixed(2)}%
                              </td>
                            </tr>
                          )
                        })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Whale delegator leaderboard */}
          <div className="space-y-4 animate-slide-up">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold">Top 5 DReps with the most whale delegators</h2>
              <span className="text-xs text-text-muted bg-bg-card px-2 py-0.5 rounded-full border border-border-subtle">
                &gt;1M ₳
              </span>
            </div>
            <div className="card-static !p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border-default text-text-muted text-left">
                      <th className="py-3 px-4 font-medium w-8">#</th>
                      <th className="py-3 px-4 font-medium">DRep</th>
                      <th className="py-3 px-4 font-medium text-right">Whales</th>
                      <th className="py-3 px-4 font-medium text-right">Total Delegators</th>
                      <th className="py-3 px-4 font-medium text-right">Active VP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whaleLoading
                      ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                      : whaleLeaders.length === 0
                        ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-text-muted text-sm">
                              <div>No whale data available</div>
                              <div className="text-xs mt-1 opacity-60">Requires <code className="font-mono bg-bg-card px-1 rounded">KOIOS_API_KEY</code> on the API server</div>
                            </td>
                          </tr>
                        )
                        : whaleLeaders.map((entry, i) => (
                          <tr
                            key={entry.id}
                            className="border-b border-border-subtle hover:bg-bg-card-hover transition-colors"
                          >
                            <td className="py-3 px-4 text-text-muted text-xs font-mono">{i + 1}</td>
                            <td className="py-3 px-4">
                              <Link
                                href={`/dreps/${encodeURIComponent(entry.id)}`}
                                className="flex items-center gap-3 hover:text-accent-light transition-colors group"
                              >
                                <DRepAvatar
                                  name={entry.name}
                                  imageUrl={entry.imageUrl}
                                  credHex={entry.credHex}
                                  size="sm"
                                />
                                <div className="min-w-0">
                                  {entry.name && (
                                    <div className="font-medium text-sm truncate group-hover:text-accent-light">
                                      {entry.name}
                                    </div>
                                  )}
                                  <CopyableId id={entry.id} />
                                </div>
                              </Link>
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-accent-light">
                              {entry.whaleCount.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right text-text-secondary">
                              {entry.delegatorCount.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right text-text-secondary">
                              {lovelaceToAda(entry.activeVotingPower)} ₳
                            </td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          </>
        )}
      </div>
    </div>
  )
}
