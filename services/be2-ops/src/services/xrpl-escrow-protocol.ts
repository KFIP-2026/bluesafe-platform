/**
 * V7-A: Map XRPL EscrowCreate / EscrowFinish / EscrowCancel tx_json fields to persisted columns.
 * @see docs/adr/0005-v7-escrow-xrpl-tx-mapping.md
 */

export interface EscrowProtocolFields {
  escrowOwner?: string;
  escrowDestination?: string;
  escrowOfferSequence?: number;
  escrowSubmitterAccount?: string;
}

function classicAddress(v: unknown): string | undefined {
  return typeof v === "string" && v.startsWith("r") ? v : undefined;
}

function sequenceNumber(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  return undefined;
}

/** Merge rippled `tx` / stream shapes: fields may live on root or under `tx_json`. */
export function mergeTxJsonLayers(root: Record<string, unknown>): Record<string, unknown> {
  const nested = root.tx_json;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return { ...(nested as Record<string, unknown>), ...root };
  }
  return { ...root };
}

export function escrowProtocolFieldsFromTxJson(tx: Record<string, unknown>): EscrowProtocolFields {
  const tt = tx.TransactionType;
  if (tt !== "EscrowCreate" && tt !== "EscrowFinish" && tt !== "EscrowCancel") {
    return {};
  }
  const submitter = classicAddress(tx.Account);
  if (tt === "EscrowCreate") {
    return {
      escrowOwner: classicAddress(tx.Account),
      escrowDestination: classicAddress(tx.Destination),
      escrowOfferSequence: sequenceNumber(tx.Sequence),
      escrowSubmitterAccount: submitter,
    };
  }
  return {
    escrowOwner: classicAddress(tx.Owner),
    escrowOfferSequence: sequenceNumber(tx.OfferSequence),
    escrowSubmitterAccount: submitter,
  };
}
