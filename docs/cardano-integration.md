# Cardano Integration

## cardano-client-lib (bloxbean)

Thư viện Java/Kotlin để build Cardano transactions. Phiên bản `0.7.x` hỗ trợ đầy đủ Conway era / CIP-1694.

### KupmiosBackendService

Backend service gộp Ogmios + Kupo. Đây là backend **duy nhất** cần thiết cho `QuickTxBuilder`:

```kotlin
val backendService = KupmiosBackendService(
    ogmiosUrl = "ws://ogmios-host:1337",  // WebSocket
    kupoUrl   = "http://kupo-host:1442"   // HTTP REST
)
val quickTxBuilder = QuickTxBuilder(backendService)
```

- **Ogmios** cung cấp: protocol params, tx submission, tx evaluation
- **Kupo** cung cấp: UTxO queries by address/pattern

### Governance Transactions (QuickTx API)

Tất cả governance transactions dùng `Tx()` builder:

```kotlin
// Register DRep
Tx().registerDRep(drepCredential, Anchor(url, hash)).from(address)

// Vote on governance action
Tx().createVote(voter, govActionId, Vote.YES).from(address)

// Delegate voting power
Tx().delegateVotingPowerTo(rewardAddress, drep).from(address)

// Update DRep metadata
Tx().updateDRep(drepCredential, Anchor(url, hash)).from(address)

// Retire as DRep
Tx().unregisterDRep(drepCredential).from(address)
```

### Build-without-sign pattern

Vì private key nằm trong ví của user (không phải server), server build tx nhưng không ký:

```kotlin
// TxBuilder.kt — buildUnsigned()
val transaction = quickTxBuilder
    .compose(tx)
    .feePayer(changeAddress)
    .buildAndSign()            // builds tx body, adds placeholder witness set
val unsignedCbor = transaction.serialize()
// Trả về unsignedCbor cho frontend
// Frontend: wallet.signTx(unsignedCbor) → signed CBOR → submit
```

> **TODO**: Verify chính xác cách extract unsigned CBOR từ `buildAndSign()` trong cardano-client-lib.
> Có thể cần dùng `.complete()` thay vì `.buildAndSign()`.
> Xem: https://cardano-client.dev/docs/apis/transaction/quicktx-api

## Ogmios State Queries

Ogmios WebSocket JSON-RPC — dùng cho governance data queries (ngoài KupmiosBackendService):

### Governance Actions
```json
{
  "jsonrpc": "2.0",
  "method": "queryLedgerState/governanceActions",
  "params": {},
  "id": "1"
}
```

### DRep List
```json
{
  "jsonrpc": "2.0",
  "method": "queryLedgerState/delegateRepresentatives",
  "params": {},
  "id": "2"
}
```

### Treasury
```json
{
  "jsonrpc": "2.0",
  "method": "queryLedgerState/treasury",
  "params": {},
  "id": "3"
}
```

Xem full API: https://ogmios.dev/api/

## CIP-119 DRep Metadata

DRep metadata được lưu on-chain qua `anchor` (URL + blake2b-256 hash của file JSON-LD).

File metadata phải public accessible (IPFS qua Pinata).

### Format (CIP-119)
```json
{
  "@context": { "CIP119": "...", ... },
  "hashAlgorithm": "blake2b-256",
  "body": {
    "givenName": "My DRep Name",
    "motivations": "...",
    "objectives": "...",
    "qualifications": "...",
    "paymentAddress": "addr1...",
    "references": [...]
  }
}
```

### Upload flow
1. Build JSON-LD object (`packages/types/src/cardano/cip119.ts`)
2. POST `/metadata/upload` → `apps/api/routes/MetadataRoutes.kt`
3. Backend uploads to Pinata → returns `{ anchorUrl, anchorDataHash }`
4. Frontend includes trong `BuildTxRequest` cho `DREP_REGISTER` hoặc `DREP_UPDATE`

## Wallet Authentication

Dùng CIP-30 `signData` để xác thực user mà không cần password:

```
1. GET  /auth/challenge    → { nonce: "random-hex-string" }
2. wallet.signData(stakeAddress, nonce) → { signature, key }
3. POST /auth/verify       { stakeAddress, signature, key, nonce }
                           → { jwt: "..." }
```

JWT được dùng cho tất cả authenticated API calls (polls, community, v.v.)
