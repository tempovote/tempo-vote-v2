-- Add voting_power to drep_votes so BackgroundPoller can persist per-voter stake
-- from Ogmios state queries. Enables voting power display on historical GAs.
ALTER TABLE drep_votes ADD COLUMN IF NOT EXISTS voting_power BIGINT NOT NULL DEFAULT 0;
