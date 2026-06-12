-- Extend indexer_checkpoint.network to support milestone keys like "mainnet_conway_genesis"
ALTER TABLE indexer_checkpoint ALTER COLUMN network TYPE VARCHAR(30);
