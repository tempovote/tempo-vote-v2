# Current Status

*Cập nhật lần cuối: 2026-06-06*

---

## Đã hoàn thành

### Core Infrastructure
- [x] Monorepo setup: Turborepo (TS) + Gradle (Kotlin)
- [x] PostgreSQL schema + Flyway migrations (V1 init, V2 drep_votes)
- [x] Ktor backend plugins: serialization, CORS, status pages, routing
- [x] BackgroundPoller: refresh Ogmios cache mỗi 5 phút
- [x] VoteIndexer: chain-sync qua Ogmios WebSocket, index DRep votes

### Wallet Integration
- [x] CIP-30 connect/disconnect + auto-reconnect (localStorage)
- [x] CIP-95 getDRepKey — lấy DRep credential key
- [x] HexAddress → bech32 decode (`hexAddressToBech32`)
- [x] Wallet store (Zustand): api, addresses, drepKey, network detection
- [x] Fetch DRep registration + delegation status sau connect
- [x] `WalletModal`: danh sách ví available, connect UI

### DRep Registration
- [x] Multi-step wizard (4 bước): Form → Preview → Sign → Success
- [x] CIP-119 metadata builder (givenName, motivations, objectives, qualifications, image, references)
- [x] Image upload → Pinata IPFS (`POST /metadata/upload-image`)
- [x] Metadata upload → Pinata IPFS (`POST /metadata/upload`, blake2b-256 hash)
- [x] Build TX `DREP_REGISTER` (Kotlin QuickTxBuilder)
- [x] Optimistic update: `setDRepStatus(isDrepRegistered: true)` sau khi TX submitted
- [x] `RegisterDRepSuccess.tsx` với CardanoScan link

### DRep Profile Page
- [x] Fetch DRep info từ Ogmios + CIP-119 metadata từ IPFS
- [x] Avatar: gradient deterministic từ drepId hash (fallback nếu không có image)
- [x] CIP-119 image parsing: `contentUrl`, `url`, `@id` (JSON-LD) fallbacks
- [x] Voting Power display (lovelace từ Ogmios `stake` field)
- [x] Voting History: paginated, lazy-fetch CIP-108 title từ anchor URL
- [x] Community CTA inline: 
  - Owner: "Kích hoạt Community · 2 ADA" / "Your DRep Community"
  - Non-owner: "Delegate Voting Power" + "Your DRep Community" (khi active)
- [x] CommunityModal: danh sách polls + link đến community page
- [x] isOwner check ẩn "Delegate Voting Power" button

### Governance Actions
- [x] `GovernanceActionDto` mapper từ raw Ogmios JSON
- [x] `GET /governance-actions` với optional `?type=` filter
- [x] `GET /governance-actions/{txHash}/{index}` detail endpoint
- [x] `GET /governance-actions/{txHash}/{index}/my-vote` — vote của DRep cụ thể
- [x] GA list page với filter chips + search + loading skeleton
- [x] `GovernanceActionCard` với vote bars (DRep %, SPO %, CC %)
- [x] GA detail page với đầy đủ vote breakdown
- [x] Vote UI: 3 nút YES/NO/ABSTAIN → confirm → sign → txHash
- [x] `useMyVote` hook + badge "Đã bỏ phiếu" trên card

### DRep Community
- [x] `GET /communities/{drepId}` endpoint
- [x] `POST /communities/{drepId}/activate` (lưu community, không verify TX on-chain)
- [x] `GET /communities/{drepId}/polls` (paginated, với status: active/pending/closed)
- [x] `POST /communities/{drepId}/polls` (tạo poll mới)
- [x] `GET/POST /communities/polls/{pollId}/comments`
- [x] `useCommunity`, `useCommunityPolls` hooks

### Other Pages
- [x] Homepage: hero section, Become DRep CTA, Delegate CTA, GA preview, Polls preview
- [x] DRep list page: DRepList component, link → profile
- [x] DApp Ranking page (mock data)

---

## Đang phát triển

*(Không có task đang in-progress tại thời điểm này)*

---

## Chưa hoàn thành

### High Priority
- [ ] **Active Voting Power (Kupo)**: `stakeKeyBalance` hiện trả `null`. Cần query Kupo UTxOs cho stake address của DRep. Ogmios `rewardAccountSummaries` trả `deposit` (2 ADA) + `rewards`, không phải wallet balance.
- [ ] **Auth enforcement**: `GET /auth/challenge` và `POST /auth/verify` đã implement (JWT) nhưng chưa enforce trên bất kỳ endpoint nào. Community/poll creation hiện không cần auth.
- [ ] **DRep Registration guards**: 
  - Wallet chưa connect → prompt connect
  - Ví không support CIP-95 → thông báo lỗi  
  - Đã là DRep → redirect
  - End-to-end test preprod chưa hoàn thành (checklist 3.4, 3.5)
- [ ] **Poll voting UI**: Schema DB sẵn sàng (`poll_votes`, `poll_options`) nhưng FE chưa có vote UI cho Internal Polls

### Medium Priority
- [ ] **Delegation TX flow**: Backend `buildDelegation()` sẵn sàng, FE UI chưa có (chỉ có button trên DRep profile)
- [ ] **DRep Update**: TX type `DREP_UPDATE` sẵn sàng ở BE, FE chưa có UI
- [ ] **DRep Retire**: TX type `DREP_RETIRE` sẵn sàng ở BE, FE chưa có UI
- [ ] **Pagination trên DRep list**: hiện load tất cả DRep từ Ogmios
- [ ] **Pinata gateway trong resolveAnchorUrls**: đang hardcode gateway URL, nên dùng `NEXT_PUBLIC_PINATA_GATEWAY`

### Low Priority / Nice to Have
- [ ] **DApp Ranking page**: đang dùng mock data, cần real data source
- [ ] **Delegator count trên DRep profile**: cần query tất cả stake accounts — expensive
- [ ] **VoteIndexer findIntersect**: hiện luôn start từ genesis, chỉ dùng checkpoint để skip DB writes. Nếu Ogmios hỗ trợ `findIntersect`, có thể start từ checkpoint thật sự.

---

## Technical Debt

| Vấn đề | File | Mức độ |
|--------|------|--------|
| Dead code: `queryStakeKeyBalance` function | `DRepRoutes.kt` | Low |
| Hardcode Pinata gateway URL | `hooks/useDRepProfile.ts`, `lib/governance.ts` | Low |
| `StubRoutes.kt` contains auth (challenge/verify) — misleading name | `routes/StubRoutes.kt` | Low |
| Mock data còn trong `DRepList.tsx`, `dapp-ranking/page.tsx` | Multiple | Medium |
| `PollOptions` table chưa được populate khi tạo poll | `CommunityRoutes.kt` | Medium |
| Poll voting chưa kiểm tra stake address ownership | `CommunityRoutes.kt` | High |
| Community activate không verify TX on-chain | `CommunityRoutes.kt` | High |

---

## Rủi ro hiện tại

1. **Ogmios WebSocket không stable**: VoteIndexer reconnect sau 30s khi lỗi. Nếu node down lâu, voting history có thể bị gap.
2. **Cache stale**: BackgroundPoller fail silent — nếu Ogmios unreachable, cache có thể cũ đến 10 phút (TTL).
3. **PINATA_JWT expose**: JWT trong `.env` có quyền pin/unpin, cần rotate nếu lộ.
4. **No rate limiting**: API không có rate limiting — DDoS/spam possible.

---

## Câu hỏi mở

1. **Active Voting Power**: Sau khi add Kupo integration, nên cache kết quả bao lâu? (stake balance thay đổi theo epoch)
2. **Community activation verification**: Có cần verify TX on-chain không, hay trust FE gửi txHash là đủ?
3. **Auth scope**: Những endpoint nào cần auth? Tạo poll? Vote internal poll? Comment?
4. **DRep list pagination**: Load tất cả từ Ogmios và paginate client-side, hay cần server-side pagination?
