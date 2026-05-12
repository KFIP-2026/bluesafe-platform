import type { AppRepository } from "../repository/app-repository.js";
import type { NotificationOutboxRecord } from "../types.js";
import { emitEvent, nowIso, randomId } from "../utils.js";

export interface NotificationOutboxFanoutWorkerOptions {
  getRepo: () => AppRepository;
  intervalMs: number;
  batchSize: number;
  disabled: boolean;
  /** Move `processing` rows older than this (ms) back to `pending`. */
  staleProcessingMs: number;
  /** After this many failed fan-out attempts, mark outbox `dead`. */
  maxDispatchAttempts: number;
}

export function startNotificationOutboxFanoutWorker(opts: NotificationOutboxFanoutWorkerOptions): () => void {
  if (opts.disabled) {
    return () => {};
  }
  const t = setInterval(() => {
    void runOutboxFanoutTick(opts).catch((e) => {
      console.error("[notification-outbox-fanout]", e);
    });
  }, opts.intervalMs);
  return () => clearInterval(t);
}

async function runOutboxFanoutTick(opts: NotificationOutboxFanoutWorkerOptions): Promise<void> {
  const r = opts.getRepo();
  const now = nowIso();
  const staleBefore = new Date(Date.now() - opts.staleProcessingMs).toISOString();
  await r.recoverStaleNotificationOutboxProcessing(staleBefore, now);

  const claimed = await r.claimNotificationOutboxPending(opts.batchSize, now);
  for (const row of claimed) {
    await dispatchOneOutboxRow(r, row, opts.maxDispatchAttempts, now);
  }
}

async function dispatchOneOutboxRow(
  r: AppRepository,
  row: NotificationOutboxRecord,
  maxDispatchAttempts: number,
  t: string,
): Promise<void> {
  const safeId = randomId("ntf");
  try {
    await r.saveNotification({
      id: safeId,
      eventType: row.eventType,
      recipientId: row.recipientId,
      channel: row.channel,
      status: "queued",
      payload: row.payload,
      createdAt: t,
      updatedAt: t,
      attemptCount: 0,
      deadLetter: false,
    });
    await emitEvent({
      eventType: "notification.requested",
      entityType: "notification",
      entityId: safeId,
      payload: { channel: row.channel, eventType: row.eventType, fromOutbox: true, outboxId: row.id },
    });
    await r.updateNotificationOutbox({
      ...row,
      status: "dispatched",
      updatedAt: t,
      dispatchedNotificationId: safeId,
      processingStartedAt: undefined,
      lastError: undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "dispatch_failed";
    const nextAttempts = row.attempts + 1;
    if (nextAttempts >= maxDispatchAttempts) {
      await r.updateNotificationOutbox({
        ...row,
        status: "dead",
        attempts: nextAttempts,
        lastError: msg,
        updatedAt: t,
        processingStartedAt: undefined,
      });
      await emitEvent({
        eventType: "notification.outbox_dead",
        entityType: "notification_outbox",
        entityId: row.id,
        payload: { eventType: row.eventType, attempts: nextAttempts, error: msg },
      });
    } else {
      await r.updateNotificationOutbox({
        ...row,
        status: "pending",
        attempts: nextAttempts,
        lastError: msg,
        updatedAt: t,
        processingStartedAt: undefined,
      });
    }
  }
}
