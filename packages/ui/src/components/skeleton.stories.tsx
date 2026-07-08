import type { Meta, StoryObj } from "@storybook/react-vite"
import { Skeleton } from "./skeleton"

const meta: Meta<typeof Skeleton> = { title: "Primitives/Skeleton", component: Skeleton }
export default meta
type Story = StoryObj<typeof Skeleton>

export const LoadingCard: Story = {
  render: () => (
    <div className="max-w-sm space-y-3 rounded-card border border-border bg-card p-6">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 w-24 rounded-button" />
        <Skeleton className="h-9 w-24 rounded-button" />
      </div>
    </div>
  ),
}
