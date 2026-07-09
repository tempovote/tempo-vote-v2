import type { Meta, StoryObj } from "@storybook/react-vite"
import { CopyButton } from "./copy-button"
import { CopyableId } from "./copyable-id"

const DREP_ID = "drep1y29h6wkwnk7yr9m3xemyyvpe2mzmy0d6z2wq4xj6kgw2c6q4gt5j2"

const meta: Meta<typeof CopyButton> = { title: "Domain/CopyButton", component: CopyButton }
export default meta
type Story = StoryObj<typeof CopyButton>

export const InlineAfterId: Story = {
  render: () => (
    <p className="font-mono text-xs text-muted-foreground">
      {DREP_ID.slice(0, 20)}…
      <CopyButton value={DREP_ID} title="Copy DRep ID" />
    </p>
  ),
}

export const LargerIcon: Story = {
  render: () => <CopyButton value={DREP_ID} title="Copy" size={18} />,
}

export const CopyableIdStory: Story = {
  name: "CopyableId",
  render: () => (
    <div className="space-y-2">
      <CopyableId id={DREP_ID} />
      <CopyableId id="short-id" />
    </div>
  ),
}
