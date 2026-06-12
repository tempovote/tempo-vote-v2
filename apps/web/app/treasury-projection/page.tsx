"use client"

import { useState, useMemo } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from "recharts"

// Cardano protocol parameters
const RHO          = 0.003
const TAU          = 0.2
const EPOCH_DAYS   = 5
const EPOCHS_PER_YEAR = 365.25 / EPOCH_DAYS   // ≈ 73.05

// Approximate mainnet state as of 2026 (ADA)
const INITIAL_RESERVES = 6_500_000_000
const INITIAL_TREASURY = 1_600_000_000

const TX_FEE_MIN   = 31_000
const TX_FEE_MAX   = 2_000_000
const WITHDRAW_MAX = 1_000_000_000

interface DataPoint { year: number; reserves: number; treasury: number }

function simulate(txFeePerEpoch: number, withdrawPerYear: number) {
  const withdrawPerEpoch = withdrawPerYear / EPOCHS_PER_YEAR
  let reserves = INITIAL_RESERVES
  let treasury = INITIAL_TREASURY
  let runOutYear: number | null = null

  const data: DataPoint[] = []
  let current  = new Date()
  let prevYear = -1

  for (let e = 0; e < Math.ceil(EPOCHS_PER_YEAR) * 15; e++) {
    const year = current.getFullYear()
    if (year !== prevYear) {
      data.push({ year, reserves: Math.max(0, reserves), treasury: Math.max(0, treasury) })
      prevYear = year
    }
    if (treasury <= 0 && runOutYear === null) runOutYear = year

    const pot = reserves * RHO + txFeePerEpoch
    treasury = treasury + pot * TAU - withdrawPerEpoch
    reserves = reserves * (1 - RHO)
    current  = new Date(current.getTime() + EPOCH_DAYS * 86_400_000)
  }

  return { data, runOutYear }
}

function fmt(v: number, decimals = 2) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(decimals)}B ₳`
  if (v >= 1e6) return `${(v / 1e6).toFixed(decimals < 2 ? 1 : decimals)}M ₳`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K ₳`
  return `${v.toFixed(0)} ₳`
}

function fmtSlider(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return v.toLocaleString()
}

// ── Custom slider ──────────────────────────────────────────────────────────────
function Slider({
  label, hint, min, max, step, value, onChange, accent = false,
}: {
  label: string; hint?: string
  min: number; max: number; step: number
  value: number; onChange: (v: number) => void; accent?: boolean
}) {
  const pct = ((value - min) / (max - min)) * 100
  const trackFill = accent ? "bg-accent" : "bg-white/30"
  const thumb     = accent ? "bg-accent shadow-accent/40" : "bg-white shadow-white/20"
  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-text-primary">{label}</p>
          {hint && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
        </div>
        <span className="text-base font-bold text-text-primary tabular-nums shrink-0">
          {fmtSlider(value)}
        </span>
      </div>

      <div className="relative h-6 flex items-center select-none">
        {/* Track */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10" />
        {/* Fill */}
        <div className={`absolute h-1.5 rounded-full ${trackFill}`} style={{ width: `${pct}%` }} />
        {/* Native input — sits on top, invisible */}
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-6 opacity-0 cursor-pointer"
        />
        {/* Thumb */}
        <div
          className={`absolute w-4.5 h-4.5 w-[18px] h-[18px] rounded-full shadow-lg pointer-events-none ${thumb}`}
          style={{ left: `calc(${pct}% - 9px)` }}
        />
      </div>

      <div className="flex justify-between text-xs text-text-muted">
        <span>{fmtSlider(min)}</span>
        <span>{fmtSlider(max)}</span>
      </div>
    </div>
  )
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a2e] border border-white/10 rounded-xl px-4 py-3 text-sm shadow-2xl backdrop-blur-sm">
      <p className="font-bold text-white mb-2">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-white/60">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-semibold text-white tabular-nums">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-bg-card border border-border-default rounded-2xl px-5 py-4 flex-1 min-w-0">
      <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold truncate ${color ?? "text-text-primary"}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function TreasuryProjectionPage() {
  const [txFee,    setTxFee]    = useState(TX_FEE_MIN)
  const [withdraw, setWithdraw] = useState(300_000_000)

  const { data, runOutYear } = useMemo(() => simulate(txFee, withdraw), [txFee, withdraw])

  const currentYear    = new Date().getFullYear()
  const yearsRemaining = runOutYear ? runOutYear - currentYear : null
  const annualInflow   = (INITIAL_RESERVES * RHO + txFee) * EPOCHS_PER_YEAR * TAU
  const netPerYear     = annualInflow - withdraw
  const yMax           = Math.ceil(Math.max(...data.map(d => d.reserves)) / 1e9) * 1e9

  const runOutColor =
    yearsRemaining === null     ? "text-[#22c55e]"
    : yearsRemaining > 10       ? "text-[#eab308]"
    : "text-[#ef4444]"

  const statusBg =
    yearsRemaining === null     ? "bg-[#22c55e]/10 border-[#22c55e]/20"
    : yearsRemaining > 10       ? "bg-[#eab308]/10 border-[#eab308]/20"
    : "bg-[#ef4444]/10 border-[#ef4444]/20"

  return (
    <main className="page-container py-10 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                <polyline points="17 6 23 6 23 12"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-text-primary">Cardano Treasury Projection</h1>
          </div>
          <p className="text-text-muted text-sm max-w-xl">
            Simulate treasury and reserve dynamics over time using Cardano&apos;s monetary policy
            (ρ = {RHO} per epoch · τ = {TAU} treasury cut).
          </p>
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="flex gap-3 flex-wrap">
        <StatCard
          label="Starting Treasury"
          value={fmt(INITIAL_TREASURY, 1)}
          sub="Approx. mainnet 2026"
        />
        <StatCard
          label="Starting Reserves"
          value={fmt(INITIAL_RESERVES, 1)}
          sub="Approx. mainnet 2026"
        />
        <StatCard
          label="Annual Inflow (year 1)"
          value={fmt(annualInflow, 1)}
          sub={`At ${fmtSlider(txFee)} tx fee/epoch`}
        />
        <StatCard
          label={yearsRemaining === null ? "Status" : "Runs out in"}
          value={yearsRemaining === null ? "Sustainable" : `~${yearsRemaining} yr`}
          sub={yearsRemaining === null ? "Inflow > withdrawals" : `Year ${runOutYear}`}
          color={runOutColor}
        />
      </div>

      {/* ── Main card ── */}
      <div className="bg-bg-card border border-border-default rounded-2xl overflow-hidden">
        <div className="flex flex-col lg:flex-row">

          {/* Controls panel */}
          <div className="lg:w-72 xl:w-80 shrink-0 bg-bg-secondary border-b lg:border-b-0 lg:border-r border-border-default p-6 flex flex-col gap-7">

            <Slider
              label="Transaction Fee / Per Epoch"
              hint="current mainnet ≈ 31K ₳"
              min={TX_FEE_MIN} max={TX_FEE_MAX} step={1_000}
              value={txFee} onChange={setTxFee}
            />

            <div className="border-t border-border-subtle" />

            <Slider
              label="Treasury Withdraw / Per Year"
              hint="governance spending"
              min={0} max={WITHDRAW_MAX} step={10_000_000}
              value={withdraw} onChange={setWithdraw}
              accent
            />

            <div className="border-t border-border-subtle" />

            {/* Status alert */}
            <div className={`rounded-xl border px-4 py-4 ${statusBg}`}>
              {yearsRemaining === null ? (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <p className="text-sm font-semibold text-[#22c55e]">Treasury is self-sustaining</p>
                  </div>
                  <p className="text-xs text-text-muted">Annual inflow exceeds withdrawals by {fmt(netPerYear, 1)}</p>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={yearsRemaining > 10 ? "#eab308" : "#ef4444"} strokeWidth="2.5" strokeLinecap="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    <p className={`text-sm font-semibold ${runOutColor}`}>Treasury will run out</p>
                  </div>
                  <p className="text-2xl font-bold text-text-primary mt-1">~{runOutYear}</p>
                  <p className="text-xs text-text-muted mt-0.5">
                    {yearsRemaining} year{yearsRemaining !== 1 ? "s" : ""} from now · deficit {fmt(Math.abs(netPerYear), 1)}/yr
                  </p>
                </>
              )}
            </div>

            {/* Protocol params */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-text-muted uppercase tracking-wider">Protocol params</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-text-muted">
                <span>ρ (expansion)</span><span className="text-text-secondary font-mono">{RHO}</span>
                <span>τ (treasury cut)</span><span className="text-text-secondary font-mono">{TAU}</span>
                <span>Epoch length</span><span className="text-text-secondary font-mono">{EPOCH_DAYS} days</span>
                <span>Epochs/year</span><span className="text-text-secondary font-mono">{EPOCHS_PER_YEAR.toFixed(1)}</span>
              </div>
            </div>
          </div>

          {/* Chart area */}
          <div className="flex-1 p-6 min-h-[420px]">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-text-secondary">ADA Over Time</p>
              <div className="flex items-center gap-4 text-xs text-text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded-full bg-[#60a5fa] inline-block"/>
                  Reserves
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 rounded-full bg-[#f87171] inline-block"/>
                  Treasury Balance
                </span>
                {runOutYear && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-0.5 h-3 rounded-full bg-[#f97316]/60 inline-block"/>
                    Run-out
                  </span>
                )}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={370}>
              <AreaChart data={data} margin={{ top: 5, right: 8, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gReserves" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#3b82f6" stopOpacity={0.35}/>
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02}/>
                  </linearGradient>
                  <linearGradient id="gTreasury" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"  stopColor="#ef4444" stopOpacity={0.5}/>
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>

                <XAxis
                  dataKey="year"
                  tick={{ fill: "#6b7280", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                  tickLine={false}
                  dy={6}
                />
                <YAxis
                  domain={[0, yMax]}
                  tick={{ fill: "#6b7280", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v === 0 ? "0" : `${(v / 1e9).toFixed(0)}B`}
                  width={32}
                />

                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}/>

                {/* Run-out reference line */}
                {runOutYear && (
                  <ReferenceLine
                    x={runOutYear}
                    stroke="#f97316"
                    strokeDasharray="5 3"
                    strokeWidth={1.5}
                    strokeOpacity={0.7}
                    label={{ value: `${runOutYear}`, fill: "#f97316", fontSize: 11, position: "insideTopLeft", dy: -4 }}
                  />
                )}

                <Area
                  type="monotone"
                  dataKey="reserves"
                  name="Reserves"
                  stroke="#60a5fa"
                  strokeWidth={2}
                  fill="url(#gReserves)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#60a5fa", strokeWidth: 0 }}
                />
                <Area
                  type="monotone"
                  dataKey="treasury"
                  name="Treasury Balance"
                  stroke="#f87171"
                  strokeWidth={2}
                  fill="url(#gTreasury)"
                  dot={false}
                  activeDot={{ r: 4, fill: "#f87171", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Bottom note */}
            <p className="text-xs text-text-muted mt-2 text-center">
              Simulation starts from current epoch · epoch rewards to stakers excluded (they don&apos;t affect treasury/reserves math)
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
