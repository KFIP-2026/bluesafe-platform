let deliveredOk = 0;
let deliveredFail = 0;

export function recordReputationOutboundDelivery(result: "ok" | "fail"): void {
  if (result === "ok") deliveredOk += 1;
  else deliveredFail += 1;
}

export function getReputationOutboundMetricsSnapshot(): { deliveredOk: number; deliveredFail: number } {
  return { deliveredOk, deliveredFail };
}
