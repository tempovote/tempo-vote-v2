# Plan: Governance Actions Feature

**Status tracking across sessions — update checkboxes khi hoàn thành từng bước.**

---

## Tổng quan

Hiển thị danh sách Governance Actions on-chain (từ Ogmios), cho phép DRep đã đăng ký vote trực tiếp trong app.

**Flow vote:**
```
DRep xem danh sách GA → Chọn GA → Chọn YES/NO/ABSTAIN
→ submitTx("VOTE", { govActionTxHash, govActionIndex, voteKind })
→ Backend build TX VOTE (Kotlin) → Sign in wallet → Submit via Ogmios
→ Hiển thị txHash + thông báo thành công
```

**Quyết định kiến trúc:**
- Data source: Ogmios `queryLedgerState/governanceActions` (đã có BackgroundPoller)
- Anchor metadata (title/abstract): FE tự fetch từ `anchorUrl` sau khi nhận list từ backend
- Vote thresholds: Hiển thị static (67% DRep cho TreasuryWithdrawals), fetch dynamic từ protocol params sau
- Voting: chỉ cho connected DRep (check `hasCip95 && isDrepRegistered`)

---

## Trạng thái ban đầu

| Thành phần | File | Trạng thái |
|---|---|---|
| Build TX `VOTE` | `TxBuilder.kt:buildVote()` | ✅ Sẵn sàng |
| `POST /tx/build` VOTE type | `TransactionRoutes.kt` | ✅ Sẵn sàng |
| `GET /governance-actions` (raw Ogmios) | `GovernanceRoutes.kt` | ⚠️ Trả raw JSON, chưa có DTO |
| `GET /governance-actions/{txHash}` | `GovernanceRoutes.kt` | ⚠️ Stub (trả toàn bộ list) |
| BackgroundPoller govActions (5 phút) | `BackgroundPoller.kt` | ✅ Sẵn sàng |
| Trang `/governance-actions` | `apps/web/app/governance-actions/page.tsx` | ⚠️ Dùng mock data |
| `GovernanceActionCard` | `apps/web/components/governance/` | ⚠️ Dùng mock data structure |
| Trang detail `/governance-actions/[txHash]/[index]` | — | ❌ Chưa có |
| Vote button + modal | — | ❌ Chưa có |

---

## Cấu trúc dữ liệu Ogmios

Ogmios 6.x `queryLedgerState/governanceActions` trả về mảng objects:

```json
[
  {
    "proposal": {
      "transaction": { "id": "abc123..." },
      "index": 0
    },
    "action": {
      "type": "treasuryWithdrawals",
      "withdrawals": [...]
    },
    "metadata": {
      "hash": "def456...",
      "url": "https://ipfs.io/ipfs/Qm..."
    },
    "since": { "slot": 123456, "block": "abc..." },
    "until": { "epoch": 500 },
    "votes": {
      "dRepVotes": {
        "yes":     { "ada": { "lovelace": 5130000000000 } },
        "no":      { "ada": { "lovelace": 912000000000 } },
        "abstain": { "ada": { "lovelace": 0 } }
      },
      "spoVotes": { "yes": {...}, "no": {...}, "abstain": {...} },
      "committeeVotes": { "yes": 7, "no": 0, "abstain": 0 }
    }
  }
]
```

**Action types (Conway era):**
- `treasuryWithdrawals` → hiển thị "Treasury Withdrawals"
- `protocolParametersUpdate` → "Protocol Parameter Change"
- `hardForkInitiation` → "Hard Fork Initiation"
- `noConfidence` → "No Confidence"
- `updateCommittee` → "Update Committee"
- `newConstitution` → "New Constitution"
- `infoAction` → "Info Action"

---

## Phase 1 — Backend: GovernanceActionDto + improved routes

**Branch:** `feature/governance-actions`

### Mục tiêu
Thay `GovernanceRoutes.kt` trả raw JSON bằng typed DTOs sau khi map từ Ogmios.

### Checklist

- [x] **1.1** Tạo `GovernanceActionDto.kt` trong `apps/api/src/main/kotlin/cardano/`
  ```kotlin
  @Serializable
  data class GovernanceActionDto(
      val txHash: String,
      val index: Int,
      val type: String,          // "TreasuryWithdrawals" | "ProtocolParameterChange" | ...
      val anchorUrl: String?,
      val anchorHash: String?,
      val expiresEpoch: Int,
      val drepVotes: DRepVotesSummary,
      val spoVotes: VotesSummary,
      val ccVotes: CommitteeVotesSummary,
  )

  @Serializable
  data class DRepVotesSummary(
      val yesLovelace: Long,
      val noLovelace: Long,
      val abstainLovelace: Long,
  )

  @Serializable
  data class VotesSummary(
      val yesLovelace: Long,
      val noLovelace: Long,
      val abstainLovelace: Long,
  )

  @Serializable
  data class CommitteeVotesSummary(
      val yes: Int,
      val no: Int,
      val abstain: Int,
      val total: Int,
  )
  ```

- [x] **1.2** Tạo hàm `mapOgmiosGovAction(json: JsonObject): GovernanceActionDto?` trong cùng file
  - Parse `proposal.transaction.id` → `txHash`, `proposal.index` → `index`
  - Parse `action.type` → map sang display string
  - Parse `metadata.url` → `anchorUrl`, `metadata.hash` → `anchorHash`
  - Parse `until.epoch` → `expiresEpoch`
  - Parse `votes.dRepVotes`, `spoVotes`, `committeeVotes`
  - Lovelace: Ogmios trả `{ "ada": { "lovelace": N } }` hoặc `{ "lovelace": N }` — handle cả 2

- [x] **1.3** Cập nhật `GovernanceRoutes.kt`:
  - `GET /governance-actions` → map raw Ogmios array → `List<GovernanceActionDto>`, trả JSON array
  - Thêm query param `?type=` để filter theo action type (optional)
  - `GET /governance-actions/{txHash}/{index}` → filter list để trả single item (404 nếu không tìm thấy)

- [x] **1.4** Thêm `GovernanceActionDto` vào `CardanoCache` type hoặc giữ raw cache + map khi serve

---

## Phase 2 — Frontend types + API client

**Branch:** `feature/governance-actions`

### Mục tiêu
Định nghĩa TypeScript types và helper fetch functions.

### Checklist

- [x] **2.1** Thêm Zod schema + TypeScript types vào `packages/types/src/index.ts`:
  ```typescript
  export const GovernanceActionSchema = z.object({
    txHash: z.string(),
    index: z.number(),
    type: z.string(),
    anchorUrl: z.string().nullable(),
    anchorHash: z.string().nullable(),
    expiresEpoch: z.number(),
    drepVotes: z.object({
      yesLovelace: z.number(),
      noLovelace: z.number(),
      abstainLovelace: z.number(),
    }),
    spoVotes: z.object({ ... }),
    ccVotes: z.object({
      yes: z.number(),
      no: z.number(),
      abstain: z.number(),
      total: z.number(),
    }),
  })
  export type GovernanceAction = z.infer<typeof GovernanceActionSchema>
  ```

- [x] **2.2** Tạo `apps/web/hooks/useGovernanceActions.ts`:
  ```typescript
  export function useGovernanceActions(network: string) {
    // SWR hoặc simple useState + useEffect
    // GET /governance-actions?network=...
    // Returns: { actions, isLoading, error }
  }
  ```

- [x] **2.3** Tạo `apps/web/lib/governance.ts` — helper functions:
  - `lovelaceToAda(n: number): string` → "5.13B", "912M", "1.5K"
  - `getActionTypeLabel(type: string): string`
  - `computeVotePercent(yes, no, abstain): { yesPercent, noPercent, abstainPercent }`
  - `DREP_THRESHOLDS` map theo action type (static, từ protocol params)

---

## Phase 3 — Frontend: List Page với real data

**Branch:** `feature/governance-actions`

### Mục tiêu
Thay mock data bằng API call, thêm UX tốt hơn.

### Checklist

- [x] **3.1** Cập nhật `GovernanceActionCard.tsx`:
  - Nhận `GovernanceAction` type (từ `@tempo/types`) thay mock type
  - Giữ nguyên layout (vote bars, badge, etc.)
  - Thêm link đến detail page: `/governance-actions/{txHash}/{index}`
  - Lazy-load anchor metadata (title) từ `anchorUrl` nếu có

- [x] **3.2** Cập nhật `apps/web/app/governance-actions/page.tsx`:
  - Thay `mockGovernanceActions` bằng `useGovernanceActions` hook
  - Loading skeleton (4 placeholder cards)
  - Empty state ("Không có governance actions nào")
  - Error state (API không khả dụng)
  - Filter chips: All / Treasury / Protocol Param / Hard Fork / ...
  - Search (filter by title, txHash)

- [x] **3.3** Loại bỏ mock governance actions khỏi `lib/mock-data.ts`

---

## Phase 4 — Frontend: Detail Page + Vote UI

**Branch:** `feature/governance-actions`

### Mục tiêu
Trang detail cho từng GA — hiển thị đầy đủ thông tin + cho phép DRep vote.

### Checklist

- [x] **4.1** Tạo `apps/web/app/governance-actions/[txHash]/[index]/page.tsx`:
  - `GET /governance-actions/{txHash}/{index}` → full GA info
  - Hiển thị: loại, trạng thái epoch, anchor URL, mô tả (từ anchor metadata)
  - Vote breakdown: DRep bar + SPO bar + CC bar (tương tự GovernanceActionCard nhưng chi tiết hơn)
  - Breadcrumb: Governance Actions → {title}

- [x] **4.2** Vote section (chỉ hiển thị khi `isConnected && isDrepRegistered`):
  ```
  ┌─────────────────────────────┐
  │  Bỏ phiếu của bạn           │
  │  [YES]  [NO]  [ABSTAIN]     │
  │  Xác nhận & Ký giao dịch    │
  └─────────────────────────────┘
  ```
  - Vote chưa có: hiển thị 3 nút
  - Đã vote: hiển thị vote hiện tại + option đổi
  - State machine: `idle` → `confirm` → `signing` → `success` / `error`

- [x] **4.3** Vote confirmation: modal hoặc inline confirm step
  - Hiển thị: GA title, vote choice, network fee ~0.2 ADA
  - Nút "Xác nhận & Ký"

- [x] **4.4** Kết nối với `useTx`:
  ```typescript
  await submitTx("VOTE", {
    drepId,
    govActionTxHash: txHash,
    govActionIndex: index,
    voteKind, // "YES" | "NO" | "ABSTAIN"
  })
  ```

- [x] **4.5** Success state: txHash link đến CardanoScan

---

## Phase 5 — Check "My Vote" status

**Branch:** `feature/governance-actions`

### Mục tiêu
Hiển thị vote của connected DRep trên từng GA (nếu đã vote).

### Checklist

- [x] **5.1** Backend: `GET /governance-actions/{txHash}/{index}/votes?drepId=drep1...`
  - Ogmios raw votes object có thể chứa individual DRep votes
  - Parse để tìm vote của drepId cụ thể
  - Trả `{ voted: "YES" | "NO" | "ABSTAIN" | null }`

- [x] **5.2** Frontend: `useMyVote(txHash, index, drepId)` hook
  - Hiển thị badge "Đã bỏ phiếu: YES ✓" trên GovernanceActionCard
  - Hiển thị trên detail page

---

## Thứ tự thực hiện

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
```

Phase 4 có thể bắt đầu song song với Phase 3 sau khi Phase 1+2 xong.
Phase 5 là optional enhancement — skip nếu Ogmios không expose individual DRep votes dễ dàng.

---

## Lưu ý kỹ thuật

### Lovelace parsing từ Ogmios
Ogmios 6.x trả lovelace theo nhiều format tuỳ version:
- `{ "ada": { "lovelace": 5130000000000 } }` — preferred
- `{ "lovelace": 5130000000000 }` — fallback

Hàm helper nên handle cả 2 khi parse `votes.*`.

### Thresholds
Thresholds governance phụ thuộc action type và được lưu trong protocol parameters. 
Trị mặc định preprod/mainnet (Conway):
- TreasuryWithdrawals: DRep 67%, CC 60%  
- ProtocolParameterChange: DRep 75%, CC 60%
- HardForkInitiation: DRep 60%, SPO 51%, CC 60%
- NoConfidence: DRep 60%, SPO 51%

### Epoch to date conversion
Ogmios trả `until.epoch` (số epoch). Frontend có thể hiển thị "Epoch 500" thay vì ngày cụ thể (đơn giản hơn).

### DRep votes vs ADA stake
`dRepVotes.yes.lovelace` là tổng ADA stake của các DRep đã vote YES (không phải số DRep).
Display: format sang ADA với suffix M/B: `5.13B ADA`.
