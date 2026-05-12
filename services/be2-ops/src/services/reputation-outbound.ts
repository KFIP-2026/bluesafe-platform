import { createHmac } from "node:crypto";
import { config } from "../config.js";
import type { ReputationOutboundBody } from "../schemas.js";
import { emitEvent, nowIso, writeAudit } from "../utils.js";
import { recordReputationOutboundDelivery } from "./reputation-outbound-metrics.js";
import { recordReputationOutboundDlq, removeReputationDlq } from "./reputation-dlq.js";

/** V6-F: async POST to configured webhook after internal reputation hook accepts. */
export function scheduleReputationOutboundWebhook(body: ReputationOutboundBody): void {
  const url = config.reputation.outboundWebhookUrl.trim();
  if (!url) return;
  setImmediate(() => {
    void deliverReputationOutboundWebhook(body, url).catch((e) => {
      console.error("[reputation-outbound]", e);
    });
  });
}

async function deliverReputationOutboundWebhook(body: ReputationOutboundBody, url: string): Promise<void> {
  const envelope = {
    schemaVersion: "bluesafe.reputation.v2" as const,
    idempotencyKey: body.idempotencyKey,
    eventType: body.eventType,
    subjectType: body.subjectType,
    subjectId: body.subjectId,
    emittedAt: new Date().toISOString(),
    payload: {
      ...(body.payload ?? {}),
      ...(body.tokenStandardRefs?.length ? { tokenStandardRefs: body.tokenStandardRefs } : {}),
    },
  };
  const raw = Buffer.from(JSON.stringify(envelope), "utf8");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Bluesafe-Idempotency-Key": body.idempotencyKey,
  };
  const secret = config.reputation.outboundWebhookSecret.trim();
  if (secret) {
    const sig = createHmac("sha256", secret).update(raw).digest("hex");
    headers["X-Bluesafe-Signature"] = `sha256=${sig}`;
  }

  try {
    const res = await fetch(url, { method: "POST", headers, body: raw });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      recordReputationOutboundDelivery("fail");
      recordReputationOutboundDlq(body, { httpStatus: res.status, error: t.slice(0, 500) });
      await writeAudit({
        entityType: "reputation",
        entityId: body.idempotencyKey,
        action: "reputation.outbound_delivery_failed",
        actorId: "reputation_webhook",
        metadata: { httpStatus: res.status, detail: t.slice(0, 500) },
      });
      await emitEvent({
        eventType: "reputation.outbound_delivery_failed",
        entityType: body.subjectType,
        entityId: body.subjectId,
        payload: { idempotencyKey: body.idempotencyKey, httpStatus: res.status },
      });
      return;
    }
    removeReputationDlq(body.idempotencyKey);
    recordReputationOutboundDelivery("ok");
    await writeAudit({
      entityType: "reputation",
      entityId: body.idempotencyKey,
      action: "reputation.outbound_delivered",
      actorId: "reputation_webhook",
      metadata: { httpStatus: res.status },
    });
    await emitEvent({
      eventType: "reputation.outbound_delivered",
      entityType: body.subjectType,
      entityId: body.subjectId,
      payload: { idempotencyKey: body.idempotencyKey, at: nowIso() },
    });
  } catch (e) {
    recordReputationOutboundDelivery("fail");
    recordReputationOutboundDlq(body, { error: e instanceof Error ? e.message : "fetch_failed" });
    await writeAudit({
      entityType: "reputation",
      entityId: body.idempotencyKey,
      action: "reputation.outbound_delivery_failed",
      actorId: "reputation_webhook",
      metadata: { error: e instanceof Error ? e.message : "fetch_failed" },
    });
    await emitEvent({
      eventType: "reputation.outbound_delivery_failed",
      entityType: body.subjectType,
      entityId: body.subjectId,
      payload: { idempotencyKey: body.idempotencyKey, error: e instanceof Error ? e.message : "fetch_failed" },
    });
  }
}
