-- V3-D: list endpoints ORDER BY / filter helpers

CREATE INDEX IF NOT EXISTS contracts_updated_at_idx ON contracts (updated_at DESC);
CREATE INDEX IF NOT EXISTS disputes_updated_at_idx ON disputes (updated_at DESC);
CREATE INDEX IF NOT EXISTS xrpl_txs_last_checked_at_idx ON xrpl_txs (last_checked_at DESC);
CREATE INDEX IF NOT EXISTS xrpl_txs_account_idx ON xrpl_txs (account);
CREATE INDEX IF NOT EXISTS xrpl_txs_tracking_status_idx ON xrpl_txs (tracking_status);
CREATE INDEX IF NOT EXISTS xrpl_txs_network_idx ON xrpl_txs (network);
