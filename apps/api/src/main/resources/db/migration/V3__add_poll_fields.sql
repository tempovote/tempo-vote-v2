ALTER TABLE internal_polls ADD COLUMN IF NOT EXISTS motivation     TEXT;
ALTER TABLE internal_polls ADD COLUMN IF NOT EXISTS image_url     TEXT;
ALTER TABLE internal_polls ADD COLUMN IF NOT EXISTS support_links TEXT;
ALTER TABLE internal_polls ADD COLUMN IF NOT EXISTS rationale     TEXT;
