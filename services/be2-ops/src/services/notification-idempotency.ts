import { createHash } from "node:crypto";

/** Deterministic JSON for idempotency keys (sorted object keys). */
export function stablePayloadFingerprint(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = payload[k];
  return JSON.stringify(sorted);
}

export function domainNotificationIdempotencyKey(
  eventType: string,
  recipientId: string,
  channel: string,
  payload: Record<string, unknown>,
): string {
  const body = `${eventType}\n${recipientId}\n${channel}\n${stablePayloadFingerprint(payload)}`;
  return createHash("sha256").update(body, "utf8").digest("hex");
}
