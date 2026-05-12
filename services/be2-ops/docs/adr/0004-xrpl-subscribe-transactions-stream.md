# ADR 0004: Optional `transactions` subscribe stream

## Status

Accepted

## Context

Some deployments track transaction hashes before a classic `Account` is known. The `transactions` WebSocket stream delivers **all** validated transactions visible to the connected server, which can be high-volume on public networks.

## Decision

- Gate **`streams: ["ledger", "transactions"]`** behind `XRPL_SUBSCRIBE_TRANSACTIONS_STREAM=1` (default off).
- Handler **filters** each message to hashes already present in `xrpl_txs` (tracked set), so rippled traffic is filtered in-process.
- Operators must still size `XRPL_SUBSCRIBE_MAX_ACCOUNTS` and infra for their network; mainnet public hubs may be unsuitable at scale.

## Consequences

- Improves recovery for hash-only tracks without `account` backfill yet; cost is CPU/bandwidth on the API host.
