"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  mockRegions,
  mockTopDRepsByDelegators,
  mockTopDRepsByVotingPower,
  mockTopDRepsByChange,
} from "@/lib/mock-data"
import DRepList from "@/components/drep/DRepList"
import { useWalletStore } from "@/store/wallet"
import { useDRepList } from "@/hooks/useDRepList"
import { useAnchorTitlesMap } from "@/hooks/useAnchorTitle"
import { lovelaceToAda } from "@/lib/governance"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts"

function looksLikeDrepId(q: string): boolean {
  const t = q.trim()
  return t.toLowerCase().startsWith("drep1") || /^[0-9a-f]{56}$/i.test(t)
}

const votingPowerPieData = mockRegions.map((r) => ({
  name: r.name,
  value: r.votingPowerPercent,
  color: r.color,
}))

const ccMembersPieData = mockRegions
  .filter((r) => r.ccMembers > 0)
  .map((r) => ({
    name: r.name,
    value: r.ccMembersPercent,
    color: r.color,
  }))

export default function DRepsPage() {
  const router = useRouter()
  const network = useWalletStore((s) => s.selectedNetwork)
  const [inputValue, setInputValue] = useState("")

  const q = inputValue.trim().toLowerCase()
  const isIdQuery = looksLikeDrepId(inputValue)
  const nameQ = isIdQuery ? "" : q

  // Real DRep list — fetch once per network, ready when user starts searching
  const { dreps, isLoading: isDrepsLoading } = useDRepList(network)

  // Batch-fetch DRep names from IPFS anchors only while user is name-searching.
  // Lazy-load top 150 by voting power (already sorted desc) to avoid IPFS overload.
  const anchorUrlsForSearch = nameQ ? dreps.slice(0, 150).map((d) => d.anchorUrl) : []
  const namesMap = useAnchorTitlesMap(anchorUrlsForSearch)

  // Filter real DReps by ID fragment or by loaded name
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

  // Count how many anchor URLs still need name resolution
  const anchorWithUrl = anchorUrlsForSearch.filter(Boolean).length
  const namesLoaded = namesMap.size
  const namesStillLoading = nameQ && namesLoaded < anchorWithUrl

  return (
    <div className="page-container-wide space-y-10">
      {/* Header */}
      <h1 className="text-2xl font-bold animate-fade-in">DReps</h1>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-slide-up">
        {/* Voting Power by Region */}
        <div className="card-static">
          <h3 className="text-sm font-semibold text-center mb-4">
            DRep Voting Power by Region
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={votingPowerPieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  dataKey="value"
                  strokeWidth={2}
                  stroke="#0a0e1a"
                >
                  {votingPowerPieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#141929",
                    border: "1px solid #252d4a",
                    borderRadius: "8px",
                    color: "#f1f5f9",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`${value}%`, "Share"]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CC Members by Region */}
        <div className="card-static">
          <h3 className="text-sm font-semibold text-center mb-4">
            CC Members by Region ⓘ
          </h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ccMembersPieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={40}
                  dataKey="value"
                  strokeWidth={2}
                  stroke="#0a0e1a"
                >
                  {ccMembersPieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#141929",
                    border: "1px solid #252d4a",
                    borderRadius: "8px",
                    color: "#f1f5f9",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`${value}%`, "Share"]}
                />
                <Legend
                  wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Region table */}
      <div className="card-static !p-0 overflow-hidden animate-slide-up">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default text-text-muted text-left">
                <th className="py-3 px-4 font-medium">Region</th>
                <th className="py-3 px-4 font-medium text-right">Voting Power</th>
                <th className="py-3 px-4 font-medium text-right">CC Members</th>
                <th className="py-3 px-4 font-medium text-right">DRep Count</th>
              </tr>
            </thead>
            <tbody>
              {mockRegions.map((region) => (
                <tr
                  key={region.name}
                  className="border-b border-border-subtle hover:bg-bg-card-hover transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: region.color }}
                      />
                      {region.name}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-text-secondary">
                    {region.votingPower}
                  </td>
                  <td className="py-3 px-4 text-right text-text-secondary">
                    {region.ccMembers} ({region.ccMembersPercent}%)
                  </td>
                  <td className="py-3 px-4 text-right text-text-secondary">
                    {region.drepCount} ({region.drepCountPercent}%)
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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

        {/* ID shortcut — show profile link as soon as query looks like a DRep ID */}
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

      {/* DRep Lists */}
      <div className="space-y-10">
        {nameQ ? (
          /* Real search results from on-chain data */
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
                  const name = drep.anchorUrl
                    ? (namesMap.get(drep.anchorUrl) ?? null)
                    : null
                  const initial = (name ?? drep.id).slice(4, 5).toUpperCase() || "D"
                  return (
                    <Link
                      key={drep.id}
                      href={`/dreps/${encodeURIComponent(drep.id)}`}
                      className="block"
                    >
                      <div className="card flex items-center gap-4 !py-3 !px-4 hover:border-border-default transition-colors cursor-pointer">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
                          style={{ background: "linear-gradient(135deg, #6366f1, #a855f7)" }}
                        >
                          {initial}
                        </div>
                        <div className="flex-1 min-w-0">
                          {name ? (
                            <div className="font-medium text-sm truncate">{name}</div>
                          ) : (
                            <div className="text-xs text-text-muted italic">
                              {drep.anchorUrl ? "Đang tải tên..." : "Không có tên"}
                            </div>
                          )}
                          <div className="text-xs text-text-muted font-mono truncate">
                            {drep.id}
                          </div>
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
          /* Mock top-lists when not searching */
          <>
            <DRepList
              title="Top DReps with the most delegators"
              dreps={mockTopDRepsByDelegators}
            />
            <DRepList
              title="Top DReps with the largest voting power"
              dreps={mockTopDRepsByVotingPower}
            />
            <DRepList
              title="Top DReps with the largest voting power change"
              dreps={mockTopDRepsByChange}
            />
          </>
        )}
      </div>
    </div>
  )
}
