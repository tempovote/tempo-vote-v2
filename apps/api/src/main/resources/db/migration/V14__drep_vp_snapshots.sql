-- Epoch-level voting power snapshots for DReps.
-- BackgroundPoller writes one row per DRep per epoch after each Ogmios poll.
-- Queried to compute VP delta between the two most recent epochs.
CREATE TABLE IF NOT EXISTS drep_vp_snapshots (
    network      VARCHAR(16)  NOT NULL,
    cred_hex     VARCHAR(64)  NOT NULL,
    epoch        INT          NOT NULL,
    voting_power BIGINT       NOT NULL DEFAULT 0,
    recorded_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (network, cred_hex, epoch)
);

CREATE INDEX IF NOT EXISTS idx_drep_vp_snapshots_net_epoch
    ON drep_vp_snapshots (network, epoch);
