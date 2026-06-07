# tempo-vote-v2

Cardano governance DApp cho DRep. Rebuild từ đầu trên monorepo. Tham chiếu v1: https://tempo.vote

## Kiến trúc

```
apps/web          — Next.js 15 (TypeScript)  — DApp frontend
apps/api          — Kotlin / Ktor            — TX building, off-chain API
packages/wallet-bridge — TS/CIP-30/CIP-95   — Raw wallet bridge (không dùng MeshSDK)
packages/types         — TS/Zod             — API schemas shared FE/BE
packages/config        — TS                 — ESLint, TypeScript, Tailwind configs
```

- Build TS: **Turborepo + pnpm** | Build Kotlin: **Gradle (Kotlin DSL)** — chạy độc lập
- Cardano infra: **cardano-node + ogmios + kupo** (preprod + mainnet), không dùng Blockfrost
- Network auto-detect từ `wallet.getNetworkId()` (0=testnet, 1=mainnet)

## Lệnh thường dùng

```bash
pnpm install && pnpm dev          # TS: cài deps + chạy web :3000
./gradlew :apps:api:run           # Kotlin: chạy Ktor :8080 (từ root monorepo)
./gradlew build / test / flywayMigrate
```

## Khởi động server (thứ tự bắt buộc)

```bash
colima start                      # 1. Docker runtime (Colima)
docker start tempo-pg             # 2. PostgreSQL container
./gradlew :apps:api:run           # 3. API :8080 (Flyway tự migrate)
pnpm dev                          # 4. Web :3000 (tab khác)
```

> API phải được khởi động **sau** khi PostgreSQL đã sẵn sàng.  
> Nếu API start trước DB → auth/challenge trả 500 → vote rationale thất bại.

## Transaction flow

```
FE: getUtxos + getChangeAddress + getDRepKey
→ POST /api/tx/build { txType, utxos, changeAddress, ... }
→ BE: QuickTxBuilder → unsigned CBOR
→ FE: wallet.signTx → POST /api/tx/submit → { txHash }
```
Private key **không bao giờ ra khỏi ví**.

## Kotlin backend

`KupmiosBackendService(ogmiosUrl, kupoUrl)` + `QuickTxBuilder`. Governance TX:
`registerDRep` · `createVote` · `delegateVotingPowerTo` · `createProposal`
State queries (GA list, DRep list) qua Ogmios WS — xem `OgmiosStateQueries.kt`.

## Database

PostgreSQL + Kotlin Exposed. Chỉ lưu off-chain: polls, communities, comments, sessions.
On-chain data luôn lấy từ Ogmios/Kupo. Migrations: Flyway `db/migration/V*.sql`.

## UI (apps/web) — Giữ nguyên cấu trúc

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
lib/mock-data.ts                      # Mock data (thay bằng real API sau)
public/logo.webp
```

> `suppressHydrationWarning` trên `<html>` và `<body>` là bắt buộc — wallet extensions inject attributes. **Không xóa.**

Design tokens chính: `bg-bg-primary` · `bg-bg-card` · `card-static` · `card-accent` · `btn-primary` · `notice-success/warning` · `vote-bar-yes/no` · `page-container`

## Key files

| File | Mục đích |
|------|----------|
| `packages/wallet-bridge/src/index.ts` | CIP-30/95 functions |
| `packages/types/src/index.ts` | Zod schemas |
| `apps/api/.../CardanoConfig.kt` | KupmiosBackendService factory |
| `apps/api/.../TxBuilder.kt` | Governance TX builders |
| `apps/api/.../OgmiosStateQueries.kt` | On-chain queries |
| `apps/api/.../TransactionRoutes.kt` | POST /tx/build, /tx/submit |
| `apps/web/hooks/useTx.ts` | FE: build → sign → submit |
| `apps/web/hooks/useWallet.ts` | Wallet state |

Docs chi tiết: `docs/architecture.md` · `docs/cardano-integration.md` · `docs/wallet-bridge.md` · `docs/api-contracts.md` · `docs/development-guide.md`

## Conventions

- **TS**: strict mode, no `any`, Zod cho mọi API boundary
- **Kotlin**: Coroutines async, sealed classes cho Result<T, Error>
- **Naming**: camelCase TS · PascalCase Kotlin · snake_case DB
- **Network**: luôn truyền `network` param, không hardcode
- **Error**: mọi TX op phải handle `TxSubmitError` + network timeout

## Git Workflow ⚠️

**KHÔNG commit trực tiếp vào `main`.** Mọi thay đổi đều phải trên branch riêng.

| Loại | Branch | Commit prefix |
|------|--------|---------------|
| Tính năng | `feature/[desc]` | `feat:` |
| Sửa lỗi | `bug/[desc]` | `fix:` |
| Refactor | `refactor/[desc]` | `refactor:` |
| UI/UX | `feature/ui-[desc]` | `style:` |
| Hotfix | `hotfix/[desc]` | `fix:` |

```bash
git checkout main && git pull origin main
git checkout -b feature/[desc]   # hoặc bug/[desc]
# ... làm việc ...
git commit -m "feat: mô tả ngắn"
git push origin feature/[desc]   # sau đó tạo PR
```

Conventional Commits: `feat` · `fix` · `refactor` · `style` · `chore` · `docs`
