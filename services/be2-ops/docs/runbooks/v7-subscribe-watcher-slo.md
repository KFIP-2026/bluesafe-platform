# Runbook — XRPL subscribe watcher SLO (v7-B)

## Scope

BlueSafe **P0 XRPL State Watcher** uses rippled **`subscribe`** (`ledger` stream, optional `transactions`) plus operator **`account_tx` backfill** (`POST /v1/xrpl/backfill/account-tx`). This runbook ties those paths to **Prometheus metrics** and **Alertmanager** rules in `docs/prometheus/bluesafe-alerts.example.yml`.

## Metrics (`GET /internal/prometheus`)

| Metric | Meaning |
| --- | --- |
| `bluesafe_xrpl_subscribe_connected` | `1` if subscribe WebSocket is up; `0` after disconnect. |
| `bluesafe_xrpl_subscribe_ledger_closed_events_total` | Cumulative validated `ledgerClosed` events processed. |
| `bluesafe_xrpl_watcher_last_ledger_close_unixtime` | Unix seconds of the **last** processed `ledgerClosed` (wall clock at ingest). |
| `bluesafe_xrpl_watcher_ledger_close_interval_avg_seconds` | Running mean wall-clock gap between consecutive closes (process lifetime). |
| `bluesafe_xrpl_watcher_ledger_close_interval_samples_total` | Number of intervals used in the mean (starts at 0 until two closes seen). |
| `bluesafe_xrpl_backfill_account_tx_live_apply_total` | Cumulative `applyLiveTxStatus` successes from **live** `account_tx` backfill API. |
| `bluesafe_xrpl_subscribe_disconnect_cycles_total` | Reconnect cycles (each disconnect increments). |

## Healthy signals

- On **Testnet/Mainnet** public hubs, validated ledgers close roughly every **3–5 seconds**; `last_ledger_close_unixtime` should track `time()` within a small delta while `connected=1`.
- `ledger_close_interval_avg_seconds` should stay in the low single-digit range under steady load.

## Alerts (example)

- **`BluesafeXrplWatcherLedgerCloseStalled`**: `connected=1`, at least one ledger was ever processed, but `time() - last_ledger_close_unixtime > 180` for 3m — likely stuck worker, dead WSS, or hub not pushing `ledgerClosed`.
- **`BluesafeXrplSubscribeDisconnectBurst`**: frequent reconnects — rate limits, TLS issues, or unstable hub.

Tune the **180s** threshold per environment (slower networks or intentional subscribe disable).

## Remediation checklist

1. **`/health?deep=1`** — inspect `xrpl` (`server_info`), `xrplSubscribe` snapshot (`connected`, `lastLedgerIndex`, `lastLedgerCloseUnixtime`, `disconnectCycles`).
2. Confirm **`XRPL_SUBSCRIBE_WORKER_DISABLED`** is not `1` when live Watcher is required.
3. If stall only: restart process; if repeats, capture WSS URL vendor status and consider **dedicated rippled/Clio** (v7 ADR).
4. If **tracked txs lag** but ledgers flow: run **`POST /v1/xrpl/backfill/account-tx`** for affected accounts; watch `bluesafe_xrpl_backfill_account_tx_live_apply_total` increase.
5. **Ledger gap / validated ambiguity**: cross-check [Validated results](https://xrpl.org/docs/references/xrpljs2-migration-guide) — never treat open-ledger `tx` as final.

## References

- ADR `docs/adr/0004-xrpl-subscribe-transactions-stream.md`
- `docs/Backend2_API_Spec_v7.md` §7 (V7-B)
- [subscribe — XRPL Docs](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/subscription-methods/subscribe)
