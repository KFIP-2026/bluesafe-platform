-- V7-A: persist XRPL EscrowCreate / EscrowFinish / EscrowCancel protocol fields on tracked txs
-- (Owner, Destination, OfferSequence, submitter Account) — see docs/adr/0005-v7-escrow-xrpl-tx-mapping.md

ALTER TABLE xrpl_txs
  ADD COLUMN IF NOT EXISTS escrow_owner TEXT,
  ADD COLUMN IF NOT EXISTS escrow_destination TEXT,
  ADD COLUMN IF NOT EXISTS escrow_offer_sequence BIGINT,
  ADD COLUMN IF NOT EXISTS escrow_submitter_account TEXT;

CREATE INDEX IF NOT EXISTS xrpl_txs_escrow_owner_idx ON xrpl_txs (escrow_owner)
  WHERE escrow_owner IS NOT NULL;
