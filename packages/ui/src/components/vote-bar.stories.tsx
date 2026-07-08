import type { Meta, StoryObj } from "@storybook/react-vite"
import { VoteBar } from "./vote-bar"

const meta: Meta<typeof VoteBar> = { title: "Domain/VoteBar", component: VoteBar }
export default meta
type Story = StoryObj<typeof VoteBar>

export const DRepWithThreshold: Story = {
  args: {
    segments: [
      { value: 67, color: "yes", label: "67%" },
      { value: 13, color: "no" },
      { value: 20, color: "not-voted" },
    ],
    threshold: 67,
  },
  render: (args) => (
    <div className="max-w-xl">
      <VoteBar {...args} />
    </div>
  ),
}

export const SliverBelowHalfPercent: Story = {
  name: "Sliver 0.5% (PR #110)",
  args: {
    segments: [
      { value: 0.05, color: "yes" },
      { value: 0.02, color: "no" },
    ],
    threshold: 51,
  },
  render: (args) => (
    <div className="max-w-xl">
      <VoteBar {...args} />
    </div>
  ),
}

export const WithAbstain: Story = {
  args: {
    segments: [
      { value: 45, color: "yes", label: "45%" },
      { value: 30, color: "no" },
      { value: 10, color: "abstain" },
      { value: 15, color: "not-voted" },
    ],
  },
  render: (args) => (
    <div className="max-w-xl">
      <VoteBar {...args} />
    </div>
  ),
}

export const ComposedRow: Story = {
  name: "Composed như app (label + threshold %)",
  render: () => (
    <div className="flex max-w-xl items-center gap-3">
      <span className="w-10 shrink-0 text-sm text-muted-foreground">DRep</span>
      <VoteBar
        className="flex-1"
        segments={[
          { value: 72, color: "yes", label: "72%" },
          { value: 8, color: "no" },
          { value: 20, color: "not-voted" },
        ]}
        threshold={67}
      />
      <span className="w-9 shrink-0 text-right text-xs font-semibold text-muted-foreground">67%</span>
    </div>
  ),
}
