# API Contracts

Base URL: `http://localhost:8080` (development)

Tất cả request/response đều là JSON. Zod schemas đầy đủ trong `packages/types/src/api/`.

---

## Health

### GET /health
```json
{ "status": "ok", "version": "0.1.0" }
```

---

## Transactions

### POST /tx/build

Build unsigned transaction CBOR. Frontend lấy UTxOs từ wallet trước khi gọi.

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
  "anchorDataHash": "abc123...",

  // Vote only:
  "govActionTxHash": "abc...",
  "govActionIndex": 0,
  "voteKind": "YES",
  "rationaleUrl": null,
  "rationaleHash": null,

  // Delegation only:
  "delegationType": "drep",
  "targetDrepId": "drep1..."
}
```

**txType values:**
| Value | Required params |
|-------|----------------|
| `DREP_REGISTER` | drepId, anchorUrl, anchorDataHash |
| `DREP_UPDATE` | drepId; optional anchorUrl, anchorDataHash |
| `DREP_RETIRE` | drepId |
| `VOTE` | drepId, govActionTxHash, govActionIndex, voteKind |
| `DELEGATE` | delegationType ("drep"/"abstain"/"no_confidence"); if "drep": targetDrepId |
| `ACTIVATE_COMMUNITY` | (none — fee address từ env `PLATFORM_FEE_ADDRESS_*`) |

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

Submit signed transaction. Hỗ trợ 2 modes:

**Mode 1 (preferred): unsigned + witness set**
```json
{
  "network": "preprod",
  "unsignedTxCbor": "<hex from /tx/build>",
  "witnessSetCbor": "<hex from wallet.signTx()>"
}
```

**Mode 2 (legacy): full signed tx**
```json
{
  "network": "preprod",
  "signedTx": "<fully-signed-cbor-hex>"
}
```

**Response 200**
```json
{ "txHash": "abc123..." }
```

---

## Governance Actions

### GET /governance-actions

**Query params:** `network=preprod|mainnet`, `type=treasuryWithdrawals|hardForkInitiation|...` (optional)

**Response 200** — Array of GovernanceActionDto
```json
[
  {
    "txHash": "abc...",
    "index": 0,
    "actionType": "treasuryWithdrawals",
    "type": "Treasury Withdrawals",
    "anchorUrl": "ipfs://Qm...",
    "anchorHash": "def...",
    "expiresEpoch": 520,
    "drepVotes": {
      "yesLovelace": 5130000000000,
      "noLovelace": 912000000000,
      "abstainLovelace": 0
    },
    "spoVotes": { "yesLovelace": 0, "noLovelace": 0, "abstainLovelace": 0 },
    "ccVotes": { "yes": 7, "no": 0, "abstain": 0, "total": 7 }
  }
]
```

---

### GET /governance-actions/{txHash}/{index}

Single governance action. **404** nếu không tìm thấy.

**Response 200** — GovernanceActionDto (same shape as above)

---

### GET /governance-actions/{txHash}/{index}/my-vote

**Query params:** `drepId=drep1...`, `network=preprod`

**Response 200**
```json
{ "voted": "yes" }
```
`voted` là `"yes"` | `"no"` | `"abstain"` | `null` (chưa vote)

---

## DReps

### GET /dreps

**Query params:** `network=preprod`

**Response 200** — Raw Ogmios JSON (DRep list, chưa map sang DTO)

---

### GET /dreps/{drepId}

**Query params:** `network=preprod`

**Response 200**
```json
{
  "isRegistered": true,
  "active": true,
  "mandateExpiresEpoch": 525,
  "id": "drep1...",
  "name": null,
  "anchorUrl": "ipfs://Qm...",
  "votingPower": 5130000000000,
  "stakeKeyBalance": null
}
```

`stakeKeyBalance` luôn là `null` (TODO: Kupo integration).

---

### GET /dreps/{drepId}/votes

**Query params:** `network=preprod`, `page=1`, `limit=20`

**Response 200**
```json
{
  "votes": [
    {
      "txHash": "abc...",
      "index": 0,
      "type": "Treasury Withdrawals",
      "actionType": "treasuryWithdrawals",
      "anchorUrl": "ipfs://Qm...",
      "vote": "yes",
      "expiresEpoch": 520
    }
  ],
  "total": 87,
  "page": 1,
  "limit": 20
}
```

---

### GET /stake/{stakeAddress}/delegation

**Query params:** `network=preprod`

**Response 200**
```json
{
  "delegatedDrep": {
    "id": "drep1...",
    "name": "My DRep"
  }
}
```
`delegatedDrep` là `null` nếu chưa delegate.

---

## Communities

### GET /communities/{drepId}

**Query params:** `network=preprod`

**Response 200 (active)**
```json
{
  "id": "uuid",
  "drepId": "drep1...",
  "network": "preprod",
  "isActive": true,
  "activatedAt": "2024-01-15T10:30:00"
}
```

**Response 200 (inactive/not found)**
```json
{ "isActive": false }
```

---

### POST /communities/{drepId}/activate

**Body**
```json
{
  "network": "preprod",
  "txHash": "abc..."
}
```

**Response 200**
```json
{ "id": "uuid", "isActive": true }
```

> Note: txHash được lưu nhưng chưa verify on-chain.

---

### GET /communities/{drepId}/polls

**Query params:** `network=preprod`, `page=1`

**Response 200**
```json
{
  "items": [
    {
      "id": "uuid",
      "communityId": "uuid",
      "title": "Should we...",
      "abstract": "...",
      "status": "active",
      "startsAt": "2024-01-01T00:00:00",
      "endsAt": "2024-01-08T00:00:00",
      "createdAt": "2024-01-01T00:00:00",
      "commentCount": 5
    }
  ],
  "total": 12,
  "page": 1,
  "limit": 10
}
```

`status`: `"active"` | `"pending"` | `"closed"` (computed từ startsAt/endsAt)

---

### POST /communities/{drepId}/polls

**Body**
```json
{
  "network": "preprod",
  "title": "Should we...",
  "abstract": "Detailed description...",
  "startsAt": "2024-01-01T00:00:00Z",
  "endsAt": "2024-01-08T00:00:00Z"
}
```

**Response 201**
```json
{ "id": "uuid" }
```

**Response 403** nếu community chưa active.

---

### GET /communities/polls/{pollId}/comments

**Response 200**
```json
{
  "items": [
    {
      "id": "uuid",
      "stakeAddress": "stake1...",
      "content": "...",
      "createdAt": "2024-01-01T00:00:00"
    }
  ],
  "total": 3
}
```

---

### POST /communities/polls/{pollId}/comments

**Body**
```json
{
  "stakeAddress": "stake1...",
  "content": "My comment"
}
```

**Response 201**
```json
{ "id": "uuid" }
```

---

## Metadata (IPFS / Pinata)

### POST /metadata/upload

Upload CIP-119 DRep metadata JSON-LD to Pinata IPFS.

**Request**
```json
{
  "drepId": "drep1...",
  "givenName": "My DRep Name",
  "motivations": "...",
  "objectives": "...",
  "qualifications": "...",
  "imageUrl": "ipfs://Qm...",
  "paymentAddress": "addr1...",
  "doNotList": false,
  "references": [
    { "type": "Link", "label": "Twitter", "uri": "https://twitter.com/..." }
  ]
}
```

**Response 200**
```json
{
  "anchorUrl": "ipfs://QmXxx...",
  "anchorDataHash": "blake2b256-hex-64-chars"
}
```

---

### POST /metadata/upload-image

Upload DRep avatar image.

**Request**
```json
{
  "base64": "<base64-encoded-image-data>",
  "mimeType": "image/jpeg",
  "filename": "avatar"
}
```

**Response 200**
```json
{ "imageUrl": "ipfs://QmXxx..." }
```

---

### DELETE /metadata/unpin/{hash}

Unpin từ Pinata (dùng để cleanup khi update metadata).

**Response 200**
```json
{ "ok": true }
```

---

## Auth (TODO — chưa enforce)

### GET /auth/challenge

**Query params:** `stakeAddress=stake1...`

**Response 200**
```json
{ "nonce": "random-hex-64-chars" }
```

---

### POST /auth/verify

**Body**
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

> Hiện tại JWT chưa được enforce trên bất kỳ endpoint nào.
> Include trong header khi enforce: `Authorization: Bearer <jwt>`

---

## Error Response

Tất cả errors đều theo format:
```json
{ "message": "Error description" }
```
hoặc
```json
{ "error": "Error description" }
```
(legacy — routes cũ dùng `"error"` key)
