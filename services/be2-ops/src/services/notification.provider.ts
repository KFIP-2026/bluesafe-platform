import { config } from "../config.js";
import type { NotificationEvent } from "../types.js";

export interface NotificationProvider {
  deliver(event: NotificationEvent): Promise<{ ok: boolean; error?: string }>;
}

function deliverInappMock(event: NotificationEvent): Promise<{ ok: boolean; error?: string }> {
  const mode = (process.env.NOTIFICATION_PROVIDER_MODE || "success").trim().toLowerCase();
  if (mode === "fail_always") {
    return Promise.resolve({ ok: false, error: "simulated_permanent_failure" });
  }
  if (mode === "fail_first") {
    const attempts = event.attemptCount ?? 0;
    if (attempts < 1) {
      return Promise.resolve({ ok: false, error: "simulated_transient_failure" });
    }
  }
  return Promise.resolve({ ok: true });
}

function payloadStrings(event: NotificationEvent): { subject: string; text: string } {
  const p = event.payload as Record<string, unknown>;
  const subject = typeof p._subject === "string" ? p._subject : event.eventType;
  const text =
    typeof p._rendered === "string" ? String(p._rendered) : `[${event.eventType}] notification`;
  return { subject, text };
}

/**
 * `NOTIFICATION_PROVIDER_MODE` applies to `inapp` (simulation).
 * `push`: optional `NOTIFICATION_PUSH_WEBHOOK_URL` POST; else stub + optional `NOTIFICATION_FCM_STUB_LOG=1`.
 * `email`: optional `NOTIFICATION_EMAIL_WEBHOOK_URL` POST; if unset, no-op success.
 */
export function createNotificationProvider(): NotificationProvider {
  return {
    async deliver(event) {
      if (event.channel === "push") {
        const url = config.notification.pushWebhookUrl.trim();
        const { subject, text } = payloadStrings(event);
        if (url) {
          try {
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: event.recipientId,
                title: subject,
                body: text,
                meta: { notificationId: event.id, eventType: event.eventType, payload: event.payload },
              }),
            });
            if (!res.ok) return { ok: false, error: `push_webhook_${res.status}` };
            return { ok: true };
          } catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : "push_webhook_error" };
          }
        }
        if (config.notification.fcmStubLog) {
          console.log(
            JSON.stringify({
              scope: "notification-push-stub",
              id: event.id,
              eventType: event.eventType,
              recipientId: event.recipientId,
              title: subject,
            }),
          );
        }
        return deliverInappMock(event);
      }

      if (event.channel === "email") {
        const url = config.notification.emailWebhookUrl.trim();
        if (!url) {
          console.log(
            JSON.stringify({
              scope: "notification-email-skip",
              id: event.id,
              eventType: event.eventType,
              reason: "NOTIFICATION_EMAIL_WEBHOOK_URL unset",
            }),
          );
          return { ok: true };
        }
        try {
          const { subject, text } = payloadStrings(event);
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: event.recipientId,
              subject,
              text,
              meta: { notificationId: event.id, eventType: event.eventType, payload: event.payload },
            }),
          });
          if (!res.ok) return { ok: false, error: `email_webhook_${res.status}` };
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : "email_webhook_error" };
        }
      }

      return deliverInappMock(event);
    },
  };
}
