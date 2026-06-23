# Alliance Feature — Implementation Plan

> **Status:** Phase 1 ✅ DONE — Phase 2 ✅ DONE — Phase 3 ✅ DONE  
> **Nguồn:** [Catalyst Fund 13 — Tempo Multi-party Alliance](https://projectcatalyst.io/funds/13/cardano-use-cases-concept/tempo-multi-party-alliance)  
> **Last updated:** 2026-06-19  
> **Treasury approach:** Pure Plutus SC — không dùng native multisig

---

## 1. Tổng quan

Alliance là nhóm liên minh giữa các DRep có cùng giá trị quản trị, giúp tổng hợp voting power và đạt đồng thuận nội bộ trước khi vote on-chain. Mỗi Alliance có một Treasury là smart contract trên Cardano để nhận đóng góp và phân bổ quỹ thông qua cơ chế biểu quyết.

### Ràng buộc đã xác nhận
- Chỉ DRep đã đăng ký on-chain mới được join
- Mỗi DRep chỉ được join **1** Alliance (unique constraint)
- **Self-join only** — không có invite system
- Treasury là Plutus Smart Contract
- Ai cũng có thể contribute ADA vào Treasury
- Chỉ thành viên Alliance mới tạo được withdrawal proposal
- Chống sybil: membership-gated + weighted by delegated ADA
- **Vote approval on Treasury proposal được ghi on-chain** (Tx metadata) — immutable audit trail
- Chống whale: dual threshold + VP cap + time lock (xem mục 3)

---

## 2. Data Model

### 2.1 DB Tables (next migration: V18)

```sql
-- Alliance entity
CREATE TABLE alliances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    description     TEXT,
    charter         TEXT,                   -- markdown, governance rules
    tags            TEXT[] DEFAULT '{}',    -- focus areas: fiscal, tech, social...
    creator_drep_id VARCHAR(128) NOT NULL,
    network         VARCHAR(10)  NOT NULL,  -- preprod | mainnet
    -- Treasury (filled after SC deployment)
    treasury_address     TEXT,
    treasury_script_hash VARCHAR(64),
    -- Anti-whale & governance parameters (configurable per charter)
    approval_threshold_vp    INTEGER DEFAULT 60,   -- % VP YES / voted VP
    approval_threshold_count INTEGER DEFAULT 50,   -- % headcount YES / voted count
    quorum_threshold         INTEGER DEFAULT 30,   -- % total VP must participate
    vp_cap_pct               INTEGER DEFAULT 20,   -- max % VP per single voter
    timelock_hours           INTEGER DEFAULT 48,   -- hours after approved before execute
    max_withdrawal_pct       INTEGER DEFAULT 30,   -- max % treasury per proposal
    proposal_duration_days   INTEGER DEFAULT 7,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(name, network)
);

-- Alliance membership (DRep only, 1 DRep = 1 Alliance)
CREATE TABLE alliance_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alliance_id     UUID NOT NULL REFERENCES alliances(id),
    drep_id         VARCHAR(128) NOT NULL,
    stake_address   VARCHAR(128) NOT NULL,
    network         VARCHAR(10)  NOT NULL,
    role            VARCHAR(20)  NOT NULL DEFAULT 'member', -- owner | admin | member
    joined_at       TIMESTAMP DEFAULT NOW(),
    UNIQUE(drep_id, network)   -- 1 DRep chỉ join 1 Alliance
);

-- Alliance proposals — gộp 2 loại: withdrawal + ga_stance
CREATE TABLE alliance_proposals (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alliance_id      UUID NOT NULL REFERENCES alliances(id),
    proposer_drep_id VARCHAR(128) NOT NULL,
    proposal_type    VARCHAR(20) NOT NULL DEFAULT 'withdrawal',
    -- 'withdrawal' | 'ga_stance'
    title            VARCHAR(255) NOT NULL,
    description      TEXT,                    -- markdown

    -- Chỉ dùng cho proposal_type = 'withdrawal'
    amount_lovelace  BIGINT,
    recipient_address TEXT,
    recipient_label  TEXT,
    approved_at      TIMESTAMP,
    executable_at    TIMESTAMP,               -- approved_at + timelock_hours
    finalization_tx_hash VARCHAR(64),         -- on-chain Finalization TX (mục 3.4)
    executed_tx_hash     VARCHAR(64),

    -- Chỉ dùng cho proposal_type = 'ga_stance'
    gov_action_tx_hash VARCHAR(64),
    gov_action_index   INTEGER,

    -- Chung
    status           VARCHAR(20) NOT NULL DEFAULT 'voting',
    -- withdrawal: voting | approved_pending | approved | rejected | executed | cancelled
    -- ga_stance:  voting | passed | failed | cancelled
    voting_ends_at   TIMESTAMP NOT NULL,
    created_at       TIMESTAMP DEFAULT NOW()
);

-- Votes on withdrawal proposals
CREATE TABLE alliance_proposal_votes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id     UUID NOT NULL REFERENCES alliance_proposals(id),
    drep_id         VARCHAR(128) NOT NULL,
    stake_address   VARCHAR(128) NOT NULL,
    vote            VARCHAR(10) NOT NULL,   -- YES | NO | ABSTAIN
    voting_power    BIGINT NOT NULL DEFAULT 0, -- delegated ADA in lovelace at snapshot
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(proposal_id, drep_id)
);
```

### 2.2 Kotlin Exposed Tables (Tables.kt)

4 object mới: `Alliances`, `AllianceMembers`, `AllianceProposals`, `AllianceProposalVotes`.

---

## 3. Anti-Sybil, Anti-Whale & Voting Mechanism

### 3.1 Chống Sybil
| Layer | Biện pháp |
|-------|-----------|
| Membership | Chỉ DRep đã đăng ký on-chain (verified qua Ogmios real-time) |
| 1 DRep = 1 Alliance | DB unique constraint `(drep_id, network)` + check khi join |
| Voting weight | Weighted bởi **delegated ADA** — cần ADA delegation thật để có VP |
| On-chain audit | Vote approval ghi vào Tx metadata, immutable |

### 3.2 Chống Whale (⚠️ quan trọng)

**Vấn đề:** DRep có VP lớn (ví dụ 40% tổng VP của Alliance) có thể đơn phương thông qua mọi withdrawal proposal, thao túng rút quỹ về địa chỉ mình kiểm soát.

**Giải pháp: Triple-guard mechanism**

#### Guard 1 — Dual Threshold (VP + Headcount)
Proposal chỉ được APPROVED khi ĐẠT CẢ HAI điều kiện:

```
Điều kiện 1 (Voting Power):
  yes_vp / voted_vp >= approval_threshold_vp   (mặc định 60%)

Điều kiện 2 (Headcount — 1 DRep = 1 phiếu, bất kể VP):
  yes_count / voted_count >= approval_threshold_count  (mặc định 50%)
```

→ DRep whale không thể một mình thông qua nếu đa số member phản đối.

#### Guard 2 — VP Cap per Voter
Khi tính tỉ lệ VP, mỗi member được tính tối đa `vp_cap_pct`% tổng VP của Alliance (mặc định 20%).

```
effective_vp(member) = min(actual_vp, total_alliance_vp * 0.20)
```

→ DRep có 40% VP thực sẽ chỉ tính 20% trong phiếu bầu.  
→ Tham số `vp_cap_pct` configurable trong Alliance charter (owner có thể chỉnh).

#### Guard 3 — Time Lock sau khi Approved
Sau khi proposal đạt threshold:
- Status → `approved_pending` (chưa được execute ngay)
- Chờ `timelock_hours` (mặc định 48h) trước khi execution được phép
- Trong thời gian này: bất kỳ thành viên nào có thể raise flag (off-chain: comment/Discord)
- Sau 48h → status → `approved`, owner/admin có thể execute

→ Cộng đồng có thời gian phản ứng với gian lận tiềm ẩn.

#### Guard 4 — Withdrawal Cap per Proposal
Mỗi proposal không được rút quá `max_withdrawal_pct`% tổng số dư treasury (mặc định 30%).

```
max_amount = treasury_balance * max_withdrawal_pct / 100
```

→ Tránh "rút một lần sạch kho".  
→ Configurable trong charter, không thể vượt 50%.

### 3.3 Bảng tham số mặc định (configurable trong charter)

| Tham số | Mặc định | Giải thích |
|---------|---------|-----------|
| `approval_threshold_vp` | 60% | % VP YES / tổng VP đã vote |
| `approval_threshold_count` | 50% | % member-count YES / tổng member đã vote |
| `quorum_threshold` | 30% | % VP của toàn Alliance phải tham gia vote |
| `vp_cap_pct` | 20% | VP tối đa của 1 member được tính (% tổng VP) |
| `timelock_hours` | 48 | Giờ chờ sau approved trước khi execute |
| `max_withdrawal_pct` | 30 | % tối đa treasury có thể rút trong 1 proposal |
| `proposal_duration_days` | 7 | Thời gian voting mở |

### 3.4 On-chain Vote Recording (Finalization TX)

Khi một withdrawal proposal được finalized (approved hoặc rejected), backend tự động submit **Finalization TX**:

```
Finalization TX:
  Input:   service wallet UTXOs (trả phí)
  Output:  "Proposal Registry" address (parameterized by alliance_id)
           inline datum: ProposalResult {
             alliance_id:  ByteArray  -- 16-byte UUID
             proposal_id:  ByteArray
             result:       "approved" | "rejected"
             amount:       Int        -- lovelace (chỉ khi approved)
             recipient:    Address    -- (chỉ khi approved)
             finalized_at: Int        -- POSIX ms
             yes_vp:       Int
             no_vp:        Int
             yes_count:    Int
             no_count:     Int
           }
           value: minADA
  Metadata (674): bản JSON human-readable (off-chain readability)
```

**Lưu ý kỹ thuật:** Plutus validator KHÔNG đọc được TX metadata — chỉ đọc được datum/value của UTXOs. Do đó kết quả phải nằm trong **inline datum** của output trên. Metadata label 674 đi kèm chỉ dùng cho off-chain explorer/audit.

**Ai submit Finalization TX?**
- Backend tự động submit khi `voting_ends_at` qua + tally hoàn tất
- Nếu backend tạm thời down: bất kỳ member nào có thể trigger qua `POST /alliances/:id/proposals/:pid/finalize`
- Backend cần **service wallet** nhỏ (giữ ~5 ADA để trả phí) — seed phrase lưu trong env var

→ Immutable, public, verifiable bởi bất kỳ ai  
→ Treasury Plutus validator dùng UTXO này làm **reference input** để unlock funds

---

## 4. Treasury Smart Contract (Pure Plutus)

**Quyết định:** Bỏ hoàn toàn native multisig. Treasury là **Plutus validator** từ đầu.

**Lý do:**
- Native multisig bị block nếu 1 admin mất key / offline → funds bị đóng băng
- Admin set thay đổi → treasury address thay đổi → phải migrate funds (phức tạp, rủi ro)
- Plutus: không cần chữ ký của ai — chỉ cần điều kiện on-chain thỏa mãn

### 4.1 Trust Model

| | Ai có thể làm gì? |
|---|---|
| Backend | Submit Finalization TX (xác nhận kết quả vote) — nhưng **không thể** thay đổi amount hay recipient |
| Member | Trigger finalization nếu backend down; cast vote |
| Bất kỳ ai | Contribute ADA vào treasury |
| Không ai | Rút funds nếu điều kiện validator không thỏa |

→ Backend có thể từ chối finalize (DOS) nhưng **không thể ăn cắp**. Amount + recipient đã cố định trong proposal datum từ lúc tạo.

### 4.2 Script Architecture

```
treasury_validator(alliance_id: ByteArray)   -- parameterized, compile 1 lần / alliance
proposal_registry(alliance_id: ByteArray)    -- nơi lưu Finalization TX output
```

Treasury address = `hash(treasury_validator(alliance_id))` — **bất biến**, không phụ thuộc admin set.

### 4.3 Validator Logic (Aiken v3 pseudocode)

```aiken
validator treasury(alliance_id: ByteArray) {
  spend(datum: TreasuryDatum, redeemer: ExecuteRedeemer, tx: Transaction) {
    // 1. Tìm reference input = Finalization UTXO của proposal này
    let fin_utxo = find_ref_input_by_proposal_id(
      tx.reference_inputs,
      redeemer.proposal_id
    )
    let fin: ProposalResult = fin_utxo.inline_datum

    and {
      // 2. Alliance khớp
      fin.alliance_id == alliance_id,

      // 3. Proposal khớp
      fin.proposal_id == redeemer.proposal_id,

      // 4. Đã approved
      fin.result == "approved",

      // 5. Amount không vượt approved
      redeemer.amount <= fin.amount,

      // 6. Recipient đúng
      redeemer.recipient == fin.recipient,

      // 7. Timelock đã qua
      fin.finalized_at + datum.timelock_ms <= tx.validity_range.lower_bound,

      // 8. Output đến recipient đúng amount
      output_to(tx.outputs, redeemer.recipient, redeemer.amount),

      // 9. Phần còn lại về treasury
      change_to_treasury(tx.outputs, self_address),
    }
  }
}
```

### 4.4 Contribution Flow

```
Bất kỳ ai → send ADA → treasury_address (Plutus script address)
  datum: TreasuryDatum { alliance_id, timelock_ms }
```

### 4.5 Withdrawal Flow (Pure Plutus)

```
1. Member tạo proposal (amount, recipient, description) — lưu vào DB
2. Members vote 7 ngày (off-chain votes, stored in DB)
3. Voting ends → backend tính tally (dual threshold + VP cap + quorum)
4. Nếu APPROVED → backend submit Finalization TX (xem 3.4)
   → tạo UTXO tại proposal_registry address với inline datum ProposalResult
   → lưu finalization_tx_hash vào DB
   → proposal status → "approved_pending"
5. Chờ timelock_hours (48h mặc định)
6. Proposal status → "approved"
7. Bất kỳ ai (member/owner) nhấn Execute:
   - FE gọi POST /tx/build { txType: ALLIANCE_WITHDRAW, ... }
   - BE build TX: input Treasury UTXO + reference input Finalization UTXO → output recipient
   - FE: wallet.signTx → POST /tx/submit → lưu executed_tx_hash
```

**Không cần chữ ký của admin** — bất kỳ ai có thể submit execute TX sau khi timelock qua.

### 4.6 Service Wallet

Backend cần 1 service wallet nhỏ để submit Finalization TX (trả phí ~0.2 ADA/TX):
- Seed phrase lưu trong env var `SERVICE_WALLET_MNEMONIC`
- Giữ ~5-10 ADA preprod / mainnet
- Không bao giờ giữ funds lớn — chỉ dùng trả phí

---

## 5. API Routes

### Alliance Core
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/alliances?network=&page=&tag=` | — | List alliances |
| GET | `/alliances/:id` | — | Alliance detail + member count |
| POST | `/alliances` | JWT | Tạo alliance mới |
| PATCH | `/alliances/:id` | JWT (owner) | Cập nhật name/desc/charter |
| POST | `/alliances/:id/join` | JWT | DRep join alliance |
| DELETE | `/alliances/:id/leave` | JWT | Rời alliance |
| GET | `/alliances/:id/members?page=` | — | Danh sách members + voting power |
| PATCH | `/alliances/:id/members/:drepId/role` | JWT (owner/admin) | Đổi role |
| DELETE | `/alliances/:id/members/:drepId` | JWT (owner/admin) | Kick member |

### Proposals (Withdrawal + GA Stance)
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/alliances/:id/proposals?type=withdrawal\|ga_stance` | — | List proposals (filter by type) |
| GET | `/alliances/:id/proposals/:pid` | — | Proposal detail + vote tally |
| POST | `/alliances/:id/proposals` | JWT (member) | Tạo proposal (body chứa `proposalType`) |
| POST | `/alliances/:id/proposals/:pid/vote` | JWT (member) | Vote YES/NO/ABSTAIN |
| POST | `/alliances/:id/proposals/:pid/execute` | JWT (owner/admin) | Mark withdrawal as executed + txHash |
| DELETE | `/alliances/:id/proposals/:pid` | JWT (proposer/owner) | Cancel |
| GET | `/governance-actions/:txHash/:index/alliance-stances` | — | Stances của tất cả alliances về 1 GA |

### Treasury
| Method | Path | Auth | Mô tả |
|--------|------|------|-------|
| GET | `/alliances/:id/treasury` | — | Balance + recent contributions |
| POST | `/alliances/:id/proposals/:pid/finalize` | JWT (member) | Trigger Finalization TX nếu backend chưa submit |
| POST | `/tx/build` (txType: `ALLIANCE_WITHDRAW`) | — | Build withdrawal TX (Plutus unlock, không cần admin sig) |

---

## 6. Frontend Pages

```
/alliances                              → AllianceListPage
/alliances/new                          → CreateAlliancePage
/alliances/[id]                         → AllianceDetailPage
  tabs: Overview | Members | GA Positions | Proposals | Treasury
/alliances/[id]/proposals/new?type=...  → CreateProposalPage (withdrawal hoặc ga_stance)
/alliances/[id]/proposals/[pid]         → ProposalDetailPage
```

### AllianceDetailPage — tabs
- **Overview**: name, charter (markdown rendered), tags, created by, member count, join button
- **Members**: list DReps, voting power, role badge, joined date
- **GA Positions**: list GA stance polls — GA title + Alliance stance chip (YES/NO/ABSTAIN) + tỉ lệ support + link tới GA detail. Filter: active | concluded
- **Proposals**: withdrawal proposals — amount, recipient, status, countdown
- **Treasury**: balance (query treasury_address via Ogmios/Kupo), contribution history, pending executions

### GA Detail Page — Alliance Stances section
Thêm section mới dưới Vote Results trên `/governance-actions/[txHash]/[index]`:

```
Alliance Stances
┌─────────────────────────────────────────────────────┐
│ 🤝 DeFi Alliance           [YES]  12/15 members     │
│ 🔬 Tech Research Alliance  [NO]    5/8 members      │
│ 🌏 SEA DRep Alliance    [ABSTAIN]  3/6 members      │
└─────────────────────────────────────────────────────┘
```

Mỗi row: click → link tới trang proposal trong Alliance đó.

---

## 7. Phân kỳ Thực hiện

### Phase 1 — Alliance Core ✅ DONE
- [x] DB migration V18 (`alliances`, `alliance_members`) + V19 (`logo_url` column)
- [x] API: CRUD alliance + join/leave + list members
- [x] FE: `/alliances` list, `/alliances/new`, `/alliances/[id]` (Overview + Members tabs)
- [x] Validate DRep registration khi join (query Ogmios)
- [x] i18n: EN + VI + JA
- [x] Charter field: RationaleEditor (full markdown toolbar, Edit/Split/Preview)
- [x] Create Alliance page: layout chuẩn (breadcrumb, card-static, max-w-2xl)
- [x] Navbar: Alliance → Others dropdown
- [x] Members tab: DRep avatar + name từ `drep_metadata` (join by credHex)
- [x] Overview creator: date · avatar + name thay vì raw drepId
- [x] Markdown preview: fix numbered/bullet list styles (Tailwind reset override)

### Phase 2 — Proposals: Withdrawal + GA Stance ✅ DONE
- [x] DB migration V20 (`alliance_proposals`, `alliance_proposal_votes`)
- [x] API: proposal CRUD + vote endpoint + tally calculation (dual threshold + VP cap)
- [x] API: `GET /governance-actions/:txHash/:index/alliance-stances`
- [x] Cron job: auto-close expired proposals + tính kết quả (BackgroundPoller hook)
- [x] FE: "GA Positions" tab + "Proposals" tab trên AllianceDetailPage
- [x] FE: `/alliances/[id]/proposals/new` — form chọn type (withdrawal / ga_stance)
  - ga_stance: search + select GA từ danh sách active
  - withdrawal: nhập amount + recipient + description
- [x] FE: ProposalDetailPage — vote buttons + weighted tally bar + countdown
- [x] FE: GA detail page — "Alliance Stances" section (gọi `/alliance-stances` endpoint)
- [x] Vote tally hiển thị cả VP-weighted lẫn headcount

### Phase 3 — Treasury / Pure Plutus SC ✅ DONE
- [x] Viết Aiken validator: `treasury(alliance_id)` + `proposal_registry(alliance_id)` — compiled scripts lưu trong `AllianceScripts.kt`
- [x] Unit test validator (Aiken built-in test framework)
- [x] Deploy + test trên preprod: contribute, finalize, execute — TX preprod xác nhận thành công
- [x] Service wallet setup: `SERVICE_WALLET_MNEMONIC` env var + `FinalizationTxSubmitter.kt`
- [x] `buildAllianceWithdraw` trong TxBuilder.kt (Plutus unlock: input Treasury + ref Finalization UTXO)
- [x] API: `POST /alliances/:id/proposals/:pid/finalize` (member-trigger fallback)
- [x] Cron/hook: `BackgroundPoller` auto-submit Finalization TX khi voting_ends_at qua + approved; auto-close expired proposals
- [x] FE: Treasury tab (balance + UTxOs + pending executions) + Execute button
- [x] Treasury address được gán tự động từ compiled script hash lúc tạo Alliance (không cần deploy TX riêng)
- [x] `treasury_address` + `treasury_script_hash` lưu vào alliance record ngay khi tạo

---

## 8. Quyết định & Câu hỏi còn lại

| # | Câu hỏi | Quyết định |
|---|---------|-----------|
| 1 | Invite hay self-join? | ✅ **Self-join only** |
| 2 | Vote approval on-chain hay off-chain signatures? | ✅ **On-chain** — Finalization TX metadata (xem 3.4) |
| 3 | Admin set thay đổi → treasury address thay đổi? | ✅ **Pure Plutus SC** — treasury address = `hash(script(alliance_id))`, không phụ thuộc admin set. Không cần admin keys để rút, không bao giờ bị lock do key unavailable |
| 4 | GA consensus poll có trong scope? | ✅ **Có** — Phase 2, reuse proposal infra với `proposal_type = 'ga_stance'` |
| 5 | Alliance discovery / recommendation? | ❌ **Out of scope** |
| 6 | DRep VP lớn thao túng withdrawal | ✅ **Triple-guard:** dual threshold + VP cap 20% + 48h timelock + max 30%/proposal |

### Q4 — GA Consensus Poll ✅ Đã chốt: trong scope (Phase 2)

**Mục đích:** Alliance thống nhất stance nội bộ về một GA on-chain. Kết quả hiển thị trên trang GA detail và Alliance detail để thấy rõ Alliance align với GA như thế nào.

**Điểm khác biệt so với withdrawal proposal:**
- Không có `amount_lovelace` / `recipient_address` / timelock / max_withdrawal_pct
- Vote choices: YES / NO / ABSTAIN (giống on-chain voting)
- Không cần Finalization TX on-chain (stance là thông tin advisory, không unlock funds)
- Có thể mở nhiều GA stance poll cùng lúc (khác withdrawal — thường 1 tại 1 thời điểm)
- Sau khi voting_ends_at → auto-finalize, hiển thị kết quả công khai

**Hiển thị:**
- Trang `/governance-actions/[txHash]/[index]`: section "Alliance Stances" liệt kê tất cả alliances đã có stance + tỉ lệ support
- Trang `/alliances/[id]`: tab "GA Positions" (filter `proposal_type = 'ga_stance'`)
- GA list card: có thể thêm indicator nhỏ nếu nhiều alliance cùng align

---

## 9. Điểm phụ thuộc kỹ thuật

- `OgmiosStateQueries.getDRepInfo()` — verify DRep registration khi join
- `OgmiosStateQueries` / Blockfrost — lấy delegated ADA cho voting power
- `buildPayment()` đã có trong TxBuilder — tham khảo pattern cho Plutus unlock TX
- `InternalPolls` infrastructure — có thể tái dùng pattern cho proposal voting
- Existing JWT auth — reuse cho tất cả write operations
