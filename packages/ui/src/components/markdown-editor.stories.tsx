import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { MarkdownEditor } from "./markdown-editor"

const LABELS = {
  write: "Write",
  preview: "Preview",
  empty: "Nothing to preview",
  charsRemaining: (n: string) => `${n} characters remaining`,
}

const SAMPLE = "## Rationale\n\nTôi vote **Yes** vì:\n\n- Ngân sách hợp lý\n- Có `milestones` rõ ràng\n\n> Trích CIP-108"

function Demo({ maxLength }: { maxLength?: number }) {
  const [value, setValue] = useState(SAMPLE)
  return (
    <div className="max-w-xl">
      <MarkdownEditor value={value} onChange={setValue} labels={LABELS} maxLength={maxLength} placeholder="Viết markdown…" />
    </div>
  )
}

const meta: Meta<typeof MarkdownEditor> = { title: "Domain/MarkdownEditor", component: MarkdownEditor }
export default meta
type Story = StoryObj<typeof MarkdownEditor>

export const Interactive: Story = { render: () => <Demo /> }
export const WithMaxLength: Story = { render: () => <Demo maxLength={200} /> }
