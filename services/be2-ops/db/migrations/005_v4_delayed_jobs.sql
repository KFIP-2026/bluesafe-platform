-- V4-B: persisted delayed work queue (xrpl_tx_policy probes, future schedulers)

CREATE TABLE IF NOT EXISTS delayed_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_after TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 8,
  locked_until TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS delayed_jobs_kind_run_after_idx ON delayed_jobs (kind, run_after);
