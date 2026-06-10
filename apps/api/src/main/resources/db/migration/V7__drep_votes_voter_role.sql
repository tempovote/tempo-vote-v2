-- V7: Improve drep_votes schema based on v1 learnings
--
-- 1. Add voter_role column to distinguish DRep / CC / SPO votes
-- 2. Add anchor_hash for CIP-100 integrity (from Ogmios anchor.hash)
-- 3. Add performance indexes on common query patterns

ALTER TABLE drep_votes
    ADD COLUMN IF NOT EXISTS voter_role VARCHAR(8) NOT NULL DEFAULT 'drep',
    ADD COLUMN IF NOT EXISTS anchor_hash TEXT;

-- Backfill existing rows — all were indexed as DRep before voter_role was added
-- (VoteIndexer already stored CC/SPO with role mapping — update is a no-op for new rows)
UPDATE drep_votes SET voter_role = 'drep' WHERE voter_role = 'drep';

-- Index: proposal votes (vote counting per GA)
CREATE INDEX IF NOT EXISTS idx_drep_votes_proposal
    ON drep_votes (network, proposal_tx_hash, proposal_index);

-- Index: voter vote history (DRep profile page)
CREATE INDEX IF NOT EXISTS idx_drep_votes_voter
    ON drep_votes (network, drep_credential_hex);

-- Index: voter role + proposal (filter DRep-only / CC-only votes)
CREATE INDEX IF NOT EXISTS idx_drep_votes_role_proposal
    ON drep_votes (network, voter_role, proposal_tx_hash, proposal_index);

-- Index: delegation table — latest delegation per stake credential
CREATE INDEX IF NOT EXISTS idx_delegation_vote_stake_slot
    ON idx_delegation_vote (network, drep_type, stake_credential_hex, slot DESC);
