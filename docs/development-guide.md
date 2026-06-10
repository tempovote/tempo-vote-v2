# Development Guide

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (`npm i -g pnpm`)
- JDK >= 17 (`sdk install java 21.0.2-tem` hoặc Homebrew)
- Gradle (bundled via wrapper `./gradlew`)
- cardano-node + ogmios + kupo đang chạy (preprod là đủ để dev)

## Setup (lần đầu)

```bash
# 1. Clone và cài dependencies
git clone <repo>
cd tempo-vote-v2

# 2. Cài TypeScript packages
pnpm install

# 3. Copy env
cp .env.example .env
# Điền OGMIOS_PREPROD_URL, KUPO_PREPROD_URL, DATABASE_URL

# 4. Khởi động Docker runtime (Colima) + tạo PostgreSQL container
colima start
docker run -d \
  --name tempo-pg \
  -e POSTGRES_DB=tempo_vote \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:16

# 5. Chạy API (Flyway migrations chạy tự động khi start)
./gradlew :apps:api:run

# 6. Chạy web (tab khác)
pnpm dev
```

Web: http://localhost:3000  
API: http://localhost:8080

## Khởi động server sạch (mỗi lần mở máy)

**Thứ tự bắt buộc** — thiếu bước nào cũng sẽ lỗi DB:

```bash
# Bước 1: Khởi động Docker runtime
colima start

# Bước 2: Khởi động PostgreSQL container
docker start tempo-pg

# Bước 3: Chờ PostgreSQL sẵn sàng (tùy chọn, thường xong ngay)
docker exec tempo-pg pg_isready -U postgres

# Bước 4: Chạy API (từ root monorepo)
./gradlew :apps:api:run

# Bước 5: Chạy web (tab khác)
pnpm dev
```

> **Lưu ý**: Luôn chạy `./gradlew :apps:api:run` từ **root monorepo**, không phải từ `apps/api/`.  
> API tự chạy Flyway migrations khi start — không cần chạy migration thủ công.

## Cấu trúc môi trường preprod

Dùng preprod cho tất cả development và testing:
- Wallet: dùng Eternl hoặc Lace, switch sang **preprod testnet**
- Faucet ADA: https://docs.cardano.org/cardano-testnet/tools/faucet
- Explorer: https://preprod.cardanoscan.io

## Git Workflow ⚠️

**KHÔNG commit trực tiếp vào `main`.** Mọi thay đổi đều phải thực hiện trên branch riêng và merge qua Pull Request.

```bash
git checkout main && git pull origin main
git checkout -b feature/[desc]   # hoặc bug/[desc], hotfix/[desc]
# ... làm việc ...
git commit -m "feat: mô tả ngắn"
git push origin feature/[desc]   # sau đó tạo PR trên GitHub
```

| Loại thay đổi | Branch | Commit prefix |
|---------------|--------|---------------|
| Tính năng mới | `feature/[desc]` | `feat:` |
| Sửa lỗi | `bug/[desc]` | `fix:` |
| Refactor | `refactor/[desc]` | `refactor:` |
| UI/UX | `feature/ui-[desc]` | `style:` |
| Hotfix khẩn | `hotfix/[desc]` | `fix:` |
| Tài liệu | `docs/[desc]` | `docs:` |

> Commit trực tiếp vào `main` sẽ bị từ chối. Luôn tạo PR dù thay đổi nhỏ.

## Thêm tính năng mới

### Thêm transaction type mới

1. Thêm `txType` vào `TxTypeSchema` trong `packages/types/src/api/tx.ts`
2. Implement `buildXxx()` trong `apps/api/src/main/kotlin/cardano/TxBuilder.kt`
3. Thêm case trong `TransactionRoutes.kt`
4. Dùng từ FE: `useTx().submitTx("NEW_TYPE", { ...params })`

### Thêm API endpoint mới

1. Tạo route function trong `apps/api/src/main/kotlin/routes/`
2. Register trong `Routing.kt`
3. Thêm Zod schema nếu cần vào `packages/types`

### Thêm DB migration

Tạo file `apps/api/src/main/resources/db/migration/V{N}__description.sql`
Flyway tự chạy khi server start.

## Kiểm tra on-chain (preprod)

Sau khi tx confirmed, kiểm tra trên Cardano Scan:
```
https://preprod.cardanoscan.io/transaction/<txHash>
```

Kiểm tra DRep registration:
```
https://preprod.cardanoscan.io/drep/<drepId>
```

## Debug Ogmios

Test query trực tiếp qua wscat:
```bash
npm i -g wscat
wscat -c ws://localhost:1337
# Paste JSON query:
{"jsonrpc":"2.0","method":"queryLedgerState/governanceActions","params":{},"id":"test"}
```

## Lỗi thường gặp

### "Challenge thất bại (HTTP 500)" khi bỏ phiếu / "Please call Database.connect()"
API start được nhưng không kết nối được PostgreSQL. Kiểm tra theo thứ tự:
```bash
colima status          # phải "running"
docker ps | grep tempo-pg  # phải "Up"
curl http://localhost:8080/auth/challenge?stakeAddress=test&network=preprod
# Nếu vẫn 500: kill port 8080 rồi ./gradlew :apps:api:run lại sau khi DB đã chạy
```

### "KupmiosBackendService not found"
Kiểm tra artifact `cardano-client-backend-ogmios` đã có trong Gradle deps. Tên class chính xác có thể khác nhau theo version — xem Javadoc của thư viện.

### "wallet.cip95 is undefined"
Wallet không support CIP-95, hoặc chưa enable extension `{ cip: 95 }` khi connect. Kiểm tra hàm `connectWallet()` trong `packages/wallet-bridge/src/connect.ts`.

### Transaction build fail với "insufficient funds"
UTxOs từ `wallet.getUtxos()` đã cũ (wallet chưa sync). Refresh trang và thử lại.

### Ogmios WebSocket timeout
Kiểm tra `cardano-node` đã sync. Ogmios cần node hoàn toàn sync trước khi query được.
```bash
curl http://localhost:1337/health
```
