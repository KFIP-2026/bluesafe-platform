/** V6-D: settlement row touch activity driven by validated ledger closes. */

let ledgerCloseTouchInvocations = 0;
let contractsTouchedTotal = 0;

export function recordSettlementLedgerCloseTouch(contractsTouched: number): void {
  ledgerCloseTouchInvocations += 1;
  contractsTouchedTotal += Math.max(0, contractsTouched);
}

export function getSettlementSyncMetricsSnapshot(): {
  ledgerCloseTouchInvocations: number;
  contractsTouchedTotal: number;
} {
  return { ledgerCloseTouchInvocations, contractsTouchedTotal };
}
