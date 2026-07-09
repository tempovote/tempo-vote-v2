import type { Meta, StoryObj } from "@storybook/react-vite"
import { DRepAvatar } from "./drep-avatar"

const meta: Meta<typeof DRepAvatar> = { title: "Domain/DRepAvatar", component: DRepAvatar }
export default meta
type Story = StoryObj<typeof DRepAvatar>

export const GradientFallbacks: Story = {
  name: "Gradient fallback (hash theo id)",
  render: () => (
    <div className="flex items-center gap-3">
      <DRepAvatar id="drep1abc" name="Alice" size={64} />
      <DRepAvatar id="drep1xyz" name="Bob" size={56} />
      <DRepAvatar id="drep1qqq" name={null} size={40} />
      <DRepAvatar id="drep1zzz" name="Tempo" size={32} />
    </div>
  ),
}

export const BrokenImageFallsBack: Story = {
  name: "Ảnh hỏng → thử 3 gateway → initial",
  args: { id: "drep1abc", name: "Alice", imageUrl: "ipfs://QmInvalidHashForStory", size: 64 },
}
