import type { Meta, StoryObj } from "@storybook/react-vite"
import { Plus } from "lucide-react"
import { Button } from "./button"
import { Spinner } from "./spinner"

const meta: Meta<typeof Button> = { title: "Primitives/Button", component: Button }
export default meta
type Story = StoryObj<typeof Button>

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Primary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="success">Success</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Add"><Plus className="size-4" /></Button>
    </div>
  ),
}

export const States: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled>Disabled</Button>
      <Button disabled><Spinner size="sm" className="border-white/40 border-t-white" /> Đang gửi…</Button>
      <Button variant="outline" disabled>Disabled outline</Button>
    </div>
  ),
}
