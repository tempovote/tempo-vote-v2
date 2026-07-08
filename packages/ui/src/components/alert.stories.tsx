import type { Meta, StoryObj } from "@storybook/react-vite"
import { Alert, AlertDescription, AlertTitle } from "./alert"

const meta: Meta<typeof Alert> = { title: "Primitives/Alert", component: Alert }
export default meta
type Story = StoryObj<typeof Alert>

export const Variants: Story = {
  render: () => (
    <div className="max-w-lg space-y-3">
      <Alert>Delegation sẽ có hiệu lực từ epoch kế tiếp.</Alert>
      <Alert variant="success">Transaction đã submit thành công.</Alert>
      <Alert variant="warning">
        <AlertTitle>Chưa có DRep key</AlertTitle>
        <AlertDescription>Ví của bạn chưa bật CIP-95 — hãy bật trong cài đặt ví.</AlertDescription>
      </Alert>
      <Alert variant="destructive">Submit thất bại: UTxO đã bị tiêu.</Alert>
    </div>
  ),
}
