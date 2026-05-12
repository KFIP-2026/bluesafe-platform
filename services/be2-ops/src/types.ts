export type ContractStatus =
  | "draft"
  | "escrow_pending"
  | "escrow_validated"
  | "active"
  | "closed"
  | "cancelled";

export type DisputeStatus =
  | "filed"
  | "under_review"
  | "decided"
  | "execution_pending"
  | "executed"
  | "closed"
  | "rejected";

export type TxTrackingStatus =
  | "created"
  | "submitted"
  | "pending_validation"
  | "validated_success"
  | "validated_fail"
  | "retry_scheduled";

export type OutcomeClass =
  | "success"
  | "retryable"
  | "final_fail"
  | "manual_review";

export type NotificationChannel = "push" | "email" | "inapp";

export interface Contract {
  id: string;
  tenantId: string;
  landlordId: string;
  status: ContractStatus;
  escrowCreateTxHash?: string;
  createdAt: string;
  updatedAt: string;
}

/** V5-A: calendar-month settlement aggregate per contract (driven by `settlement.ledger_closed` stream). */
export type SettlementStatus = "collecting" | "accrued" | "confirmed" | "archived";

/** V7-C: canonical period bucketing (ADR 0007). */
export type SettlementPeriodMode = "calendar_utc";

export interface SettlementRecord {
  id: string;
  contractId: string;
  periodYear: number;
  periodMonth: number;
  status: SettlementStatus;
  lastLedgerIndex?: number;
  ledgerCloseCount: number;
  createdAt: string;
  updatedAt: string;
  /** Minor units (e.g. XRP drops or fiat cents); set via PATCH when accruing/confirming. */
  amountMinor?: number;
  currencyCode: string;
  batchId?: string;
  periodMode: SettlementPeriodMode;
  /** When status became `confirmed` (server clock). */
  confirmedAt?: string;
}

/** V7-D: operator-configured verifier identity (separate from per-dispute votes). */
export interface DisputeVerifierRegistryEntry {
  id: string;
  verifierId: string;
  displayLabel?: string;
  active: boolean;
  createdAt: string;
}

/** V8-C: policy bucket for retention / compliance (see ADR 0012). */
export type EvidenceRetentionClass = "standard" | "regulated" | "legal_hold";

export interface EvidenceFile {
  id: string;
  contractId: string;
  disputeId?: string;
  uploaderId: string;
  category:
    | "contract_pdf"
    | "utility_bill"
    | "photo"
    | "receipt"
    | "other";
  cid: string;
  sha256: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  isEncrypted: boolean;
  /** When set, IPFS payload is AES-256-GCM ciphertext (see `evidence-crypto.ts`). */
  encryptionScheme?: "aes-256-gcm-v1";
  /** Optional policy deadline for purge / legal hold workflows (stored only; no automatic deletion in MVP). */
  retainUntil?: string;
  /** V8-C: default `standard`. */
  retentionClass: EvidenceRetentionClass;
  /** V8-C: optional region / policy scope label. */
  jurisdiction?: string;
  /** V8-C: when set and still in the future, blocks retention purge (also see `retentionClass`). */
  legalHoldUntil?: string;
  storageProvider: "mock" | "pinata";
  createdAt: string;
  // Kept in memory only for local MVP use.
  localContentHashSeed: string;
}

export interface DisputeCase {
  id: string;
  contractId: string;
  raisedBy: "tenant" | "landlord" | "operator";
  reasonCode: string;
  status: DisputeStatus;
  evidenceBundle: string[];
  createdAt: string;
  updatedAt: string;
  /** W3: optional SLA — set when entering `under_review`. */
  reviewDeadlineAt?: string;
  /** W3: operator escalation marker. */
  escalatedAt?: string;
}

export type DisputeDecisionChoice =
  | "finish_to_tenant"
  | "finish_to_landlord"
  | "cancel_to_owner"
  | "partial_manual";

export interface DisputeVerifierVoteRecord {
  id: string;
  disputeId: string;
  verifierId: string;
  recommendation: DisputeDecisionChoice;
  createdAt: string;
}

export interface CaseDecision {
  id: string;
  disputeId: string;
  decision:
    | "finish_to_tenant"
    | "finish_to_landlord"
    | "cancel_to_owner"
    | "partial_manual";
  decidedBy: "verifier_mock";
  memo?: string;
  createdAt: string;
}

export interface XrplTransaction {
  id: string;
  txHash: string;
  txType: string;
  account?: string;
  disputeId?: string;
  network: "testnet" | "mainnet";
  trackingStatus: TxTrackingStatus;
  validated: boolean;
  ledgerIndex?: number;
  resultCode?: string;
  outcomeClass?: OutcomeClass;
  retries: number;
  lastCheckedAt: string;
  /** V7-A / ADR 0005 — EscrowCreate: Account, Destination, Sequence; Finish/Cancel: Owner, OfferSequence, Account. */
  escrowOwner?: string;
  escrowDestination?: string;
  escrowOfferSequence?: number;
  escrowSubmitterAccount?: string;
}

export interface NotificationEvent {
  id: string;
  eventType: string;
  recipientId: string;
  channel: NotificationChannel;
  status: "queued" | "sent" | "failed" | "retry_scheduled";
  payload: Record<string, unknown>;
  createdAt: string;
  /** Last mutation time (queue / delivery / retry). */
  updatedAt?: string;
  /** Delivery attempts completed (incremented after a failed provider call). */
  attemptCount?: number;
  /** When the worker may try again after `retry_scheduled`. */
  nextAttemptAt?: string;
  lastError?: string;
  /** Max attempts exceeded — no further automatic delivery. */
  deadLetter?: boolean;
}

/** V8-A: durable outbox row before fan-out into `notifications`. */
export type NotificationOutboxStatus = "pending" | "processing" | "dispatched" | "dead";

export interface NotificationOutboxRecord {
  id: string;
  idempotencyKey: string;
  eventType: string;
  recipientId: string;
  channel: NotificationChannel;
  payload: Record<string, unknown>;
  status: NotificationOutboxStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  processingStartedAt?: string;
  dispatchedNotificationId?: string;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface EventEnvelope {
  eventId: string;
  eventType: string;
  occurredAt: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  traceId: string;
}
