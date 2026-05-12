# ADR 0009 — Export artifact URLs and reputation schema v2 (V7-E/F)

## Status

Accepted (2026-05-09)

## Context

Completed async audit export jobs stored NDJSON in the database; operators need a **shareable, time-limited download** path without handing out long-lived API tokens. Reputation webhooks previously used `bluesafe.reputation.v1` with no token-standard hints.

## Decision

1. **Signed artifact URL**: `GET /v1/reports/export-jobs/:jobId/artifact-url` returns a relative `downloadPath` with an HMAC-signed `token` (`BLUESAFE_EXPORT_ARTIFACT_SECRET`, TTL `BLUESAFE_EXPORT_ARTIFACT_TTL_SEC`). `GET /export/artifacts?token=...` is mounted **outside** `/v1` so transport Bearer on `/v1` does not block link-based downloads. Tokens bind to `jobId` and expiry only; completed job bodies are unchanged.
2. **Retention listing**: `GET /v1/operator/evidences/retention-due` lists evidences with `retain_until < now` (read-only; purge remains `POST .../retention-run`).
3. **Reputation v2**: Outbound webhook JSON uses `schemaVersion: "bluesafe.reputation.v2"` and includes `emittedAt` (ISO). Optional `tokenStandardRefs[]` on `POST /internal/reputation-events` is validated against `REPUTATION_XLS_ALLOWLIST` when that env list is non-empty; otherwise any refs are accepted and forwarded.

## Consequences

- Artifact URLs are bearer-equivalent secrets; short TTL and HTTPS are required in production.
- Consumers of reputation webhooks should key off `schemaVersion` and tolerate v1 during any transition window (v1 is no longer emitted by this codebase once v2 ships).
