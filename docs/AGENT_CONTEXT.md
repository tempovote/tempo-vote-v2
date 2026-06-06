# Tempo Vote V2 — Agent Context

Cardano governance DApp cho DRep: đăng ký, vote Governance Actions, quản lý Community nội bộ.
Rebuild của [tempo.vote](https://tempo.vote). Stack: Next.js 15 + Kotlin/Ktor + Ogmios + PostgreSQL.

---

## Stack

| | |
|--|--|
| FE | Next.js 15, TypeScript strict, Tailwind v4, Zustand |
| BE | Kotlin/Ktor, Exposed ORM, Flyway, PostgreSQL 16 |
| Cardano | Ogmios WebSocket + Kupo REST (không dùng Blockfrost) |
| IPFS | Pinata |
| Monorepo | Turborepo (TS) + Gradle (Kotlin) — hai build system độc lập |

---

## Hard constraints — KHÔNG vi phạm

1. **Private key không rời ví** — FE nhận unsigned CBOR → `wallet.signTx()` → gửi witness set
2. **`suppressHydrationWarning`** trên `<html>` `<body>` — wallet extensions inject DOM attrs, đừng xóa
3. **`network` param bắt buộc** mọi API call — không hardcode; auto-detect từ `wallet.getNetworkId()` (0=preprod, 1=mainnet)
4. **Không commit vào `main`** — branch + PR, xem quy tắc đặt tên branch trong `CLAUDE.md`
5. **TypeScript strict, no `any`**, Zod tại mọi API boundary

---

## Architecture

FE thu thập wallet data (UTxOs, addresses, DRep key) → `POST /tx/build` → backend `QuickTxBuilder` tạo unsigned CBOR → `wallet.signTx()` → `POST /tx/submit` kèm witness set → backend ráp full TX → Ogmios submit → txHash.

On-chain data (DRep list, GAs, vote history) lấy từ Ogmios qua **BackgroundPoller** (cache 5 phút) và **VoteIndexer** (chain-sync WebSocket, ghi vào bảng `drep_votes`). Off-chain data (communities, polls, comments) lưu PostgreSQL.

---

## Routes & key files

| Route file | Endpoints |
|------------|-----------|
| `TransactionRoutes.kt` | `POST /tx/build`, `POST /tx/submit` |
| `GovernanceRoutes.kt` | `GET /governance-actions/*` |
| `DRepRoutes.kt` | `GET /dreps/*`, `GET /stake/*/delegation` |
| `CommunityRoutes.kt` | `GET/POST /communities/*` |
| `MetadataRoutes.kt` | `POST /metadata/upload*`, `DELETE /metadata/unpin/*` |
| `StubRoutes.kt` | `GET /health`, `/auth/*` ← auth chưa enforce trên bất kỳ endpoint nào |

Tất cả routes đăng ký trong `apps/api/src/main/kotlin/plugins/Routing.kt`.

---

## File → task

| Cần làm | Đọc trước |
|---------|-----------|
| Sửa / thêm API endpoint | `apps/api/.../routes/<X>Routes.kt` |
| Thêm TX type | `cardano/TxBuilder.kt` + `routes/TransactionRoutes.kt` + `packages/types/src/api/tx.ts` |
| Sửa FE page | `apps/web/app/<path>/page.tsx` + hook liên quan |
| Thêm DB table | `db/Tables.kt` + tạo `V{N}__description.sql` |
| Hiểu data flow | `docs/architecture.md` |
| Check API spec | `docs/API_CONTRACTS.md` |
| Check pending/debt | `docs/CURRENT_STATUS.md` |

---

## Current status (tóm tắt)

**Done:** wallet connect (CIP-30/95), DRep register wizard, DRep profile + voting history, governance actions list/detail/vote, DRep community + internal polls, VoteIndexer chain-sync.

**Pending (high):** Active Voting Power via Kupo UTxO query (`stakeKeyBalance` hiện null), auth enforcement trên community/poll endpoints, delegation TX UI, poll voting UI.

**Tech debt:** dead `queryStakeKeyBalance` fn trong `DRepRoutes.kt`; community activate không verify TX on-chain; `PollOptions` không được populate khi tạo poll.

---

## Dev commands

```bash
pnpm dev                          # FE :3000
./gradlew :apps:api:run           # API :8080 (từ root)
kill -9 $(lsof -ti:8080)         # Kill stuck API process
```

---

→ Task hiện tại: **`docs/CURRENT_TASK.md`**
→ Chi tiết pending/debt: **`docs/CURRENT_STATUS.md`**
→ Data flows: **`docs/architecture.md`**
→ API spec: **`docs/API_CONTRACTS.md`**
