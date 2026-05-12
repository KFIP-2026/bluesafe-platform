const samples: number[] = [];
const MAX = 512;

export function recordAuditListDurationMs(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  samples.push(ms);
  while (samples.length > MAX) samples.shift();
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[idx]!;
}

export function getAuditListDurationSnapshot(): { sampleCount: number; p50Ms: number; p95Ms: number } {
  if (samples.length === 0) return { sampleCount: 0, p50Ms: 0, p95Ms: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    sampleCount: sorted.length,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
  };
}
