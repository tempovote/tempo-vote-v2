# tempo-vote-v2

Cardano governance DApp cho DRep. Rebuild từ đầu trên monorepo. Tham chiếu v1: https://tempo.vote

## Nguyên tắc làm việc

Ưu tiên cẩn trọng hơn tốc độ. Với task đơn giản/rõ ràng, dùng judgement — không cần áp dụng cứng nhắc.

### 1. Suy nghĩ trước khi code
Không đoán, không giấu chỗ chưa rõ. Nêu giả định rõ ràng; nếu có nhiều cách hiểu, trình bày cả hai — không tự chọn ngầm. Nếu thấy cách đơn giản hơn, nói ra, có thể phản biện yêu cầu ban đầu.

### 2. Đơn giản là trên hết
Viết đúng lượng code cần để giải quyết yêu cầu — không thêm feature/abstraction/error-handling cho tình huống chưa xảy ra.

### 3. Sửa đúng phạm vi
Chỉ động vào phần liên quan đến yêu cầu. Không "tiện tay" refactor, đổi format, hay xoá dead code không liên quan — nêu ra nếu thấy, để user quyết định. Giữ style hiện có của file dù có cách khác thích hơn.

### 4. Thực thi theo mục tiêu kiểm chứng được
Biến yêu cầu mơ hồ thành goal kiểm chứng được: "fix bug" → viết test reproduce lỗi trước, rồi sửa cho pass. Task nhiều bước → nêu plan ngắn kèm cách verify từng bước trước khi làm.

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

> Chi tiết riêng từng stack: [`apps/web/CLAUDE.md`](apps/web/CLAUDE.md) (Next.js/TS) · [`apps/api/CLAUDE.md`](apps/api/CLAUDE.md) (Kotlin/Ktor)

## Lệnh thường dùng

```bash
pnpm install && pnpm dev          # TS: cài deps + chạy web :3000
./gradlew :apps:api:run           # Kotlin: chạy Ktor :8080 (từ root monorepo)
./gradlew build / test / flywayMigrate
```

## Khởi động server (thứ tự bắt buộc)

```bash
docker start tempo-pg             # 1. PostgreSQL container
./gradlew :apps:api:run           # 2. API :8080 (Flyway tự migrate)
pnpm dev                          # 3. Web :3000 (tab khác)
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

## Quy ước xuyên stack

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

## Supergraph Workflow (monorepo-aware)

Plugin detect cả 2 stacks qua `bin/detect-project.sh`. `.supergraph-env` có 2 bộ command:

| Var | Command | Khi dùng |
|-----|---------|----------|
| `TEST_CMD` | `pnpm test` | Thay đổi TS/TSX (apps/web, packages/*) |
| `TEST_CMD_KOTLIN` | `./gradlew :apps:api:test` | Thay đổi .kt (apps/api) |
| `TEST_CMD_ALL` | `bin/test-all.sh` | Trước merge — chạy cả 2 suite |
| `LINT_CMD` | `pnpm lint && pnpm typecheck` | TS files |
| `LINT_CMD_KOTLIN` | `./gradlew :apps:api:build` | .kt files (build = compilation check) |

**Quy tắc chọn command** — đọc `git diff --name-only` trước:
- Toàn bộ file thay đổi là `.kt` → dùng `TEST_CMD_KOTLIN` / `LINT_CMD_KOTLIN`
- Toàn bộ file thay đổi là `.ts/.tsx` → dùng `TEST_CMD` / `LINT_CMD`
- Mix cả 2 → dùng `TEST_CMD_ALL` (chạy cả hai)

**⚠️ Tránh false positive do stale build cache:** `packages/types`, `packages/wallet-bridge`, `packages/ui` build ra `dist/` qua tsup — **gitignored**, không commit. `typecheck`/`build` trong `turbo.json` có `dependsOn: ["^build"]` (tự rebuild package phụ thuộc trước). Nếu chạy trực tiếp `pnpm --filter <pkg> typecheck` (bỏ qua Turborepo) mà không rebuild package phụ thuộc trước, `dist/` cũ có thể thiếu type mới nhất → báo lỗi type "giả". Luôn dùng `pnpm typecheck` ở root, hoặc rebuild trước bằng `pnpm --filter @tempo/types build` khi gặp lỗi type khó hiểu ở package tiêu thụ.

**TDD focused command cho Kotlin:**
```bash
# RED/GREEN — focused test một class
./gradlew :apps:api:test --tests "vote.tempo.<package>.<ClassName>*"

# Ví dụ:
./gradlew :apps:api:test --tests "vote.tempo.cardano.TxBuilderTest*"
./gradlew :apps:api:test --tests "vote.tempo.routes.AllianceProposalRoutesTest*"
```

**Chú ý:** Kotlin tests dùng Testcontainers (PostgreSQL) — cần Docker daemon đang chạy.

## ⚠️ Quy tắc bắt buộc — Restart API server

**KHÔNG BAO GIỜ** tự ý restart API server (`./gradlew :apps:api:run`, `kill`, `pkill`, `lsof -ti:8080 | xargs kill`) mà không có xác nhận rõ ràng từ người dùng.

API đang chạy VoteIndexer stream toàn bộ blockchain — restart mất toàn bộ tiến độ sync nếu chưa có checkpoint tại điểm hiện tại.

**Trước khi restart phải dùng `AskUserQuestion` để:**
1. Thông báo lý do cần restart
2. Nêu rõ hệ quả (mất sync progress, downtime, v.v.)
3. Hỏi xác nhận có muốn restart không

Quy tắc này áp dụng cho mọi hành động dừng/restart process API, kể cả gián tiếp (thay đổi port, kill process chiếm port 8080).

## Docs

Docs chi tiết: `docs/architecture.md` · `docs/cardano-integration.md` · `docs/wallet-bridge.md` · `docs/api-contracts.md` · `docs/development-guide.md`
