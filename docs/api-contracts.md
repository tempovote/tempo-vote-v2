# API Contracts

Base URL: `http://localhost:8080` (development)

Tất cả request/response đều là JSON. Zod schemas đầy đủ trong `packages/types/src/api/`.

---

## Transactions

### POST /tx/build

Build unsigned transaction CBOR. Frontend lấy UTxOs từ wallet trước khi gọi endpoint này.

**Request**
```json
{
  "txType": "DREP_REGISTER",
  "network": "preprod",
  "utxos": ["<cbor-hex>", "..."],
  "changeAddress": "addr_test1...",
  "rewardAddress": "stake_test1...",
  "drepId": "drep1...",
  "anchorUrl": "https://ipfs.io/ipfs/...",
  "anchorDataHash": "abc123..."
}
```

**txType values:**
- `DREP_REGISTER` — requires: `drepId`, `anchorUrl`, `anchorDataHash`
- `DREP_UPDATE`   — requires: `drepId`; optional: `anchorUrl`, `anchorDataHash`
- `DREP_RETIRE`   — requires: `drepId`
- `VOTE`          — requires: `drepId`, `govActionTxHash`, `govActionIndex`, `voteKind`
- `DELEGATE`      — requires: `delegationType`; if `"drep"`: also `targetDrepId`

**Response 200**
```json
{ "unsignedTxCbor": "<hex>" }
```

**Response 400**
```json
{ "message": "drepId required" }
```

---

### POST /tx/submit

Submit signed transaction to Cardano via Ogmios.

**Request**
```json
{
  "signedTx": "<signed-cbor-hex>",
  "network": "preprod"
}
```

**Response 200**
```json
{ "txHash": "abc123..." }
```

---

## Governance (on-chain data from Ogmios)

### GET /governance-actions?network=preprod

Returns governance actions from Ogmios state query.

### GET /governance-actions/:txHash?network=preprod&index=0

Returns specific governance action.

### GET /dreps?network=preprod

Returns DRep list from Ogmios.

### GET /dreps/:drepId?network=preprod

Returns specific DRep info.

---

## Polls (off-chain)

### GET /polls?communityId=:uuid

List polls for a community.

### POST /polls (auth required)
```json
{
  "communityId": "uuid",
  "title": "Should we...",
  "abstract": "...",
  "votingType": "BASIC",
  "startsAt": "2024-01-01T00:00:00Z",
  "endsAt": "2024-01-08T00:00:00Z"
}
```

### GET /polls/:pollId

Poll detail with options and vote counts.

### POST /polls/:pollId/vote (auth required)
```json
{
  "optionId": "uuid",
  "stakeAddress": "stake1..."
}
```

### POST /polls/:pollId/comments (auth required)
```json
{
  "stakeAddress": "stake1...",
  "content": "..."
}
```

---

## Communities

### GET /communities/:drepId?network=preprod

Get DRep community info.

### POST /communities/:drepId/activate (auth required)

Activate DRep community (requires on-chain DRep status + 2 ADA activation fee tx).

---

## Metadata

### POST /metadata/upload

Upload CIP-119 DRep metadata JSON-LD to IPFS (Pinata).

**Request**
```json
{
  "body": {
    "givenName": "My DRep",
    "motivations": "...",
    "objectives": "..."
  }
}
```

**Response 200**
```json
{
  "anchorUrl": "https://ipfs.io/ipfs/Qm...",
  "anchorDataHash": "blake2b-256-hash-hex"
}
```

---

## Auth

### GET /auth/challenge?stakeAddress=stake1...

Returns a random nonce for wallet signing.

**Response 200**
```json
{ "nonce": "random-hex-64-chars" }
```

### POST /auth/verify
```json
{
  "stakeAddress": "stake1...",
  "network": "preprod",
  "nonce": "...",
  "signature": "...",
  "key": "..."
}
```

**Response 200**
```json
{ "jwt": "eyJ..." }
```

Include JWT in subsequent requests: `Authorization: Bearer <jwt>`

---

## Health

### GET /health
```json
{ "status": "ok", "version": "0.1.0" }
```
