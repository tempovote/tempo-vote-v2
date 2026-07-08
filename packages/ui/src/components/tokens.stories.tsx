import type { Meta, StoryObj } from "@storybook/react-vite"
import type { ReactNode } from "react"

const meta: Meta = { title: "Foundation/Tokens" }
export default meta

function Swatch({ name, cls }: { name: string; cls: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`h-10 w-10 shrink-0 rounded-badge border border-border ${cls}`} />
      <code className="text-xs text-muted-foreground">{name}</code>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">{children}</div>
    </div>
  )
}

export const Colors: StoryObj = {
  render: () => (
    <div className="space-y-8">
      <Section title="Surfaces">
        <Swatch name="background" cls="bg-background" />
        <Swatch name="card" cls="bg-card" />
        <Swatch name="popover" cls="bg-popover" />
        <Swatch name="secondary" cls="bg-secondary" />
        <Swatch name="muted" cls="bg-muted" />
        <Swatch name="accent (hover)" cls="bg-accent" />
        <Swatch name="input" cls="bg-input" />
      </Section>
      <Section title="Brand & semantic">
        <Swatch name="primary" cls="bg-primary" />
        <Swatch name="primary-light" cls="bg-primary-light" />
        <Swatch name="primary-dark" cls="bg-primary-dark" />
        <Swatch name="destructive" cls="bg-destructive" />
        <Swatch name="success" cls="bg-success" />
        <Swatch name="warning" cls="bg-warning" />
        <Swatch name="info" cls="bg-info" />
        <Swatch name="ring" cls="bg-ring" />
      </Section>
      <Section title="GA status">
        <Swatch name="status-active" cls="bg-status-active" />
        <Swatch name="status-ratified" cls="bg-status-ratified" />
        <Swatch name="status-expired" cls="bg-status-expired" />
        <Swatch name="status-enacted" cls="bg-status-enacted" />
        <Swatch name="status-dropped" cls="bg-status-dropped" />
      </Section>
      <Section title="Risk">
        <Swatch name="risk-critical" cls="bg-risk-critical" />
        <Swatch name="risk-major" cls="bg-risk-major" />
        <Swatch name="risk-medium" cls="bg-risk-medium" />
        <Swatch name="risk-minor" cls="bg-risk-minor" />
        <Swatch name="risk-unknown" cls="bg-risk-unknown" />
      </Section>
      <Section title="Vote">
        <Swatch name="vote-yes" cls="bg-vote-yes" />
        <Swatch name="vote-no" cls="bg-vote-no" />
        <Swatch name="vote-abstain" cls="bg-vote-abstain" />
      </Section>
    </div>
  ),
}

export const TextAndSurfaces: StoryObj = {
  render: () => (
    <div className="max-w-md space-y-4">
      <div className="rounded-card border border-border bg-card p-4 shadow-card">
        <p className="font-bold text-foreground">Card — text foreground</p>
        <p className="text-sm text-muted-foreground">muted-foreground</p>
        <p className="text-xs text-muted-foreground-subtle">muted-foreground-subtle</p>
      </div>
      <div className="rounded-card border border-border-subtle bg-popover p-4 shadow-glow">
        <p className="text-sm text-foreground">Popover + shadow-glow + border-subtle</p>
      </div>
      <div className="animate-fade-in rounded-button bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-foreground">
        primary + animate-fade-in
      </div>
    </div>
  ),
}
