# Current Status

*Cập nhật lần cuối: 2026-07-09*

---

## Đã hoàn thành

Core infra, wallet (CIP-30/95), DRep registration wizard, DRep profile page, governance actions (list + detail + vote), DRep community + internal polls, VoteIndexer chain-sync. Chi tiết xem git log.

Mới (06/06 → 07/09): alliance feature (PR #109) · fix SPO vote bar/voting power (active_stake, min-sliver PR #110) · VoteIndexer checkpoint pre-Conway · treasury withdrawal amount trên GA card (PR #107) · **design system @tempo/ui hoàn tất 4/4 đợt** (PR #113/#115/#117/#118 — tokens + 14 primitives + 11 domain components + docs; UI mới bắt buộc import từ `@tempo/ui`, xem `packages/ui/README.md`).

---

## Chưa hoàn thành

### High Priority
- [ ] **Active Voting Power (Kupo)**: `stakeKeyBalance` trả `null`. Cần query Kupo UTxOs cho stake address của DRep. Ogmios `rewardAccountSummaries` chỉ trả `deposit` (2 ADA) + `rewards`, không phải wallet balance.
- [ ] **Auth enforcement**: `/auth/challenge` + `/auth/verify` đã implement JWT nhưng chưa enforce trên bất kỳ endpoint nào. Community/poll creation không cần auth.
- [ ] **DRep Registration e2e test**: Guards ✅ (chưa connect / không CIP-95 / đã là DRep đều có UI). End-to-end test thủ công trên preprod (Eternl + Pinata JWT thật) chưa xong.
- [x] **Poll voting UI**: Đã implement — `GET /communities/polls/{pollId}`, `POST /communities/polls/{pollId}/vote`, FE voting UI với result bars.

### Medium Priority
- [x] **Delegation TX UI**: DelegateModal ✅ — build/sign/submit flow + ConnectWalletCta. PR #19 merged.
- [ ] **DRep Update / Retire UI**: TX types sẵn sàng ở BE, FE chưa có.
- [ ] **DRep list pagination**: hiện load toàn bộ từ Ogmios, paginate client-side.
- [ ] **Pinata gateway hardcode**: `resolveAnchorUrls()` hardcode URL thay vì dùng `NEXT_PUBLIC_PINATA_GATEWAY`.

### Low Priority
- [ ] **DApp Ranking**: mock data, cần real data source.
- [ ] **VoteIndexer findIntersect**: luôn stream từ genesis; nếu Ogmios hỗ trợ `findIntersect`, có thể resume từ checkpoint thật sự.

---

## Technical Debt

| Vấn đề | File | Mức độ |
|--------|------|--------|
| Dead fn `queryStakeKeyBalance` | `DRepRoutes.kt` | Low |
| Hardcode Pinata gateway | `hooks/useDRepProfile.ts`, `lib/governance.ts` | Low |
| `StubRoutes.kt` tên misleading (chứa auth routes) | `routes/StubRoutes.kt` | Low |
| Mock data còn trong `DRepList.tsx`, `dapp-ranking/page.tsx` | Multiple | Medium |
| `votingPower` trong `PollVotes` hardcode `0L` — cần Kupo query | `CommunityRoutes.kt` | Medium |
| Poll voting không verify stake address ownership | `CommunityRoutes.kt` | High |
| Community activate không verify TX on-chain | `CommunityRoutes.kt` | High |

---

## Rủi ro

1. **VoteIndexer reconnect**: lỗi WS → retry 30s. Node down lâu → gap trong voting history.
2. **Stale cache**: BackgroundPoller fail silent — cache có thể cũ đến 10 phút.
3. **No rate limiting**: API không giới hạn request — DDoS/spam possible.

---

## Câu hỏi mở

1. Cache Kupo UTxO balance bao lâu? (thay đổi theo epoch)
2. Community activate có cần verify TX on-chain không?
3. Auth scope: tạo poll? vote? comment? — ai cần auth?
4. DRep list: client-side pagination hay server-side?
