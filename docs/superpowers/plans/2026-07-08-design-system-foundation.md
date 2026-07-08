# Tempo Design System — Đợt 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng nền móng `@tempo/ui`: package scaffold (ship source), `tokens.css` light+dark, `cn()`/`format.ts` kèm tests, Storybook 9 với theme toggle — app hiện tại không đổi hành vi.

**Architecture:** Theo spec [2026-07-08-tempo-design-system-design.md](../specs/2026-07-08-tempo-design-system-design.md). Package ship source TSX qua exports map (không dist, không tsup — tránh bẫy stale-dist trong CLAUDE.md). Token 2 lớp: `:root` (light — bảng màu mới) / `.dark` (dark — map 1:1 từ globals.css hiện tại) + `@theme inline` nối vào Tailwind utilities.

**Tech Stack:** React 19, TypeScript 5.7, Tailwind CSS v4.3, Storybook 9 (react-vite), vitest, clsx + tailwind-merge.

## Global Constraints

- **KHÔNG sửa apps/web** ngoài đúng 1 dòng `@source` trong `apps/web/app/globals.css` (Task 7). `transpilePackages: ["@tempo/ui", …]` và dep `"@tempo/ui": "workspace:*"` đã tồn tại sẵn — không thêm lại.
- **KHÔNG restart API server** (quy tắc CLAUDE.md) — mọi verify chỉ dùng pnpm/web, không đụng :8080.
- Dark values map **1:1 chính xác** từ `apps/web/app/globals.css` — không "làm đẹp" giá trị nào.
- Component/style mới KHÔNG dùng `useT()` hay store — theo quy tắc API của spec.
- Branch: `feature/design-system-foundation` (tạo từ main sau khi merge branch spec). Commit prefix `feat:`/`test:`/`chore:` theo CLAUDE.md.
- Package manager: pnpm (workspace đã khai báo `packages/*`). Node theo repo hiện tại.
- Verify TS ở root: `pnpm typecheck` (không `--filter` trực tiếp — tránh false positive stale-dist, xem CLAUDE.md).

---

### Task 1: Scaffold lại packages/ui (package.json + tsconfig, xoá placeholder)

**Files:**
- Modify: `packages/ui/package.json` (ghi đè toàn bộ)
- Modify: `packages/ui/tsconfig.json` (ghi đè toàn bộ)
- Delete: `packages/ui/src/index.ts`, `packages/ui/dist/`

**Interfaces:**
- Produces: exports map `@tempo/ui/components/*`, `@tempo/ui/lib/*`, `@tempo/ui/styles/*` — mọi task sau import theo đường này.

- [ ] **Step 1: Tạo branch**

```bash
git checkout main && git pull origin main
git checkout -b feature/design-system-foundation
```

- [ ] **Step 2: Ghi đè `packages/ui/package.json`**

```json
{
  "name": "@tempo/ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "sideEffects": ["**/*.css"],
  "exports": {
    "./components/*": "./src/components/*.tsx",
    "./lib/*": "./src/lib/*.ts",
    "./styles/*": "./src/styles/*"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "storybook": "storybook dev -p 6006",
    "build-storybook": "storybook build"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.0.2"
  },
  "devDependencies": {
    "@storybook/react-vite": "^9.0.0",
    "@storybook/addon-a11y": "^9.0.0",
    "@tailwindcss/vite": "^4.3.0",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "storybook": "^9.0.0",
    "tailwindcss": "^4.3.0",
    "typescript": "^5.7.2",
    "vite": "^6.0.0",
    "vitest": "^3.0.0"
  }
}
```

Ghi chú: bỏ hẳn scripts `build`/`dev` (tsup) cũ — package này không build. `@storybook/addon-a11y` cài ngay từ đợt 1 để main.ts không phải sửa lại ở đợt 2.

- [ ] **Step 3: Ghi đè `packages/ui/tsconfig.json`** (bỏ outDir/rootDir — không emit)

```json
{
  "compilerOptions": {
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "types": ["vitest/globals"]
  },
  "include": ["src", ".storybook"]
}
```

- [ ] **Step 4: Xoá placeholder + dist**

```bash
rm packages/ui/src/index.ts
rm -rf packages/ui/dist
```

- [ ] **Step 5: Install và verify workspace resolve**

```bash
pnpm install
```

Expected: exit 0, lockfile cập nhật, không lỗi peer.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/package.json packages/ui/tsconfig.json pnpm-lock.yaml
git rm -r --cached packages/ui/src/index.ts 2>/dev/null; true
git add -A packages/ui
git commit -m "feat: scaffold @tempo/ui as source-shipped design system package"
```

---

### Task 2: `cn()` — lib/utils.ts (TDD)

**Files:**
- Create: `packages/ui/src/lib/utils.ts`
- Create: `packages/ui/src/lib/utils.test.ts`
- Create: `packages/ui/vitest.config.ts`

**Interfaces:**
- Produces: `cn(...inputs: ClassValue[]): string` — mọi component đợt 2/3 dùng để merge className.

- [ ] **Step 1: Tạo `packages/ui/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
})
```

- [ ] **Step 2: Viết test fail — `packages/ui/src/lib/utils.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { cn } from "./utils"

describe("cn", () => {
  it("gộp nhiều class", () => {
    expect(cn("a", "b")).toBe("a b")
  })
  it("bỏ giá trị falsy", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c")
  })
  it("merge xung đột tailwind — class sau thắng", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4")
  })
  it("hỗ trợ object syntax của clsx", () => {
    expect(cn({ "text-danger": true, hidden: false }, "font-bold")).toBe("text-danger font-bold")
  })
})
```

- [ ] **Step 3: Chạy để thấy fail**

```bash
pnpm --filter @tempo/ui test
```

Expected: FAIL — `Cannot find module './utils'` (hoặc tương đương).

- [ ] **Step 4: Implement `packages/ui/src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/** Merge class names; xung đột Tailwind utilities thì class sau thắng. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 5: Chạy pass**

```bash
pnpm --filter @tempo/ui test
```

Expected: PASS 4/4.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/vitest.config.ts packages/ui/src/lib/utils.ts packages/ui/src/lib/utils.test.ts
git commit -m "feat: add cn() class-merge utility to @tempo/ui"
```

---

### Task 3: `format.ts` — chuẩn hoá 4 bản formatAda + formatPct + truncateMiddle (TDD)

**Files:**
- Create: `packages/ui/src/lib/format.ts`
- Create: `packages/ui/src/lib/format.test.ts`

**Interfaces:**
- Produces:
  - `formatAda(lovelace: number): string` — canonical (B 2 số lẻ, M 2, K 1, dưới K 0) — thay 3 bản lovelace-based hiện có + `lovelaceToAda` trong `apps/web/lib/governance.ts` khi migrate.
  - `formatCompact(n: number): string` — cho số ĐÃ là ADA (thay bản NetworkStatsBar).
  - `formatPct(pct: number): string` — port từ VoteResultsPanel (0→"0", <1→1 số lẻ, còn lại round).
  - `truncateMiddle(s: string, head?: number, tail?: number): string` — pattern `slice(0,10)…slice(-6)` đang rải rác.

Bối cảnh cho người thực thi: 4 bản `formatAda` hiện tại **khác nhau** (DRepProfileCard: M→2 lẻ; DRepLeaderboardPreview: M→1 lẻ; DRepBanner: dưới K→2 lẻ; NetworkStatsBar: nhận ADA sẵn, có B). DS chọn 1 chuẩn duy nhất theo `lovelaceToAda` của `apps/web/lib/governance.ts` (đầy đủ nhất, có B). Khác biệt hiển thị nhỏ ở các chỗ dùng cũ sẽ đồng nhất khi migrate — có chủ đích.

- [ ] **Step 1: Viết test fail — `packages/ui/src/lib/format.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { formatAda, formatCompact, formatPct, truncateMiddle } from "./format"

describe("formatAda (input: lovelace)", () => {
  it("tỷ ADA → B, 2 số lẻ", () => {
    expect(formatAda(1_234_000_000_000_000)).toBe("1.23B")
  })
  it("triệu ADA → M, 2 số lẻ", () => {
    expect(formatAda(595_013_768_459_950)).toBe("595.01M")
  })
  it("nghìn ADA → K, 1 số lẻ", () => {
    expect(formatAda(1_500_000_000)).toBe("1.5K")
  })
  it("dưới nghìn → nguyên", () => {
    expect(formatAda(999_000_000)).toBe("999")
  })
  it("0 → \"0\"", () => {
    expect(formatAda(0)).toBe("0")
  })
})

describe("formatCompact (input: ADA)", () => {
  it("tỷ → B 1 số lẻ", () => {
    expect(formatCompact(1_500_000_000)).toBe("1.5B")
  })
  it("triệu → M nguyên", () => {
    expect(formatCompact(23_400_000)).toBe("23M")
  })
  it("dưới triệu → toLocaleString", () => {
    expect(formatCompact(999_999)).toBe((999_999).toLocaleString())
  })
})

describe("formatPct", () => {
  it("0 → \"0\"", () => {
    expect(formatPct(0)).toBe("0")
  })
  it("dưới 1 → 1 số lẻ", () => {
    expect(formatPct(0.42)).toBe("0.4")
  })
  it("từ 1 trở lên → làm tròn", () => {
    expect(formatPct(74.657)).toBe("75")
  })
})

describe("truncateMiddle", () => {
  it("mặc định 10…6", () => {
    const h = "4b10e5793208cb8f228756e02113227c91602248eac4d992681a0ee760b6c4e2"
    expect(truncateMiddle(h)).toBe("4b10e57932…b6c4e2")
  })
  it("chuỗi ngắn giữ nguyên", () => {
    expect(truncateMiddle("abc")).toBe("abc")
  })
  it("head/tail tuỳ chỉnh", () => {
    expect(truncateMiddle("abcdefghijklmnop", 4, 2)).toBe("abcd…op")
  })
})
```

- [ ] **Step 2: Chạy fail**

```bash
pnpm --filter @tempo/ui test
```

Expected: FAIL — `Cannot find module './format'`.

- [ ] **Step 3: Implement `packages/ui/src/lib/format.ts`**

```ts
/** Format lovelace thành chuỗi ADA gọn: 1.23B · 595.01M · 1.5K · 999. */
export function formatAda(lovelace: number): string {
  const ada = lovelace / 1_000_000
  if (ada >= 1_000_000_000) return `${(ada / 1_000_000_000).toFixed(2)}B`
  if (ada >= 1_000_000) return `${(ada / 1_000_000).toFixed(2)}M`
  if (ada >= 1_000) return `${(ada / 1_000).toFixed(1)}K`
  return ada.toFixed(0)
}

/** Format số ĐÃ là ADA (không chia 1e6): 1.5B · 23M · 999,999. */
export function formatCompact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`
  return n.toLocaleString()
}

/** Format phần trăm: 0 → "0", dưới 1% giữ 1 số lẻ, còn lại làm tròn. */
export function formatPct(pct: number): string {
  if (pct === 0) return "0"
  if (pct < 1) return pct.toFixed(1)
  return Math.round(pct).toString()
}

/** Rút gọn giữa chuỗi: "4b10e57932…b6c4e2". Chuỗi ngắn hơn head+tail+1 giữ nguyên. */
export function truncateMiddle(s: string, head = 10, tail = 6): string {
  if (s.length <= head + tail + 1) return s
  return `${s.slice(0, head)}…${s.slice(-tail)}`
}
```

- [ ] **Step 4: Chạy pass**

```bash
pnpm --filter @tempo/ui test
```

Expected: PASS toàn bộ (4 + 3 + 3 + 3 = 13 test mới + 4 test cn cũ).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/lib/format.ts packages/ui/src/lib/format.test.ts
git commit -m "feat: add canonical ADA/pct/truncate formatters to @tempo/ui"
```

---

### Task 4: `tokens.css` — light + dark hoàn chỉnh

**Files:**
- Create: `packages/ui/src/styles/tokens.css`

**Interfaces:**
- Produces: semantic vars (`--background`, `--primary`…) + Tailwind utilities (`bg-background`, `text-foreground`, `bg-status-active`, `shadow-card`, `animate-fade-in`…) — mọi component đợt 2/3 và story dùng các utility này. Class `dark` trên `<html>` bật dark theme.

Nguồn chân lý dark values: `apps/web/app/globals.css` dòng 8-74 — map 1:1, đối chiếu từng giá trị khi implement. Light palette là giá trị MỚI dưới đây (đã thiết kế trong plan, giữ hue indigo/status, nền sáng slate).

- [ ] **Step 1: Tạo `packages/ui/src/styles/tokens.css`** (toàn bộ nội dung)

```css
/* ====================================================================
   @tempo/ui — Design Tokens
   Lớp 1: semantic vars — :root = LIGHT, .dark = DARK (map 1:1 từ Tempo v2)
   Lớp 2: @theme inline — nối vào Tailwind utilities
   ==================================================================== */

@custom-variant dark (&:is(.dark *));

:root {
  /* ── LIGHT (bảng màu mới) ── */
  --background: #f8fafc;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;
  --primary: #4f46e5;
  --primary-foreground: #ffffff;
  --primary-light: #6366f1;
  --primary-dark: #3730a3;
  --secondary: #f1f5f9;
  --secondary-foreground: #0f172a;
  --muted: #f1f5f9;
  --muted-foreground: #475569;
  --muted-foreground-subtle: #64748b;
  --accent: #f1f5f9;              /* hover bg — nghĩa shadcn, ≈ bg-card-hover cũ */
  --accent-foreground: #0f172a;
  --destructive: #dc2626;
  --destructive-dark: #b91c1c;
  --destructive-foreground: #ffffff;
  --success: #16a34a;
  --success-dark: #15803d;
  --warning: #d97706;
  --warning-dark: #b45309;
  --info: #2563eb;
  --border: #e2e8f0;
  --border-subtle: #eef2f7;
  --input: #ffffff;
  --ring: #4f46e5;

  --accent-blue: #2563eb;
  --accent-cyan: #0891b2;
  --accent-purple: #9333ea;

  --status-active: #16a34a;
  --status-ratified: #2563eb;
  --status-expired: #6b7280;
  --status-enacted: #7c3aed;
  --status-dropped: #ea580c;

  --risk-critical: #dc2626;
  --risk-major: #ea580c;
  --risk-medium: #d97706;
  --risk-minor: #2563eb;
  --risk-unknown: #6b7280;

  --vote-yes: var(--success);
  --vote-no: var(--destructive);
  --vote-abstain: var(--muted-foreground-subtle);

  --card-shadow: 0 4px 24px rgba(15, 23, 42, 0.08);
  --glow-shadow: 0 0 20px rgba(99, 102, 241, 0.12);
}

.dark {
  /* ── DARK — map 1:1 từ apps/web/app/globals.css ── */
  --background: #0a0e1a;          /* ← --color-bg-primary */
  --foreground: #f1f5f9;          /* ← --color-text-primary */
  --card: #141929;                /* ← --color-bg-card */
  --card-foreground: #f1f5f9;
  --popover: #1e2440;             /* ← --color-bg-elevated */
  --popover-foreground: #f1f5f9;
  --primary: #6366f1;             /* ← --color-accent */
  --primary-foreground: #ffffff;
  --primary-light: #818cf8;       /* ← --color-accent-light */
  --primary-dark: #4338ca;        /* ← --color-accent-dark */
  --secondary: #0f1424;           /* ← --color-bg-secondary */
  --secondary-foreground: #f1f5f9;
  --muted: #1a2035;               /* ← --color-bg-card-hover */
  --muted-foreground: #94a3b8;    /* ← --color-text-secondary */
  --muted-foreground-subtle: #64748b; /* ← --color-text-muted */
  --accent: #1a2035;              /* ← --color-bg-card-hover (hover bg nghĩa shadcn) */
  --accent-foreground: #f1f5f9;
  --destructive: #ef4444;         /* ← --color-danger */
  --destructive-dark: #dc2626;    /* ← --color-danger-dark */
  --destructive-foreground: #ffffff;
  --success: #22c55e;             /* ← --color-success */
  --success-dark: #16a34a;        /* ← --color-success-dark */
  --warning: #f59e0b;             /* ← --color-warning */
  --warning-dark: #d97706;        /* ← --color-warning-dark */
  --info: #3b82f6;                /* ← --color-info */
  --border: #252d4a;              /* ← --color-border-default */
  --border-subtle: #1e2640;       /* ← --color-border-subtle */
  --input: #1a1f35;               /* ← --color-bg-input */
  --ring: #4f46e5;                /* ← --color-border-accent */

  --accent-blue: #3b82f6;         /* ← --color-accent-blue */
  --accent-cyan: #06b6d4;         /* ← --color-accent-cyan */
  --accent-purple: #a855f7;       /* ← --color-accent-purple */

  --status-active: #22c55e;
  --status-ratified: #3b82f6;
  --status-expired: #6b7280;
  --status-enacted: #8b5cf6;
  --status-dropped: #f97316;

  --risk-critical: #ef4444;
  --risk-major: #f97316;
  --risk-medium: #f59e0b;
  --risk-minor: #3b82f6;
  --risk-unknown: #6b7280;

  --vote-yes: var(--success);
  --vote-no: var(--destructive);
  --vote-abstain: var(--muted-foreground-subtle);

  --card-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);       /* ← --shadow-card */
  --glow-shadow: 0 0 20px rgba(99, 102, 241, 0.15);   /* ← --shadow-glow */
}

@theme inline {
  /* Semantic colors → utilities (bg-background, text-foreground, border-border…) */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary-light: var(--primary-light);
  --color-primary-dark: var(--primary-dark);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted-foreground-subtle: var(--muted-foreground-subtle);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-dark: var(--destructive-dark);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-success-dark: var(--success-dark);
  --color-warning: var(--warning);
  --color-warning-dark: var(--warning-dark);
  --color-info: var(--info);
  --color-border: var(--border);
  --color-border-subtle: var(--border-subtle);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-accent-blue: var(--accent-blue);
  --color-accent-cyan: var(--accent-cyan);
  --color-accent-purple: var(--accent-purple);
  --color-status-active: var(--status-active);
  --color-status-ratified: var(--status-ratified);
  --color-status-expired: var(--status-expired);
  --color-status-enacted: var(--status-enacted);
  --color-status-dropped: var(--status-dropped);
  --color-risk-critical: var(--risk-critical);
  --color-risk-major: var(--risk-major);
  --color-risk-medium: var(--risk-medium);
  --color-risk-minor: var(--risk-minor);
  --color-risk-unknown: var(--risk-unknown);
  --color-vote-yes: var(--vote-yes);
  --color-vote-no: var(--vote-no);
  --color-vote-abstain: var(--vote-abstain);

  /* Shadows (flip theo theme) */
  --shadow-card: var(--card-shadow);
  --shadow-glow: var(--glow-shadow);
}

@theme {
  /* ── Không flip theo theme — giữ nguyên giá trị Tempo v2 ── */
  --font-sans: "Inter", ui-sans-serif, system-ui, -apple-system, sans-serif;

  --spacing-page-x: 1.5rem;

  --radius-card: 0.75rem;
  --radius-badge: 0.375rem;
  --radius-button: 0.5rem;
  --radius-input: 0.5rem;

  --animate-fade-in: fade-in 0.4s ease-out;
  --animate-slide-up: slide-up 0.5s ease-out;
  --animate-pulse-glow: pulse-glow 2s ease-in-out infinite;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.1); }
  50% { box-shadow: 0 0 30px rgba(99, 102, 241, 0.25); }
}
```

- [ ] **Step 2: Đối chiếu dark values với nguồn**

```bash
sed -n '8,74p' apps/web/app/globals.css
```

So từng hex trong `.dark` với output — 6 nhóm: bg (6), border (3), accent/primary (6), semantic (7), text (4), risk/status (10). Expected: khớp 100%.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/styles/tokens.css
git commit -m "feat: add light+dark design tokens to @tempo/ui"
```

---

### Task 5: Storybook 9 setup (theme toggle toolbar)

**Files:**
- Create: `packages/ui/.storybook/main.ts`
- Create: `packages/ui/.storybook/preview.tsx`
- Create: `packages/ui/.storybook/preview.css`
- Create: `packages/ui/.storybook/preview-head.html`

**Interfaces:**
- Consumes: `tokens.css` (Task 4).
- Produces: môi trường story cho mọi component đợt 2/3; global `theme` toolbar (dark/light) — mọi story tự nhận theme, không cần setup riêng.

- [ ] **Step 1: Tạo `packages/ui/.storybook/main.ts`**

```ts
import type { StorybookConfig } from "@storybook/react-vite"
import tailwindcss from "@tailwindcss/vite"

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: { name: "@storybook/react-vite", options: {} },
  async viteFinal(cfg) {
    const { mergeConfig } = await import("vite")
    return mergeConfig(cfg, { plugins: [tailwindcss()] })
  },
}

export default config
```

- [ ] **Step 2: Tạo `packages/ui/.storybook/preview.css`**

```css
@import "tailwindcss";
@import "../src/styles/tokens.css";
@source "../src";
```

- [ ] **Step 3: Tạo `packages/ui/.storybook/preview.tsx`**

```tsx
import type { Decorator, Preview } from "@storybook/react"
import { useEffect } from "react"
import "./preview.css"

const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals.theme as string) ?? "dark"
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])
  return (
    <div className="min-h-screen bg-background p-6 font-sans text-foreground antialiased">
      <Story />
    </div>
  )
}

const preview: Preview = {
  decorators: [withTheme],
  globalTypes: {
    theme: {
      description: "Color theme",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: ["dark", "light"],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "dark" },
  parameters: {
    layout: "fullscreen",
    backgrounds: { disable: true },
  },
}

export default preview
```

- [ ] **Step 4: Tạo `packages/ui/.storybook/preview-head.html`** (font Inter cho fidelity)

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
  rel="stylesheet"
/>
```

- [ ] **Step 5: Verify build tĩnh (deterministic)**

```bash
pnpm --filter @tempo/ui build-storybook
```

Expected: exit 0, output `packages/ui/storybook-static/`. (Chưa có story nào — Storybook 9 build được với 0 story; nếu version cài về lỗi "no stories", tạm chuyển Step 5 xuống sau Task 6 — Task 6 tạo story đầu tiên.)

- [ ] **Step 6: Thêm `storybook-static` vào gitignore**

Thêm dòng `storybook-static/` vào `.gitignore` ở root (kiểm tra trước bằng `grep -n "storybook" .gitignore` — chưa có thì thêm).

- [ ] **Step 7: Commit**

```bash
git add packages/ui/.storybook .gitignore
git commit -m "feat: add Storybook 9 with dark/light theme toolbar to @tempo/ui"
```

---

### Task 6: Tokens showcase story — verify 2 theme bằng mắt

**Files:**
- Create: `packages/ui/src/components/tokens.stories.tsx`

**Interfaces:**
- Consumes: utilities từ tokens.css (`bg-background`, `bg-card`, `text-foreground`, `bg-status-*`, `bg-risk-*`, `shadow-card`, `rounded-card`…), theme toolbar (Task 5).

- [ ] **Step 1: Tạo `packages/ui/src/components/tokens.stories.tsx`**

```tsx
import type { Meta, StoryObj } from "@storybook/react"

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
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
```

- [ ] **Step 2: Build verify**

```bash
pnpm --filter @tempo/ui build-storybook
```

Expected: exit 0, story compile được (nghĩa là mọi utility class tồn tại — Tailwind v4 không generate class cho token thiếu, class sai sẽ không có style nhưng build vẫn qua; bước quyết định là Step 3).

- [ ] **Step 3: Verify bằng mắt cả 2 theme**

```bash
pnpm --filter @tempo/ui storybook
```

Mở `http://localhost:6006` → story `Foundation/Tokens`:
1. Theme **dark**: swatch Surfaces phải là dải navy đậm (#0a0e1a → #1e2440), primary indigo #6366f1 — so với app thật (mở tempo web cạnh bên).
2. Toggle **light** trên toolbar: nền chuyển #f8fafc, chữ #0f172a, mọi swatch đổi màu — KHÔNG swatch nào giữ nguyên màu dark (trừ status-expired/risk-unknown #6b7280 dùng chung).
3. `TextAndSurfaces`: đọc được rõ ở cả 2 theme (tương phản), shadow card thấy được trên light.

Dừng server sau khi check (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/tokens.stories.tsx
git commit -m "feat: add tokens showcase story for visual theme verification"
```

---

### Task 7: Wiring apps/web (1 dòng) + verify app không đổi

**Files:**
- Modify: `apps/web/app/globals.css:1` (thêm 1 dòng sau `@import "tailwindcss";`)

**Interfaces:**
- Produces: apps/web nhìn thấy class dùng trong component `@tempo/ui` (chuẩn bị cho đợt 2/3). `transpilePackages` và dep workspace ĐÃ có sẵn — không sửa `next.config.ts`/`package.json`.

- [ ] **Step 1: Thêm `@source` vào `apps/web/app/globals.css`**

Sửa đầu file từ:

```css
@import "tailwindcss";
```

thành:

```css
@import "tailwindcss";
@source "../../../packages/ui/src";
```

Ghi chú: KHÔNG import tokens.css của DS vào app ở đợt này — app vẫn dùng `@theme` cũ của chính nó (không refactor). `@source` chỉ bảo Tailwind quét thêm class names trong package.

- [ ] **Step 2: Verify typecheck + test toàn repo**

```bash
pnpm typecheck && pnpm test
```

Expected: PASS như trước khi có thay đổi (baseline: 4 lỗi pre-existing nếu còn — so sánh với main, không được có lỗi MỚI).

- [ ] **Step 3: Verify web build**

```bash
pnpm --filter @tempo/web build
```

Expected: exit 0. CSS output có thể lớn hơn không đáng kể (thêm vài class từ tokens story — story không nằm trong app bundle, chỉ class scan).

- [ ] **Step 4: Smoke test dev**

```bash
pnpm dev
```

Mở `http://localhost:3000` — trang chủ hiển thị đúng như trước (dark, không vỡ layout). Dừng sau khi check.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "feat: wire @tempo/ui source scan into web Tailwind pipeline"
```

---

### Task 8: Push + PR

**Files:** không sửa file.

- [ ] **Step 1: Push branch**

```bash
git push -u origin feature/design-system-foundation
```

- [ ] **Step 2: Tạo PR**

```bash
gh pr create --base main --head feature/design-system-foundation \
  --title "feat: @tempo/ui foundation — tokens (light+dark), lib, Storybook" \
  --body "$(cat <<'EOF'
## Summary
- Đợt 1/4 của Design System theo spec docs/superpowers/specs/2026-07-08-tempo-design-system-design.md
- packages/ui: scaffold ship-source (không dist — tránh bẫy stale-dist), cn() + format.ts kèm 17 tests
- tokens.css: dark map 1:1 từ globals.css hiện tại, light palette mới, @theme inline
- Storybook 9 + theme toolbar + tokens showcase story
- apps/web: đúng 1 dòng @source, không đổi hành vi

## Test plan
- [ ] pnpm --filter @tempo/ui test — 17/17 pass
- [ ] pnpm typecheck && pnpm test — không lỗi mới so với main
- [ ] pnpm --filter @tempo/web build — pass
- [ ] Storybook: tokens verify bằng mắt cả 2 theme
EOF
)"
```

- [ ] **Step 3: Báo user review PR** — KHÔNG tự merge; đợt 2 (primitives) chỉ bắt đầu sau khi PR này merge.

---

## Self-review (đã chạy)

1. **Spec coverage Đợt 1:** scaffold ✓ (Task 1), tokens dark 1:1 + light mới ✓ (Task 4), cn/format ✓ (Task 2-3), Storybook + theme toggle ✓ (Task 5-6), wiring tối thiểu ✓ (Task 7 — thu hẹp còn 1 dòng vì transpilePackages/dep đã có), branch/PR theo git workflow ✓ (Task 8). Đợt 2/3/4 ngoài phạm vi plan này — mỗi đợt 1 plan riêng.
2. **Placeholder scan:** không TBD/TODO; mọi step có code/lệnh/giá trị thật (light palette đầy đủ hex).
3. **Type consistency:** `cn(...inputs: ClassValue[])` dùng nhất quán; `formatAda/formatCompact/formatPct/truncateMiddle` khớp giữa test (Task 3 Step 1) và impl (Step 3); token names trong story (Task 6) khớp @theme inline (Task 4).
