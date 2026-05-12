# ADR 0003: Evidence vault (W2) — size, MIME, encryption, retention

## Status

Accepted

## Context

Evidence files are uploaded to mock IPFS or Pinata. Operators need predictable limits, safe MIME handling, optional encryption at rest before pinning, and retention metadata for future purge/legal workflows.

## Decision

1. **Max upload size**: `multer` enforces `EVIDENCE_MAX_UPLOAD_BYTES` (default 15 MiB, capped in code).
2. **MIME allowlist**: Allowed types depend on `category` (e.g. `contract_pdf` → `application/pdf` only; `other` allows common doc/image/plain types). Reject with `B2_EVIDENCE_MIME_NOT_ALLOWED`.
3. **Encryption (optional)**: If `EVIDENCE_ENCRYPTION_KEY` is set (base64 of 32 bytes), plaintext is encrypted with **AES-256-GCM** before upload; DB stores `encryption_scheme = aes-256-gcm-v1` and `is_encrypted = true`. Plaintext **SHA-256** remains the integrity field for verify APIs.
4. **Retention**: Optional multipart field `retentionDays` (capped by `EVIDENCE_MAX_RETENTION_DAYS`) persists `retain_until` on the row. **No automatic deletion** in this MVP — field is for policy and future jobs.
5. **Authorization**: Upload, read-by-id, and verify require the caller to pass **`canAccessContract`** for the evidence’s contract.

## Consequences

- Clients must pick a valid `category` / MIME pair; Pinata receives ciphertext when encryption is on (download/rehydrate flow is out of scope until a dedicated download path exists).
