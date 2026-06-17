# tempo-vote-v2

[![CI](https://github.com/tempovote/tempo-vote-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/tempovote/tempo-vote-v2/actions/workflows/ci.yml)

Cardano governance DApp cho DRep — rebuild trên monorepo. Tham chiếu v1: https://tempo.vote

## Kiến trúc

```
apps/web                 — Next.js 15 (TypeScript)  — DApp frontend
apps/api                 — Kotlin / Ktor            — TX building, off-chain API
packages/wallet-bridge   — TS / CIP-30 / CIP-95     — Raw wallet bridge
packages/types           — TS / Zod                 — API schemas shared FE/BE
packages/config          — TS                       — ESLint / TS / Tailwind configs
```

- TS build: **Turborepo + pnpm** · Kotlin build: **Gradle (Kotlin DSL)**
- Cardano infra: **cardano-node + ogmios + kupo** (preprod + mainnet), không dùng Blockfrost

## Chạy local

```bash
docker start tempo-pg         # 1. PostgreSQL
./gradlew :apps:api:run       # 2. API :8080 (Flyway tự migrate)
pnpm install && pnpm dev      # 3. Web :3000
```

> API phải khởi động **sau** khi PostgreSQL sẵn sàng.

## Tests

CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)) chạy tự động mọi push lên `main` và mọi pull request.

```bash
pnpm --filter @tempo/web test   # Frontend — Vitest
./gradlew :apps:api:test        # Backend — JUnit5 + Testcontainers (cần Docker cho integration)
```

Chi tiết kiến trúc: xem [`CLAUDE.md`](CLAUDE.md) và `docs/`.
