-- Vote index: on-chain DRep governance votes extracted via chain-sync.
-- Each row = one DRep vote on one governance action, keyed by credential_hex.
CREATE TABLE IF NOT EXISTS drep_votes (
    id                  BIGSERIAL PRIMARY KEY,
    network             VARCHAR(10)  NOT NULL,
    drep_credential_hex VARCHAR(56)  NOT NULL,
    tx_hash             VARCHAR(64)  NOT NULL,
    proposal_tx_hash    VARCHAR(64)  NOT NULL,
    proposal_index      INTEGER      NOT NULL,
    vote                VARCHAR(10)  NOT NULL,
    epoch               INTEGER      NOT NULL,
    slot                BIGINT       NOT NULL,
    action_type         VARCHAR(64),
    anchor_url          TEXT,
    expires_epoch       INTEGER,
    CONSTRAINT uq_drep_vote UNIQUE (network, drep_credential_hex, proposal_tx_hash, proposal_index)
);
CREATE INDEX IF NOT EXISTS idx_drep_votes_lookup
    ON drep_votes (network, drep_credential_hex);

-- Chain-sync checkpoint: last successfully processed slot per network.
-- Allows the indexer to resume after restart without rescanning from genesis.
CREATE TABLE IF NOT EXISTS indexer_checkpoint (
    network     VARCHAR(10)  PRIMARY KEY,
    slot        BIGINT       NOT NULL,
    block_hash  VARCHAR(64)  NOT NULL,
    updated_at  TIMESTAMP    NOT NULL DEFAULT now()
);
