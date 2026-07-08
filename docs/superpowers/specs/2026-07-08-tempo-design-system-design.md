# Tempo Design System — Design Spec

**Ngày:** 2026-07-08
**Trạng thái:** Đã duyệt qua brainstorming, chờ implementation plan
**Phạm vi:** Xây `@tempo/ui` hoàn chỉnh. KHÔNG refactor apps/web trong phạm vi này.

## 1. Bối cảnh & mục tiêu

tempo-vote-v2 có một design system "ngầm" phân tán: ~65 token Tailwind v4 `@theme` + ~50 CSS component class trong `apps/web/app/globals.css`, 33 React component chia theo domain trong `apps/web/components/`, và duplication đáng kể (`formatAda` ×4, `StatCell` ×2, spinner markup ~21 chỗ). `packages/ui` là placeholder rỗng.

**Mục tiêu:** đóng gói thành design system chuẩn trong `packages/ui` để (a) tái sử dụng cho các dự án Cardano sau này, (b) làm nguồn chân lý cho code UI mới, (c) mở đường migrate app dần và sync lên claude.ai/design (`/design-sync`) trong tương lai.

**Các quyết định đã chốt với user:**

| Quyết định | Lựa chọn |
|---|---|
| Phạm vi DS | Đủ 3 tầng: tokens + primitives + domain components |
| Theme | Light + dark ngay từ đầu (dark = bảng màu hiện tại, light = thiết kế mới) |
| Refactor app | KHÔNG — chỉ xây DS; code mới dùng DS, code cũ migrate sau |
| Storybook | Có, cho mọi component |
| Kiến trúc styling | **B thuần — shadcn-style**: Radix primitives + CVA + Tailwind utilities trong component, restyle về look Tempo |

## 2. Kiến trúc package

```
packages/ui/                          # @tempo/ui
├── src/
│   ├── styles/
│   │   └── tokens.css               # @theme + semantic vars, light + dark
│   ├── lib/
│   │   ├── utils.ts                 # cn() = clsx + tailwind-merge
│   │   └── format.ts                # formatAda, formatPct, lovelaceToAda, truncateMiddle
│   └── components/
│       ├── button.tsx …             # primitives (14)
│       ├── vote-bar.tsx …           # domain components (11)
│       └── *.stories.tsx            # stories co-located
├── .storybook/                      # Storybook 9 + Vite builder
└── package.json
```

**Ship source TSX, không build dist** (theo pattern monorepo chính thức của shadcn):

- `package.json` exports: `"./components/*": "./src/components/*.tsx"`, `"./lib/*": "./src/lib/*.ts"`, `"./styles/*": "./src/styles/*"`
- `apps/web/next.config.ts`: thêm `transpilePackages: ["@tempo/ui"]`
- CSS consumer: `@source "../../packages/ui/src"` để Tailwind quét utilities trong component
- Import per-file: `import { Button } from "@tempo/ui/components/button"` — tree-shake theo cấu trúc, dep nặng (vd `@uiw/react-md-editor`) chỉ bị bundle khi import đúng file dùng nó
- Lý do không tsup/dist: loại bỏ hoàn toàn bẫy stale-dist đã ghi trong CLAUDE.md; bỏ `@tempo/ui` khỏi dependsOn `^build` nếu cần

**Dependencies mới** (chỉ trong packages/ui): `@radix-ui/react-*` theo từng primitive, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`. DevDeps: Storybook 9 + Vite builder, vitest.

## 3. Kiến trúc token (light + dark)

File duy nhất `src/styles/tokens.css`, 2 lớp:

```css
:root { /* LIGHT — bảng màu mới, thiết kế lúc implement */ }
.dark { /* DARK — map 1:1 từ 65 token hiện tại, KHÔNG đổi giá trị */ }
@theme inline { --color-background: var(--background); /* … */ }
```

- **Đặt tên theo convention shadcn** cho bộ chuẩn + token domain Tempo giữ tên riêng.
- App mount `<html class="dark">` mặc định (Tempo dark-first). Cơ chế: class `dark` + `@custom-variant dark` theo shadcn v4.
- Light palette: giữ hue (indigo primary, status/risk giữ ngữ nghĩa), đảo lightness nền/chữ, đạt WCAG AA. Verify bằng Storybook theme toggle.
- Radius/shadow/animation/font giữ nguyên giá trị hiện tại, chuyển vào tokens.css.

**Bảng mapping token cũ → mới (dark values giữ nguyên):**

| Token hiện tại (globals.css) | Token DS (shadcn convention) | Dark value |
|---|---|---|
| `--color-bg-primary` | `--background` | `#0a0e1a` |
| `--color-bg-secondary` | `--secondary` | `#0f1424` |
| `--color-bg-card` | `--card` | `#141929` |
| `--color-bg-card-hover` | `--accent` ⚠️ (hover bg theo nghĩa shadcn) | `#1a2035` |
| `--color-bg-input` | `--input` | `#1a1f35` |
| `--color-bg-elevated` | `--popover` | `#1e2440` |
| `--color-border-default` | `--border` | `#252d4a` |
| `--color-border-subtle` | `--border-subtle` (mở rộng) | `#1e2640` |
| `--color-border-accent` | `--ring` | `#4f46e5` |
| `--color-accent` | `--primary` ⚠️ | `#6366f1` |
| `--color-accent-light` | `--primary-light` (mở rộng) | `#818cf8` |
| `--color-accent-dark` | `--primary-dark` (mở rộng) | `#4338ca` |
| `--color-text-primary` | `--foreground` | `#f1f5f9` |
| `--color-text-secondary` | `--muted-foreground` | `#94a3b8` |
| `--color-text-muted` | `--muted-foreground-subtle` (mở rộng) | `#64748b` |
| `--color-danger` / `-dark` | `--destructive` / `--destructive-dark` | `#ef4444` / `#dc2626` |
| `--color-success` / `-dark` | `--success` / `--success-dark` | `#22c55e` / `#16a34a` |
| `--color-warning` / `-dark` | `--warning` / `--warning-dark` | `#f59e0b` / `#d97706` |
| `--color-info` | `--info` | `#3b82f6` |
| `--color-accent-blue/cyan/purple` | `--accent-blue/cyan/purple` giữ nguyên (dùng cho gradient + chart; không đụng `--accent` của shadcn vì tên đầy đủ khác nhau) | `#3b82f6` `#06b6d4` `#a855f7` |
| `--color-status-*` (×5) | `--status-*` giữ nguyên | active `#22c55e`, ratified `#3b82f6`, expired `#6b7280`, enacted `#8b5cf6`, dropped `#f97316` |
| `--color-risk-*` (×5) | `--risk-*` giữ nguyên | critical `#ef4444`, major `#f97316`, medium `#f59e0b`, minor `#3b82f6`, unknown `#6b7280` |
| (mới) | `--vote-yes` / `--vote-no` / `--vote-abstain` | lấy từ `.vote-bar-*` hiện tại |

⚠️ **2 chỗ đổi nghĩa dễ nhầm khi migrate:** `accent` Tempo (indigo brand) → `primary` shadcn; `accent` shadcn = màu nền hover nhẹ (≈ `bg-card-hover` cũ). Bảng này là tài liệu tra cứu bắt buộc khi migrate.

## 4. Danh mục component

### Primitives — 14 (shadcn kéo về + restyle Tempo)

| Component | Radix | Thay thế | Variants |
|---|---|---|---|
| Button | — | `.btn-*` | variant: default·outline·success·destructive·ghost·link; size: sm·default·lg·icon |
| Card (+Header/Content/Footer) | — | `.card`, `.card-static`, `.card-accent` | default·interactive·accent |
| Badge | — | `.badge-*` | semantic + status ×5 + risk ×5 |
| Input / Textarea / Label | label | `.input`, form styling rải rác | — |
| Select | select | `<select>` thuần | — |
| Dialog | dialog | nền cho modal (focus trap + aria chuẩn) | — |
| AlertDialog | alert-dialog | AlertModal | — |
| DropdownMenu | dropdown-menu | dropdown tay trong Navbar | — |
| Tabs | tabs | GaDetailTabs (hiện 0 aria) | — |
| Tooltip | tooltip | `title=` attrs | — |
| Alert | — | `.notice-success/warning` | success·warning·info·destructive |
| Skeleton | — | loading tự chế | — |
| Spinner | — (custom) | `.spinner`, ~21 chỗ animate-spin | size sm·default·lg |
| Separator | separator | `divide-*` | — |

### Domain components — 11 (custom, trích xuất từ app)

| Component | Trích xuất từ | Ghi chú API |
|---|---|---|
| VoteBar | VoteResultsPanel (gộp 3 bản DRep/SPO/CC) | `segments: {value, color}[]`, `threshold?`, giữ min-width sliver 0.5% (PR #110) |
| GaStatusBadge | governance/GaStatusBadge | `status` → Badge variant |
| ActionIdChip | governance/ActionIdChip | `txHash, index, size` |
| CopyableId / CopyButton | ui/CopyableId, ui/CopyIconButton | giữ API hiện có |
| DRepAvatar | drep/DRepAvatar | `imageUrl?, name?, size` |
| StatCell | dedup DRepBanner + DRepProfileCard | `label, value, loading?, highlight?, danger?, fallback?` |
| AdaAmount | dedup formatAda ×4 | `lovelace, symbol?: "₳"\|"ADA"` |
| NetworkBadge | `.network-badge-*` | `network: "mainnet"\|"preprod"` |
| MarkdownEditor | ui/MarkdownEditor (nhẹ: textarea + marked) | comment, poll description |
| RichMarkdownEditor | governance/RationaleEditor (nặng: @uiw/react-md-editor) | bỏ useT() fallback → labels bắt buộc qua props; chuyển ~110 dòng CSS `.rationale-editor-wrap` vào DS |
| WalletConnectModal (+WalletOptionItem) | wallet/WalletModal (539 dòng, "lộn trái") | controlled: `open, wallets[], connectingId?, error?, onSelect, labels{}` — app giữ wrapper ~50 dòng nối store/bridge/i18n |

### Kèm theo

- `lib/format.ts`: `formatAda`, `formatPct`, `lovelaceToAda`, `truncateMiddle` (xoá 4 bản copy khi migrate)
- `lib/utils.ts`: `cn()`

## 5. Quy tắc API (bất biến)

1. **i18n-free** — không `useT()`; mọi text qua props. App bọc và truyền chuỗi đã dịch.
2. **Data-free** — không fetch, không store; data qua props thuần.
3. **`className` pass-through** mọi component, merge bằng `cn()`.
4. **Ở lại apps/web:** Navbar, Footer, wrapper WalletModal (nối store), mọi hooks data, i18n, store.

## 6. Storybook & kiểm chứng

- Storybook 9 + Vite builder trong packages/ui (`pnpm --filter @tempo/ui storybook`).
- Stories co-located, mỗi component phủ ma trận variant × size × state, data mẫu tĩnh.
- **Theme toggle toolbar** (decorator gắn/gỡ `dark`) — công cụ chính verify light palette.

**Definition of done mỗi component:**
1. Typecheck + lint pass (thêm vào turbo pipeline; không có build step)
2. Vitest cho phần có logic (format.ts, VoteBar %/min-width, GaStatusBadge mapping)
3. Visual check Storybook cả 2 theme; primitives đối chiếu side-by-side với app thật (dark)
4. A11y addon pass cho Dialog/Dropdown/Tabs/Select — lý do chọn phương án B, phải chứng minh được

## 7. Lộ trình (4 đợt, mỗi đợt 1 branch/PR)

| Đợt | Nội dung |
|---|---|
| 1 | Scaffold package (source-exports, transpilePackages, `@source`) + tokens.css (dark map 1:1 + light palette mới) + cn()/format.ts + Storybook setup |
| 2 | 14 primitives + stories + a11y check |
| 3 | 11 domain components + stories + tests |
| 4 | Docs: README package (conventions, bảng mapping token, quy tắc API) + cập nhật CLAUDE.md (root + apps/web): **code UI mới bắt buộc import từ @tempo/ui** |

App không bị đụng ngoài 2 dòng wiring ở đợt 1 (`transpilePackages`, `@source`) — chỉ cho phép app thấy package, chưa đổi hành vi.

## 8. Ngoài phạm vi (tương lai)

- Migrate apps/web từng domain sang DS (từng PR riêng, so màn hình cũ–mới)
- Gỡ CSS class cũ khỏi globals.css sau khi migrate xong
- `/design-sync` lên claude.ai/design theo shape Storybook
- Light theme cho apps/web (DS hỗ trợ sẵn; app bật khi sẵn sàng)

## 9. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Restyle 14 primitives lệch look hiện tại | Đối chiếu side-by-side với app thật trong Storybook; dark values map 1:1 |
| Nhầm nghĩa `accent`/`primary` khi migrate sau này | Bảng mapping trong spec + README package |
| Light palette mới thiếu tương phản | WCAG AA check + a11y addon |
| Duplication tạm thời (DS ↔ app cùng có component) | Chấp nhận có chủ đích; CLAUDE.md quy định code mới chỉ dùng DS; xoá bản cũ khi migrate |
| 2 dòng wiring ảnh hưởng app hiện tại | `@source` chỉ *thêm* class vào CSS output; `transpilePackages` chỉ kích hoạt khi có import — verify bằng build + smoke test |
