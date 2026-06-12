# GAs thiếu metadata (cần insert thủ công)

3 governance actions không thể fetch title/abstract tự động.
Sau khi có data, chạy SQL bên dưới để insert vào DB.

---

## GA 1 — Treasury Withdrawals (Epoch 409)

| Field | Value |
|-------|-------|
| tx_hash | `4b10e5793208cb8f228756e02113227c91602248eac4d992681a0ee760b6c4e2` |
| index | 0 |
| action_type | `treasuryWithdrawals` |
| anchor_url | `https://raw.githubusercontent.com/theeldermillenial/2025-liquidity-budget/refs/heads/master/withdrawal-1/data.jsonld` |
| submitted_epoch | 409 |
| expires_epoch | 415 |
| lý do fail | HTTP 404 — GitHub repo có thể đã đổi tên branch hoặc xóa file |

**Gợi ý**: Tìm trên GovTool / CardanoScan bằng tx hash, hoặc liên hệ tác giả `@theeldermillenial`.

---

## GA 2 — Info Action (Epoch 392)

| Field | Value |
|-------|-------|
| tx_hash | `a36eafaea085b77f97cceacf07fe9450f8c6b47fec3af94da8f7d158a1fc9722` |
| index | 0 |
| action_type | `information` |
| anchor_url | `https://ipfs.io/ipfs/QmeMvA4j38n46hye724etsdUoUMzQ3T9bvmHMJUtNRf9ps` |
| IPFS CID | `QmeMvA4j38n46hye724etsdUoUMzQ3T9bvmHMJUtNRf9ps` |
| submitted_epoch | 392 |
| expires_epoch | 398 |
| lý do fail | IPFS timeout — content có thể đã bị unpin |

**Gợi ý**: Thử `https://most-brass-sun.quicknode-ipfs.com/ipfs/QmeMvA4j38n46hye724etsdUoUMzQ3T9bvmHMJUtNRf9ps`
hoặc tìm trên GovTool: `https://gov.tools/governance_actions/a36eafaea085b77f97cceacf07fe9450f8c6b47fec3af94da8f7d158a1fc9722#0`

---

## GA 3 — Protocol Parameter Update (Epoch 321)

| Field | Value |
|-------|-------|
| tx_hash | `51f495aa23f4b3b3aa90afde4a0e67823bb7ac4ac65f5ffbb138373b863f2f74` |
| index | 0 |
| action_type | `protocolParametersUpdate` |
| anchor_url | `https://raw.githubusercontent.com/IntersectMBO/governance-actions/refs/heads/main/mainnet/2024-10-21-ppu/metadata.jsonld` |
| submitted_epoch | 321 |
| expires_epoch | 327 |
| lý do fail | HTTP 404 — file đã bị xóa khỏi IntersectMBO/governance-actions repo |

**Gợi ý**: Tìm trên `https://github.com/IntersectMBO/governance-actions/commits/main/mainnet/2024-10-21-ppu/`
(xem git history), hoặc tìm cached version trên web archive.

---

## SQL để insert thủ công (sau khi có data)

Chỉnh `title` và `abstract` cho từng GA rồi chạy:

```sql
-- GA 1: Treasury Withdrawals
UPDATE idx_governance_proposals
SET title    = 'ĐIỀN_TITLE_VÀO_ĐÂY',
    abstract = 'ĐIỀN_ABSTRACT_VÀO_ĐÂY'  -- có thể để NULL nếu không có
WHERE network  = 'mainnet'
  AND tx_hash  = '4b10e5793208cb8f228756e02113227c91602248eac4d992681a0ee760b6c4e2'
  AND index    = 0;

-- GA 2: Info Action
UPDATE idx_governance_proposals
SET title    = 'ĐIỀN_TITLE_VÀO_ĐÂY',
    abstract = 'ĐIỀN_ABSTRACT_VÀO_ĐÂY'
WHERE network  = 'mainnet'
  AND tx_hash  = 'a36eafaea085b77f97cceacf07fe9450f8c6b47fec3af94da8f7d158a1fc9722'
  AND index    = 0;

-- GA 3: Protocol Parameter Update
UPDATE idx_governance_proposals
SET title    = 'ĐIỀN_TITLE_VÀO_ĐÂY',
    abstract = 'ĐIỀN_ABSTRACT_VÀO_ĐÂY'
WHERE network  = 'mainnet'
  AND tx_hash  = '51f495aa23f4b3b3aa90afde4a0e67823bb7ac4ac65f5ffbb138373b863f2f74'
  AND index    = 0;
```
