# apps/web — Next.js frontend

Thuộc monorepo tempo-vote-v2 — xem `CLAUDE.md` ở root cho nguyên tắc làm việc chung, kiến trúc tổng, TX flow, git/supergraph workflow.

## Cấu trúc — Giữ nguyên

```
app/globals.css                       # Tailwind v4 @theme tokens + utility classes
app/layout.tsx                        # Root: Inter font, Navbar + Footer (suppressHydrationWarning!)
app/page.tsx                          # Homepage: Become DRep, Delegate, GA preview, Polls
app/dapp-ranking/page.tsx             # DApp Ranking + ProtocolTable
app/dreps/page.tsx                    # DReps charts + DRepList
app/governance-actions/page.tsx       # GA list + GovernanceActionCard
components/layout/{Navbar,Footer}.tsx
components/governance/GovernanceActionCard.tsx
components/dapp-ranking/ProtocolTable.tsx
components/drep/DRepList.tsx
lib/mock-data.ts                      # Chỉ còn export type DRep — data thực tế lấy từ API
public/logo.webp
```

> `suppressHydrationWarning` trên `<html>` và `<body>` là bắt buộc — wallet extensions inject attributes. **Không xóa.**

Design tokens chính (legacy): `bg-bg-primary` · `bg-bg-card` · `card-static` · `card-accent` · `btn-primary` · `notice-success/warning` · `vote-bar-yes/no` · `page-container`

## Design system — @tempo/ui ⚠️

**Code UI MỚI bắt buộc import từ `@tempo/ui`** — không viết lại button/card/badge/modal bằng CSS class cũ ở `globals.css` (class cũ chỉ cho màn hình legacy, gỡ dần khi migrate).

```tsx
import { Button } from "@tempo/ui/components/button"
import { VoteBar } from "@tempo/ui/components/vote-bar"
```

- Danh mục 25 components + quy tắc API + bảng mapping token cũ→mới: [`packages/ui/README.md`](../../packages/ui/README.md)
- DS **i18n-free**: app truyền text đã dịch qua props (`label`, `labels{}`) — `useT()` chỉ ở app layer
- `RichMarkdownEditor` phải bọc `next/dynamic` với `ssr: false` khi dùng trong app
- Wiring có sẵn (`transpilePackages` + `@source`) — không cần config thêm khi thêm component mới

## Key files

| File | Mục đích |
|------|----------|
| `packages/wallet-bridge/src/index.ts` | CIP-30/95 functions |
| `packages/types/src/index.ts` | Zod schemas |
| `apps/web/hooks/useTx.ts` | FE: build → sign → submit |
| `apps/web/hooks/useWallet.ts` | Wallet state |

## Conventions

- **TS**: strict mode, no `any`, Zod cho mọi API boundary
- **Network**: lấy từ `wallet.getNetworkId()`, truyền xuống API — không hardcode
- **Error**: mọi call qua `useTx` phải handle `TxSubmitError` + network timeout ở UI layer
