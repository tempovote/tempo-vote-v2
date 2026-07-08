import type { Meta, StoryObj } from "@storybook/react-vite"
import { AdaAmount } from "./ada-amount"

const meta: Meta<typeof AdaAmount> = { title: "Domain/AdaAmount", component: AdaAmount }
export default meta
type Story = StoryObj<typeof AdaAmount>

export const Tiers: Story = {
  render: () => (
    <div className="space-y-1 text-sm text-foreground">
      <p><AdaAmount lovelace={1_234_567_890_000_000} /> (tier B)</p>
      <p><AdaAmount lovelace={595_010_000_000_000} /> (tier M)</p>
      <p><AdaAmount lovelace={1_500_000_000} /> (tier K)</p>
      <p><AdaAmount lovelace={999_000_000} /> (dưới 1K)</p>
      <p><AdaAmount lovelace={1_500_000_000} symbol="ADA" /> (symbol ADA)</p>
    </div>
  ),
}
