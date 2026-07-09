import type { Meta, StoryObj } from "@storybook/react-vite"
import { NetworkBadge } from "./network-badge"

const meta: Meta<typeof NetworkBadge> = { title: "Domain/NetworkBadge", component: NetworkBadge }
export default meta
type Story = StoryObj<typeof NetworkBadge>

export const Both: Story = {
  render: () => (
    <div className="flex gap-3">
      <NetworkBadge network="mainnet" />
      <NetworkBadge network="preprod" />
    </div>
  ),
}
