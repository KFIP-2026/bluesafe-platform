-- V7-C: single settlement financial surface (amount, currency, batch) + period mode metadata

ALTER TABLE settlements
  ADD COLUMN IF NOT EXISTS amount_minor BIGINT,
  ADD COLUMN IF NOT EXISTS currency_code TEXT NOT NULL DEFAULT 'XRP',
  ADD COLUMN IF NOT EXISTS batch_id TEXT,
  ADD COLUMN IF NOT EXISTS period_mode TEXT NOT NULL DEFAULT 'calendar_utc'
    CHECK (period_mode IN ('calendar_utc')),
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_settlements_batch ON settlements (batch_id) WHERE batch_id IS NOT NULL;
