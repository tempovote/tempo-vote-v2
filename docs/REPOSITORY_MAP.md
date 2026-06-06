# Repository Map

## Cấu trúc thư mục cấp cao

```
tempo-vote-v2/
├── apps/
│   ├── web/          Next.js 15 frontend (port 3000)
│   └── api/          Kotlin/Ktor backend (port 8080)
├── packages/
│   ├── wallet-bridge/ CIP-30/CIP-95 raw wallet API (browser only)
│   ├── types/         Zod schemas + TypeScript types (shared FE/BE)
│   ├── ui/            Shared UI components (minimal, mostly in apps/web)
│   └── config/        ESLint, TypeScript, Tailwind configs
├── docs/              Documentation (AI context, architecture, plans)
├── .env               Environment variables (gitignored)
├── pnpm-workspace.yaml
├── turbo.json
└── settings.gradle.kts
```

---

## Backend — `apps/api/`

### Entry point
`src/main/kotlin/Application.kt` — main(), Ktor module setup, starts BackgroundPoller + VoteIndexers

### Routes (đăng ký trong `plugins/Routing.kt`)

| File | Endpoints |
|------|-----------|
| `routes/TransactionRoutes.kt` | `POST /tx/build`, `POST /tx/submit` |
| `routes/GovernanceRoutes.kt` | `GET /governance-actions`, `GET /governance-actions/{txHash}/{index}`, `GET /governance-actions/{txHash}/{index}/my-vote` |
| `routes/DRepRoutes.kt` | `GET /dreps`, `GET /dreps/{drepId}`, `GET /dreps/{drepId}/votes`, `GET /stake/{addr}/delegation` |
| `routes/CommunityRoutes.kt` | `GET/POST /communities/{drepId}`, `POST /communities/{drepId}/activate`, `GET/POST /communities/{drepId}/polls`, `GET/POST /communities/polls/{pollId}/comments` |
| `routes/MetadataRoutes.kt` | `POST /metadata/upload`, `POST /metadata/upload-image`, `DELETE /metadata/unpin/{hash}` |
| `routes/StubRoutes.kt` | `GET /health`, `GET /auth/challenge`, `POST /auth/verify`, `GET /stake/{addr}/polls` |

### Domain logic

| File | Mục đích |
|------|---------|
| `cardano/TxBuilder.kt` | Build unsigned TX CBOR (DREP_REGISTER, DREP_UPDATE, DREP_RETIRE, VOTE, DELEGATE, ACTIVATE_COMMUNITY) |
| `cardano/OgmiosStateQueries.kt` | Ogmios WebSocket queries: DRep list, governance proposals, delegation info |
| `cardano/VoteIndexer.kt` | Chain-sync indexer — đọc từng block qua Ogmios WS, index DRep votes vào DB |
| `cardano/GovernanceActionDto.kt` | Data classes + `mapOgmiosProposal()` để map raw Ogmios JSON sang typed DTO |
| `cardano/CardanoConfig.kt` | `getBackendService(network)` factory — tạo KupmiosBackendService |
| `cache/BackgroundPoller.kt` | Refresh CardanoCache mỗi 5 phút (drepList + govActions) |
| `cache/CardanoCache.kt` | In-memory Caffeine cache (TTL 10 min) |

### Database

| File | Mục đích |
|------|---------|
| `db/Tables.kt` | Exposed table definitions |
| `plugins/Database.kt` | Datasource setup + Flyway migrations |
| `src/main/resources/db/migration/V1__init.sql` | Initial schema |
| `src/main/resources/db/migration/V2__drep_vote_index.sql` | DRep vote indexer tables |

---

## Frontend — `apps/web/`

### Entry points
- `app/layout.tsx` — Root layout (Inter font, Navbar, Footer, `suppressHydrationWarning`)
- `app/page.tsx` — Homepage

### Pages

| Path | File |
|------|------|
| `/` | `app/page.tsx` |
| `/dreps` | `app/dreps/page.tsx` |
| `/dreps/[drepId]` | `app/dreps/[drepId]/page.tsx` |
| `/dreps/register` | `app/dreps/register/page.tsx` |
| `/governance-actions` | `app/governance-actions/page.tsx` |
| `/governance-actions/[txHash]/[index]` | `app/governance-actions/[txHash]/[index]/page.tsx` (hiện đang ở `[txHash]` folder) |
| `/dapp-ranking` | `app/dapp-ranking/page.tsx` |

### Hooks (data fetching)

| Hook | Dùng cho |
|------|---------|
| `hooks/useWallet.ts` | Wallet state, connect, disconnect, auto-reconnect |
| `hooks/useTx.ts` | Build → sign → submit TX flow |
| `hooks/useDRepProfile.ts` | DRep profile + CIP-119 metadata từ IPFS |
| `hooks/useDRepVotingHistory.ts` | Voting history của một DRep |
| `hooks/useGovernanceActions.ts` | Danh sách Governance Actions |
| `hooks/useMyVote.ts` | Vote của connected DRep trên một GA |
| `hooks/useCommunity.ts` | Community status + polls list |
| `hooks/useAnchorTitle.ts` | Fetch title từ IPFS anchor URL |

### Store
`store/wallet.ts` — Zustand store cho wallet state (api, networkId, changeAddress, drepKey, isDrepRegistered, ...)

### Shared utilities
`lib/governance.ts` — `resolveAnchorUrls()`, `resolveAnchorUrl()`, `lovelaceToAda()`, vote percent helpers
`lib/mock-data.ts` — Mock data (đang dần thay thế bằng real API)

### Shared packages
`packages/wallet-bridge/src/` — CIP-30/CIP-95 functions (connect, sign, queries)
`packages/types/src/` — Zod schemas + TS types chia sẻ FE/BE

---

## Thư mục cần bỏ qua

```
node_modules/          ← dependencies
.next/                 ← Next.js build output
apps/api/build/        ← Gradle build output
apps/api/.gradle/      ← Gradle cache
packages/*/dist/       ← TypeScript compiled output
```

---

## File nên đọc theo từng loại task

### Thêm / sửa API endpoint (Backend)
1. `apps/api/src/main/kotlin/routes/<Route>.kt` — file route cụ thể
2. `apps/api/src/main/kotlin/db/Tables.kt` — nếu liên quan DB
3. `apps/api/src/main/kotlin/cardano/OgmiosStateQueries.kt` — nếu cần on-chain data mới
4. `docs/API_CONTRACTS.md` — cập nhật sau khi thay đổi

### Sửa Frontend page / component
1. `apps/web/app/<path>/page.tsx` — page cụ thể
2. `apps/web/hooks/use<Name>.ts` — hook liên quan
3. `apps/web/store/wallet.ts` — nếu cần wallet state

### Thêm TX type mới
1. `apps/api/src/main/kotlin/cardano/TxBuilder.kt`
2. `apps/api/src/main/kotlin/routes/TransactionRoutes.kt`
3. `packages/types/src/api/tx.ts`
4. `apps/web/hooks/useTx.ts`

### Thêm DB migration
1. `apps/api/src/main/kotlin/db/Tables.kt` — thêm table definition
2. Tạo `apps/api/src/main/resources/db/migration/V{N}__description.sql`

### Debug Cardano data
1. `apps/api/src/main/kotlin/cardano/OgmiosStateQueries.kt`
2. `apps/api/src/main/kotlin/cardano/GovernanceActionDto.kt`
3. `apps/api/src/main/kotlin/cache/CardanoCache.kt`
