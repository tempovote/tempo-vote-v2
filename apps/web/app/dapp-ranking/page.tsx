"use client"

import { useState, useEffect } from "react"
import ProtocolTable, { type CardanoProtocol, type SortMode } from "@/components/dapp-ranking/ProtocolTable"
import { useT } from "@/i18n/useT"
import { DappRankingSchema } from "@tempo/types"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"

// ── Types ──────────────────────────────────────────────────────────────

interface ChartPoint { label: string; tvl: number }
type ChartUnit = "usd" | "ada"

// ── Cache ───────────────────────────────────────────────────────────────

const CACHE_TTL = 30 * 60 * 1000
interface CacheEntry<T> { data: T; ts: number }
const cache = new Map<string, CacheEntry<unknown>>()

function getCached<T>(key: string): T | null {
  const e = cache.get(key)
  return e && Date.now() - e.ts < CACHE_TTL ? (e.data as T) : null
}
function setCached<T>(key: string, data: T): void {
  cache.set(key, { data, ts: Date.now() })
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatTvlSummary(usd: number): string {
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`
  return `$${Math.round(usd).toLocaleString()}`
}

// ── Loading skeleton ─────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-border-subtle animate-pulse">
          <div className="w-6 h-3 bg-bg-card-hover rounded" />
          <div className="w-8 h-8 rounded-full bg-bg-card-hover shrink-0" />
          <div className="flex-1 h-3 bg-bg-card-hover rounded max-w-[160px]" />
          <div className="w-16 h-3 bg-bg-card-hover rounded" />
          <div className="ml-auto w-20 h-3 bg-bg-card-hover rounded" />
          <div className="w-14 h-3 bg-bg-card-hover rounded" />
          <div className="w-14 h-3 bg-bg-card-hover rounded" />
          <div className="w-18 h-3 bg-bg-card-hover rounded" />
          <div className="w-18 h-3 bg-bg-card-hover rounded" />
          <div className="w-18 h-3 bg-bg-card-hover rounded" />
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function DAppRankingPage() {
  const t = useT()
  const [protocols, setProtocols] = useState<CardanoProtocol[]>([])
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [totalTvl, setTotalTvl] = useState(0)
  const [change24h, setChange24h] = useState(0)
  const [sortMode, setSortMode] = useState<SortMode>("tvl")
  const [chartUnit, setChartUnit] = useState<ChartUnit>("usd")
  const [adaPrice, setAdaPrice] = useState(0)

  // Single fetch to our API — BE keeps a DB snapshot refreshed from DefiLlama every 2h,
  // so the browser no longer hits DefiLlama directly (heavy /protocols + flaky gateways).
  useEffect(() => {
    const key = "dapp-ranking-v1"
    const apply = (d: import("@tempo/types").DappRanking) => {
      setProtocols(d.protocols)
      setChartData(d.tvlHistory)
      setTotalTvl(d.totalTvl)
      setChange24h(d.change24h)
      setAdaPrice(d.adaPrice)
    }
    const cached = getCached<import("@tempo/types").DappRanking>(key)
    if (cached) { apply(cached); setLoading(false); return }

    fetch(`${API_URL}/dapp-ranking`)
      .then(r => (r.ok ? r.json() : null))
      .then(raw => {
        const parsed = DappRankingSchema.safeParse(raw)
        if (parsed.success) { setCached(key, parsed.data); apply(parsed.data) }
      })
      .catch(() => { /* leave empty state; UI shows skeleton → empty */ })
      .finally(() => setLoading(false))
  }, [])

  // Sort and take top 30
  const sorted = [...protocols]
    .sort((a, b) => {
      if (sortMode === "volume") return (b.volume24h ?? -Infinity) - (a.volume24h ?? -Infinity)
      return b.tvl - a.tvl
    })
    .slice(0, 30)
    .map((p, i) => ({ ...p, rank: i + 1 }))

  return (
    <div className="page-container space-y-8">

      {/* Header */}
      <h1 className="text-2xl font-bold animate-fade-in">{t("dappRanking.pageTitle")}</h1>

      {/* Notice */}
      <div className="notice animate-fade-in">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-accent-light shrink-0">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
          <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="16" r="1" fill="currentColor" />
        </svg>
        <span>
          {t("dappRanking.noticePrefix")}{" "}
          <a href="https://defillama.com/chain/Cardano" target="_blank" rel="noopener noreferrer"
            className="underline text-accent-light hover:text-accent transition-colors">
            DefiLlama
          </a>
          {" "}{t("dappRanking.noticeSuffix")}
        </span>
      </div>

      {/* Summary + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 animate-slide-up">

        <div className="card-static space-y-4">
          <div>
            <p className="text-xs text-text-muted mb-1">{t("dappRanking.totalTvlLabel")}</p>
            {loading ? (
              <div className="space-y-2">
                <div className="h-8 w-28 bg-bg-card-hover rounded animate-pulse" />
                <div className="h-3 w-16 bg-bg-card-hover rounded animate-pulse" />
              </div>
            ) : (
              <>
                <p className="text-3xl font-bold gradient-text">{formatTvlSummary(totalTvl)}</p>
                <span className={`text-xs font-medium ${change24h >= 0 ? "text-success" : "text-danger"}`}>
                  {change24h >= 0 ? "+" : ""}{change24h.toFixed(2)}% (24h)
                </span>
              </>
            )}
          </div>
          <div className="pt-2 border-t border-border-subtle text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">{t("dappRanking.showing")}</span>
              <span className="font-medium">{loading ? "—" : t("dappRanking.showingTop", { n: sorted.length })}</span>
            </div>
          </div>
          <a href="https://defillama.com/chain/Cardano" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent-light transition-colors pt-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            {t("dappRanking.viewOnDefiLlama")}
          </a>
        </div>

        <div className="card-static">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold">{t("dappRanking.chartTitle")}</h3>
            <div className="flex gap-1 bg-bg-secondary rounded-xl p-1">
              {(["usd", "ada"] as ChartUnit[]).map(u => (
                <button key={u} onClick={() => setChartUnit(u)}
                  disabled={u === "ada" && adaPrice === 0}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors uppercase ${
                    chartUnit === u
                      ? "bg-bg-card text-text-primary shadow-sm"
                      : "text-text-muted hover:text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                  }`}>
                  {u}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="h-48 bg-bg-card-hover rounded animate-pulse" />
          ) : chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-text-muted text-sm">
              {t("dappRanking.noChartData")}
            </div>
          ) : (() => {
            const isAda = chartUnit === "ada" && adaPrice > 0
            const displayData = isAda
              ? chartData.map(p => ({ ...p, tvl: p.tvl / adaPrice }))
              : chartData
            const sym = isAda ? "₳" : "$"
            return (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height={192}>
                  <AreaChart data={displayData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.45} />
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e2640" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false} tickLine={false} interval={14} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false}
                      tickFormatter={(v: number) => `${sym}${v.toFixed(0)}M`} width={60} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#141929", border: "1px solid #252d4a",
                        borderRadius: "8px", color: "#f1f5f9", fontSize: "12px" }}
                      formatter={(v: number) => [`${sym}${v.toFixed(2)}M`, "TVL"]}
                    />
                    <Area type="monotone" dataKey="tvl" stroke="#818cf8" strokeWidth={2.5}
                      fill="url(#tvlGradient)" dot={false} activeDot={{ r: 4, fill: "#818cf8" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Rankings */}
      <div className="animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold">
            {t("dappRanking.rankingsTitle")}
            {!loading && (
              <span className="ml-2 text-sm font-normal text-text-muted">{t("dappRanking.showingTop", { n: sorted.length })}</span>
            )}
          </h2>

          <div className="flex gap-1 bg-bg-secondary rounded-xl p-1">
            {([
              { key: "tvl" as SortMode, label: t("dappRanking.sortTvl") },
              { key: "volume" as SortMode, label: t("dappRanking.sortVolume") },
            ]).map(tab => (
              <button key={tab.key} onClick={() => setSortMode(tab.key)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  sortMode === tab.key
                    ? "bg-bg-card text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-secondary"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card-static !p-0 overflow-hidden animate-slide-up">
          {loading
            ? <TableSkeleton />
            : <ProtocolTable protocols={sorted} sortMode={sortMode} />
          }
        </div>
      </div>

    </div>
  )
}
