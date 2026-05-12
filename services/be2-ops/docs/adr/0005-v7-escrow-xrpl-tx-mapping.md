# ADR 0005 — V7-A: XRPL Escrow fields on `xrpl_txs`

## Status

Accepted (implemented in code + migration `011_v7_xrpl_escrow_protocol_fields.sql`).

## Context

BlueSafe Backend2 tracks XRPL transactions in `xrpl_txs` for validation, outcome classification, and dispute execution. The v7 roadmap requires **1:1 mapping** between ledger protocol fields for Escrow and persisted rows, aligned with:

- [EscrowCreate](https://xrpl.org/docs/references/protocol/transactions/types/escrowcreate)
- [EscrowFinish](https://xrpl.org/docs/references/protocol/transactions/types/escrowfinish)
- [EscrowCancel](https://xrpl.org/docs/references/protocol/transactions/types/escrowcancel)
- [Ledger Escrow object](https://js.xrpl.org/interfaces/LedgerEntry.Escrow.html)

## Decision

For rows where `tx_type` is `EscrowCreate`, `EscrowFinish`, or `EscrowCancel`, we persist:

| Column | EscrowCreate | EscrowFinish / EscrowCancel |
| --- | --- | --- |
| `escrow_owner` | `Account` (funds owner) | `Owner` |
| `escrow_destination` | `Destination` | NULL (not present on txn; use `account_objects` / ledger if needed) |
| `escrow_offer_sequence` | `Sequence` of this tx (escrow identifier) | `OfferSequence` (references create `Sequence`) |
| `escrow_submitter_account` | `Account` | `Account` (transaction submitter; may differ from `Owner` when delegates exist) |

The generic `account` column remains the rippled **`Account`** field for subscribe / `tx` backfill compatibility.

## Consequences

- Ingestion paths (`tx`, `account_tx`, validated `transactions` stream) merge these fields when present.
- Operator APIs return the four columns on `GET /v1/xrpl/transactions` and `GET /v1/xrpl/transactions/:txHash`.
- Finish/Cancel **destination** must be resolved via escrow ledger object or prior create row if the product needs it on-chain.

## Related

- **집행 주체·SignerList·외부 지갑**: `docs/adr/0006-xrpl-escrow-execution-actor.md`
