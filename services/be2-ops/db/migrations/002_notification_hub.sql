-- V3-B: notification queue, retries, DLQ marker

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dead_letter BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS notifications_due_idx
  ON notifications (created_at)
  WHERE dead_letter = FALSE AND (status = 'queued' OR status = 'retry_scheduled');
