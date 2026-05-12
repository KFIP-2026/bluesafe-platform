const dekBySource: Record<string, number> = {};
let httpUnwrapMsTotal = 0;
let httpUnwrapCount = 0;

export function recordEvidenceDekResolution(source: string): void {
  dekBySource[source] = (dekBySource[source] ?? 0) + 1;
}

export function recordKmsHttpUnwrapMs(ms: number): void {
  httpUnwrapMsTotal += ms;
  httpUnwrapCount += 1;
}

export function getKmsDekMetricsSnapshot(): {
  dekBySource: Record<string, number>;
  kmsHttpUnwrapAvgMs: number;
} {
  return {
    dekBySource: { ...dekBySource },
    kmsHttpUnwrapAvgMs: httpUnwrapCount > 0 ? httpUnwrapMsTotal / httpUnwrapCount : 0,
  };
}
