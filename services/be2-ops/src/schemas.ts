import { z } from "zod";

export const createContractSchema = z.object({
  tenantId: z.string().min(1),
  landlordId: z.string().min(1),
});

export const contractStatusValueSchema = z.enum([
  "draft",
  "escrow_pending",
  "escrow_validated",
  "active",
  "closed",
  "cancelled",
]);

export const contractStatusSchema = z.object({
  status: contractStatusValueSchema,
});

export const verifyEvidenceSchema = z.object({
  cid: z.string().min(8),
  expectedSha256: z.string().min(32),
});

export const evidenceCategorySchema = z.enum([
  "contract_pdf",
  "utility_bill",
  "photo",
  "receipt",
  "other",
]);

/** Multipart text fields for POST /v1/evidences (after multer). */
export const evidenceUploadFormSchema = z.object({
  contractId: z.string().min(1),
  disputeId: z.string().min(1).optional(),
  category: evidenceCategorySchema.default("other"),
  uploaderId: z.string().min(1).optional(),
  retentionDays: z.coerce.number().int().positive().optional(),
});

export const createDisputeSchema = z.object({
  contractId: z.string().min(1),
  raisedBy: z.enum(["tenant", "landlord", "operator"]),
  reasonCode: z.string().min(1),
  evidenceIds: z.array(z.string().min(1)).min(1),
});

export const decisionSchema = z.object({
  decision: z.enum([
    "finish_to_tenant",
    "finish_to_landlord",
    "cancel_to_owner",
    "partial_manual",
  ]),
  memo: z.string().max(500).optional(),
});

export const disputeStatusPatchSchema = z.object({
  status: z.enum(["under_review", "filed"]),
});

export const disputeVerifierVoteSchema = z.object({
  verifierId: z.string().min(1),
  recommendation: z.enum([
    "finish_to_tenant",
    "finish_to_landlord",
    "cancel_to_owner",
    "partial_manual",
  ]),
});

export const executionSchema = z.object({
  txType: z.enum(["EscrowFinish", "EscrowCancel"]),
  owner: z.string().min(20),
  offerSequence: z.union([z.number().int().nonnegative(), z.string().min(1)]),
  network: z.enum(["testnet", "mainnet"]).default("testnet"),
  /** V6-A / V8-B: rippled transaction id (64 hex). Required when synthetic placeholder path is off (`BLUESAFE_SYNTHETIC_EXECUTION_HASH=0` or `BLUESAFE_EXECUTION_DEPLOYMENT_TIER=strict` without submit success). */
  txHash: z.string().length(64).regex(/^[0-9a-fA-F]+$/).optional(),
});

export const trackTxSchema = z.object({
  txHash: z.string().min(8),
  txType: z.string().min(1),
  account: z.string().min(20).optional(),
  network: z.enum(["testnet", "mainnet"]).default("testnet"),
});

export const backfillSchema = z.object({
  account: z.string().min(20),
  fromLedger: z.number().int().nonnegative().optional(),
  resultCode: z.string().optional(),
});

/** Query for GET /v1/xrpl/accounts/:account/escrows (rippled account_objects limit is 10–400). */
export const accountEscrowsQuerySchema = z.object({
  limit: z.coerce.number().int().min(10).max(200).optional().default(50),
  /** rippled `account_objects` pagination; pass JSON string or opaque marker from prior `nextMarker`. */
  marker: z.string().optional(),
});

export const notifySchema = z.object({
  eventType: z.string().min(1),
  recipientId: z.string().min(1),
  channel: z.enum(["push", "email", "inapp"]),
  payload: z.record(z.string(), z.unknown()).default({}),
});

/** POST /v1/notifications/dispatch — fan-out by channel (routing defaults by eventType prefix). */
export const notificationDispatchSchema = z.object({
  eventType: z.string().min(1),
  recipientId: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
  channels: z.array(z.enum(["push", "email", "inapp"])).optional(),
});

const settlementStatusEnum = z.enum(["collecting", "accrued", "confirmed", "archived"]);

/** GET /v1/settlements */
export const settlementListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  contractId: z.string().min(1).optional(),
  status: settlementStatusEnum.optional(),
  periodYear: z.coerce.number().int().min(2000).max(2100).optional(),
  periodMonth: z.coerce.number().int().min(1).max(12).optional(),
});

/** PATCH /v1/settlements/:settlementId/status — V7-C: optional financial fields (status optional if other fields set). */
export const settlementStatusPatchSchema = z
  .object({
    status: z.enum(["accrued", "confirmed", "archived"]).optional(),
    amountMinor: z.coerce.number().int().min(0).optional(),
    currencyCode: z.string().min(1).max(32).optional(),
    batchId: z.string().min(1).max(128).optional(),
  })
  .refine((d) => d.status != null || d.amountMinor != null || d.currencyCode != null || d.batchId != null, {
    message: "At least one of status, amountMinor, currencyCode, batchId is required",
  });

/** POST /internal/reputation-events (V5-F stub; optional same bearer as metrics). */
export const reputationOutboundSchema = z.object({
  idempotencyKey: z.string().min(1).max(256),
  eventType: z.string().min(1).max(128),
  subjectType: z.string().min(1).max(64),
  subjectId: z.string().min(1).max(256),
  payload: z.record(z.string(), z.unknown()).optional(),
  /** V7-F: XRPL token standard rail tags (validated against `REPUTATION_XLS_ALLOWLIST` when configured). */
  tokenStandardRefs: z.array(z.string().min(1).max(64)).max(32).optional(),
});

/** POST /internal/reputation-delivery/retry (V8-F) — re-queue a failed outbound by idempotency key. */
export const reputationDeliveryRetrySchema = z.object({
  idempotencyKey: z.string().min(1).max(256),
});

/** POST /v1/operator/dispute-verifier-registry */
export const disputeVerifierRegistryUpsertSchema = z.object({
  verifierId: z.string().min(1).max(256),
  displayLabel: z.string().min(1).max(256).optional(),
  active: z.boolean().optional().default(true),
});

export type ReputationOutboundBody = z.infer<typeof reputationOutboundSchema>;

const disputeStatusEnum = z.enum([
  "filed",
  "under_review",
  "decided",
  "execution_pending",
  "executed",
  "closed",
  "rejected",
]);

/** GET /v1/contracts (Operator Console list) */
export const contractListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  status: contractStatusValueSchema.optional(),
  tenantId: z.string().min(1).optional(),
  landlordId: z.string().min(1).optional(),
  updatedFrom: z.string().min(4).optional(),
  updatedTo: z.string().min(4).optional(),
});

/** GET /v1/disputes (Operator Console list) */
export const disputeListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  contractId: z.string().min(1).optional(),
  status: disputeStatusEnum.optional(),
  updatedFrom: z.string().min(4).optional(),
  updatedTo: z.string().min(4).optional(),
});

/** GET /v1/xrpl/transactions (tracked tx list) */
export const xrplTxListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
  account: z.string().min(20).optional(),
  trackingStatus: z.string().min(1).optional(),
  validated: z.enum(["true", "false"]).optional(),
  network: z.enum(["testnet", "mainnet"]).optional(),
});

/** PATCH /v1/contracts/:contractId/escrow-anchor */
export const contractEscrowAnchorSchema = z.object({
  txHash: z.string().min(8).max(128),
});

/** GET /v1/events */
export const eventListQuerySchema = z.object({
  entityType: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
  eventType: z.string().min(1).optional(),
});

/** GET /v1/reports/summary (V5-D) */
export const reportSummaryQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  tenantId: z.string().min(1).optional(),
  landlordId: z.string().min(1).optional(),
});

/** GET /v1/reports/audits.ndjson — hard cap `limit` rows (chronological). */
export const reportAuditsNdjsonQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  entityType: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100_000).optional().default(50_000),
});

/** GET /v1/reports/audits.csv — same query contract as `audits.ndjson`. */
export const reportAuditsCsvQuerySchema = reportAuditsNdjsonQuerySchema;

/** GET /v1/audits — optional keyset mode when `limit` and/or `cursor` is present. */
export const auditsListQuerySchema = z.object({
  entityType: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(2000).optional(),
  cursor: z.string().optional(),
});

/** PATCH /v1/operator/evidences/:evidenceId/metadata */
export const evidenceMetadataPatchSchema = z.object({
  retentionClass: z.enum(["standard", "regulated", "legal_hold"]).optional(),
  jurisdiction: z.union([z.string().min(1).max(128), z.null()]).optional(),
  legalHoldUntil: z.union([z.string().min(8), z.null()]).optional(),
  retainUntil: z.union([z.string().min(8), z.null()]).optional(),
});

/** GET /v1/operator/notifications/outbox */
export const notificationOutboxListQuerySchema = z.object({
  status: z.enum(["pending", "processing", "dispatched", "dead"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
});

/** POST /v1/reports/export-jobs */
export const createExportJobSchema = z.object({
  kind: z.literal("audits_ndjson"),
  filter: z.object({
    entityType: z.string().min(1).optional(),
    entityId: z.string().min(1).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
  maxExport: z.coerce.number().int().min(1).max(100_000).optional().default(25_000),
});
