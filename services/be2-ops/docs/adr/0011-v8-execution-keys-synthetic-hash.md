# ADR 0011 — Execution keys, signing boundary, and synthetic txHash (V8-B)

## Status

Accepted (2026-05-09)

## Context

`POST /v1/disputes/:id/execution` historically allowed an **MVP synthetic** 64-hex `txHash` when no ledger hash was supplied and backend submit was unavailable. Production needs a **clear boundary** between:

- **Internal signing** (`BLUESAFE_EXECUTION_SUBMIT_ENABLED` + seed wallet, must match `owner`), and  
- **External signing** (client or custodian submits on XRPL, then passes `txHash`).

Escrow field alignment and Finish actor discussion remain in `docs/adr/0005-v7-escrow-xrpl-tx-mapping.md` and `docs/adr/0006-xrpl-escrow-execution-actor.md`.

## Decision

1. **`BLUESAFE_EXECUTION_DEPLOYMENT_TIER`**
   - `dev` (default): synthetic placeholder path is allowed **if** `BLUESAFE_SYNTHETIC_EXECUTION_HASH !== "0"` (unchanged MVP behaviour for local/smoke).
   - `strict`: **never** use the synthetic branch. The handler requires either a client-supplied **`txHash`** or a successful **`trySubmitDisputeExecution`** (live XRPL + enabled submit + matching seed `owner`). This is independent of setting `BLUESAFE_SYNTHETIC_EXECUTION_HASH=1` — strict tier overrides for defense in depth.

2. **`BLUESAFE_SYNTHETIC_EXECUTION_HASH=0`** continues to mean “no synthetic path” even in `dev` tier (existing v6 contract).

3. **Secrets**: `BLUESAFE_EXECUTION_SUBMIT_SEED` is **never** logged or returned by APIs. Introspection is limited to `GET /v1/operator/runtime/execution-policy` and deep `/health` (**boolean flags + warnings only**).

4. **Non-normative references** (onboarding / wallet UX, not protocol law): [XRPL Dev Source hub](http://linktr.ee/rippledevrel), [internal wallet sample](https://catalyze-research.notion.site/XRPL-XRPL-Wallet-Integration-Demo-295898c680bf80979f4afce1b579f808?pvs=74), [external (Girin) wallet sample](https://catalyze-research.notion.site/XRPL-Girin-Wallet-Integration-Demo-295898c680bf80a09b23ef59f092ffce?pvs=74), [xrpl.js EscrowFinish](https://js.xrpl.org/interfaces/EscrowFinish.html).

## Consequences

- Staging/production should set **`BLUESAFE_EXECUTION_DEPLOYMENT_TIER=strict`** even while migrating clients to always send `txHash`.
- Removing the synthetic code path entirely is a **semver / major** product decision; until then, `dev` tier preserves backward compatibility.
