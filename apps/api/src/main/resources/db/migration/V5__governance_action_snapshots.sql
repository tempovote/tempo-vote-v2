-- Snapshot of every governance action ever seen by BackgroundPoller.
-- Proposals that disappear from Ogmios ledger state are marked with their final
-- status (expired / enacted / dropped) so the UI can show a complete history.
CREATE TABLE IF NOT EXISTS governance_action_snapshots (
    tx_hash       VARCHAR(64)  NOT NULL,
    index         INTEGER      NOT NULL,
    network       VARCHAR(10)  NOT NULL,
    expires_epoch INTEGER      NOT NULL,
    status        VARCHAR(32)  NOT NULL DEFAULT 'active',
    -- Full GovernanceActionDto as JSON — vote snapshot at time of last poll
    snapshot_json TEXT         NOT NULL,
    first_seen_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    last_seen_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (tx_hash, index, network)
);

CREATE INDEX IF NOT EXISTS idx_ga_snap_network_status ON governance_action_snapshots(network, status);
