# Architecture

## Tổng quan hệ thống

```
┌──────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  Next.js 15 (apps/web)                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ wallet-bridge│  │  Zustand     │  │  React pages/hooks   │   │
│  │ CIP-30/CIP-95│  │  wallet store│  │  useWallet, useTx    │   │
│  └──────┬───────┘  └──────────────┘  └──────────┬───────────┘   │
│         │ window.cardano                          │ fetch         │
└─────────┼──────────────────────────────────────-─┼───────────────┘
          │                                         │
    Cardano Wallet                          ┌───────▼─────────┐
    Extension                               │  Kotlin/Ktor    │
    (Eternl, Lace...)                       │  apps/api :8080 │
                                            └───────┬─────────┘
                                                    │
                                     ┌──────────────┼──────────────┐
                                     │              │              │
                               ┌─────▼──────┐ ┌────▼───┐ ┌───────▼──────┐
                               │  Ogmios    │ │  Kupo  │ │ PostgreSQL   │
                               │  WebSocket │ │  REST  │ │  (off-chain) │
                               └─────┬──────┘ └────────┘ └──────────────┘
                                     │
                               ┌─────▼──────┐
                               │ cardano-node│
                               └────────────┘
```

---

## Frontend Architecture

### Next.js App Router structure
```
app/layout.tsx              ← Root: font, Navbar, Footer
app/page.tsx                ← Homepage
app/dreps/
  page.tsx                  ← DRep list
  [drepId]/page.tsx         ← DRep profile (CIP-119, voting history, community)
  register/page.tsx         ← DRep registration wizard (4 bước)
app/governance-actions/
  page.tsx                  ← GA list + filter + search
  [txHash]/[index]/page.tsx ← GA detail + vote UI
app/dapp-ranking/page.tsx   ← DApp ranking (mock data)
```

### State management
- **Zustand** (`store/wallet.ts`): wallet connection state (api, addresses, drepKey, isDrepRegistered, delegatedDrep)
- **Local `useState`**: page-level UI state (loading, errors, modals)
- **No global data caching**: simple `useEffect` + `useState` pattern (không dùng SWR/React Query)

### Data fetching pattern
```typescript
useEffect(() => {
  let cancelled = false
  fetch(url)
    .then(r => r.json())
    .then(data => { if (!cancelled) setState(data) })
    .catch(...)
  return () => { cancelled = true }  // cleanup để tránh race condition
}, [deps])
```

---

## Backend Architecture

### Ktor plugins (thứ tự quan trọng)
```
configureSerialization()   ← kotlinx.serialization JSON
configureCors()            ← CORS headers cho FE
configureStatusPages()     ← Global error handler
configureDatabase()        ← Datasource + Flyway migrations
configureRouting()         ← Register tất cả routes
startBackgroundPoller()    ← Ogmios cache refresh mỗi 5 phút
startVoteIndexers()        ← Chain-sync indexers (1 per network)
```

### Caching strategy
```
CardanoCache (Caffeine, TTL 10 min)
├── drepList[network]     ← Raw Ogmios JSON
└── govActions[network]   ← Raw Ogmios JSON
                          (cả hai refreshed bởi BackgroundPoller mỗi 5 phút)

Route handler:
  1. Try CardanoCache.getIfPresent(network) → serve nếu có
  2. Cache miss → query Ogmios → put cache → serve
```

---

## Transaction Flow

```
FE: wallet.getUtxos() + getChangeAddress() + getRewardAddresses() + getDRepKey()
  │
  ├─→ POST /tx/build
  │     { txType, utxos[], changeAddress, rewardAddress, network, ...txParams }
  │     Backend: KupmiosBackendService + QuickTxBuilder → unsigned TX CBOR
  │     Response: { unsignedTxCbor: "hex" }
  │
  ├─→ wallet.signTx(unsignedTxCbor, false)
  │     Returns: witnessSetCbor (transaction_witness_set only)
  │     Private key không rời ví
  │
  └─→ POST /tx/submit
        { unsignedTxCbor, witnessSetCbor, network }
        Backend: assemble full TX (body + witnesses) → Ogmios submit
        Response: { txHash: "hex" }
```

---

## Database Layer

### Tables (PostgreSQL, off-chain only)

```
drep_profiles           ← DRep IDs đã từng interact (hiện ít dùng)
communities             ← Trạng thái Community của từng DRep
  └── internal_polls    ← Poll nội bộ trong community
        ├── poll_options    ← Choices cho mỗi poll
        ├── poll_votes      ← Vote của delegators (stake-weighted)
        └── poll_comments   ← Comments
drep_votes              ← Indexed on-chain DRep votes (từ VoteIndexer)
indexer_checkpoint      ← Checkpoint slot cho VoteIndexer (mỗi network)
auth_sessions           ← Challenge/nonce cho wallet auth (chưa enforce)
```

On-chain data (DRep list, governance actions, voting history) **không lưu DB** — luôn query Ogmios.

---

## Cardano Data Layer

### BackgroundPoller (interval 5 phút):
```
OgmiosStateQueries.getDelegateRepresentatives() → CardanoCache.drepList
OgmiosStateQueries.getGovernanceProposals()     → CardanoCache.govActions
```

### VoteIndexer (chain-sync, realtime):
```
Ogmios WebSocket nextBlock stream
  → skip pre-Conway blocks (mainnet: slot < 133_660_800, preprod: < 68_774_400)
  → parse block.transactions[].votes[] cho DRep voters
  → upsert vào drep_votes table
  → checkpoint mỗi 60 giây (chỉ skip duplicate DB writes, không stop stream)
```

---

## Wallet Flow

```
User click Connect → window.cardano[name].enable({extensions:[{cip:95}]})
  FE gọi song song:
    getNetworkId()       → 0=preprod, 1=mainnet
    getChangeAddress()   → hex CBOR → decode bech32
    getRewardAddresses() → stake address
    getDRepKey()         → { dRepIDCip105 } (nếu CIP-95)

  Fire-and-forget (background, có AbortController):
    GET /dreps/{drepId}              → isDrepRegistered, votingPower
    GET /stake/{stakeAddr}/delegation → delegatedDrep
    → store.setDRepStatus(...)
```

---

## DRep Data Flow

```
GET /dreps/{drepId}?network=
  → Ogmios getDelegateRepresentatives() → find by credentialHex
  → Response: { isRegistered, id, name, anchorUrl, votingPower }

FE: anchorUrl (ipfs://Qm...) → resolveAnchorUrls()
  → thử Pinata gateway → ipfs.io → cloudflare-ipfs
  → fetch CIP-119 JSON → parseCip119() → { givenName, imageUrl, references, ... }
```

---

## Governance Action Data Flow

```
GET /governance-actions?network=
  CardanoCache hit → parse via mapOgmiosProposal() → List<GovernanceActionDto>
  Cache miss       → query Ogmios → put cache → parse → return

FE GovernanceActionCard:
  → useAnchorTitle(anchorUrl) → lazy fetch CIP-108 body.title từ IPFS
```

---

## Voting History Data Flow

```
GET /dreps/{drepId}/votes?network=&page=&limit=
  Source 1: DrepVotes DB (VoteIndexer indexed, sorted DESC by slot)
  Source 2: CardanoCache.govActions (enrich với GA metadata + cover recent blocks)
  Merge: dedup bằng "txHash#index" key, DB data wins khi conflict

FE VoteHistoryRow:
  → fetch CIP-108 title từ anchorUrl (4s timeout, multi-gateway fallback)
```

---

## Network Separation

```
network param: "preprod" | "mainnet"
  ↓ networkFromString()
Network.PREPROD | Network.MAINNET
  ↓ getBackendService(network)
KupmiosBackendService(
  PREPROD: OGMIOS_PREPROD_URL + KUPO_PREPROD_URL
  MAINNET: OGMIOS_MAINNET_URL + KUPO_MAINNET_URL
)
```

FE: `networkId = await wallet.getNetworkId()` → `0`=preprod, `1`=mainnet

---

## Polyglot Monorepo

```
Root
├── Turborepo (TS packages)
│   pnpm install && pnpm dev         ← FE dev :3000
│   pnpm build                       ← build tất cả TS
│
└── Gradle (Kotlin)
    ./gradlew :apps:api:run          ← API :8080 (từ root)
```

Turborepo **không biết** về Kotlin — hai hệ thống build hoàn toàn độc lập.
