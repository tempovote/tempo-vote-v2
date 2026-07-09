import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "./button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "./dropdown-menu"

const meta: Meta<typeof DropdownMenu> = { title: "Primitives/DropdownMenu", component: DropdownMenu }
export default meta
type Story = StoryObj<typeof DropdownMenu>

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline">Network ▾</Button></DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Chọn network</DropdownMenuLabel>
        <DropdownMenuItem>Mainnet</DropdownMenuItem>
        <DropdownMenuItem>Preprod</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>Preview (disabled)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}
