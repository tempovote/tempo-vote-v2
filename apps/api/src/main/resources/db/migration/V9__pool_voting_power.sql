-- Add voting_power column to idx_pool_metadata.
-- Populated by BackgroundPoller via Blockfrost GET /pools/{pool_id} every 8 h.
-- Stores the pool's live_stake (lovelace) = governance voting power.
-- NULL until the first Blockfrost poll completes.
ALTER TABLE idx_pool_metadata
    ADD COLUMN IF NOT EXISTS voting_power BIGINT;
