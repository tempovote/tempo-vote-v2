# External API Calls

> Liệt kê **mọi external call thực sự** (runtime HTTP/WS) của tempo-vote-v2, tách riêng với link điều hướng.
> Cập nhật lần cuối: 2026-06-16. Khi thêm/bỏ một outbound call, hãy cập nhật file này.

Quy ước: "external" = call ra ngoài process. Ogmios/Kupo là **infra self-hosted** của team (không phải SaaS) nhưng vẫn liệt kê vì là network dependency.

---

## Backend (`apps/api`) — outbound

### Cardano infra (self-hosted, qua env URL)

| Service | Giao thức | Env | Dùng cho | File |
|---|---|---|---|---|
| **Ogmios** | WebSocket + HTTP | `OGMIOS_PREPROD_URL`, `OGMIOS_MAINNET_URL` | state queries, tx submit, chain-sync | `cardano/OgmiosStateQueries.kt`, `cardano/VoteIndexer.kt`, `cache/BackgroundPoller.kt`, `cardano/CardanoConfig.kt` (KupmiosBackendService) |
| **Kupo** | HTTP | `KUPO_PREPROD_URL`, `KUPO_MAINNET_URL` | UTxO / address queries | `cardano/CardanoConfig.kt`, `routes/WalletRoutes.kt` |

### Third-party SaaS

| Service | Host | Endpoints | File |
|---|---|---|---|
| **Blockfrost** | `cardano-mainnet.blockfrost.io/api/v0`, `cardano-preprod.blockfrost.io/api/v0` | `GET /pools/{id}` · `GET /pools/{id}/metadata` · `GET /governance/dreps/{id}` · `GET /governance/dreps/{id}/delegators` · `GET /governance/proposals?count&page&order` · `GET /governance/proposals/{tx}/{certIdx}` | `cardano/BlockfrostClient.kt` |
| **Pinata** | `api.pinata.cloud` | `POST /pinning/pinFileToIPFS` · `POST /pinning/pinJSONToIPFS` · `DELETE /pinning/unpin/{hash}` | `routes/MetadataRoutes.kt` |
| **IPFS gateways** | `PINATA_GATEWAY` (env) · `ipfs.io/ipfs/` · `dweb.link/ipfs/` | fetch CIP-100/119 metadata JSON (anchor-content proxy + DRep meta) | `routes/MetadataRoutes.kt`, `routes/DRepRoutes.kt` |
| **Anchor URL on-chain (tùy ý)** | bất kỳ `ipfs://` (→gateway) hoặc `https://` (vd `raw.githubusercontent.com`) | fetch metadata DRep / vote rationale / GA | `routes/MetadataRoutes.kt`, `routes/DRepRoutes.kt` |

**Auth:** Blockfrost dùng `project_id` (env `BLOCKFROST_*`); Pinata dùng JWT/API key (env).

> **Koios: đã loại bỏ hoàn toàn.** `cardano/KoiosClient.kt` rỗng — thay bằng indexer DB local + Ogmios/Blockfrost.

---

## Frontend (`apps/web`) — outbound (browser)

Phần lớn data đi qua **internal API** (`NEXT_PUBLIC_API_URL` → :8080), không tính external. Các call ra ngoài:

| Service | Host | Endpoints | File |
|---|---|---|---|
| **DefiLlama** | `api.llama.fi` | `/v2/historicalChainTvl/Cardano` · `/overview/dexs?chain=Cardano` · `/overview/fees?chain=Cardano` · `/protocols` | `app/dapp-ranking/page.tsx` |
| **DefiLlama prices** | `coins.llama.fi` | `/prices/current/coingecko:cardano` (giá ADA) | `app/dapp-ranking/page.tsx` |
| **IPFS gateways** (fallback khi BE proxy lỗi) | `gateway.pinata.cloud` · `ipfs.io` · `dweb.link` · `w3s.link` · `nftstorage.link` | anchor title/metadata/rationale, avatar | `hooks/useAnchorTitle.ts`, `hooks/useAnchorMetadata.ts`, `hooks/useRationale.ts`, `components/drep/DRepAvatar.tsx`, `lib/governance.ts` (`resolveAnchorUrls`) |
| Wallet favicon `<img>` (không phải API call) | eternl.io · lace.io · vespr.xyz · yoroi-wallet.com · nu.fi · flint-wallet.com | icon ví | `components/wallet/WalletModal.tsx` |

---

## Chỉ là link điều hướng (KHÔNG phải call)

`cardanoscan.io` · `defillama.com` · `gov.tools` · `constitution.gov.tools` · `forum.cardano.org` · GitHub CIPs · `ogmios.dev` · twitter/t.me — đều là `href` user bấm.

---

## Blockfrost — tần suất & rate limit

3 hàm đang dùng (1 hàm dead đã xoá), chạy cho cả mainnet + preprod nếu có `project_id`:

| Hàm | Trigger | Lịch | Call/lần |
|---|---|---|---|
| `fetchPoolInfoBlockfrost` | BackgroundPoller — pool stake indexer | **mỗi 8h** (3×/ngày), startup +10ph | 2 call/pool (`/pools/{id}` + `/metadata`), tuần tự, chỉ pool đã vote |
| `fetchDRepDelegatorsBlockfrost` | BackgroundPoller — whale indexer | **mỗi 2h** (12×/ngày), startup +5ph | ≤40 DReps (union top-20 theo count + top-20 theo VP), phân trang 100/trang → `ceil(delegators/100)` call/DRep |
| `fetchEnactedProposalKeys` | `POST /admin/backfill-enacted` | **thủ công, 1 lần** | paginate `/governance/proposals` + 1 detail/proposal (8 song song, nghỉ ~1s/chunk) |

**Volume ước lượng (steady-state):** preprod ~120 call/ngày; mainnet vài trăm–~1.000/ngày → **rất thấp so với free tier 50.000/ngày**. Vòng lặp tuần tự nên không chạm 10 req/s. Burst duy nhất là backfill (admin one-time).

**Rate-limit posture (sau fix 2026-06-16):**
- `blockfrostHttp` cài `HttpRequestRetry` (maxRetries=3): retry trên **429 + 5xx**, `exponentialDelay` tôn trọng header `Retry-After`.
- Backfill giảm còn **8 song song + nghỉ 1s/chunk** để giữ dưới 10 req/s.
- Đã xoá dead code `fetchDRepVotingPowerBlockfrost` (VP DRep lấy từ Ogmios).

## Tóm tắt

- **BE external SaaS:** Blockfrost · Pinata · IPFS gateways (+ Ogmios/Kupo là infra team).
- **FE external:** DefiLlama (`api.llama.fi` + `coins.llama.fi`) · IPFS gateways.
- **Đã bỏ:** Koios.
