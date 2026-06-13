-- Override column for computed status in idx_governance_proposals.
-- VoteIndexer only stores raw chain data; status is computed from epoch at query time.
-- This column lets a one-time backfill (backfill-enacted admin route) store the real
-- final status for proposals that were enacted before their expiry epoch — otherwise
-- they would be indistinguishable from expired proposals.
ALTER TABLE idx_governance_proposals
    ADD COLUMN IF NOT EXISTS final_status VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_gov_proposals_final_status
    ON idx_governance_proposals (network, final_status)
    WHERE final_status IS NOT NULL;
