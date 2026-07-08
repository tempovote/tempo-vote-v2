import type { Meta, StoryObj } from "@storybook/react-vite"
import { Spinner } from "./spinner"

const meta: Meta<typeof Spinner> = { title: "Primitives/Spinner", component: Spinner }
export default meta
type Story = StoryObj<typeof Spinner>

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner size="sm" />
      <Spinner />
      <Spinner size="lg" />
    </div>
  ),
}
