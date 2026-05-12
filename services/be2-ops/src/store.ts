import type { DelayedJob, ExportJobRecord } from "./repository/app-repository.js";
import type {
  AuditLog,
  CaseDecision,
  Contract,
  DisputeCase,
  DisputeVerifierRegistryEntry,
  DisputeVerifierVoteRecord,
  EvidenceFile,
  NotificationEvent,
  NotificationOutboxRecord,
  SettlementRecord,
  EventEnvelope,
  XrplTransaction,
} from "./types.js";

export const db = {
  contracts: new Map<string, Contract>(),
  evidences: new Map<string, EvidenceFile>(),
  disputes: new Map<string, DisputeCase>(),
  decisions: new Map<string, CaseDecision>(),
  xrplTxs: new Map<string, XrplTransaction>(),
  notifications: new Map<string, NotificationEvent>(),
  /** V8-A: outbox rows (memory backend). */
  notificationOutboxById: new Map<string, NotificationOutboxRecord>(),
  notificationOutboxIdempotency: new Map<string, string>(),
  audits: [] as AuditLog[],
  events: [] as EventEnvelope[],
  /** Dedup keys `${ledgerIndex}:${txHash}:${eventSource}` for subscribe worker (memory backend). */
  xrplIngestionDedup: new Set<string>(),
  delayedJobs: new Map<string, DelayedJob>(),
  /** W3: verifier votes (memory backend). */
  disputeVerifierVotes: new Map<string, DisputeVerifierVoteRecord[]>(),
  /** V7-D: operator verifier directory (memory backend). */
  disputeVerifierRegistry: new Map<string, DisputeVerifierRegistryEntry>(),
  /** V5-A settlements (memory backend). */
  settlements: new Map<string, SettlementRecord>(),
  /** V6: async export jobs (memory backend). */
  exportJobs: new Map<string, ExportJobRecord>(),
};
