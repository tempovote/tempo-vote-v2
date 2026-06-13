export type SortMode = "tvl" | "volume" | "fees" | "revenue"

export interface CardanoProtocol {
  rank: number
  name: string
  slug: string
  logo: string
  category: string
  tvl: number
  change1d: number
  change7d: number
  volume24h: number | null
  fees24h: number | null
  revenue24h: number | null
  url: string
}

function fmtUsd(v: number | null): string {
  if (v === null) return "—"
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`
  return `$${v.toFixed(0)}`
}

function Change({ value }: { value: number }) {
  const pos = value >= 0
  return (
    <span className={`tabular-nums font-medium ${pos ? "text-success" : "text-danger"}`}>
      {pos ? "+" : ""}{value.toFixed(2)}%
    </span>
  )
}

function ColHeader({
  children,
  active,
  align = "right",
}: {
  children: React.ReactNode
  active: boolean
  align?: "left" | "right"
}) {
  return (
    <th className={`py-3 px-3 font-medium whitespace-nowrap text-${align} ${active ? "text-accent-light" : ""}`}>
      {children}
      {active && <span className="ml-1 text-accent">↓</span>}
    </th>
  )
}

export default function ProtocolTable({
  protocols,
  sortMode,
}: {
  protocols: CardanoProtocol[]
  sortMode: SortMode
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-bg-secondary border-b-2 border-border-default">
          <tr className="text-text-muted text-left">
            <th className="py-3 px-4 font-medium w-10">#</th>
            <th className="py-3 px-4 font-medium w-16"></th>
            <th className="py-3 px-3 font-medium">Name</th>
            <th className="py-3 px-3 font-medium">Category</th>
            <ColHeader active={sortMode === "tvl"}>TVL</ColHeader>
            <th className="py-3 px-3 font-medium text-right whitespace-nowrap">1d %</th>
            <th className="py-3 px-3 font-medium text-right whitespace-nowrap">7d %</th>
            <ColHeader active={sortMode === "volume"}>Vol 24h</ColHeader>
            <ColHeader active={sortMode === "fees"}>Fees 24h</ColHeader>
            <ColHeader active={sortMode === "revenue"}>Revenue 24h</ColHeader>
          </tr>
        </thead>
        <tbody>
          {protocols.map(p => (
            <tr key={p.slug}
              className="border-b border-border-subtle hover:bg-bg-card-hover transition-colors group">

              <td className="py-3 px-4 text-text-muted tabular-nums text-sm">{p.rank}</td>

              <td className="py-3 px-4">
                {p.logo ? (
                  <img
                    src={p.logo}
                    alt={p.name}
                    width={32}
                    height={32}
                    className="rounded-full object-cover w-8 h-8 shrink-0"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none" }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent-light shrink-0">
                    {p.name[0]}
                  </div>
                )}
              </td>

              <td className="py-3 px-3">
                <a
                  href={p.url || `https://defillama.com/protocol/${p.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-accent-light group-hover:underline"
                >
                  {p.name}
                </a>
              </td>

              <td className="py-3 px-3">
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent-light border border-accent/20 whitespace-nowrap">
                  {p.category}
                </span>
              </td>

              <td className={`py-3 px-3 text-right font-semibold tabular-nums ${sortMode === "tvl" ? "text-text-primary" : "text-text-secondary"}`}>
                {fmtUsd(p.tvl)}
              </td>

              <td className="py-3 px-3 text-right"><Change value={p.change1d} /></td>
              <td className="py-3 px-3 text-right"><Change value={p.change7d} /></td>

              <td className={`py-3 px-3 text-right tabular-nums ${sortMode === "volume" ? "text-text-primary font-semibold" : "text-text-secondary"}`}>
                {fmtUsd(p.volume24h)}
              </td>

              <td className={`py-3 px-3 text-right tabular-nums ${sortMode === "fees" ? "text-text-primary font-semibold" : "text-text-secondary"}`}>
                {fmtUsd(p.fees24h)}
              </td>

              <td className={`py-3 px-3 text-right tabular-nums ${sortMode === "revenue" ? "text-text-primary font-semibold" : "text-text-secondary"}`}>
                {fmtUsd(p.revenue24h)}
              </td>
            </tr>
          ))}
          {protocols.length === 0 && (
            <tr>
              <td colSpan={10} className="py-16 text-center text-text-muted">
                Không có dữ liệu.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
