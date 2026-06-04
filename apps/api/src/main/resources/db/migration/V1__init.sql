-- tempo-vote-v2 initial schema
-- Off-chain data only. On-chain data is fetched from Ogmios/Kupo at query time.

CREATE TABLE drep_profiles (
    id         VARCHAR(128) NOT NULL,
    network    VARCHAR(10)  NOT NULL,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, network)
);

CREATE TABLE communities (
    id           UUID         NOT NULL DEFAULT gen_random_uuid(),
    drep_id      VARCHAR(128) NOT NULL,
    network      VARCHAR(10)  NOT NULL,
    is_active    BOOLEAN      NOT NULL DEFAULT FALSE,
    activated_at TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE (drep_id, network)
);

CREATE TABLE internal_polls (
    id           UUID         NOT NULL DEFAULT gen_random_uuid(),
    community_id UUID         NOT NULL REFERENCES communities(id),
    title        VARCHAR(255) NOT NULL,
    abstract     TEXT,
    voting_type  VARCHAR(20)  NOT NULL, -- BASIC | SINGLE_CHOICE | MULTIPLE_CHOICE
    start_epoch  INTEGER      NOT NULL,
    starts_at    TIMESTAMP    NOT NULL,
    ends_at      TIMESTAMP    NOT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE TABLE poll_options (
    id       UUID         NOT NULL DEFAULT gen_random_uuid(),
    poll_id  UUID         NOT NULL REFERENCES internal_polls(id),
    text     VARCHAR(100) NOT NULL,
    "order"  INTEGER      NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE TABLE poll_votes (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    poll_id       UUID         NOT NULL REFERENCES internal_polls(id),
    option_id     UUID         NOT NULL REFERENCES poll_options(id),
    stake_address VARCHAR(128) NOT NULL,
    voting_power  BIGINT       NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    UNIQUE (poll_id, stake_address)
);

CREATE TABLE poll_comments (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    poll_id       UUID         NOT NULL REFERENCES internal_polls(id),
    stake_address VARCHAR(128) NOT NULL,
    content       TEXT         NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);

CREATE TABLE auth_sessions (
    id            UUID         NOT NULL DEFAULT gen_random_uuid(),
    stake_address VARCHAR(128) NOT NULL,
    network       VARCHAR(10)  NOT NULL,
    nonce         VARCHAR(64)  NOT NULL,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    expires_at    TIMESTAMP    NOT NULL,
    PRIMARY KEY (id)
);

CREATE INDEX idx_polls_community ON internal_polls(community_id);
CREATE INDEX idx_votes_poll      ON poll_votes(poll_id);
CREATE INDEX idx_comments_poll   ON poll_comments(poll_id);
CREATE INDEX idx_sessions_stake  ON auth_sessions(stake_address, network);
