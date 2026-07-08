import type { Meta, StoryObj } from "@storybook/react-vite"
import { Label } from "./label"
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue,
} from "./select"

const meta: Meta<typeof Select> = { title: "Primitives/Select", component: Select }
export default meta
type Story = StoryObj<typeof Select>

export const Default: Story = {
  render: () => (
    <div className="max-w-xs space-y-2">
      <Label>Loại governance action</Label>
      <Select defaultValue="info">
        <SelectTrigger><SelectValue placeholder="Chọn loại…" /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Không cần threshold</SelectLabel>
            <SelectItem value="info">Info Action</SelectItem>
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Cần ratify</SelectLabel>
            <SelectItem value="treasury">Treasury Withdrawal</SelectItem>
            <SelectItem value="hardfork">Hard Fork</SelectItem>
            <SelectItem value="constitution" disabled>New Constitution (disabled)</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  ),
}
