-- Local chain index tables populated by the extended VoteIndexer (chain-sync via Ogmios).
-- These replace external Koios API calls for delegator counts, vote rationales, and pool names.

-- Vote delegation certs: stake credential → DRep (latest wins on conflict).
-- Full history is kept (no update-in-place) so rollbacks can restore prior state.
CREATE TABLE IF NOT EXISTS idx_delegation_vote (
    id                   BIGSERIAL    PRIMARY KEY,
    network              VARCHAR(10)  NOT NULL,
    stake_credential_hex VARCHAR(56)  NOT NULL,
    drep_credential_hex  VARCHAR(56),           -- NULL when drep_type is 'abstain' or 'no_confidence'
    drep_type            VARCHAR(20)  NOT NULL,  -- 'key' | 'script' | 'abstain' | 'no_confidence'
    tx_hash              VARCHAR(64)  NOT NULL,
    slot                 BIGINT       NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_delg_vote_lookup
    ON idx_delegation_vote (network, drep_credential_hex, slot DESC);
CREATE INDEX IF NOT EXISTS idx_delg_vote_stake
    ON idx_delegation_vote (network, stake_credential_hex, slot DESC);
CREATE INDEX IF NOT EXISTS idx_delg_vote_slot
    ON idx_delegation_vote (network, slot);

-- Pool registration metadata: latest registration per pool.
-- Populated from stakePoolRegistration certificates.
-- Name/ticker require fetching the metadata URL; stored after async fetch.
CREATE TABLE IF NOT EXISTS idx_pool_metadata (
    network        VARCHAR(10)  NOT NULL,
    pool_id_bech32 VARCHAR(64)  NOT NULL,
    pool_id_hex    VARCHAR(56)  NOT NULL,
    metadata_url   TEXT,
    name           TEXT,
    ticker         VARCHAR(16),
    slot           BIGINT       NOT NULL,
    PRIMARY KEY (network, pool_id_hex)
);

CREATE INDEX IF NOT EXISTS idx_pool_meta_slot
    ON idx_pool_metadata (network, slot);

-- Extended indexer checkpoint: add all_votes flag to distinguish extended indexer runs.
-- Existing indexer_checkpoint rows (DRep-only) have all_votes = false.
ALTER TABLE indexer_checkpoint
    ADD COLUMN IF NOT EXISTS all_votes BOOLEAN NOT NULL DEFAULT false;
