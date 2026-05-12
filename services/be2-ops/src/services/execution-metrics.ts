/** V6-A: counters for dispute execution request paths (Prometheus). */

let syntheticTotal = 0;
let ledgerTxTotal = 0;

export function recordExecutionRequest(kind: "synthetic" | "ledger_tx"): void {
  if (kind === "synthetic") syntheticTotal += 1;
  else ledgerTxTotal += 1;
}

export function getExecutionMetricsSnapshot(): { syntheticTotal: number; ledgerTxTotal: number } {
  return { syntheticTotal, ledgerTxTotal };
}
