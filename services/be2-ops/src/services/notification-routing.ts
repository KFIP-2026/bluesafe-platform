import type { NotificationChannel } from "../types.js";

/**
 * Default fan-out when `POST /v1/notifications/dispatch` omits `channels`.
 * Covers settlement, dispute, refund, expiry-style events, and XRPL plumbing.
 */
export function routedChannelsForEventType(eventType: string): NotificationChannel[] {
  const et = eventType.toLowerCase();
  if (et.startsWith("notification.")) return ["inapp"];
  if (et.startsWith("refund.") || et.includes(".refund") || et.includes("refund_")) {
    return ["inapp", "email", "push"];
  }
  if (et.startsWith("settlement.")) return ["inapp", "email"];
  if (et.startsWith("contract.")) return ["inapp", "email"];
  if (et.startsWith("dispute.")) return ["inapp", "push"];
  if (et.includes("expir") || et.endsWith(".expired") || et.includes("expiry")) {
    return ["inapp", "email", "push"];
  }
  if (et.startsWith("xrpl.")) return ["inapp"];
  return ["inapp"];
}
