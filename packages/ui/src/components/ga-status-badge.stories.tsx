import type { Meta, StoryObj } from "@storybook/react-vite"
import { GaStatusBadge } from "./ga-status-badge"

const meta: Meta<typeof GaStatusBadge> = { title: "Domain/GaStatusBadge", component: GaStatusBadge }
export default meta
type Story = StoryObj<typeof GaStatusBadge>

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <GaStatusBadge status="active" label="Active" />
      <GaStatusBadge status="ratified" label="Ratified" />
      <GaStatusBadge status="expired" label="Expired" />
      <GaStatusBadge status="enacted" label="Enacted" />
      <GaStatusBadge status="dropped" label="Dropped" />
      <GaStatusBadge status="unknown" label="Unknown → fallback Active" />
    </div>
  ),
}
