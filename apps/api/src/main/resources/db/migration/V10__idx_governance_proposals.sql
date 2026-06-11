-- Governance proposals indexed from chain-sync (proposalProcedures in Conway transactions).
-- Each row = one governance action submitted on-chain, keyed by (network, tx_hash, index).
-- Populated by VoteIndexer processing tx.proposals[] in Conway-era blocks.
-- Enables historical GA display for proposals that have already left Ogmios ledger state.
CREATE TABLE IF NOT EXISTS idx_governance_proposals (
    network          VARCHAR(10)  NOT NULL,
    tx_hash          VARCHAR(64)  NOT NULL,   -- tx that submitted the proposal
    index            INTEGER      NOT NULL,   -- position in tx.proposals[] (0-based)
    action_type      VARCHAR(64)  NOT NULL,   -- e.g. treasuryWithdrawals, infoAction
    anchor_url       TEXT,
    anchor_hash      TEXT,
    deposit          BIGINT       NOT NULL DEFAULT 0,
    submitted_slot   BIGINT       NOT NULL,
    submitted_epoch  INTEGER      NOT NULL,
    -- expires_epoch = submitted_epoch + govActionLifetime (protocol param, 6 on mainnet/preprod)
    expires_epoch    INTEGER      NOT NULL,
    -- Raw Ogmios action body JSON (type-specific fields: withdrawals, version, constitution …)
    action_details   TEXT,
    return_address   TEXT,
    PRIMARY KEY (network, tx_hash, index)
);

CREATE INDEX IF NOT EXISTS idx_gov_proposals_expires
    ON idx_governance_proposals (network, expires_epoch DESC);
