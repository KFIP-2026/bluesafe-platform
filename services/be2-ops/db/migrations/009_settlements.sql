-- V5-A: calendar-month settlement rows per contract, driven by ledger-close stream.

CREATE TABLE IF NOT EXISTS settlements (
  id TEXT PRIMARY KEY,
  contract_id TEXT NOT NULL REFERENCES contracts (id) ON DELETE CASCADE,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  status TEXT NOT NULL CHECK (status IN ('collecting', 'accrued', 'confirmed', 'archived')),
  last_ledger_index BIGINT,
  ledger_close_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (contract_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_settlements_contract ON settlements (contract_id);
CREATE INDEX IF NOT EXISTS idx_settlements_period ON settlements (period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements (status);
