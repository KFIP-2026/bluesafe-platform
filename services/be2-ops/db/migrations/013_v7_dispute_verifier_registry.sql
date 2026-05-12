-- V7-D: persisted verifier registry (distinct from per-dispute votes)

CREATE TABLE IF NOT EXISTS dispute_verifier_registry (
  id TEXT PRIMARY KEY,
  verifier_id TEXT NOT NULL UNIQUE,
  display_label TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dispute_verifier_registry_active ON dispute_verifier_registry (active);
