import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "./button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "./alert-dialog"

const meta: Meta<typeof AlertDialog> = { title: "Primitives/AlertDialog", component: AlertDialog }
export default meta
type Story = StoryObj<typeof AlertDialog>

export const Confirm: Story = {
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="destructive">Retire DRep</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xác nhận retire?</AlertDialogTitle>
          <AlertDialogDescription>
            Hành động này gửi transaction on-chain và không thể hoàn tác.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Huỷ</AlertDialogCancel>
          <AlertDialogAction>Xác nhận</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
}
