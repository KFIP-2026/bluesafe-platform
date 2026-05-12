-- V8-C: evidence retention class / legal hold metadata; audit keyset index

ALTER TABLE evidences ADD COLUMN IF NOT EXISTS retention_class TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE evidences DROP CONSTRAINT IF EXISTS evidences_retention_class_check;
ALTER TABLE evidences ADD CONSTRAINT evidences_retention_class_check
  CHECK (retention_class IN ('standard', 'regulated', 'legal_hold'));

ALTER TABLE evidences ADD COLUMN IF NOT EXISTS jurisdiction TEXT;
ALTER TABLE evidences ADD COLUMN IF NOT EXISTS legal_hold_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_audits_created_id ON audits (created_at ASC, id ASC);
