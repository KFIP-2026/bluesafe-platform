import express, { type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import type { EscrowCancel, EscrowFinish } from "xrpl";
import { bluesafeAuthMiddleware, blockAuditorWriteOperations, v1ApiTransportGuard, requireRoles, requireOperatorScopes } from "./auth.js";
import { config } from "./config.js";
import { renderPrometheusText } from "./metrics/prometheus-text.js";
import {
  accountEscrowsQuerySchema,
  backfillSchema,
  contractEscrowAnchorSchema,
  contractListQuerySchema,
  contractStatusSchema,
  createContractSchema,
  createDisputeSchema,
  decisionSchema,
  disputeListQuerySchema,
  disputeStatusPatchSchema,
  disputeVerifierVoteSchema,
  eventListQuerySchema,
  evidenceUploadFormSchema,
  executionSchema,
  notificationDispatchSchema,
  notifySchema,
  reportAuditsNdjsonQuerySchema,
  reportAuditsCsvQuerySchema,
  auditsListQuerySchema,
  evidenceMetadataPatchSchema,
  reportSummaryQuerySchema,
  createExportJobSchema,
  disputeVerifierRegistryUpsertSchema,
  notificationOutboxListQuerySchema,
  reputationOutboundSchema,
  reputationDeliveryRetrySchema,
  settlementListQuerySchema,
  settlementStatusPatchSchema,
  trackTxSchema,
  verifyEvidenceSchema,
  xrplTxListQuerySchema,
} from "./schemas.js";
import { fetchEvidenceBytesFromPublicGateway } from "./services/evidence-ipfs-fetch.js";
import { routedChannelsForEventType } from "./services/notification-routing.js";
import { assertMimeAllowedForEvidenceCategory } from "./services/evidence-mime.js";
import { EVIDENCE_ENCRYPTION_SCHEME, decryptEvidenceBuffer, encryptEvidenceBuffer } from "./services/evidence-crypto.js";
import { resolveEvidenceDataKey } from "./services/evidence-dek.js";
import { createNotificationProvider } from "./services/notification.provider.js";
import { maybeEnqueueDomainNotifications, contractPartyRecipientIds } from "./services/domain-notifications.js";
import { enqueueSettlementConfirmedNotifications } from "./services/settlement-notifications.js";
import { signExportArtifactToken, verifyExportArtifactToken } from "./services/export-artifact-token.js";
import { scheduleReputationOutboundWebhook } from "./services/reputation-outbound.js";
import { recordAuditListDurationMs } from "./services/audit-list-metrics.js";
import { decodeAuditCursor } from "./services/audit-cursor.js";
import { auditLogCsvHeader, auditLogToCsvRow } from "./services/audit-csv.js";
import { getXrplOperationsSnapshot } from "./services/xrpl-operations-profile.js";
import { getReputationDlq, listReputationDlq } from "./services/reputation-dlq.js";
import { trySubmitDisputeExecution } from "./services/execution-submit.js";
import { recordExecutionRequest } from "./services/execution-metrics.js";
import { getExecutionPolicySnapshot, syntheticExecutionPathEffective } from "./services/execution-policy.js";
import { startExportJobWorker } from "./services/export-job.worker.js";
import { startNotificationOutboxFanoutWorker } from "./services/notification-outbox.worker.js";
import { startNotificationWorker } from "./services/notification.worker.js";
import { getXrplSubscribeHealthSnapshot } from "./services/xrpl-subscribe-state.js";
import { recordXrplBackfillLiveApply } from "./services/xrpl-watcher-metrics.js";
import { getXrplTxPolicyMetricsSnapshot } from "./services/xrpl-tx-policy-metrics.js";
import { startXrplSubscribeWorker } from "./services/xrpl-subscribe.worker.js";
import { startXrplTxPolicyWorker } from "./services/xrpl-tx-policy.worker.js";
import { applyLiveTxStatus } from "./services/xrpl-tx-reconcile.js";
import { xrplService, type LiveTxStatus } from "./services/xrpl.service.js";
import { ipfsService } from "./services/ipfs.service.js";
import { getRepo, initAppRepository } from "./repository/context.js";
import type { AuditFilter } from "./repository/app-repository.js";
import type {
  Contract,
  DisputeCase,
  DisputeVerifierRegistryEntry,
  DisputeVerifierVoteRecord,
  EvidenceFile,
  SettlementRecord,
} from "./types.js";
import {
  classifyXrplResultCode,
  emitEvent,
  generateCidFromHash,
  nowIso,
  randomId,
  sha256,
  writeAudit,
  xrplTxClientPolicyHint,
} from "./utils.js";

const app = express();
const evidenceMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.evidenceVault.maxUploadBytes },
});
const PORT = config.port;

const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5179,http://127.0.0.1:5179")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && corsOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Bluesafe-Role, X-Bluesafe-Tenant-Id, X-Bluesafe-Landlord-Id, X-Bluesafe-Operator-Scopes",
    );
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "5mb" }));
app.get("/internal/prometheus", (req: Request, res: Response) => {
  const tok = process.env.METRICS_SCRAPE_TOKEN?.trim();
  if (tok) {
    const h = req.headers.authorization;
    if (h !== `Bearer ${tok}`) {
      return res.status(401).setHeader("WWW-Authenticate", "Bearer").send("metrics auth required");
    }
  }
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(renderPrometheusText());
});
app.post("/internal/reputation-events", async (req: Request, res: Response) => {
  const tok = process.env.METRICS_SCRAPE_TOKEN?.trim();
  if (tok) {
    const h = req.headers.authorization;
    if (h !== `Bearer ${tok}`) {
      return res.status(401).setHeader("WWW-Authenticate", "Bearer").send("reputation hook auth required");
    }
  }
  const parsed = reputationOutboundSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }
  const allow = config.reputation.xlsAllowlist;
  if (allow.length && parsed.data.tokenStandardRefs?.length) {
    for (const ref of parsed.data.tokenStandardRefs) {
      if (!allow.includes(ref)) {
        return res.status(400).json({
          errorCode: "B2_VALIDATION_ERROR",
          message: `tokenStandardRef not in REPUTATION_XLS_ALLOWLIST: ${ref}`,
        });
      }
    }
  }
  await emitEvent({
    eventType: "reputation.outbound_queued",
    entityType: parsed.data.subjectType,
    entityId: parsed.data.subjectId,
    payload: {
      idempotencyKey: parsed.data.idempotencyKey,
      eventType: parsed.data.eventType,
      ...(parsed.data.payload ?? {}),
      ...(parsed.data.tokenStandardRefs?.length ? { tokenStandardRefs: parsed.data.tokenStandardRefs } : {}),
    },
  });
  await writeAudit({
    entityType: "reputation",
    entityId: parsed.data.idempotencyKey,
    action: "reputation.outbound_queued",
    actorId: "internal_hook",
    metadata: { eventType: parsed.data.eventType, subjectType: parsed.data.subjectType, subjectId: parsed.data.subjectId },
  });
  scheduleReputationOutboundWebhook(parsed.data);
  return res.status(202).json({ accepted: true });
});

app.get("/internal/reputation-delivery", (req: Request, res: Response) => {
  const tok = process.env.METRICS_SCRAPE_TOKEN?.trim();
  if (tok) {
    const h = req.headers.authorization;
    if (h !== `Bearer ${tok}`) {
      return res.status(401).setHeader("WWW-Authenticate", "Bearer").json({
        errorCode: "B2_UNAUTHORIZED",
        message: "internal reputation hook auth required",
      });
    }
  }
  const lim = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const items = listReputationDlq(lim);
  return res.json({ count: items.length, items });
});

app.post("/internal/reputation-delivery/retry", async (req: Request, res: Response) => {
  const tok = process.env.METRICS_SCRAPE_TOKEN?.trim();
  if (tok) {
    const h = req.headers.authorization;
    if (h !== `Bearer ${tok}`) {
      return res.status(401).setHeader("WWW-Authenticate", "Bearer").json({
        errorCode: "B2_UNAUTHORIZED",
        message: "internal reputation hook auth required",
      });
    }
  }
  const parsed = reputationDeliveryRetrySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }
  const entry = getReputationDlq(parsed.data.idempotencyKey);
  if (!entry) {
    return res.status(404).json({
      errorCode: "B2_NOT_FOUND",
      message: "No DLQ entry for this idempotencyKey",
    });
  }
  scheduleReputationOutboundWebhook(entry.body);
  await writeAudit({
    entityType: "reputation",
    entityId: entry.idempotencyKey,
    action: "reputation.outbound_retry_queued",
    actorId: "internal_hook",
    metadata: { attempts: entry.attempts },
  });
  return res.status(202).json({ requeued: true, idempotencyKey: entry.idempotencyKey });
});

app.get("/export/artifacts", async (req: Request, res: Response) => {
  const secret = config.exportJobs.artifactSigningSecret;
  if (!secret) {
    return res.status(503).send("export artifact signing not configured");
  }
  const token = String(req.query.token || "");
  const payload = verifyExportArtifactToken(secret, token);
  if (!payload) {
    return res.status(401).json({
      errorCode: "B2_UNAUTHORIZED",
      message: "Invalid or expired export token",
    });
  }
  const r = getRepo();
  const job = await r.getExportJob(payload.jobId);
  if (!job || job.status !== "completed" || job.resultNdjson == null) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Export artifact not found" });
  }
  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="export-${payload.jobId}.ndjson"`);
  res.setHeader("Cache-Control", "no-store");
  return res.send(job.resultNdjson);
});
app.use("/v1", v1ApiTransportGuard);
app.use("/v1", bluesafeAuthMiddleware);
app.use("/v1", blockAuditorWriteOperations);

function parseRippledMarker(raw: string | undefined): unknown {
  if (raw === undefined || raw === "") return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

app.get("/health", async (req: Request, res: Response) => {
  const wantDeep = config.health.deepDefault || String(req.query.deep || "") === "1";
  const base = { ok: true as const, service: "bluesafe-backend2" as const, now: nowIso() };
  if (!wantDeep) {
    return res.json(base);
  }
  try {
    const r = getRepo();
    const ping = await r.pingStorage();
    const db: "ok" | "skip" | "error" = r.kind === "memory" ? "skip" : ping.ok ? "ok" : "error";
    const xrplPing = await xrplService.pingRippled();
    const xrpl: "ok" | "disabled" | "degraded" =
      xrplPing.detail === "disabled" ? "disabled" : xrplPing.ok ? "ok" : "degraded";
    const subscribeHealth =
      config.xrpl.enabled && !config.xrplSubscribe.disabled ? getXrplSubscribeHealthSnapshot() : undefined;
    const xrplTxPolicy = config.xrpl.enabled
      ? {
          workerDisabled: config.xrplTxPolicy.workerDisabled,
          intervalMs: config.xrplTxPolicy.intervalMs,
          pendingTimeoutMs: config.xrplTxPolicy.pendingTimeoutMs,
          batchSize: config.xrplTxPolicy.batchSize,
          maxNotFoundProbes: config.xrplTxPolicy.maxNotFoundProbes,
          maxBackoffMs: config.xrplTxPolicy.maxBackoffMs,
          accountBackfillPerTick: config.xrplTxPolicy.accountBackfillPerTick,
          logSummaryTick: config.xrplTxPolicy.logSummaryTick,
          transactionsStream: config.xrplSubscribe.transactionsStream,
          subscribeLogReconnects: config.xrplSubscribe.logReconnects,
          metrics: getXrplTxPolicyMetricsSnapshot(),
        }
      : undefined;
    return res.json({
      ...base,
      storage: r.kind,
      db,
      xrpl,
      ...(subscribeHealth ? { xrplSubscribe: subscribeHealth } : {}),
      ...(xrplTxPolicy ? { xrplTxPolicy } : {}),
      executionPolicy: getExecutionPolicySnapshot(),
      xrplOperations: getXrplOperationsSnapshot(),
      ...(db === "error" && ping.detail ? { dbDetail: ping.detail } : {}),
      ...(xrpl === "degraded" && xrplPing.detail ? { xrplDetail: xrplPing.detail } : {}),
    });
  } catch (e) {
    return res.status(503).json({
      ok: false,
      service: "bluesafe-backend2",
      now: nowIso(),
      error: e instanceof Error ? e.message : "health_check_failed",
    });
  }
});

function parseOptionalIso(name: string, value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  const t = Date.parse(value);
  if (Number.isNaN(t)) {
    throw new Error(`${name} must be a valid ISO 8601 timestamp`);
  }
  return value;
}

function canAccessContract(req: Request, contract: Pick<Contract, "tenantId" | "landlordId">): boolean {
  if (!config.auth.enabled) return true;
  const a = req.bluesafeAuth;
  if (!a) return false;
  if (a.role === "auditor") return true;
  if (a.role === "operator" || a.role === "verifier") return true;
  if (a.role === "tenant" && a.tenantId === contract.tenantId) return true;
  if (a.role === "landlord" && a.landlordId === contract.landlordId) return true;
  return false;
}

async function canAccessDispute(req: Request, dispute: DisputeCase): Promise<boolean> {
  const contract = await getRepo().getContract(dispute.contractId);
  if (!contract) return false;
  return canAccessContract(req, contract);
}

function settlementTransitionAllowed(
  from: SettlementRecord["status"],
  to: SettlementRecord["status"],
): boolean {
  if (from === to) return true;
  if (from === "archived") return false;
  if (to === "archived") return true;
  if (from === "collecting" && (to === "accrued" || to === "confirmed")) return true;
  if (from === "accrued" && to === "confirmed") return true;
  return false;
}

async function canAccessSettlement(req: Request, settlement: SettlementRecord): Promise<boolean> {
  const contract = await getRepo().getContract(settlement.contractId);
  if (!contract) return false;
  return canAccessContract(req, contract);
}

function isDisputeReviewStatusAllowed(from: DisputeCase["status"], to: DisputeCase["status"]): boolean {
  if (from === "filed" && to === "under_review") return true;
  if (from === "under_review" && to === "filed") return true;
  return false;
}

function assertCreateContractAllowed(req: Request, tenantId: string, landlordId: string): boolean {
  if (!config.auth.enabled) return true;
  const a = req.bluesafeAuth;
  if (!a) return false;
  if (a.role === "auditor") return false;
  if (a.role === "operator" || a.role === "verifier") return true;
  if (a.role === "tenant" && a.tenantId === tenantId) return true;
  if (a.role === "landlord" && a.landlordId === landlordId) return true;
  return false;
}

function isContractStatusTransitionAllowed(
  from:
    | "draft"
    | "escrow_pending"
    | "escrow_validated"
    | "active"
    | "closed"
    | "cancelled",
  to:
    | "draft"
    | "escrow_pending"
    | "escrow_validated"
    | "active"
    | "closed"
    | "cancelled",
): boolean {
  const allowed: Record<string, string[]> = {
    draft: ["escrow_pending", "cancelled"],
    escrow_pending: ["escrow_validated", "cancelled"],
    escrow_validated: ["active", "cancelled"],
    active: ["closed", "cancelled"],
    closed: [],
    cancelled: [],
  };
  return allowed[from]?.includes(to) ?? false;
}

app.post(
  "/v1/contracts",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const parsed = createContractSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }
  if (!assertCreateContractAllowed(req, parsed.data.tenantId, parsed.data.landlordId)) {
    return res.status(403).json({
      errorCode: "B2_FORBIDDEN",
      message: "Cannot create contract for another party with the current role",
    });
  }
  const now = nowIso();
  const id = randomId("ctr");
  const r = getRepo();
  await r.saveContract({
    id,
    tenantId: parsed.data.tenantId,
    landlordId: parsed.data.landlordId,
    status: "draft",
    depositAmount: parsed.data.depositAmount,
    stakeAmount: parsed.data.stakeAmount,
    startsAt: parsed.data.startsAt,
    endsAt: parsed.data.endsAt,
    createdAt: now,
    updatedAt: now,
  });

  await writeAudit({
    entityType: "contract",
    entityId: id,
    action: "contract.created",
    actorId: "operator_local",
    after: {
      tenantId: parsed.data.tenantId,
      landlordId: parsed.data.landlordId,
      status: "draft",
      depositAmount: parsed.data.depositAmount,
      stakeAmount: parsed.data.stakeAmount,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
    },
  });
  await emitEvent({
    eventType: "contract.created",
    entityType: "contract",
    entityId: id,
    payload: { status: "draft" },
  });

  const created = await r.getContract(id);
  return res.status(201).json(created);
  },
);

app.get(
  "/v1/contracts",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const parsed = contractListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }
  let updatedFrom: string | undefined;
  let updatedTo: string | undefined;
  try {
    updatedFrom = parseOptionalIso("updatedFrom", parsed.data.updatedFrom);
    updatedTo = parseOptionalIso("updatedTo", parsed.data.updatedTo);
  } catch (e) {
    return res.status(400).json({
      errorCode: "B2_VALIDATION_ERROR",
      message: e instanceof Error ? e.message : "Invalid query",
    });
  }
  const filter: {
    status?: string;
    tenantId?: string;
    landlordId?: string;
    updatedFrom?: string;
    updatedTo?: string;
  } = {
    status: parsed.data.status,
    tenantId: parsed.data.tenantId,
    landlordId: parsed.data.landlordId,
    updatedFrom,
    updatedTo,
  };
  if (config.auth.enabled && req.bluesafeAuth) {
    if (req.bluesafeAuth.role === "tenant") {
      filter.tenantId = req.bluesafeAuth.tenantId;
    } else if (req.bluesafeAuth.role === "landlord") {
      filter.landlordId = req.bluesafeAuth.landlordId;
    }
  }
  const page = await getRepo().listContractsPage(filter, {
    limit: parsed.data.limit,
    offset: parsed.data.offset,
  });
  return res.json(page);
  },
);

app.get(
  "/v1/contracts/:contractId",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const contractId = String(req.params.contractId);
  const contract = await getRepo().getContract(contractId);
  if (!contract) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Contract not found" });
  }
  if (!canAccessContract(req, contract)) {
    return res.status(403).json({ errorCode: "B2_FORBIDDEN", message: "Not allowed to view this contract" });
  }
  return res.json(contract);
  },
);

app.patch(
  "/v1/contracts/:contractId/status",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const parsed = contractStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }
  const contractId = String(req.params.contractId);
  const r = getRepo();
  const contract = await r.getContract(contractId);
  if (!contract) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Contract not found" });
  }
  if (!canAccessContract(req, contract)) {
    return res.status(403).json({ errorCode: "B2_FORBIDDEN", message: "Not allowed to update this contract" });
  }
  if (!isContractStatusTransitionAllowed(contract.status, parsed.data.status)) {
    return res.status(409).json({
      errorCode: "B2_VALIDATION_ERROR",
      message: `Invalid contract status transition: ${contract.status} -> ${parsed.data.status}`,
    });
  }
  const before = contract.status;
  contract.status = parsed.data.status;
  contract.updatedAt = nowIso();
  await r.saveContract(contract);

  await writeAudit({
    entityType: "contract",
    entityId: contract.id,
    action: "contract.status_changed",
    actorId: "operator_local",
    before: { status: before },
    after: { status: contract.status },
  });
  await emitEvent({
    eventType: "contract.status_changed",
    entityType: "contract",
    entityId: contract.id,
    payload: { before, after: contract.status },
  });

  const contractForN = await r.getContract(contract.id);
  if (contractForN) {
    if (contract.status === "closed") {
      await maybeEnqueueDomainNotifications(getRepo, {
        eventType: "contract.lifecycle_closed",
        recipientIds: contractPartyRecipientIds(contractForN),
        payload: { contractId: contract.id, status: contract.status },
      });
    } else if (contract.status === "cancelled") {
      await maybeEnqueueDomainNotifications(getRepo, {
        eventType: "refund.contract_cancelled",
        recipientIds: contractPartyRecipientIds(contractForN),
        payload: { contractId: contract.id, status: contract.status },
      });
    }
  }

  return res.json(contract);
  },
);

app.patch(
  "/v1/contracts/:contractId/escrow-anchor",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
    const parsed = contractEscrowAnchorSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
    }
    const contractId = String(req.params.contractId);
    const r = getRepo();
    const contract = await r.getContract(contractId);
    if (!contract) {
      return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Contract not found" });
    }
    if (!canAccessContract(req, contract)) {
      return res.status(403).json({ errorCode: "B2_FORBIDDEN", message: "Not allowed to update this contract" });
    }
    if (contract.status === "active" || contract.status === "closed" || contract.status === "cancelled") {
      return res.status(409).json({
        errorCode: "B2_VALIDATION_ERROR",
        message: `Escrow anchor cannot be updated in status ${contract.status}`,
      });
    }

    const txHash = parsed.data.txHash.trim();
    if (contract.status === "escrow_validated" && contract.escrowCreateTxHash && contract.escrowCreateTxHash !== txHash) {
      return res.status(409).json({
        errorCode: "B2_VALIDATION_ERROR",
        message: "Escrow tx hash is already validated; changing tx hash is not allowed",
      });
    }

    const beforeStatus = contract.status;
    const beforeEscrowHash = contract.escrowCreateTxHash;
    contract.escrowCreateTxHash = txHash;

    if (contract.status === "draft") {
      if (!isContractStatusTransitionAllowed("draft", "escrow_pending")) {
        return res.status(409).json({ errorCode: "B2_VALIDATION_ERROR", message: "Invalid transition draft -> escrow_pending" });
      }
      contract.status = "escrow_pending";
    }

    let reconciledToValidated = false;
    if (xrplService.isEnabled()) {
      try {
        let live: LiveTxStatus | null = await xrplService.getTxStatus(txHash);
        if (!live && contract.tenantId) {
          const map = await xrplService.getAccountTxResults(contract.tenantId);
          live = map[txHash] ?? null;
        }
        if (!live && contract.landlordId) {
          const map = await xrplService.getAccountTxResults(contract.landlordId);
          live = map[txHash] ?? null;
        }
        if (
          live?.validated &&
          live.resultCode === "tesSUCCESS" &&
          live.transactionType === "EscrowCreate" &&
          contract.status === "escrow_pending" &&
          isContractStatusTransitionAllowed("escrow_pending", "escrow_validated")
        ) {
          contract.status = "escrow_validated";
          reconciledToValidated = true;
        }
      } catch {
        /* keep escrow_pending */
      }
    }

    contract.updatedAt = nowIso();
    await r.saveContract(contract);

    await writeAudit({
      entityType: "contract",
      entityId: contract.id,
      action: "contract.escrow_anchor_updated",
      actorId: "operator_local",
      before: { status: beforeStatus, escrowCreateTxHash: beforeEscrowHash },
      after: { status: contract.status, escrowCreateTxHash: txHash, reconciledToValidated },
    });
    await emitEvent({
      eventType: "contract.escrow_anchor_updated",
      entityType: "contract",
      entityId: contract.id,
      payload: { txHash, status: contract.status, reconciledToValidated },
    });

    return res.json(contract);
  },
);

app.post(
  "/v1/evidences",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  (req: Request, res: Response, next: NextFunction) => {
    evidenceMulter.single("file")(req, res, (err: unknown) => {
      const multerErr = err as { code?: string } | undefined;
      if (multerErr?.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          errorCode: "B2_EVIDENCE_TOO_LARGE",
          message: `Evidence file exceeds limit of ${config.evidenceVault.maxUploadBytes} bytes`,
        });
      }
      if (err) return next(err);
      void handlePostEvidence(req, res).catch(next);
    });
  },
);

async function handlePostEvidence(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: "file is required" });
    return;
  }

  const parsed = evidenceUploadFormSchema.safeParse({
    contractId: req.body.contractId,
    disputeId: req.body.disputeId,
    category: req.body.category,
    uploaderId: req.body.uploaderId,
    retentionDays: req.body.retentionDays,
  });
  if (!parsed.success) {
    res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
    return;
  }

  const { contractId, disputeId, category, uploaderId: formUploaderId, retentionDays } = parsed.data;
  const uploaderId = formUploaderId?.trim() || "operator_local";

  if (retentionDays != null && retentionDays > config.evidenceVault.maxRetentionDays) {
    res.status(400).json({
      errorCode: "B2_VALIDATION_ERROR",
      message: `retentionDays must be <= ${config.evidenceVault.maxRetentionDays}`,
    });
    return;
  }

  const r = getRepo();
  const contract = await r.getContract(contractId);
  if (!contract) {
    res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Contract not found" });
    return;
  }
  if (!canAccessContract(req, contract)) {
    res.status(403).json({
      errorCode: "B2_FORBIDDEN",
      message: "Not allowed to upload evidence for this contract",
    });
    return;
  }

  if (disputeId) {
    const dispute = await r.getDispute(disputeId);
    if (!dispute || dispute.contractId !== contractId) {
      res.status(400).json({
        errorCode: "B2_VALIDATION_ERROR",
        message: "disputeId must refer to a dispute on the given contractId",
      });
      return;
    }
  }

  try {
    assertMimeAllowedForEvidenceCategory(file.mimetype || "application/octet-stream", category);
  } catch (e) {
    res.status(400).json({
      errorCode: "B2_EVIDENCE_MIME_NOT_ALLOWED",
      message: e instanceof Error ? e.message : "MIME not allowed for this category",
    });
    return;
  }

  const plaintextBuffer = file.buffer;
  const hash = sha256(plaintextBuffer);
  let encryptionScheme: EvidenceFile["encryptionScheme"] | undefined;
  let payloadBuffer = plaintextBuffer;
  let dekSource: string | undefined;
  try {
    const resolved = await resolveEvidenceDataKey();
    if (resolved) {
      payloadBuffer = encryptEvidenceBuffer(plaintextBuffer, resolved.key);
      encryptionScheme = EVIDENCE_ENCRYPTION_SCHEME;
      dekSource = resolved.source;
    }
  } catch (e) {
    res.status(500).json({
      errorCode: "B2_CONFIG_ERROR",
      message: e instanceof Error ? e.message : "Evidence encryption key misconfigured",
    });
    return;
  }

  let uploadResult: { cid: string; provider: "mock" | "pinata" };
  try {
    uploadResult = await ipfsService.upload({
      buffer: payloadBuffer,
      fileName: file.originalname || "evidence.bin",
      mimeType: file.mimetype || "application/octet-stream",
      sha256: hash,
    });
  } catch (error) {
    res.status(502).json({
      errorCode: "B2_IPFS_UPLOAD_FAILED",
      message: error instanceof Error ? error.message : "IPFS upload failed",
    });
    return;
  }

  const cid = uploadResult.cid || generateCidFromHash(hash);
  const evidenceId = randomId("evd");
  const existingVersionCount = await r.countEvidenceVersions(contractId, disputeId, category);
  const version = existingVersionCount + 1;
  const createdAt = nowIso();
  const retainDays =
    retentionDays != null ? Math.min(retentionDays, config.evidenceVault.maxRetentionDays) : undefined;
  const retainUntil =
    retainDays != null ? new Date(Date.now() + retainDays * 86_400_000).toISOString() : undefined;

  const evidence: EvidenceFile = {
    id: evidenceId,
    contractId,
    disputeId,
    uploaderId,
    category,
    cid,
    sha256: hash,
    mimeType: file.mimetype || "application/octet-stream",
    sizeBytes: file.size,
    version,
    isEncrypted: Boolean(encryptionScheme),
    encryptionScheme,
    retainUntil,
    retentionClass: "standard",
    storageProvider: uploadResult.provider,
    createdAt,
    localContentHashSeed: hash,
  };
  await r.saveEvidence(evidence);

  await writeAudit({
    entityType: "evidence",
    entityId: evidenceId,
    action: "evidence.uploaded",
    actorId: uploaderId,
    after: {
      cid,
      version,
      contractId,
      disputeId,
      category,
      provider: uploadResult.provider,
      encryptionScheme: encryptionScheme ?? null,
      retainUntil: retainUntil ?? null,
      ...(config.evidenceVault.kmsKeyRef ? { kmsKeyRef: config.evidenceVault.kmsKeyRef } : {}),
      ...(dekSource ? { dekSource } : {}),
    },
  });
  await emitEvent({
    eventType: "evidence.uploaded",
    entityType: "evidence",
    entityId: evidenceId,
    payload: { contractId, disputeId, cid, version },
  });

  res.status(201).json({
    evidenceId,
    cid,
    sha256: hash,
    version,
    createdAt: evidence.createdAt,
    encryptionScheme: evidence.encryptionScheme,
    retainUntil: evidence.retainUntil,
    retentionClass: evidence.retentionClass,
  });
}

async function upsertTrackedTx(
  txHash: string,
  params: {
    txType: string;
    account?: string;
    disputeId?: string;
    network: "testnet" | "mainnet";
  },
): Promise<void> {
  const now = nowIso();
  const r = getRepo();
  const existing = await r.getXrplTx(txHash);
  await r.saveXrplTx({
    id: existing?.id ?? randomId("xrt"),
    txHash,
    txType: params.txType ?? existing?.txType ?? "Unknown",
    account: params.account ?? existing?.account,
    disputeId: params.disputeId ?? existing?.disputeId,
    network: params.network ?? existing?.network ?? "testnet",
    trackingStatus: existing?.trackingStatus ?? "pending_validation",
    validated: existing?.validated ?? false,
    retries: existing?.retries ?? 0,
    resultCode: existing?.resultCode,
    outcomeClass: existing?.outcomeClass,
    ledgerIndex: existing?.ledgerIndex,
    lastCheckedAt: now,
    escrowOwner: existing?.escrowOwner,
    escrowDestination: existing?.escrowDestination,
    escrowOfferSequence: existing?.escrowOfferSequence,
    escrowSubmitterAccount: existing?.escrowSubmitterAccount,
  });
}

app.post(
  "/v1/evidences/verify",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const parsed = verifyEvidenceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }

  const { cid, expectedSha256 } = parsed.data;
  const evidence = await getRepo().findEvidenceByCid(cid);
  if (!evidence) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Evidence by cid not found" });
  }

  const contract = await getRepo().getContract(evidence.contractId);
  if (!contract || !canAccessContract(req, contract)) {
    return res.status(403).json({ errorCode: "B2_FORBIDDEN", message: "Not allowed to verify this evidence" });
  }

  const verified = evidence.sha256 === expectedSha256;
  await writeAudit({
    entityType: "evidence",
    entityId: evidence.id,
    action: "evidence.verified",
    actorId: "system",
    metadata: { verified },
  });

  return res.json({
    verified,
    cid,
    actualSha256: evidence.sha256,
  });
  },
);

app.get(
  "/v1/evidences/:evidenceId",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const evidenceId = String(req.params.evidenceId);
  const evidence = await getRepo().getEvidence(evidenceId);
  if (!evidence) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Evidence not found" });
  }

  const contract = await getRepo().getContract(evidence.contractId);
  if (!contract || !canAccessContract(req, contract)) {
    return res.status(403).json({ errorCode: "B2_FORBIDDEN", message: "Not allowed to read this evidence" });
  }

  await writeAudit({
    entityType: "evidence",
    entityId: evidence.id,
    action: "evidence.read",
    actorId: "operator_local",
  });

  const { localContentHashSeed: _hidden, ...response } = evidence;
  return res.json(response);
  },
);

app.get(
  "/v1/evidences/:evidenceId/content",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const evidenceId = String(req.params.evidenceId);
  const evidence = await getRepo().getEvidence(evidenceId);
  if (!evidence) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Evidence not found" });
  }
  const contract = await getRepo().getContract(evidence.contractId);
  if (!contract || !canAccessContract(req, contract)) {
    return res.status(403).json({ errorCode: "B2_FORBIDDEN", message: "Not allowed to download this evidence" });
  }

  let body: Buffer;
  if (evidence.storageProvider === "mock") {
    body = Buffer.from(`mock-evidence:${evidence.id}:${evidence.sha256.slice(0, 48)}`, "utf8");
  } else {
    try {
      body = await fetchEvidenceBytesFromPublicGateway(evidence.cid);
    } catch (e) {
      return res.status(502).json({
        errorCode: "B2_EVIDENCE_FETCH_FAILED",
        message: e instanceof Error ? e.message : "gateway fetch failed",
      });
    }
  }

  if (evidence.encryptionScheme === "aes-256-gcm-v1") {
    let key: Buffer;
    try {
      const resolved = await resolveEvidenceDataKey();
      if (!resolved) {
        return res.status(500).json({
          errorCode: "B2_CONFIG_ERROR",
          message: "EVIDENCE_ENCRYPTION_KEY, KMS stub DEK, or KMS HTTP unwrap required to decrypt",
        });
      }
      key = resolved.key;
    } catch (e) {
      return res.status(500).json({
        errorCode: "B2_CONFIG_ERROR",
        message: e instanceof Error ? e.message : "Evidence key resolution failed",
      });
    }
    try {
      body = decryptEvidenceBuffer(body, key);
    } catch (e) {
      return res.status(502).json({
        errorCode: "B2_EVIDENCE_DECRYPT_FAILED",
        message: e instanceof Error ? e.message : "decrypt failed",
      });
    }
  }

  if (evidence.storageProvider !== "mock") {
    const digest = sha256(body);
    if (digest !== evidence.sha256) {
      return res.status(502).json({
        errorCode: "B2_EVIDENCE_INTEGRITY",
        message: "Downloaded content sha256 does not match stored digest",
      });
    }
  }

  await writeAudit({
    entityType: "evidence",
    entityId: evidence.id,
    action: "evidence.content_downloaded",
    actorId: req.bluesafeAuth?.role ?? "operator_local",
    metadata: { storageProvider: evidence.storageProvider },
  });

  res.setHeader("Content-Type", evidence.mimeType || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(evidenceId)}"`);
  return res.send(body);
  },
);

app.patch(
  "/v1/operator/evidences/:evidenceId/metadata",
  requireRoles("operator"),
  requireOperatorScopes("evidence"),
  async (req: Request, res: Response) => {
    const parsed = evidenceMetadataPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
    }
    const evidenceId = String(req.params.evidenceId);
    const r = getRepo();
    const evidence = await r.getEvidence(evidenceId);
    if (!evidence) {
      return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Evidence not found" });
    }
    const contract = await r.getContract(evidence.contractId);
    if (!contract || !canAccessContract(req, contract)) {
      return res.status(403).json({ errorCode: "B2_FORBIDDEN", message: "Not allowed to update this evidence" });
    }

    const next: EvidenceFile = { ...evidence };
    if (parsed.data.retentionClass !== undefined) {
      next.retentionClass = parsed.data.retentionClass;
    }
    if (parsed.data.jurisdiction !== undefined) {
      next.jurisdiction = parsed.data.jurisdiction ?? undefined;
    }
    if (parsed.data.legalHoldUntil !== undefined) {
      if (parsed.data.legalHoldUntil === null) {
        next.legalHoldUntil = undefined;
      } else {
        try {
          next.legalHoldUntil = parseOptionalIso("legalHoldUntil", parsed.data.legalHoldUntil);
        } catch (e) {
          return res.status(400).json({
            errorCode: "B2_VALIDATION_ERROR",
            message: e instanceof Error ? e.message : "Invalid legalHoldUntil",
          });
        }
      }
    }
    if (parsed.data.retainUntil !== undefined) {
      if (parsed.data.retainUntil === null) {
        next.retainUntil = undefined;
      } else {
        try {
          next.retainUntil = parseOptionalIso("retainUntil", parsed.data.retainUntil);
        } catch (e) {
          return res.status(400).json({
            errorCode: "B2_VALIDATION_ERROR",
            message: e instanceof Error ? e.message : "Invalid retainUntil",
          });
        }
      }
    }

    await r.saveEvidence(next);
    await writeAudit({
      entityType: "evidence",
      entityId: evidenceId,
      action: "evidence.metadata_updated",
      actorId: req.bluesafeAuth?.role ?? "operator",
      before: {
        retentionClass: evidence.retentionClass ?? "standard",
        jurisdiction: evidence.jurisdiction ?? null,
        legalHoldUntil: evidence.legalHoldUntil ?? null,
        retainUntil: evidence.retainUntil ?? null,
      },
      after: {
        retentionClass: next.retentionClass,
        jurisdiction: next.jurisdiction ?? null,
        legalHoldUntil: next.legalHoldUntil ?? null,
        retainUntil: next.retainUntil ?? null,
      },
    });
    await emitEvent({
      eventType: "evidence.metadata_updated",
      entityType: "evidence",
      entityId: evidenceId,
      payload: { contractId: next.contractId },
    });

    const { localContentHashSeed: _hidden, ...response } = next;
    return res.json(response);
  },
);

app.post(
  "/v1/disputes",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const parsed = createDisputeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }

  const { contractId, raisedBy, reasonCode, evidenceIds } = parsed.data;
  const r = getRepo();
  const contract = await r.getContract(contractId);
  if (!contract) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Contract not found" });
  }
  if (!canAccessContract(req, contract)) {
    return res.status(403).json({
      errorCode: "B2_FORBIDDEN",
      message: "Not allowed to create dispute for this contract",
    });
  }
  for (const id of evidenceIds) {
    const ev = await r.getEvidence(id);
    if (!ev) {
      return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: `Evidence missing: ${id}` });
    }
    if (ev.contractId !== contractId) {
      return res.status(400).json({
        errorCode: "B2_VALIDATION_ERROR",
        message: `Evidence ${id} does not belong to this contract`,
      });
    }
  }

  const disputeId = randomId("dsp");
  const now = nowIso();
  await r.saveDispute({
    id: disputeId,
    contractId,
    raisedBy,
    reasonCode,
    status: "filed",
    evidenceBundle: evidenceIds,
    createdAt: now,
    updatedAt: now,
  });

  await writeAudit({
    entityType: "dispute",
    entityId: disputeId,
    action: "dispute.filed",
    actorId: raisedBy,
    after: { contractId, evidenceCount: evidenceIds.length, reasonCode },
  });
  await emitEvent({
    eventType: "dispute.filed",
    entityType: "dispute",
    entityId: disputeId,
    payload: { contractId, raisedBy, reasonCode },
  });

  await maybeEnqueueDomainNotifications(getRepo, {
    eventType: "dispute.filed",
    recipientIds: contractPartyRecipientIds(contract),
    payload: { disputeId, contractId, raisedBy, reasonCode },
  });

  return res.status(201).json({
    disputeId,
    status: "filed",
    createdAt: now,
  });
  },
);

app.patch(
  "/v1/disputes/:disputeId/status",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const parsed = disputeStatusPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }
  const disputeId = String(req.params.disputeId);
  const r = getRepo();
  const dispute = await r.getDispute(disputeId);
  if (!dispute) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Dispute not found" });
  }
  if (!(await canAccessDispute(req, dispute))) {
    return res.status(403).json({ errorCode: "B2_FORBIDDEN", message: "Not allowed to update this dispute" });
  }

  const next = parsed.data.status;
  if (!isDisputeReviewStatusAllowed(dispute.status, next)) {
    return res.status(409).json({
      errorCode: "B2_VALIDATION_ERROR",
      message: `Cannot transition dispute status ${dispute.status} -> ${next}`,
    });
  }
  if (next === "filed" && config.auth.enabled && req.bluesafeAuth?.role !== "operator") {
    return res.status(403).json({
      errorCode: "B2_FORBIDDEN",
      message: "Only operator may move a dispute from under_review back to filed",
    });
  }

  const before = dispute.status;
  dispute.status = next;
  dispute.updatedAt = nowIso();
  if (next === "under_review") {
    const due = new Date();
    due.setUTCDate(due.getUTCDate() + config.dispute.reviewDeadlineDays);
    dispute.reviewDeadlineAt = due.toISOString();
  }
  if (next === "filed") {
    dispute.reviewDeadlineAt = undefined;
    dispute.escalatedAt = undefined;
  }
  await r.saveDispute(dispute);

  await writeAudit({
    entityType: "dispute",
    entityId: disputeId,
    action: "dispute.status_patched",
    actorId: req.bluesafeAuth?.role ?? "system",
    before: { status: before },
    after: { status: dispute.status },
  });
  if (next === "under_review") {
    await emitEvent({
      eventType: "dispute.review_started",
      entityType: "dispute",
      entityId: disputeId,
      payload: { fromStatus: before },
    });
    const contract = await r.getContract(dispute.contractId);
    if (contract) {
      await maybeEnqueueDomainNotifications(getRepo, {
        eventType: "dispute.review_started",
        recipientIds: contractPartyRecipientIds(contract),
        payload: { disputeId, contractId: dispute.contractId },
      });
    }
  }

  return res.json({ disputeId, status: dispute.status, updatedAt: dispute.updatedAt });
  },
);

app.post(
  "/v1/disputes/:disputeId/verifier-votes",
  requireRoles("operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const parsed = disputeVerifierVoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }
  const disputeId = String(req.params.disputeId);
  const r = getRepo();
  const dispute = await r.getDispute(disputeId);
  if (!dispute) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Dispute not found" });
  }
  if (!(await canAccessDispute(req, dispute))) {
    return res.status(403).json({ errorCode: "B2_FORBIDDEN", message: "Not allowed to vote on this dispute" });
  }
  if (!["filed", "under_review"].includes(dispute.status)) {
    return res.status(409).json({
      errorCode: "B2_VALIDATION_ERROR",
      message: "Verifier votes are only accepted while dispute is filed or under_review",
    });
  }

  const priorVotes = await r.listDisputeVerifierVotes(disputeId);
  if (priorVotes.some((v) => v.verifierId === parsed.data.verifierId)) {
    return res.status(409).json({
      errorCode: "B2_CONFLICT",
      message: "This verifier has already submitted a recommendation for this dispute",
    });
  }

  const vote: DisputeVerifierVoteRecord = {
    id: randomId("dvv"),
    disputeId,
    verifierId: parsed.data.verifierId,
    recommendation: parsed.data.recommendation,
    createdAt: nowIso(),
  };
  await r.appendDisputeVerifierVote(vote);

  await emitEvent({
    eventType: "dispute.verifier_vote",
    entityType: "dispute",
    entityId: disputeId,
    payload: {
      verifierId: parsed.data.verifierId,
      recommendation: parsed.data.recommendation,
    },
  });
  await writeAudit({
    entityType: "dispute",
    entityId: disputeId,
    action: "dispute.verifier_vote",
    actorId: parsed.data.verifierId,
    metadata: { recommendation: parsed.data.recommendation },
  });

  return res.status(201).json({ disputeId, recorded: true });
  },
);

app.get(
  "/v1/disputes/:disputeId/review-state",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const disputeId = String(req.params.disputeId);
  const r = getRepo();
  const dispute = await r.getDispute(disputeId);
  if (!dispute) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Dispute not found" });
  }
  if (!(await canAccessDispute(req, dispute))) {
    return res.status(403).json({ errorCode: "B2_FORBIDDEN", message: "Not allowed to read this dispute" });
  }

  const rows = await r.listDisputeVerifierVotes(disputeId);
  const votes = rows.map((v) => ({
    verifierId: v.verifierId,
    recommendation: v.recommendation,
    occurredAt: v.createdAt,
    eventId: v.id,
  }));

  const tally: Record<string, number> = {};
  for (const v of votes) {
    if (!v.recommendation) continue;
    tally[v.recommendation] = (tally[v.recommendation] ?? 0) + 1;
  }
  const maxCount = Math.max(0, ...Object.values(tally));
  const quorumK = config.dispute.verifierQuorumK;
  const quorumMet = maxCount >= quorumK;

  return res.json({
    disputeId,
    status: dispute.status,
    reviewDeadlineAt: dispute.reviewDeadlineAt,
    escalatedAt: dispute.escalatedAt,
    votes,
    tally,
    quorumMet,
    quorumK,
  });
  },
);

app.post(
  "/v1/disputes/:disputeId/escalate",
  requireRoles("operator"),
  requireOperatorScopes("disputes"),
  async (req: Request, res: Response) => {
  const disputeId = String(req.params.disputeId);
  const r = getRepo();
  const dispute = await r.getDispute(disputeId);
  if (!dispute) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Dispute not found" });
  }
  if (!(await canAccessDispute(req, dispute))) {
    return res.status(403).json({ errorCode: "B2_FORBIDDEN", message: "Not allowed to escalate this dispute" });
  }
  const t = nowIso();
  dispute.escalatedAt = t;
  dispute.updatedAt = t;
  await r.saveDispute(dispute);
  await writeAudit({
    entityType: "dispute",
    entityId: disputeId,
    action: "dispute.escalated",
    actorId: req.bluesafeAuth?.role ?? "operator",
    after: { escalatedAt: t },
  });
  await emitEvent({
    eventType: "dispute.escalated",
    entityType: "dispute",
    entityId: disputeId,
    payload: { reviewDeadlineAt: dispute.reviewDeadlineAt ?? null },
  });
  const contractEsc = await r.getContract(dispute.contractId);
  if (contractEsc) {
    await maybeEnqueueDomainNotifications(getRepo, {
      eventType: "dispute.escalated",
      recipientIds: contractPartyRecipientIds(contractEsc),
      payload: { disputeId, contractId: dispute.contractId },
    });
  }
  return res.json({ disputeId, escalatedAt: t });
  },
);

app.get(
  "/v1/disputes",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const parsed = disputeListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }
  let updatedFrom: string | undefined;
  let updatedTo: string | undefined;
  try {
    updatedFrom = parseOptionalIso("updatedFrom", parsed.data.updatedFrom);
    updatedTo = parseOptionalIso("updatedTo", parsed.data.updatedTo);
  } catch (e) {
    return res.status(400).json({
      errorCode: "B2_VALIDATION_ERROR",
      message: e instanceof Error ? e.message : "Invalid query",
    });
  }
  const page = await getRepo().listDisputesPage(
    {
      contractId: parsed.data.contractId,
      status: parsed.data.status,
      updatedFrom,
      updatedTo,
    },
    { limit: parsed.data.limit, offset: parsed.data.offset },
  );
  return res.json(page);
  },
);

app.post(
  "/v1/disputes/:disputeId/decision",
  requireRoles("operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }
  const disputeId = String(req.params.disputeId);
  const r = getRepo();
  const dispute = await r.getDispute(disputeId);
  if (!dispute) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Dispute not found" });
  }
  if (!(await canAccessDispute(req, dispute))) {
    return res.status(403).json({ errorCode: "B2_FORBIDDEN", message: "Not allowed to record decision for this dispute" });
  }
  if (!["filed", "under_review"].includes(dispute.status)) {
    return res.status(409).json({ errorCode: "B2_VALIDATION_ERROR", message: "Invalid status for decision" });
  }

  const decisionId = randomId("dcs");
  await r.saveDecision({
    id: decisionId,
    disputeId: dispute.id,
    decision: parsed.data.decision,
    decidedBy: "verifier_mock",
    memo: parsed.data.memo,
    createdAt: nowIso(),
  });

  const before = dispute.status;
  dispute.status = "decided";
  dispute.updatedAt = nowIso();
  await r.saveDispute(dispute);

  await writeAudit({
    entityType: "dispute",
    entityId: dispute.id,
    action: "dispute.decision_recorded",
    actorId: "verifier_mock",
    before: { status: before },
    after: { status: dispute.status, decisionId, decision: parsed.data.decision },
  });
  await emitEvent({
    eventType: "dispute.decision_recorded",
    entityType: "dispute",
    entityId: dispute.id,
    payload: { decisionId, decision: parsed.data.decision },
  });

  const contractForNtf = await r.getContract(dispute.contractId);
  if (contractForNtf) {
    await maybeEnqueueDomainNotifications(getRepo, {
      eventType: "dispute.decision_recorded",
      recipientIds: contractPartyRecipientIds(contractForNtf),
      payload: {
        disputeId: dispute.id,
        contractId: dispute.contractId,
        decisionId,
        decision: parsed.data.decision,
      },
    });
  }

  return res.json({
    disputeId: dispute.id,
    status: dispute.status,
    decisionId,
  });
  },
);

function buildEscrowExecutionTx(input: { txType: "EscrowFinish" | "EscrowCancel"; owner: string; offerSequence: string | number }) {
  if (input.txType === "EscrowCancel") {
    const tx: EscrowCancel = {
      TransactionType: "EscrowCancel",
      Account: input.owner,
      Owner: input.owner,
      OfferSequence: input.offerSequence,
    };
    return tx;
  }
  const tx: EscrowFinish = {
    TransactionType: "EscrowFinish",
    Account: input.owner,
    Owner: input.owner,
    OfferSequence: input.offerSequence,
  };
  return tx;
}

app.post(
  "/v1/disputes/:disputeId/execution",
  requireRoles("operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const parsed = executionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }

  const disputeId = String(req.params.disputeId);
  const r = getRepo();
  const dispute = await r.getDispute(disputeId);
  if (!dispute) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Dispute not found" });
  }
  if (!(await canAccessDispute(req, dispute))) {
    return res.status(403).json({ errorCode: "B2_FORBIDDEN", message: "Not allowed to request execution for this dispute" });
  }
  if (dispute.status !== "decided") {
    return res.status(409).json({ errorCode: "B2_VALIDATION_ERROR", message: "Dispute must be decided first" });
  }

  const syntheticAllowed = syntheticExecutionPathEffective();
  const bodyTxHash = parsed.data.txHash ? parsed.data.txHash.toUpperCase() : undefined;

  let txHash: string;
  let ledgerBacked = Boolean(bodyTxHash);
  let isSyntheticResponse = false;

  if (bodyTxHash) {
    txHash = bodyTxHash;
  } else {
    let submitted: { txHash: string } | null = null;
    try {
      submitted = await trySubmitDisputeExecution({
        txType: parsed.data.txType,
        owner: parsed.data.owner,
        offerSequence: parsed.data.offerSequence,
      });
    } catch (e) {
      return res.status(502).json({
        errorCode: "B2_EXECUTION_SUBMIT_FAILED",
        message: e instanceof Error ? e.message : "execution_submit_failed",
      });
    }
    if (submitted) {
      txHash = submitted.txHash;
      ledgerBacked = true;
    } else if (!syntheticAllowed) {
      return res.status(400).json({
        errorCode: "B2_VALIDATION_ERROR",
        message:
          "Ledger-backed execution is required: pass txHash (64 hex), or enable BLUESAFE_EXECUTION_SUBMIT_ENABLED with matching BLUESAFE_EXECUTION_SUBMIT_SEED and XRPL_WSS_URL. If BLUESAFE_EXECUTION_DEPLOYMENT_TIER=strict, synthetic placeholder hashes are never used. See docs/adr/0011-v8-execution-keys-synthetic-hash.md",
      });
    } else {
      txHash = sha256(`${dispute.id}:${parsed.data.txType}:${Date.now()}`).slice(0, 64).toUpperCase();
      isSyntheticResponse = true;
    }
  }

  buildEscrowExecutionTx(parsed.data);
  const now = nowIso();

  if (xrplService.isEnabled()) {
    const live = await xrplService.getTxStatus(txHash);
    if (ledgerBacked && live?.transactionType && live.transactionType !== parsed.data.txType) {
      return res.status(409).json({
        errorCode: "B2_VALIDATION_ERROR",
        message: `Transaction at txHash is ${live.transactionType}, expected ${parsed.data.txType}`,
      });
    }
    await upsertTrackedTx(txHash, {
      txType: parsed.data.txType,
      account: parsed.data.owner,
      disputeId: dispute.id,
      network: parsed.data.network,
    });
    if (live) {
      await applyLiveTxStatus(txHash, live);
    }
  } else {
    await upsertTrackedTx(txHash, {
      txType: parsed.data.txType,
      account: parsed.data.owner,
      disputeId: dispute.id,
      network: parsed.data.network,
    });
  }

  recordExecutionRequest(isSyntheticResponse ? "synthetic" : "ledger_tx");

  const before = dispute.status;
  dispute.status = "execution_pending";
  dispute.updatedAt = now;
  await r.saveDispute(dispute);

  await writeAudit({
    entityType: "dispute",
    entityId: dispute.id,
    action: "dispute.execution_requested",
    actorId: req.bluesafeAuth?.role ?? "operator",
    before: { status: before },
    after: { status: dispute.status, txHash, txType: parsed.data.txType, synthetic: isSyntheticResponse },
  });
  await emitEvent({
    eventType: "dispute.execution_requested",
    entityType: "dispute",
    entityId: dispute.id,
    payload: {
      txHash,
      txType: parsed.data.txType,
      network: parsed.data.network,
      synthetic: isSyntheticResponse,
    },
  });

  const contractExec = await r.getContract(dispute.contractId);
  if (contractExec) {
    await maybeEnqueueDomainNotifications(getRepo, {
      eventType: "dispute.execution_requested",
      recipientIds: contractPartyRecipientIds(contractExec),
      payload: {
        disputeId: dispute.id,
        contractId: dispute.contractId,
        txHash,
        txType: parsed.data.txType,
        synthetic: isSyntheticResponse,
      },
    });
  }

  return res.status(202).json({
    requestId: randomId("exec"),
    status: "execution_pending",
    txHash,
    synthetic: isSyntheticResponse,
  });
  },
);

app.post(
  "/v1/xrpl/track",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const parsed = trackTxSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }

  const { txHash, txType, network, account } = parsed.data;
  await upsertTrackedTx(txHash, {
    txType,
    account,
    network,
  });

  if (xrplService.isEnabled()) {
    const live = await xrplService.getTxStatus(txHash);
    if (live) await applyLiveTxStatus(txHash, live);
  }

  const tracked = await getRepo().getXrplTx(txHash);

  await writeAudit({
    entityType: "xrpl_tx",
    entityId: txHash,
    action: "escrow.tx_submitted",
    actorId: "system",
    after: { txType, network },
  });
  await emitEvent({
    eventType: "escrow.tx_submitted",
    entityType: "xrpl_tx",
    entityId: txHash,
    payload: { txType, network, account: tracked?.account ?? account },
  });

  return res.status(202).json({
    txHash,
    trackingStatus: tracked?.trackingStatus ?? "pending_validation",
    validated: tracked?.validated ?? false,
    account: tracked?.account ?? null,
  });
  },
);

app.get(
  "/v1/xrpl/transactions",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const parsed = xrplTxListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }
  const validated =
    parsed.data.validated === "true" ? true : parsed.data.validated === "false" ? false : undefined;
  const page = await getRepo().listXrplTxsPage(
    {
      account: parsed.data.account,
      trackingStatus: parsed.data.trackingStatus,
      validated,
      network: parsed.data.network,
    },
    { limit: parsed.data.limit, offset: parsed.data.offset },
  );
  return res.json(page);
  },
);

app.get(
  "/v1/xrpl/transactions/:txHash",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const txHash = String(req.params.txHash);
  const r = getRepo();
  const tx = await r.getXrplTx(txHash);
  if (!tx) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Tracked tx not found" });
  }

  const shouldRefresh = String(req.query.refresh || "false").toLowerCase() === "true";
  if (shouldRefresh && xrplService.isEnabled()) {
    const liveStatus = await xrplService.getTxStatus(txHash);
    if (liveStatus) {
      await applyLiveTxStatus(txHash, liveStatus);
    }
  }

  const latest = (await r.getXrplTx(txHash))!;
  const hint = xrplTxClientPolicyHint({
    trackingStatus: latest.trackingStatus,
    validated: latest.validated,
    outcomeClass: latest.outcomeClass ?? classifyXrplResultCode(latest.resultCode),
    resultCode: latest.resultCode,
  });
  return res.json({
    txHash: latest.txHash,
    txType: latest.txType,
    account: latest.account,
    disputeId: latest.disputeId,
    validated: latest.validated,
    resultCode: latest.resultCode,
    outcomeClass: latest.outcomeClass,
    ledgerIndex: latest.ledgerIndex,
    trackingStatus: latest.trackingStatus,
    retries: latest.retries,
    escrowOwner: latest.escrowOwner ?? null,
    escrowDestination: latest.escrowDestination ?? null,
    escrowOfferSequence: latest.escrowOfferSequence ?? null,
    escrowSubmitterAccount: latest.escrowSubmitterAccount ?? null,
    clientPolicyHint: hint,
  });
  },
);

app.post(
  "/v1/xrpl/transactions/:txHash/refresh",
  requireRoles("operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const txHash = String(req.params.txHash);
  const r = getRepo();
  const tx = await r.getXrplTx(txHash);
  if (!tx) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Tracked tx not found" });
  }
  if (!xrplService.isEnabled()) {
    return res.status(400).json({
      errorCode: "B2_VALIDATION_ERROR",
      message: "Live XRPL mode is disabled. Set XRPL_WSS_URL to enable.",
    });
  }

  const liveStatus = await xrplService.getTxStatus(txHash);
  if (!liveStatus) {
    return res.status(404).json({
      errorCode: "B2_NOT_FOUND",
      message: "Transaction not found from XRPL tx method",
    });
  }
  await applyLiveTxStatus(txHash, liveStatus);
  const latest = (await r.getXrplTx(txHash))!;
  const hint = xrplTxClientPolicyHint({
    trackingStatus: latest.trackingStatus,
    validated: latest.validated,
    outcomeClass: latest.outcomeClass ?? classifyXrplResultCode(latest.resultCode),
    resultCode: latest.resultCode,
  });
  return res.json({
    txHash: latest.txHash,
    validated: latest.validated,
    resultCode: latest.resultCode,
    outcomeClass: latest.outcomeClass,
    ledgerIndex: latest.ledgerIndex,
    trackingStatus: latest.trackingStatus,
    clientPolicyHint: hint,
  });
  },
);

app.get(
  "/v1/xrpl/accounts/:account/escrows",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const account = String(req.params.account || "").trim();
  if (account.length < 25 || account.length > 50 || !account.startsWith("r")) {
    return res.status(400).json({
      errorCode: "B2_VALIDATION_ERROR",
      message: "Invalid XRPL classic address",
    });
  }

  const qParsed = accountEscrowsQuerySchema.safeParse(req.query);
  if (!qParsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: qParsed.error.flatten() });
  }

  if (!xrplService.isEnabled()) {
    return res.status(400).json({
      errorCode: "B2_VALIDATION_ERROR",
      message: "Live XRPL mode is disabled. Set XRPL_WSS_URL to enable.",
    });
  }

  try {
    const page = await xrplService.getAccountEscrowsPage(account, {
      limit: qParsed.data.limit,
      marker: parseRippledMarker(qParsed.data.marker),
    });
    await writeAudit({
      entityType: "xrpl_account",
      entityId: account,
      action: "xrpl.account_objects_escrow",
      actorId: "operator_local",
      metadata: { count: page.escrows.length, ledgerIndex: page.ledgerIndex },
    });
    return res.json({
      account,
      ledgerIndex: "validated",
      resolvedLedgerIndex: page.ledgerIndex,
      ledgerHash: page.ledgerHash,
      count: page.escrows.length,
      escrows: page.escrows,
      nextMarker: page.nextMarker,
    });
  } catch (error) {
    return res.status(502).json({
      errorCode: "B2_XRPL_UPSTREAM_ERROR",
      message: error instanceof Error ? error.message : "XRPL account_objects failed",
    });
  }
  },
);

app.post(
  "/v1/xrpl/backfill/account-tx",
  requireRoles("operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const parsed = backfillSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }

  let updated = 0;
  const resultCode = parsed.data.resultCode ?? "tesSUCCESS";
  const r = getRepo();

  if (xrplService.isEnabled()) {
    try {
      const liveStatuses = await xrplService.getAccountTxResults(parsed.data.account);
      for (const tracked of await r.listXrplTxs()) {
        if (tracked.account && tracked.account !== parsed.data.account) continue;
        const liveStatus = liveStatuses[tracked.txHash];
        if (!liveStatus) continue;
        const applied = await applyLiveTxStatus(tracked.txHash, liveStatus);
        if (applied) updated += 1;
      }

      recordXrplBackfillLiveApply(updated);

      await writeAudit({
        entityType: "xrpl_backfill",
        entityId: parsed.data.account,
        action: "xrpl.backfill.live",
        actorId: "operator_local",
        metadata: { updated, liveMode: true },
      });

      return res.json({
        account: parsed.data.account,
        updated,
        liveMode: true,
      });
    } catch (error) {
      await writeAudit({
        entityType: "xrpl_backfill",
        entityId: parsed.data.account,
        action: "xrpl.backfill.live_failed",
        actorId: "operator_local",
        metadata: { error: error instanceof Error ? error.message : "unknown error" },
      });
    }
  }

  for (const tx of await r.listXrplTxs()) {
    if (tx.validated) continue;
    tx.retries += 1;
    tx.lastCheckedAt = nowIso();
    tx.resultCode = tx.retries >= 2 ? resultCode : "terQUEUED";
    tx.outcomeClass = classifyXrplResultCode(tx.resultCode);

    if (tx.outcomeClass === "success") {
      tx.validated = true;
      tx.trackingStatus = "validated_success";
      tx.ledgerIndex = Number(parsed.data.fromLedger ?? 1) + tx.retries;
    } else if (tx.outcomeClass === "retryable" && tx.retries < 3) {
      tx.trackingStatus = "retry_scheduled";
    } else if (tx.outcomeClass === "retryable") {
      tx.trackingStatus = "validated_fail";
      tx.validated = false;
    } else {
      tx.trackingStatus = "validated_fail";
      tx.validated = true;
    }

    await r.saveXrplTx(tx);
    await applyLiveTxStatus(tx.txHash, {
      txHash: tx.txHash,
      validated: tx.validated,
      ledgerIndex: tx.ledgerIndex,
      resultCode: tx.resultCode,
    });
    updated += 1;
  }

  await writeAudit({
    entityType: "xrpl_backfill",
    entityId: parsed.data.account,
    action: "xrpl.backfill",
    actorId: "operator_local",
    metadata: { updated, resultCode },
  });

  return res.json({
    account: parsed.data.account,
    updated,
    defaultResultCode: resultCode,
  });
  },
);

app.post(
  "/v1/notifications",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const parsed = notifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }
  const id = randomId("ntf");
  const now = nowIso();
  const event = {
    id,
    eventType: parsed.data.eventType,
    recipientId: parsed.data.recipientId,
    channel: parsed.data.channel,
    status: "queued" as const,
    payload: parsed.data.payload,
    createdAt: now,
    updatedAt: now,
    attemptCount: 0,
    deadLetter: false,
  };
  await getRepo().saveNotification(event);

  await writeAudit({
    entityType: "notification",
    entityId: id,
    action: "notification.requested",
    actorId: "system",
    metadata: { channel: event.channel, eventType: event.eventType },
  });
  await emitEvent({
    eventType: "notification.requested",
    entityType: "notification",
    entityId: id,
    payload: { channel: event.channel, eventType: event.eventType },
  });

  return res.status(202).json(event);
  },
);

app.post(
  "/v1/notifications/dispatch",
  requireRoles("operator", "verifier", "auditor"),
  requireOperatorScopes("dispatch"),
  async (req: Request, res: Response) => {
  const parsed = notificationDispatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }
  const channels = parsed.data.channels?.length
    ? parsed.data.channels
    : routedChannelsForEventType(parsed.data.eventType);
  const now = nowIso();
  const notificationIds: string[] = [];
  for (const channel of channels) {
    const id = randomId("ntf");
    notificationIds.push(id);
    const event = {
      id,
      eventType: parsed.data.eventType,
      recipientId: parsed.data.recipientId,
      channel,
      status: "queued" as const,
      payload: parsed.data.payload,
      createdAt: now,
      updatedAt: now,
      attemptCount: 0,
      deadLetter: false,
    };
    await getRepo().saveNotification(event);
    await writeAudit({
      entityType: "notification",
      entityId: id,
      action: "notification.dispatch_queued",
      actorId: req.bluesafeAuth?.role ?? "operator",
      metadata: { channel, eventType: event.eventType },
    });
    await emitEvent({
      eventType: "notification.requested",
      entityType: "notification",
      entityId: id,
      payload: { channel, eventType: event.eventType, dispatch: true },
    });
  }
  return res.status(202).json({ notificationIds, channels });
  },
);

app.get(
  "/v1/operator/notifications/outbox",
  requireRoles("operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
    const parsed = notificationOutboxListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
    }
    const page = await getRepo().listNotificationOutboxPage(
      { status: parsed.data.status },
      { limit: parsed.data.limit, offset: parsed.data.offset },
    );
    return res.json({
      total: page.total,
      limit: page.limit,
      offset: page.offset,
      items: page.items,
    });
  },
);

app.post(
  "/v1/operator/notifications/outbox/:outboxId/retry",
  requireRoles("operator"),
  requireOperatorScopes("outbox"),
  async (req: Request, res: Response) => {
    const outboxId = String(req.params.outboxId);
    const row = await getRepo().getNotificationOutbox(outboxId);
    if (!row) {
      return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Outbox row not found" });
    }
    if (row.status !== "dead") {
      return res.status(409).json({
        errorCode: "B2_VALIDATION_ERROR",
        message: "Only dead outbox rows can be retried",
      });
    }
    const t = nowIso();
    await getRepo().updateNotificationOutbox({
      ...row,
      status: "pending",
      attempts: 0,
      lastError: undefined,
      updatedAt: t,
      processingStartedAt: undefined,
      dispatchedNotificationId: undefined,
    });
    await writeAudit({
      entityType: "notification_outbox",
      entityId: outboxId,
      action: "notification_outbox.retry_queued",
      actorId: req.bluesafeAuth?.role ?? "operator",
      after: { status: "pending" },
    });
    return res.json({ outboxId, status: "pending" as const });
  },
);

app.get(
  "/v1/notifications/:notificationId",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const notificationId = String(req.params.notificationId);
  const n = await getRepo().getNotification(notificationId);
  if (!n) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Notification not found" });
  }
  return res.json(n);
  },
);

app.get(
  "/v1/disputes/:disputeId",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const disputeId = String(req.params.disputeId);
  const dispute = await getRepo().getDispute(disputeId);
  if (!dispute) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Dispute not found" });
  }
  if (!(await canAccessDispute(req, dispute))) {
    return res.status(403).json({ errorCode: "B2_FORBIDDEN", message: "Not allowed to read this dispute" });
  }
  return res.json(dispute);
  },
);

app.get(
  "/v1/settlements",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const parsed = settlementListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }
  const page = await getRepo().listSettlementsPage(
    {
      contractId: parsed.data.contractId,
      status: parsed.data.status,
      periodYear: parsed.data.periodYear,
      periodMonth: parsed.data.periodMonth,
    },
    { limit: parsed.data.limit, offset: parsed.data.offset },
  );
  const accessible: typeof page.items = [];
  for (const s of page.items) {
    if (await canAccessSettlement(req, s)) accessible.push(s);
  }
  return res.json({
    count: accessible.length,
    total: page.total,
    limit: page.limit,
    offset: page.offset,
    items: accessible,
  });
  },
);

app.get(
  "/v1/settlements/:settlementId",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const settlementId = String(req.params.settlementId);
  const s = await getRepo().getSettlement(settlementId);
  if (!s) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Settlement not found" });
  }
  if (!(await canAccessSettlement(req, s))) {
    return res.status(403).json({ errorCode: "B2_FORBIDDEN", message: "Not allowed to read this settlement" });
  }
  return res.json(s);
  },
);

app.patch(
  "/v1/settlements/:settlementId/status",
  requireRoles("operator"),
  requireOperatorScopes("settlements"),
  async (req: Request, res: Response) => {
  const parsed = settlementStatusPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }
  const settlementId = String(req.params.settlementId);
  const r = getRepo();
  const s = await r.getSettlement(settlementId);
  if (!s) {
    return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Settlement not found" });
  }
  const body = parsed.data;
  if (body.status !== undefined && !settlementTransitionAllowed(s.status, body.status)) {
    return res.status(409).json({
      errorCode: "B2_VALIDATION_ERROR",
      message: `Cannot transition settlement status ${s.status} -> ${body.status}`,
    });
  }
  const nextStatus = body.status ?? s.status;
  const t = nowIso();
  const updated: SettlementRecord = {
    ...s,
    status: nextStatus,
    updatedAt: t,
    currencyCode: body.currencyCode ?? s.currencyCode,
    periodMode: s.periodMode,
  };
  if (body.amountMinor !== undefined) updated.amountMinor = body.amountMinor;
  if (body.batchId !== undefined) updated.batchId = body.batchId;
  if (nextStatus === "confirmed" && !updated.confirmedAt) {
    updated.confirmedAt = t;
  }
  await r.saveSettlement(updated);

  const statusChanged = body.status !== undefined && body.status !== s.status;
  const financialChanged =
    (body.amountMinor !== undefined && body.amountMinor !== s.amountMinor) ||
    (body.currencyCode !== undefined && body.currencyCode !== s.currencyCode) ||
    (body.batchId !== undefined && body.batchId !== s.batchId);

  await writeAudit({
    entityType: "settlement",
    entityId: settlementId,
    action: "settlement.status_patched",
    actorId: req.bluesafeAuth?.role ?? "operator",
    before: {
      status: s.status,
      amountMinor: s.amountMinor,
      currencyCode: s.currencyCode,
      batchId: s.batchId,
    },
    after: {
      status: updated.status,
      amountMinor: updated.amountMinor,
      currencyCode: updated.currencyCode,
      batchId: updated.batchId,
      confirmedAt: updated.confirmedAt,
    },
  });

  if (statusChanged) {
    await emitEvent({
      eventType: "settlement.status_updated",
      entityType: "settlement",
      entityId: settlementId,
      payload: { contractId: s.contractId, periodYear: s.periodYear, periodMonth: s.periodMonth, status: nextStatus },
    });
  }
  if (financialChanged) {
    await emitEvent({
      eventType: "settlement.financials_attached",
      entityType: "settlement",
      entityId: settlementId,
      payload: {
        contractId: s.contractId,
        periodYear: s.periodYear,
        periodMonth: s.periodMonth,
        amountMinor: updated.amountMinor,
        currencyCode: updated.currencyCode,
        batchId: updated.batchId,
      },
    });
    const contractFin = await r.getContract(s.contractId);
    if (contractFin) {
      await maybeEnqueueDomainNotifications(getRepo, {
        eventType: "settlement.financials_attached",
        recipientIds: contractPartyRecipientIds(contractFin),
        payload: {
          settlementId,
          contractId: s.contractId,
          periodYear: s.periodYear,
          periodMonth: s.periodMonth,
        },
      });
    }
  }

  if (nextStatus === "accrued") {
    const contractAccrued = await r.getContract(s.contractId);
    if (contractAccrued) {
      await maybeEnqueueDomainNotifications(getRepo, {
        eventType: "settlement.accrued",
        recipientIds: contractPartyRecipientIds(contractAccrued),
        payload: {
          settlementId,
          contractId: s.contractId,
          periodYear: s.periodYear,
          periodMonth: s.periodMonth,
        },
      });
    }
  }

  if (nextStatus === "confirmed" && config.settlement.autoNotifyOnConfirmed) {
    const contract = await r.getContract(s.contractId);
    if (contract) {
      await enqueueSettlementConfirmedNotifications(getRepo, updated, contract);
    }
  }

  return res.json(updated);
  },
);

app.get(
  "/v1/operator/stats/summary",
  requireRoles("operator", "verifier", "auditor"),
  async (_req: Request, res: Response) => {
  const summary = await getRepo().getOperatorStatsSummary();
  return res.json(summary);
  },
);

app.get(
  "/v1/operator/runtime/execution-policy",
  requireRoles("operator", "verifier", "auditor"),
  async (_req: Request, res: Response) => {
    return res.json(getExecutionPolicySnapshot());
  },
);

app.get(
  "/v1/operator/runtime/xrpl-operations",
  requireRoles("operator", "verifier", "auditor"),
  async (_req: Request, res: Response) => {
    return res.json(getXrplOperationsSnapshot());
  },
);

app.get(
  "/v1/operator/runtime/auth-providers",
  requireRoles("operator", "verifier", "auditor"),
  async (_req: Request, res: Response) => {
    return res.json({
      headerRbac: true,
      operatorConsoleScopesEnabled: config.auth.enabled && config.auth.operatorConsoleScopesEnabled,
      operatorScopesHeader: "X-Bluesafe-Operator-Scopes",
      operatorScopesHint:
        "When BLUESAFE_OPERATOR_CONSOLE_SCOPES=1, operator-only routes may require scope tokens (export, purge, registry, sla, outbox, evidence, dispatch, settlements, disputes, or all). Omit header for full operator console access.",
      oidcIssuerConfigured: Boolean(config.auth.oidcIssuerUrl),
      oidcIssuerUrl: config.auth.oidcIssuerUrl || null,
    });
  },
);

app.get(
  "/v1/reports/summary",
  requireRoles("operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
    const parsed = reportSummaryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
    }
    let from: string | undefined;
    let to: string | undefined;
    try {
      from = parseOptionalIso("from", parsed.data.from?.trim() || undefined);
      to = parseOptionalIso("to", parsed.data.to?.trim() || undefined);
    } catch (e) {
      return res.status(400).json({
        errorCode: "B2_VALIDATION_ERROR",
        message: e instanceof Error ? e.message : "Invalid query",
      });
    }
    const summary = await getRepo().getReportsSummary({
      from,
      to,
      tenantId: parsed.data.tenantId,
      landlordId: parsed.data.landlordId,
    });
    return res.json(summary);
  },
);

app.get(
  "/v1/reports/audits.ndjson",
  requireRoles("operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
    const parsed = reportAuditsNdjsonQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
    }
    let from: string | undefined;
    let to: string | undefined;
    try {
      from = parseOptionalIso("from", parsed.data.from?.trim() || undefined);
      to = parseOptionalIso("to", parsed.data.to?.trim() || undefined);
    } catch (e) {
      return res.status(400).json({
        errorCode: "B2_VALIDATION_ERROR",
        message: e instanceof Error ? e.message : "Invalid query",
      });
    }
    const filter = {
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      from,
      to,
    };
    const maxExport = parsed.data.limit;
    const pageSize = Math.min(500, maxExport);
    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="audits-export.ndjson"');
    res.setHeader("Cache-Control", "no-store");
    let exported = 0;
    let offset = 0;
    while (exported < maxExport) {
      const take = Math.min(pageSize, maxExport - exported);
      const p0 = Date.now();
      const page = await getRepo().listAuditsPage(filter, { limit: take, offset });
      recordAuditListDurationMs(Date.now() - p0);
      for (const log of page.items) {
        res.write(`${JSON.stringify(log)}\n`);
        exported += 1;
        if (exported >= maxExport) break;
      }
      if (page.items.length === 0) break;
      offset += page.items.length;
      if (offset >= page.total) break;
    }
    res.end();
  },
);

app.get(
  "/v1/reports/audits.csv",
  requireRoles("operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
    const parsed = reportAuditsCsvQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
    }
    let from: string | undefined;
    let to: string | undefined;
    try {
      from = parseOptionalIso("from", parsed.data.from?.trim() || undefined);
      to = parseOptionalIso("to", parsed.data.to?.trim() || undefined);
    } catch (e) {
      return res.status(400).json({
        errorCode: "B2_VALIDATION_ERROR",
        message: e instanceof Error ? e.message : "Invalid query",
      });
    }
    const filter = {
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      from,
      to,
    };
    const maxExport = parsed.data.limit;
    const pageSize = Math.min(500, maxExport);
    res.status(200);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="audits-export.csv"');
    res.setHeader("Cache-Control", "no-store");
    res.write("\uFEFF");
    res.write(`${auditLogCsvHeader()}\n`);
    let exported = 0;
    let offset = 0;
    while (exported < maxExport) {
      const take = Math.min(pageSize, maxExport - exported);
      const p0 = Date.now();
      const page = await getRepo().listAuditsPage(filter, { limit: take, offset });
      recordAuditListDurationMs(Date.now() - p0);
      for (const log of page.items) {
        res.write(`${auditLogToCsvRow(log)}\n`);
        exported += 1;
        if (exported >= maxExport) break;
      }
      if (page.items.length === 0) break;
      offset += page.items.length;
      if (offset >= page.total) break;
    }
    res.end();
  },
);

app.post(
  "/v1/operator/evidences/retention-run",
  requireRoles("operator"),
  requireOperatorScopes("purge"),
  async (req: Request, res: Response) => {
  const now = nowIso();
  const past = await getRepo().listEvidencesPastRetention(now);
  const purged: string[] = [];
  for (const ev of past) {
    try {
      await ipfsService.unpinIfPinata(ev.cid, ev.storageProvider);
    } catch (e) {
      console.warn("[evidence retention] pinata unpin failed", ev.id, e instanceof Error ? e.message : e);
    }
    await getRepo().deleteEvidence(ev.id);
    purged.push(ev.id);
    await writeAudit({
      entityType: "evidence",
      entityId: ev.id,
      action: "evidence.retention_purged",
      actorId: req.bluesafeAuth?.role ?? "operator",
      metadata: {
        retainUntil: ev.retainUntil,
        contractId: ev.contractId,
        retentionClass: ev.retentionClass,
        legalHoldUntil: ev.legalHoldUntil ?? null,
      },
    });
    await emitEvent({
      eventType: "evidence.retention_purged",
      entityType: "evidence",
      entityId: ev.id,
      payload: { contractId: ev.contractId },
    });
  }
  return res.json({ scanned: past.length, purgedCount: purged.length, purgedIds: purged });
  },
);

app.get(
  "/v1/operator/evidences/retention-due",
  requireRoles("operator", "verifier", "auditor"),
  async (_req: Request, res: Response) => {
    const past = await getRepo().listEvidencesPastRetention(nowIso());
    return res.json({
      count: past.length,
      items: past.map((e) => ({
        id: e.id,
        contractId: e.contractId,
        disputeId: e.disputeId,
        retainUntil: e.retainUntil,
        retentionClass: e.retentionClass ?? "standard",
        jurisdiction: e.jurisdiction,
        legalHoldUntil: e.legalHoldUntil,
        category: e.category,
        createdAt: e.createdAt,
      })),
    });
  },
);

app.get(
  "/v1/operator/dispute-verifier-registry",
  requireRoles("operator", "verifier", "auditor"),
  async (_req: Request, res: Response) => {
    const items = await getRepo().listDisputeVerifierRegistry();
    return res.json({ count: items.length, items });
  },
);

app.post(
  "/v1/operator/dispute-verifier-registry",
  requireRoles("operator"),
  requireOperatorScopes("registry"),
  async (req: Request, res: Response) => {
    const parsed = disputeVerifierRegistryUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
    }
    const r = getRepo();
    const existing = (await r.listDisputeVerifierRegistry()).find((e) => e.verifierId === parsed.data.verifierId);
    const t = nowIso();
    const id = existing?.id ?? randomId("dvr");
    const entry: DisputeVerifierRegistryEntry = {
      id,
      verifierId: parsed.data.verifierId,
      displayLabel: parsed.data.displayLabel,
      active: parsed.data.active,
      createdAt: existing?.createdAt ?? t,
    };
    await r.upsertDisputeVerifierRegistryEntry(entry);
    await writeAudit({
      entityType: "dispute_verifier_registry",
      entityId: id,
      action: "dispute_verifier_registry.upsert",
      actorId: req.bluesafeAuth?.role ?? "operator",
      after: { verifierId: entry.verifierId, active: entry.active, displayLabel: entry.displayLabel },
    });
    return res.status(existing ? 200 : 201).json(entry);
  },
);

app.get(
  "/v1/events",
  requireRoles("tenant", "landlord", "operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
  const parsed = eventListQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
  }
  const items = await getRepo().listEvents({
    entityType: parsed.data.entityType,
    entityId: parsed.data.entityId,
    eventType: parsed.data.eventType,
  });
  return res.json({ count: items.length, items });
  },
);

app.post(
  "/v1/reports/export-jobs",
  requireRoles("operator", "verifier"),
  requireOperatorScopes("export"),
  async (req: Request, res: Response) => {
    const parsed = createExportJobSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
    }
    const filter: AuditFilter = {
      entityType: parsed.data.filter.entityType,
      entityId: parsed.data.filter.entityId,
      from: parsed.data.filter.from,
      to: parsed.data.filter.to,
    };
    const t = nowIso();
    const id = randomId("exp");
    await getRepo().createExportJob({
      id,
      kind: parsed.data.kind,
      status: "pending",
      filter,
      maxExport: parsed.data.maxExport,
      createdAt: t,
      updatedAt: t,
    });
    return res.status(202).json({ jobId: id, status: "pending" });
  },
);

app.get(
  "/v1/reports/export-jobs/:jobId",
  requireRoles("operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
    const jobId = String(req.params.jobId);
    const j = await getRepo().getExportJob(jobId);
    if (!j) {
      return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Export job not found" });
    }
    const resultNdjson = j.status === "completed" ? j.resultNdjson : undefined;
    return res.json({
      jobId: j.id,
      kind: j.kind,
      status: j.status,
      createdAt: j.createdAt,
      updatedAt: j.updatedAt,
      maxExport: j.maxExport,
      filter: j.filter,
      error: j.error,
      resultNdjson,
      resultBytes: resultNdjson ? Buffer.byteLength(resultNdjson, "utf8") : undefined,
    });
  },
);

app.get(
  "/v1/reports/export-jobs/:jobId/artifact-url",
  requireRoles("operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
    const secret = config.exportJobs.artifactSigningSecret;
    if (!secret) {
      return res.status(503).json({
        errorCode: "B2_UNAVAILABLE",
        message: "Export artifact signing is not configured (set BLUESAFE_EXPORT_ARTIFACT_SECRET)",
      });
    }
    const jobId = String(req.params.jobId);
    const j = await getRepo().getExportJob(jobId);
    if (!j) {
      return res.status(404).json({ errorCode: "B2_NOT_FOUND", message: "Export job not found" });
    }
    if (j.status !== "completed") {
      return res.status(409).json({
        errorCode: "B2_VALIDATION_ERROR",
        message: "Export job is not completed yet",
      });
    }
    const exp = Math.floor(Date.now() / 1000) + config.exportJobs.artifactUrlTtlSec;
    const token = signExportArtifactToken(secret, jobId, exp);
    const downloadPath = `/export/artifacts?token=${encodeURIComponent(token)}`;
    return res.json({
      jobId,
      downloadPath,
      expiresAt: new Date(exp * 1000).toISOString(),
    });
  },
);

app.post(
  "/v1/operator/disputes/review-sla-scan",
  requireRoles("operator"),
  requireOperatorScopes("sla"),
  async (_req: Request, res: Response) => {
    const r = getRepo();
    const nowMs = Date.now();
    const page = await r.listDisputesPage({ status: "under_review" }, { limit: 500, offset: 0 });
    let deadlineExpired = 0;
    let autoEscalated = 0;
    for (const d of page.items) {
      if (!d.reviewDeadlineAt) continue;
      if (Number.isNaN(Date.parse(d.reviewDeadlineAt))) continue;
      if (Date.parse(d.reviewDeadlineAt) > nowMs) continue;

      if (config.dispute.slaAutoEscalate) {
        if (!d.escalatedAt) {
          const t = nowIso();
          d.escalatedAt = t;
          d.updatedAt = t;
          await r.saveDispute(d);
          await writeAudit({
            entityType: "dispute",
            entityId: d.id,
            action: "dispute.escalated",
            actorId: "system",
            metadata: { source: "review_sla_auto" },
            after: { escalatedAt: t },
          });
          await emitEvent({
            eventType: "dispute.escalated",
            entityType: "dispute",
            entityId: d.id,
            payload: { contractId: d.contractId, reviewDeadlineAt: d.reviewDeadlineAt, source: "review_sla_auto" },
          });
          const c = await r.getContract(d.contractId);
          if (c) {
            await maybeEnqueueDomainNotifications(getRepo, {
              eventType: "dispute.escalated",
              recipientIds: contractPartyRecipientIds(c),
              payload: { disputeId: d.id, contractId: d.contractId },
            });
          }
          autoEscalated += 1;
        }
        continue;
      }

      await emitEvent({
        eventType: "dispute.review_deadline_expired",
        entityType: "dispute",
        entityId: d.id,
        payload: { contractId: d.contractId, reviewDeadlineAt: d.reviewDeadlineAt },
      });
      const c = await r.getContract(d.contractId);
      if (c) {
        await maybeEnqueueDomainNotifications(getRepo, {
          eventType: "dispute.review_deadline_expired",
          recipientIds: contractPartyRecipientIds(c),
          payload: { disputeId: d.id, contractId: d.contractId, reviewDeadlineAt: d.reviewDeadlineAt },
        });
      }
      deadlineExpired += 1;
    }
    return res.json({
      scanned: page.items.length,
      deadlineExpired,
      autoEscalated,
      flagged: deadlineExpired,
    });
  },
);

app.get(
  "/v1/audits",
  requireRoles("operator", "verifier", "auditor"),
  async (req: Request, res: Response) => {
    const parsed = auditsListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ errorCode: "B2_VALIDATION_ERROR", message: parsed.error.flatten() });
    }
    let from: string | undefined;
    let to: string | undefined;
    try {
      from = parseOptionalIso("from", parsed.data.from?.trim() || undefined);
      to = parseOptionalIso("to", parsed.data.to?.trim() || undefined);
    } catch (e) {
      return res.status(400).json({
        errorCode: "B2_VALIDATION_ERROR",
        message: e instanceof Error ? e.message : "Invalid query",
      });
    }
    const filter: AuditFilter = {
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      from,
      to,
    };
    const useKeyset = parsed.data.limit != null || Boolean(parsed.data.cursor?.trim());
    const t0 = Date.now();
    if (useKeyset) {
      const limitRaw = parsed.data.limit ?? 100;
      const limit = Math.min(2000, Math.max(1, limitRaw));
      const cursorTrim = parsed.data.cursor?.trim();
      if (cursorTrim) {
        const d = decodeAuditCursor(cursorTrim);
        if (!d) {
          return res.status(400).json({
            errorCode: "B2_VALIDATION_ERROR",
            message: "cursor is invalid",
          });
        }
      }
      try {
        const page = await getRepo().listAuditsAfterCursor(filter, {
          limit,
          cursor: cursorTrim || undefined,
        });
        recordAuditListDurationMs(Date.now() - t0);
        return res.json({
          count: page.items.length,
          items: page.items,
          nextCursor: page.nextCursor,
        });
      } catch (e) {
        const code =
          typeof e === "object" && e !== null && "code" in e ? (e as { code?: string }).code : undefined;
        if (code === "INVALID_AUDIT_CURSOR") {
          return res.status(400).json({
            errorCode: "B2_VALIDATION_ERROR",
            message: "cursor is invalid",
          });
        }
        throw e;
      }
    }
    const logs = await getRepo().listAudits(filter);
    recordAuditListDurationMs(Date.now() - t0);
    return res.json({ count: logs.length, items: logs });
  },
);

app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Unknown server error";
  return res.status(500).json({
    errorCode: "B2_INTERNAL_ERROR",
    message,
  });
});

async function main(): Promise<void> {
  await initAppRepository();
  const notificationProvider = createNotificationProvider();
  app.listen(PORT, () => {
    console.log(`Backend2 API server listening on http://localhost:${PORT} (storage: ${getRepo().kind})`);
    if (!config.notification.workerDisabled) {
      startNotificationWorker({
        getRepo,
        provider: notificationProvider,
        maxAttempts: config.notification.maxAttempts,
        intervalMs: config.notification.workerIntervalMs,
        batchSize: config.notification.workerBatchSize,
        retryInitialBackoffMs: config.notification.retryInitialBackoffMs,
        retryMaxBackoffMs: config.notification.retryMaxBackoffMs,
      });
    }
    if (config.notification.domainOutbox && !config.notification.outboxFanoutWorkerDisabled) {
      startNotificationOutboxFanoutWorker({
        getRepo,
        intervalMs: config.notification.outboxFanoutWorkerIntervalMs,
        batchSize: config.notification.outboxFanoutBatchSize,
        disabled: false,
        staleProcessingMs: config.notification.outboxStaleProcessingMs,
        maxDispatchAttempts: config.notification.outboxDispatchMaxAttempts,
      });
    }
    startXrplSubscribeWorker({
      getRepo,
      wssUrl: config.xrpl.wssUrl,
      requestTimeoutMs: config.xrpl.requestTimeoutMs,
      disabled: config.xrplSubscribe.disabled || !config.xrpl.enabled,
      maxSubscribeAccounts: config.xrplSubscribe.maxAccounts,
      accountsRefreshMs: config.xrplSubscribe.accountsRefreshMs,
      transactionsStream: config.xrplSubscribe.transactionsStream,
      logReconnects: config.xrplSubscribe.logReconnects,
      transactionStreamMaxPerSec: config.xrplSubscribe.transactionStreamMaxPerSec,
      settlementLedgerTouchEnabled: config.settlement.ledgerCloseTouchEnabled,
    });
    if (config.xrpl.enabled && !config.xrplTxPolicy.workerDisabled) {
      startXrplTxPolicyWorker({
        getRepo,
        intervalMs: config.xrplTxPolicy.intervalMs,
        pendingTimeoutMs: config.xrplTxPolicy.pendingTimeoutMs,
        batchSize: config.xrplTxPolicy.batchSize,
        maxNotFoundProbes: config.xrplTxPolicy.maxNotFoundProbes,
        maxBackoffMs: config.xrplTxPolicy.maxBackoffMs,
        logSummaryTick: config.xrplTxPolicy.logSummaryTick,
      });
    }
    startExportJobWorker({
      getRepo,
      intervalMs: config.exportJobs.workerIntervalMs,
      batchSize: config.exportJobs.workerBatchSize,
      disabled: config.exportJobs.workerDisabled,
    });
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
