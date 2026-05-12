/**
 * V8-F: off-chain → on-chain reputation / SBT bridge — **contract only** in this repo.
 * Minting services implement this job shape; Backend2 may enqueue, retry, and DLQ.
 *
 * 타입 정합: BE1 `services/be1-xrpl/src/xrpl/sbt-adapter.types.ts` 와 동일 스키마 유지.
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
