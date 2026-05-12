# ADR 0012 — Evidence retention class / legal hold and audit keyset pagination (V8-C)

## Status

Accepted — implemented 2026-05-09 (V8-C).

## Context

Operators need **durable metadata** for compliance workflows: which objects are under **legal hold**, optional **jurisdiction** labels, and a **retention class** bucket beyond a single `retainUntil` timestamp. Purge jobs must not delete rows that are still protected.

Audit logs can grow large; **offset** exports are awkward at scale. A **stable keyset** order (`created_at`, `id`) with an opaque **cursor** avoids skipping/duplicating rows when new audits are inserted during paging.

## Decision

1. **Evidence (`evidences` table)**  
   - Add `retention_class` (`standard` \| `regulated` \| `legal_hold`, default `standard`).  
   - Add optional `jurisdiction` (text) and optional `legal_hold_until` (timestamptz).  
   - **Purge eligibility** (`listEvidencesPastRetention`): row must have `retain_until < now` and must **not** be protected:  
     - `retention_class = 'legal_hold'` and (`legal_hold_until` is null **or** `legal_hold_until >= now`), **or**  
     - `retention_class` is not `legal_hold` and `legal_hold_until` is set and `legal_hold_until >= now` (time-bound hold on any class).

2. **Operator API**  
   - `PATCH /v1/operator/evidences/:evidenceId/metadata` (operator-only) updates the above fields and optional `retainUntil`, with audit + domain event.

3. **Audits**  
   - `GET /v1/audits` keeps the legacy **full list** when neither `limit` nor `cursor` is sent.  
   - When `limit` and/or `cursor` is present, responses include `nextCursor` (opaque base64url JSON) and use **keyset** pagination in repository implementations.

4. **CSV export**  
   - `GET /v1/reports/audits.csv` mirrors **`GET /v1/reports/audits.ndjson`** query parameters and **the same roles** (`operator`, `verifier`, `auditor`), streaming CSV with a UTF-8 BOM for spreadsheet tools.

## Consequences

- New migration `015_v8_evidence_retention_legal_audit_index.sql`; Postgres and memory repositories must stay aligned on purge rules.  
- Clients that relied on unbounded `GET /v1/audits` without query params are unchanged; large pulls should migrate to cursor mode.  
- CSV row shape is fixed header columns; JSON columns are embedded as escaped strings (same information as NDJSON lines).

## References

- `docs/Backend2_API_Spec_v8.md` — V8-C scope.  
- Prior evidence ADR: `docs/adr/0003-evidence-vault-w2.md`.
