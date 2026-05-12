# bluesafe.reputation.v2 — consumer guide (V8-F)

## Event flow

1. Producer calls **`POST /internal/reputation-events`** with JSON matching `reputationOutboundSchema` (`idempotencyKey`, `eventType`, `subjectType`, `subjectId`, optional `payload`, optional `tokenStandardRefs`).
2. Backend2 persists an audit row, emits `reputation.outbound_queued`, and (when `REPUTATION_OUTBOUND_WEBHOOK_URL` is set) POSTs an envelope to the webhook:

```json
{
  "schemaVersion": "bluesafe.reputation.v2",
  "idempotencyKey": "...",
  "eventType": "...",
  "subjectType": "...",
  "subjectId": "...",
  "emittedAt": "ISO-8601",
  "payload": { }
}
```

3. Optional HMAC: `X-Bluesafe-Signature: sha256=<hex>` when `REPUTATION_OUTBOUND_WEBHOOK_SECRET` is set.

## Idempotency

Consumers must dedupe on **`idempotencyKey`**. Backend2 may deliver **at-least-once** after retries.

## Failure & DLQ

- HTTP non-2xx or network errors increment DLQ state (in-process; see ADR `0014`).
- **`GET /internal/reputation-delivery?limit=50`** lists recent failures (optional `Authorization: Bearer <METRICS_SCRAPE_TOKEN>` when that env is set).
- **`POST /internal/reputation-delivery/retry`** body `{ "idempotencyKey": "..." }` re-queues outbound delivery.

## XLS allowlist

When `REPUTATION_XLS_ALLOWLIST` is non-empty, every `tokenStandardRefs` entry must be in the allowlist or the hook returns `400`.

## SBT / on-chain adapter

Minting services may map v2 envelopes to **`SbtAdapterJob`** (`src/services/sbt-adapter-contract.ts`) internally. Backend2 does not submit chain transactions.
