import type { Meta, StoryObj } from "@storybook/react-vite"
import { Input } from "./input"
import { Textarea } from "./textarea"
import { Label } from "./label"

const meta: Meta<typeof Input> = { title: "Primitives/Form", component: Input }
export default meta
type Story = StoryObj<typeof Input>

export const TextField: Story = {
  render: () => (
    <div className="max-w-sm space-y-2">
      <Label htmlFor="name">Tên DRep</Label>
      <Input id="name" placeholder="Nhập tên hiển thị…" />
      <p className="text-xs text-muted-foreground-subtle">Tối đa 80 ký tự.</p>
    </div>
  ),
}

export const States: Story = {
  render: () => (
    <div className="max-w-sm space-y-3">
      <Input placeholder="Bình thường" />
      <Input defaultValue="Có giá trị" />
      <Input disabled placeholder="Disabled" />
      <Input aria-invalid className="border-destructive focus:border-destructive" defaultValue="Lỗi validate" />
    </div>
  ),
}

export const TextareaField: Story = {
  render: () => (
    <div className="max-w-sm space-y-2">
      <Label htmlFor="bio">Mô tả</Label>
      <Textarea id="bio" rows={4} placeholder="Giới thiệu về DRep…" />
    </div>
  ),
}
