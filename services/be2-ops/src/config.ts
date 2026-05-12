export const config = {
  port: Number(process.env.PORT || 3000),
  /** Optional `/v1` transport hardening (Bearer and/or mTLS proxy header). */
  api: {
    v1BearerToken: (process.env.BLUESAFE_V1_BEARER_TOKEN || "").trim(),
    /** When set (e.g. `X-Client-Cert-Subject` from nginx), header must be non-empty after TLS client auth. */
    mtlsClientCertSubjectHeader: (process.env.BLUESAFE_MTLS_CLIENT_CERT_SUBJECT_HEADER || "").trim(),
  },
  ipfs: {
    mode: (process.env.IPFS_MODE || (process.env.IPFS_PINATA_JWT ? "pinata" : "mock")) as
      | "mock"
      | "pinata",
    pinataJwt: process.env.IPFS_PINATA_JWT || "",
    pinataEndpoint:
      process.env.IPFS_PINATA_ENDPOINT || "https://api.pinata.cloud/pinning/pinFileToIPFS",
    /** V6-B: Pinata unpin base (CID appended as path segment, DELETE). */
    pinataUnpinBaseUrl: (process.env.IPFS_PINATA_UNPIN_BASE_URL || "https://api.pinata.cloud/pinning/unpin").replace(
      /\/$/,
      "",
    ),
    pinataMaxAttempts: Math.max(1, Math.min(10, Number(process.env.IPFS_PINATA_MAX_ATTEMPTS || 4))),
    pinataRetryInitialMs: Math.max(50, Number(process.env.IPFS_PINATA_RETRY_INITIAL_MS || 400)),
    pinataRetryMaxMs: Math.max(200, Number(process.env.IPFS_PINATA_RETRY_MAX_MS || 10_000)),
  },
  xrpl: {
    enabled: process.env.XRPL_WSS_URL ? true : false,
    wssUrl: process.env.XRPL_WSS_URL || "",
    requestTimeoutMs: Number(process.env.XRPL_REQUEST_TIMEOUT_MS || 10000),
    /**
     * V8-E: declared rippled topology for ops / health (does not change wire protocol).
     * `public_hub` | `dedicated` | `clio` — unknown values treated as `public_hub`.
     */
    topologyProfile: ((): "public_hub" | "dedicated" | "clio" => {
      const v = (process.env.BLUESAFE_XRPL_TOPOLOGY || "public_hub").trim().toLowerCase();
      if (v === "dedicated" || v === "clio") return v;
      return "public_hub";
    })(),
    /** Optional HTTPS link surfaced in `/health` and `GET .../xrpl-operations` for DR / runbook. */
    drRunbookUrl: (process.env.BLUESAFE_XRPL_DR_RUNBOOK_URL || "").trim(),
  },
  xrplSubscribe: {
    disabled: process.env.XRPL_SUBSCRIBE_WORKER_DISABLED === "1",
    maxAccounts: Math.max(1, Math.min(100, Number(process.env.XRPL_SUBSCRIBE_MAX_ACCOUNTS || 50))),
    accountsRefreshMs: Math.max(10_000, Number(process.env.XRPL_SUBSCRIBE_ACCOUNTS_REFRESH_MS || 45_000)),
    /** W4: also subscribe to `transactions` (high volume on public hubs; see docs/adr/0004). */
    transactionsStream: process.env.XRPL_SUBSCRIBE_TRANSACTIONS_STREAM === "1",
    /** W4: JSON line to stdout before backoff sleep after disconnect. */
    logReconnects: process.env.XRPL_SUBSCRIBE_LOG_RECONNECTS === "1",
    /** W4: max validated `transactions` stream events processed per second per connection (`0` = unlimited). */
    transactionStreamMaxPerSec: Math.max(0, Number(process.env.XRPL_SUBSCRIBE_TX_MAX_PER_SEC || 0)),
  },
  /** v4-B: v1 §7.3 `pending_validation` timeout → `tx` / `account_tx` probes (live XRPL only). */
  xrplTxPolicy: {
    workerDisabled: process.env.XRPL_TX_POLICY_WORKER_DISABLED === "1",
    intervalMs: Math.max(5_000, Number(process.env.XRPL_TX_POLICY_INTERVAL_MS || 30_000)),
    pendingTimeoutMs: Math.max(10_000, Number(process.env.XRPL_PENDING_TX_TIMEOUT_MS || 120_000)),
    batchSize: Math.max(1, Number(process.env.XRPL_TX_POLICY_BATCH_SIZE || 10)),
    maxNotFoundProbes: Math.max(1, Number(process.env.XRPL_TX_POLICY_MAX_NOT_FOUND_PROBES || 5)),
    /**
     * W4: each tick, up to N tracked txs missing `account` get a rippled `tx` probe to fill `Account`
     * so `subscribe` + `account_tx` can cover them. Set `0` to disable.
     */
    accountBackfillPerTick: Math.max(0, Number(process.env.XRPL_TX_ACCOUNT_BACKFILL_PER_TICK ?? 8)),
    /** W5: one JSON log line per policy tick (claimed / resolved / requeued counts). */
    logSummaryTick: process.env.XRPL_TX_POLICY_LOG_SUMMARY === "1",
    /** W5: cap for exponential backoff between delayed_job runs (ms). */
    maxBackoffMs: Math.max(5_000, Number(process.env.XRPL_TX_POLICY_MAX_BACKOFF_MS || 300_000)),
  },
  health: {
    /** When true, `/health` always includes `db` / `xrpl` (without `?deep=1`). Default: only with `?deep=1`. */
    deepDefault: process.env.HEALTH_DEEP_DEFAULT === "1",
  },
  notification: {
    maxAttempts: Math.max(1, Number(process.env.NOTIFICATION_MAX_ATTEMPTS || 5)),
    workerIntervalMs: Math.max(50, Number(process.env.NOTIFICATION_WORKER_INTERVAL_MS || 2000)),
    workerBatchSize: Math.max(1, Number(process.env.NOTIFICATION_WORKER_BATCH_SIZE || 20)),
    workerDisabled: process.env.NOTIFICATION_WORKER_DISABLED === "1",
    /** POST JSON here to fan-out `email` channel (e.g. SendGrid/Mailgun HTTP bridge). */
    emailWebhookUrl: process.env.NOTIFICATION_EMAIL_WEBHOOK_URL || "",
    /** POST JSON here for `push` (FCM/APNs HTTP v1 or mobile push bridge). */
    pushWebhookUrl: process.env.NOTIFICATION_PUSH_WEBHOOK_URL || "",
    /** Log one JSON line per push delivery (FCM/APNs stub path). */
    fcmStubLog: process.env.NOTIFICATION_FCM_STUB_LOG === "1",
    /** First backoff after a failed delivery (ms); doubles each failure up to `retryMaxBackoffMs`. */
    retryInitialBackoffMs: Math.max(100, Number(process.env.NOTIFICATION_RETRY_INITIAL_MS || 1000)),
    retryMaxBackoffMs: Math.max(1000, Number(process.env.NOTIFICATION_RETRY_MAX_BACKOFF_MS || 60_000)),
    /** V6-C: auto-enqueue notifications for domain events (dispute/settlement matrix). `0` disables. */
    autoDomainEnqueue: process.env.NOTIFICATION_AUTO_DOMAIN_ENQUEUE !== "0",
    /**
     * V8-A: when `1`, domain/settlement auto fan-out writes `notification_outbox` first; fan-out worker inserts `notifications`.
     * See ADR `0010-v8-notification-outbox.md`.
     */
    domainOutbox: process.env.NOTIFICATION_DOMAIN_OUTBOX === "1",
    outboxFanoutWorkerDisabled: process.env.NOTIFICATION_OUTBOX_FANOUT_WORKER_DISABLED === "1",
    outboxFanoutWorkerIntervalMs: Math.max(100, Number(process.env.NOTIFICATION_OUTBOX_FANOUT_INTERVAL_MS || 750)),
    outboxFanoutBatchSize: Math.max(1, Number(process.env.NOTIFICATION_OUTBOX_FANOUT_BATCH_SIZE || 25)),
    outboxStaleProcessingMs: Math.max(10_000, Number(process.env.NOTIFICATION_OUTBOX_STALE_PROCESSING_MS || 120_000)),
    outboxDispatchMaxAttempts: Math.max(1, Number(process.env.NOTIFICATION_OUTBOX_DISPATCH_MAX_ATTEMPTS || 8)),
  },
  /** Async audit NDJSON export worker (v6). */
  exportJobs: {
    workerDisabled: process.env.EXPORT_JOB_WORKER_DISABLED === "1",
    workerIntervalMs: Math.max(500, Number(process.env.EXPORT_JOB_WORKER_INTERVAL_MS || 2000)),
    workerBatchSize: Math.max(1, Number(process.env.EXPORT_JOB_WORKER_BATCH_SIZE || 3)),
    /** V7-E: HMAC secret for time-limited export download links (`GET /export/artifacts`). */
    artifactSigningSecret: (process.env.BLUESAFE_EXPORT_ARTIFACT_SECRET || "").trim(),
    artifactUrlTtlSec: Math.max(60, Math.min(86400, Number(process.env.BLUESAFE_EXPORT_ARTIFACT_TTL_SEC || 3600))),
  },
  /** V6-F: optional signed POST after `POST /internal/reputation-events` accepts. */
  reputation: {
    outboundWebhookUrl: (process.env.REPUTATION_OUTBOUND_WEBHOOK_URL || "").trim(),
    outboundWebhookSecret: (process.env.REPUTATION_OUTBOUND_WEBHOOK_SECRET || "").trim(),
    /**
     * V7-F: comma-separated allowlist (e.g. `xls20-nft,xls70-mpt`). When non-empty, `tokenStandardRefs` on
     * `POST /internal/reputation-events` must be a subset.
     */
    xlsAllowlist: (process.env.REPUTATION_XLS_ALLOWLIST || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  },
  auth: {
    /** `BLUESAFE_AUTH=1`: `/v1` requires `X-Bluesafe-Role` (+ scope headers for tenant/landlord). */
    enabled: process.env.BLUESAFE_AUTH === "1",
    /**
     * V8-D: when `1` and auth is on, `operator` may send `X-Bluesafe-Operator-Scopes: export,purge,...` (or `all`).
     * Absent/empty header = full scope (backward compatible). Present header = must include each required scope for gated routes.
     */
    operatorConsoleScopesEnabled: process.env.BLUESAFE_OPERATOR_CONSOLE_SCOPES === "1",
    /** Optional OIDC issuer URL for IdP cutover planning (not validated by this service yet). */
    oidcIssuerUrl: (process.env.BLUESAFE_OIDC_ISSUER_URL || "").trim(),
  },
  /**
   * V6-A / V8-B: `POST /v1/disputes/:id/execution` uses a deterministic placeholder hash only when
   * `syntheticExecutionPathEffective()` is true (see `execution-policy.ts`: env not `0` **and** tier `dev`).
   * `BLUESAFE_SYNTHETIC_EXECUTION_HASH=0` still forces real `txHash` or submit path.
   */
  execution: {
    syntheticExecutionHashEnabled: process.env.BLUESAFE_SYNTHETIC_EXECUTION_HASH !== "0",
    /**
     * V8-B: `strict` = never use MVP synthetic txHash; require ledger `txHash` or successful `trySubmitDisputeExecution`.
     * `dev` (default) = allow synthetic when `BLUESAFE_SYNTHETIC_EXECUTION_HASH` is not `0`.
     */
    deploymentTier: ((): "dev" | "strict" => {
      const t = (process.env.BLUESAFE_EXECUTION_DEPLOYMENT_TIER || "dev").trim().toLowerCase();
      return t === "strict" ? "strict" : "dev";
    })(),
    /** `BLUESAFE_EXECUTION_SUBMIT_ENABLED=1` + `BLUESAFE_EXECUTION_SUBMIT_SEED` + XRPL live: submit Escrow tx from backend. */
    submitEnabled: process.env.BLUESAFE_EXECUTION_SUBMIT_ENABLED === "1",
    submitSeed: process.env.BLUESAFE_EXECUTION_SUBMIT_SEED || "",
  },
  /** W3: verifier mock quorum — max recommendation count must reach this for `quorumMet` on review-state API. */
  dispute: {
    verifierQuorumK: Math.max(1, Number(process.env.DISPUTE_VERIFIER_QUORUM_K || 1)),
    /** Days after `under_review` when `review_deadline_at` is set (SLA marker). */
    reviewDeadlineDays: Math.max(1, Number(process.env.DISPUTE_REVIEW_DEADLINE_DAYS || 14)),
    /**
     * V7-D: when `1`, `POST /v1/operator/disputes/review-sla-scan` sets `escalatedAt` on overdue `under_review`
     * rows (instead of only emitting `dispute.review_deadline_expired`).
     */
    slaAutoEscalate: process.env.DISPUTE_SLA_AUTO_ESCALATE === "1",
  },
  /** V5-A/B: monthly settlement rows + optional auto-notify on confirm. */
  settlement: {
    ledgerCloseTouchEnabled: process.env.SETTLEMENT_LEDGER_TOUCH_DISABLED !== "1",
    autoNotifyOnConfirmed: process.env.SETTLEMENT_AUTO_NOTIFY_ON_CONFIRMED !== "0",
  },
  /** W2: Evidence vault limits, optional at-rest encryption, retention metadata. */
  evidenceVault: {
    maxUploadBytes: Math.min(
      100 * 1024 * 1024,
      Math.max(4096, Number(process.env.EVIDENCE_MAX_UPLOAD_BYTES || 15 * 1024 * 1024)),
    ),
    maxRetentionDays: Math.min(
      3650,
      Math.max(1, Number(process.env.EVIDENCE_MAX_RETENTION_DAYS || 2555)),
    ),
    /** Base64 of 32-byte key; when set, uploads are encrypted before IPFS. */
    encryptionKeyBase64: process.env.EVIDENCE_ENCRYPTION_KEY || "",
    /** Public gateway base for `GET .../content` (no trailing slash). */
    ipfsGatewayBase: process.env.EVIDENCE_IPFS_GATEWAY_BASE || "https://gateway.pinata.cloud/ipfs",
    /**
     * Optional KMS key resource id (e.g. AWS KMS key ARN). Not read by OSS code — attach to audits
     * when the deployment maps this ref to `EVIDENCE_ENCRYPTION_KEY` material via a sidecar/vault.
     */
    kmsKeyRef: (process.env.EVIDENCE_KMS_KEY_REF || "").trim(),
    /** Dev/stub: base64 of 32-byte DEK when `EVIDENCE_ENCRYPTION_KEY` is unset. */
    kmsStubDekBase64: (process.env.EVIDENCE_KMS_STUB_DEK_BASE64 || "").trim(),
    /** Sidecar unwrap: POST JSON `{"ciphertext":"<EVIDENCE_KMS_WRAPPED_DEK_BASE64>"}` → `{ plaintextKeyBase64 }`. */
    kmsHttpUnwrapUrl: (process.env.EVIDENCE_KMS_HTTP_UNWRAP_URL || "").trim(),
    kmsHttpUnwrapBearer: (process.env.EVIDENCE_KMS_HTTP_UNWRAP_BEARER || "").trim(),
    kmsWrappedDekBase64: (process.env.EVIDENCE_KMS_WRAPPED_DEK_BASE64 || "").trim(),
    kmsHttpUnwrapTimeoutMs: Math.max(1000, Number(process.env.EVIDENCE_KMS_HTTP_UNWRAP_TIMEOUT_MS || 10_000)),
  },
};
