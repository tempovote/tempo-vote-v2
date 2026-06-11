-- Delegator stake snapshot per DRep, indexed by BackgroundPoller via Blockfrost.
-- Stores every delegator's active stake so whale counts can be computed locally
-- without per-request Koios/Blockfrost calls.
-- whale = delegator with amount > 1_000_000_000_000 lovelace (1M ADA).
CREATE TABLE IF NOT EXISTS drep_delegator_stakes (
    network              VARCHAR(10)   NOT NULL,
    drep_credential_hex  VARCHAR(56)   NOT NULL,
    stake_address        VARCHAR(128)  NOT NULL,
    amount               BIGINT        NOT NULL,
    fetched_at           TIMESTAMP     NOT NULL DEFAULT NOW(),
    PRIMARY KEY (network, drep_credential_hex, stake_address)
);

-- Supports GROUP BY + COUNT(*) WHERE amount > threshold (whale-leaders query)
CREATE INDEX IF NOT EXISTS idx_drep_del_stakes_amount
    ON drep_delegator_stakes (network, drep_credential_hex, amount DESC);
