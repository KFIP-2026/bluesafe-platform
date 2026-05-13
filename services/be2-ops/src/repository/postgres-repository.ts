import type { Pool } from "pg";
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
  SettlementRecord,
  XrplTransaction,
} from "../types.js";
import { decodeAuditCursor, encodeAuditCursor } from "../services/audit-cursor.js";
import type {
  AppRepository,
  AuditFilter,
  AuditKeysetPage,
  ContractListFilter,
  DelayedJob,
  DisputeListFilter,
  EventFilter,
  ListParams,
  NotificationOutboxListFilter,
  OperatorStatsSummary,
  Paginated,
  ReportScopedBucket,
  ReportSummary,
  ReportSummaryParams,
  SettlementListFilter,
  TouchSettlementsOnLedgerCloseParams,
  XrplTxListFilter,
  ExportJobRecord,
} from "./app-repository.js";
import { nowIso, randomId } from "../utils.js";

function toIso(d: Date | string): string {
  return typeof d === "string" ? d : d.toISOString();
}

function rowToContract(r: Record<string, unknown>): Contract {
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    landlordId: String(r.landlord_id),
    status: r.status as Contract["status"],
    escrowCreateTxHash: r.escrow_create_tx_hash ? String(r.escrow_create_tx_hash) : undefined,
    depositAmount: r.deposit_amount ? String(r.deposit_amount) : undefined,
    stakeAmount: r.stake_amount ? String(r.stake_amount) : undefined,
    startsAt: r.starts_at ? toIso(r.starts_at as Date) : undefined,
    endsAt: r.ends_at ? toIso(r.ends_at as Date) : undefined,
    createdAt: toIso(r.created_at as Date),
    updatedAt: toIso(r.updated_at as Date),
  };
}

function rowToEvidence(r: Record<string, unknown>): EvidenceFile {
  const retentionRaw = r.retention_class != null ? String(r.retention_class) : "standard";
  const retentionClass = (
    retentionRaw === "standard" || retentionRaw === "regulated" || retentionRaw === "legal_hold"
      ? retentionRaw
      : "standard"
  ) as EvidenceFile["retentionClass"];
  return {
    id: String(r.id),
    contractId: String(r.contract_id),
    disputeId: r.dispute_id ? String(r.dispute_id) : undefined,
    uploaderId: String(r.uploader_id),
    category: r.category as EvidenceFile["category"],
    cid: String(r.cid),
    sha256: String(r.sha256),
    mimeType: String(r.mime_type),
    sizeBytes: Number(r.size_bytes),
    version: Number(r.version),
    isEncrypted: Boolean(r.is_encrypted),
    encryptionScheme: r.encryption_scheme
      ? (String(r.encryption_scheme) as EvidenceFile["encryptionScheme"])
      : undefined,
    retainUntil: r.retain_until ? toIso(r.retain_until as Date) : undefined,
    retentionClass,
    jurisdiction: r.jurisdiction != null ? String(r.jurisdiction) : undefined,
    legalHoldUntil: r.legal_hold_until ? toIso(r.legal_hold_until as Date) : undefined,
    storageProvider: r.storage_provider as EvidenceFile["storageProvider"],
    createdAt: toIso(r.created_at as Date),
    localContentHashSeed: String(r.local_content_hash_seed),
  };
}

function rowToDispute(r: Record<string, unknown>): DisputeCase {
  const bundle = r.evidence_bundle;
  const evidenceBundle = Array.isArray(bundle) ? (bundle as string[]) : JSON.parse(String(bundle)) as string[];
  return {
    id: String(r.id),
    contractId: String(r.contract_id),
    raisedBy: r.raised_by as DisputeCase["raisedBy"],
    reasonCode: String(r.reason_code),
    status: r.status as DisputeCase["status"],
    evidenceBundle,
    createdAt: toIso(r.created_at as Date),
    updatedAt: toIso(r.updated_at as Date),
    reviewDeadlineAt: r.review_deadline_at ? toIso(r.review_deadline_at as Date) : undefined,
    escalatedAt: r.escalated_at ? toIso(r.escalated_at as Date) : undefined,
  };
}

function rowToXrpl(r: Record<string, unknown>): XrplTransaction {
  return {
    id: String(r.id),
    txHash: String(r.tx_hash),
    txType: String(r.tx_type),
    account: r.account ? String(r.account) : undefined,
    disputeId: r.dispute_id ? String(r.dispute_id) : undefined,
    network: r.network as XrplTransaction["network"],
    trackingStatus: r.tracking_status as XrplTransaction["trackingStatus"],
    validated: Boolean(r.validated),
    ledgerIndex: r.ledger_index != null ? Number(r.ledger_index) : undefined,
    resultCode: r.result_code ? String(r.result_code) : undefined,
    outcomeClass: r.outcome_class ? (r.outcome_class as XrplTransaction["outcomeClass"]) : undefined,
    retries: Number(r.retries),
    lastCheckedAt: toIso(r.last_checked_at as Date),
    escrowOwner: r.escrow_owner ? String(r.escrow_owner) : undefined,
    escrowDestination: r.escrow_destination ? String(r.escrow_destination) : undefined,
    escrowOfferSequence:
      r.escrow_offer_sequence != null && r.escrow_offer_sequence !== ""
        ? Number(r.escrow_offer_sequence)
        : undefined,
    escrowSubmitterAccount: r.escrow_submitter_account ? String(r.escrow_submitter_account) : undefined,
  };
}

function rowToSettlement(r: Record<string, unknown>): SettlementRecord {
  const periodMode = (r.period_mode as SettlementRecord["periodMode"]) || "calendar_utc";
  return {
    id: String(r.id),
    contractId: String(r.contract_id),
    periodYear: Number(r.period_year),
    periodMonth: Number(r.period_month),
    status: r.status as SettlementRecord["status"],
    lastLedgerIndex: r.last_ledger_index != null ? Number(r.last_ledger_index) : undefined,
    ledgerCloseCount: Number(r.ledger_close_count),
    createdAt: toIso(r.created_at as Date),
    updatedAt: toIso(r.updated_at as Date),
    amountMinor: r.amount_minor != null ? Number(r.amount_minor) : undefined,
    currencyCode: r.currency_code ? String(r.currency_code) : "XRP",
    batchId: r.batch_id ? String(r.batch_id) : undefined,
    periodMode,
    confirmedAt: r.confirmed_at ? toIso(r.confirmed_at as Date) : undefined,
  };
}

function rowToExportJob(r: Record<string, unknown>): ExportJobRecord {
  const fj = r.filter_json;
  const filter =
    fj && typeof fj === "object" && !Array.isArray(fj)
      ? (fj as AuditFilter)
      : (JSON.parse(String(fj ?? "{}")) as AuditFilter);
  return {
    id: String(r.id),
    kind: r.kind as ExportJobRecord["kind"],
    status: r.status as ExportJobRecord["status"],
    filter,
    maxExport: Number(r.max_export),
    resultNdjson: r.result_ndjson != null ? String(r.result_ndjson) : undefined,
    error: r.error != null ? String(r.error) : undefined,
    createdAt: toIso(r.created_at as Date),
    updatedAt: toIso(r.updated_at as Date),
  };
}

function rowToAudit(r: Record<string, unknown>): AuditLog {
  return {
    id: String(r.id),
    entityType: String(r.entity_type),
    entityId: String(r.entity_id),
    action: String(r.action),
    actorId: String(r.actor_id),
    before: r.before_json != null ? (r.before_json as Record<string, unknown>) : undefined,
    after: r.after_json != null ? (r.after_json as Record<string, unknown>) : undefined,
    metadata: r.metadata_json != null ? (r.metadata_json as Record<string, unknown>) : undefined,
    createdAt: toIso(r.created_at as Date),
  };
}

function auditFilterBindings(filter: AuditFilter): { where: string; values: unknown[] } {
  const conditions: string[] = ["1=1"];
  const values: unknown[] = [];
  let i = 1;
  if (filter.entityType) {
    conditions.push(`entity_type = $${i}`);
    values.push(filter.entityType);
    i += 1;
  }
  if (filter.entityId) {
    conditions.push(`entity_id = $${i}`);
    values.push(filter.entityId);
    i += 1;
  }
  if (filter.from) {
    conditions.push(`created_at >= $${i}::timestamptz`);
    values.push(filter.from);
    i += 1;
  }
  if (filter.to) {
    conditions.push(`created_at <= $${i}::timestamptz`);
    values.push(filter.to);
    i += 1;
  }
  return { where: conditions.join(" AND "), values };
}

function rowToEvent(r: Record<string, unknown>): EventEnvelope {
  return {
    eventId: String(r.event_id),
    eventType: String(r.event_type),
    occurredAt: toIso(r.occurred_at as Date),
    entityType: String(r.entity_type),
    entityId: String(r.entity_id),
    payload: (r.payload as Record<string, unknown>) ?? {},
    traceId: String(r.trace_id),
  };
}

function rowToDelayedJob(r: Record<string, unknown>): DelayedJob {
  return {
    id: String(r.id),
    kind: String(r.kind),
    payload: (r.payload as Record<string, unknown>) ?? {},
    runAfter: toIso(r.run_after as Date),
    attempts: Number(r.attempts),
    maxAttempts: Number(r.max_attempts),
    lockedUntil: r.locked_until != null ? toIso(r.locked_until as Date) : undefined,
    lastError: r.last_error != null ? String(r.last_error) : undefined,
    createdAt: toIso(r.created_at as Date),
    updatedAt: toIso(r.updated_at as Date),
  };
}

function rowToNotification(r: Record<string, unknown>): NotificationEvent {
  return {
    id: String(r.id),
    eventType: String(r.event_type),
    recipientId: String(r.recipient_id),
    channel: r.channel as NotificationEvent["channel"],
    status: r.status as NotificationEvent["status"],
    payload: (r.payload as Record<string, unknown>) ?? {},
    createdAt: toIso(r.created_at as Date),
    updatedAt: r.updated_at != null ? toIso(r.updated_at as Date) : undefined,
    attemptCount: r.attempt_count != null ? Number(r.attempt_count) : 0,
    nextAttemptAt: r.next_attempt_at != null ? toIso(r.next_attempt_at as Date) : undefined,
    lastError: r.last_error ? String(r.last_error) : undefined,
    deadLetter: Boolean(r.dead_letter),
  };
}

function rowToNotificationOutbox(r: Record<string, unknown>): NotificationOutboxRecord {
  return {
    id: String(r.id),
    idempotencyKey: String(r.idempotency_key),
    eventType: String(r.event_type),
    recipientId: String(r.recipient_id),
    channel: r.channel as NotificationOutboxRecord["channel"],
    payload: (r.payload as Record<string, unknown>) ?? {},
    status: r.status as NotificationOutboxRecord["status"],
    attempts: Number(r.attempts),
    lastError: r.last_error ? String(r.last_error) : undefined,
    createdAt: toIso(r.created_at as Date),
    updatedAt: toIso(r.updated_at as Date),
    processingStartedAt: r.processing_started_at ? toIso(r.processing_started_at as Date) : undefined,
    dispatchedNotificationId: r.dispatched_notification_id ? String(r.dispatched_notification_id) : undefined,
  };
}

export class PostgresRepository implements AppRepository {
  readonly kind = "postgres" as const;

  constructor(private readonly pool: Pool) {}

  async pingStorage(): Promise<{ ok: boolean; detail?: string }> {
    try {
      await this.q("SELECT 1 AS ok");
      return { ok: true };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : "unknown error" };
    }
  }

  private async q<T>(text: string, values?: unknown[]): Promise<T[]> {
    const res = await this.pool.query(text, values);
    return res.rows as T[];
  }

  async getContract(id: string): Promise<Contract | undefined> {
    const rows = await this.q<Record<string, unknown>>("SELECT * FROM contracts WHERE id = $1", [id]);
    return rows[0] ? rowToContract(rows[0]) : undefined;
  }

  async saveContract(c: Contract): Promise<void> {
    await this.pool.query(
      `INSERT INTO contracts (id, tenant_id, landlord_id, status, escrow_create_tx_hash, deposit_amount, stake_amount, starts_at, ends_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (id) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         landlord_id = EXCLUDED.landlord_id,
         status = EXCLUDED.status,
         escrow_create_tx_hash = EXCLUDED.escrow_create_tx_hash,
         deposit_amount = EXCLUDED.deposit_amount,
         stake_amount = EXCLUDED.stake_amount,
         starts_at = EXCLUDED.starts_at,
         ends_at = EXCLUDED.ends_at,
         updated_at = EXCLUDED.updated_at`,
      [
        c.id,
        c.tenantId,
        c.landlordId,
        c.status,
        c.escrowCreateTxHash ?? null,
        c.depositAmount ?? null,
        c.stakeAmount ?? null,
        c.startsAt ?? null,
        c.endsAt ?? null,
        c.createdAt,
        c.updatedAt,
      ],
    );
  }

  async hasContract(id: string): Promise<boolean> {
    const rows = await this.q<{ ok: number }>("SELECT 1 AS ok FROM contracts WHERE id = $1 LIMIT 1", [id]);
    return rows.length > 0;
  }

  async getEvidence(id: string): Promise<EvidenceFile | undefined> {
    const rows = await this.q<Record<string, unknown>>("SELECT * FROM evidences WHERE id = $1", [id]);
    return rows[0] ? rowToEvidence(rows[0]) : undefined;
  }

  async saveEvidence(e: EvidenceFile): Promise<void> {
    await this.pool.query(
      `INSERT INTO evidences (
         id, contract_id, dispute_id, uploader_id, category, cid, sha256, mime_type, size_bytes,
         version, is_encrypted, encryption_scheme, retain_until, retention_class, jurisdiction, legal_hold_until,
         storage_provider, local_content_hash_seed, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (id) DO UPDATE SET
         contract_id = EXCLUDED.contract_id,
         dispute_id = EXCLUDED.dispute_id,
         uploader_id = EXCLUDED.uploader_id,
         category = EXCLUDED.category,
         cid = EXCLUDED.cid,
         sha256 = EXCLUDED.sha256,
         mime_type = EXCLUDED.mime_type,
         size_bytes = EXCLUDED.size_bytes,
         version = EXCLUDED.version,
         is_encrypted = EXCLUDED.is_encrypted,
         encryption_scheme = EXCLUDED.encryption_scheme,
         retain_until = EXCLUDED.retain_until,
         retention_class = EXCLUDED.retention_class,
         jurisdiction = EXCLUDED.jurisdiction,
         legal_hold_until = EXCLUDED.legal_hold_until,
         storage_provider = EXCLUDED.storage_provider,
         local_content_hash_seed = EXCLUDED.local_content_hash_seed`,
      [
        e.id,
        e.contractId,
        e.disputeId ?? null,
        e.uploaderId,
        e.category,
        e.cid,
        e.sha256,
        e.mimeType,
        e.sizeBytes,
        e.version,
        e.isEncrypted,
        e.encryptionScheme ?? null,
        e.retainUntil ?? null,
        e.retentionClass,
        e.jurisdiction ?? null,
        e.legalHoldUntil ?? null,
        e.storageProvider,
        e.localContentHashSeed,
        e.createdAt,
      ],
    );
  }

  async findEvidenceByCid(cid: string): Promise<EvidenceFile | undefined> {
    const rows = await this.q<Record<string, unknown>>("SELECT * FROM evidences WHERE cid = $1 LIMIT 1", [cid]);
    return rows[0] ? rowToEvidence(rows[0]) : undefined;
  }

  async countEvidenceVersions(
    contractId: string,
    disputeId: string | undefined,
    category: string,
  ): Promise<number> {
    const rows = await this.q<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM evidences
       WHERE contract_id = $1 AND dispute_id IS NOT DISTINCT FROM $2 AND category = $3`,
      [contractId, disputeId ?? null, category],
    );
    return Number(rows[0]?.n ?? 0);
  }

  async hasEvidence(id: string): Promise<boolean> {
    const rows = await this.q<{ ok: number }>("SELECT 1 AS ok FROM evidences WHERE id = $1 LIMIT 1", [id]);
    return rows.length > 0;
  }

  async getDispute(id: string): Promise<DisputeCase | undefined> {
    const rows = await this.q<Record<string, unknown>>("SELECT * FROM disputes WHERE id = $1", [id]);
    return rows[0] ? rowToDispute(rows[0]) : undefined;
  }

  async saveDispute(d: DisputeCase): Promise<void> {
    await this.pool.query(
      `INSERT INTO disputes (
         id, contract_id, raised_by, reason_code, status, evidence_bundle,
         created_at, updated_at, review_deadline_at, escalated_at
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)
       ON CONFLICT (id) DO UPDATE SET
         contract_id = EXCLUDED.contract_id,
         raised_by = EXCLUDED.raised_by,
         reason_code = EXCLUDED.reason_code,
         status = EXCLUDED.status,
         evidence_bundle = EXCLUDED.evidence_bundle,
         updated_at = EXCLUDED.updated_at,
         review_deadline_at = EXCLUDED.review_deadline_at,
         escalated_at = EXCLUDED.escalated_at`,
      [
        d.id,
        d.contractId,
        d.raisedBy,
        d.reasonCode,
        d.status,
        JSON.stringify(d.evidenceBundle),
        d.createdAt,
        d.updatedAt,
        d.reviewDeadlineAt ?? null,
        d.escalatedAt ?? null,
      ],
    );
  }

  async appendDisputeVerifierVote(v: DisputeVerifierVoteRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO dispute_verifier_votes (id, dispute_id, verifier_id, recommendation, created_at)
       VALUES ($1,$2,$3,$4,$5)`,
      [v.id, v.disputeId, v.verifierId, v.recommendation, v.createdAt],
    );
  }

  async listDisputeVerifierVotes(disputeId: string): Promise<DisputeVerifierVoteRecord[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM dispute_verifier_votes WHERE dispute_id = $1 ORDER BY created_at ASC`,
      [disputeId],
    );
    return rows.map((r) => ({
      id: String(r.id),
      disputeId: String(r.dispute_id),
      verifierId: String(r.verifier_id),
      recommendation: r.recommendation as DisputeVerifierVoteRecord["recommendation"],
      createdAt: toIso(r.created_at as Date),
    }));
  }

  async listDisputeVerifierRegistry(): Promise<DisputeVerifierRegistryEntry[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM dispute_verifier_registry ORDER BY created_at ASC`,
    );
    return rows.map((r) => ({
      id: String(r.id),
      verifierId: String(r.verifier_id),
      displayLabel: r.display_label ? String(r.display_label) : undefined,
      active: Boolean(r.active),
      createdAt: toIso(r.created_at as Date),
    }));
  }

  async upsertDisputeVerifierRegistryEntry(e: DisputeVerifierRegistryEntry): Promise<void> {
    await this.pool.query(
      `INSERT INTO dispute_verifier_registry (id, verifier_id, display_label, active, created_at)
       VALUES ($1,$2,$3,$4,$5::timestamptz)
       ON CONFLICT (verifier_id) DO UPDATE SET
         display_label = EXCLUDED.display_label,
         active = EXCLUDED.active`,
      [e.id, e.verifierId, e.displayLabel ?? null, e.active, e.createdAt],
    );
  }

  async listEvidencesPastRetention(nowIso: string): Promise<EvidenceFile[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM evidences
       WHERE retain_until IS NOT NULL AND retain_until < $1::timestamptz
         AND NOT (
           (retention_class = 'legal_hold' AND (legal_hold_until IS NULL OR legal_hold_until >= $1::timestamptz))
           OR (retention_class IS DISTINCT FROM 'legal_hold' AND legal_hold_until IS NOT NULL AND legal_hold_until >= $1::timestamptz)
         )`,
      [nowIso],
    );
    return rows.map(rowToEvidence);
  }

  async deleteEvidence(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM evidences WHERE id = $1`, [id]);
  }

  async getOperatorStatsSummary(): Promise<OperatorStatsSummary> {
    const [contracts, disputes, xrpl, notifications, evCount, settlements] = await Promise.all([
      this.q<{ status: string; n: string }>(
        `SELECT status, count(*)::text AS n FROM contracts GROUP BY status`,
      ),
      this.q<{ status: string; n: string }>(`SELECT status, count(*)::text AS n FROM disputes GROUP BY status`),
      this.q<{ tracking_status: string; n: string }>(
        `SELECT tracking_status, count(*)::text AS n FROM xrpl_txs GROUP BY tracking_status`,
      ),
      this.q<{ status: string; n: string }>(
        `SELECT status, count(*)::text AS n FROM notifications GROUP BY status`,
      ),
      this.q<{ n: string }>(`SELECT count(*)::text AS n FROM evidences`),
      this.q<{ status: string; n: string }>(
        `SELECT status, count(*)::text AS n FROM settlements GROUP BY status`,
      ),
    ]);
    const contractsByStatus: Record<string, number> = {};
    for (const r of contracts) contractsByStatus[r.status] = Number(r.n);
    const disputesByStatus: Record<string, number> = {};
    for (const r of disputes) disputesByStatus[r.status] = Number(r.n);
    const xrplByTracking: Record<string, number> = {};
    for (const r of xrpl) xrplByTracking[r.tracking_status] = Number(r.n);
    const notificationsByStatus: Record<string, number> = {};
    for (const r of notifications) notificationsByStatus[r.status] = Number(r.n);
    const settlementsByStatus: Record<string, number> = {};
    for (const r of settlements) settlementsByStatus[r.status] = Number(r.n);
    return {
      contractsByStatus,
      disputesByStatus,
      xrplByTracking,
      notificationsByStatus,
      evidencesTotal: Number(evCount[0]?.n ?? 0),
      settlementsByStatus,
    };
  }

  async getReportsSummary(params: ReportSummaryParams): Promise<ReportSummary> {
    const global = await this.getOperatorStatsSummary();
    const from = params.from ?? null;
    const to = params.to ?? null;
    const tenantId = params.tenantId ?? null;
    const landlordId = params.landlordId ?? null;
    const scopeArgs = [from, to, tenantId, landlordId];

    const [contractsRows, disputesRows, settlementsRows, xrplRows, auditsCountRows] = await Promise.all([
      this.q<{ status: string; n: string }>(
        `SELECT status, count(*)::text AS n FROM contracts
         WHERE ($1::timestamptz IS NULL OR updated_at >= $1::timestamptz)
           AND ($2::timestamptz IS NULL OR updated_at <= $2::timestamptz)
           AND ($3::text IS NULL OR tenant_id = $3)
           AND ($4::text IS NULL OR landlord_id = $4)
         GROUP BY status`,
        scopeArgs,
      ),
      this.q<{ status: string; n: string }>(
        `SELECT d.status, count(*)::text AS n FROM disputes d
         JOIN contracts c ON c.id = d.contract_id
         WHERE ($1::timestamptz IS NULL OR d.updated_at >= $1::timestamptz)
           AND ($2::timestamptz IS NULL OR d.updated_at <= $2::timestamptz)
           AND ($3::text IS NULL OR c.tenant_id = $3)
           AND ($4::text IS NULL OR c.landlord_id = $4)
         GROUP BY d.status`,
        scopeArgs,
      ),
      this.q<{ status: string; n: string }>(
        `SELECT s.status, count(*)::text AS n FROM settlements s
         JOIN contracts c ON c.id = s.contract_id
         WHERE ($1::timestamptz IS NULL OR s.updated_at >= $1::timestamptz)
           AND ($2::timestamptz IS NULL OR s.updated_at <= $2::timestamptz)
           AND ($3::text IS NULL OR c.tenant_id = $3)
           AND ($4::text IS NULL OR c.landlord_id = $4)
         GROUP BY s.status`,
        scopeArgs,
      ),
      this.q<{ tracking_status: string; n: string }>(
        `SELECT x.tracking_status, count(*)::text AS n FROM xrpl_txs x
         WHERE ($1::timestamptz IS NULL OR x.last_checked_at >= $1::timestamptz)
           AND ($2::timestamptz IS NULL OR x.last_checked_at <= $2::timestamptz)
           AND (
             ($3::text IS NULL AND $4::text IS NULL)
             OR EXISTS (
               SELECT 1 FROM disputes d
               JOIN contracts c ON c.id = d.contract_id
               WHERE d.id = x.dispute_id
                 AND ($3::text IS NULL OR c.tenant_id = $3)
                 AND ($4::text IS NULL OR c.landlord_id = $4)
             )
           )
         GROUP BY x.tracking_status`,
        scopeArgs,
      ),
      this.q<{ n: string }>(
        `SELECT count(*)::text AS n FROM audits
         WHERE ($1::timestamptz IS NULL OR created_at >= $1::timestamptz)
           AND ($2::timestamptz IS NULL OR created_at <= $2::timestamptz)`,
        [from, to],
      ),
    ]);

    const contractsByStatus: Record<string, number> = {};
    for (const r of contractsRows) contractsByStatus[r.status] = Number(r.n);
    const disputesByStatus: Record<string, number> = {};
    for (const r of disputesRows) disputesByStatus[r.status] = Number(r.n);
    const settlementsByStatus: Record<string, number> = {};
    for (const r of settlementsRows) settlementsByStatus[r.status] = Number(r.n);
    const xrplByTracking: Record<string, number> = {};
    for (const r of xrplRows) xrplByTracking[r.tracking_status] = Number(r.n);
    const scoped: ReportScopedBucket = {
      contractsByStatus,
      disputesByStatus,
      settlementsByStatus,
      xrplByTracking,
      auditsCount: Number(auditsCountRows[0]?.n ?? 0),
    };

    return {
      generatedAt: nowIso(),
      window: {
        from: params.from,
        to: params.to,
        tenantId: params.tenantId,
        landlordId: params.landlordId,
      },
      global,
      scoped,
    };
  }

  async saveDecision(d: CaseDecision): Promise<void> {
    await this.pool.query(
      `INSERT INTO decisions (id, dispute_id, decision, decided_by, memo, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET
         dispute_id = EXCLUDED.dispute_id,
         decision = EXCLUDED.decision,
         decided_by = EXCLUDED.decided_by,
         memo = EXCLUDED.memo`,
      [d.id, d.disputeId, d.decision, d.decidedBy, d.memo ?? null, d.createdAt],
    );
  }

  async getXrplTx(txHash: string): Promise<XrplTransaction | undefined> {
    const rows = await this.q<Record<string, unknown>>("SELECT * FROM xrpl_txs WHERE tx_hash = $1", [txHash]);
    return rows[0] ? rowToXrpl(rows[0]) : undefined;
  }

  async saveXrplTx(t: XrplTransaction): Promise<void> {
    await this.pool.query(
      `INSERT INTO xrpl_txs (
         tx_hash, id, tx_type, account, dispute_id, network, tracking_status, validated,
         ledger_index, result_code, outcome_class, retries, last_checked_at,
         escrow_owner, escrow_destination, escrow_offer_sequence, escrow_submitter_account
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (tx_hash) DO UPDATE SET
         id = EXCLUDED.id,
         tx_type = EXCLUDED.tx_type,
         account = EXCLUDED.account,
         dispute_id = EXCLUDED.dispute_id,
         network = EXCLUDED.network,
         tracking_status = EXCLUDED.tracking_status,
         validated = EXCLUDED.validated,
         ledger_index = EXCLUDED.ledger_index,
         result_code = EXCLUDED.result_code,
         outcome_class = EXCLUDED.outcome_class,
         retries = EXCLUDED.retries,
         last_checked_at = EXCLUDED.last_checked_at,
         escrow_owner = EXCLUDED.escrow_owner,
         escrow_destination = EXCLUDED.escrow_destination,
         escrow_offer_sequence = EXCLUDED.escrow_offer_sequence,
         escrow_submitter_account = EXCLUDED.escrow_submitter_account`,
      [
        t.txHash,
        t.id,
        t.txType,
        t.account ?? null,
        t.disputeId ?? null,
        t.network,
        t.trackingStatus,
        t.validated,
        t.ledgerIndex ?? null,
        t.resultCode ?? null,
        t.outcomeClass ?? null,
        t.retries,
        t.lastCheckedAt,
        t.escrowOwner ?? null,
        t.escrowDestination ?? null,
        t.escrowOfferSequence ?? null,
        t.escrowSubmitterAccount ?? null,
      ],
    );
  }

  async listXrplTxs(): Promise<XrplTransaction[]> {
    const rows = await this.q<Record<string, unknown>>("SELECT * FROM xrpl_txs");
    return rows.map(rowToXrpl);
  }

  async listXrplSubscribeAccounts(max: number): Promise<string[]> {
    const rows = await this.q<{ account: string }>(
      `SELECT DISTINCT account FROM xrpl_txs
       WHERE validated = false AND account IS NOT NULL AND length(trim(account)) > 0
       LIMIT $1`,
      [max],
    );
    return rows.map((r) => r.account);
  }

  async tryRecordXrplIngestionEvent(params: {
    ledgerIndex: number;
    txHash: string;
    eventSource: string;
    engineResult?: string;
  }): Promise<boolean> {
    const id = randomId("xie");
    const res = await this.pool.query(
      `INSERT INTO xrpl_ingestion_events (id, ledger_index, tx_hash, event_source, engine_result, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (ledger_index, tx_hash, event_source) DO NOTHING
       RETURNING id`,
      [
        id,
        params.ledgerIndex,
        params.txHash,
        params.eventSource,
        params.engineResult ?? null,
        nowIso(),
      ],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async saveNotification(n: NotificationEvent): Promise<void> {
    const updatedAt = n.updatedAt ?? n.createdAt;
    await this.pool.query(
      `INSERT INTO notifications (
         id, event_type, recipient_id, channel, status, payload, created_at,
         attempt_count, next_attempt_at, last_error, dead_letter, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET
         event_type = EXCLUDED.event_type,
         recipient_id = EXCLUDED.recipient_id,
         channel = EXCLUDED.channel,
         status = EXCLUDED.status,
         payload = EXCLUDED.payload,
         attempt_count = EXCLUDED.attempt_count,
         next_attempt_at = EXCLUDED.next_attempt_at,
         last_error = EXCLUDED.last_error,
         dead_letter = EXCLUDED.dead_letter,
         updated_at = EXCLUDED.updated_at`,
      [
        n.id,
        n.eventType,
        n.recipientId,
        n.channel,
        n.status,
        JSON.stringify(n.payload),
        n.createdAt,
        n.attemptCount ?? 0,
        n.nextAttemptAt ?? null,
        n.lastError ?? null,
        n.deadLetter ?? false,
        updatedAt,
      ],
    );
  }

  async getNotification(id: string): Promise<NotificationEvent | undefined> {
    const rows = await this.q<Record<string, unknown>>("SELECT * FROM notifications WHERE id = $1", [id]);
    return rows[0] ? rowToNotification(rows[0]) : undefined;
  }

  async listDueNotifications(nowIso: string, limit: number): Promise<NotificationEvent[]> {
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM notifications
       WHERE dead_letter = false
         AND (
           status = 'queued'
           OR (status = 'retry_scheduled' AND (next_attempt_at IS NULL OR next_attempt_at <= $1::timestamptz))
         )
       ORDER BY created_at ASC
       LIMIT $2`,
      [nowIso, limit],
    );
    return rows.map(rowToNotification);
  }

  async appendNotificationOutbox(row: NotificationOutboxRecord): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO notification_outbox (
         id, idempotency_key, event_type, recipient_id, channel, payload, status, attempts, last_error,
         created_at, updated_at, processing_started_at, dispatched_notification_id
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10::timestamptz,$11::timestamptz,$12,$13)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [
        row.id,
        row.idempotencyKey,
        row.eventType,
        row.recipientId,
        row.channel,
        JSON.stringify(row.payload),
        row.status,
        row.attempts,
        row.lastError ?? null,
        row.createdAt,
        row.updatedAt,
        row.processingStartedAt ?? null,
        row.dispatchedNotificationId ?? null,
      ],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async claimNotificationOutboxPending(limit: number, nowIsoStr: string): Promise<NotificationOutboxRecord[]> {
    const rows = await this.q<Record<string, unknown>>(
      `WITH c AS (
         SELECT id FROM notification_outbox
         WHERE status = 'pending'
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE notification_outbox n
       SET status = 'processing',
           processing_started_at = $2::timestamptz,
           updated_at = $2::timestamptz
       FROM c WHERE n.id = c.id
       RETURNING n.*`,
      [limit, nowIsoStr],
    );
    return rows.map(rowToNotificationOutbox);
  }

  async updateNotificationOutbox(row: NotificationOutboxRecord): Promise<void> {
    await this.pool.query(
      `UPDATE notification_outbox SET
         event_type = $2,
         recipient_id = $3,
         channel = $4,
         payload = $5::jsonb,
         status = $6,
         attempts = $7,
         last_error = $8,
         updated_at = $9::timestamptz,
         processing_started_at = $10::timestamptz,
         dispatched_notification_id = $11
       WHERE id = $1`,
      [
        row.id,
        row.eventType,
        row.recipientId,
        row.channel,
        JSON.stringify(row.payload),
        row.status,
        row.attempts,
        row.lastError ?? null,
        row.updatedAt,
        row.processingStartedAt ?? null,
        row.dispatchedNotificationId ?? null,
      ],
    );
  }

  async getNotificationOutbox(id: string): Promise<NotificationOutboxRecord | undefined> {
    const rows = await this.q<Record<string, unknown>>(`SELECT * FROM notification_outbox WHERE id = $1`, [id]);
    return rows[0] ? rowToNotificationOutbox(rows[0]) : undefined;
  }

  async listNotificationOutboxPage(
    filter: NotificationOutboxListFilter,
    params: ListParams,
  ): Promise<Paginated<NotificationOutboxRecord>> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let n = 1;
    if (filter.status) {
      conditions.push(`status = $${n}`);
      values.push(filter.status);
      n += 1;
    }
    const where = conditions.join(" AND ");
    const countRows = await this.q<{ c: string }>(
      `SELECT count(*)::text AS c FROM notification_outbox WHERE ${where}`,
      values,
    );
    const total = Number(countRows[0]?.c ?? 0);
    const limIdx = n;
    const offIdx = n + 1;
    const dataRows = await this.q<Record<string, unknown>>(
      `SELECT * FROM notification_outbox WHERE ${where} ORDER BY created_at DESC LIMIT $${limIdx} OFFSET $${offIdx}`,
      [...values, params.limit, params.offset],
    );
    return {
      items: dataRows.map(rowToNotificationOutbox),
      total,
      limit: params.limit,
      offset: params.offset,
    };
  }

  async recoverStaleNotificationOutboxProcessing(staleBeforeIso: string, nowIsoStr: string): Promise<number> {
    const res = await this.pool.query(
      `UPDATE notification_outbox
       SET status = 'pending',
           processing_started_at = NULL,
           updated_at = $2::timestamptz
       WHERE status = 'processing'
         AND processing_started_at IS NOT NULL
         AND processing_started_at < $1::timestamptz`,
      [staleBeforeIso, nowIsoStr],
    );
    return res.rowCount ?? 0;
  }

  async appendAudit(log: AuditLog): Promise<void> {
    await this.pool.query(
      `INSERT INTO audits (id, entity_type, entity_id, action, actor_id, before_json, after_json, metadata_json, created_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9)`,
      [
        log.id,
        log.entityType,
        log.entityId,
        log.action,
        log.actorId,
        log.before != null ? JSON.stringify(log.before) : null,
        log.after != null ? JSON.stringify(log.after) : null,
        log.metadata != null ? JSON.stringify(log.metadata) : null,
        log.createdAt,
      ],
    );
  }

  async appendEvent(ev: EventEnvelope): Promise<void> {
    await this.pool.query(
      `INSERT INTO events (event_id, event_type, occurred_at, entity_type, entity_id, payload, trace_id)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [ev.eventId, ev.eventType, ev.occurredAt, ev.entityType, ev.entityId, JSON.stringify(ev.payload), ev.traceId],
    );
  }

  async listAudits(filter: AuditFilter): Promise<AuditLog[]> {
    const { where, values } = auditFilterBindings(filter);
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM audits WHERE ${where} ORDER BY created_at ASC, id ASC`,
      values,
    );
    return rows.map(rowToAudit);
  }

  async listAuditsPage(filter: AuditFilter, params: ListParams): Promise<Paginated<AuditLog>> {
    const { where, values: baseValues } = auditFilterBindings(filter);
    const countRows = await this.q<{ n: string }>(`SELECT count(*)::text AS n FROM audits WHERE ${where}`, baseValues);
    const total = Number(countRows[0]?.n ?? 0);
    const limIdx = baseValues.length + 1;
    const offIdx = baseValues.length + 2;
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM audits WHERE ${where} ORDER BY created_at ASC, id ASC LIMIT $${limIdx} OFFSET $${offIdx}`,
      [...baseValues, params.limit, params.offset],
    );
    return {
      items: rows.map(rowToAudit),
      total,
      limit: params.limit,
      offset: params.offset,
    };
  }

  async listAuditsAfterCursor(filter: AuditFilter, params: { limit: number; cursor?: string }): Promise<AuditKeysetPage> {
    const { where, values: v0 } = auditFilterBindings(filter);
    const values = [...v0];
    let cursorSql = "TRUE";
    if (params.cursor) {
      const dec = decodeAuditCursor(params.cursor);
      if (!dec) {
        const err = new Error("INVALID_AUDIT_CURSOR");
        (err as { code?: string }).code = "INVALID_AUDIT_CURSOR";
        throw err;
      }
      const i1 = values.length + 1;
      const i2 = values.length + 2;
      cursorSql = `(created_at > $${i1}::timestamptz OR (created_at = $${i1}::timestamptz AND id > $${i2}))`;
      values.push(dec.createdAt, dec.id);
    }
    const limIdx = values.length + 1;
    values.push(params.limit + 1);
    const rows = await this.q<Record<string, unknown>>(
      `SELECT * FROM audits WHERE ${where} AND (${cursorSql}) ORDER BY created_at ASC, id ASC LIMIT $${limIdx}`,
      values,
    );
    const mapped = rows.map(rowToAudit);
    const hasMore = mapped.length > params.limit;
    const items = hasMore ? mapped.slice(0, params.limit) : mapped;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last ? encodeAuditCursor({ createdAt: last.createdAt, id: last.id }) : null;
    return { items, nextCursor };
  }

  async listEvents(filter: EventFilter): Promise<EventEnvelope[]> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let i = 1;
    if (filter.entityType) {
      conditions.push(`entity_type = $${i}`);
      values.push(filter.entityType);
      i += 1;
    }
    if (filter.entityId) {
      conditions.push(`entity_id = $${i}`);
      values.push(filter.entityId);
      i += 1;
    }
    if (filter.eventType) {
      conditions.push(`event_type = $${i}`);
      values.push(filter.eventType);
      i += 1;
    }
    const sql = `SELECT * FROM events WHERE ${conditions.join(" AND ")} ORDER BY occurred_at ASC`;
    const rows = await this.q<Record<string, unknown>>(sql, values);
    return rows.map(rowToEvent);
  }

  async createDelayedJobIfAbsent(job: DelayedJob): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO delayed_jobs (id, kind, payload, run_after, attempts, max_attempts, locked_until, last_error, created_at, updated_at)
       VALUES ($1,$2,$3::jsonb,$4::timestamptz,$5,$6,$7,$8,$9::timestamptz,$10::timestamptz)
       ON CONFLICT (id) DO NOTHING`,
      [
        job.id,
        job.kind,
        JSON.stringify(job.payload),
        job.runAfter,
        job.attempts,
        job.maxAttempts,
        job.lockedUntil ?? null,
        job.lastError ?? null,
        job.createdAt,
        job.updatedAt,
      ],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async claimDueDelayedJobs(
    kind: string,
    nowIsoStr: string,
    limit: number,
    lockTtlMs: number,
  ): Promise<DelayedJob[]> {
    const lockUntil = new Date(Date.parse(nowIsoStr) + lockTtlMs).toISOString();
    const rows = await this.q<Record<string, unknown>>(
      `WITH picked AS (
         SELECT id FROM delayed_jobs
         WHERE kind = $1
           AND run_after <= $2::timestamptz
           AND (locked_until IS NULL OR locked_until <= $2::timestamptz)
         ORDER BY run_after ASC
         LIMIT $3
         FOR UPDATE SKIP LOCKED
       )
       UPDATE delayed_jobs d
       SET locked_until = $4::timestamptz, updated_at = $2::timestamptz
       FROM picked
       WHERE d.id = picked.id
       RETURNING d.*`,
      [kind, nowIsoStr, limit, lockUntil],
    );
    return rows.map(rowToDelayedJob);
  }

  async deleteDelayedJob(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM delayed_jobs WHERE id = $1`, [id]);
  }

  async bumpDelayedJob(params: {
    id: string;
    runAfter: string;
    attempts: number;
    lastError?: string;
    updatedAt: string;
  }): Promise<void> {
    await this.pool.query(
      `UPDATE delayed_jobs
       SET run_after = $2::timestamptz, attempts = $3, last_error = $4, updated_at = $5::timestamptz, locked_until = NULL
       WHERE id = $1`,
      [params.id, params.runAfter, params.attempts, params.lastError ?? null, params.updatedAt],
    );
  }

  async listContractsPage(filter: ContractListFilter, params: ListParams): Promise<Paginated<Contract>> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let n = 1;
    if (filter.status) {
      conditions.push(`status = $${n}`);
      values.push(filter.status);
      n += 1;
    }
    if (filter.tenantId) {
      conditions.push(`tenant_id = $${n}`);
      values.push(filter.tenantId);
      n += 1;
    }
    if (filter.landlordId) {
      conditions.push(`landlord_id = $${n}`);
      values.push(filter.landlordId);
      n += 1;
    }
    if (filter.updatedFrom) {
      conditions.push(`updated_at >= $${n}::timestamptz`);
      values.push(filter.updatedFrom);
      n += 1;
    }
    if (filter.updatedTo) {
      conditions.push(`updated_at <= $${n}::timestamptz`);
      values.push(filter.updatedTo);
      n += 1;
    }
    const where = conditions.join(" AND ");
    const countRows = await this.q<{ n: string }>(`SELECT count(*)::text AS n FROM contracts WHERE ${where}`, values);
    const total = Number(countRows[0]?.n ?? 0);
    const limIdx = n;
    const offIdx = n + 1;
    const dataRows = await this.q<Record<string, unknown>>(
      `SELECT * FROM contracts WHERE ${where} ORDER BY updated_at DESC LIMIT $${limIdx} OFFSET $${offIdx}`,
      [...values, params.limit, params.offset],
    );
    return {
      items: dataRows.map(rowToContract),
      total,
      limit: params.limit,
      offset: params.offset,
    };
  }

  async listDisputesPage(filter: DisputeListFilter, params: ListParams): Promise<Paginated<DisputeCase>> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let n = 1;
    if (filter.contractId) {
      conditions.push(`contract_id = $${n}`);
      values.push(filter.contractId);
      n += 1;
    }
    if (filter.status) {
      conditions.push(`status = $${n}`);
      values.push(filter.status);
      n += 1;
    }
    if (filter.updatedFrom) {
      conditions.push(`updated_at >= $${n}::timestamptz`);
      values.push(filter.updatedFrom);
      n += 1;
    }
    if (filter.updatedTo) {
      conditions.push(`updated_at <= $${n}::timestamptz`);
      values.push(filter.updatedTo);
      n += 1;
    }
    const where = conditions.join(" AND ");
    const countRows = await this.q<{ n: string }>(`SELECT count(*)::text AS n FROM disputes WHERE ${where}`, values);
    const total = Number(countRows[0]?.n ?? 0);
    const limIdx = n;
    const offIdx = n + 1;
    const dataRows = await this.q<Record<string, unknown>>(
      `SELECT * FROM disputes WHERE ${where} ORDER BY updated_at DESC LIMIT $${limIdx} OFFSET $${offIdx}`,
      [...values, params.limit, params.offset],
    );
    return {
      items: dataRows.map(rowToDispute),
      total,
      limit: params.limit,
      offset: params.offset,
    };
  }

  async listXrplTxsPage(filter: XrplTxListFilter, params: ListParams): Promise<Paginated<XrplTransaction>> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let n = 1;
    if (filter.account) {
      conditions.push(`account = $${n}`);
      values.push(filter.account);
      n += 1;
    }
    if (filter.trackingStatus) {
      conditions.push(`tracking_status = $${n}`);
      values.push(filter.trackingStatus);
      n += 1;
    }
    if (filter.validated !== undefined) {
      conditions.push(`validated = $${n}`);
      values.push(filter.validated);
      n += 1;
    }
    if (filter.network) {
      conditions.push(`network = $${n}`);
      values.push(filter.network);
      n += 1;
    }
    const where = conditions.join(" AND ");
    const countRows = await this.q<{ n: string }>(`SELECT count(*)::text AS n FROM xrpl_txs WHERE ${where}`, values);
    const total = Number(countRows[0]?.n ?? 0);
    const limIdx = n;
    const offIdx = n + 1;
    const dataRows = await this.q<Record<string, unknown>>(
      `SELECT * FROM xrpl_txs WHERE ${where} ORDER BY last_checked_at DESC LIMIT $${limIdx} OFFSET $${offIdx}`,
      [...values, params.limit, params.offset],
    );
    return {
      items: dataRows.map(rowToXrpl),
      total,
      limit: params.limit,
      offset: params.offset,
    };
  }

  async getSettlement(id: string): Promise<SettlementRecord | undefined> {
    const rows = await this.q<Record<string, unknown>>("SELECT * FROM settlements WHERE id = $1", [id]);
    return rows[0] ? rowToSettlement(rows[0]) : undefined;
  }

  async saveSettlement(s: SettlementRecord): Promise<void> {
    await this.pool.query(
      `UPDATE settlements SET
         status = $2,
         last_ledger_index = $3,
         ledger_close_count = $4,
         updated_at = $5::timestamptz,
         amount_minor = $6,
         currency_code = $7,
         batch_id = $8,
         period_mode = $9,
         confirmed_at = $10::timestamptz
       WHERE id = $1`,
      [
        s.id,
        s.status,
        s.lastLedgerIndex ?? null,
        s.ledgerCloseCount,
        s.updatedAt,
        s.amountMinor ?? null,
        s.currencyCode,
        s.batchId ?? null,
        s.periodMode,
        s.confirmedAt ?? null,
      ],
    );
  }

  async listSettlementsPage(
    filter: SettlementListFilter,
    params: ListParams,
  ): Promise<Paginated<SettlementRecord>> {
    const conditions: string[] = ["1=1"];
    const values: unknown[] = [];
    let n = 1;
    if (filter.contractId) {
      conditions.push(`contract_id = $${n}`);
      values.push(filter.contractId);
      n += 1;
    }
    if (filter.status) {
      conditions.push(`status = $${n}`);
      values.push(filter.status);
      n += 1;
    }
    if (filter.periodYear !== undefined) {
      conditions.push(`period_year = $${n}`);
      values.push(filter.periodYear);
      n += 1;
    }
    if (filter.periodMonth !== undefined) {
      conditions.push(`period_month = $${n}`);
      values.push(filter.periodMonth);
      n += 1;
    }
    const where = conditions.join(" AND ");
    const countRows = await this.q<{ cnt: string }>(
      `SELECT count(*)::text AS cnt FROM settlements WHERE ${where}`,
      values,
    );
    const total = Number(countRows[0]?.cnt ?? 0);
    const limIdx = n;
    const offIdx = n + 1;
    const dataRows = await this.q<Record<string, unknown>>(
      `SELECT * FROM settlements WHERE ${where} ORDER BY period_year DESC, period_month DESC, contract_id ASC LIMIT $${limIdx} OFFSET $${offIdx}`,
      [...values, params.limit, params.offset],
    );
    return {
      items: dataRows.map(rowToSettlement),
      total,
      limit: params.limit,
      offset: params.offset,
    };
  }

  async touchSettlementsOnLedgerClose(params: TouchSettlementsOnLedgerCloseParams): Promise<number> {
    const { periodYear, periodMonth, ledgerIndex, nowIso } = params;
    const rows = await this.q<{ n: string }>(
      `WITH upsert AS (
        INSERT INTO settlements (id, contract_id, period_year, period_month, status, last_ledger_index, ledger_close_count, created_at, updated_at, amount_minor, currency_code, batch_id, period_mode, confirmed_at)
        SELECT
          'stl_' || regexp_replace(c.id, '[^a-zA-Z0-9_]', '_', 'g') || '_' || $1::int || '_' || $2::int,
          c.id,
          $1::int,
          $2::int,
          'collecting',
          $3::bigint,
          1,
          $4::timestamptz,
          $4::timestamptz,
          NULL,
          'XRP',
          NULL,
          'calendar_utc',
          NULL
        FROM contracts c
        WHERE c.status IN ('active', 'escrow_validated')
        ON CONFLICT (contract_id, period_year, period_month) DO UPDATE SET
          last_ledger_index = CASE WHEN settlements.status = 'archived' THEN settlements.last_ledger_index ELSE EXCLUDED.last_ledger_index END,
          ledger_close_count = CASE WHEN settlements.status = 'archived' THEN settlements.ledger_close_count ELSE settlements.ledger_close_count + 1 END,
          updated_at = CASE WHEN settlements.status = 'archived' THEN settlements.updated_at ELSE EXCLUDED.updated_at END
        RETURNING settlements.contract_id
      )
      SELECT count(*)::text AS n FROM upsert`,
      [periodYear, periodMonth, ledgerIndex, nowIso],
    );
    return Number(rows[0]?.n ?? 0);
  }

  async createExportJob(job: ExportJobRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO export_jobs (id, kind, status, filter_json, max_export, result_ndjson, error, created_at, updated_at)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8::timestamptz,$9::timestamptz)`,
      [
        job.id,
        job.kind,
        job.status,
        JSON.stringify(job.filter),
        job.maxExport,
        job.resultNdjson ?? null,
        job.error ?? null,
        job.createdAt,
        job.updatedAt,
      ],
    );
  }

  async getExportJob(id: string): Promise<ExportJobRecord | undefined> {
    const rows = await this.q<Record<string, unknown>>("SELECT * FROM export_jobs WHERE id = $1", [id]);
    return rows[0] ? rowToExportJob(rows[0]) : undefined;
  }

  async claimExportJobsPending(limit: number, nowIso: string): Promise<ExportJobRecord[]> {
    const rows = await this.q<Record<string, unknown>>(
      `WITH sel AS (
         SELECT id FROM export_jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED
       )
       UPDATE export_jobs j
       SET status = 'running', updated_at = $2::timestamptz
       FROM sel WHERE j.id = sel.id
       RETURNING j.*`,
      [limit, nowIso],
    );
    return rows.map(rowToExportJob);
  }

  async updateExportJob(job: ExportJobRecord): Promise<void> {
    await this.pool.query(
      `UPDATE export_jobs SET
         status = $2,
         filter_json = $3::jsonb,
         max_export = $4,
         result_ndjson = $5,
         error = $6,
         updated_at = $7::timestamptz
       WHERE id = $1`,
      [
        job.id,
        job.status,
        JSON.stringify(job.filter),
        job.maxExport,
        job.resultNdjson ?? null,
        job.error ?? null,
        job.updatedAt,
      ],
    );
  }
}
