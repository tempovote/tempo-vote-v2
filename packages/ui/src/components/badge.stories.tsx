import type { Meta, StoryObj } from "@storybook/react-vite"
import { Badge } from "./badge"

const meta: Meta<typeof Badge> = { title: "Primitives/Badge", component: Badge }
export default meta
type Story = StoryObj<typeof Badge>

export const Generic: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
}

export const GAStatus: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="status-active">Active</Badge>
      <Badge variant="status-ratified">Ratified</Badge>
      <Badge variant="status-expired">Expired</Badge>
      <Badge variant="status-enacted">Enacted</Badge>
      <Badge variant="status-dropped">Dropped</Badge>
    </div>
  ),
}

export const Risk: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="risk-critical">Critical</Badge>
      <Badge variant="risk-major">Major</Badge>
      <Badge variant="risk-medium">Medium</Badge>
      <Badge variant="risk-minor">Minor</Badge>
      <Badge variant="risk-unknown">Unknown</Badge>
    </div>
  ),
}
