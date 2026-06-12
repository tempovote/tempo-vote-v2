"use client"

import { useState, useMemo } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts"

// Cardano protocol parameters
const RHO = 0.003            // monetaryExpansion per epoch
const TAU = 0.2              // treasuryCut
const EPOCH_DAYS = 5         // mainnet epoch length (days)
const EPOCHS_PER_YEAR = 365.25 / EPOCH_DAYS  // ≈73.05

// Approximate current mainnet state (ADA)
const INITIAL_RESERVES = 6_500_000_000
const INITIAL_TREASURY = 1_600_000_000

const TX_FEE_MIN     = 31_000
const TX_FEE_MAX     = 2_000_000
const WITHDRAW_MAX   = 1_000_000_000

interface DataPoint { year: number; reserves: number; treasury: number }

function simulate(txFeePerEpoch: number, withdrawPerYear: number) {
  const withdrawPerEpoch = withdrawPerYear / EPOCHS_PER_YEAR
  let reserves = INITIAL_RESERVES
  let treasury = INITIAL_TREASURY
  let runOutDate: string | null = null

  const data: DataPoint[] = []
  const startDate = new Date()
  let current  = new Date(startDate)
  let prevYear = -1

  for (let e = 0; e < Math.ceil(EPOCHS_PER_YEAR) * 15; e++) {
    const year = current.getFullYear()
    if (year !== prevYear) {
      data.push({ year, reserves: Math.max(0, reserves), treasury: Math.max(0, treasury) })
      prevYear = year
    }
    if (treasury <= 0 && !runOutDate) {
      runOutDate = current.toLocaleDateString("en-CA") // YYYY-MM-DD
    }
    const pot = reserves * RHO + txFeePerEpoch
    treasury = treasury + pot * TAU - withdrawPerEpoch
    reserves = reserves * (1 - RHO)
    current   = new Date(current.getTime() + EPOCH_DAYS * 86_400_000)
  }

  return { data, runOutDate }
}

function formatAdaShort(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B ₳`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M ₳`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K ₳`
  return `${v.toFixed(0)} ₳`
}

function formatSliderLabel(v: number) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
  return v.toLocaleString()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-bg-card border border-border-default rounded-lg px-4 py-3 text-sm shadow-xl">
      <p className="font-semibold text-text-primary mb-1.5">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: p.color }} />
          <span className="text-text-muted">{p.name}:</span>
          <span className="font-medium text-text-primary">{formatAdaShort(p.value)}</span>
        </p>
      ))}
    </div>
  )
}

export default function TreasuryProjectionPage() {
  const [txFee,    setTxFee]    = useState(TX_FEE_MIN)
  const [withdraw, setWithdraw] = useState(300_000_000)

  const { data, runOutDate } = useMemo(
    () => simulate(txFee, withdraw),
    [txFee, withdraw],
  )

  const txFeePercent   = ((txFee    - TX_FEE_MIN) / (TX_FEE_MAX   - TX_FEE_MIN))   * 100
  const withdrawPercent = (withdraw  / WITHDRAW_MAX) * 100

  const yMax = Math.ceil(
    Math.max(...data.map(d => d.reserves)) / 1e9,
  ) * 1e9

  return (
    <main className="page-container py-10 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Cardano Treasury Projection</h1>
        <p className="text-text-muted mt-2 text-sm max-w-2xl">
          Simulate how the Cardano treasury evolves over time based on transaction fee income and governance withdrawal spending.
          Uses protocol parameters ρ={RHO} (monetary expansion) and τ={TAU} (treasury cut).
        </p>
      </div>

      {/* Main panel */}
      <div className="bg-bg-card border border-border-default rounded-2xl p-6">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Controls */}
          <div className="lg:w-72 shrink-0 space-y-8">

            {/* TX Fee slider */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-text-primary">Transaction Fee / Per Epoch</p>
              <div className="relative">
                <div className="text-xs text-text-muted mb-1">current</div>
                <div className="relative h-5 flex items-center">
                  {/* Track bg */}
                  <div className="absolute inset-x-0 h-1.5 rounded-full bg-border-default" />
                  {/* Filled portion */}
                  <div
                    className="absolute h-1.5 rounded-full bg-text-muted/40"
                    style={{ width: `${txFeePercent}%` }}
                  />
                  <input
                    type="range"
                    min={TX_FEE_MIN}
                    max={TX_FEE_MAX}
                    step={1_000}
                    value={txFee}
                    onChange={e => setTxFee(Number(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer h-5"
                  />
                  {/* Thumb */}
                  <div
                    className="absolute w-4 h-4 rounded-full bg-white shadow-md border border-border-default pointer-events-none"
                    style={{ left: `calc(${txFeePercent}% - 8px)` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-text-muted mt-2">
                  <span>31K</span>
                  <span className="font-semibold text-text-primary">{formatSliderLabel(txFee)}</span>
                  <span>2M</span>
                </div>
              </div>
            </div>

            {/* Withdraw slider */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-text-primary">Treasury Withdraw / Per Year</p>
              <div className="relative">
                <div className="relative h-5 flex items-center">
                  <div className="absolute inset-x-0 h-1.5 rounded-full bg-border-default" />
                  <div
                    className="absolute h-1.5 rounded-full bg-accent"
                    style={{ width: `${withdrawPercent}%` }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={WITHDRAW_MAX}
                    step={10_000_000}
                    value={withdraw}
                    onChange={e => setWithdraw(Number(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer h-5"
                  />
                  <div
                    className="absolute w-4 h-4 rounded-full bg-accent shadow-md pointer-events-none"
                    style={{ left: `calc(${withdrawPercent}% - 8px)` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-text-muted mt-2">
                  <span>0</span>
                  <span className="font-semibold text-text-primary">{formatSliderLabel(withdraw)}</span>
                  <span>1B</span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border-default" />

            {/* Summary stats */}
            <div className="space-y-3">
              {runOutDate ? (
                <div className="notice-warning rounded-xl px-4 py-3">
                  <p className="text-sm font-medium">Treasury will run out from</p>
                  <p className="text-lg font-bold mt-0.5">{runOutDate}</p>
                </div>
              ) : (
                <div className="notice-success rounded-xl px-4 py-3">
                  <p className="text-sm font-medium">Treasury is self-sustaining</p>
                  <p className="text-xs text-text-muted mt-0.5">Inflow exceeds withdrawals</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-bg-secondary rounded-xl p-3">
                  <p className="text-xs text-text-muted">Annual inflow</p>
                  <p className="text-sm font-semibold text-text-primary mt-0.5">
                    {formatAdaShort(
                      data.length > 0
                        ? ((data[0]?.reserves ?? 0) * RHO + txFee) * EPOCHS_PER_YEAR * TAU
                        : 0
                    )}
                  </p>
                </div>
                <div className="bg-bg-secondary rounded-xl p-3">
                  <p className="text-xs text-text-muted">Annual outflow</p>
                  <p className="text-sm font-semibold text-text-primary mt-0.5">
                    {formatAdaShort(withdraw)}
                  </p>
                </div>
              </div>

              <div className="text-xs text-text-muted space-y-1 pt-1">
                <p>ρ (monetary expansion) = {RHO}</p>
                <p>τ (treasury cut) = {TAU}</p>
                <p>Epoch = {EPOCH_DAYS} days · {EPOCHS_PER_YEAR.toFixed(1)} epochs/yr</p>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="flex-1 min-h-[360px]">
            <ResponsiveContainer width="100%" height={380}>
              <AreaChart data={data} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradReserves" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="gradTreasury" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="year"
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, yMax]}
                  tick={{ fill: "#9ca3af", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => {
                    if (v === 0) return "0"
                    return `${(v / 1e9).toFixed(0)}B`
                  }}
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: 13, paddingTop: 12, color: "#d1d5db" }}
                  iconType="circle"
                  iconSize={10}
                />
                <Area
                  type="monotone"
                  dataKey="reserves"
                  name="Reserves"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#gradReserves)"
                />
                <Area
                  type="monotone"
                  dataKey="treasury"
                  name="Treasury Balance"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#gradTreasury)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Methodology note */}
      <div className="bg-bg-secondary rounded-xl px-5 py-4 text-xs text-text-muted space-y-1">
        <p className="font-medium text-text-secondary text-sm mb-2">Model assumptions</p>
        <p>• Starting values: Reserves ≈ {formatAdaShort(INITIAL_RESERVES)}, Treasury ≈ {formatAdaShort(INITIAL_TREASURY)} (approximate mainnet as of 2026)</p>
        <p>• Each epoch: reward pot = reserves × ρ + txFees. Treasury receives pot × τ; reserves decrease by reserves × ρ.</p>
        <p>• Withdrawal is deducted uniformly each epoch (annual total ÷ epochs per year).</p>
        <p>• Staking rewards (paid to delegators) are not modelled as they do not affect reserves or treasury directly.</p>
      </div>
    </main>
  )
}
