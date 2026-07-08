import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { RichMarkdownEditor } from "./rich-markdown-editor"

const LABELS = {
  modeEdit: "Edit",
  modeSplit: "Split",
  modePreview: "Preview",
  optional: "optional",
  charsRemaining: (n: string) => `${n} characters remaining`,
  charCount: (n: string) => `${n} characters`,
}

const SAMPLE = "## Vote Rationale\n\nProposal này **đáng ủng hộ**:\n\n1. Ngân sách minh bạch\n2. Team có track record\n\n```\ngov_action1abc...\n```"

function Demo({ maxLength, optional }: { maxLength?: number; optional?: boolean }) {
  const [value, setValue] = useState(SAMPLE)
  return (
    <div className="max-w-2xl">
      <RichMarkdownEditor
        value={value}
        onChange={setValue}
        labels={LABELS}
        label="Rationale"
        description="Giải thích lý do vote — lưu on-chain qua CIP-108 anchor."
        placeholder="Viết rationale…"
        maxLength={maxLength}
        optional={optional}
      />
    </div>
  )
}

const meta: Meta<typeof RichMarkdownEditor> = {
  title: "Domain/RichMarkdownEditor",
  component: RichMarkdownEditor,
}
export default meta
type Story = StoryObj<typeof RichMarkdownEditor>

export const Interactive: Story = { render: () => <Demo /> }
export const WithMaxLength: Story = { render: () => <Demo maxLength={500} /> }
export const OptionalField: Story = { render: () => <Demo optional /> }
