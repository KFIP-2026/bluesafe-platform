import { db } from "../store.js";
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
import { evidenceBlockedFromRetentionPurge } from "../services/evidence-retention.js";
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
import { settlementDeterministicId } from "../services/settlement-ledger.js";
import { nowIso } from "../utils.js";

function withSettlementDefaults(s: SettlementRecord): SettlementRecord {
  return {
    ...s,
    currencyCode: s.currencyCode ?? "XRP",
    periodMode: s.periodMode ?? "calendar_utc",
    ledgerCloseCount: s.ledgerCloseCount ?? 0,
  };
}

export class MemoryRepository implements AppRepository {
  readonly kind = "memory" as const;

  async pingStorage(): Promise<{ ok: boolean; detail?: string }> {
    return { ok: true };
  }

  async getContract(id: string): Promise<Contract | undefined> {
    return db.contracts.get(id);
  }

  async saveContract(c: Contract): Promise<void> {
    db.contracts.set(c.id, c);
  }

  async hasContract(id: string): Promise<boolean> {
    return db.contracts.has(id);
  }

  async getEvidence(id: string): Promise<EvidenceFile | undefined> {
    return db.evidences.get(id);
  }

  async saveEvidence(e: EvidenceFile): Promise<void> {
    db.evidences.set(e.id, e);
  }

  async findEvidenceByCid(cid: string): Promise<EvidenceFile | undefined> {
    for (const it of db.evidences.values()) {
      if (it.cid === cid) return it;
    }
    return undefined;
  }

  async countEvidenceVersions(
    contractId: string,
    disputeId: string | undefined,
    category: string,
  ): Promise<number> {
    let n = 0;
    for (const it of db.evidences.values()) {
      if (it.contractId === contractId && it.disputeId === disputeId && it.category === category) n += 1;
    }
    return n;
  }

  async hasEvidence(id: string): Promise<boolean> {
    return db.evidences.has(id);
  }

  async listEvidencesPastRetention(nowIso: string): Promise<EvidenceFile[]> {
    const out: EvidenceFile[] = [];
    for (const e of db.evidences.values()) {
      if (!e.retainUntil || e.retainUntil >= nowIso) continue;
      if (evidenceBlockedFromRetentionPurge(e, nowIso)) continue;
      out.push(e);
    }
    return out;
  }

  async deleteEvidence(id: string): Promise<void> {
    db.evidences.delete(id);
  }

  async getDispute(id: string): Promise<DisputeCase | undefined> {
    return db.disputes.get(id);
  }

  async saveDispute(d: DisputeCase): Promise<void> {
    db.disputes.set(d.id, d);
  }

  async appendDisputeVerifierVote(v: DisputeVerifierVoteRecord): Promise<void> {
    const cur = db.disputeVerifierVotes.get(v.disputeId) ?? [];
    cur.push(v);
    db.disputeVerifierVotes.set(v.disputeId, cur);
  }

  async listDisputeVerifierVotes(disputeId: string): Promise<DisputeVerifierVoteRecord[]> {
    return [...(db.disputeVerifierVotes.get(disputeId) ?? [])];
  }

  async listDisputeVerifierRegistry(): Promise<DisputeVerifierRegistryEntry[]> {
    const rows = [...db.disputeVerifierRegistry.values()];
    rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return rows;
  }

  async upsertDisputeVerifierRegistryEntry(e: DisputeVerifierRegistryEntry): Promise<void> {
    db.disputeVerifierRegistry.set(e.verifierId, { ...e });
  }

  async saveDecision(d: CaseDecision): Promise<void> {
    db.decisions.set(d.id, d);
  }

  async getXrplTx(txHash: string): Promise<XrplTransaction | undefined> {
    return db.xrplTxs.get(txHash);
  }

  async saveXrplTx(t: XrplTransaction): Promise<void> {
    db.xrplTxs.set(t.txHash, t);
  }

  async listXrplTxs(): Promise<XrplTransaction[]> {
    return [...db.xrplTxs.values()];
  }

  async listXrplSubscribeAccounts(max: number): Promise<string[]> {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const t of db.xrplTxs.values()) {
      if (t.validated || !t.account) continue;
      if (seen.has(t.account)) continue;
      seen.add(t.account);
      out.push(t.account);
      if (out.length >= max) break;
    }
    return out;
  }

  async tryRecordXrplIngestionEvent(params: {
    ledgerIndex: number;
    txHash: string;
    eventSource: string;
    engineResult?: string;
  }): Promise<boolean> {
    const key = `${params.ledgerIndex}:${params.txHash}:${params.eventSource}`;
    if (db.xrplIngestionDedup.has(key)) return false;
    db.xrplIngestionDedup.add(key);
    return true;
  }

  async saveNotification(n: NotificationEvent): Promise<void> {
    db.notifications.set(n.id, { ...n });
  }

  async getNotification(id: string): Promise<NotificationEvent | undefined> {
    return db.notifications.get(id);
  }

  async listDueNotifications(nowIso: string, limit: number): Promise<NotificationEvent[]> {
    const out: NotificationEvent[] = [];
    for (const n of db.notifications.values()) {
      if (n.deadLetter) continue;
      if (n.status === "queued") {
        out.push(n);
        continue;
      }
      if (n.status === "retry_scheduled") {
        if (!n.nextAttemptAt || n.nextAttemptAt <= nowIso) out.push(n);
      }
    }
    out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return out.slice(0, limit);
  }

  async appendNotificationOutbox(row: NotificationOutboxRecord): Promise<boolean> {
    if (db.notificationOutboxIdempotency.has(row.idempotencyKey)) return false;
    db.notificationOutboxById.set(row.id, { ...row });
    db.notificationOutboxIdempotency.set(row.idempotencyKey, row.id);
    return true;
  }

  async claimNotificationOutboxPending(limit: number, nowIsoStr: string): Promise<NotificationOutboxRecord[]> {
    const pending = [...db.notificationOutboxById.values()]
      .filter((r) => r.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
    const out: NotificationOutboxRecord[] = [];
    for (const r of pending) {
      const u: NotificationOutboxRecord = {
        ...r,
        status: "processing",
        processingStartedAt: nowIsoStr,
        updatedAt: nowIsoStr,
      };
      db.notificationOutboxById.set(r.id, u);
      out.push(u);
    }
    return out;
  }

  async updateNotificationOutbox(row: NotificationOutboxRecord): Promise<void> {
    const prev = db.notificationOutboxById.get(row.id);
    if (prev && prev.idempotencyKey !== row.idempotencyKey) {
      db.notificationOutboxIdempotency.delete(prev.idempotencyKey);
      db.notificationOutboxIdempotency.set(row.idempotencyKey, row.id);
    }
    db.notificationOutboxById.set(row.id, { ...row });
  }

  async getNotificationOutbox(id: string): Promise<NotificationOutboxRecord | undefined> {
    return db.notificationOutboxById.get(id);
  }

  async listNotificationOutboxPage(
    filter: NotificationOutboxListFilter,
    params: ListParams,
  ): Promise<Paginated<NotificationOutboxRecord>> {
    const rows = [...db.notificationOutboxById.values()].filter((r) => {
      if (filter.status && r.status !== filter.status) return false;
      return true;
    });
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const total = rows.length;
    const items = rows.slice(params.offset, params.offset + params.limit);
    return { items, total, limit: params.limit, offset: params.offset };
  }

  async recoverStaleNotificationOutboxProcessing(staleBeforeIso: string, nowIsoStr: string): Promise<number> {
    let n = 0;
    for (const r of db.notificationOutboxById.values()) {
      if (r.status !== "processing") continue;
      if (!r.processingStartedAt || r.processingStartedAt >= staleBeforeIso) continue;
      db.notificationOutboxById.set(r.id, {
        ...r,
        status: "pending",
        processingStartedAt: undefined,
        updatedAt: nowIsoStr,
      });
      n += 1;
    }
    return n;
  }

  async appendAudit(log: AuditLog): Promise<void> {
    db.audits.push(log);
  }

  async appendEvent(ev: EventEnvelope): Promise<void> {
    db.events.push(ev);
  }

  async listAudits(filter: AuditFilter): Promise<AuditLog[]> {
    return db.audits
      .filter((log) => {
        if (filter.entityType && log.entityType !== filter.entityType) return false;
        if (filter.entityId && log.entityId !== filter.entityId) return false;
        if (filter.from && log.createdAt < filter.from) return false;
        if (filter.to && log.createdAt > filter.to) return false;
        return true;
      })
      .sort((a, b) => {
        const c = a.createdAt.localeCompare(b.createdAt);
        return c !== 0 ? c : a.id.localeCompare(b.id);
      });
  }

  async listAuditsPage(filter: AuditFilter, params: ListParams): Promise<Paginated<AuditLog>> {
    const filtered = [...db.audits]
      .filter((log) => {
        if (filter.entityType && log.entityType !== filter.entityType) return false;
        if (filter.entityId && log.entityId !== filter.entityId) return false;
        if (filter.from && log.createdAt < filter.from) return false;
        if (filter.to && log.createdAt > filter.to) return false;
        return true;
      })
      .sort((a, b) => {
        const c = a.createdAt.localeCompare(b.createdAt);
        return c !== 0 ? c : a.id.localeCompare(b.id);
      });
    const total = filtered.length;
    const items = filtered.slice(params.offset, params.offset + params.limit);
    return { items, total, limit: params.limit, offset: params.offset };
  }

  async listAuditsAfterCursor(filter: AuditFilter, params: { limit: number; cursor?: string }): Promise<AuditKeysetPage> {
    const filtered = [...db.audits]
      .filter((log) => {
        if (filter.entityType && log.entityType !== filter.entityType) return false;
        if (filter.entityId && log.entityId !== filter.entityId) return false;
        if (filter.from && log.createdAt < filter.from) return false;
        if (filter.to && log.createdAt > filter.to) return false;
        return true;
      })
      .sort((a, b) => {
        const c = a.createdAt.localeCompare(b.createdAt);
        return c !== 0 ? c : a.id.localeCompare(b.id);
      });
    let start = 0;
    if (params.cursor) {
      const dec = decodeAuditCursor(params.cursor);
      if (!dec) {
        const err = new Error("INVALID_AUDIT_CURSOR");
        (err as { code?: string }).code = "INVALID_AUDIT_CURSOR";
        throw err;
      }
      start = filtered.findIndex(
        (x) => x.createdAt > dec.createdAt || (x.createdAt === dec.createdAt && x.id > dec.id),
      );
      if (start === -1) start = filtered.length;
    }
    const window = filtered.slice(start, start + params.limit + 1);
    const hasMore = window.length > params.limit;
    const items = hasMore ? window.slice(0, params.limit) : window;
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last ? encodeAuditCursor({ createdAt: last.createdAt, id: last.id }) : null;
    return { items, nextCursor };
  }

  async listEvents(filter: EventFilter): Promise<EventEnvelope[]> {
    return db.events.filter((event) => {
      if (filter.entityType && event.entityType !== filter.entityType) return false;
      if (filter.entityId && event.entityId !== filter.entityId) return false;
      if (filter.eventType && event.eventType !== filter.eventType) return false;
      return true;
    });
  }

  async createDelayedJobIfAbsent(job: DelayedJob): Promise<boolean> {
    if (db.delayedJobs.has(job.id)) return false;
    db.delayedJobs.set(job.id, { ...job });
    return true;
  }

  async claimDueDelayedJobs(
    kind: string,
    nowIsoStr: string,
    limit: number,
    lockTtlMs: number,
  ): Promise<DelayedJob[]> {
    const nowMs = Date.parse(nowIsoStr);
    if (Number.isNaN(nowMs)) return [];
    const lockUntil = new Date(nowMs + lockTtlMs).toISOString();
    const candidates = [...db.delayedJobs.values()]
      .filter(
        (j) =>
          j.kind === kind &&
          Date.parse(j.runAfter) <= nowMs &&
          (!j.lockedUntil || Date.parse(j.lockedUntil) <= nowMs),
      )
      .sort((a, b) => a.runAfter.localeCompare(b.runAfter))
      .slice(0, limit);
    const out: DelayedJob[] = [];
    for (const j of candidates) {
      const updated: DelayedJob = { ...j, lockedUntil: lockUntil, updatedAt: nowIsoStr };
      db.delayedJobs.set(j.id, updated);
      out.push(updated);
    }
    return out;
  }

  async deleteDelayedJob(id: string): Promise<void> {
    db.delayedJobs.delete(id);
  }

  async bumpDelayedJob(params: {
    id: string;
    runAfter: string;
    attempts: number;
    lastError?: string;
    updatedAt: string;
  }): Promise<void> {
    const j = db.delayedJobs.get(params.id);
    if (!j) return;
    db.delayedJobs.set(params.id, {
      ...j,
      runAfter: params.runAfter,
      attempts: params.attempts,
      lastError: params.lastError,
      updatedAt: params.updatedAt,
      lockedUntil: undefined,
    });
  }

  async listContractsPage(filter: ContractListFilter, params: ListParams): Promise<Paginated<Contract>> {
    const rows = [...db.contracts.values()].filter((c) => {
      if (filter.status && c.status !== filter.status) return false;
      if (filter.tenantId && c.tenantId !== filter.tenantId) return false;
      if (filter.landlordId && c.landlordId !== filter.landlordId) return false;
      if (filter.updatedFrom && c.updatedAt < filter.updatedFrom) return false;
      if (filter.updatedTo && c.updatedAt > filter.updatedTo) return false;
      return true;
    });
    rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const total = rows.length;
    const items = rows.slice(params.offset, params.offset + params.limit);
    return { items, total, limit: params.limit, offset: params.offset };
  }

  async listDisputesPage(filter: DisputeListFilter, params: ListParams): Promise<Paginated<DisputeCase>> {
    const rows = [...db.disputes.values()].filter((d) => {
      if (filter.contractId && d.contractId !== filter.contractId) return false;
      if (filter.status && d.status !== filter.status) return false;
      if (filter.updatedFrom && d.updatedAt < filter.updatedFrom) return false;
      if (filter.updatedTo && d.updatedAt > filter.updatedTo) return false;
      return true;
    });
    rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const total = rows.length;
    const items = rows.slice(params.offset, params.offset + params.limit);
    return { items, total, limit: params.limit, offset: params.offset };
  }

  async listXrplTxsPage(filter: XrplTxListFilter, params: ListParams): Promise<Paginated<XrplTransaction>> {
    const rows = [...db.xrplTxs.values()].filter((t) => {
      if (filter.account && t.account !== filter.account) return false;
      if (filter.trackingStatus && t.trackingStatus !== filter.trackingStatus) return false;
      if (filter.validated !== undefined && t.validated !== filter.validated) return false;
      if (filter.network && t.network !== filter.network) return false;
      return true;
    });
    rows.sort((a, b) => b.lastCheckedAt.localeCompare(a.lastCheckedAt));
    const total = rows.length;
    const items = rows.slice(params.offset, params.offset + params.limit);
    return { items, total, limit: params.limit, offset: params.offset };
  }

  async getOperatorStatsSummary(): Promise<OperatorStatsSummary> {
    const contractsByStatus: Record<string, number> = {};
    for (const c of db.contracts.values()) {
      contractsByStatus[c.status] = (contractsByStatus[c.status] ?? 0) + 1;
    }
    const disputesByStatus: Record<string, number> = {};
    for (const d of db.disputes.values()) {
      disputesByStatus[d.status] = (disputesByStatus[d.status] ?? 0) + 1;
    }
    const xrplByTracking: Record<string, number> = {};
    for (const t of db.xrplTxs.values()) {
      xrplByTracking[t.trackingStatus] = (xrplByTracking[t.trackingStatus] ?? 0) + 1;
    }
    const notificationsByStatus: Record<string, number> = {};
    for (const n of db.notifications.values()) {
      notificationsByStatus[n.status] = (notificationsByStatus[n.status] ?? 0) + 1;
    }
    const settlementsByStatus: Record<string, number> = {};
    for (const s of db.settlements.values()) {
      settlementsByStatus[s.status] = (settlementsByStatus[s.status] ?? 0) + 1;
    }
    return {
      contractsByStatus,
      disputesByStatus,
      xrplByTracking,
      notificationsByStatus,
      evidencesTotal: db.evidences.size,
      settlementsByStatus,
    };
  }

  async getReportsSummary(params: ReportSummaryParams): Promise<ReportSummary> {
    const global = await this.getOperatorStatsSummary();
    const inWindow = (iso: string): boolean => {
      if (params.from && iso < params.from) return false;
      if (params.to && iso > params.to) return false;
      return true;
    };
    const contractScope = (c: Contract): boolean => {
      if (params.tenantId && c.tenantId !== params.tenantId) return false;
      if (params.landlordId && c.landlordId !== params.landlordId) return false;
      return true;
    };

    const contractsByStatus: Record<string, number> = {};
    for (const c of db.contracts.values()) {
      if (!contractScope(c)) continue;
      if (!inWindow(c.updatedAt)) continue;
      contractsByStatus[c.status] = (contractsByStatus[c.status] ?? 0) + 1;
    }

    const disputesByStatus: Record<string, number> = {};
    for (const d of db.disputes.values()) {
      const c = db.contracts.get(d.contractId);
      if (!c || !contractScope(c)) continue;
      if (!inWindow(d.updatedAt)) continue;
      disputesByStatus[d.status] = (disputesByStatus[d.status] ?? 0) + 1;
    }

    const settlementsByStatus: Record<string, number> = {};
    for (const s of db.settlements.values()) {
      const c = db.contracts.get(s.contractId);
      if (!c || !contractScope(c)) continue;
      if (!inWindow(s.updatedAt)) continue;
      settlementsByStatus[s.status] = (settlementsByStatus[s.status] ?? 0) + 1;
    }

    const xrplByTracking: Record<string, number> = {};
    const needsDisputeScope = Boolean(params.tenantId || params.landlordId);
    for (const x of db.xrplTxs.values()) {
      if (!inWindow(x.lastCheckedAt)) continue;
      if (needsDisputeScope) {
        if (!x.disputeId) continue;
        const d = db.disputes.get(x.disputeId);
        if (!d) continue;
        const c = db.contracts.get(d.contractId);
        if (!c || !contractScope(c)) continue;
      }
      xrplByTracking[x.trackingStatus] = (xrplByTracking[x.trackingStatus] ?? 0) + 1;
    }

    let auditsCount = 0;
    for (const a of db.audits) {
      if (inWindow(a.createdAt)) auditsCount += 1;
    }

    const scoped: ReportScopedBucket = {
      contractsByStatus,
      disputesByStatus,
      settlementsByStatus,
      xrplByTracking,
      auditsCount,
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

  async getSettlement(id: string): Promise<SettlementRecord | undefined> {
    const s = db.settlements.get(id);
    return s ? withSettlementDefaults(s) : undefined;
  }

  async saveSettlement(s: SettlementRecord): Promise<void> {
    db.settlements.set(s.id, withSettlementDefaults({ ...s }));
  }

  async listSettlementsPage(
    filter: SettlementListFilter,
    params: ListParams,
  ): Promise<Paginated<SettlementRecord>> {
    const rows = [...db.settlements.values()].map(withSettlementDefaults).filter((it) => {
      if (filter.contractId && it.contractId !== filter.contractId) return false;
      if (filter.status && it.status !== filter.status) return false;
      if (filter.periodYear !== undefined && it.periodYear !== filter.periodYear) return false;
      if (filter.periodMonth !== undefined && it.periodMonth !== filter.periodMonth) return false;
      return true;
    });
    rows.sort((a, b) => {
      if (b.periodYear !== a.periodYear) return b.periodYear - a.periodYear;
      if (b.periodMonth !== a.periodMonth) return b.periodMonth - a.periodMonth;
      return a.contractId.localeCompare(b.contractId);
    });
    const total = rows.length;
    const items = rows.slice(params.offset, params.offset + params.limit);
    return { items, total, limit: params.limit, offset: params.offset };
  }

  async touchSettlementsOnLedgerClose(params: TouchSettlementsOnLedgerCloseParams): Promise<number> {
    const { periodYear, periodMonth, ledgerIndex, nowIso } = params;
    const eligible = new Set<Contract["status"]>(["active", "escrow_validated"]);
    let n = 0;
    for (const c of db.contracts.values()) {
      if (!eligible.has(c.status)) continue;
      const id = settlementDeterministicId(c.id, periodYear, periodMonth);
      const existing = db.settlements.get(id);
      if (existing?.status === "archived") continue;
      if (!existing) {
        db.settlements.set(id, {
          id,
          contractId: c.id,
          periodYear,
          periodMonth,
          status: "collecting",
          lastLedgerIndex: ledgerIndex,
          ledgerCloseCount: 1,
          createdAt: nowIso,
          updatedAt: nowIso,
          currencyCode: "XRP",
          periodMode: "calendar_utc",
        });
      } else {
        const base = withSettlementDefaults(existing);
        db.settlements.set(id, {
          ...base,
          lastLedgerIndex: ledgerIndex,
          ledgerCloseCount: base.ledgerCloseCount + 1,
          updatedAt: nowIso,
        });
      }
      n += 1;
    }
    return n;
  }

  async createExportJob(job: ExportJobRecord): Promise<void> {
    db.exportJobs.set(job.id, { ...job });
  }

  async getExportJob(id: string): Promise<ExportJobRecord | undefined> {
    return db.exportJobs.get(id);
  }

  async claimExportJobsPending(limit: number, nowIso: string): Promise<ExportJobRecord[]> {
    const pending = [...db.exportJobs.values()]
      .filter((j) => j.status === "pending")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const out: ExportJobRecord[] = [];
    for (const j of pending.slice(0, limit)) {
      const u: ExportJobRecord = { ...j, status: "running", updatedAt: nowIso };
      db.exportJobs.set(j.id, u);
      out.push(u);
    }
    return out;
  }

  async updateExportJob(job: ExportJobRecord): Promise<void> {
    db.exportJobs.set(job.id, { ...job });
  }
}
