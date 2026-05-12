-- W3: SLA / escalation markers + persisted verifier votes

ALTER TABLE disputes ADD COLUMN IF NOT EXISTS review_deadline_at TIMESTAMPTZ;
ALTER TABLE disputes ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS dispute_verifier_votes (
  id TEXT PRIMARY KEY,
  dispute_id TEXT NOT NULL REFERENCES disputes (id) ON DELETE CASCADE,
  verifier_id TEXT NOT NULL,
  recommendation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dispute_verifier_votes_dispute ON dispute_verifier_votes (dispute_id);
