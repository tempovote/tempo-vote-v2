# Plan: GA Detail — Vote History & Metadata Tabs

**Branch:** `feature/ga-vote-history-metadata`  
**Created:** 2026-06-09

## Mục tiêu

Thêm 2 tab bên dưới card "Kết quả bỏ phiếu" trên trang GA Detail:

- **Tab 1 — Lịch sử Phiếu**: danh sách từng phiếu DRep / CC / SPO (voter ID, kết quả, voting power)
- **Tab 2 — Metadata GA**: nội dung tài liệu CIP-108 từ anchor URL (title, abstract, motivation, rationale, references)

## Thiết kế

### Tab Lịch sử Phiếu

```
┌──────────────────────────────────────────────┐
│  [DRep (42)]  [CC (7)]  [SPO (3)]            │
├──────────────────────────────────────────────┤
│  drep1abc...xyz    ●YES     12.4M ADA         │
│  drep1def...uvw    ●NO      3.1M ADA          │
│  drep1ghi...rst    ●ABSTAIN 0.8M ADA          │
│  ...                                          │
└──────────────────────────────────────────────┘
```

- Sub-tabs: DRep / CC / SPO (badge count)
- Mỗi row: truncated voter ID (copy on click) + vote badge màu + voting power (ADA, chỉ DRep)
- Sort: YES → NO → ABSTAIN, trong mỗi nhóm sort by voting power DESC

### Tab Metadata GA

```
┌──────────────────────────────────────────────┐
│  Abstract                                     │
│  This proposal aims to...                     │
│                                               │
│  Motivation                                   │
│  The current system...                        │
│                                               │
│  Rationale                                    │
│  We chose this approach because...            │
│                                               │
│  References                                   │
│  • CIP-1694: https://...                      │
└──────────────────────────────────────────────┘
```

- Fetch từ anchorUrl client-side (tương tự useAnchorTitle — IPFS gateway fallback)
- Hiển thị: abstract, motivation, rationale, references (CIP-108)
- Skeleton loading + error state nếu anchor unavailable / CORS fail

## Kế hoạch chi tiết

### Phase 1 — Backend: thêm individual votes vào DTO

**File:** `apps/api/src/main/kotlin/cardano/GovernanceActionDto.kt`

1. Thêm data class:
   ```kotlin
   @Serializable
   data class VoteEntry(
       val role: String,   // "drep" | "cc" | "spo"
       val id: String,     // credential hex (56 chars) for DRep/CC, poolId for SPO
       val vote: String,   // "yes" | "no" | "abstain"
       val votingPower: Long = 0L,  // lovelace (DRep only)
   )
   ```

2. Thêm field vào `GovernanceActionDto`:
   ```kotlin
   val votes: List<VoteEntry> = emptyList(),
   ```

3. Trong `mapOgmiosProposal`: extract individual votes từ `votes` JsonArray trước khi aggregate:
   ```kotlin
   val voteEntries = extractVoteEntries(votes, stakeCtx)
   ```

4. Hàm `extractVoteEntries(votes: JsonArray, stakeCtx: DRepStakeContext): List<VoteEntry>`:
   - Map role Ogmios → label ngắn: `delegateRepresentative` → `drep`, `constitutionalCommittee` → `cc`, `stakePoolOperator` → `spo`
   - Với DRep: lookup `stakeCtx.stakeMap[id]` để lấy votingPower

**File:** `packages/types/src/api/governance.ts`

5. Thêm Zod schema:
   ```typescript
   export const VoteEntrySchema = z.object({
     role: z.enum(["drep", "cc", "spo"]),
     id: z.string(),
     vote: z.enum(["yes", "no", "abstain"]),
     votingPower: z.number().default(0),
   })
   export type VoteEntry = z.infer<typeof VoteEntrySchema>
   ```

6. Thêm vào `GovernanceActionSchema`:
   ```typescript
   votes: z.array(VoteEntrySchema).default([]),
   ```

### Phase 2 — Frontend: useAnchorMetadata hook

**File:** `apps/web/hooks/useAnchorMetadata.ts` (mới)

- Pattern giống `useAnchorTitle` nhưng trả `AnchorMetadata | null`
- Parse CIP-108 fields: `body.abstract`, `body.motivation`, `body.rationale`, `body.references`
- Cache trong sessionStorage (key = anchorUrl)
- Loading state: `{ data: null, loading: true, error: null }`

```typescript
interface AnchorMetadata {
  title?: string
  abstract?: string
  motivation?: string
  rationale?: string
  references?: Array<{ label: string; uri: string }>
}
```

### Phase 3 — Frontend: components

**File:** `apps/web/components/governance/GaDetailTabs.tsx` (mới)

- Props: `action: GovernanceAction`
- Tab state: `"votes" | "metadata"`
- Chỉ hiển thị tab Metadata nếu `action.anchorUrl` tồn tại

**File:** `apps/web/components/governance/VoteHistoryTab.tsx` (mới)

- Props: `votes: VoteEntry[]`
- Sub-tab state: `"drep" | "cc" | "spo"`
- Filter votes theo role + sort (YES→NO→ABSTAIN, trong cùng vote sort by votingPower DESC)
- Empty state nếu không có votes cho role đó

**File:** `apps/web/components/governance/GaMetadataTab.tsx` (mới)

- Props: `anchorUrl: string`
- Dùng `useAnchorMetadata(anchorUrl)`
- Render từng section với heading + prose text
- References: list of clickable links

### Phase 4 — Wire vào GA Detail page

**File:** `apps/web/app/governance-actions/[txHash]/[index]/page.tsx`

Thêm sau `VoteResultsPanel`:
```tsx
{/* Vote history + Metadata tabs */}
<GaDetailTabs action={action} />
```

## Thứ tự thực hiện

1. `GovernanceActionDto.kt` — thêm VoteEntry + votes field
2. `packages/types` — thêm VoteEntrySchema
3. `useAnchorMetadata.ts` — hook fetch CIP-108
4. `VoteHistoryTab.tsx` — component
5. `GaMetadataTab.tsx` — component
6. `GaDetailTabs.tsx` — wrapper tabs
7. `page.tsx` — wire vào detail page
8. Verify trên localhost

## Lưu ý kỹ thuật

- **Historical proposals**: `votes` được lưu trong `snapshotJson` trong DB — historical proposals cũng có đầy đủ vote list
- **Kích thước response**: ~200 DRep votes × 80 bytes ≈ 16KB/proposal — chấp nhận được
- **CORS cho metadata**: `useAnchorTitle` đã fetch anchor từ IPFS gateway client-side thành công — metadata fetch dùng cùng pattern
- **Voter ID display**: DRep credential hex (56 chars) → convert sang `drep1...` bech32 dùng `credentialHexToDrepId()` đã có
- **SPO pool ID**: raw poolId từ Ogmios là credential hex — display as-is (truncated), không convert
