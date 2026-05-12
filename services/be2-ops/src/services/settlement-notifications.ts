import type { AppRepository } from "../repository/app-repository.js";
import type { Contract, SettlementRecord } from "../types.js";
import { routedChannelsForEventType } from "./notification-routing.js";
import { enqueueFanoutNotificationItems } from "./notification-fanout-enqueue.js";

/** V5-B: enqueue default channels for `settlement.confirmed` to tenant + landlord. */
export async function enqueueSettlementConfirmedNotifications(
  getRepo: () => AppRepository,
  settlement: SettlementRecord,
  contract: Contract,
): Promise<void> {
  const channels = routedChannelsForEventType("settlement.confirmed");
  const payload = {
    settlementId: settlement.id,
    contractId: contract.id,
    periodYear: settlement.periodYear,
    periodMonth: settlement.periodMonth,
  };
  const items = [];
  for (const recipientId of [contract.tenantId, contract.landlordId]) {
    for (const channel of channels) {
      items.push({
        eventType: "settlement.confirmed",
        recipientId,
        channel,
        payload: { ...payload },
        requestedEmitExtra: { settlementAuto: true },
      });
    }
  }
  await enqueueFanoutNotificationItems(getRepo, items);
}