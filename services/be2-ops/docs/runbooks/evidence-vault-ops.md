# Evidence vault — pinning, download, KMS, retention

## Scope

Backend2 stores evidence metadata in Postgres (`evidences`), content on IPFS (Pinata or mock), optional AES-256-GCM before upload, `retain_until` for legal/policy windows, and operator purge via API.

## Pinning (Pinata)

1. Set `IPFS_MODE=pinata` and `IPFS_PINATA_JWT` (server-side only).
2. Uploads use `POST /v1/evidences` (multipart). The service pins the file and persists `cid` + `sha256` of **plaintext** (hash is taken before encryption when encryption is on).
3. For downloads, set `EVIDENCE_IPFS_GATEWAY_BASE` to a gateway that can resolve your CIDs (default Pinata gateway).

## Encryption key (KMS alignment)

- **At rest in app:** `EVIDENCE_ENCRYPTION_KEY` — base64 of 32 bytes. Prefer mounting from a secret manager (K8s Secret, AWS Secrets Manager, etc.), not committing to git.
- **Audit linkage:** set `EVIDENCE_KMS_KEY_REF` to your KMS key ARN or logical id. The upload audit payload includes `kmsKeyRef` when set; the OSS server does not call KMS — your platform should map the ref to key material or envelope decryption outside this process.

## Download

- `GET /v1/evidences/:evidenceId` — JSON metadata (RBAC: contract parties + operator/verifier).
- `GET /v1/evidences/:evidenceId/content` — stream bytes: gateway fetch → optional decrypt → integrity check (skipped for `storageProvider: mock`).

## Retention purge (operator)

1. Ensure rows have `retain_until` in the past when you intend deletion.
2. Call `POST /v1/operator/evidences/retention-run` with operator role. The handler lists `retain_until < now()`, deletes DB rows, writes audits, and emits `evidence.retention_purged`.
3. **IPFS unpin:** this OSS build deletes metadata only. Production runbooks should add an async job to unpin objects from Pinata (or lifecycle policy on the bucket) using stored `cid`.

## Related env (subset)

| Variable | Purpose |
| --- | --- |
| `EVIDENCE_ENCRYPTION_KEY` | Base64 32-byte AES key |
| `EVIDENCE_KMS_KEY_REF` | Optional ref string stored in audits |
| `EVIDENCE_IPFS_GATEWAY_BASE` | Public gateway for content download |
| `EVIDENCE_MAX_UPLOAD_BYTES` / `EVIDENCE_MAX_RETENTION_DAYS` | Limits |

## Soak / stability

XRPL subscribe and metrics are covered in `docs/runbooks/v4-subscribe-soak.md` and `GET /internal/prometheus`.
