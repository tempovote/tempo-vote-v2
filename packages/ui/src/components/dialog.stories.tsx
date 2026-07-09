import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "./button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose,
} from "./dialog"

const meta: Meta<typeof Dialog> = { title: "Primitives/Dialog", component: Dialog }
export default meta
type Story = StoryObj<typeof Dialog>

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild><Button variant="outline">Mở dialog</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Wallet</DialogTitle>
          <DialogDescription>Chọn ví CIP-30 để kết nối với Tempo.</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Nội dung modal…</p>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Đóng</Button></DialogClose>
          <Button>Tiếp tục</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
}
