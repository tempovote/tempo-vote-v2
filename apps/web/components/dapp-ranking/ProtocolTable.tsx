import type { Protocol } from "@/lib/mock-data"

interface Props {
  protocols: Protocol[]
}

const riskBadgeClass: Record<string, string> = {
  Medium: "badge-risk-medium",
  Unknown: "badge-risk-unknown",
  Minor: "badge-risk-minor",
  Critical: "badge-risk-critical",
  Major: "badge-risk-major",
}

export default function ProtocolTable({ protocols }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-default text-text-muted text-left">
            <th className="py-3 px-3 font-medium w-16">Ranking</th>
            <th className="py-3 px-3 font-medium w-12">Logo</th>
            <th className="py-3 px-3 font-medium">Name</th>
            <th className="py-3 px-3 font-medium text-right">TVL ↕</th>
            <th className="py-3 px-3 font-medium text-right">Vol ↕</th>
            <th className="py-3 px-3 font-medium text-center">Risk Level</th>
            <th className="py-3 px-3 font-medium text-right">Tx Count</th>
            <th className="py-3 px-3 font-medium text-right whitespace-nowrap">Active Wallet 30D</th>
            <th className="py-3 px-3 font-medium text-right whitespace-nowrap">Active Wallet 7D</th>
          </tr>
        </thead>
        <tbody>
          {protocols.map((p) => (
            <tr
              key={p.rank}
              className="border-b border-border-subtle hover:bg-bg-card-hover transition-colors group"
            >
              <td className="py-3.5 px-3 text-text-muted">{p.rank}</td>
              <td className="py-3.5 px-3">
                <span className="text-lg">{p.logo}</span>
              </td>
              <td className="py-3.5 px-3">
                <span className="font-medium text-accent-light group-hover:underline cursor-pointer">
                  {p.name}
                </span>
              </td>
              <td className="py-3.5 px-3 text-right font-medium">{p.tvl}</td>
              <td className="py-3.5 px-3 text-right text-text-secondary">{p.vol}</td>
              <td className="py-3.5 px-3 text-center">
                <span className={`badge ${riskBadgeClass[p.riskLevel] ?? "badge-risk-unknown"}`}>
                  {p.riskLevel}
                </span>
              </td>
              <td className="py-3.5 px-3 text-right text-text-secondary">{p.txCount}</td>
              <td className="py-3.5 px-3 text-right text-text-secondary">{p.activeWallet30d}</td>
              <td className="py-3.5 px-3 text-right text-text-secondary">{p.activeWallet7d}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
