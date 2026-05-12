import type { OutcomeClass } from "../types.js";

/** Cumulative outcome classifications after `applyLiveTxStatus` (and policy exhaustion path). */
const byClass: Record<OutcomeClass, number> = {
  success: 0,
  retryable: 0,
  final_fail: 0,
  manual_review: 0,
};
let reconcileApplyTotal = 0;

export function recordXrplTxOutcomeClassified(outcomeClass: OutcomeClass): void {
  reconcileApplyTotal += 1;
  byClass[outcomeClass] += 1;
}

export function getXrplOutcomeMetricsSnapshot(): Record<string, number> {
  return {
    reconcileApplyTotal,
    outcomeSuccess: byClass.success,
    outcomeRetryable: byClass.retryable,
    outcomeFinalFail: byClass.final_fail,
    outcomeManualReview: byClass.manual_review,
  };
}
