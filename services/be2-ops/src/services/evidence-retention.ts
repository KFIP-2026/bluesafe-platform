import type { EvidenceFile } from "../types.js";

/** True when retention purge must not delete this row (legal hold / active hold window). */
export function evidenceBlockedFromRetentionPurge(ev: EvidenceFile, nowIso: string): boolean {
  const cls = ev.retentionClass ?? "standard";
  if (cls === "legal_hold") {
    if (!ev.legalHoldUntil) return true;
    return ev.legalHoldUntil >= nowIso;
  }
  return ev.legalHoldUntil != null && ev.legalHoldUntil >= nowIso;
}
