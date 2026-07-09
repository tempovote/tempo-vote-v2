# @tempo/ui — Tempo Design System

Design system nội bộ của tempo-vote-v2: tokens (dark + light) + 14 primitives (shadcn-style trên Radix) + 11 domain components trích xuất từ app. Spec gốc: [`docs/superpowers/specs/2026-07-08-tempo-design-system-design.md`](../../docs/superpowers/specs/2026-07-08-tempo-design-system-design.md).

**Quy tắc bắt buộc: mọi code UI MỚI trong `apps/web` phải import component từ `@tempo/ui`** — không viết lại button/card/badge/modal bằng CSS class cũ trong `globals.css`. Class cũ (`.btn-*`, `.card`, `.badge-*`, `.vote-bar`…) chỉ tồn tại cho màn hình legacy, sẽ gỡ dần khi migrate.

## Cách dùng

Package là **source-exports** — không có build step, không có `dist/`. Next.js transpile trực tiếp qua `transpilePackages` và Tailwind scan source qua `@source` (đã wire sẵn từ đợt 1, không cần làm gì thêm).

```tsx
import { Button } from "@tempo/ui/components/button"
import { Dialog, DialogContent, DialogTitle } from "@tempo/ui/components/dialog"
import { VoteBar } from "@tempo/ui/components/vote-bar"
import { formatAda, truncateMiddle } from "@tempo/ui/lib/format"
import { cn } from "@tempo/ui/lib/utils"
```

- Import theo **từng file** (`@tempo/ui/components/<name>`) — không có barrel `index.ts` (tree-shake tự nhiên, tránh import chéo).
- Stories/tests không export ra ngoài (chặn trong `exports` map).
- Tokens: `@tempo/ui/styles/tokens.css` (web + Storybook đã import sẵn).

## Danh mục component

### Primitives (14)

| Component | File | Ghi chú |
|---|---|---|
| Button (+`buttonVariants`) | `button` | variant: default·outline·success·destructive·ghost·link; size: sm·default·lg·icon; `asChild` |
| Spinner | `spinner` | size: sm·default·lg |
| Card (+Header/Content/Footer) | `card` | default (hover glow)·static·accent — default variant là `static` |
| Badge (+`badgeVariants`) | `badge` | default·outline + status ×5 + risk ×5 |
| Separator | `separator` | Radix |
| Skeleton | `skeleton` | pulse block |
| Input / Textarea / Label | `input` · `textarea` · `label` | |
| Select | `select` | Radix, trigger skin như Input |
| Dialog | `dialog` | Radix — focus trap + aria |
| AlertDialog | `alert-dialog` | actions dùng `buttonVariants` |
| DropdownMenu | `dropdown-menu` | Radix |
| Tabs | `tabs` | underline style |
| Tooltip | `tooltip` | Radix |
| Alert | `alert` | success·warning·info·destructive |

### Domain components (11)

| Component | File | Ghi chú |
|---|---|---|
| VoteBar | `vote-bar` | `segments: {value, color, label?}[]` + `threshold?`; min-sliver 0.5% cho segment > 0 (PR #110); label + stake details ở lại app |
| GaStatusBadge | `ga-status-badge` | `status` → Badge variant (fallback `status-active`); `label` đã dịch qua props |
| ActionIdChip | `action-id-chip` | toggle hex/bech32 (CIP-129 qua `lib/gov-action-id`), copy; `size: "sm"\|"md"` |
| CopyButton | `copy-button` | copy inline sau ID/hash, ✓ 1.5s |
| CopyableId | `copyable-id` | ID rút gọn click-to-copy (`truncateMiddle(id, 10, 7)`) |
| DRepAvatar | `drep-avatar` | ảnh (IPFS 3-gateway fallback) hoặc gradient hash từ `id`; `size` px |
| StatCell | `stat-cell` | `label, value, loading?, highlight?, danger?, fallback?` |
| AdaAmount | `ada-amount` | `lovelace` → `formatAda` + `symbol: "₳"\|"ADA"` |
| NetworkBadge | `network-badge` | `network: "mainnet"\|"preprod"` (success/warning token) |
| MarkdownEditor | `markdown-editor` | nhẹ (textarea + `marked`), tabs write/preview; text qua `labels{}` |
| RichMarkdownEditor | `rich-markdown-editor` | nặng (`@uiw/react-md-editor`); **app phải bọc `next/dynamic` ssr:false**; text qua `labels{}` |
| WalletConnectModal (+WalletOptionItem) | `wallet-connect-modal` | controlled (`open, wallets[], connectingId?, error?, onSelect, labels{}`), xây trên Dialog; state "đã kết nối" ở lại app wrapper |

### Lib & styles

| Export | Nội dung |
|---|---|
| `lib/utils` | `cn()` — clsx + tailwind-merge |
| `lib/format` | `formatAda` (1.23B·595M·1.5K, thay cả `lovelaceToAda` cũ) · `formatCompact` · `formatPct` · `truncateMiddle` |
| `lib/clipboard` | `copyToClipboard` (fallback cho non-HTTPS) |
| `lib/gov-action-id` | `govActionIdToBech32(txHash, index)` — CIP-129 |
| `styles/tokens.css` | Token light (`:root`) + dark (`.dark`) + `@theme` utilities |
| `styles/markdown-editor.css` · `styles/rich-markdown-editor.css` | Skin markdown (component tự import) |

## Quy tắc API (bất biến — spec §5)

1. **i18n-free** — không `useT()`; mọi text hiển thị qua props (`label`, `labels{}`, callback `(n) => string`). App bọc và truyền chuỗi đã dịch.
2. **Data-free** — không fetch, không store; data qua props thuần.
3. **`className` pass-through** mọi component, merge bằng `cn()`.
4. **Không phụ thuộc Next** — không `next/image`, `next/link`, `next/dynamic` trong package. Component cần link/dynamic nhận `ReactNode` slot hoặc để app wrapper lo.
5. **Named exports**, file kebab-case, story co-located `<name>.stories.tsx`, import nội bộ relative (không tự tham chiếu `@tempo/ui/*`).
6. **Ở lại apps/web:** Navbar, Footer, wrapper WalletModal (nối store), mọi hooks data, i18n, store.

## Bảng mapping token (class cũ globals.css → DS)

Dùng khi migrate màn hình cũ hoặc đối chiếu style:

| Cũ (globals.css) | DS utility |
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
| `border-border-subtle` | `border-border-subtle` |
| `accent` (indigo) / `accent-light` | `primary` / `primary-light` |
| `danger` | `destructive` |
| `success` · `warning` · `info` | giữ nguyên tên |
| `.badge-active/-ratified/…` | `status-active/-ratified/…` (Badge variant) |
| `.vote-bar-yes/-no/-abstain` | `bg-vote-yes/-no/-abstain` (VoteBar) |
| `--radius-card/-badge/-button/-input` | `rounded-card/-badge/-button/-input` |
| `--shadow-card/-glow` | `shadow-card/-glow` |
| `animate-fade-in/-slide-up/-pulse-glow` | giữ nguyên tên |

Trong file CSS thuần (không qua Tailwind): dùng biến gốc `var(--foreground)`, `var(--secondary)`, `var(--border-subtle)`… — **không** dùng `var(--color-*)`.

Chuẩn hoá có chủ đích so với bản gốc: warning `#eab308` → token `warning` (Alert, NetworkBadge); VoteBar sliver áp mọi segment; `formatAda` là bản chuẩn duy nhất (bỏ 4 bản copy khi migrate).

## Theme

- `:root` = **light** (palette mới), `.dark` trên `<html>` = **dark** (map 1:1 màu Tempo v2 hiện tại).
- apps/web hiện chạy dark cố định; light bật được khi app sẵn sàng (ngoài phạm vi DS).
- `RichMarkdownEditor` nhận `colorMode` prop riêng cho skin `@uiw` (default `"dark"`).

## Storybook & kiểm chứng

```bash
pnpm --filter @tempo/ui storybook        # dev :6006 — toolbar toggle light/dark
pnpm --filter @tempo/ui test             # vitest (logic: format, sliver, status map, bech32)
pnpm --filter @tempo/ui typecheck
pnpm --filter @tempo/ui build-storybook  # CI check
```

**Definition of done cho component mới** (spec §6): typecheck + test pass · vitest cho phần có logic · visual check Storybook cả 2 theme (primitives đối chiếu app thật ở dark) · a11y addon pass cho component overlay/focus (Dialog/Dropdown/Tabs/Select và những gì xây trên chúng).
