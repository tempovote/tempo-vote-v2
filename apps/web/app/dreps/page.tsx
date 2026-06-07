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
  // CIP-105 bech32 (drep1...) or raw 56-char hex credential
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
  const [inputValue, setInputValue] = useState("")

  const handleNavigateToId = useCallback(() => {
    const trimmed = inputValue.trim()
    if (trimmed) router.push(`/dreps/${encodeURIComponent(trimmed)}`)
  }, [inputValue, router])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && looksLikeDrepId(inputValue)) handleNavigateToId()
    },
    [inputValue, handleNavigateToId],
  )

  // Live filter: always derived from inputValue so results update as user types
  const q = inputValue.trim().toLowerCase()
  const isIdQuery = looksLikeDrepId(inputValue)
  // Name filter only applies when query doesn't look like an ID
  const nameQ = isIdQuery ? "" : q
  const filteredByDelegators = nameQ
    ? mockTopDRepsByDelegators.filter((d) => d.name.toLowerCase().includes(nameQ))
    : mockTopDRepsByDelegators
  const filteredByVotingPower = nameQ
    ? mockTopDRepsByVotingPower.filter((d) => d.name.toLowerCase().includes(nameQ))
    : mockTopDRepsByVotingPower
  const filteredByChange = nameQ
    ? mockTopDRepsByChange.filter((d) => d.name.toLowerCase().includes(nameQ))
    : mockTopDRepsByChange

  const hasNoResults =
    nameQ &&
    filteredByDelegators.length === 0 &&
    filteredByVotingPower.length === 0 &&
    filteredByChange.length === 0

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
        {hasNoResults ? (
          <div className="text-center py-12 text-text-muted space-y-2">
            <p className="text-3xl">🔍</p>
            <p className="font-medium">Không tìm thấy DRep nào khớp với &ldquo;{q}&rdquo;</p>
            <button
              className="text-sm text-accent-light underline"
              onClick={() => setInputValue("")}
            >
              Xoá tìm kiếm
            </button>
          </div>
        ) : (
          <>
            {filteredByDelegators.length > 0 && (
              <DRepList
                title="Top DReps with the most delegators"
                dreps={filteredByDelegators}
              />
            )}
            {filteredByVotingPower.length > 0 && (
              <DRepList
                title="Top DReps with the largest voting power"
                dreps={filteredByVotingPower}
              />
            )}
            {filteredByChange.length > 0 && (
              <DRepList
                title="Top DReps with the largest voting power change"
                dreps={filteredByChange}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
