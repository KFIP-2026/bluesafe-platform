import type { LedgerStream } from "xrpl";
import type { AppRepository } from "../repository/app-repository.js";
import { recordSettlementLedgerCloseTouch } from "./settlement-sync-metrics.js";
import { emitEvent } from "../utils.js";

/** Seconds between Unix epoch (1970-01-01) and Ripple epoch (2000-01-01) UTC. */
export const RIPPLE_EPOCH_UNIX_SEC = 946684800;

export function settlementDeterministicId(contractId: string, year: number, month: number): string {
  const safe = contractId.replace(/[^a-zA-Z0-9_]/g, "_");
  return `stl_${safe}_${year}_${month}`;
}

/** `ledger_time` on stream is seconds since Ripple epoch (see rippled `ledger` stream docs). */
export function utcDateFromRippleLedgerTime(ledgerTime?: number): Date {
  if (typeof ledgerTime !== "number" || !Number.isFinite(ledgerTime)) {
    return new Date();
  }
  return new Date((RIPPLE_EPOCH_UNIX_SEC + ledgerTime) * 1000);
}

export function calendarMonthFromLedgerStream(stream: Pick<LedgerStream, "ledger_time">): {
  year: number;
  month: number;
} {
  const d = utcDateFromRippleLedgerTime(stream.ledger_time);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/**
 * After `settlement.ledger_closed` is emitted: upsert per-contract monthly rows and emit
 * `settlement.period_touched` (V5-A).
 */
export async function afterSettlementLedgerClosedEvent(
  getRepo: () => AppRepository,
  stream: Pick<LedgerStream, "ledger_index" | "ledger_time" | "ledger_hash">,
  options: { touchEnabled: boolean },
): Promise<void> {
  if (!options.touchEnabled) return;
  const { year, month } = calendarMonthFromLedgerStream(stream);
  const nowIso = new Date().toISOString();
  const n = await getRepo().touchSettlementsOnLedgerClose({
    periodYear: year,
    periodMonth: month,
    ledgerIndex: stream.ledger_index,
    nowIso,
  });
  recordSettlementLedgerCloseTouch(n);
  await emitEvent({
    eventType: "settlement.period_touched",
    entityType: "xrpl_ledger",
    entityId: `ledger:${stream.ledger_index}`,
    payload: {
      periodYear: year,
      periodMonth: month,
      contractsTouched: n,
      ledgerIndex: stream.ledger_index,
      ledgerHash: stream.ledger_hash ?? null,
    },
  });
}
