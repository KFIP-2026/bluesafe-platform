-- Bluesafe Backend2 persistence (v3-A)

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  landlord_id TEXT NOT NULL,
  status TEXT NOT NULL,
  escrow_create_tx_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS evidences (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
  dispute_id TEXT,
  uploader_id TEXT NOT NULL,
  category TEXT NOT NULL,
  cid TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  version INTEGER NOT NULL,
  is_encrypted BOOLEAN NOT NULL DEFAULT TRUE,
  storage_provider TEXT NOT NULL,
  local_content_hash_seed TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
  raised_by TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence_bundle JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  dispute_id TEXT NOT NULL REFERENCES disputes (id) ON DELETE CASCADE,
  decision TEXT NOT NULL,
  decided_by TEXT NOT NULL,
  memo TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS xrpl_txs (
  tx_hash TEXT PRIMARY KEY,
  id TEXT NOT NULL,
  tx_type TEXT NOT NULL,
  account TEXT,
  dispute_id TEXT,
  network TEXT NOT NULL,
  tracking_status TEXT NOT NULL,
  validated BOOLEAN NOT NULL DEFAULT FALSE,
  ledger_index INTEGER,
  result_code TEXT,
  outcome_class TEXT,
  retries INTEGER NOT NULL DEFAULT 0,
  last_checked_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS audits (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  before_json JSONB,
  after_json JSONB,
  metadata_json JSONB,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS audits_entity_created_idx ON audits (entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS audits_created_at_idx ON audits (created_at);

CREATE TABLE IF NOT EXISTS events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  trace_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS events_entity_idx ON events (entity_type, entity_id);
