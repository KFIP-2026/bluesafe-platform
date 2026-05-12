import crypto from "node:crypto";
import { getRepo } from "./repository/context.js";
import type { AuditLog, EventEnvelope, OutcomeClass, TxTrackingStatus } from "./types.js";

export function nowIso(): string {
  return new Date().toISOString();
}

export function randomId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export function sha256(content: string | Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function generateCidFromHash(hashValue: string): string {
  // Local MVP deterministic pseudo-CID. Replace with real IPFS pinning provider CID in W2 integration.
  return `bafy${hashValue.slice(0, 32)}`;
}

export function classifyXrplResultCode(resultCode?: string): OutcomeClass {
  if (!resultCode) return "manual_review";
  if (resultCode.startsWith("tes")) return "success";
  if (resultCode.startsWith("ter")) return "retryable";
  if (resultCode.startsWith("tem")) return "final_fail";
  if (resultCode.startsWith("tec")) return "manual_review";
  return "manual_review";
}

/** W5: stable client-facing copy for dashboards (not a substitute for rippled diagnostics). */
export function xrplTxClientPolicyHint(params: {
  trackingStatus: TxTrackingStatus;
  validated: boolean;
  outcomeClass: OutcomeClass;
  resultCode?: string | null;
}): { code: string; message: string } {
  const rc = (params.resultCode ?? "").trim();
  if (rc === "not_found_after_policy") {
    return {
      code: "B2_XRPL_TX_POLICY_EXHAUSTED",
      message:
        "This hash was not confirmed on ledger after repeated policy probes; have an operator verify the hash and network.",
    };
  }
  if (params.validated && params.outcomeClass === "success" && params.trackingStatus === "validated_success") {
    return {
      code: "B2_XRPL_TX_VALIDATED_SUCCESS",
      message: "Ledger-validated transaction with a successful engine result.",
    };
  }
  if (params.validated && params.outcomeClass === "final_fail") {
    return {
      code: "B2_XRPL_TX_TERMINAL_FAILURE",
      message: "Validated failure (non-retryable / tem-class); do not expect automatic success.",
    };
  }
  if (params.outcomeClass === "retryable" || params.trackingStatus === "retry_scheduled") {
    return {
      code: "B2_XRPL_TX_RETRYABLE",
      message: "Retryable XRPL outcome; Backend2 will re-probe on the policy schedule.",
    };
  }
  if (params.outcomeClass === "manual_review" || params.trackingStatus === "validated_fail") {
    return {
      code: "B2_XRPL_TX_MANUAL_REVIEW",
      message: "Human review recommended (tec-class, exhausted probes, or ambiguous engine result).",
    };
  }
  return {
    code: "B2_XRPL_TX_PENDING",
    message: "Reconciliation in progress (subscribe stream + tx / account_tx policy).",
  };
}

export async function writeAudit(params: Omit<AuditLog, "id" | "createdAt">): Promise<AuditLog> {
  const log: AuditLog = {
    id: randomId("aud"),
    createdAt: nowIso(),
    ...params,
  };
  await getRepo().appendAudit(log);
  return log;
}

export async function emitEvent(
  params: Omit<EventEnvelope, "eventId" | "occurredAt" | "traceId">,
): Promise<EventEnvelope> {
  const event: EventEnvelope = {
    eventId: randomId("evt"),
    traceId: randomId("trc"),
    occurredAt: nowIso(),
    ...params,
  };
  await getRepo().appendEvent(event);
  return event;
}
