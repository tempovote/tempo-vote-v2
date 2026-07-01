# apps/api — Kotlin/Ktor backend

Thuộc monorepo tempo-vote-v2 — xem `CLAUDE.md` ở root cho nguyên tắc làm việc chung, kiến trúc tổng, thứ tự khởi động server, TX flow, git/supergraph workflow.

## ⚠️ Trước khi restart/kill process ở đây

Xem quy tắc bắt buộc ở root `CLAUDE.md` (mục "Quy tắc bắt buộc — Restart API server") — **luôn hỏi xác nhận qua `AskUserQuestion` trước**, VoteIndexer mất sync progress nếu restart không đúng lúc.

## Kotlin backend

`KupmiosBackendService(ogmiosUrl, kupoUrl)` + `QuickTxBuilder`. Governance TX:
`registerDRep` · `createVote` · `delegateVotingPowerTo` · `createProposal`
State queries (GA list, DRep list) qua Ogmios WS — xem `OgmiosStateQueries.kt`.

## Database

PostgreSQL + Kotlin Exposed. Chỉ lưu off-chain: polls, communities, comments, sessions.
On-chain data luôn lấy từ Ogmios/Kupo. Migrations: Flyway `db/migration/V*.sql`.

## Key files

| File | Mục đích |
|------|----------|
| `apps/api/.../CardanoConfig.kt` | KupmiosBackendService factory |
| `apps/api/.../TxBuilder.kt` | Governance TX builders |
| `apps/api/.../OgmiosStateQueries.kt` | On-chain queries |
| `apps/api/.../TransactionRoutes.kt` | POST /tx/build, /tx/submit |

## Conventions

- **Kotlin**: Coroutines async, sealed classes cho Result<T, Error>
- **Network**: mọi query/TX builder phải nhận `network` param — không hardcode
- **Error**: mọi TX op phải handle `TxSubmitError` + network timeout
