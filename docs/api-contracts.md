# API Contracts

Base URL: `http://localhost:8080` (development)

Tất cả request/response đều là JSON. Zod schemas đầy đủ trong `packages/types/src/api/`.

> File đầy đủ và cập nhật hơn: [API_CONTRACTS.md](API_CONTRACTS.md)

---

## Transactions

### POST /tx/build

Build unsigned transaction CBOR.

**Request**
```json
{
  "txType": "DREP_REGISTER",
  "network": "preprod",
  "utxos": ["<cbor-hex>"],
  "changeAddress": "addr_test1...",
  "rewardAddress": "stake_test1...",
  "drepId": "drep1...",
  "anchorUrl": "https://ipfs.io/ipfs/...",
  "anchorDataHash": "abc123..."
}
```

**txType values:** `DREP_REGISTER` | `DREP_UPDATE` | `DREP_RETIRE` | `VOTE` | `DELEGATE` | `ACTIVATE_COMMUNITY`

**Response 200:** `{ "unsignedTxCbor": "<hex>" }`

---

### POST /tx/submit

**Request:** `{ "unsignedTxCbor": "<hex>", "witnessSetCbor": "<hex>", "network": "preprod" }`

**Response 200:** `{ "txHash": "abc123..." }`

---

## Governance

### GET /governance-actions?network=preprod&type=treasuryWithdrawals

### GET /governance-actions/{txHash}/{index}?network=preprod

### GET /governance-actions/{txHash}/{index}/my-vote?drepId=drep1...&network=preprod

Returns `{ "voted": "yes"|"no"|"abstain"|null }`

---

## DReps

### GET /dreps?network=preprod

### GET /dreps/{drepId}?network=preprod

Returns `{ isRegistered, active, id, name, anchorUrl, votingPower, stakeKeyBalance }`

### GET /dreps/{drepId}/votes?network=preprod&page=1&limit=20

Returns `{ votes: [...], total, page, limit }`

### GET /stake/{stakeAddress}/delegation?network=preprod

Returns `{ delegatedDrep: { id, name } | null }`

---

## Communities

### GET /communities/{drepId}?network=preprod

### POST /communities/{drepId}/activate

Body: `{ "network": "preprod", "txHash": "abc..." }`

### GET /communities/{drepId}/polls?network=preprod&page=1

### POST /communities/{drepId}/polls

### GET/POST /communities/polls/{pollId}/comments

---

## Metadata

### POST /metadata/upload → `{ anchorUrl, anchorDataHash }`

### POST /metadata/upload-image → `{ imageUrl }`

### DELETE /metadata/unpin/{hash}

---

## Auth (stub — chưa enforce)

### GET /auth/challenge?stakeAddress=stake1...

### POST /auth/verify → `{ jwt }`

---

## Health

### GET /health → `{ status: "ok" }`
