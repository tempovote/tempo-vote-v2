# Tempo Multi-Party Alliance — Milestone Delivery Report

**Project:** [Tempo] Multi-Party Alliance  
**Catalyst Fund:** Fund 13 — Cardano Use Cases: Concept  
**Project ID:** #1300011  
**Platform:** [https://tempo.vote](https://tempo.vote) / [https://app.tempo.vote](https://app.tempo.vote)  
**Source Code:** [https://github.com/tempovote/tempo-vote-v2](https://github.com/tempovote/tempo-vote-v2) (branch: `feature/alliance`)  
**Network Tested:** Cardano Preprod Testnet  

---

## 1. Overview

This document describes the design, architecture, and full implementation of the **Multi-Party Alliance** feature built on the Tempo governance platform. The Alliance system enables Cardano DReps and ADA holders to form governed coalitions, collectively vote on proposals, and transparently manage shared treasuries — all enforced by Plutus smart contracts on-chain.

---

## 2. Problem Statement

Cardano's representative democracy (CIP-1694) allows delegators to assign voting power to DReps. However, there is currently **no mechanism** for DReps with shared governance views to:

- Formally unite into a coalition with agreed operating rules
- Reach collective decisions via on-chain-verifiable governance
- Pool treasury funds and spend them transparently via smart contract

Tempo Alliance addresses all three gaps.

---

## 3. Solution Architecture

### 3.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js 15 / TypeScript)                         │
│  apps/web/app/alliances/                                     │
│  • Alliance list, create, detail, member management         │
│  • Proposal create, vote, detail                            │
│  • Treasury dashboard (UTxOs, balance, history)             │
│  • Withdraw TX builder → wallet sign → submit               │
└───────────────────────┬─────────────────────────────────────┘
                        │  REST + JWT
┌───────────────────────▼─────────────────────────────────────┐
│  Backend API (Kotlin / Ktor)                                 │
│  apps/api/                                                   │
│  • Alliance & Proposal CRUD (AllianceRoutes.kt)             │
│  • Vote tally engine with VP cap (AllianceProposalRoutes.kt)│
│  • Treasury UTxO query via Ogmios                           │
│  • Finalization TX auto-submit (FinalizationTxSubmitter.kt) │
│  • Withdraw TX builder (TxBuilder.kt)                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
   ┌────▼────┐   ┌──────▼──────┐   ┌───▼────┐
   │PostgreSQL│   │Ogmios (WS)  │   │ Kupo   │
   │(off-chain│   │state queries│   │(UTxO   │
   │ records) │   │ + TX submit │   │ index) │
   └──────────┘   └─────────────┘   └────────┘
                        │
        ┌───────────────▼───────────────┐
        │  Cardano Preprod / Mainnet    │
        │  • Treasury Validator (Aiken) │
        │  • Proposal Registry (Aiken)  │
        └───────────────────────────────┘
```

### 3.2 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS v4 |
| Backend | Kotlin, Ktor 3.2, Exposed ORM |
| Database | PostgreSQL + Flyway migrations |
| Blockchain | Cardano Preprod/Mainnet (cardano-node + Ogmios + Kupo) |
| Smart Contracts | Aiken (compiled to Plutus V3) |
| TX Building | cardano-client-lib 0.7.0-beta1, QuickTxBuilder |
| Wallet Bridge | CIP-30 / CIP-95 (custom, no MeshSDK dependency) |

---

## 4. Features Implemented

### Phase 1 — Alliance Core

#### 4.1 Create Alliance

A registered DRep can create an alliance with:

- **Name, description, charter** (markdown-supported rationale)
- **Tags** for discoverability (e.g., `fiscal`, `technical`, `social`)
- **Logo** (uploaded to IPFS via Pinata)
- **Network** (preprod or mainnet)
- **Governance parameters** (see §4.2)

On creation:
1. Backend verifies the DRep is registered on-chain (Ogmios query)
2. Backend checks the DRep is not already in another alliance
3. Alliance treasury address is **automatically derived** from the Treasury Plutus script hash
4. Creator is added as member with role `owner`

**API:** `POST /api/alliances`  
**Frontend:** `apps/web/app/alliances/new/page.tsx`  
**Backend:** `AllianceRoutes.kt:311-388`

#### 4.2 Alliance Governance Parameters

Each alliance configures its own governance rules at creation time:

| Parameter | Default | Description |
|---|---|---|
| `approval_threshold_vp` | 60% | Minimum % of YES voting power among voted VP |
| `approval_threshold_count` | 50% | Minimum % of YES votes by headcount |
| `quorum_threshold` | 30% | Minimum % of members who must vote |
| `vp_cap_pct` | 20% | VP cap per member (prevents whale dominance) |
| `timelock_hours` | 48h | Delay between approval and treasury execution |
| `max_withdrawal_pct` | 30% | Max % of treasury per withdrawal proposal |
| `proposal_duration_days` | 7 days | Voting window for each proposal |

#### 4.3 Join / Leave Alliance

- Any registered DRep can join a public alliance
- A DRep can only belong to **one alliance per network** at a time
- Members with role `owner` cannot leave without transferring ownership
- Owner/admin can remove members (`DELETE /api/alliances/:id/members/:drepId`)

**API:** `POST /api/alliances/:id/join`, `DELETE /api/alliances/:id/leave`

#### 4.4 Member Role Management

Three roles: `owner` → `admin` → `member`

- **owner**: Full control, cannot be removed, cannot leave
- **admin**: Can manage members, cancel any proposal
- **member**: Can create proposals, vote

**API:** `PATCH /api/alliances/:id/members/:drepId/role`

---

### Phase 2 — Proposals & Voting

#### 4.5 Proposal Types

Two proposal types are supported:

**1. `withdrawal`** — Request ADA from alliance treasury
- Specifies: `amountLovelace`, `recipientAddress`, `recipientLabel`
- Enforces: `max_withdrawal_pct` limit on treasury balance
- Lifecycle: `voting` → `approved_pending` / `rejected` → `approved` → `executed`

**2. `ga_stance`** — Express collective stance on a Cardano Governance Action
- Links to an on-chain GA via `govActionTxHash` + `govActionIndex`
- Displayed on the GA detail page in Tempo as "Alliance Stances"
- Lifecycle: `voting` → `passed` / `failed`

**API:** `POST /api/alliances/:id/proposals`  
**Frontend:** `apps/web/app/alliances/[id]/proposals/new/page.tsx`

#### 4.6 Voting Engine with VP Cap

Members vote YES / NO / ABSTAIN. The tally engine in `AllianceProposalRoutes.kt:137-185` computes:

```
effectiveVP(member) = min(member.votingPower, totalVP × vpCapPct / 100)

yesVP   = Σ effectiveVP where vote = YES
totalVP = yesVP + noVP + abstainVP

isQuorumMet  = (totalVoted / totalMembers) × 100 ≥ quorumThreshold
vpOk         = (yesVP / totalVP) × 100 ≥ approvalThresholdVp
countOk      = (yesCount / totalVoted) × 100 ≥ approvalThresholdCount

isApproved = isQuorumMet AND vpOk AND countOk
```

The VP cap (`vpCapPct`) ensures that no single member with outsized delegated VP can dominate collective decisions.

Votes are snapshotted at cast time from the live Ogmios DRep list and can be changed before the voting window closes.

**API:** `POST /api/alliances/:id/proposals/:pid/vote`

#### 4.7 Auto-Close & Status Transition

A background poller (`BackgroundPoller`, runs every 5 minutes) calls `autoCloseExpiredProposals()`:

```
voting + expired + approved → approved_pending  (withdrawal)
voting + expired + approved → passed            (ga_stance)
voting + expired + rejected → rejected          (withdrawal)
voting + expired + rejected → failed            (ga_stance)
approved_pending + timelock passed → approved   (withdrawal ready to execute)
```

#### 4.8 Alliance Stance on Governance Actions

When an alliance creates a `ga_stance` proposal for a specific GA, the collective stance (YES/NO/ABSTAIN based on majority vote count) is shown on the GA detail page alongside other alliances' stances.

**API:** `GET /api/governance-actions/:txHash/:index/alliance-stances`  
**Frontend:** `apps/web/components/alliance/AllianceStancesPanel.tsx`

---

### Phase 3 — Treasury & Smart Contracts

#### 4.9 Plutus Smart Contracts (Aiken)

Two validators deployed on Cardano Preprod:

**Treasury Validator** (`contracts/alliance_treasury/validators/treasury.ak`)

The treasury script controls all funds deposited to the alliance. A withdrawal can only execute when a TX satisfies **all** of these conditions verified on-chain:

```aiken
validator treasury {
  spend(datum, redeemer, _input, tx) {
    // 1. Find a reference_input at the Proposal Registry address
    //    with a ProposalResult datum matching this alliance + proposal
    // 2. ProposalResult.result == "approved"
    // 3. current_slot_time >= ProposalResult.executable_at_ms  (timelock)
    // 4. TX output pays >= ProposalResult.amount to ProposalResult.recipient_pkh
  }
}
```

**Proposal Registry Validator** (`contracts/alliance_treasury/validators/proposal_registry.ak`)

```aiken
validator proposal_registry {
  spend(...) { False }  // Always fails — UTxOs are permanent records
}
```

The Proposal Registry is an immutable on-chain ledger. Once a ProposalResult datum UTxO is placed here, it can never be removed.

| Script | Hash | Preprod Address |
|---|---|---|
| Treasury | `ac8a0b87...c025e3` | `addr_test1wzkg5zu...ce05m` |
| Proposal Registry | `9c4937d9...c477df` | `addr_test1wzwyjd7...a7jtk` |

#### 4.10 Finalization TX

When a withdrawal proposal reaches `approved` status, a **Finalization TX** is automatically submitted by the Tempo service wallet:

```
Service Wallet  ──(2 ADA + ProposalResult datum)──►  Proposal Registry
```

The `ProposalResult` datum encoded as Plutus `Constr 0 [...]` contains:

| Field | Type | Description |
|---|---|---|
| `alliance_id` | `ByteArray` (16B) | UUID of the alliance |
| `proposal_id` | `ByteArray` (16B) | UUID of the proposal |
| `result` | `ByteArray` | `"approved"` |
| `amount` | `Int` | Withdrawal amount in lovelace |
| `recipient_pkh` | `ByteArray` (28B) | Payment key hash of recipient |
| `executable_at_ms` | `Int` | POSIX ms after which execution is allowed |

The 2 ADA minimum UTxO is permanently locked in the Proposal Registry (the validator always returns `False`). This is the cost of creating an immutable on-chain proof of the governance decision.

**Code:** `FinalizationTxSubmitter.kt`  
**Auto-trigger:** `BackgroundPoller` every 5 minutes

Example (Preprod Testnet):
- Finalization TX: `3c13dc67bc75acaf4aa713574f085306e4525e7f8081f221b96eb8c5a10b4293`
- Datum hash: `d0abfad88fae3a6d9b4b18e20cfe5dbaf46013a409a0f0d4cbeb752cfcdcb3af`

#### 4.11 Treasury UTxO Query

The backend filters treasury UTxOs by datum hash to isolate each alliance's funds (multiple alliances share the same treasury script address):

```kotlin
// Expected datum = TreasuryDatum { alliance_id: <uuid bytes> }
// Constr 0 [allianceId]
val expectedDatumHash = FinalizationTxSubmitter.buildTreasuryDatum(allianceId).getDatumHash()
val utxos = OgmiosStateQueries(network).getScriptUtxos(resolvedAddr, expectedDatumHash)
```

**API:** `GET /api/alliances/:id/treasury`

#### 4.12 Withdraw TX

After timelock expires, any alliance member can execute the withdrawal from the frontend:

```
Transaction Flow:
1. FE: getUtxos() + getChangeAddress()
2. POST /api/tx/build {
     txType: "withdrawAllianceTreasury",
     allianceId, proposalId,
     treasuryUtxo { txHash, outputIndex },
     finalizationTxHash, finalizationTxIndex,
     executableAtMs, changeAddress, utxos
   }
3. BE: QuickTxBuilder
     .collectFrom(treasuryUtxo, ExecuteRedeemer { proposal_id })
     .readFrom(finalizationTxHash, finalizationTxIndex)  ← reference_input
     .payTo(recipientAddress, amount)
     .validFrom(executableAtMs)
     → unsigned CBOR
4. FE: wallet.signTx(unsignedCbor)
5. POST /api/tx/submit → { txHash }
```

The Treasury validator runs on Cardano node at submit time and verifies all conditions. The private key never leaves the user's wallet.

**Code:** `TxBuilder.kt:650-770`  
**Frontend:** `apps/web/app/alliances/[id]/proposals/[pid]/page.tsx`

#### 4.13 ExUnits Evaluation

Script execution units (memory + CPU) are evaluated via Ogmios `evaluateTx` before submission to set accurate budget parameters:

```kotlin
val evaluated = OgmiosStateQueries(network).evaluateTx(unsignedCbor)
// → { "spend:0": { memory: N, cpu: M } }
// Inject evaluated ExUnits into redeemer before final build
```

**Code:** `TxBuilder.kt` (Phase 3 addition)

---

## 5. Complete API Reference

### Alliance Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/alliances` | — | List alliances (filter by network, tag, page) |
| `GET` | `/api/alliances/:id` | — | Get alliance detail + membership info |
| `GET` | `/api/alliances/:id/members` | — | List members with DRep metadata |
| `POST` | `/api/alliances` | JWT | Create alliance (DRep only, on-chain verified) |
| `PATCH` | `/api/alliances/:id` | JWT | Update name/description/charter/tags (owner) |
| `POST` | `/api/alliances/:id/join` | JWT | Join alliance (DRep only, on-chain verified) |
| `DELETE` | `/api/alliances/:id/leave` | JWT | Leave alliance |
| `PATCH` | `/api/alliances/:id/members/:drepId/role` | JWT | Promote/demote member (owner/admin) |
| `DELETE` | `/api/alliances/:id/members/:drepId` | JWT | Remove member (owner/admin) |

### Proposal Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/alliances/:id/proposals` | — | List proposals (filter by type, status) |
| `GET` | `/api/alliances/:id/proposals/:pid` | — | Get proposal + live tally |
| `POST` | `/api/alliances/:id/proposals` | JWT | Create proposal (member only) |
| `POST` | `/api/alliances/:id/proposals/:pid/vote` | JWT | Cast/update vote |
| `DELETE` | `/api/alliances/:id/proposals/:pid` | JWT | Cancel proposal |
| `POST` | `/api/alliances/:id/proposals/:pid/finalize` | JWT | Trigger Finalization TX |
| `POST` | `/api/alliances/:id/proposals/:pid/execute` | JWT | Mark withdrawal executed |

### Treasury & Governance Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/alliances/:id/treasury` | — | Treasury UTxOs + balance |
| `GET` | `/api/governance-actions/:txHash/:index/alliance-stances` | — | All alliance stances on a GA |
| `POST` | `/api/tx/build` | JWT | Build Withdraw TX (unsigned CBOR) |
| `POST` | `/api/tx/submit` | — | Submit signed TX to Cardano |

---

## 6. Database Schema

Five tables added (Flyway migrations `V18__alliances.sql`, `V20__alliance_proposals.sql`):

```sql
alliances (
  id UUID PRIMARY KEY,
  name VARCHAR(100) UNIQUE PER NETWORK,
  description TEXT, charter TEXT, tags JSONB, logo_url TEXT,
  creator_drep_id TEXT,
  network TEXT,                              -- 'preprod' | 'mainnet'
  treasury_address TEXT,                     -- derived from Plutus script
  treasury_script_hash TEXT,
  approval_threshold_vp INT DEFAULT 60,
  approval_threshold_count INT DEFAULT 50,
  quorum_threshold INT DEFAULT 30,
  vp_cap_pct INT DEFAULT 20,
  timelock_hours INT DEFAULT 48,
  max_withdrawal_pct INT DEFAULT 30,
  proposal_duration_days INT DEFAULT 7,
  created_at TIMESTAMP
)

alliance_members (
  id UUID, alliance_id UUID → alliances,
  drep_id TEXT, stake_address TEXT, network TEXT,
  role TEXT,  -- 'owner' | 'admin' | 'member'
  joined_at TIMESTAMP
)

alliance_proposals (
  id UUID, alliance_id UUID → alliances,
  proposer_drep_id TEXT,
  proposal_type TEXT,                        -- 'withdrawal' | 'ga_stance'
  title TEXT, description TEXT,
  amount_lovelace BIGINT, recipient_address TEXT, recipient_label TEXT,
  gov_action_tx_hash TEXT, gov_action_index INT,
  status TEXT,                               -- see §4.7
  voting_ends_at TIMESTAMP,
  approved_at TIMESTAMP, executable_at TIMESTAMP,
  finalization_tx_hash CHAR(64),             -- set after Finalization TX
  executed_tx_hash CHAR(64),
  created_at TIMESTAMP
)

alliance_proposal_votes (
  id UUID, proposal_id UUID → alliance_proposals,
  drep_id TEXT, stake_address TEXT,
  vote TEXT,                                 -- 'YES' | 'NO' | 'ABSTAIN'
  voting_power BIGINT,                       -- snapshot at cast time
  created_at TIMESTAMP
)
```

---

## 7. Security Model

### On-Chain (Trust-Minimized)

All financial operations are enforced by Plutus validators running on Cardano nodes. No backend can bypass them:

1. **Treasury funds** can only leave when a valid `ProposalResult` exists in the Proposal Registry
2. **Timelock** is enforced by transaction validity range — not by the backend clock
3. **Recipient and amount** are fixed in the on-chain datum at finalization time — cannot be changed after approval

### Off-Chain (Convenience Layer)

The backend and database store governance decisions for UI display and proposal management. These are **not trusted** by the smart contracts:

- `alliance_proposals.status` — display only; the Treasury validator reads the on-chain datum
- `alliance_proposal_votes` — off-chain vote record; the Finalization TX is the on-chain proof
- JWT authentication — controls API write access; does not affect on-chain security

### Key Security Properties

| Property | Mechanism |
|---|---|
| Only approved proposals can withdraw | Treasury validator reads `ProposalResult.result == "approved"` |
| Timelock enforced on-chain | TX `validityRange.lowerBound >= executableAtMs` |
| Recipient cannot be changed after approval | `recipient_pkh` locked in Finalization datum |
| VP cap prevents whale dominance | Tally engine: `effectiveVP = min(VP, totalVP × cap%)` |
| Private keys never leave wallet | FE signs unsigned CBOR from backend, submits signed TX |
| Proposal Registry is immutable | Validator always returns `False` for spend |
| One DRep per alliance | Enforced by backend + DB unique constraint |

---

## 8. End-to-End Withdrawal Flow

```
[1] Create Alliance
    DRep → POST /api/alliances
    Backend verifies DRep on-chain via Ogmios
    Treasury address derived from script hash
    
[2] Fund Treasury  
    Any wallet → send ADA to treasury address
    with TreasuryDatum { alliance_id } inline datum
    
[3] Create Withdrawal Proposal
    Member → POST /api/alliances/:id/proposals
    { type: "withdrawal", amount: 10 ADA, recipient: "addr1..." }
    
[4] Members Vote
    POST /api/alliances/:id/proposals/:pid/vote { vote: "YES" }
    VP capped at vpCapPct of total VP
    
[5] Voting Window Closes
    BackgroundPoller detects votingEndsAt < now
    computeTally() → isApproved = true
    status → "approved"
    
[6] Finalization TX (automatic, ~5 min after approval)
    Service wallet submits TX to Cardano:
    Output: 2 ADA → Proposal Registry
    Datum:  ProposalResult { allianceId, proposalId, "approved",
                            10_000_000, recipientPkh, executableAtMs }
    DB: finalization_tx_hash stored, status → "approved_pending"
    
[7] Timelock Expires (default 48h)
    BackgroundPoller: approved_pending + executableAt < now → "approved"
    
[8] Execute Withdrawal
    Member builds TX in UI → wallet signs → submit:
    Input:  Treasury UTxO (with TreasuryDatum)
    Ref:    Proposal Registry UTxO (read-only, ProposalResult datum)
    Output: 10 ADA → recipient address
    ValidFrom: executableAtMs
    Treasury validator runs on-chain → verifies all conditions → TX accepted
    DB: status → "executed", executed_tx_hash stored
```

---

## 9. Testing

### Preprod Testnet End-to-End Test

The complete withdrawal flow has been tested on Cardano Preprod Testnet:

| Step | Evidence |
|---|---|
| Alliance created | DB: `e5f57418-926c-459e-b2ce-e769ba4fa968` |
| Withdrawal proposal | DB: `7fe4f29a-aee5-4424-a070-cbac7e2ffe60`, 10 ADA |
| Vote cast (YES, 3.1T VP) | DRep `drep1npm49...efcuh` |
| Finalization TX submitted | `3c13dc67bc75acaf4aa713574f085306e4525e7f8081f221b96eb8c5a10b4293` |
| ProposalResult datum on-chain | Hash: `d0abfad88fae3a6d9b4b18e20cfe5dbaf46013a409a0f0d4cbeb752cfcdcb3af` |
| Datum verified (decoded) | `alliance_id=e5f57418...`, `result="approved"`, `amount=10 ADA`, `executableAt=2026-06-21 13:44 UTC` |

### Unit Tests

- `MnemonicAccountTest.kt` — Service wallet Account creation with 24-word BIP-39 mnemonic
- `NetworkFromStringTest.kt` — Network string mapping (case-insensitive, safe default)

---

## 10. Implementation Notes

### VP Snapshot Design

Voting power is snapshotted from the live Ogmios DRep list **at the time of vote casting**, not at proposal creation. This reflects the DRep's current delegation at decision time and avoids stale VP data.

### Shared Treasury Address

All alliances on the same network share one treasury contract address (derived from the same Plutus script). Individual alliance funds are isolated by requiring the `TreasuryDatum { alliance_id }` inline datum on deposits. The backend filters UTxOs by the expected datum hash using Ogmios `getScriptUtxos`.

### Service Wallet

The Finalization TX is submitted by a Tempo-operated service wallet. This wallet:
- Is funded with small amounts of ADA (~0.2 ADA per TX for fees + 2 ADA per finalization locked)
- Is not trusted for security — the datum it creates is verified by the on-chain Treasury validator
- Is configurable via `SERVICE_WALLET_MNEMONIC` environment variable

### ExUnits Evaluation

Script execution units are evaluated via Ogmios `evaluateTx` before the final TX build. This avoids hardcoded ExUnit budgets and ensures the transaction passes phase-2 validation regardless of datum complexity.

---

## 11. Source Files Reference

| Component | File |
|---|---|
| Treasury Validator | `contracts/alliance_treasury/validators/treasury.ak` |
| Proposal Registry Validator | `contracts/alliance_treasury/validators/proposal_registry.ak` |
| Script address derivation | `apps/api/src/main/kotlin/cardano/AllianceScripts.kt` |
| Finalization TX | `apps/api/src/main/kotlin/cardano/FinalizationTxSubmitter.kt` |
| Withdraw TX builder | `apps/api/src/main/kotlin/cardano/TxBuilder.kt` (lines 650–770) |
| Alliance CRUD API | `apps/api/src/main/kotlin/routes/AllianceRoutes.kt` |
| Proposal + Voting API | `apps/api/src/main/kotlin/routes/AllianceProposalRoutes.kt` |
| Background poller | `apps/api/src/main/kotlin/BackgroundPoller.kt` |
| Alliance list page | `apps/web/app/alliances/page.tsx` |
| Create alliance page | `apps/web/app/alliances/new/page.tsx` |
| Alliance detail page | `apps/web/app/alliances/[id]/page.tsx` |
| Create proposal page | `apps/web/app/alliances/[id]/proposals/new/page.tsx` |
| Proposal detail + withdraw UI | `apps/web/app/alliances/[id]/proposals/[pid]/page.tsx` |
| Alliance stances panel | `apps/web/components/alliance/AllianceStancesPanel.tsx` |
| DB schema | `apps/api/src/main/resources/db/migration/V18__alliances.sql` |
| DB schema (proposals) | `apps/api/src/main/resources/db/migration/V20__alliance_proposals.sql` |
