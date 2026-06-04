"use client"

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
              placeholder="Search by name or ID"
              className="input pl-10"
            />
          </div>
          <button className="btn-primary px-6">Search</button>
        </div>
      </div>

      {/* DRep Lists */}
      <div className="space-y-10">
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
      </div>
    </div>
  )
}
