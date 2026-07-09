# Tempo Design System — Đợt 3: Domain Components — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 11 domain components (VoteBar, GaStatusBadge, ActionIdChip, CopyButton/CopyableId, DRepAvatar, StatCell, AdaAmount, NetworkBadge, MarkdownEditor, RichMarkdownEditor, WalletConnectModal) trích xuất từ apps/web sang `@tempo/ui`, kèm stories + vitest cho phần có logic.

**Architecture:** Theo spec [2026-07-08-tempo-design-system-design.md](../specs/2026-07-08-tempo-design-system-design.md) §4 (bảng Domain components). Code viết SẴN trong plan — dịch 1:1 từ component apps/web hiện tại (đã đọc source), đổi class cũ → token đợt 1 theo bảng mapping bên dưới. Implementer chép verbatim, không tự thiết kế lại. **Đợt này KHÔNG migrate apps/web** — chỉ tạo component trong DS (migrate là đợt riêng, ngoài phạm vi spec §8).

**Tech Stack:** React 19, DS primitives đợt 2 (Badge, Dialog, Skeleton, Spinner), `marked`, `@uiw/react-md-editor`, `bech32`, Tailwind v4 tokens, Storybook 9, Vitest.

## Global Constraints

- KHÔNG sửa apps/web. KHÔNG restart API server/port 8080.
- Mọi component: file mới trong `packages/ui/src/components/`, kebab-case, story co-located `<name>.stories.tsx`.
- Import nội bộ package dùng relative (`../lib/utils`), KHÔNG dùng `@tempo/ui/*` (tự tham chiếu).
- Export named (không default), `className` pass-through merge bằng `cn()`, KHÔNG `useT()`/store/fetch/`next/*` (không next/image, next/link, next/dynamic — DS không phụ thuộc Next).
- i18n-free: mọi text hiển thị qua props (`label`, `labels{}`, callback `(n) => string`).
- Types Storybook import từ `"@storybook/react-vite"`. KHÔNG dùng `React.` namespace — import type trực tiếp từ `"react"`.
- Story data tĩnh; story cần state dùng wrapper component có `useState` ngay trong file story.
- Verify mỗi task: `pnpm --filter @tempo/ui test && pnpm --filter @tempo/ui typecheck && pnpm --filter @tempo/ui build-storybook` exit 0.
- Branch: `feature/design-system-domain` — **base từ `feature/design-system-primitives`** (đợt 3 dùng Badge/Dialog/Skeleton/Spinner của đợt 2; PR #115 chưa merge). Nếu lúc thực thi PR #115 đã merge vào main → base từ main.
- Commit prefix `feat:`. Verify TS ở root khi kết thúc: `pnpm typecheck` (tránh stale-dist — CLAUDE.md).
- `packages/ui/package.json` exports đã wildcard (`./components/*`, `./lib/*`, `./styles/*`) — file mới tự được export, KHÔNG cần sửa exports.

### Bảng mapping class cũ → token DS (dùng xuyên suốt)

| globals.css / class cũ | DS utility |
|---|---|
| `text-text-primary` | `text-foreground` |
| `text-text-secondary` | `text-muted-foreground` |
| `text-text-muted` | `text-muted-foreground-subtle` |
| `bg-bg-primary` | `bg-background` |
| `bg-bg-secondary` | `bg-secondary` |
| `bg-bg-card` | `bg-card` |
| `bg-bg-card-hover` | `bg-muted` |
| `bg-bg-elevated` | `bg-popover` |
| `border-border-default` | `border-border` |
| `border-border-subtle` | `border-border-subtle` (giữ nguyên) |
| `accent` (indigo cũ) | `primary` |
| `accent-light` | `primary-light` |
| `text-danger` / `danger` | `text-destructive` / `destructive` |
| `success` / `warning` | `success` / `warning` (giữ nguyên) |

Trong file CSS thuần của DS (Task 7-8): dùng biến gốc `var(--secondary)`, `var(--foreground)`, `var(--border-subtle)`, `var(--popover)`, `var(--muted-foreground)`, `var(--muted-foreground-subtle)`, `var(--primary)`, `var(--primary-light)`, `var(--card)`, `var(--background)` — KHÔNG dùng `var(--color-*)` (không chắc được emit khi `@theme inline`).

### Chuẩn hoá CÓ CHỦ ĐÍCH (deviation khỏi bản gốc, ghi rõ để reviewer biết)

1. **NetworkBadge preprod:** `#eab308` → token `warning` (nhất quán với Alert đợt 2). Mainnet `#22c55e` → token `success` (dark success = `#22c55e`, khớp).
2. **VoteBar min-sliver 0.5%** áp dụng cho MỌI segment > 0 (bản gốc chỉ áp cho SPO row — PR #110); DRep/CC hưởng cùng hành vi.
3. **formatAda dedup:** DS `lib/format.ts` (đã có từ đợt 1, có tier B, `toFixed(0)` dưới 1K) là bản chuẩn — bản DRepBanner (`toFixed(2)` dưới 1K) sẽ đổi theo khi migrate. **KHÔNG thêm alias `lovelaceToAda`** dù spec liệt kê: implementation apps/web giống hệt `formatAda` (đã đối chiếu), thêm alias là duplication.
4. **CopyableId** dùng `truncateMiddle(id, 10, 7)` — ngưỡng giữ-nguyên là ≤18 ký tự thay vì ≤20 của bản gốc; DRep ID thực tế 56+ ký tự nên không đổi hành vi thực.
5. **RichMarkdownEditor:** import `@uiw/react-md-editor` TĨNH (DS không có next/dynamic). App wrapper khi migrate phải tự bọc `dynamic(() => import(...), { ssr: false })`. Storybook (client-only) không cần.
6. **WalletConnectModal** chỉ phủ 2 state "chọn ví" + "đang kết nối" (đúng API spec: `open, wallets[], connectingId?, error?, onSelect, labels{}`). State "đã kết nối" (DRep panel, address row…) ở lại app wrapper — logic đó nối store/hooks, vi phạm data-free.

---

### Task 1: Branch + deps + lib (clipboard, gov-action-id)

**Files:**
- Modify: `packages/ui/package.json` (dependencies)
- Create: `packages/ui/src/lib/clipboard.ts`, `packages/ui/src/lib/gov-action-id.ts`
- Test: `packages/ui/src/lib/gov-action-id.test.ts`

**Interfaces:**
- Produces: `copyToClipboard(text: string): void` (Task 4, 5); `govActionIdToBech32(txHash: string, index: number): string` (Task 4).

- [ ] **Step 1: Tạo branch**

```bash
git checkout feature/design-system-primitives && git pull origin feature/design-system-primitives
git checkout -b feature/design-system-domain
```

(Nếu PR #115 đã merge: `git checkout main && git pull origin main && git checkout -b feature/design-system-domain`.)

- [ ] **Step 2: Thêm dependencies vào `packages/ui/package.json`**

Thêm vào block `"dependencies"` (giữ thứ tự alphabet):

```json
    "@uiw/react-md-editor": "^4.1.1",
    "bech32": "^2.0.0",
    "marked": "^18.0.5",
```

(Cùng version với apps/web — pnpm dedupe về 1 bản.) Chạy:

```bash
pnpm install
```

Expected: exit 0.

- [ ] **Step 3: Viết `packages/ui/src/lib/clipboard.ts`** (copy verbatim từ `apps/web/lib/clipboard.ts`)

```ts
/**
 * Copy text to clipboard with fallback for non-secure contexts (HTTP over LAN).
 * navigator.clipboard is only available on HTTPS or localhost.
 */
export function copyToClipboard(text: string): void {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text)
    return
  }
  const el = document.createElement("textarea")
  el.value = text
  el.style.position = "fixed"
  el.style.opacity = "0"
  document.body.appendChild(el)
  el.select()
  document.execCommand("copy")
  document.body.removeChild(el)
}
```

- [ ] **Step 4: Viết test fail — `packages/ui/src/lib/gov-action-id.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { bech32 } from "bech32"
import { govActionIdToBech32 } from "./gov-action-id"

const TX_HASH = "a".repeat(64) // 32 bytes hex hợp lệ

describe("govActionIdToBech32", () => {
  it("encode đúng CIP-129: prefix gov_action, payload = 32 bytes txHash + 1 byte index", () => {
    const out = govActionIdToBech32(TX_HASH, 3)
    expect(out.startsWith("gov_action1")).toBe(true)
    const decoded = bech32.decode(out, 200)
    expect(decoded.prefix).toBe("gov_action")
    const payload = bech32.fromWords(decoded.words)
    expect(payload).toHaveLength(33)
    expect(payload[0]).toBe(0xaa)
    expect(payload[32]).toBe(3)
  })

  it("index khác nhau cho output khác nhau", () => {
    expect(govActionIdToBech32(TX_HASH, 0)).not.toBe(govActionIdToBech32(TX_HASH, 1))
  })
})
```

- [ ] **Step 5: Chạy fail**

```bash
pnpm --filter @tempo/ui test -- gov-action-id
```

Expected: FAIL — `Cannot find module './gov-action-id'` (hoặc tương đương).

- [ ] **Step 6: Viết `packages/ui/src/lib/gov-action-id.ts`** (dịch từ `apps/web/lib/governance.ts` — giữ nguyên hành vi trả `""` khi lỗi)

```ts
import { bech32 } from "bech32"

/** CIP-129: txHash (32 bytes hex) + index (1 byte) → bech32 "gov_action1…". Trả "" nếu encode lỗi. */
export function govActionIdToBech32(txHash: string, index: number): string {
  try {
    const payload = new Uint8Array(33)
    for (let i = 0; i < 32; i++) {
      payload[i] = parseInt(txHash.slice(i * 2, i * 2 + 2), 16)
    }
    payload[32] = index & 0xff
    return bech32.encode("gov_action", bech32.toWords(payload), 200)
  } catch {
    return ""
  }
}
```

- [ ] **Step 7: Chạy pass**

```bash
pnpm --filter @tempo/ui test -- gov-action-id
```

Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
git add packages/ui pnpm-lock.yaml
git commit -m "feat: add DS deps (marked, md-editor, bech32) + clipboard/gov-action-id libs"
```

---

### Task 2: VoteBar

**Files:**
- Create: `packages/ui/src/components/vote-bar.tsx`, `vote-bar.stories.tsx`
- Test: `packages/ui/src/components/vote-bar.test.ts`

**Interfaces:**
- Produces: `VoteBar({ segments, threshold?, className? })`, `VoteBarSegment { value, color, label? }`, `voteBarSegmentWidth(value: number): number`, hằng `MIN_SLIVER_PERCENT = 0.5`, `LABEL_MIN_PERCENT = 12`. App khi migrate sẽ compose VoteBar vào row DRep/SPO/CC (label, stake details, i18n ở lại app).

- [ ] **Step 1: Viết test fail — `packages/ui/src/components/vote-bar.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { voteBarSegmentWidth, MIN_SLIVER_PERCENT } from "./vote-bar"

describe("voteBarSegmentWidth", () => {
  it("0 → 0 (không sliver khi không có vote)", () => {
    expect(voteBarSegmentWidth(0)).toBe(0)
  })
  it("giá trị dương dưới 0.5% → sliver 0.5% (PR #110)", () => {
    expect(voteBarSegmentWidth(0.01)).toBe(MIN_SLIVER_PERCENT)
    expect(voteBarSegmentWidth(0.49)).toBe(MIN_SLIVER_PERCENT)
  })
  it("giá trị ≥ 0.5% giữ nguyên", () => {
    expect(voteBarSegmentWidth(0.5)).toBe(0.5)
    expect(voteBarSegmentWidth(67)).toBe(67)
  })
  it("giá trị âm → 0", () => {
    expect(voteBarSegmentWidth(-1)).toBe(0)
  })
})
```

- [ ] **Step 2: Chạy fail**

```bash
pnpm --filter @tempo/ui test -- vote-bar
```

Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Viết `packages/ui/src/components/vote-bar.tsx`**

Dịch từ `.vote-bar/.vote-bar-yes/.vote-bar-no` (globals.css 387-412) + threshold marker + label-in-bar của `VoteResultsPanel.tsx`. Gộp 3 bản DRep/SPO/CC thành 1 bar generic.

```tsx
import { cn } from "../lib/utils"

/** Sliver tối thiểu (%) để segment > 0 vẫn nhìn thấy được (PR #110). */
export const MIN_SLIVER_PERCENT = 0.5
/** Ngưỡng % để hiện label bên trong segment (bản gốc: yesPercent > 12). */
export const LABEL_MIN_PERCENT = 12

/** Width render của segment: 0 giữ 0, giá trị dương nhỏ được nâng lên sliver. */
export function voteBarSegmentWidth(value: number): number {
  if (value <= 0) return 0
  return Math.max(value, MIN_SLIVER_PERCENT)
}

export type VoteBarSegmentColor = "yes" | "no" | "abstain" | "not-voted"

export interface VoteBarSegment {
  /** Phần trăm 0–100 */
  value: number
  color: VoteBarSegmentColor
  /** Hiện bên trong segment khi value > LABEL_MIN_PERCENT (vd "67%") */
  label?: string
}

const SEGMENT_CLS: Record<VoteBarSegmentColor, string> = {
  yes: "bg-vote-yes",
  no: "bg-vote-no",
  abstain: "bg-vote-abstain",
  "not-voted": "bg-vote-abstain/20",
}

export interface VoteBarProps {
  segments: VoteBarSegment[]
  /** Vạch ngưỡng 0–100; null/undefined = không hiện */
  threshold?: number | null
  className?: string
}

export function VoteBar({ segments, threshold, className }: VoteBarProps) {
  return (
    <div className={cn("relative", className)}>
      <div className="flex h-3.5 overflow-hidden rounded-md bg-popover">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center justify-center overflow-hidden transition-[width] duration-[600ms]",
              SEGMENT_CLS[seg.color]
            )}
            style={{ width: `${voteBarSegmentWidth(seg.value)}%` }}
          >
            {seg.label !== undefined && seg.value > LABEL_MIN_PERCENT && (
              <span className="select-none px-1.5 text-[10px] font-bold leading-none text-white drop-shadow-sm">
                {seg.label}
              </span>
            )}
          </div>
        ))}
      </div>
      {threshold != null && (
        <div
          className="absolute -bottom-0.5 -top-0.5 z-10 w-0.5 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
          style={{ left: `${threshold}%` }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Chạy pass**

```bash
pnpm --filter @tempo/ui test -- vote-bar
```

Expected: PASS (4 tests).

- [ ] **Step 5: Story — `packages/ui/src/components/vote-bar.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite"
import { VoteBar } from "./vote-bar"

const meta: Meta<typeof VoteBar> = { title: "Domain/VoteBar", component: VoteBar }
export default meta
type Story = StoryObj<typeof VoteBar>

export const DRepWithThreshold: Story = {
  args: {
    segments: [
      { value: 67, color: "yes", label: "67%" },
      { value: 13, color: "no" },
      { value: 20, color: "not-voted" },
    ],
    threshold: 67,
  },
  render: (args) => (
    <div className="max-w-xl">
      <VoteBar {...args} />
    </div>
  ),
}

export const SliverBelowHalfPercent: Story = {
  name: "Sliver 0.5% (PR #110)",
  args: {
    segments: [
      { value: 0.05, color: "yes" },
      { value: 0.02, color: "no" },
    ],
    threshold: 51,
  },
  render: (args) => (
    <div className="max-w-xl">
      <VoteBar {...args} />
    </div>
  ),
}

export const WithAbstain: Story = {
  args: {
    segments: [
      { value: 45, color: "yes", label: "45%" },
      { value: 30, color: "no" },
      { value: 10, color: "abstain" },
      { value: 15, color: "not-voted" },
    ],
  },
  render: (args) => (
    <div className="max-w-xl">
      <VoteBar {...args} />
    </div>
  ),
}

export const ComposedRow: Story = {
  name: "Composed như app (label + threshold %)",
  render: () => (
    <div className="flex max-w-xl items-center gap-3">
      <span className="w-10 shrink-0 text-sm text-muted-foreground">DRep</span>
      <VoteBar
        className="flex-1"
        segments={[
          { value: 72, color: "yes", label: "72%" },
          { value: 8, color: "no" },
          { value: 20, color: "not-voted" },
        ]}
        threshold={67}
      />
      <span className="w-9 shrink-0 text-right text-xs font-semibold text-muted-foreground">67%</span>
    </div>
  ),
}
```

- [ ] **Step 6: Verify + Commit**

```bash
pnpm --filter @tempo/ui test && pnpm --filter @tempo/ui typecheck && pnpm --filter @tempo/ui build-storybook
git add packages/ui
git commit -m "feat: add VoteBar domain component (gộp DRep/SPO/CC, sliver 0.5%)"
```

---

### Task 3: GaStatusBadge + ActionIdChip

**Files:**
- Create: `packages/ui/src/components/ga-status-badge.tsx`, `ga-status-badge.stories.tsx`, `action-id-chip.tsx`, `action-id-chip.stories.tsx`
- Test: `packages/ui/src/components/ga-status-badge.test.ts`

**Interfaces:**
- Consumes: `Badge`, `badgeVariants` (đợt 2, `./badge`); `govActionIdToBech32`, `copyToClipboard` (Task 1).
- Produces: `GaStatusBadge({ status, label, className? })`, `gaStatusToVariant(status: string)`; `ActionIdChip({ txHash, index, size?, copyTitle?, className? })`.

- [ ] **Step 1: Viết test fail — `packages/ui/src/components/ga-status-badge.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { gaStatusToVariant } from "./ga-status-badge"

describe("gaStatusToVariant", () => {
  it.each([
    ["active", "status-active"],
    ["ratified", "status-ratified"],
    ["expired", "status-expired"],
    ["enacted", "status-enacted"],
    ["dropped", "status-dropped"],
  ] as const)("%s → %s", (status, variant) => {
    expect(gaStatusToVariant(status)).toBe(variant)
  })

  it("status lạ fallback về status-active (hành vi bản gốc)", () => {
    expect(gaStatusToVariant("banana")).toBe("status-active")
  })
})
```

- [ ] **Step 2: Chạy fail**

```bash
pnpm --filter @tempo/ui test -- ga-status-badge
```

Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Viết `packages/ui/src/components/ga-status-badge.tsx`** (từ `governance/GaStatusBadge.tsx`; label qua props thay `useT`)

```tsx
import { Badge, type BadgeProps } from "./badge"

const STATUS_VARIANT = {
  active: "status-active",
  ratified: "status-ratified",
  expired: "status-expired",
  enacted: "status-enacted",
  dropped: "status-dropped",
} as const satisfies Record<string, BadgeProps["variant"]>

/** Map status GA → Badge variant; status lạ fallback "status-active" (hành vi bản gốc). */
export function gaStatusToVariant(status: string): BadgeProps["variant"] {
  return STATUS_VARIANT[status as keyof typeof STATUS_VARIANT] ?? "status-active"
}

export interface GaStatusBadgeProps {
  status: string
  /** Text đã dịch — app truyền (i18n-free) */
  label: string
  className?: string
}

export function GaStatusBadge({ status, label, className }: GaStatusBadgeProps) {
  return (
    <Badge variant={gaStatusToVariant(status)} className={className}>
      {label}
    </Badge>
  )
}
```

- [ ] **Step 4: Chạy pass**

```bash
pnpm --filter @tempo/ui test -- ga-status-badge
```

Expected: PASS (6 tests).

- [ ] **Step 5: Viết `packages/ui/src/components/action-id-chip.tsx`** (từ `governance/ActionIdChip.tsx`; `copyTitle` qua props)

```tsx
"use client"

import { useCallback, useState } from "react"
import type { MouseEvent } from "react"
import { cn } from "../lib/utils"
import { copyToClipboard } from "../lib/clipboard"
import { govActionIdToBech32 } from "../lib/gov-action-id"

export interface ActionIdChipProps {
  txHash: string
  index: number
  /** "sm" cho card (rút gọn nhiều), "md" cho trang detail */
  size?: "sm" | "md"
  /** Title nút copy theo mode hiện tại (i18n-free); mặc định "Copy <mode>" */
  copyTitle?: (mode: "hex" | "bech32") => string
  className?: string
}

export function ActionIdChip({ txHash, index, size = "sm", copyTitle, className }: ActionIdChipProps) {
  const [mode, setMode] = useState<"hex" | "bech32">("hex")
  const [copied, setCopied] = useState(false)

  const bech32Id = govActionIdToBech32(txHash, index)
  const hexFull = `${txHash}#${index}`

  const shortHex = `${txHash.slice(0, 8)}…${txHash.slice(-8)}#${index}`
  const shortBech32 = bech32Id ? `${bech32Id.slice(0, 14)}…${bech32Id.slice(-6)}` : ""
  const medHex = `${txHash.slice(0, 16)}…${txHash.slice(-12)}#${index}`
  const medBech32 = bech32Id ? `${bech32Id.slice(0, 22)}…${bech32Id.slice(-8)}` : ""

  const display = size === "md" ? (mode === "hex" ? medHex : medBech32) : (mode === "hex" ? shortHex : shortBech32)
  const fullValue = mode === "hex" ? hexFull : bech32Id

  const copy = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (!fullValue) return
      copyToClipboard(fullValue)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    },
    [fullValue]
  )

  const toggle = useCallback((e: MouseEvent, next: "hex" | "bech32") => {
    e.preventDefault()
    e.stopPropagation()
    setMode(next)
  }, [])

  return (
    <div className={cn("flex items-start gap-2", className)} onClick={(e) => e.preventDefault()}>
      {/* Toggle pill */}
      <div className="mt-0.5 flex shrink-0 items-center overflow-hidden rounded-full border border-border-subtle bg-secondary text-xs">
        {(["hex", "bech32"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={(e) => toggle(e, m)}
            className={cn(
              "px-2.5 py-0.5 font-mono transition-colors",
              mode === m
                ? "bg-primary/20 font-semibold text-primary-light"
                : "text-muted-foreground-subtle hover:text-muted-foreground"
            )}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Value */}
      <span
        className={cn(
          "mt-0.5 min-w-0 break-all font-mono text-muted-foreground",
          size === "md" ? "text-sm" : "text-xs"
        )}
      >
        {display}
      </span>

      {/* Copy button */}
      <button
        type="button"
        onClick={copy}
        title={copyTitle ? copyTitle(mode) : `Copy ${mode}`}
        className="mt-0.5 shrink-0 text-muted-foreground-subtle transition-colors hover:text-primary-light"
      >
        {copied ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
            <polyline points="20,6 9,17 4,12" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Stories**

`packages/ui/src/components/ga-status-badge.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite"
import { GaStatusBadge } from "./ga-status-badge"

const meta: Meta<typeof GaStatusBadge> = { title: "Domain/GaStatusBadge", component: GaStatusBadge }
export default meta
type Story = StoryObj<typeof GaStatusBadge>

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <GaStatusBadge status="active" label="Active" />
      <GaStatusBadge status="ratified" label="Ratified" />
      <GaStatusBadge status="expired" label="Expired" />
      <GaStatusBadge status="enacted" label="Enacted" />
      <GaStatusBadge status="dropped" label="Dropped" />
      <GaStatusBadge status="unknown" label="Unknown → fallback Active" />
    </div>
  ),
}
```

`packages/ui/src/components/action-id-chip.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite"
import { ActionIdChip } from "./action-id-chip"

const TX_HASH = "4b10e5793282f9dd430ec42fdb96b7a410dcbc4a5b6c4e2f1a09d38271b6c4e2"

const meta: Meta<typeof ActionIdChip> = { title: "Domain/ActionIdChip", component: ActionIdChip }
export default meta
type Story = StoryObj<typeof ActionIdChip>

export const SmallCard: Story = { args: { txHash: TX_HASH, index: 0, size: "sm" } }
export const MediumDetail: Story = { args: { txHash: TX_HASH, index: 2, size: "md" } }
export const CustomCopyTitle: Story = {
  args: { txHash: TX_HASH, index: 0, copyTitle: (mode) => `Sao chép ID (${mode})` },
}
```

- [ ] **Step 7: Verify + Commit**

```bash
pnpm --filter @tempo/ui test && pnpm --filter @tempo/ui typecheck && pnpm --filter @tempo/ui build-storybook
git add packages/ui
git commit -m "feat: add GaStatusBadge + ActionIdChip domain components"
```

---

### Task 4: CopyButton + CopyableId + DRepAvatar + StatCell

**Files:**
- Create: `packages/ui/src/components/copy-button.tsx`, `copyable-id.tsx`, `drep-avatar.tsx`, `stat-cell.tsx`, `copy-button.stories.tsx`, `drep-avatar.stories.tsx`, `stat-cell.stories.tsx`

**Interfaces:**
- Consumes: `copyToClipboard` (Task 1), `truncateMiddle` (lib/format đợt 1), `Skeleton` (đợt 2).
- Produces: `CopyButton({ value, title, size?, className? })` (size = px icon, default 13); `CopyableId({ id, className? })`; `DRepAvatar({ id, name?, imageUrl?, size?, className? })` (size px, default 40); `StatCell({ label, value, loading?, highlight?, danger?, fallback?, className? })`. Task 8 KHÔNG dùng các component này (WalletModal có copy row riêng ở app wrapper).

- [ ] **Step 1: Viết `packages/ui/src/components/copy-button.tsx`** (từ `ui/CopyIconButton.tsx` — giữ API, đổi tên theo spec)

```tsx
"use client"

import { useState } from "react"
import { cn } from "../lib/utils"
import { copyToClipboard } from "../lib/clipboard"

export interface CopyButtonProps {
  value: string
  /** Tooltip (i18n-free — app truyền text đã dịch) */
  title: string
  /** icon size px (default 13) */
  size?: number
  className?: string
}

/** Nút copy inline đặt ngay sau ID/hash. Hiện checkmark xanh 1.5s sau khi copy. */
export function CopyButton({ value, title, size = 13, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        copyToClipboard(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      title={title}
      className={cn(
        "ml-1.5 inline-flex align-middle text-muted-foreground-subtle transition-colors hover:text-primary-light",
        className
      )}
    >
      {copied ? (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
          <polyline points="20,6 9,17 4,12" />
        </svg>
      ) : (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Viết `packages/ui/src/components/copyable-id.tsx`** (từ `ui/CopyableId.tsx`; dùng `truncateMiddle` — xem Chuẩn hoá #4)

```tsx
"use client"

import { useState } from "react"
import type { MouseEvent } from "react"
import { cn } from "../lib/utils"
import { copyToClipboard } from "../lib/clipboard"
import { truncateMiddle } from "../lib/format"

export interface CopyableIdProps {
  id: string
  className?: string
}

/** ID rút gọn dạng text, click để copy; hiện ✓ 1.5s. */
export function CopyableId({ id, className }: CopyableIdProps) {
  const [copied, setCopied] = useState(false)

  function copy(e: MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    copyToClipboard(id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button type="button" onClick={copy} title={id} className={cn("text-left", className)}>
      <span className="font-mono text-[11px] leading-tight text-muted-foreground-subtle transition-colors hover:text-muted-foreground">
        {truncateMiddle(id, 10, 7)}
        {copied && <span className="ml-1 text-[10px] text-success">✓</span>}
      </span>
    </button>
  )
}
```

- [ ] **Step 3: Viết `packages/ui/src/components/drep-avatar.tsx`**

Hợp nhất 2 bản (`drep/DRepAvatar.tsx` + bản trong `DRepProfileCard.tsx`): gradient hash HSL (bản ProfileCard — generic hơn 6 palette cố định), IPFS gateway fallback (bản drep/), size px tự do (bản ProfileCard; sm/md cũ = 32/40). Hết gateway → fallback về initial (bản gốc kẹt ở gateway cuối).

```tsx
"use client"

import { useState } from "react"
import { cn } from "../lib/utils"

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
]

function resolveIpfsSrc(url: string, gwIdx: number): string {
  if (url.startsWith("ipfs://")) {
    return IPFS_GATEWAYS[Math.min(gwIdx, IPFS_GATEWAYS.length - 1)]! + url.slice(7)
  }
  for (const gw of IPFS_GATEWAYS) {
    if (url.startsWith(gw)) {
      return IPFS_GATEWAYS[Math.min(gwIdx, IPFS_GATEWAYS.length - 1)]! + url.slice(gw.length)
    }
  }
  return url
}

function hashToColors(str: string): [string, string] {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  const hue1 = (h >>> 0) % 360
  return [`hsl(${hue1},65%,55%)`, `hsl(${(hue1 + 137) % 360},65%,45%)`]
}

export interface DRepAvatarProps {
  /** Seed cho gradient fallback (DRep ID / credential hex) */
  id: string
  name?: string | null
  imageUrl?: string | null
  /** px (default 40) */
  size?: number
  className?: string
}

export function DRepAvatar({ id, name, imageUrl, size = 40, className }: DRepAvatarProps) {
  const [colors] = useState(() => hashToColors(id))
  const [gwIdx, setGwIdx] = useState(0)
  const initial = (name ?? id).charAt(0).toUpperCase()

  const src = imageUrl && gwIdx < IPFS_GATEWAYS.length ? resolveIpfsSrc(imageUrl, gwIdx) : null

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? "DRep"}
        width={size}
        height={size}
        className={cn("shrink-0 rounded-full border border-border-subtle object-cover", className)}
        style={{ width: size, height: size }}
        onError={() => setGwIdx((i) => i + 1)}
      />
    )
  }

  return (
    <div
      className={cn("flex shrink-0 select-none items-center justify-center rounded-full font-bold text-white", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
      }}
    >
      {initial}
    </div>
  )
}
```

- [ ] **Step 4: Viết `packages/ui/src/components/stat-cell.tsx`** (dedup 2 bản giống hệt trong DRepBanner + DRepProfileCard; loading block dùng Skeleton đợt 2)

```tsx
import { cn } from "../lib/utils"
import { Skeleton } from "./skeleton"

export interface StatCellProps {
  label: string
  value: string | null
  loading?: boolean
  highlight?: boolean
  danger?: boolean
  /** Hiện khi value null và không loading (default "—") */
  fallback?: string
  className?: string
}

export function StatCell({ label, value, loading = false, highlight = false, danger = false, fallback = "—", className }: StatCellProps) {
  return (
    <div className={cn("space-y-0.5 px-3 py-2.5", className)}>
      <p className="text-[11px] leading-tight text-muted-foreground-subtle">{label}</p>
      {loading && !value ? (
        <Skeleton className="mt-1 h-5 w-20" />
      ) : (
        <p
          className={cn(
            "text-sm font-bold leading-tight",
            danger ? "text-destructive" : highlight ? "text-primary-light" : "text-foreground"
          )}
        >
          {value ?? fallback}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Stories** (3 file)

`packages/ui/src/components/copy-button.stories.tsx` (phủ cả CopyableId):

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite"
import { CopyButton } from "./copy-button"
import { CopyableId } from "./copyable-id"

const DREP_ID = "drep1y29h6wkwnk7yr9m3xemyyvpe2mzmy0d6z2wq4xj6kgw2c6q4gt5j2"

const meta: Meta<typeof CopyButton> = { title: "Domain/CopyButton", component: CopyButton }
export default meta
type Story = StoryObj<typeof CopyButton>

export const InlineAfterId: Story = {
  render: () => (
    <p className="font-mono text-xs text-muted-foreground">
      {DREP_ID.slice(0, 20)}…
      <CopyButton value={DREP_ID} title="Copy DRep ID" />
    </p>
  ),
}

export const LargerIcon: Story = {
  render: () => <CopyButton value={DREP_ID} title="Copy" size={18} />,
}

export const CopyableIdStory: Story = {
  name: "CopyableId",
  render: () => (
    <div className="space-y-2">
      <CopyableId id={DREP_ID} />
      <CopyableId id="short-id" />
    </div>
  ),
}
```

`packages/ui/src/components/drep-avatar.stories.tsx`:

```tsx
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
```

`packages/ui/src/components/stat-cell.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite"
import { StatCell } from "./stat-cell"

const meta: Meta<typeof StatCell> = { title: "Domain/StatCell", component: StatCell }
export default meta
type Story = StoryObj<typeof StatCell>

export const StatsGrid: Story = {
  name: "Grid 2×3 như DRepBanner",
  render: () => (
    <div className="max-w-xl divide-y divide-border-subtle rounded-card border border-border-subtle bg-secondary">
      <div className="grid grid-cols-3 divide-x divide-border-subtle">
        <StatCell label="Active Voting Power" value="1.2M ₳" />
        <StatCell label="Live Voting Power" value="1.3M ₳" />
        <StatCell label="Delegators" value="1,024" />
      </div>
      <div className="grid grid-cols-3 divide-x divide-border-subtle">
        <StatCell label="Influence" value="2.15%" highlight />
        <StatCell label="Voted" value="98.50%" highlight />
        <StatCell label="Not Voted" value="12.00%" danger />
      </div>
    </div>
  ),
}

export const States: Story = {
  render: () => (
    <div className="grid max-w-md grid-cols-3 divide-x divide-border-subtle rounded-card border border-border-subtle bg-secondary">
      <StatCell label="Loading" value={null} loading />
      <StatCell label="Fallback" value={null} />
      <StatCell label="Custom fallback" value={null} fallback="0 ₳" />
    </div>
  ),
}
```

- [ ] **Step 6: Verify + Commit**

```bash
pnpm --filter @tempo/ui test && pnpm --filter @tempo/ui typecheck && pnpm --filter @tempo/ui build-storybook
git add packages/ui
git commit -m "feat: add CopyButton, CopyableId, DRepAvatar, StatCell domain components"
```

---

### Task 5: AdaAmount + NetworkBadge

**Files:**
- Create: `packages/ui/src/components/ada-amount.tsx`, `network-badge.tsx`, `ada-amount.stories.tsx`, `network-badge.stories.tsx`

**Interfaces:**
- Consumes: `formatAda` (lib/format đợt 1 — dedup 4 bản copy trong apps/web, xem Chuẩn hoá #3).
- Produces: `AdaAmount({ lovelace, symbol?, className?, ...span props })` (symbol: "₳" | "ADA", default "₳"); `NetworkBadge({ network, className? })` (network: "mainnet" | "preprod").

- [ ] **Step 1: Viết `packages/ui/src/components/ada-amount.tsx`**

```tsx
import type { HTMLAttributes } from "react"
import { cn } from "../lib/utils"
import { formatAda } from "../lib/format"

export interface AdaAmountProps extends HTMLAttributes<HTMLSpanElement> {
  lovelace: number
  symbol?: "₳" | "ADA"
}

/** Hiển thị lovelace dạng ADA gọn (1.23B · 595.01M · 1.5K) + ký hiệu. */
export function AdaAmount({ lovelace, symbol = "₳", className, ...props }: AdaAmountProps) {
  return (
    <span className={cn("tabular-nums", className)} {...props}>
      {formatAda(lovelace)} {symbol}
    </span>
  )
}
```

- [ ] **Step 2: Viết `packages/ui/src/components/network-badge.tsx`** (dịch từ `.network-badge-mainnet/-preprod` globals.css 562-590 + dot trong WalletModal; màu chuẩn hoá về token — Chuẩn hoá #1)

```tsx
import { cn } from "../lib/utils"

const NETWORK_STYLES = {
  mainnet: { badge: "border-success/30 bg-success/12 text-success", dot: "bg-success", label: "Mainnet" },
  preprod: { badge: "border-warning/30 bg-warning/12 text-warning", dot: "bg-warning", label: "Preprod" },
} as const

export interface NetworkBadgeProps {
  network: "mainnet" | "preprod"
  className?: string
}

export function NetworkBadge({ network, className }: NetworkBadgeProps) {
  const s = NETWORK_STYLES[network]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wider",
        s.badge,
        className
      )}
    >
      <span className={cn("inline-block size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  )
}
```

("Mainnet"/"Preprod" là tên riêng, không cần i18n. `tracking-wider` = 0.05em ≈ 0.06em bản gốc.)

- [ ] **Step 3: Stories** (2 file)

`packages/ui/src/components/ada-amount.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite"
import { AdaAmount } from "./ada-amount"

const meta: Meta<typeof AdaAmount> = { title: "Domain/AdaAmount", component: AdaAmount }
export default meta
type Story = StoryObj<typeof AdaAmount>

export const Tiers: Story = {
  render: () => (
    <div className="space-y-1 text-sm text-foreground">
      <p><AdaAmount lovelace={1_234_567_890_000_000} /> (tier B)</p>
      <p><AdaAmount lovelace={595_010_000_000_000} /> (tier M)</p>
      <p><AdaAmount lovelace={1_500_000_000} /> (tier K)</p>
      <p><AdaAmount lovelace={999_000_000} /> (dưới 1K)</p>
      <p><AdaAmount lovelace={1_500_000_000} symbol="ADA" /> (symbol ADA)</p>
    </div>
  ),
}
```

`packages/ui/src/components/network-badge.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react-vite"
import { NetworkBadge } from "./network-badge"

const meta: Meta<typeof NetworkBadge> = { title: "Domain/NetworkBadge", component: NetworkBadge }
export default meta
type Story = StoryObj<typeof NetworkBadge>

export const Both: Story = {
  render: () => (
    <div className="flex gap-3">
      <NetworkBadge network="mainnet" />
      <NetworkBadge network="preprod" />
    </div>
  ),
}
```

- [ ] **Step 4: Verify + Commit**

```bash
pnpm --filter @tempo/ui test && pnpm --filter @tempo/ui typecheck && pnpm --filter @tempo/ui build-storybook
git add packages/ui
git commit -m "feat: add AdaAmount + NetworkBadge domain components"
```

---

### Task 6: MarkdownEditor (nhẹ — textarea + marked)

**Files:**
- Create: `packages/ui/src/components/markdown-editor.tsx`, `markdown-editor.stories.tsx`, `packages/ui/src/styles/markdown-editor.css`

**Interfaces:**
- Consumes: `marked` (Task 1).
- Produces: `MarkdownEditor({ value, onChange, labels, placeholder?, rows?, id?, maxLength?, className? })`, `MarkdownEditorLabels { write, preview, empty, charsRemaining? }`.

- [ ] **Step 1: Viết `packages/ui/src/styles/markdown-editor.css`** (chuyển `.markdown-preview` từ globals.css 743-776; đổi `--color-*` cũ → biến gốc DS)

```css
/* MarkdownEditor — preview panel (theme-aware qua biến gốc tokens.css) */
.tempo-markdown-preview p { margin: 0 0 0.6em; }
.tempo-markdown-preview p:last-child { margin-bottom: 0; }
.tempo-markdown-preview strong { color: var(--foreground); font-weight: 600; }
.tempo-markdown-preview em { font-style: italic; color: var(--muted-foreground); }
.tempo-markdown-preview h1, .tempo-markdown-preview h2, .tempo-markdown-preview h3 {
  color: var(--foreground);
  font-weight: 700;
  margin: 0.8em 0 0.3em;
  line-height: 1.3;
}
.tempo-markdown-preview h1 { font-size: 1.1em; }
.tempo-markdown-preview h2 { font-size: 1em; }
.tempo-markdown-preview h3 { font-size: 0.9em; }
.tempo-markdown-preview ul, .tempo-markdown-preview ol {
  padding-left: 1.4em;
  margin: 0.4em 0;
}
.tempo-markdown-preview ul { list-style-type: disc; }
.tempo-markdown-preview ol { list-style-type: decimal; }
.tempo-markdown-preview li { margin: 0.2em 0; }
.tempo-markdown-preview a { color: var(--primary); text-decoration: underline; }
.tempo-markdown-preview code {
  font-family: monospace;
  font-size: 0.85em;
  background: var(--background);
  border-radius: 3px;
  padding: 1px 4px;
}
.tempo-markdown-preview blockquote {
  border-left: 3px solid var(--primary);
  padding-left: 0.8em;
  color: var(--muted-foreground-subtle);
  margin: 0.5em 0;
}
```

(Prefix `tempo-` để không đụng class `.markdown-preview` cũ của app khi cả 2 cùng load trong giai đoạn migrate.)

- [ ] **Step 2: Viết `packages/ui/src/components/markdown-editor.tsx`** (từ `ui/MarkdownEditor.tsx`; labels qua props; bỏ `useCallback` bọc hàm gọi ngay trong render — gọi `marked.parse` trực tiếp, tương đương)

```tsx
"use client"

import { useState } from "react"
import { marked } from "marked"
import { cn } from "../lib/utils"
import "../styles/markdown-editor.css"

export interface MarkdownEditorLabels {
  write: string
  preview: string
  /** Text hiện khi preview rỗng */
  empty: string
  /** Counter (vd (n) => `${n} ký tự còn lại`) — chỉ hiện khi có maxLength */
  charsRemaining?: (count: string) => string
}

export interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  labels: MarkdownEditorLabels
  placeholder?: string
  rows?: number
  id?: string
  maxLength?: number
  className?: string
}

export function MarkdownEditor({ value, onChange, labels, placeholder, rows = 5, id, maxLength, className }: MarkdownEditorProps) {
  const [tab, setTab] = useState<"write" | "preview">("write")
  const remaining = maxLength !== undefined ? maxLength - value.length : null
  const isOver = remaining !== null && remaining < 0

  const html = value.trim() ? (marked.parse(value, { async: false }) as string) : ""

  const tabCls = (active: boolean) =>
    cn(
      "px-4 py-2 text-xs font-medium transition-colors",
      active
        ? "-mb-px border-b-2 border-primary text-foreground"
        : "text-muted-foreground-subtle hover:text-muted-foreground"
    )

  return (
    <div className={cn("overflow-hidden rounded-card border border-border-subtle bg-popover", className)}>
      {/* Tab bar */}
      <div className="flex border-b border-border-subtle">
        <button type="button" onClick={() => setTab("write")} className={tabCls(tab === "write")}>
          {labels.write}
        </button>
        <button type="button" onClick={() => setTab("preview")} className={tabCls(tab === "preview")}>
          {labels.preview}
        </button>
        <div className="flex-1" />
        <span className="select-none px-3 py-2 text-xs text-muted-foreground-subtle opacity-50">Markdown</span>
      </div>

      {/* Write */}
      {tab === "write" && (
        <textarea
          id={id}
          rows={rows}
          value={value}
          onChange={(e) => {
            const v = e.target.value
            if (maxLength !== undefined && v.length > maxLength + 50) return
            onChange(v)
          }}
          placeholder={placeholder}
          className="w-full resize-none bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground-subtle"
        />
      )}

      {/* Preview */}
      {tab === "preview" && (
        <div
          className="tempo-markdown-preview px-4 py-3 text-sm leading-relaxed text-foreground"
          style={{ minHeight: `${rows * 1.6}rem` }}
        >
          {value.trim() ? (
            // marked output — backend lưu raw markdown, không có đường injection script từ user
            <div dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <span className="italic text-muted-foreground-subtle">{labels.empty}</span>
          )}
        </div>
      )}

      {/* Character counter */}
      {remaining !== null && labels.charsRemaining && (
        <div className={cn("px-4 pb-2 text-right text-xs", isOver ? "font-medium text-destructive" : "text-muted-foreground-subtle")}>
          {labels.charsRemaining(remaining.toLocaleString())}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Story — `packages/ui/src/components/markdown-editor.stories.tsx`**

```tsx
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
```

- [ ] **Step 4: Verify + Commit**

```bash
pnpm --filter @tempo/ui test && pnpm --filter @tempo/ui typecheck && pnpm --filter @tempo/ui build-storybook
git add packages/ui
git commit -m "feat: add MarkdownEditor domain component (marked, tabs write/preview)"
```

---

### Task 7: RichMarkdownEditor (nặng — @uiw/react-md-editor)

**Files:**
- Create: `packages/ui/src/components/rich-markdown-editor.tsx`, `rich-markdown-editor.stories.tsx`, `packages/ui/src/styles/rich-markdown-editor.css`

**Interfaces:**
- Consumes: `@uiw/react-md-editor` (Task 1).
- Produces: `RichMarkdownEditor({ value, onChange, labels, label?, description?, placeholder?, maxLength?, height?, optional?, colorMode?, className? })`, `RichMarkdownEditorLabels { modeEdit, modeSplit, modePreview, optional, charsRemaining, charCount }`. **Import tĩnh — app wrapper phải bọc `next/dynamic` ssr:false khi migrate (Chuẩn hoá #5).**

- [ ] **Step 1: Viết `packages/ui/src/styles/rich-markdown-editor.css`** (chuyển ~110 dòng `.rationale-editor-wrap` từ globals.css 628-740; đổi biến: `--color-bg-secondary`→`--secondary`, `--color-border-subtle`→`--border-subtle`, `--color-text-primary`→`--foreground`, `--color-bg-elevated`→`--popover`, `--color-text-secondary`→`--muted-foreground`, `--color-bg-card`→`--card`, `--color-accent-light`→`--primary-light`, `--color-accent`→`--primary`, `--color-text-muted`→`--muted-foreground-subtle`)

```css
/* ── @uiw/react-md-editor — Tempo skin (theme-aware qua biến gốc tokens.css) ── */
.tempo-rich-md-wrap .w-md-editor {
  --md-editor-background-color: var(--secondary);
  --md-editor-box-shadow-color: var(--border-subtle);
  --color-fg-default: var(--foreground);
  --color-canvas-default: var(--secondary);
  --color-border-default: var(--border-subtle);
  --color-neutral-muted: var(--popover);
  --color-accent-fg: var(--primary-light);
  background-color: var(--secondary);
  border-radius: 0.75rem;
  box-shadow: 0 0 0 1px var(--border-subtle);
  color: var(--foreground);
}

.tempo-rich-md-wrap .w-md-editor-toolbar {
  background-color: var(--popover);
  border-bottom: 1px solid var(--border-subtle);
  border-radius: 0.75rem 0.75rem 0 0;
  padding: 4px 6px;
}

.tempo-rich-md-wrap .w-md-editor-toolbar ul li button {
  color: var(--muted-foreground);
  border-radius: 4px;
}

.tempo-rich-md-wrap .w-md-editor-toolbar ul li button:hover,
.tempo-rich-md-wrap .w-md-editor-toolbar ul li.active button {
  color: var(--foreground);
  background-color: var(--card);
}

/* Divider giữa các nhóm toolbar */
.tempo-rich-md-wrap .w-md-editor-toolbar li.divider {
  background-color: var(--border-subtle);
}

/* Vùng textarea */
.tempo-rich-md-wrap .w-md-editor-text-pre,
.tempo-rich-md-wrap .w-md-editor-text-input,
.tempo-rich-md-wrap .w-md-editor-text {
  color: var(--foreground) !important;
  caret-color: var(--foreground);
}

/* Preview pane */
.tempo-rich-md-wrap .w-md-editor-preview {
  background-color: var(--secondary);
  box-shadow: inset 1px 0 0 0 var(--border-subtle);
}

.tempo-rich-md-wrap .w-md-editor-preview .wmde-markdown {
  background-color: transparent;
  color: var(--foreground);
  font-size: 0.875rem;
  line-height: 1.6;
}

/* Markdown elements trong preview */
.tempo-rich-md-wrap .wmde-markdown h1,
.tempo-rich-md-wrap .wmde-markdown h2,
.tempo-rich-md-wrap .wmde-markdown h3 {
  color: var(--foreground);
  border-bottom: 1px solid var(--border-subtle);
}

.tempo-rich-md-wrap .wmde-markdown a {
  color: var(--primary-light);
}

.tempo-rich-md-wrap .wmde-markdown code {
  background-color: var(--popover);
  color: var(--primary-light);
  border-radius: 3px;
  padding: 1px 5px;
}

.tempo-rich-md-wrap .wmde-markdown pre {
  background-color: var(--popover);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
}

.tempo-rich-md-wrap .wmde-markdown blockquote {
  border-left: 3px solid var(--primary);
  color: var(--muted-foreground-subtle);
}

.tempo-rich-md-wrap .wmde-markdown ol {
  list-style: decimal;
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.tempo-rich-md-wrap .wmde-markdown ul {
  list-style: disc;
  padding-left: 1.5em;
  margin: 0.5em 0;
}

.tempo-rich-md-wrap .wmde-markdown li {
  margin: 0.2em 0;
}

.tempo-rich-md-wrap .wmde-markdown li > p {
  margin: 0;
}

/* Đường chia split mode */
.tempo-rich-md-wrap .w-md-editor-show-live .w-md-editor-input {
  box-shadow: inset -1px 0 0 0 var(--border-subtle);
}
```

- [ ] **Step 2: Viết `packages/ui/src/components/rich-markdown-editor.tsx`** (từ `governance/RationaleEditor.tsx`; bỏ `useT()` fallback — labels bắt buộc qua props; bỏ `next/dynamic` — import tĩnh; thêm prop `colorMode`)

```tsx
"use client"

import { useState } from "react"
import MDEditor from "@uiw/react-md-editor"
import "@uiw/react-md-editor/markdown-editor.css"
import { cn } from "../lib/utils"
import "../styles/rich-markdown-editor.css"

export type RichMarkdownPreviewMode = "edit" | "live" | "preview"

export interface RichMarkdownEditorLabels {
  modeEdit: string
  modeSplit: string
  modePreview: string
  /** Chip "optional" cạnh label */
  optional: string
  /** vd (n) => `${n} ký tự còn lại` — dùng khi có maxLength */
  charsRemaining: (n: string) => string
  /** vd (n) => `${n} ký tự` — dùng khi không có maxLength */
  charCount: (n: string) => string
}

export interface RichMarkdownEditorProps {
  value: string
  onChange: (v: string) => void
  labels: RichMarkdownEditorLabels
  label?: string
  description?: string
  placeholder?: string
  maxLength?: number
  height?: number
  optional?: boolean
  /** data-color-mode cho @uiw editor (default "dark") */
  colorMode?: "dark" | "light"
  className?: string
}

export function RichMarkdownEditor({
  value,
  onChange,
  labels,
  label,
  description,
  placeholder,
  maxLength,
  height = 220,
  optional = false,
  colorMode = "dark",
  className,
}: RichMarkdownEditorProps) {
  const MODES: { value: RichMarkdownPreviewMode; label: string }[] = [
    { value: "edit", label: labels.modeEdit },
    { value: "live", label: labels.modeSplit },
    { value: "preview", label: labels.modePreview },
  ]
  const [previewMode, setPreviewMode] = useState<RichMarkdownPreviewMode>("edit")
  const isLimited = maxLength !== undefined
  const remaining = isLimited ? maxLength - value.length : null
  const isOver = remaining !== null && remaining < 0

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        {label ? (
          <label className="text-sm font-medium text-muted-foreground">
            {label}
            {optional && (
              <span className="ml-1.5 rounded bg-popover px-1.5 py-0.5 text-xs font-normal text-muted-foreground-subtle">
                {labels.optional}
              </span>
            )}
          </label>
        ) : (
          <span />
        )}

        {/* Mode tabs */}
        <div className="flex items-center gap-0.5 rounded-lg bg-secondary p-0.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setPreviewMode(m.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                previewMode === m.value
                  ? "bg-popover text-foreground"
                  : "text-muted-foreground-subtle hover:text-muted-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div data-color-mode={colorMode} className="tempo-rich-md-wrap overflow-hidden rounded-card">
        <MDEditor
          value={value}
          onChange={(v) => onChange(v ?? "")}
          preview={previewMode}
          height={height}
          visibleDragbar={false}
          hideToolbar={false}
          enableScroll={true}
          textareaProps={{
            placeholder,
            ...(isLimited ? { maxLength: maxLength! + 50 } : {}),
          }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs">
        {description ? <p className="text-muted-foreground-subtle/70">{description}</p> : <span />}
        {isLimited ? (
          <span className={isOver ? "font-medium text-destructive" : "text-muted-foreground-subtle"}>
            {labels.charsRemaining(remaining!.toLocaleString())}
          </span>
        ) : (
          <span className="text-muted-foreground-subtle">{labels.charCount(value.length.toLocaleString())}</span>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Story — `packages/ui/src/components/rich-markdown-editor.stories.tsx`**

```tsx
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
```

- [ ] **Step 4: Verify + Commit**

```bash
pnpm --filter @tempo/ui test && pnpm --filter @tempo/ui typecheck && pnpm --filter @tempo/ui build-storybook
git add packages/ui
git commit -m "feat: add RichMarkdownEditor domain component (@uiw skin theo token DS)"
```

---

### Task 8: WalletConnectModal + WalletOptionItem

**Files:**
- Create: `packages/ui/src/components/wallet-connect-modal.tsx`, `wallet-connect-modal.stories.tsx`

**Interfaces:**
- Consumes: `Dialog, DialogContent, DialogTitle` (đợt 2, `./dialog`); `Spinner` (đợt 2).
- Produces: `WalletConnectModal({ open, onOpenChange, wallets, connectingId?, error?, errorAction?, onSelect, labels })`, `WalletOptionItem({ wallet, notInstalledText, installText, onSelect })`, types `WalletOption`, `WalletConnectModalLabels`. App wrapper (~50 dòng, khi migrate) nối useWallet/store/i18n và giữ state "đã kết nối" (Chuẩn hoá #6).

- [ ] **Step 1: Viết `packages/ui/src/components/wallet-connect-modal.tsx`**

Dịch từ `wallet/WalletModal.tsx` state B (connecting) + C (select) — thay portal/overlay/Escape/scroll-lock tự chế bằng Dialog primitive (Radix lo focus trap + aria). Skin option button dịch từ `.wallet-option` (globals.css 516-548). Icon dùng `<img>` thuần (KHÔNG next/image). Giữ 1:1 cấu trúc `<a>` install nằm trong `<button disabled>` như bản gốc (đã có sẵn hành vi này trong app; sửa UX là chuyện migrate).

```tsx
"use client"

import type { ReactNode } from "react"
import { cn } from "../lib/utils"
import { Dialog, DialogContent, DialogTitle } from "./dialog"
import { Spinner } from "./spinner"

export interface WalletOption {
  id: string
  label: string
  /** URL icon; null/undefined → hiện chữ cái đầu */
  icon?: string | null
  installed: boolean
  supportsCip95?: boolean
  /** Link cài đặt khi chưa installed */
  installUrl?: string
}

export interface WalletConnectModalLabels {
  title: string
  connectingTitle: string
  /** vd (name) => `Đang kết nối ${name}…` */
  connectingTo: (name: string) => string
  approvalHint: string
  selectPrompt: string
  notInstalled: string
  install: string
}

export interface WalletOptionItemProps {
  wallet: WalletOption
  notInstalledText: string
  installText: string
  onSelect: (walletId: string) => void
}

export function WalletOptionItem({ wallet, notInstalledText, installText, onSelect }: WalletOptionItemProps) {
  return (
    <button
      type="button"
      disabled={!wallet.installed}
      onClick={() => wallet.installed && onSelect(wallet.id)}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-[0.625rem] border border-border-subtle bg-card px-4 py-3.5",
        "text-left text-[0.9rem] font-medium text-foreground transition-all",
        "enabled:hover:border-primary enabled:hover:bg-muted enabled:hover:shadow-[0_0_0_2px_rgba(99,102,241,0.12)]",
        "disabled:cursor-not-allowed disabled:opacity-45"
      )}
    >
      {/* Icon */}
      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-popover">
        {wallet.icon ? (
          <img src={wallet.icon} alt={wallet.label} width={36} height={36} className="h-full w-full object-contain" />
        ) : (
          <span className="text-xs font-bold text-muted-foreground-subtle">{wallet.label[0]}</span>
        )}
      </div>

      {/* Name + badges */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{wallet.label}</span>
          {wallet.supportsCip95 && (
            <span className="rounded border border-primary/25 bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-light">
              CIP-95
            </span>
          )}
        </div>
        {!wallet.installed && <p className="mt-0.5 text-xs text-muted-foreground-subtle">{notInstalledText}</p>}
      </div>

      {/* Install link hoặc chevron */}
      {wallet.installed ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted-foreground-subtle">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      ) : wallet.installUrl ? (
        <a
          href={wallet.installUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 text-[11px] text-primary-light hover:underline"
        >
          {installText}
        </a>
      ) : null}
    </button>
  )
}

export interface WalletConnectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  wallets: WalletOption[]
  /** id ví đang connect; null/undefined = màn chọn ví */
  connectingId?: string | null
  error?: string | null
  /** Slot dưới error message (vd nút reload — app truyền, i18n-free) */
  errorAction?: ReactNode
  onSelect: (walletId: string) => void
  labels: WalletConnectModalLabels
}

export function WalletConnectModal({
  open,
  onOpenChange,
  wallets,
  connectingId,
  error,
  errorAction,
  onSelect,
  labels,
}: WalletConnectModalProps) {
  const connecting = connectingId ? wallets.find((w) => w.id === connectingId) : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="mb-5 text-base">
          {connectingId ? labels.connectingTitle : labels.title}
        </DialogTitle>

        {connectingId ? (
          /* ── Đang kết nối ── */
          <div className="flex flex-col items-center gap-4 py-8">
            <Spinner className="size-10 border-[3px]" />
            <div className="text-center">
              <p className="text-sm font-semibold">{labels.connectingTo(connecting?.label ?? connectingId)}</p>
              <p className="mt-1 text-xs text-muted-foreground-subtle">{labels.approvalHint}</p>
            </div>
          </div>
        ) : (
          /* ── Chọn ví ── */
          <div className="space-y-3">
            {error && (
              <div className="space-y-2 rounded-lg border border-destructive/25 bg-destructive/8 p-3 text-xs">
                <div className="flex items-start gap-2 text-destructive">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                  <span>{error}</span>
                </div>
                {errorAction}
              </div>
            )}

            <p className="mb-1 text-xs text-muted-foreground-subtle">{labels.selectPrompt}</p>

            <div className="space-y-2">
              {wallets.map((wallet) => (
                <WalletOptionItem
                  key={wallet.id}
                  wallet={wallet}
                  notInstalledText={labels.notInstalled}
                  installText={labels.install}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Story — `packages/ui/src/components/wallet-connect-modal.stories.tsx`**

```tsx
import { useState } from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { WalletConnectModal, type WalletOption } from "./wallet-connect-modal"
import { Button } from "./button"

const WALLETS: WalletOption[] = [
  { id: "eternl", label: "Eternl", icon: null, installed: true, supportsCip95: true },
  { id: "lace", label: "Lace", icon: null, installed: true, supportsCip95: true },
  { id: "yoroi", label: "Yoroi", icon: null, installed: false, installUrl: "https://yoroi-wallet.com" },
  { id: "nufi", label: "NuFi", icon: null, installed: false, installUrl: "https://nu.fi" },
]

const LABELS = {
  title: "Connect Wallet",
  connectingTitle: "Connecting…",
  connectingTo: (name: string) => `Connecting to ${name}…`,
  approvalHint: "Approve the connection in your wallet extension.",
  selectPrompt: "Select a wallet to connect:",
  notInstalled: "Not installed",
  install: "Install",
}

function Demo({ connectingId, error, errorAction }: { connectingId?: string; error?: string; errorAction?: boolean }) {
  const [open, setOpen] = useState(true)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open modal</Button>
      <WalletConnectModal
        open={open}
        onOpenChange={setOpen}
        wallets={WALLETS}
        connectingId={connectingId}
        error={error}
        errorAction={
          errorAction ? (
            <div className="flex items-center justify-between pl-5">
              <span className="text-muted-foreground-subtle">Session expired.</span>
              <button type="button" className="ml-2 shrink-0 font-medium text-primary-light hover:underline">
                Reload
              </button>
            </div>
          ) : undefined
        }
        onSelect={(id) => console.log("select", id)}
        labels={LABELS}
      />
    </>
  )
}

const meta: Meta<typeof WalletConnectModal> = {
  title: "Domain/WalletConnectModal",
  component: WalletConnectModal,
}
export default meta
type Story = StoryObj<typeof WalletConnectModal>

export const SelectWallet: Story = { render: () => <Demo /> }
export const Connecting: Story = { render: () => <Demo connectingId="eternl" /> }
export const WithError: Story = { render: () => <Demo error="Wallet is locked. Unlock and retry." errorAction /> }
```

- [ ] **Step 3: Verify + Commit**

```bash
pnpm --filter @tempo/ui test && pnpm --filter @tempo/ui typecheck && pnpm --filter @tempo/ui build-storybook
git add packages/ui
git commit -m "feat: add WalletConnectModal + WalletOptionItem (trên Dialog primitive)"
```

---

### Task 9: Verify toàn bộ + Push + PR

- [ ] **Step 1: Verify toàn bộ + root**

```bash
pnpm --filter @tempo/ui test && pnpm --filter @tempo/ui typecheck && pnpm --filter @tempo/ui build-storybook
pnpm typecheck && pnpm --filter @tempo/web build
```

Expected: tất cả exit 0 (33 tests: 21 cũ + 12 mới; web build không đổi hành vi — apps/web không bị sửa).

- [ ] **Step 2: A11y check thủ công trong Storybook** (DoD spec §6.4 — WalletConnectModal dùng Dialog)

```bash
pnpm --filter @tempo/ui storybook
```

Mở Domain/WalletConnectModal → tab Accessibility: 0 violations. Kiểm tra focus trap + Escape đóng modal.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feature/design-system-domain
gh pr create --base feature/design-system-primitives --head feature/design-system-domain \
  --title "feat: @tempo/ui domain components — 11 components trích xuất từ app" \
  --body "Đợt 3/4 theo spec. 11 domain components (VoteBar, GaStatusBadge, ActionIdChip, CopyButton/CopyableId, DRepAvatar, StatCell, AdaAmount, NetworkBadge, MarkdownEditor, RichMarkdownEditor, WalletConnectModal) + stories + vitest cho logic (sliver, status mapping, bech32). KHÔNG sửa apps/web. Stacked trên PR #115 — đổi base về main sau khi #115 merge. Visual check 2 theme trên Storybook trước khi merge."
```

(Nếu PR #115 đã merge trước đó: `--base main`.)

- [ ] **Step 4: Báo user review + visual check Storybook.** KHÔNG tự merge.

---

## Self-review (đã chạy)

1. **Spec coverage:** đủ 11 dòng bảng Domain components spec §4 (CopyableId/CopyButton chung Task 4; WalletOptionItem kèm WalletConnectModal Task 8). `lib/format.ts` spec liệt kê `lovelaceToAda` — cover bởi `formatAda` sẵn có (impl giống hệt, đã đối chiếu source), ghi ở Chuẩn hoá #3. DoD tests: format.ts (đợt 1 đã có), VoteBar %/min-width (Task 2), GaStatusBadge mapping (Task 3), bech32 (Task 1). A11y check Dialog-based modal (Task 9 Step 2).
2. **Placeholder scan:** không TBD; mọi component/story/css có code đầy đủ, dịch từ source thật (đã đọc VoteResultsPanel, GaStatusBadge, ActionIdChip, CopyableId, CopyIconButton, DRepAvatar ×2, DRepBanner, DRepProfileCard, MarkdownEditor, RationaleEditor, WalletModal, globals.css 380-800). 6 deviation ghi rõ ở "Chuẩn hoá CÓ CHỦ ĐÍCH".
3. **Type consistency:** `WalletOption` dùng chung WalletOptionItem/WalletConnectModal; `gaStatusToVariant` trả `BadgeProps["variant"]` khớp union badge đợt 2; `voteBarSegmentWidth`/`MIN_SLIVER_PERCENT` tên nhất quán giữa test (Task 2 Step 1) và impl (Step 3); token utilities (bg-vote-yes/no/abstain, bg-popover, text-muted-foreground-subtle, rounded-card, border-border-subtle) đều tồn tại trong tokens.css đợt 1 (đã đối chiếu `@theme inline`).
