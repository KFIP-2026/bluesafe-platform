# Runbook — XRPL topology & DR hooks (V8-E)

## Purpose

Align **declared** rippled topology (`BLUESAFE_XRPL_TOPOLOGY`) and **human runbook** links with observability (`/health?deep=1` → `xrplOperations`, `GET /v1/operator/runtime/xrpl-operations`).

## Environment

| Variable | Meaning |
| --- | --- |
| `BLUESAFE_XRPL_TOPOLOGY` | `public_hub` (default) \| `dedicated` \| `clio` — informational only; does not change client behaviour. |
| `BLUESAFE_XRPL_DR_RUNBOOK_URL` | HTTPS link shown in `xrplOperations.drRunbookUrl` for on-call (playbooks, failover, vendor contacts). |
| `XRPL_WSS_URL` | When unset, XRPL features are disabled; health shows `rippledWssConfigured: false`. |

## DR checklist (operator)

1. Confirm **`xrplSubscribe.connectedGauge`** and **`ledgerCloseIntervalAvgSec`** in `/health?deep=1` (or Prometheus equivalents) during incident.
2. If public hub is unstable, follow **`drRunbookUrl`** to switch to dedicated / Clio endpoint; update `XRPL_WSS_URL` and roll pods.
3. Re-run `npm run subscribe-soak` or live probe (`npm run xrpl-live-probe`) before closing the incident.

## Conditional escrow

See **ADR `0013`**: Backend2 MVP does **not** implement EscrowCreate Condition/Fulfillment; use standard escrow flows or external tooling for conditional contracts.
