# ADR 0010 — Domain notification durable outbox (V8-A)

## Status

Accepted (2026-05-09)

## Context

Domain-driven fan-out (`maybeEnqueueDomainNotifications`, settlement confirmed) called `saveNotification` synchronously. That couples HTTP handlers to the delivery queue and makes **at-least-once** fan-out across process crashes harder to reason about. v8 §2 requires an **Outbox** (or equivalent) for domain → notification path.

## Decision

1. **Table** `notification_outbox` with **`idempotency_key` UNIQUE** (SHA-256 over `eventType`, `recipientId`, `channel`, stable JSON payload). Duplicate domain events do not duplicate rows.
2. **Opt-in**: `NOTIFICATION_DOMAIN_OUTBOX=1` routes domain/settlement auto fan-out through the outbox. Default `0` preserves legacy direct `notifications` insert.
3. **Fan-out worker** (`notification-outbox.worker.ts`): claims `pending` rows (`FOR UPDATE SKIP LOCKED`), inserts matching `notifications` rows (`queued`), emits `notification.requested`, marks outbox `dispatched`. Failures increment `attempts`; after `NOTIFICATION_OUTBOX_DISPATCH_MAX_ATTEMPTS` the row is **`dead`** and emits `notification.outbox_dead`. Stale `processing` rows are reset to `pending` using `NOTIFICATION_OUTBOX_STALE_PROCESSING_MS`.
4. **Operator**: `GET /v1/operator/notifications/outbox`, `POST .../outbox/:id/retry` (dead → pending).
5. **XRPL / wallet references** (non-normative for this ADR): internal vs external signing boundaries remain [XRPL Korea Dev Source](http://linktr.ee/rippledevrel), [internal wallet integration sample](https://catalyze-research.notion.site/XRPL-XRPL-Wallet-Integration-Demo-295898c680bf80979f4afce1b579f808?pvs=74), [external wallet (Girin) sample](https://catalyze-research.notion.site/XRPL-Girin-Wallet-Integration-Demo-295898c680bf80a09b23ef59f092ffce?pvs=74); protocol refs [subscribe](https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/subscription-methods/subscribe), [EscrowCreate / Finish / Cancel](https://js.xrpl.org/interfaces/EscrowCreate.html). Outbox does not change XRPL semantics — it only decouples **domain notification intent** from the existing delivery worker.

## Consequences

- With outbox enabled, end-to-end latency adds one worker tick (configurable) before `notifications` exist.
- True **transactional outbox** (same DB transaction as contract update) is not yet enforced at every call site; follow-up can wrap critical paths in explicit transactions.
