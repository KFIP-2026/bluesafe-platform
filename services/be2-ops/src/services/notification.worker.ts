import type { AppRepository } from "../repository/app-repository.js";
import type { NotificationEvent } from "../types.js";
import { emitEvent, nowIso, writeAudit } from "../utils.js";
import type { NotificationProvider } from "./notification.provider.js";
import { notificationSubjectForEventType, renderNotificationBody } from "./notification-templates.js";

export interface NotificationWorkerOptions {
  getRepo: () => AppRepository;
  provider: NotificationProvider;
  maxAttempts: number;
  intervalMs: number;
  batchSize: number;
  /** First backoff after failure (default 1000). */
  retryInitialBackoffMs?: number;
  /** Cap for exponential backoff (default 60000). */
  retryMaxBackoffMs?: number;
}

function backoffMs(attemptsAfterFailure: number, initialMs: number, maxMs: number): number {
  return Math.min(maxMs, initialMs * 2 ** attemptsAfterFailure);
}

async function processOne(
  n: NotificationEvent,
  opts: NotificationWorkerOptions,
  r: AppRepository,
): Promise<void> {
  const initial = opts.retryInitialBackoffMs ?? 1000;
  const maxB = opts.retryMaxBackoffMs ?? 60_000;
  const result = await opts.provider.deliver({
    ...n,
    payload: {
      ...n.payload,
      _subject: notificationSubjectForEventType(n.eventType),
      _rendered: renderNotificationBody(n.eventType, n.payload as Record<string, unknown>),
    },
  });
  const t = nowIso();
  if (result.ok) {
    await r.saveNotification({
      ...n,
      status: "sent",
      updatedAt: t,
      lastError: undefined,
      nextAttemptAt: undefined,
    });
    await writeAudit({
      entityType: "notification",
      entityId: n.id,
      action: "notification.sent",
      actorId: "system",
      metadata: { channel: n.channel, eventType: n.eventType },
    });
    await emitEvent({
      eventType: "notification.sent",
      entityType: "notification",
      entityId: n.id,
      payload: { channel: n.channel, eventType: n.eventType },
    });
    return;
  }

  const prevAttempts = n.attemptCount ?? 0;
  const failedDeliveries = prevAttempts + 1;

  if (failedDeliveries >= opts.maxAttempts) {
    await r.saveNotification({
      ...n,
      status: "failed",
      deadLetter: true,
      attemptCount: failedDeliveries,
      lastError: result.error ?? "delivery_failed",
      nextAttemptAt: undefined,
      updatedAt: t,
    });
    await writeAudit({
      entityType: "notification",
      entityId: n.id,
      action: "notification.failed",
      actorId: "system",
      metadata: {
        channel: n.channel,
        eventType: n.eventType,
        deadLetter: true,
        lastError: result.error,
      },
    });
    await emitEvent({
      eventType: "notification.failed",
      entityType: "notification",
      entityId: n.id,
      payload: { channel: n.channel, eventType: n.eventType, deadLetter: true },
    });
    return;
  }

  const nextAt = new Date(Date.now() + backoffMs(failedDeliveries, initial, maxB)).toISOString();
  await r.saveNotification({
    ...n,
    status: "retry_scheduled",
    attemptCount: failedDeliveries,
    lastError: result.error ?? "delivery_failed",
    nextAttemptAt: nextAt,
    updatedAt: t,
  });
}

async function processBatch(opts: NotificationWorkerOptions): Promise<void> {
  const r = opts.getRepo();
  const due = await r.listDueNotifications(nowIso(), opts.batchSize);
  for (const n of due) {
    await processOne(n, opts, r);
  }
}

export function startNotificationWorker(opts: NotificationWorkerOptions): () => void {
  const tick = async () => {
    try {
      await processBatch(opts);
    } catch (e) {
      console.error("[notification-worker]", e);
    }
  };
  const id = setInterval(() => {
    void tick();
  }, opts.intervalMs);
  void tick();
  return () => clearInterval(id);
}
