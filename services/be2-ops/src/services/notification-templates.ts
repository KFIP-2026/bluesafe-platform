const SUBJECT_PREFIX: Array<{ test: (et: string) => boolean; prefix: string }> = [
  { test: (et) => et.startsWith("refund.") || et.includes(".refund") || et.includes("refund_"), prefix: "[환급]" },
  { test: (et) => et.startsWith("settlement."), prefix: "[정산]" },
  { test: (et) => et.startsWith("dispute."), prefix: "[분쟁]" },
  { test: (et) => et.includes("expir") || et.endsWith(".expired"), prefix: "[만료]" },
  { test: (et) => et.startsWith("xrpl."), prefix: "[XRPL]" },
];

/** Short email / push title line (UTF-8; clients may localize later). */
export function notificationSubjectForEventType(eventType: string): string {
  const et = eventType.trim();
  const lower = et.toLowerCase();
  for (const row of SUBJECT_PREFIX) {
    if (row.test(lower)) return `${row.prefix} ${et}`;
  }
  return `[알림] ${et}`;
}

/** Human-readable body for provider logs / email webhook / push bridge. */
export function renderNotificationBody(eventType: string, payload: Record<string, unknown>): string {
  const title = notificationSubjectForEventType(eventType);
  const parts = Object.entries(payload)
    .filter(([k]) => !k.startsWith("_"))
    .slice(0, 12)
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`);
  return `${title}\n${parts.join("; ") || "(empty payload)"}`;
}
