-- V8-A: domain notification durable outbox (fan-out -> existing `notifications` + delivery worker)

CREATE TABLE IF NOT EXISTS notification_outbox (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'dispatched', 'dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  processing_started_at TIMESTAMPTZ,
  dispatched_notification_id TEXT
);

CREATE INDEX IF NOT EXISTS notification_outbox_status_created_idx
  ON notification_outbox (status, created_at);
