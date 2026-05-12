# ADR 0014 — SBT / registry adapter contract (off-chain bridge)

## Status

Accepted — contract stub 2026-05-09 (V8-F).

## Context

`bluesafe.reputation.v2` events can be forwarded to external systems (`REPUTATION_OUTBOUND_WEBHOOK_URL`). On-chain **SBT** or registry minting is typically a separate service with different SLAs, keys, and failure modes than Backend2.

## Decision

1. **Backend2 responsibility**: accept reputation events (`POST /internal/reputation-events`), emit audits/events, enqueue **async outbound webhook**, maintain an **in-process DLQ** for failed deliveries (`GET/POST /internal/reputation-delivery*`), and expose a **portable job shape** in TypeScript (`SbtAdapterJob` in `src/services/sbt-adapter-contract.ts`) for bridges that choose to implement it.

2. **Out of scope here**: chain signing, gas, RPC selection, or NFT/SBT minting — delegated to an **adapter service** that may consume webhooks or poll an external queue.

3. **Retry**: operators or automation call `POST /internal/reputation-delivery/retry` with `idempotencyKey` (same bearer rules as other internal hooks when `METRICS_SCRAPE_TOKEN` is set).

## Consequences

- DLQ is **memory-only** in OSS; production should use an external store or stream if multi-instance.
- Adapter teams should treat `schemaVersion: bluesafe.reputation.v2` as the primary wire contract; `SbtAdapterJob` is optional structural guidance.

## References

- `docs/reputation-v2-consumer-guide.md`
- ADR `0009` (reputation v2 / export artifacts context in v7)
