let completed = 0;
let failed = 0;

export function recordExportJobOutcome(outcome: "completed" | "failed"): void {
  if (outcome === "completed") completed += 1;
  else failed += 1;
}

export function getExportJobMetricsSnapshot(): { completed: number; failed: number } {
  return { completed, failed };
}
