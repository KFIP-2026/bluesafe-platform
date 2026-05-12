# ADR 0007 — Settlement period and financials (V7-C)

## Status

Accepted (2026-05-09)

## Context

Settlements must expose a single bucketing model and optional financial confirmation (amount, currency, batch) without inventing a second “ledger-month” product clock in Backend2 OSS.

## Decision

1. **Period mode**: `period_mode = calendar_utc` only. Rows are keyed by `(contract_id, period_year, period_month)` in UTC calendar months, aligned with existing `settlement-ledger.ts` / `touchSettlementsOnLedgerClose` behaviour.
2. **Financials**: `amount_minor`, `currency_code` (default `XRP`), `batch_id`, and `confirmed_at` are persisted. Operators attach or adjust them via `PATCH /v1/settlements/:id/status` together with status transitions or financial-only updates.
3. **Outbox**: Domain notifications continue to use synchronous `saveNotification` from handlers (existing v6 pattern). A dedicated durable outbox worker is **not** introduced in this ADR; defer to v7 §11 “Outbox” open item.

## Consequences

- Product copy and APIs must say “UTC calendar month” unless a future ADR adds another `period_mode` enum value and migration.
- Reporting joins settlements to contracts on `contract_id` without reinterpretation of XRPL close timestamps as fiscal periods.
