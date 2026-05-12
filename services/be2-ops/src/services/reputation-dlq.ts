import type { ReputationOutboundBody } from "../schemas.js";

export interface ReputationDlqEntry {
  idempotencyKey: string;
  body: ReputationOutboundBody;
  failedAt: string;
  lastHttpStatus?: number;
  lastError?: string;
  attempts: number;
}

const MAX = 500;
const entries = new Map<string, ReputationDlqEntry>();

export function recordReputationOutboundDlq(
  body: ReputationOutboundBody,
  detail: { httpStatus?: number; error?: string },
): void {
  const prev = entries.get(body.idempotencyKey);
  const attempts = (prev?.attempts ?? 0) + 1;
  const row: ReputationDlqEntry = {
    idempotencyKey: body.idempotencyKey,
    body,
    failedAt: new Date().toISOString(),
    lastHttpStatus: detail.httpStatus,
    lastError: detail.error,
    attempts,
  };
  entries.set(body.idempotencyKey, row);
  if (entries.size > MAX) {
    const oldest = [...entries.keys()].slice(0, entries.size - MAX);
    for (const k of oldest) entries.delete(k);
  }
}

export function removeReputationDlq(idempotencyKey: string): void {
  entries.delete(idempotencyKey);
}

export function listReputationDlq(limit: number): ReputationDlqEntry[] {
  const n = Math.min(200, Math.max(1, limit));
  return [...entries.values()].slice(-n).reverse();
}

export function getReputationDlq(idempotencyKey: string): ReputationDlqEntry | undefined {
  return entries.get(idempotencyKey);
}
