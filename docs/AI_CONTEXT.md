# AI_CONTEXT — tempo-vote-v2

> Đọc file này đầu tiên trong mỗi session mới.

## Dự án là gì?

**tempo-vote-v2** là Cardano governance DApp cho DRep (Delegated Representative), rebuild từ đầu của [tempo.vote](https://tempo.vote). Cho phép DRep đăng ký, quản lý hồ sơ, vote trên Governance Actions, và tạo Community nội bộ với các Internal Poll cho delegator.

## Người dùng chính

| Nhóm | Mô tả |
|------|-------|
| **DRep** | Đã đăng ký on-chain — vote GA, quản lý hồ sơ, kích hoạt Community |
| **Delegator** | Delegate voting power cho DRep, tham gia Internal Poll |
| **Voter thông thường** | Xem danh sách DRep, Governance Actions, không cần kết nối ví |

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 15, TypeScript strict, Tailwind v4, Zustand, pnpm + Turborepo |
| Backend | Kotlin/Ktor, Exposed ORM (Kotlin), Flyway |
| Database | PostgreSQL 16 (chỉ off-chain data) |
| Cardano | Ogmios WebSocket + Kupo (không dùng Blockfrost) |
| IPFS | Pinata (DRep metadata CIP-119) |
| Monorepo | Turborepo (TS) + Gradle (Kotlin) — hai hệ thống build độc lập |

## Kiến trúc tổng quan

```
Browser (Next.js)
  ├── packages/wallet-bridge  → CIP-30/CIP-95 raw wallet API
  ├── hooks/useWallet         → Zustand wallet store
  ├── hooks/useTx             → build → sign → submit flow
  └── hooks/use*              → data fetching từ API

Kotlin/Ktor API (:8080)
  ├── BackgroundPoller        → refresh Ogmios cache mỗi 5 phút
  ├── VoteIndexer             → chain-sync Ogmios WebSocket, index DRep votes vào DB
  ├── /tx/build + /tx/submit  → transaction building (QuickTxBuilder) + Ogmios submit
  ├── /governance-actions     → từ CardanoCache (Ogmios)
  ├── /dreps                  → từ CardanoCache + DB votes
  └── /communities + /polls   → off-chain data (PostgreSQL)

Cardano Infra
  ├── Ogmios (WebSocket)      → ledger state queries + chain-sync + tx submit
  └── Kupo (REST)             → UTxO queries (partial integration)
```

## Modules chính

| Module | Vị trí | Trạng thái |
|--------|--------|-----------|
| Wallet Connect (CIP-30/95) | `packages/wallet-bridge/` | ✅ Done |
| DRep Registration wizard | `apps/web/app/dreps/register/` | ✅ Done |
| DRep Profile page | `apps/web/app/dreps/[drepId]/` | ✅ Done |
| Governance Actions list + detail + vote | `apps/web/app/governance-actions/` | ✅ Done |
| DRep Community + Internal Polls | `hooks/useCommunity.ts`, `routes/CommunityRoutes.kt` | ✅ Done |
| VoteIndexer (chain-sync) | `apps/api/.../cardano/VoteIndexer.kt` | ✅ Done |
| Auth (challenge/verify JWT) | `routes/StubRoutes.kt` (stub) | ⚠️ Stub |
| Active Voting Power (Kupo) | Backend `DRepRoutes.kt` | ❌ Chưa hoàn chỉnh |
| DApp Ranking page | `apps/web/app/dapp-ranking/` | ⚠️ Mock data |

## Ràng buộc kỹ thuật quan trọng

1. **Private key không bao giờ rời ví** — FE chỉ lấy unsigned TX CBOR từ backend, ký bằng `wallet.signTx()`, rồi submit witness set
2. **Hai mạng tách biệt** — `network` param bắt buộc trong mọi API call; auto-detect từ `wallet.getNetworkId()` (0=preprod, 1=mainnet)
3. **`suppressHydrationWarning`** trên `<html>` và `<body>` — wallet extensions inject DOM attributes, không được xóa
4. **Không dùng Blockfrost** — toàn bộ on-chain data qua Ogmios/Kupo
5. **Không commit vào `main`** — mọi thay đổi qua branch + PR

## Hướng dẫn cho AI

Khi bắt đầu session mới:
1. Đọc `docs/CURRENT_TASK.md` để biết task hiện tại
2. Đọc `docs/CURRENT_STATUS.md` để biết trạng thái tổng thể
3. Đọc `docs/REPOSITORY_MAP.md` để định hướng file cần đọc
4. **Chỉ đọc file thực sự cần thiết** cho task — đừng scan toàn bộ codebase
