-- Persistent cache of DRep metadata (CIP-119) fetched from anchor URLs (IPFS/https).
-- Avoids re-fetching flaky IPFS gateways on every request and survives API restarts.
-- Populated lazily by resolveDRepMeta() after a successful fetch; re-fetched only when
-- the DRep's anchor_url changes (metadata update).
CREATE TABLE IF NOT EXISTS drep_metadata (
    network     VARCHAR(10) NOT NULL,
    cred_hex    VARCHAR(56) NOT NULL,
    anchor_url  TEXT,
    name        TEXT,
    image_url   TEXT,
    meta_json   TEXT        NOT NULL,
    updated_at  TIMESTAMP   NOT NULL DEFAULT now(),
    PRIMARY KEY (network, cred_hex)
);
