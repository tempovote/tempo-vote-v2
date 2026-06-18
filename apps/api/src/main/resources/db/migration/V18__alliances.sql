-- Alliance Core — Phase 1
-- Two tables: alliances + alliance_members

CREATE TABLE alliances (
    id                       UUID         NOT NULL DEFAULT gen_random_uuid(),
    name                     VARCHAR(100) NOT NULL,
    description              TEXT,
    charter                  TEXT,
    tags                     TEXT         NOT NULL DEFAULT '[]',  -- JSON array string
    creator_drep_id          VARCHAR(128) NOT NULL,
    network                  VARCHAR(10)  NOT NULL,
    -- Treasury (filled after SC deployment — Phase 3)
    treasury_address         TEXT,
    treasury_script_hash     VARCHAR(64),
    -- Governance parameters (configurable in charter)
    approval_threshold_vp    INTEGER      NOT NULL DEFAULT 60,
    approval_threshold_count INTEGER      NOT NULL DEFAULT 50,
    quorum_threshold         INTEGER      NOT NULL DEFAULT 30,
    vp_cap_pct               INTEGER      NOT NULL DEFAULT 20,
    timelock_hours           INTEGER      NOT NULL DEFAULT 48,
    max_withdrawal_pct       INTEGER      NOT NULL DEFAULT 30,
    proposal_duration_days   INTEGER      NOT NULL DEFAULT 7,
    created_at               TIMESTAMP    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    UNIQUE (name, network)
);

CREATE TABLE alliance_members (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    alliance_id   UUID         NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
    drep_id       VARCHAR(128) NOT NULL,
    stake_address VARCHAR(128) NOT NULL,
    network       VARCHAR(10)  NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'member',  -- owner | admin | member
    joined_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    UNIQUE (drep_id, network)   -- 1 DRep can only be in 1 Alliance
);

CREATE INDEX idx_alliances_network          ON alliances(network);
CREATE INDEX idx_alliance_members_alliance  ON alliance_members(alliance_id);
CREATE INDEX idx_alliance_members_drep      ON alliance_members(drep_id, network);
