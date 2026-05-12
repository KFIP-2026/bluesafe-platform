import type {
  AuditLog,
  CaseDecision,
  Contract,
  DisputeCase,
  DisputeVerifierRegistryEntry,
  DisputeVerifierVoteRecord,
  EvidenceFile,
  EventEnvelope,
  NotificationEvent,
  NotificationOutboxRecord,
  NotificationOutboxStatus,
  SettlementRecord,
  XrplTransaction,
} from "../types.js";

export interface AuditFilter {
  entityType?: string;
  entityId?: string;
  /** ISO 8601 inclusive lower bound */
  from?: string;
  /** ISO 8601 inclusive upper bound */
  to?: string;
}

export interface EventFilter {
  entityType?: string;
  entityId?: string;
  eventType?: string;
}

/** Persisted delayed work (e.g. XRPL tx policy probes). */
export interface DelayedJob {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  runAfter: string;
  attempts: number;
  maxAttempts: number;
  lockedUntil?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListParams {
  limit: number;
  offset: number;
}

export interface ContractListFilter {
  status?: string;
  tenantId?: string;
  landlordId?: string;
  updatedFrom?: string;
  updatedTo?: string;
}

export interface DisputeListFilter {
  contractId?: string;
  status?: string;
  updatedFrom?: string;
  updatedTo?: string;
}

export interface XrplTxListFilter {
  account?: string;
  trackingStatus?: string;
  validated?: boolean;
  network?: string;
}

export interface SettlementListFilter {
  contractId?: string;
  status?: string;
  periodYear?: number;
  periodMonth?: number;
}

export interface NotificationOutboxListFilter {
  status?: NotificationOutboxStatus;
}

/** Upsert monthly settlement rows when a validated ledger closes (V5-A). */
export interface TouchSettlementsOnLedgerCloseParams {
  periodYear: number;
  periodMonth: number;
  ledgerIndex: number;
  nowIso: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** V8-C: stable keyset page over audits (`created_at ASC`, `id ASC`). */
export interface AuditKeysetPage {
  items: AuditLog[];
  nextCursor: string | null;
}

export interface OperatorStatsSummary {
  contractsByStatus: Record<string, number>;
  disputesByStatus: Record<string, number>;
  xrplByTracking: Record<string, number>;
  notificationsByStatus: Record<string, number>;
  evidencesTotal: number;
  /** V5-A: settlement row counts by status (omit when store has no settlements table). */
  settlementsByStatus?: Record<string, number>;
}

/** V5-D: optional window + tenant/landlord scope for console reports. */
export interface ReportSummaryParams {
  from?: string;
  to?: string;
  tenantId?: string;
  landlordId?: string;
}

/** Counts for entities whose timestamps fall in the report window (see `ReportSummary`). */
export interface ReportScopedBucket {
  contractsByStatus: Record<string, number>;
  disputesByStatus: Record<string, number>;
  settlementsByStatus: Record<string, number>;
  xrplByTracking: Record<string, number>;
  /** Audit rows in window by `createdAt` (not tenant-scoped; table has no tenant). */
  auditsCount: number;
}

export interface ReportSummary {
  generatedAt: string;
  window: { from?: string; to?: string; tenantId?: string; landlordId?: string };
  /** Same shape as `GET /v1/operator/stats/summary` (full store). */
  global: OperatorStatsSummary;
  /**
   * Activity in the window: contracts/disputes/settlements use `updatedAt`;
   * XRPL uses `lastCheckedAt`. When `tenantId` or `landlordId` is set, XRPL rows are counted only if
   * `disputeId` resolves to a contract matching that scope (orphan tracked txs are excluded).
   */
  scoped: ReportScopedBucket;
}

export interface StoragePingResult {
  ok: boolean;
  detail?: string;
}

export type ExportJobKind = "audits_ndjson";
export type ExportJobStatus = "pending" | "running" | "completed" | "failed";

export interface ExportJobRecord {
  id: string;
  kind: ExportJobKind;
  status: ExportJobStatus;
  filter: AuditFilter;
  maxExport: number;
  resultNdjson?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppRepository {
  readonly kind: "memory" | "postgres";

  /** `SELECT 1` (Postgres) or no-op ok (memory) — for `/health?deep=1`. */
  pingStorage(): Promise<StoragePingResult>;

  getContract(id: string): Promise<Contract | undefined>;
  saveContract(c: Contract): Promise<void>;
  hasContract(id: string): Promise<boolean>;

  getEvidence(id: string): Promise<EvidenceFile | undefined>;
  saveEvidence(e: EvidenceFile): Promise<void>;
  findEvidenceByCid(cid: string): Promise<EvidenceFile | undefined>;
  countEvidenceVersions(contractId: string, disputeId: string | undefined, category: string): Promise<number>;
  hasEvidence(id: string): Promise<boolean>;
  listEvidencesPastRetention(nowIso: string): Promise<EvidenceFile[]>;
  deleteEvidence(id: string): Promise<void>;

  getDispute(id: string): Promise<DisputeCase | undefined>;
  saveDispute(d: DisputeCase): Promise<void>;
  appendDisputeVerifierVote(v: DisputeVerifierVoteRecord): Promise<void>;
  listDisputeVerifierVotes(disputeId: string): Promise<DisputeVerifierVoteRecord[]>;
  /** V7-D: operator-maintained verifier directory (SignerList / governance alignment — ADR 0008). */
  listDisputeVerifierRegistry(): Promise<DisputeVerifierRegistryEntry[]>;
  upsertDisputeVerifierRegistryEntry(e: DisputeVerifierRegistryEntry): Promise<void>;

  saveDecision(d: CaseDecision): Promise<void>;

  getXrplTx(txHash: string): Promise<XrplTransaction | undefined>;
  saveXrplTx(t: XrplTransaction): Promise<void>;
  listXrplTxs(): Promise<XrplTransaction[]>;
  /** Distinct `account` values on not-yet-validated tracked txs (for `subscribe` accounts). */
  listXrplSubscribeAccounts(max: number): Promise<string[]>;
  /**
   * Record a processed stream event. Returns true if this was the first insert for the tuple
   * `(ledgerIndex, txHash, eventSource)` (caller should apply side effects).
   */
  tryRecordXrplIngestionEvent(params: {
    ledgerIndex: number;
    txHash: string;
    eventSource: string;
    engineResult?: string;
  }): Promise<boolean>;

  saveNotification(n: NotificationEvent): Promise<void>;
  getNotification(id: string): Promise<NotificationEvent | undefined>;
  /** Rows eligible for delivery at `nowIso` (exclusive upper bound on nextAttemptAt is caller’s `nowIso`). */
  listDueNotifications(nowIso: string, limit: number): Promise<NotificationEvent[]>;

  /** V8-A: insert outbox row; returns false if `idempotency_key` already exists. */
  appendNotificationOutbox(row: NotificationOutboxRecord): Promise<boolean>;
  /** Atomically claim pending rows for fan-out (`SKIP LOCKED`). Sets `processing` + `processing_started_at`. */
  claimNotificationOutboxPending(limit: number, nowIso: string): Promise<NotificationOutboxRecord[]>;
  updateNotificationOutbox(row: NotificationOutboxRecord): Promise<void>;
  getNotificationOutbox(id: string): Promise<NotificationOutboxRecord | undefined>;
  listNotificationOutboxPage(
    filter: NotificationOutboxListFilter,
    params: ListParams,
  ): Promise<Paginated<NotificationOutboxRecord>>;
  /** Stale `processing` → `pending` for crash recovery. */
  recoverStaleNotificationOutboxProcessing(staleBeforeIso: string, nowIso: string): Promise<number>;

  appendAudit(log: AuditLog): Promise<void>;
  appendEvent(ev: EventEnvelope): Promise<void>;
  listAudits(filter: AuditFilter): Promise<AuditLog[]>;
  /** Chronological page for exports (`ORDER BY created_at ASC`). */
  listAuditsPage(filter: AuditFilter, params: ListParams): Promise<Paginated<AuditLog>>;
  /** V8-C: keyset pagination; `cursor` opaque token from prior `nextCursor`. */
  listAuditsAfterCursor(filter: AuditFilter, params: { limit: number; cursor?: string }): Promise<AuditKeysetPage>;
  listEvents(filter: EventFilter): Promise<EventEnvelope[]>;

  /** Insert job row if `id` is free; if a row already exists, leave it unchanged. */
  createDelayedJobIfAbsent(job: DelayedJob): Promise<boolean>;
  /** Atomically claim due jobs for `kind` (Postgres: `FOR UPDATE SKIP LOCKED`). */
  claimDueDelayedJobs(kind: string, nowIso: string, limit: number, lockTtlMs: number): Promise<DelayedJob[]>;
  deleteDelayedJob(id: string): Promise<void>;
  bumpDelayedJob(params: {
    id: string;
    runAfter: string;
    attempts: number;
    lastError?: string;
    updatedAt: string;
  }): Promise<void>;

  listContractsPage(filter: ContractListFilter, params: ListParams): Promise<Paginated<Contract>>;
  listDisputesPage(filter: DisputeListFilter, params: ListParams): Promise<Paginated<DisputeCase>>;
  listXrplTxsPage(filter: XrplTxListFilter, params: ListParams): Promise<Paginated<XrplTransaction>>;

  getOperatorStatsSummary(): Promise<OperatorStatsSummary>;
  /** V5-D: global snapshot plus window-scoped aggregates. */
  getReportsSummary(params: ReportSummaryParams): Promise<ReportSummary>;

  /** V5-A */
  getSettlement(id: string): Promise<SettlementRecord | undefined>;
  saveSettlement(s: SettlementRecord): Promise<void>;
  listSettlementsPage(filter: SettlementListFilter, params: ListParams): Promise<Paginated<SettlementRecord>>;
  /** Returns number of contract rows inserted or updated for this ledger close. */
  touchSettlementsOnLedgerClose(params: TouchSettlementsOnLedgerCloseParams): Promise<number>;

  createExportJob(job: ExportJobRecord): Promise<void>;
  getExportJob(id: string): Promise<ExportJobRecord | undefined>;
  /** Atomically marks up to `limit` pending jobs as `running` and returns them. */
  claimExportJobsPending(limit: number, nowIso: string): Promise<ExportJobRecord[]>;
  updateExportJob(job: ExportJobRecord): Promise<void>;
}
