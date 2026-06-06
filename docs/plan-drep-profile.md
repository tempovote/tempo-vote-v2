# Plan: DRep Profile Page

Branch: `feature/drep-profile`

## Mục tiêu

Xây dựng trang `/dreps/[drepId]` hiển thị thông tin đầy đủ của một DRep:
- Thông tin cơ bản: tên, voting power, status
- CIP-119 metadata: objectives, motivations, qualifications
- Voting history: toàn bộ GA đã vote, phân trang 20/trang

## Phân tích hiện trạng

| Đã có | Ghi chú |
|-------|---------|
| `GET /dreps/{drepId}` | Trả về `{ isRegistered, id, name, anchorUrl }` — cần thêm `votingPower` |
| `GET /governance-actions/{txHash}/{index}/my-vote` | Vote của 1 DRep cho 1 GA |
| `CardanoCache.govActions` | Raw Ogmios proposals (có full votes array) |
| `drepIdToCredentialHex()` | Normalize drepId → credential hex |
| `useAnchorTitle` hook | IPFS multi-gateway fetch pattern |
| `Cip119Body` type | Đủ fields cho profile |

## Kế hoạch thực hiện

### Phase 1 — Backend

**1a. Extend `/dreps/{drepId}`** để trả về thêm `votingPower` (lovelace từ Ogmios `stake` field).

**1b. Thêm `GET /dreps/{drepId}/votes`** endpoint vào `DRepRoutes.kt`:
- Query params: `network`, `page` (default 1), `limit` (default 20)
- Dùng `CardanoCache.govActions` (cache chung với governance routes)
- Với mỗi GA, tìm entry trong `votes` array có `issuer.role == "delegateRepresentative"` và `issuer.id == credentialHex`
- Trả về `{ votes: [...], total, page, limit }`

**1c. Expose `actionTypeLabel()`** thành `internal` trong `GovernanceActionDto.kt` (để dùng được từ DRepRoutes).

Response shape của votes endpoint:
```json
{
  "votes": [
    {
      "txHash": "abc...",
      "index": 0,
      "type": "Treasury Withdrawals",
      "actionType": "treasuryWithdrawals",
      "anchorUrl": "ipfs://...",
      "vote": "yes",
      "expiresEpoch": 123
    }
  ],
  "total": 87,
  "page": 1,
  "limit": 20
}
```

### Phase 2 — Types

Thêm file `packages/types/src/api/drep.ts`:
- `DRepVote` — một entry trong voting history
- `DRepVotingHistory` — response của votes endpoint
- `DRepProfile` — response cơ bản của `/dreps/{drepId}` (thêm `votingPower`)

Export từ `packages/types/src/index.ts`.

### Phase 3 — Frontend Hooks

**`hooks/useDRepProfile.ts`**:
1. Fetch `GET /dreps/{drepId}?network=`
2. Nếu có `anchorUrl`, fetch CIP-119 JSON từ IPFS (multi-gateway, 5s timeout)
3. Trả về combined data: `{ isRegistered, name, votingPower, objectives, motivations, qualifications, imageUrl, isLoading, error }`

**`hooks/useDRepVotingHistory.ts`**:
- Fetch `GET /dreps/{drepId}/votes?network=&page=&limit=20`
- Trả về `{ votes, total, page, limit, isLoading, error }`

### Phase 4 — UI

**`app/dreps/[drepId]/page.tsx`** (`"use client"`):

```
DRepProfilePage
├── ProfileHeader          # Avatar gradient, tên, drepId chip, voting power, status badge, Delegate btn
├── DRepCommunityCard      # Mockup "Coming Soon"
├── AboutSection           # Objectives + Motivations + Qualifications (skeleton khi loading IPFS)
└── VotingHistory          # Bảng 20/trang với pagination
    └── VoteHistoryRow     # [Type chip] | title link | Epoch N | [YES/NO/ABSTAIN badge]
```

Avatar: gradient 2 màu từ hash của drepId (deterministic, không cần IPFS). Nếu CIP-119 có `image`, dùng thay thế.

**Không làm**: delegator count (cần query tất cả stake accounts — quá expensive, để sau).

## Files sẽ thay đổi

| File | Thay đổi |
|------|---------|
| `apps/api/.../GovernanceActionDto.kt` | `actionTypeLabel` → `internal` |
| `apps/api/.../routes/DRepRoutes.kt` | Thêm `votingPower` vào `/dreps/{drepId}` + new `/dreps/{drepId}/votes` |
| `packages/types/src/api/drep.ts` | NEW — DRepVote, DRepVotingHistory, DRepProfile |
| `packages/types/src/index.ts` | Export drep types |
| `apps/web/hooks/useDRepProfile.ts` | NEW |
| `apps/web/hooks/useDRepVotingHistory.ts` | NEW |
| `apps/web/app/dreps/[drepId]/page.tsx` | NEW |

## Trạng thái

- [x] Branch `feature/drep-profile` tạo xong
- [x] Plan ghi vào file này
- [x] Phase 1: Backend — `actionTypeLabel` internal, `votingPower` field, `/dreps/{drepId}/votes` endpoint
- [x] Phase 2: Types — `DRepVote`, `DRepVotingHistory`, `DRepProfile` trong `packages/types/src/api/drep.ts`
- [x] Phase 3: Hooks — `useDRepProfile`, `useDRepVotingHistory`
- [x] Phase 4: UI — `app/dreps/[drepId]/page.tsx`, link từ `DRepList`
