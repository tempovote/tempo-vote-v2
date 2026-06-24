ALTER TABLE alliance_proposals
    ADD COLUMN IF NOT EXISTS snapshot_member_count INTEGER DEFAULT NULL;
