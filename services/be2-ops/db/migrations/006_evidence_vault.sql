-- W2: Evidence vault — encryption scheme marker + optional retention deadline

ALTER TABLE evidences ADD COLUMN IF NOT EXISTS encryption_scheme TEXT;
ALTER TABLE evidences ADD COLUMN IF NOT EXISTS retain_until TIMESTAMPTZ;
