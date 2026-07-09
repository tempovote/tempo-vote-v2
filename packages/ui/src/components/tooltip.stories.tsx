import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "./button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"

const meta: Meta<typeof Tooltip> = { title: "Primitives/Tooltip", component: Tooltip }
export default meta
type Story = StoryObj<typeof Tooltip>

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild><Button variant="ghost">Hover tôi</Button></TooltipTrigger>
        <TooltipContent>Threshold 67% tính trên tổng active stake.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
}
