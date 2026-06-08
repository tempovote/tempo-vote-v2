# Propose Governance Action — All 7 Types

## Tổng quan

Hỗ trợ đầy đủ 7 loại Governance Action của Conway era.  
Bloxbean 0.7.0-beta1 đã có class cho tất cả 7 type trong `cardano-client-transaction-spec`.

## Trạng thái

| # | Type | Bloxbean class | Status |
|---|------|---------------|--------|
| 1 | Info Action | `InfoAction` | ✅ Done (Phase 1) |
| 2 | No Confidence | `NoConfidence` | ✅ Done (Phase 2) |
| 3 | Hard Fork Initiation | `HardForkInitiationAction` | ✅ Done (Phase 2) |
| 4 | New Constitution | `NewConstitution` | ✅ Done (Phase 2) |
| 5 | Treasury Withdrawal | `TreasuryWithdrawalsAction` | ⏳ Phase 3 |
| 6 | Update Committee | `UpdateCommittee` | ⏳ Phase 4 |
| 7 | Protocol Parameter Change | `ParameterChangeAction` | ⏳ Phase 4 |

---

## Kiến trúc

### Flow chung (giống Info Action)

```
FE: common fields (title, abstract, motivation, rationale, links)
  + type-specific fields
→ POST /metadata/upload-proposal  → anchorUrl + anchorDataHash
→ POST /tx/build { txType, anchorUrl, anchorDataHash, ...typeParams }
→ wallet.signTx
→ POST /tx/submit
```

### Types mở rộng (`packages/types/src/api/tx.ts`)

Mỗi phase thêm TxType mới + fields nullable vào `BuildTxRequestSchema`:

```
Phase 2 (done):
  TxType: PROPOSE_NO_CONFIDENCE | PROPOSE_HARD_FORK | PROPOSE_NEW_CONSTITUTION
  Fields:
    prevGovActionTxHash?: string     — tx hash của GA trước (NoConf, HF, NewConst, UpdateComm, ParamChange)
    prevGovActionIdx?: number        — index của GA trước
    protocolVersionMajor?: number    — Hard Fork: target major version
    protocolVersionMinor?: number    — Hard Fork: target minor version
    constitutionAnchorUrl?: string   — New Constitution: URL tài liệu Hiến pháp
    constitutionAnchorHash?: string  — New Constitution: hash blake2b-256
    constitutionScriptHash?: string  — New Constitution: guardrails script hash (optional)

Phase 3 (Treasury Withdrawal):
  TxType: PROPOSE_TREASURY_WITHDRAWAL
  Fields:
    treasuryWithdrawals?: { stakeAddress: string; lovelace: string }[]

Phase 4 (Update Committee):
  TxType: PROPOSE_UPDATE_COMMITTEE
  Fields:
    committeeRemove?: string[]                         — bech32 cold credentials
    committeeAdd?: { credential: string; termEpoch: number }[]
    quorumNumerator?: number
    quorumDenominator?: number

Phase 4 (Protocol Param Change):
  TxType: PROPOSE_PROTOCOL_PARAM_CHANGE
  Fields:
    protocolParamUpdate?: Record<string, unknown>     — chỉ các fields cần thay đổi
```

### Backend (`TxBuilder.kt`) — builder functions per type

```kotlin
// Phase 2
fun buildNoConfidence(changeAddress, rewardAddress, anchorUrl, anchorDataHash,
    prevGovActionTxHash?, prevGovActionIdx?): String

fun buildHardFork(changeAddress, rewardAddress, anchorUrl, anchorDataHash,
    protocolVersionMajor, protocolVersionMinor,
    prevGovActionTxHash?, prevGovActionIdx?): String

fun buildNewConstitution(changeAddress, rewardAddress, anchorUrl, anchorDataHash,
    constitutionAnchorUrl, constitutionAnchorHash, constitutionScriptHash?,
    prevGovActionTxHash?, prevGovActionIdx?): String

// Phase 3
fun buildTreasuryWithdrawal(changeAddress, rewardAddress, anchorUrl, anchorDataHash,
    withdrawals: List<Pair<String, Long>>): String

// Phase 4
fun buildUpdateCommittee(...): String
fun buildProtocolParamChange(...): String
```

### Frontend form (`apps/web/app/governance-actions/new/page.tsx`)

- **Common fields**: Title, Abstract, Motivation, Rationale, Links (CIP-108 metadata)
- **Type-specific section**: conditional render sau common fields
- **`sourcePollId`**: optional — không còn guard bắt buộc phải có poll source

Type-specific UI per type:

| Type | UI thêm |
|------|---------|
| No Confidence | Optional: prev GA txHash + index |
| Hard Fork | Required: major + minor version; Optional: prev GA |
| New Constitution | Required: constitution anchor URL + hash; Optional: script hash, prev GA |
| Treasury Withdrawal | Required: list recipient (stake addr + ADA amount) |
| Update Committee | Required: remove list (credentials), add list (credential + term epoch), quorum % |
| Protocol Param Change | Required: param editor (phức tạp, ~25 params) |

---

## Phase 2 — Chi tiết implementation

### Files thay đổi

1. `packages/types/src/api/tx.ts` — thêm 3 TxType + 7 fields
2. `apps/api/.../routes/TransactionRoutes.kt` — thêm fields vào `BuildTxRequest`, 3 cases mới
3. `apps/api/.../cardano/TxBuilder.kt` — thêm imports + 3 build functions
4. `apps/web/app/governance-actions/new/page.tsx` — type-specific UI + routing

### prevGovActionId

`NoConfidence`, `HardForkInitiationAction`, `NewConstitution` đều nhận `prevGovActionId: GovActionId?`.  
Đây là ID của governance action cùng loại đã được enacted trước đó (on-chain chaining).  
Nếu không có (lần đầu), truyền `null`.  
User có thể để trống → backend không set prevGovActionId.

### Constitution anchor vs proposal anchor

`NewConstitution` có **2 anchors khác nhau**:
- **Proposal anchor** (`anchorUrl` + `anchorDataHash`): CIP-108 metadata của proposal → upload IPFS trong handleSubmit
- **Constitution anchor** (`constitutionAnchorUrl` + `constitutionAnchorHash`): URL tài liệu Hiến pháp → user cung cấp thủ công

### Deposit

100,000 ADA trên cả mainnet lẫn preprod (confirmed Ogmios query: `governanceActionDeposit = 100_000_000_000 lovelace`).

---

## Phase 3 — Treasury Withdrawal

### Extra UI
- List recipient: mỗi row = stake address (bech32 `stake1...`) + ADA amount
- Tổng ADA display
- Warning: "Yêu cầu CC threshold + DRep 67% để được ratify"

### Extra backend
- `Withdrawal` class: `{ rewardAccount: bech32, coin: BigInteger }`
- Convert lovelace string → BigInteger (tránh precision loss)

---

## Phase 4 — Update Committee & Protocol Param Change

Complex UI — để sau Phase 3. Cần:
- CC credential lookup (bech32 cold credential)
- `ProtocolParamUpdate` có ~25 fields, cần editor có validation range

---

## Ghi chú kỹ thuật

- `govActionDeposit` null patch: `ConwayParamsPatchEpochService.patchDrepDeposit()` đã set `100_000_000_000L` khi null (CardanoConfig.kt)
- DRep-only: trang này chỉ hiển thị nếu `isDrepRegistered && drepId` 
- CIP-108 metadata luôn upload IPFS trước khi build TX → `anchorCache` ref tránh re-upload khi retry
