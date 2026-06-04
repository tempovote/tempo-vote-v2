# tempo-vote-v2

Cardano governance DApp cho DRep (Delegated Representatives). Rebuild từ đầu trên monorepo.
Tham chiếu v1: https://tempo.vote

## Tổng quan kiến trúc

```
apps/web   — Next.js 15 (TypeScript)  — DApp frontend, wallet bridge
apps/api   — Kotlin / Ktor            — Transaction building, off-chain API
packages/wallet-bridge — TS           — Raw CIP-30/CIP-95 (không dùng MeshSDK)
packages/types         — TS/Zod       — API schemas shared FE/BE
packages/ui            — TS           — shadcn/ui components
packages/config        — TS           — ESLint, TypeScript, Tailwind configs
docs/                                 — Chi tiết kiến trúc và integration guides
```

## Monorepo build tools

- **TypeScript packages** (`apps/web`, `packages/*`): Turborepo + pnpm
- **Kotlin** (`apps/api`): Gradle (Kotlin DSL) — chạy song song, không trong Turborepo pipeline
- **Root**: `settings.gradle.kts` include `:apps:api`

## Lệnh thường dùng

```bash
# TypeScript
pnpm install                    # install all TS/JS deps
pnpm dev                        # chạy web dev (turbo dev)
pnpm build                      # build tất cả TS packages
pnpm typecheck                  # type check toàn bộ
pnpm lint                       # lint toàn bộ

# Kotlin API
cd apps/api
./gradlew run                   # chạy Ktor server
./gradlew build                 # build jar
./gradlew test                  # chạy tests
./gradlew flywayMigrate         # chạy DB migrations

# Development (cả hai cùng lúc)
pnpm dev &                      # Next.js trên :3000
cd apps/api && ./gradlew run    # Ktor trên :8080
```

## Cardano infrastructure (self-hosted)

Dự án dùng **cardano-node + ogmios + kupo** (đang vận hành trên cả preprod và mainnet).
Không dùng Blockfrost.

| Service | Preprod | Mainnet |
|---|---|---|
| Ogmios | `OGMIOS_PREPROD_URL` (ws://) | `OGMIOS_MAINNET_URL` (ws://) |
| Kupo | `KUPO_PREPROD_URL` (http://) | `KUPO_MAINNET_URL` (http://) |

Network detect tự động từ ví kết nối (`wallet.getNetworkId()`: 0=testnet, 1=mainnet).

## Wallet integration (CIP-30 + CIP-95)

`packages/wallet-bridge` — raw CIP-30/CIP-95, không dùng MeshSDK hay library nặng.

```typescript
import { connectWallet, getNetworkId, getDRepKey, signTx } from "@tempo/wallet-bridge"

const api = await connectWallet("eternl")          // enable CIP-95
const network = await getNetworkId(api)             // 0 | 1
const drepKey = await getDRepKey(api)               // { pubDRepKey, dRepIDCip105 }
const signed  = await signTx(api, unsignedCbor)
```

Ví hỗ trợ: **Eternl, Yoroi, Lace, Vespr** (và mọi ví có CIP-95).

## Transaction flow (Frontend → Backend → Wallet)

```
1. Frontend: wallet.getUtxos() + getChangeAddress() + getRewardAddresses() + getDRepKey()
2. Frontend: POST /api/tx/build  { txType, ...params, utxos, changeAddress }
3. Backend (Kotlin): QuickTxBuilder(KupmiosBackendService) → build unsigned CBOR
4. Backend: trả về { unsignedTxCbor: "..." }
5. Frontend: wallet.signTx(unsignedTxCbor)
6. Frontend: POST /api/tx/submit  { signedTx }  hoặc wallet.submitTx(signedTx)
7. trả về { txHash }
```

Private key **không bao giờ ra khỏi ví**.

## Kotlin backend (apps/api)

**BackendService**: `KupmiosBackendService(ogmiosUrl, kupoUrl)` — đủ cho mọi tx building.

```kotlin
val backendService = KupmiosBackendService(
    ogmiosUrl = env("OGMIOS_PREPROD_URL"),
    kupoUrl   = env("KUPO_PREPROD_URL")
)
val quickTxBuilder = QuickTxBuilder(backendService)
```

**Governance transactions** dùng `QuickTx` API:
- `Tx().registerDRep(account, anchor)` — đăng ký DRep
- `Tx().createVote(voter, govActionId, Vote.YES)` — vote on GA
- `Tx().delegateVotingPowerTo(account, drep)` — delegate
- `Tx().createProposal(govAction, stakeAddr, anchor)` — tạo GA proposal

**State queries** (governance actions list, DRep list, treasury) qua Ogmios WebSocket trực tiếp:
xem `apps/api/src/main/kotlin/cardano/OgmiosStateQueries.kt`

## Database (PostgreSQL + Kotlin Exposed)

Chỉ lưu **off-chain data**: internal polls, communities, comments, auth sessions.
On-chain data (governance actions, DRep info, votes) luôn lấy từ Ogmios/Kupo.

Migrations: Flyway (`apps/api/src/main/resources/db/migration/V*.sql`)

## Key files

| File | Mục đích |
|---|---|
| `packages/wallet-bridge/src/index.ts` | Entry point — export tất cả wallet functions |
| `packages/types/src/index.ts` | Entry point — export tất cả Zod schemas |
| `apps/api/src/main/kotlin/cardano/CardanoConfig.kt` | KupmiosBackendService factory |
| `apps/api/src/main/kotlin/cardano/TxBuilder.kt` | Governance tx builders |
| `apps/api/src/main/kotlin/cardano/OgmiosStateQueries.kt` | On-chain data queries |
| `apps/api/src/main/kotlin/routes/TransactionRoutes.kt` | POST /tx/build, /tx/submit |
| `apps/api/src/main/kotlin/db/Tables.kt` | Exposed table definitions |
| `apps/web/hooks/useTx.ts` | FE hook: build → sign → submit |
| `apps/web/hooks/useWallet.ts` | Wallet state management |

## Docs

- `docs/architecture.md` — Kiến trúc chi tiết, diagram, quyết định
- `docs/cardano-integration.md` — Cardano SDK, governance tx, KupmiosBackendService
- `docs/wallet-bridge.md` — CIP-30/CIP-95 API reference, supported wallets
- `docs/api-contracts.md` — REST API endpoints, request/response schemas
- `docs/development-guide.md` — Setup local dev, env vars, testing

## Conventions

- **TypeScript**: strict mode, không dùng `any`, Zod cho tất cả API boundaries
- **Kotlin**: Coroutines cho async, sealed classes cho kết quả (Result<T, Error>)
- **Naming**: camelCase TS, PascalCase Kotlin classes, snake_case DB columns
- **Network**: luôn pass `network` parameter xuống function, không hardcode
- **Error handling**: mọi tx operation phải handle `TxSubmitError` và network timeout
