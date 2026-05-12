import { config } from "../config.js";
import type { AppRepository } from "../repository/app-repository.js";
import type { NotificationChannel } from "../types.js";
import { routedChannelsForEventType } from "./notification-routing.js";
import { domainNotificationIdempotencyKey } from "./notification-idempotency.js";
import { emitEvent, nowIso, randomId } from "../utils.js";

export interface FanoutNotificationItem {
  eventType: string;
  recipientId: string;
  channel: NotificationChannel;
  payload: Record<string, unknown>;
  /** Extra fields on `notification.requested` domain event payload. */
  requestedEmitExtra?: Record<string, unknown>;
}

/**
 * V8-A: enqueue one logical notification (domain/settlement auto paths).
 * When `NOTIFICATION_DOMAIN_OUTBOX=1`, writes `notification_outbox` only; otherwise legacy direct `notifications` row.
 */
export async function enqueueFanoutNotificationItems(
  getRepo: () => AppRepository,
  items: FanoutNotificationItem[],
): Promise<void> {
  const r = getRepo();
  const now = nowIso();
  if (config.notification.domainOutbox) {
    for (const it of items) {
      const idempotencyKey = domainNotificationIdempotencyKey(
        it.eventType,
        it.recipientId,
        it.channel,
        it.payload,
      );
      const id = randomId("nox");
      const inserted = await r.appendNotificationOutbox({
        id,
        idempotencyKey,
        eventType: it.eventType,
        recipientId: it.recipientId,
        channel: it.channel,
        payload: it.payload,
        status: "pending",
        attempts: 0,
        createdAt: now,
        updatedAt: now,
      });
      if (inserted) {
        await emitEvent({
          eventType: "notification.outbox_enqueued",
          entityType: "notification_outbox",
          entityId: id,
          payload: {
            channel: it.channel,
            eventType: it.eventType,
            idempotencyKey,
            ...(it.requestedEmitExtra ?? {}),
          },
        });
      }
    }
    return;
  }

  for (const it of items) {
    const id = randomId("ntf");
    await r.saveNotification({
      id,
      eventType: it.eventType,
      recipientId: it.recipientId,
      channel: it.channel,
      status: "queued",
      payload: it.payload,
      createdAt: now,
      updatedAt: now,
      attemptCount: 0,
      deadLetter: false,
    });
    await emitEvent({
      eventType: "notification.requested",
      entityType: "notification",
      entityId: id,
      payload: {
        channel: it.channel,
        eventType: it.eventType,
        ...(it.requestedEmitExtra ?? {}),
      },
    });
  }
}

/** Expand recipient list × default channels for an event type (respects `autoDomainEnqueue` for domain-only callers). */
export function expandRecipientChannels(
  eventType: string,
  recipientIds: string[],
  payload: Record<string, unknown>,
  requestedEmitExtra?: Record<string, unknown>,
): FanoutNotificationItem[] {
  const channels = routedChannelsForEventType(eventType);
  const items: FanoutNotificationItem[] = [];
  for (const recipientId of recipientIds) {
    for (const channel of channels) {
      items.push({ eventType, recipientId, channel, payload: { ...payload }, requestedEmitExtra });
    }
  }
  return items;
}
