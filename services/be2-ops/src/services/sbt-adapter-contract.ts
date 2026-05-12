/**
 * V8-F: off-chain → on-chain reputation / SBT bridge — **contract only** in this repo.
 * Minting services implement this job shape; Backend2 may enqueue, retry, and DLQ.
 */

export type SbtAdapterJobKind = "registry_sync" | "mint_request" | "burn_request";

export interface SbtAdapterJob {
  jobId: string;
  kind: SbtAdapterJobKind;
  /** Logical chain or registry id (caller-defined). */
  targetRegistry: string;
  subjectType: string;
  subjectId: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
  attempt: number;
}
