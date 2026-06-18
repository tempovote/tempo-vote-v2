-- Phase 2: Alliance Proposals (withdrawal + ga_stance) + Votes

CREATE TABLE alliance_proposals (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alliance_id      UUID NOT NULL REFERENCES alliances(id) ON DELETE CASCADE,
    proposer_drep_id VARCHAR(128) NOT NULL,
    proposal_type    VARCHAR(20)  NOT NULL DEFAULT 'ga_stance', -- 'withdrawal' | 'ga_stance'
    title            VARCHAR(255) NOT NULL,
    description      TEXT,                    -- markdown

    -- Only for proposal_type = 'withdrawal'
    amount_lovelace  BIGINT,
    recipient_address TEXT,
    recipient_label  TEXT,
    approved_at      TIMESTAMP,
    executable_at    TIMESTAMP,               -- approved_at + timelock_hours
    finalization_tx_hash VARCHAR(64),
    executed_tx_hash     VARCHAR(64),

    -- Only for proposal_type = 'ga_stance'
    gov_action_tx_hash VARCHAR(64),
    gov_action_index   INTEGER,

    -- Common
    status           VARCHAR(30) NOT NULL DEFAULT 'voting',
    -- withdrawal: voting | approved_pending | approved | rejected | executed | cancelled
    -- ga_stance:  voting | passed | failed | cancelled
    voting_ends_at   TIMESTAMP NOT NULL,
    created_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alliance_proposals_alliance ON alliance_proposals(alliance_id);
CREATE INDEX idx_alliance_proposals_status ON alliance_proposals(status);
CREATE INDEX idx_alliance_proposals_ga ON alliance_proposals(gov_action_tx_hash, gov_action_index)
    WHERE gov_action_tx_hash IS NOT NULL;

CREATE TABLE alliance_proposal_votes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id     UUID NOT NULL REFERENCES alliance_proposals(id) ON DELETE CASCADE,
    drep_id         VARCHAR(128) NOT NULL,
    stake_address   VARCHAR(128) NOT NULL,
    vote            VARCHAR(10)  NOT NULL,   -- YES | NO | ABSTAIN
    voting_power    BIGINT NOT NULL DEFAULT 0,
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(proposal_id, drep_id)
);

CREATE INDEX idx_apv_proposal ON alliance_proposal_votes(proposal_id);
