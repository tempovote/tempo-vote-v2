import type { Meta, StoryObj } from "@storybook/react-vite"
import { StatCell } from "./stat-cell"

const meta: Meta<typeof StatCell> = { title: "Domain/StatCell", component: StatCell }
export default meta
type Story = StoryObj<typeof StatCell>

export const StatsGrid: Story = {
  name: "Grid 2×3 như DRepBanner",
  render: () => (
    <div className="max-w-xl divide-y divide-border-subtle rounded-card border border-border-subtle bg-secondary">
      <div className="grid grid-cols-3 divide-x divide-border-subtle">
        <StatCell label="Active Voting Power" value="1.2M ₳" />
        <StatCell label="Live Voting Power" value="1.3M ₳" />
        <StatCell label="Delegators" value="1,024" />
      </div>
      <div className="grid grid-cols-3 divide-x divide-border-subtle">
        <StatCell label="Influence" value="2.15%" highlight />
        <StatCell label="Voted" value="98.50%" highlight />
        <StatCell label="Not Voted" value="12.00%" danger />
      </div>
    </div>
  ),
}

export const States: Story = {
  render: () => (
    <div className="grid max-w-md grid-cols-3 divide-x divide-border-subtle rounded-card border border-border-subtle bg-secondary">
      <StatCell label="Loading" value={null} loading />
      <StatCell label="Fallback" value={null} />
      <StatCell label="Custom fallback" value={null} fallback="0 ₳" />
    </div>
  ),
}
