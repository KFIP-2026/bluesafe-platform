# Alertmanager integration (BlueSafe Backend2)

## Metrics endpoint

- `GET /internal/prometheus` — Prometheus text exposition.
- Optional: set `METRICS_SCRAPE_TOKEN`; scraper sends `Authorization: Bearer <token>`.

## Example rules

See `docs/prometheus/bluesafe-alerts.example.yml` for starter `PrometheusRule`-style expressions on:

- `bluesafe_reputation_outbound_delivery_total`
- `bluesafe_xrpl_policy_exhausted_total`
- `bluesafe_export_jobs_failed_total`
- **v7-B:** `bluesafe_xrpl_watcher_last_ledger_close_unixtime`, `bluesafe_xrpl_subscribe_connected`, `bluesafe_xrpl_subscribe_disconnect_cycles_total` (ledger stall + reconnect burst)

## Wiring Alertmanager

1. Configure Prometheus to scrape `/internal/prometheus` (with bearer if enabled).
2. Add the example file (or merged rules) under `rule_files` / operator `PrometheusRule` CRD.
3. Point Alertmanager `route.receiver` at your on-call channel (PagerDuty, Slack, etc.).
4. Tune `for` / thresholds after a soak week; settlement and audit latency rules depend on traffic shape.

## Operational notes

- **Settlement touch**: `bluesafe_settlement_ledger_close_touch_invocations_total` and `bluesafe_settlement_contracts_touched_rows_total` — compare to expected ledger-close cadence.
- **XRPL Watcher (v7-B):** `bluesafe_xrpl_watcher_last_ledger_close_unixtime`, `bluesafe_xrpl_watcher_ledger_close_interval_avg_seconds`, `bluesafe_xrpl_backfill_account_tx_live_apply_total` — compare to ledger cadence; runbook `docs/runbooks/v7-subscribe-watcher-slo.md`.
- **Audit latency**: `bluesafe_audit_list_query_duration_ms{quantile="p95"}` — high values suggest DB index work on `audits(created_at)` or export job contention.
