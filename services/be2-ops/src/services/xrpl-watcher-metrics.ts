/**
 * V7-B: metrics for `account_tx` backfill / operator-driven reconciliation (not subscribe ledger stream).
 */

let backfillLiveApplyTotal = 0;

export function recordXrplBackfillLiveApply(count: number): void {
  if (count > 0) backfillLiveApplyTotal += count;
}

export function getXrplWatcherBackfillSnapshot(): { backfillLiveApplyTotal: number } {
  return { backfillLiveApplyTotal };
}
