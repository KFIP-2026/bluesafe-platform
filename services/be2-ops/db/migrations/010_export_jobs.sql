-- V6: async audit NDJSON export jobs (operator).

CREATE TABLE IF NOT EXISTS export_jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('audits_ndjson')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  filter_json JSONB NOT NULL,
  max_export INTEGER NOT NULL CHECK (max_export >= 1 AND max_export <= 100000),
  result_ndjson TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs (status, created_at);
