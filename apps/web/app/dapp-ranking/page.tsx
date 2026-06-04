"use client"

import { mockProtocols, mockTvlChartData } from "@/lib/mock-data"
import ProtocolTable from "@/components/dapp-ranking/ProtocolTable"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export default function DAppRankingPage() {
  return (
    <div className="page-container-wide space-y-8">
      {/* Header */}
      <h1 className="text-2xl font-bold animate-fade-in">DApp Ranking</h1>

      {/* Info notice */}
      <div className="notice animate-fade-in">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent-light shrink-0">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="16" r="1" fill="currentColor" />
        </svg>
        <span>
          There is a one-day delay in TVL updates, and it is calculated in ADA by default.
        </span>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-3 animate-fade-in">
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary font-medium">DApp</span>
          <select className="input w-48 text-sm">
            <option>130 Options</option>
          </select>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-text-secondary font-medium">TVL Type</span>
          <div className="flex rounded-lg overflow-hidden border border-border-default">
            <button className="px-3 py-1.5 text-xs font-medium bg-accent text-white">
              Exclude DApp Self Staking Token
            </button>
            <button className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary bg-bg-card transition-colors">
              Only ADA
            </button>
            <button className="px-3 py-1.5 text-xs font-medium text-text-muted hover:text-text-primary bg-bg-card transition-colors">
              All Tokens
            </button>
          </div>
        </div>
      </div>

      {/* Summary + Chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 animate-slide-up">
        {/* Summary card */}
        <div className="card-static space-y-3">
          <h3 className="text-sm text-text-secondary font-medium">Total Value Locked (ADA)</h3>
          <p className="text-4xl font-bold gradient-text">479M</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Active Wallet (24h)</span>
              <span className="font-medium">3.2K</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Tx Count (24h)</span>
              <span className="font-medium">57K</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Volume (24h)</span>
              <span className="font-medium">512M</span>
            </div>
          </div>
        </div>

        {/* TVL Chart */}
        <div className="card-static">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">TVL Daily</h3>
            <div className="flex rounded-lg overflow-hidden border border-border-default">
              <button className="px-3 py-1 text-xs font-medium bg-accent text-white">ADA</button>
              <button className="px-3 py-1 text-xs font-medium text-text-muted bg-bg-card">USD</button>
            </div>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockTvlChartData}>
                <defs>
                  <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#252d4a" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v}M`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#141929",
                    border: "1px solid #252d4a",
                    borderRadius: "8px",
                    color: "#f1f5f9",
                    fontSize: "13px",
                  }}
                  formatter={(value: number) => [`${value}M ADA`, "TVL"]}
                />
                <Area
                  type="monotone"
                  dataKey="tvl"
                  stroke="#6366f1"
                  strokeWidth={2}
                  fill="url(#tvlGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Protocol Rankings header */}
      <div className="flex flex-wrap items-center justify-between gap-4 animate-fade-in">
        <h2 className="text-xl font-bold">Protocol Rankings</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <input type="text" className="input w-28 text-xs" placeholder="04-May-26" readOnly />
            <span>→</span>
            <input type="text" className="input w-28 text-xs" placeholder="04-Jun-26" readOnly />
          </div>
          <div className="flex rounded-lg overflow-hidden border border-border-default">
            <button className="px-3 py-1 text-xs font-medium bg-accent text-white">ADA</button>
            <button className="px-3 py-1 text-xs font-medium text-text-muted bg-bg-card">USD</button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card-static !p-0 overflow-hidden animate-slide-up">
        <ProtocolTable protocols={mockProtocols} />
      </div>
    </div>
  )
}
