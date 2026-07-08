import type { Meta, StoryObj } from "@storybook/react-vite"
import { ActionIdChip } from "./action-id-chip"

const TX_HASH = "4b10e5793282f9dd430ec42fdb96b7a410dcbc4a5b6c4e2f1a09d38271b6c4e2"

const meta: Meta<typeof ActionIdChip> = { title: "Domain/ActionIdChip", component: ActionIdChip }
export default meta
type Story = StoryObj<typeof ActionIdChip>

export const SmallCard: Story = { args: { txHash: TX_HASH, index: 0, size: "sm" } }
export const MediumDetail: Story = { args: { txHash: TX_HASH, index: 2, size: "md" } }
export const CustomCopyTitle: Story = {
  args: { txHash: TX_HASH, index: 0, copyTitle: (mode) => `Sao chép ID (${mode})` },
}
