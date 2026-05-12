/** W5: in-process counters for `/health?deep=1` (not Prometheus). */

const state = {
  lastTickAt: "" as string,
  tickCount: 0,
  jobsClaimed: 0,
  jobsResolved: 0,
  jobsRequeued: 0,
  jobsDeletedStale: 0,
  jobErrors: 0,
  accountBackfillTried: 0,
  accountBackfillUpdated: 0,
  policyExhausted: 0,
};

export function recordXrplTxPolicyTickEnd(stats: {
  at: string;
  jobsClaimed: number;
  jobsResolved: number;
  jobsRequeued: number;
  jobsDeletedStale: number;
  jobErrors: number;
  accountBackfillTried: number;
  accountBackfillUpdated: number;
  policyExhausted: number;
}): void {
  state.lastTickAt = stats.at;
  state.tickCount += 1;
  state.jobsClaimed += stats.jobsClaimed;
  state.jobsResolved += stats.jobsResolved;
  state.jobsRequeued += stats.jobsRequeued;
  state.jobsDeletedStale += stats.jobsDeletedStale;
  state.jobErrors += stats.jobErrors;
  state.accountBackfillTried += stats.accountBackfillTried;
  state.accountBackfillUpdated += stats.accountBackfillUpdated;
  state.policyExhausted += stats.policyExhausted;
}

export function getXrplTxPolicyMetricsSnapshot(): Record<string, unknown> {
  return { ...state };
}
