-- Add resolved metadata fields to governance proposals index.
-- Data is backfilled separately via scripts/apply_ga_metadata.py (Phase 2).
ALTER TABLE idx_governance_proposals
    ADD COLUMN IF NOT EXISTS title    TEXT,
    ADD COLUMN IF NOT EXISTS abstract TEXT;
