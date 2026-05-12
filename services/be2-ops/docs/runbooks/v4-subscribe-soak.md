# V4 subscribe soak (ledger + accounts)

## Purpose

The subscribe worker opens one XRPL WebSocket client, subscribes to the **`ledger` stream** and to **tracked accounts** that still have unvalidated transactions, and periodically refreshes account subscriptions. This runbook describes a minimal soak so you can watch stability under churn (reconnect backoff is exponential up to 60s).

## Preconditions

- Build: `npm run build`
- Optional live XRPL: set `XRPL_WSS_URL` (without it the worker still connects if URL is invalid—avoid empty bogus URLs).
- Do **not** set `XRPL_SUBSCRIBE_WORKER_DISABLED=1` if you want the worker to run.
- **`delayed_jobs` / tx policy** require **Postgres** (`DATABASE_URL`); in-memory repo keeps delayed work in-process only.

## Run

Terminal A — API:

```bash
node dist/index.js
```

Terminal B — soak script (polls `/health?deep=1`):

```bash
npm run subscribe-soak
```

Or with explicit port / iteration tuning:

```bash
SMOKE_PORT=3000 SUBSCRIBE_SOAK_ITERATIONS=60 SUBSCRIBE_SOAK_INTERVAL_MS=500 node scripts/subscribe-soak.mjs
```

To spawn the API from the soak script (Windows-friendly one-liner after build):

```bash
set RUN_SERVER=1&& set SMOKE_PORT=3100&& node scripts/subscribe-soak.mjs
```

## Verify settlement-style domain events

When the ledger stream is active and dedup allows a new ledger, the worker appends an event:

- `eventType`: `settlement.ledger_closed`
- `entityType`: `xrpl_ledger`
- `entityId`: `ledger:<ledger_index>`

Example (no server-side pagination on this endpoint—all matching rows are returned):

```http
GET /v1/events?eventType=settlement.ledger_closed
```

Combine with entity filters if needed:

```http
GET /v1/events?entityType=xrpl_ledger&entityId=ledger%3A12345678
```

Use your deployment’s base URL and optional `BLUESAFE_AUTH` / role headers if RBAC is enabled.

## RBAC reminder

With `BLUESAFE_AUTH=1`, `/v1` requests need:

- `X-Bluesafe-Role`: `tenant` | `landlord` | `operator` | `verifier`
- `X-Bluesafe-Tenant-Id` when role is `tenant`
- `X-Bluesafe-Landlord-Id` when role is `landlord`

Smoke tests and local scripts typically keep `BLUESAFE_AUTH` unset or `0`.

## Environment reference (subset)

| Variable | Role |
| --- | --- |
| `XRPL_WSS_URL` | Live rippled WSS |
| `XRPL_SUBSCRIBE_WORKER_DISABLED` | `1` disables subscribe worker |
| `DATABASE_URL` | Postgres (includes `delayed_jobs` migration `005_v4_delayed_jobs.sql`) |
| `BLUESAFE_AUTH` | `1` enables header RBAC on `/v1` |
| `SMOKE_PORT` | Default port for `subscribe-soak.mjs` (3100) |
| `SUBSCRIBE_SOAK_ITERATIONS`, `SUBSCRIBE_SOAK_INTERVAL_MS` | Soak loop tuning |
| `RUN_SERVER` | `1` — soak script spawns `node dist/index.js` |
| `SUBSCRIBE_SOAK_JSON` | `0` disables the final one-line JSON summary on stdout (default: enabled) |
| `SUBSCRIBE_SOAK_REPORT_PATH` | If set, writes the same JSON line to this file |
| `XRPL_TX_ACCOUNT_BACKFILL_PER_TICK` | Policy worker: max `tx` lookups per tick to fill missing `account` on tracked rows (default `8`, `0` off) |
| `XRPL_SUBSCRIBE_TX_MAX_PER_SEC` | Cap validated `transactions` stream handling per second (`0` = unlimited) |
| `XRPL_SUBSCRIBE_LOG_RECONNECTS` | `1` logs JSON before reconnect backoff |
| `METRICS_SCRAPE_TOKEN` | If set, `GET /internal/prometheus` requires `Authorization: Bearer …` |

## Metrics (W4)

Expose counters for Prometheus:

```http
GET /internal/prometheus
```

See `deploy/prometheus/bluesafe-rules.example.yml` for sample alert rules (`bluesafe_*` metrics).

After a run, the soak prints one JSON line (unless `SUBSCRIBE_SOAK_JSON=0`), for example:

```json
{"script":"subscribe-soak","port":3100,"iterations":30,"intervalMs":1000,"ok":30,"fail":0,"successRate":1,"elapsedMs":30150,"deepDbOkSamples":0,"deepXrplOkSamples":0,"runServer":false}
```

- `deepDbOkSamples` / `deepXrplOkSamples`: count of iterations where `/health?deep=1` returned `db: "ok"` / `xrpl: "ok"` (useful when `DATABASE_URL` + live WSS are set).

## Live WSS probe (CI / manual)

Without starting the API, verify reachability of rippled:

```bash
XRPL_WSS_URL=wss://s.devnet.rippletest.net:51233 npm run xrpl-live-probe
```

GitHub: add repository secret `XRPL_WSS_URL`, then run workflow **CI** → **Run workflow** (`workflow_dispatch`). The `xrpl-live-probe` job runs only on manual dispatch and skips if the secret is empty.

## Account backfill (W4)

Tracked transactions without `account` cannot join `subscribe` account fan-out. The tx-policy worker now:

1. Calls rippled `tx` for up to **`XRPL_TX_ACCOUNT_BACKFILL_PER_TICK`** rows per tick and persists `Account` when found.
2. `POST /v1/xrpl/track` triggers an immediate `tx` read when live XRPL is enabled so `account` can be filled before the next worker tick.

The subscribe `transaction` handler passes `Account` into `applyLiveTxStatus` when present.
