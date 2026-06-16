-- Single-row snapshot of the Cardano DApp ranking (TVL/volume/fees) computed from DefiLlama.
-- Refreshed by BackgroundPoller every 2h; served to the FE via GET /dapp-ranking so the browser
-- no longer hits DefiLlama directly (heavy /protocols response + flaky/rate-limited gateway).
CREATE TABLE IF NOT EXISTS cardano_dapp_snapshot (
    id            VARCHAR(16) PRIMARY KEY,   -- always 'cardano'
    snapshot_json TEXT        NOT NULL,
    updated_at    TIMESTAMP   NOT NULL DEFAULT now()
);
