# ADR 0013 — Conditional escrow (Condition / Fulfillment) not supported in Backend2 MVP

## Status

Accepted — documented 2026-05-09 (V8-E).

## Context

XRPL supports **conditional escrows** (`Condition`, `Fulfillment` on `EscrowCreate` / `EscrowFinish`). Product and operations need a single statement of whether BlueSafe Backend2 models, validates, or submits such flows.

## Decision

**This service does not implement conditional escrow** in the dispute execution / escrow tracking MVP:

- No API fields for `Condition` / `Fulfillment` on execution or tracked tx normalization.
- Operators should use **standard** escrow finish/cancel flows aligned with existing ADRs (`0005`, `0006`).

`GET /v1/operator/runtime/execution-policy` exposes `conditionalEscrowSupported: false` and this ADR path. Deep `/health` includes `xrplOperations` with the same statement.

## Consequences

- If the product later adopts conditional escrow, it requires **schema, validation, execution submit path, and documentation** changes with a new ADR superseding this one.
- Watcher / classifier behaviour for unknown escrow shapes remains best-effort; operators rely on explicit XRPL tooling for exotic escrow types.

## References

- `docs/adr/0005-v7-escrow-xrpl-tx-mapping.md`
- `docs/adr/0006-xrpl-escrow-execution-actor.md`
