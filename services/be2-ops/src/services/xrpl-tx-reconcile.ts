import { getRepo } from "../repository/context.js";
import type { LiveTxStatus } from "./xrpl.service.js";
import { contractPartyRecipientIds, maybeEnqueueDomainNotifications } from "./domain-notifications.js";
import { recordXrplTxOutcomeClassified } from "./xrpl-outcome-metrics.js";
import { classifyXrplResultCode, emitEvent, nowIso, writeAudit } from "../utils.js";
/** Apply rippled `tx` / stream outcome to a locally tracked hash and optionally resolve execution_pending disputes. */
export async function applyLiveTxStatus(txHash: string, liveStatus: LiveTxStatus): Promise<boolean> {
  const r = getRepo();
  const tracked = await r.getXrplTx(txHash);
  if (!tracked) return false;

  const acct = liveStatus.account?.trim();
  if (acct && !tracked.account) {
    tracked.account = acct;
  }

  if (liveStatus.transactionType) {
    tracked.txType = liveStatus.transactionType;
  }
  if (liveStatus.escrowOwner) tracked.escrowOwner = liveStatus.escrowOwner;
  if (liveStatus.escrowDestination) tracked.escrowDestination = liveStatus.escrowDestination;
  if (liveStatus.escrowOfferSequence !== undefined) {
    tracked.escrowOfferSequence = liveStatus.escrowOfferSequence;
  }
  if (liveStatus.escrowSubmitterAccount) {
    tracked.escrowSubmitterAccount = liveStatus.escrowSubmitterAccount;
  }

  tracked.lastCheckedAt = nowIso();
  tracked.validated = liveStatus.validated;
  tracked.ledgerIndex = liveStatus.ledgerIndex;
  tracked.resultCode = liveStatus.resultCode;
  tracked.outcomeClass = classifyXrplResultCode(liveStatus.resultCode);
  recordXrplTxOutcomeClassified(tracked.outcomeClass);
  if (tracked.validated && tracked.outcomeClass === "success") {
    tracked.trackingStatus = "validated_success";
  } else if (tracked.validated) {
    tracked.trackingStatus = "validated_fail";
  } else {
    tracked.trackingStatus = "pending_validation";
  }
  await r.saveXrplTx(tracked);

  if (tracked.disputeId && tracked.validated) {
    const dispute = await r.getDispute(tracked.disputeId);
    if (dispute && dispute.status === "execution_pending") {
      const before = dispute.status;
      const nextStatus = tracked.outcomeClass === "success" ? "executed" : "rejected";
      dispute.status = nextStatus;
      dispute.updatedAt = nowIso();
      await r.saveDispute(dispute);
      await writeAudit({
        entityType: "dispute",
        entityId: dispute.id,
        action: "dispute.execution_status_updated",
        actorId: "system",
        before: { status: before },
        after: { status: dispute.status, resultCode: tracked.resultCode, outcomeClass: tracked.outcomeClass },
      });
      await emitEvent({
        eventType: "dispute.execution_status_updated",
        entityType: "dispute",
        entityId: dispute.id,
        payload: { status: dispute.status, resultCode: tracked.resultCode, outcomeClass: tracked.outcomeClass },
      });
      const contractN = await r.getContract(dispute.contractId);
      if (contractN) {
        const eventType =
          nextStatus === "executed" ? "dispute.execution_completed" : "refund.dispute_execution_failed";
        await maybeEnqueueDomainNotifications(getRepo, {
          eventType,
          recipientIds: contractPartyRecipientIds(contractN),
          payload: {
            disputeId: dispute.id,
            contractId: dispute.contractId,
            txHash: tracked.txHash,
            outcomeClass: tracked.outcomeClass,
          },
        });
      }
    }  }

  return true;
}
