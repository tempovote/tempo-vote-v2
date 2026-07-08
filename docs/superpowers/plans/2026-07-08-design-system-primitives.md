# Tempo Design System — Đợt 2: Primitives — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 14 primitives shadcn-style (Radix + CVA) restyle đúng look Tempo hiện tại, mỗi component kèm story; exports hygiene từ notes đợt 1.

**Architecture:** Theo spec [2026-07-08-tempo-design-system-design.md](../specs/2026-07-08-tempo-design-system-design.md) §4. Component code viết SẴN trong plan này — đã dịch 1:1 từ CSS classes hiện tại (`apps/web/app/globals.css`) sang Tailwind utilities trên token đợt 1. Implementer chép verbatim, không tự thiết kế lại style.

**Tech Stack:** React 19, Radix UI primitives, class-variance-authority, lucide-react, Tailwind v4 tokens từ `@tempo/ui/styles/tokens.css`, Storybook 9.

## Global Constraints

- KHÔNG sửa apps/web. KHÔNG restart API server/port 8080.
- Mọi component: file mới trong `packages/ui/src/components/`, kebab-case, story co-located `<name>.stories.tsx`.
- Import nội bộ package dùng relative (`../lib/utils`), KHÔNG dùng `@tempo/ui/*` (tự tham chiếu).
- Mọi component export named (không default), có `className` pass-through merge bằng `cn()`, KHÔNG `useT()`/store/fetch.
- Types Storybook import từ `"@storybook/react-vite"` (chuẩn đợt 1). `import type { ReactNode } from "react"` khi cần — KHÔNG dùng `React.` namespace.
- Story data tĩnh; mỗi story phủ đủ variant × size × state như code quy định.
- Verify mỗi task: `pnpm --filter @tempo/ui typecheck` && `pnpm --filter @tempo/ui build-storybook` exit 0. Test vitest chỉ Task 1 (có logic buttonVariants).
- Branch: `feature/design-system-primitives` từ main (sau khi PR #113 đã merge). Commit prefix `feat:`.
- Verify TS ở root khi kết thúc: `pnpm typecheck` (tránh stale-dist — CLAUDE.md).

---

### Task 1: Deps + Button + Spinner

**Files:**
- Modify: `packages/ui/package.json` (thêm deps)
- Create: `packages/ui/src/components/button.tsx`, `button.stories.tsx`, `spinner.tsx`, `spinner.stories.tsx`
- Test: `packages/ui/src/components/button.test.ts`

**Interfaces:**
- Produces: `Button`, `buttonVariants` (CVA — variant: default·outline·success·destructive·ghost·link; size: sm·default·lg·icon; prop `asChild`); `Spinner` (size: sm·default·lg). Task 2-6 và đợt 3 dùng Button/Spinner + pattern CVA này làm mẫu.

- [ ] **Step 1: Tạo branch**

```bash
git checkout main && git pull origin main
git checkout -b feature/design-system-primitives
```

- [ ] **Step 2: Thêm dependencies vào `packages/ui/package.json`**

Thêm vào `"dependencies"` (giữ nguyên clsx, tailwind-merge):

```json
    "@radix-ui/react-alert-dialog": "^1.1.6",
    "@radix-ui/react-dialog": "^1.1.6",
    "@radix-ui/react-dropdown-menu": "^2.1.6",
    "@radix-ui/react-label": "^2.1.2",
    "@radix-ui/react-select": "^2.1.6",
    "@radix-ui/react-separator": "^1.1.2",
    "@radix-ui/react-slot": "^1.1.2",
    "@radix-ui/react-tabs": "^1.1.3",
    "@radix-ui/react-tooltip": "^1.1.8",
    "class-variance-authority": "^0.7.1",
    "lucide-react": "^0.475.0"
```

Chạy `pnpm install` — exit 0.

- [ ] **Step 3: Viết test fail — `packages/ui/src/components/button.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { buttonVariants } from "./button"

describe("buttonVariants", () => {
  it("default variant có gradient primary", () => {
    const cls = buttonVariants({})
    expect(cls).toContain("from-primary")
    expect(cls).toContain("to-accent-purple")
  })
  it("destructive variant dùng token destructive", () => {
    const cls = buttonVariants({ variant: "destructive" })
    expect(cls).toContain("bg-destructive")
    expect(cls).toContain("hover:bg-destructive-dark")
  })
  it("size icon là hình vuông", () => {
    expect(buttonVariants({ size: "icon" })).toContain("size-10")
  })
})
```

- [ ] **Step 4: Chạy fail**

```bash
pnpm --filter @tempo/ui test
```

Expected: FAIL — `Cannot find module './button'`.

- [ ] **Step 5: Implement `packages/ui/src/components/button.tsx`**

Style dịch 1:1 từ `.btn-primary/.btn-outline/.btn-success/.btn-danger` (globals.css): padding 0.625rem/1.5rem, font 600 0.875rem, gradient 135deg accent→purple, hover translateY(-1px)+shadow.

```tsx
import { forwardRef } from "react"
import type { ButtonHTMLAttributes } from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

export const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-button font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-br from-primary to-accent-purple text-white hover:-translate-y-px hover:opacity-90 hover:shadow-[0_4px_16px_rgba(99,102,241,0.3)]",
        outline:
          "border border-primary bg-transparent text-primary-light hover:border-primary-light hover:bg-primary/10",
        success: "bg-success text-white hover:bg-success-dark",
        destructive: "bg-destructive text-white hover:bg-destructive-dark",
        ghost: "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
        link: "bg-transparent text-primary-light underline-offset-4 hover:underline",
      },
      size: {
        default: "px-6 py-2.5 text-sm",
        sm: "px-4 py-2 text-xs",
        lg: "px-8 py-3 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  }
)
Button.displayName = "Button"
```

- [ ] **Step 6: Chạy pass**

```bash
pnpm --filter @tempo/ui test
```

Expected: PASS (18 cũ + 3 mới = 21).

- [ ] **Step 7: Implement `packages/ui/src/components/spinner.tsx`**

Dịch từ `.spinner` (20px, border 2px primary/25, top primary, quay 0.7s):

```tsx
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const spinnerVariants = cva(
  "inline-block shrink-0 animate-spin rounded-full border-2 border-primary/25 border-t-primary [animation-duration:0.7s]",
  {
    variants: {
      size: { sm: "size-4", default: "size-5", lg: "size-8" },
    },
    defaultVariants: { size: "default" },
  }
)

export interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string
  /** Accessible label; mặc định "Loading" */
  label?: string
}

export function Spinner({ className, size, label = "Loading" }: SpinnerProps) {
  return <span role="status" aria-label={label} className={cn(spinnerVariants({ size }), className)} />
}
```

- [ ] **Step 8: Stories — `button.stories.tsx` + `spinner.stories.tsx`**

`packages/ui/src/components/button.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Plus } from "lucide-react"
import { Button } from "./button"
import { Spinner } from "./spinner"

const meta: Meta<typeof Button> = { title: "Primitives/Button", component: Button }
export default meta
type Story = StoryObj<typeof Button>

export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button>Primary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="success">Success</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
}

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="sm">Small</Button>
      <Button size="default">Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Add"><Plus className="size-4" /></Button>
    </div>
  ),
}

export const States: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled>Disabled</Button>
      <Button disabled><Spinner size="sm" className="border-white/40 border-t-white" /> Đang gửi…</Button>
      <Button variant="outline" disabled>Disabled outline</Button>
    </div>
  ),
}
```

`packages/ui/src/components/spinner.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Spinner } from "./spinner"

const meta: Meta<typeof Spinner> = { title: "Primitives/Spinner", component: Spinner }
export default meta
type Story = StoryObj<typeof Spinner>

export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Spinner size="sm" />
      <Spinner />
      <Spinner size="lg" />
    </div>
  ),
}
```

- [ ] **Step 9: Verify**

```bash
pnpm --filter @tempo/ui typecheck && pnpm --filter @tempo/ui build-storybook
```

Expected: cả hai exit 0.

- [ ] **Step 10: Commit**

```bash
git add packages/ui pnpm-lock.yaml
git commit -m "feat: add Button + Spinner primitives (CVA, Tempo restyle)"
```

---

### Task 2: Card + Badge + Separator + Skeleton

**Files:**
- Create: `packages/ui/src/components/card.tsx`, `card.stories.tsx`, `badge.tsx`, `badge.stories.tsx`, `separator.tsx`, `skeleton.tsx`, `skeleton.stories.tsx` (separator demo nằm trong card story)

**Interfaces:**
- Consumes: `cn` từ `../lib/utils`.
- Produces: `Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter` (variant: default·static·accent); `Badge, badgeVariants` (variant: default·outline·status-active·status-ratified·status-expired·status-enacted·status-dropped·risk-critical·risk-major·risk-medium·risk-minor·risk-unknown); `Separator`; `Skeleton`. Đợt 3 dùng Badge làm nền cho GaStatusBadge.

- [ ] **Step 1: `packages/ui/src/components/card.tsx`** (dịch từ `.card/.card-static/.card-accent`: bg-card, border, radius-card, p-6; hover default → border-ring + shadow-glow)

```tsx
import { forwardRef } from "react"
import type { HTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const cardVariants = cva("rounded-card border bg-card p-6", {
  variants: {
    variant: {
      default: "border-border transition-all hover:border-ring hover:shadow-glow",
      static: "border-border",
      accent: "border-primary/30",
    },
  },
  defaultVariants: { variant: "static" },
})

export interface CardProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(({ className, variant, ...props }, ref) => (
  <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />
))
Card.displayName = "Card"

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1.5 pb-4", className)} {...props} />
  )
)
CardHeader.displayName = "CardHeader"

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("font-semibold leading-snug text-foreground", className)} {...props} />
  )
)
CardTitle.displayName = "CardTitle"

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
)
CardDescription.displayName = "CardDescription"

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn(className)} {...props} />
)
CardContent.displayName = "CardContent"

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-3 pt-4", className)} {...props} />
  )
)
CardFooter.displayName = "CardFooter"
```

- [ ] **Step 2: `packages/ui/src/components/badge.tsx`** (dịch từ `.badge` + 10 variant màu: bg màu/15, text màu, border màu/30)

```tsx
import type { HTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

export const badgeVariants = cva(
  "inline-flex items-center rounded-badge border px-2.5 py-0.5 text-xs font-semibold tracking-wide",
  {
    variants: {
      variant: {
        default: "border-primary/30 bg-primary/15 text-primary-light",
        outline: "border-border bg-transparent text-muted-foreground",
        "status-active": "border-status-active/30 bg-status-active/15 text-status-active",
        "status-ratified": "border-status-ratified/30 bg-status-ratified/15 text-status-ratified",
        "status-expired": "border-status-expired/30 bg-status-expired/15 text-status-expired",
        "status-enacted": "border-status-enacted/30 bg-status-enacted/15 text-status-enacted",
        "status-dropped": "border-status-dropped/30 bg-status-dropped/15 text-status-dropped",
        "risk-critical": "border-risk-critical/30 bg-risk-critical/15 text-risk-critical",
        "risk-major": "border-risk-major/30 bg-risk-major/15 text-risk-major",
        "risk-medium": "border-risk-medium/30 bg-risk-medium/15 text-risk-medium",
        "risk-minor": "border-risk-minor/30 bg-risk-minor/15 text-risk-minor",
        "risk-unknown": "border-risk-unknown/30 bg-risk-unknown/15 text-risk-unknown",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}
```

- [ ] **Step 3: `packages/ui/src/components/separator.tsx`**

```tsx
"use client"

import { forwardRef } from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import { cn } from "../lib/utils"

export const Separator = forwardRef<
  ElementRef<typeof SeparatorPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-border-subtle data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
      className
    )}
    {...props}
  />
))
Separator.displayName = "Separator"
```

- [ ] **Step 4: `packages/ui/src/components/skeleton.tsx`** (khớp pulse block hiện tại: bg-bg-elevated + animate-pulse)

```tsx
import type { HTMLAttributes } from "react"
import { cn } from "../lib/utils"

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-badge bg-popover", className)} {...props} />
}
```

- [ ] **Step 5: Stories**

`card.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./card"
import { Separator } from "./separator"
import { Button } from "./button"

const meta: Meta<typeof Card> = { title: "Primitives/Card", component: Card }
export default meta
type Story = StoryObj<typeof Card>

export const Variants: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-4 md:grid-cols-3">
      <Card variant="default">
        <CardTitle>Default</CardTitle>
        <CardDescription>Hover: border ring + glow</CardDescription>
      </Card>
      <Card variant="static">
        <CardTitle>Static</CardTitle>
        <CardDescription>Không hover effect</CardDescription>
      </Card>
      <Card variant="accent">
        <CardTitle>Accent</CardTitle>
        <CardDescription>Border primary/30</CardDescription>
      </Card>
    </div>
  ),
}

export const WithSections: Story = {
  render: () => (
    <Card variant="static" className="max-w-md">
      <CardHeader>
        <CardTitle>Governance Action</CardTitle>
        <CardDescription>Đầy đủ header / content / footer</CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="py-4 text-sm text-muted-foreground">
        Nội dung card với <span className="text-foreground">text-foreground</span> nhấn mạnh.
      </CardContent>
      <CardFooter>
        <Button size="sm">Vote</Button>
        <Button size="sm" variant="outline">Chi tiết</Button>
      </CardFooter>
    </Card>
  ),
}
```

`badge.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Badge } from "./badge"

const meta: Meta<typeof Badge> = { title: "Primitives/Badge", component: Badge }
export default meta
type Story = StoryObj<typeof Badge>

export const Generic: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Default</Badge>
      <Badge variant="outline">Outline</Badge>
    </div>
  ),
}

export const GAStatus: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="status-active">Active</Badge>
      <Badge variant="status-ratified">Ratified</Badge>
      <Badge variant="status-expired">Expired</Badge>
      <Badge variant="status-enacted">Enacted</Badge>
      <Badge variant="status-dropped">Dropped</Badge>
    </div>
  ),
}

export const Risk: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge variant="risk-critical">Critical</Badge>
      <Badge variant="risk-major">Major</Badge>
      <Badge variant="risk-medium">Medium</Badge>
      <Badge variant="risk-minor">Minor</Badge>
      <Badge variant="risk-unknown">Unknown</Badge>
    </div>
  ),
}
```

`skeleton.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Skeleton } from "./skeleton"

const meta: Meta<typeof Skeleton> = { title: "Primitives/Skeleton", component: Skeleton }
export default meta
type Story = StoryObj<typeof Skeleton>

export const LoadingCard: Story = {
  render: () => (
    <div className="max-w-sm space-y-3 rounded-card border border-border bg-card p-6">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-9 w-24 rounded-button" />
        <Skeleton className="h-9 w-24 rounded-button" />
      </div>
    </div>
  ),
}
```

- [ ] **Step 6: Verify + Commit**

```bash
pnpm --filter @tempo/ui typecheck && pnpm --filter @tempo/ui build-storybook
git add packages/ui/src/components
git commit -m "feat: add Card, Badge, Separator, Skeleton primitives"
```

---

### Task 3: Input + Textarea + Label

**Files:**
- Create: `packages/ui/src/components/input.tsx`, `textarea.tsx`, `label.tsx`, `input.stories.tsx`

**Interfaces:**
- Produces: `Input`, `Textarea`, `Label` — form controls chuẩn cho đợt 3 (MarkdownEditor, WalletConnectModal forms) và mọi form migrate sau này.

- [ ] **Step 1: `packages/ui/src/components/input.tsx`** (dịch 1:1 từ `.input`: py-2.5 px-4, bg-input, focus border-primary + ring 2px primary/15)

```tsx
import { forwardRef } from "react"
import type { InputHTMLAttributes } from "react"
import { cn } from "../lib/utils"

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "w-full rounded-input border border-border bg-input px-4 py-2.5 text-sm text-foreground outline-none transition-colors",
        "placeholder:text-muted-foreground-subtle",
        "focus:border-primary focus:shadow-[0_0_0_2px_rgba(99,102,241,0.15)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
)
Input.displayName = "Input"
```

- [ ] **Step 2: `packages/ui/src/components/textarea.tsx`**

```tsx
import { forwardRef } from "react"
import type { TextareaHTMLAttributes } from "react"
import { cn } from "../lib/utils"

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-20 w-full rounded-input border border-border bg-input px-4 py-2.5 text-sm text-foreground outline-none transition-colors",
        "placeholder:text-muted-foreground-subtle",
        "focus:border-primary focus:shadow-[0_0_0_2px_rgba(99,102,241,0.15)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"
```

- [ ] **Step 3: `packages/ui/src/components/label.tsx`**

```tsx
"use client"

import { forwardRef } from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import { cn } from "../lib/utils"

export const Label = forwardRef<
  ElementRef<typeof LabelPrimitive.Root>,
  ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-sm font-medium text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className
    )}
    {...props}
  />
))
Label.displayName = "Label"
```

- [ ] **Step 4: `input.stories.tsx`** (phủ cả 3 component)

```tsx
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
```

- [ ] **Step 5: Verify + Commit**

```bash
pnpm --filter @tempo/ui typecheck && pnpm --filter @tempo/ui build-storybook
git add packages/ui/src/components
git commit -m "feat: add Input, Textarea, Label primitives"
```

---

### Task 4: Select

**Files:**
- Create: `packages/ui/src/components/select.tsx`, `select.stories.tsx`

**Interfaces:**
- Consumes: pattern trigger giống `Input` (Task 3).
- Produces: `Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator` — thay `<select>` thuần trong forms khi migrate.

- [ ] **Step 1: `packages/ui/src/components/select.tsx`** (trigger skin như Input; content skin popover: bg-popover, border-border, shadow-card)

```tsx
"use client"

import { forwardRef } from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import { cn } from "../lib/utils"

export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex w-full items-center justify-between gap-2 rounded-input border border-border bg-input px-4 py-2.5 text-sm text-foreground outline-none transition-colors",
      "data-[placeholder]:text-muted-foreground-subtle",
      "focus:border-primary focus:shadow-[0_0_0_2px_rgba(99,102,241,0.15)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground-subtle" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = "SelectTrigger"

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      className={cn(
        "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-input border border-border bg-popover text-foreground shadow-card",
        position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1">
        <ChevronUp className="size-4" />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport
        className={cn("p-1", position === "popper" && "w-full min-w-[var(--radix-select-trigger-width)]")}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1">
        <ChevronDown className="size-4" />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = "SelectContent"

export const SelectLabel = forwardRef<
  ElementRef<typeof SelectPrimitive.Label>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-xs font-semibold text-muted-foreground-subtle", className)}
    {...props}
  />
))
SelectLabel.displayName = "SelectLabel"

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-pointer select-none items-center rounded-badge py-1.5 pl-2 pr-8 text-sm text-muted-foreground outline-none",
      "focus:bg-accent focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute right-2 flex size-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="size-4 text-primary-light" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = "SelectItem"

export const SelectSeparator = forwardRef<
  ElementRef<typeof SelectPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-border-subtle", className)} {...props} />
))
SelectSeparator.displayName = "SelectSeparator"
```

- [ ] **Step 2: `select.stories.tsx`**

```tsx
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
```

- [ ] **Step 3: Verify + Commit**

```bash
pnpm --filter @tempo/ui typecheck && pnpm --filter @tempo/ui build-storybook
git add packages/ui/src/components
git commit -m "feat: add Select primitive (Radix, Tempo restyle)"
```

---

### Task 5: Dialog + AlertDialog

**Files:**
- Create: `packages/ui/src/components/dialog.tsx`, `dialog.stories.tsx`, `alert-dialog.tsx`, `alert-dialog.stories.tsx`

**Interfaces:**
- Consumes: `Button`/`buttonVariants` (Task 1) cho AlertDialog actions.
- Produces: `Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose`; `AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel`. Đợt 3 dựng WalletConnectModal trên Dialog.

Skin theo `.wallet-overlay/.wallet-modal` hiện tại: overlay đen 75%, panel `bg-secondary` (#0f1424) border-border rounded-2xl p-6 max-w-[440px] shadow sâu `0 24px 64px rgba(0,0,0,0.6)`.

- [ ] **Step 1: `packages/ui/src/components/dialog.tsx`**

```tsx
"use client"

import { forwardRef } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from "react"
import { cn } from "../lib/utils"

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

export const DialogOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/75 data-[state=open]:animate-fade-in", className)}
    {...props}
  />
))
DialogOverlay.displayName = "DialogOverlay"

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-full max-w-[440px] -translate-x-1/2 -translate-y-1/2",
        "max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border border-border bg-secondary p-6",
        "shadow-[0_24px_64px_rgba(0,0,0,0.6),0_0_0_1px_rgba(99,102,241,0.08)]",
        "data-[state=open]:animate-slide-up",
        className
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute right-4 top-4 rounded-badge p-1 text-muted-foreground-subtle transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label="Close"
      >
        <X className="size-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = "DialogContent"

export function DialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 pb-4", className)} {...props} />
}

export function DialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex justify-end gap-3 pt-4", className)} {...props} />
}

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-bold leading-snug text-foreground", className)}
    {...props}
  />
))
DialogTitle.displayName = "DialogTitle"

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = "DialogDescription"
```

- [ ] **Step 2: `packages/ui/src/components/alert-dialog.tsx`** (cùng skin; actions dùng buttonVariants)

```tsx
"use client"

import { forwardRef } from "react"
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog"
import type { ComponentPropsWithoutRef, ElementRef, HTMLAttributes } from "react"
import { cn } from "../lib/utils"
import { buttonVariants } from "./button"

export const AlertDialog = AlertDialogPrimitive.Root
export const AlertDialogTrigger = AlertDialogPrimitive.Trigger

export const AlertDialogContent = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Portal>
    <AlertDialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/75 data-[state=open]:animate-fade-in" />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 w-full max-w-[440px] -translate-x-1/2 -translate-y-1/2",
        "rounded-2xl border border-border bg-secondary p-6",
        "shadow-[0_24px_64px_rgba(0,0,0,0.6),0_0_0_1px_rgba(99,102,241,0.08)]",
        "data-[state=open]:animate-slide-up",
        className
      )}
      {...props}
    />
  </AlertDialogPrimitive.Portal>
))
AlertDialogContent.displayName = "AlertDialogContent"

export function AlertDialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 pb-4", className)} {...props} />
}

export function AlertDialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex justify-end gap-3 pt-4", className)} {...props} />
}

export const AlertDialogTitle = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-bold leading-snug text-foreground", className)}
    {...props}
  />
))
AlertDialogTitle.displayName = "AlertDialogTitle"

export const AlertDialogDescription = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
AlertDialogDescription.displayName = "AlertDialogDescription"

export const AlertDialogAction = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Action>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants({}), className)} {...props} />
))
AlertDialogAction.displayName = "AlertDialogAction"

export const AlertDialogCancel = forwardRef<
  ElementRef<typeof AlertDialogPrimitive.Cancel>,
  ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: "ghost" }), className)}
    {...props}
  />
))
AlertDialogCancel.displayName = "AlertDialogCancel"
```

- [ ] **Step 3: Stories**

`dialog.stories.tsx`:

```tsx
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
```

`alert-dialog.stories.tsx`:

```tsx
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
```

- [ ] **Step 4: Verify + Commit**

```bash
pnpm --filter @tempo/ui typecheck && pnpm --filter @tempo/ui build-storybook
git add packages/ui/src/components
git commit -m "feat: add Dialog + AlertDialog primitives (focus trap, aria chuẩn)"
```

---

### Task 6: DropdownMenu + Tabs + Tooltip + Alert + exports hygiene

**Files:**
- Create: `packages/ui/src/components/dropdown-menu.tsx`, `dropdown-menu.stories.tsx`, `tabs.tsx`, `tabs.stories.tsx`, `tooltip.tsx`, `tooltip.stories.tsx`, `alert.tsx`, `alert.stories.tsx`
- Modify: `packages/ui/package.json` (exports hygiene — note từ final review đợt 1)

**Interfaces:**
- Produces: `DropdownMenu*` (Trigger/Content/Item/Label/Separator); `Tabs, TabsList, TabsTrigger, TabsContent` (underline style Tempo); `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider`; `Alert, AlertTitle, AlertDescription` (variant: default·success·warning·destructive).

- [ ] **Step 1: `packages/ui/src/components/dropdown-menu.tsx`**

```tsx
"use client"

import { forwardRef } from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import { cn } from "../lib/utils"

export const DropdownMenu = DropdownMenuPrimitive.Root
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger
export const DropdownMenuGroup = DropdownMenuPrimitive.Group

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[10rem] overflow-hidden rounded-input border border-border bg-popover p-1 text-foreground shadow-card animate-fade-in",
        className
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
))
DropdownMenuContent.displayName = "DropdownMenuContent"

export const DropdownMenuItem = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Item>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "flex cursor-pointer select-none items-center gap-2 rounded-badge px-2 py-1.5 text-sm text-muted-foreground outline-none transition-colors",
      "focus:bg-accent focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = "DropdownMenuItem"

export const DropdownMenuLabel = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Label>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-xs font-semibold text-muted-foreground-subtle", className)}
    {...props}
  />
))
DropdownMenuLabel.displayName = "DropdownMenuLabel"

export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof DropdownMenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-border-subtle", className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"
```

- [ ] **Step 2: `packages/ui/src/components/tabs.tsx`** (underline style như GaDetailTabs: border-b, tab active = text-foreground + border-b primary)

```tsx
"use client"

import { forwardRef } from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import { cn } from "../lib/utils"

export const Tabs = TabsPrimitive.Root

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("flex w-full items-center gap-1 border-b border-border-subtle", className)}
    {...props}
  />
))
TabsList.displayName = "TabsList"

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "-mb-px cursor-pointer border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground outline-none transition-colors",
      "hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50",
      "data-[state=active]:border-primary data-[state=active]:text-foreground",
      "disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = "TabsTrigger"

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("pt-4 outline-none", className)} {...props} />
))
TabsContent.displayName = "TabsContent"
```

- [ ] **Step 3: `packages/ui/src/components/tooltip.tsx`**

```tsx
"use client"

import { forwardRef } from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import type { ComponentPropsWithoutRef, ElementRef } from "react"
import { cn } from "../lib/utils"

export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-xs rounded-badge border border-border bg-popover px-3 py-1.5 text-xs text-foreground shadow-card animate-fade-in",
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = "TooltipContent"
```

- [ ] **Step 4: `packages/ui/src/components/alert.tsx`** (dịch từ `.notice/.notice-success/.notice-warning`; chuẩn hoá warning về token `--warning` — globals dùng #eab308 lệch token #f59e0b, chuẩn hoá CÓ CHỦ ĐÍCH)

```tsx
import type { HTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const alertVariants = cva("flex gap-3 rounded-card border px-4 py-3 text-sm text-muted-foreground", {
  variants: {
    variant: {
      default: "items-center border-primary/20 bg-primary/8",
      success: "items-center border-success/20 bg-success/8",
      warning: "flex-col gap-1 border-warning/20 bg-warning/8",
      destructive: "items-center border-destructive/20 bg-destructive/8",
    },
  },
  defaultVariants: { variant: "default" },
})

export interface AlertProps extends HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

export function AlertTitle({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("font-semibold text-foreground", className)} {...props} />
}

export function AlertDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />
}
```

- [ ] **Step 5: Stories** (4 file)

`dropdown-menu.stories.tsx`:

```tsx
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
```

`tabs.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs"

const meta: Meta<typeof Tabs> = { title: "Primitives/Tabs", component: Tabs }
export default meta
type Story = StoryObj<typeof Tabs>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="votes" className="max-w-lg">
      <TabsList>
        <TabsTrigger value="votes">Votes</TabsTrigger>
        <TabsTrigger value="metadata">Metadata</TabsTrigger>
        <TabsTrigger value="history" disabled>History</TabsTrigger>
      </TabsList>
      <TabsContent value="votes" className="text-sm text-muted-foreground">Nội dung tab Votes.</TabsContent>
      <TabsContent value="metadata" className="text-sm text-muted-foreground">Nội dung tab Metadata.</TabsContent>
    </Tabs>
  ),
}
```

`tooltip.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Button } from "./button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"

const meta: Meta<typeof Tooltip> = { title: "Primitives/Tooltip", component: Tooltip }
export default meta
type Story = StoryObj<typeof Tooltip>

export const Default: Story = {
  render: () => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild><Button variant="ghost">Hover tôi</Button></TooltipTrigger>
        <TooltipContent>Threshold 67% tính trên tổng active stake.</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ),
}
```

`alert.stories.tsx`:

```tsx
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
```

- [ ] **Step 6: Exports hygiene — sửa `packages/ui/package.json`**

Trong `"exports"`, thêm 3 dòng CHẶN trước các pattern hiện có (null target chặn resolve):

```json
  "exports": {
    "./components/*.stories": null,
    "./components/*.test": null,
    "./lib/*.test": null,
    "./components/*": "./src/components/*.tsx",
    "./lib/*": "./src/lib/*.ts",
    "./styles/*": "./src/styles/*"
  },
```

- [ ] **Step 7: Verify toàn bộ + root**

```bash
pnpm --filter @tempo/ui test && pnpm --filter @tempo/ui typecheck && pnpm --filter @tempo/ui build-storybook
pnpm typecheck && pnpm --filter @tempo/web build
```

Expected: tất cả exit 0 (21 tests; web build không đổi hành vi).

- [ ] **Step 8: Commit**

```bash
git add packages/ui
git commit -m "feat: add DropdownMenu, Tabs, Tooltip, Alert primitives + exports hygiene"
```

---

### Task 7: Push + PR

- [ ] **Step 1:**

```bash
git push -u origin feature/design-system-primitives
gh pr create --base main --head feature/design-system-primitives \
  --title "feat: @tempo/ui primitives — 14 components shadcn-style, Tempo restyle" \
  --body "Đợt 2/4 theo spec. 14 primitives (Button, Card, Badge, Input, Textarea, Label, Select, Dialog, AlertDialog, DropdownMenu, Tabs, Tooltip, Alert, Skeleton, Spinner, Separator) + stories đủ variant, exports hygiene. Visual check 2 theme trên Storybook trước khi merge."
```

- [ ] **Step 2: Báo user review + visual check Storybook.** KHÔNG tự merge.

---

## Self-review (đã chạy)

1. **Spec coverage:** đủ 14 dòng bảng primitives của spec §4 (Input/Textarea/Label chung Task 3; 16 file component). A11y đến từ Radix + addon a11y có sẵn trong Storybook; focus-visible ring nhất quán. Exports hygiene = note #1 của final review đợt 1. Note #2 (@source narrowing) chủ động KHÔNG làm — story/test bị chặn ở exports nhưng utility scan vô hại, đúng khuyến nghị "defer".
2. **Placeholder scan:** không TBD; mọi component có code đầy đủ; màu/padding dịch từ CSS thật (đã đọc globals.css 162-627). Chuẩn hoá warning #eab308→token warning ghi rõ CÓ CHỦ ĐÍCH.
3. **Type consistency:** mọi import nội bộ relative; `buttonVariants` dùng ở alert-dialog khớp export Task 1; token utilities (rounded-button/input/card/badge, bg-popover, border-border-subtle, animate-fade-in/slide-up…) đều tồn tại từ tokens.css đợt 1.
