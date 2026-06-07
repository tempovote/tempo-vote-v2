# Kế hoạch: Tính toán Vote Totals chính xác (theo GovTool)

Tài liệu tham chiếu: https://docs.gov.tools/cardano-govtool/faqs/how-governance-action-vote-totals-are-calculated-in-govtool

## Vấn đề với implementation hiện tại

### 3 lỗi sai nghiêm trọng

**1. Sai denominator**

Hiện tại:
```
total = yes + no + abstain
yesPercent = (yes / total) × 100   ← SAI
```

Đúng (theo GovTool):
```
Total Active Stake = activeDRepStake + autoNoConfidenceStake
yesPercent = (yesTotal / Total Active Stake) × 100   ← ĐÚNG
```
Abstain KHÔNG đưa vào mẫu số. Một DRep abstain ≠ "không bỏ phiếu" — họ chủ động thoát ra khỏi phép tính ratification.

**2. Đếm DRep thay vì tính ADA voting power**

Hiện tại `yes: Int = 3` nghĩa là "3 DReps voted yes".  
Đúng ra phải là: "3 DReps voted yes với tổng **150M ADA** delegated power".  
Một DRep có 100M ADA delegation nặng hơn 100.000 lần so với DRep chỉ có 1.000 ADA.

**3. Thiếu Predefined DReps + NoConfidence special case**

| DRep đặc biệt | Tác động |
|---|---|
| **Always Abstain** | Cộng vào Abstain Total, KHÔNG vào denominator |
| **Always No Confidence** | Cộng vào No Total (non-NoConfidence) hoặc Yes Total (NoConfidence action), CÓ trong denominator |

---

## Công thức chính xác (GovTool)

```
# Definitions:
Active DRep Stake     = tổng stake của tất cả DRep đang active (không gồm inactive/retired)
autoNoConfidenceStake = stake delegate tới "always no confidence" predefined DRep
autoAbstainStake      = stake delegate tới "always abstain" predefined DRep

# For non-NoConfidence actions:
yesTotal  = yesVotingPower
noTotal   = noVotingPower + autoNoConfidenceStake
abstainTotal = abstainVotingPower + autoAbstainStake

# For NoConfidence action ONLY:
yesTotal  = yesVotingPower + autoNoConfidenceStake
noTotal   = noVotingPower

# Common:
Total Active Stake = activeDRepStake + autoNoConfidenceStake  (không gồm autoAbstain)
notVotedStake      = Total Active Stake - yesTotal - noTotal

yesPercent      = (yesTotal        / Total Active Stake) × 100
noPercent       = (noTotal         / Total Active Stake) × 100
notVotedPercent = (notVotedStake   / Total Active Stake) × 100
abstainTotal là thông tin riêng, không ảnh hưởng denominator
```

---

## Kiến trúc dữ liệu mới

```
Ogmios governanceProposals   →  votes[ (credentialHash, voteChoice) ]
Ogmios drepStakeDistribution →  map[ credentialHash → lovelace ]
                                + abstainStake (always-abstain predefined)
                                + noConfidenceStake (always-no-confidence predefined)

Backend JOIN:
  for each vote in proposal.votes:
    stake = drepStakeMap[vote.credentialHash] ?: 0
    sum by voteChoice → yesVotingPower, noVotingPower, abstainVotingPower

  totalActiveDRepStake = Σ(all active DRep stakes) + autoNoConfidenceStake
```

---

## Kế hoạch triển khai

### Phase 1 — Backend (Kotlin) · Branch: `feature/vote-power-calculation`

#### 1a. OgmiosStateQueries.kt
Thêm method `getDRepStakeDistribution()`:
```kotlin
suspend fun getDRepStakeDistribution(): JsonElement {
    return queryRaw("queryLedgerState/drepStakeDistribution", buildJsonObject {})
}
```
> Cần probe Ogmios version trước để xác nhận method name.  
> Fallback: parse `stake` field từ `queryLedgerState/delegateRepresentatives`.

#### 1b. GovernanceActionDto.kt
Thay `VoteCounts` (cho DRep) bằng `DRepVoteStats`:
```kotlin
@Serializable
data class DRepVoteStats(
    val yes: Int,
    val no: Int,
    val abstain: Int,
    // Voting power in lovelace
    val yesVotingPower: Long,
    val noVotingPower: Long,
    val abstainVotingPower: Long,
    // Predefined DRep stakes
    val autoAbstainStake: Long,
    val autoNoConfidenceStake: Long,
    // Denominator for ratification calculation
    val totalActiveDRepStake: Long,
)

// SPO và CC vẫn dùng VoteCounts (count-based đủ dùng; CC chỉ ~7 thành viên)
data class GovernanceActionDto(
    ...
    val drepVotes: DRepVoteStats,   // thay VoteCounts
    val spoVotes: VoteCounts,       // giữ nguyên
    val ccVotes: VoteCounts,        // giữ nguyên
)
```

#### 1c. mapOgmiosProposal() + aggregateDRepVotes()
```kotlin
fun aggregateDRepVotes(
    votes: List<JsonObject>,
    drepStakeMap: Map<String, Long>,
    autoAbstainStake: Long,
    autoNoConfidenceStake: Long,
    totalActiveDRepStake: Long,
): DRepVoteStats {
    var yesCount = 0; var noCount = 0; var abstainCount = 0
    var yesPower = 0L; var noPower = 0L; var abstainPower = 0L

    for (vote in votes) {
        val role = vote["issuer"]?.jsonObject?.get("role")?.jsonPrimitive?.content
        if (role != "delegateRepresentative") continue

        val credHash = vote["issuer"]?.jsonObject
            ?.get("credential")?.jsonObject
            ?.get("hash")?.jsonPrimitive?.content ?: continue
        val choice = vote["vote"]?.jsonPrimitive?.content ?: continue
        val stake = drepStakeMap[credHash] ?: 0L

        when (choice) {
            "yes"     -> { yesCount++; yesPower += stake }
            "no"      -> { noCount++;  noPower  += stake }
            "abstain" -> { abstainCount++; abstainPower += stake }
        }
    }

    return DRepVoteStats(
        yes = yesCount, no = noCount, abstain = abstainCount,
        yesVotingPower = yesPower,
        noVotingPower = noPower,
        abstainVotingPower = abstainPower,
        autoAbstainStake = autoAbstainStake,
        autoNoConfidenceStake = autoNoConfidenceStake,
        totalActiveDRepStake = totalActiveDRepStake,
    )
}
```

#### 1d. Cache / BackgroundPoller
- Cache `drepStakeDistribution` cùng TTL với `govActions` (5 phút)
- Refresh khi BackgroundPoller chạy: fetch proposals + stake distribution song song

---

### Phase 2 — API Contract (packages/types)

```typescript
// Thay VoteCountsSchema cho drepVotes:
export const DRepVoteStatsSchema = z.object({
  yes: z.number().int(),
  no: z.number().int(),
  abstain: z.number().int(),
  yesVotingPower: z.number(),
  noVotingPower: z.number(),
  abstainVotingPower: z.number(),
  autoAbstainStake: z.number(),
  autoNoConfidenceStake: z.number(),
  totalActiveDRepStake: z.number(),
})

export const GovernanceActionSchema = z.object({
  ...
  drepVotes: DRepVoteStatsSchema,  // thay VoteCountsSchema
  spoVotes: VoteCountsSchema,
  ccVotes: VoteCountsSchema,
})

export type DRepVoteStats = z.infer<typeof DRepVoteStatsSchema>
```

---

### Phase 3 — Frontend (apps/web)

#### 3a. lib/governance.ts — hàm tính phần trăm mới
```typescript
export function computeDRepVotePercent(
  votes: DRepVoteStats,
  actionType: string
): { yesPercent: number; noPercent: number; notVotedPercent: number } {
  const isNoConfidence = actionType === "noConfidence"

  const yesTotal = isNoConfidence
    ? votes.yesVotingPower + votes.autoNoConfidenceStake
    : votes.yesVotingPower

  const noTotal = isNoConfidence
    ? votes.noVotingPower
    : votes.noVotingPower + votes.autoNoConfidenceStake

  const total = votes.totalActiveDRepStake
  if (total === 0) return { yesPercent: 0, noPercent: 0, notVotedPercent: 100 }

  const yesPercent = Math.round((yesTotal / total) * 100)
  const noPercent  = Math.round((noTotal  / total) * 100)
  return { yesPercent, noPercent, notVotedPercent: 100 - yesPercent - noPercent }
}
```

#### 3b. VoteResultsPanel.tsx — Vote bar mới
Vote bar 3 segments: YES (xanh) | NO (đỏ) | Not Voted (xám)
```
|████ YES ████|██ NO ██|░░░░ Not Voted ░░░░|
     45%          20%           35%
```
Hiển thị ADA amounts:
```
45% · 150M ₳ Yes  ·  20% · 65M ₳ No  ·  35% chưa bỏ phiếu
```
Abstain hiển thị riêng bên dưới (thông tin, không ảnh hưởng bar):
```
Abstain: 12M ₳ (bao gồm 8M ₳ auto-abstain)
```

---

## Rủi ro & điểm cần xác minh

| Rủi ro | Cách xử lý |
|---|---|
| Ogmios version không có `drepStakeDistribution` | Probe trước; fallback parse `stake` từ `delegateRepresentatives` |
| `delegateRepresentatives` không trả về `stake` | Dùng count-based với denominator đúng như interim solution |
| SPO voting power (pool_stat) Ogmios không có | Giữ count-based cho SPO trong Phase 1 |
| JOIN tốn CPU khi có nhiều DReps + proposals | Ổn vì đã cache; O(votes × DReps) nhỏ so với 5-phút TTL |

---

## Status

- [ ] Phase 1a — getDRepStakeDistribution()
- [ ] Phase 1b — DRepVoteStats data class
- [ ] Phase 1c — mapOgmiosProposal() JOIN với stake
- [ ] Phase 1d — Cache update
- [ ] Phase 2 — packages/types schema
- [ ] Phase 3a — computeDRepVotePercent()
- [ ] Phase 3b — VoteResultsPanel vote bar
