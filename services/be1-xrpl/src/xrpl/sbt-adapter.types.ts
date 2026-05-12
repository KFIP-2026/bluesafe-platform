/**
 * BE2 `sbt-adapter-contract.ts` 와 동일한 job 형태 — SBT/평판 브리지 큐 연동 시 공유.
 * @see services/be2-ops/src/services/sbt-adapter-contract.ts
 */
export type SbtAdapterJobKind =
  | 'registry_sync'
  | 'mint_request'
  | 'burn_request';

export interface SbtAdapterJob {
  jobId: string;
  kind: SbtAdapterJobKind;
  /** 논리 체인 또는 registry id (호출자 정의) */
  targetRegistry: string;
  subjectType: string;
  subjectId: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  createdAt: string;
  attempt: number;
}
