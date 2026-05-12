import { config } from "../config.js";
import type { AppRepository } from "../repository/app-repository.js";
import type { Contract } from "../types.js";
import { enqueueFanoutNotificationItems, expandRecipientChannels } from "./notification-fanout-enqueue.js";

export function contractPartyRecipientIds(contract: Pick<Contract, "tenantId" | "landlordId">): string[] {
  return [contract.tenantId, contract.landlordId];
}

/** V6-C: fan-out to default channels for domain events (settlement/dispute matrix). */
export async function maybeEnqueueDomainNotifications(
  getRepo: () => AppRepository,
  input: {
    eventType: string;
    recipientIds: string[];
    payload: Record<string, unknown>;
  },
): Promise<void> {
  if (!config.notification.autoDomainEnqueue) return;
  const items = expandRecipientChannels(input.eventType, input.recipientIds, input.payload, { domainAuto: true });
  await enqueueFanoutNotificationItems(getRepo, items);
}
