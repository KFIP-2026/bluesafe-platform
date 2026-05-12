-- V3-C: idempotent XRPL stream ingestion (subscribe worker)

CREATE TABLE IF NOT EXISTS xrpl_ingestion_events (
  id TEXT PRIMARY KEY,
  ledger_index BIGINT NOT NULL,
  tx_hash TEXT NOT NULL,
  event_source TEXT NOT NULL,
  engine_result TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (ledger_index, tx_hash, event_source)
);

CREATE INDEX IF NOT EXISTS xrpl_ingestion_tx_hash_idx ON xrpl_ingestion_events (tx_hash);
