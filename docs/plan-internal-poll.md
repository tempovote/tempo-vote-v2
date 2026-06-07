# Plan: Create Internal Poll (Inline Form)

**Branch:** `feature/internal-poll-create`  
**Status tracking:** cập nhật checkboxes khi hoàn thành từng bước.

---

## Tổng quan

Implement tính năng tạo Internal Poll trực tiếp bên trong trang DRep Community — dạng **inline expandable form** (toggle ⊕/⊖), không dùng trang riêng.

**Tham chiếu UI (v1):**
- Hình 1: Community page với nút "Create an internal poll ⊕"
- Hình 2: Form mở inline — Title (max 80), Abstract (rich editor, 2500), Motivation (Optional, rich editor, 2500)

**Flow:**
```
Owner click "Create an internal poll" → form mở inline
→ Điền Title + Abstract + Motivation + Dates
→ Submit → POST /communities/{drepId}/polls
→ Form đóng, poll list refresh
```

---

## Điều kiện tiên quyết để tạo poll

```
1. Community phải is_active = true
2. Ví connected + hỗ trợ CIP-95
3. drepKey.dRepIDCip105 === profile.id (user là owner)
4. JWT session hợp lệ (auto re-auth nếu hết hạn)
```

---

## Phase 1 — DB Migration

- [x] **1.1** Tạo `apps/api/src/main/resources/db/migration/V2__add_motivation_to_polls.sql`
  ```sql
  ALTER TABLE internal_polls ADD COLUMN motivation TEXT;
  ```
- [x] **1.2** `apps/api/src/main/kotlin/db/Tables.kt` — thêm `val motivation = text("motivation").nullable()`

---

## Phase 2 — Backend

**File:** `apps/api/src/main/kotlin/routes/CommunityRoutes.kt`

- [x] **2.1** Thêm `motivation: String? = null` vào `CreatePollRequest` data class
- [x] **2.2** Store motivation khi `INSERT` vào `internal_polls`
- [x] **2.3** Trả `motivation` trong poll detail response (`GET /communities/polls/{pollId}`)

---

## Phase 3 — Types (packages/types)

**File:** `packages/types/src/api/community.ts`

- [x] **3.1** `CreatePollRequestSchema`: thêm `motivation: z.string().optional()`
- [x] **3.2** `PollDetailSchema`: thêm `motivation: z.string().optional()`
- [x] **3.3** Rebuild: `pnpm --filter @tempo/types build`

---

## Phase 4 — Generalize RationaleEditor

**File:** `apps/web/components/governance/RationaleEditor.tsx`

- [x] **4.1** Thêm props: `label?`, `description?`, `placeholder?`, `maxLength?`, `height?`, `optional?`
- [x] **4.2** Backward-compatible defaults (giữ nguyên behavior cho GA rationale)

Props interface target:
```ts
interface Props {
  value: string
  onChange: (v: string) => void
  label?: string        // default: "Lý do bỏ phiếu"
  description?: string  // default: "Rationale sẽ được lưu trên IPFS..."
  placeholder?: string  // default: "Nhập lý do bỏ phiếu..."
  maxLength?: number    // default: 2000
  height?: number       // default: 220
  optional?: boolean    // hiện "Optional" badge bên cạnh label
}
```

---

## Phase 5 — Inline form trong community/page.tsx

**File:** `apps/web/app/dreps/[drepId]/community/page.tsx`

- [x] **5.1** Thêm state: `isFormOpen`, `title`, `abstract`, `motivation`, `startsAt`, `endsAt`, `isSubmitting`, `formError`
- [x] **5.2** Toolbar: button toggle ⊕/⊖ (chỉ hiện với `isOwner`)
- [x] **5.3** Inline form (render khi `isFormOpen`):
  - Title input, maxLength=80, counter `{n}/80`
  - Abstract: `<RationaleEditor label="Abstract" maxLength={2500} height={180} />`
  - Motivation: `<RationaleEditor label="Motivation" optional maxLength={2500} height={180} />`
  - Start/End datetime-local pickers
  - Error display
  - Buttons: Hủy / Tạo Poll
- [x] **5.4** Guards:
  - `!isConnected` → inline prompt trong form
  - `!isOwner` → không render button tạo
  - Community inactive → không render (đã có guard ở page level)
- [x] **5.5** Auto re-auth trước submit (`getJwt()` + `ensureAuth()` pattern)
- [x] **5.6** On success: reset form, `setIsFormOpen(false)`, refetch polls

---

## Phase 6 — Cleanup

- [x] **6.1** Xóa `apps/web/app/dreps/[drepId]/community/new/page.tsx`

---

## Files thay đổi

```
apps/api/src/main/resources/db/migration/
  V2__add_motivation_to_polls.sql    [NEW]

apps/api/src/main/kotlin/db/
  Tables.kt                          [EDIT] thêm motivation column

apps/api/src/main/kotlin/routes/
  CommunityRoutes.kt                 [EDIT] motivation field

packages/types/src/api/
  community.ts                       [EDIT] motivation schemas

apps/web/components/governance/
  RationaleEditor.tsx                [EDIT] generic props

apps/web/app/dreps/[drepId]/community/
  page.tsx                           [EDIT] inline form
  new/page.tsx                       [DELETE]
```

---

## Ghi chú kỹ thuật

- `votingType` luôn là `"BASIC"` (Yes/No/Abstain) — không expose selector ở v1
- Title maxLength 80 enforce ở FE; DB column `VARCHAR(255)` giữ nguyên
- `RationaleEditor` dùng `@uiw/react-md-editor` (SSR disabled via `dynamic()`)
- Auto re-auth: check `getJwt()` trước submit, redirect re-auth nếu thiếu (pattern từ `feature/upload-auto-reauth`)
